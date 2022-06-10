import { deepCopy, intersection, isInside, overlap, toZone, zoneToXc } from "../../helpers";
import { FilterData, FilterTable } from "../../types/filters";
import {
  ApplyRangeChange,
  CommandResult,
  CoreCommand,
  ExcelWorkbookData,
  SheetId,
  UID,
  WorkbookData,
  Zone,
} from "../../types/index";
import { CorePlugin } from "../core_plugin";
import { Filter } from "./../../types/filters";

interface FiltersState {
  filters: Record<UID, Array<FilterTable>>;
}

export class FiltersPlugin extends CorePlugin<FiltersState> implements FiltersState {
  static getters = [
    "getFilter",
    "getFilters",
    "getFilterTable",
    "getFilterTables",
    "isFilterActive",
    "isZonesContainFilter",
  ] as const;

  filters: Record<UID, Array<FilterTable>> = {};

  adaptRanges(applyChange: ApplyRangeChange, sheetId?: UID) {
    const sheetIds = sheetId ? [sheetId] : Object.keys(this.filters);
    for (const sheetId of sheetIds) {
      for (let tableId = 0; tableId < this.getFilterTables(sheetId).length; tableId++) {
        const filterTable = this.filters[sheetId][tableId];
        const change = applyChange(filterTable.range);
        if (change.changeType === "RESIZE" || change.changeType === "MOVE") {
          const newFilters = this.adaptFilterTableFilters(
            sheetId,
            change.range.zone,
            filterTable.filters,
            applyChange
          );
          this.history.update("filters", sheetId, tableId, "filters", newFilters);
          this.history.update("filters", sheetId, tableId, "range", change.range);
        } else if (change.changeType === "REMOVE") {
          //TODO change array to object and remove
        } else if (change.changeType !== "NONE") {
          this.history.update("filters", sheetId, tableId, "range", change.range);
        }
      }
    }
  }

  adaptFilterTableFilters(
    sheetId: SheetId,
    filterTableZone: Zone,
    filters: Filter[],
    applyChange: ApplyRangeChange
  ): Filter[] {
    const newFilters: Filter[] = [];
    for (let col = filterTableZone.left; col <= filterTableZone.right; col++) {
      const filter = filters.find((filter) => filter.col === col);
      if (!filter) {
        newFilters.push(
          new Filter(
            this.getters.getRangeFromSheetXC(
              sheetId,
              zoneToXc({ ...filterTableZone, left: col, right: col })
            ),
            []
          )
        );
        continue;
      }
      const filterChange = applyChange(filter.fullRange);
      if (filterChange.changeType === "REMOVE") {
        continue;
      } else if (filterChange.changeType !== "NONE") {
        console.log("OldZone : ");
        console.log(filter.fullRange.zone);
        console.log("NewZone : ");
        console.log(filterChange.range.zone);

        newFilters.push(new Filter(filterChange.range, filter.filteredValues));
      }
    }
    return newFilters;
  }

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: CoreCommand): CommandResult {
    // check only one target for create filter
    // check overlapping filters
    // sheetId/col/row is inside a filter ?
    // add merge : not across filter border, not vertically inside filter

    switch (cmd.type) {
      case "CREATE_FILTER_TABLE":
        for (let zone of cmd.target) {
          if (this.getFilterTables(cmd.sheetId).some((filter) => overlap(filter.zone, zone))) {
            return CommandResult.FilterOverlap;
          }
          const mergesInTarget = this.getters.getMergesInZone(cmd.sheetId, zone);
          for (let merge of mergesInTarget) {
            if (overlap(zone, merge)) {
              return CommandResult.MergeInFilter;
            }
          }
        }
        break;
      case "UPDATE_FILTER":
        if (!this.getFilter(cmd.sheetId, cmd.col, cmd.row)) {
          return CommandResult.FilterNotFound;
        }
        break;
      case "ADD_MERGE":
        for (let merge of cmd.target) {
          for (let filterTable of this.getFilterTables(cmd.sheetId)) {
            if (overlap(filterTable.zone, merge)) {
              return CommandResult.MergeInFilter;
            }
          }
        }
        break;
    }
    return CommandResult.Success;
  }

  handle(cmd: CoreCommand) {
    switch (cmd.type) {
      case "CREATE_SHEET":
        this.history.update("filters", cmd.sheetId, []);
        break;
      case "DELETE_SHEET":
        const filterTables = { ...this.filters };
        delete filterTables[cmd.sheetId];
        this.history.update("filters", filterTables);
        break;
      case "DUPLICATE_SHEET":
        this.history.update("filters", cmd.sheetIdTo, deepCopy(this.filters[cmd.sheetId]));
        break;
      case "CREATE_FILTER_TABLE": {
        for (let zone of cmd.target) {
          const filters = this.filters[cmd.sheetId] ? [...this.filters[cmd.sheetId]] : [];
          const newFilter = this.createFilterTable(cmd.sheetId, zone);
          filters.push(newFilter);
          this.history.update("filters", cmd.sheetId, filters);
        }
        break;
      }
      case "REMOVE_FILTER_TABLE": {
        const filters: FilterTable[] = [];
        for (const filterTable of this.getFilterTables(cmd.sheetId)) {
          if (cmd.target.every((zone) => !intersection(zone, filterTable.zone))) {
            filters.push(filterTable);
          }
        }
        this.history.update("filters", cmd.sheetId, filters);
        break;
      }
      case "UPDATE_FILTER": {
        const { filterTableId, filterId } = this.getFilterId(cmd.sheetId, cmd.col, cmd.row);
        if (filterTableId === undefined || filterId === undefined) {
          return;
        }
        this.history.update(
          "filters",
          cmd.sheetId,
          filterTableId,
          "filters",
          filterId,
          "filteredValues",
          cmd.values
        );
        break;
      }
    }
  }

  getFilters(sheetId: SheetId): Filter[] {
    const filters: Filter[] = [];
    for (let filterTable of this.filters[sheetId]) {
      for (let filter of filterTable.filters) {
        filters.push(filter);
      }
    }
    return filters;
  }

  getFilterTables(sheetId: SheetId): FilterTable[] {
    return this.filters[sheetId];
  }

  getFilter(sheetId: SheetId, col: number, row: number): Filter | undefined {
    for (let filterTable of this.filters[sheetId]) {
      if (isInside(col, row, filterTable.zone)) {
        for (let filter of filterTable.filters) {
          if (filter.col === col) {
            return filter;
          }
        }
      }
    }
    return undefined;
  }

  getFilterTable(sheetId: SheetId, col: number, row: number): FilterTable | undefined {
    for (let filterTable of this.filters[sheetId]) {
      if (isInside(col, row, filterTable.zone)) {
        return filterTable;
      }
    }
    return undefined;
  }

  isFilterActive(sheetId: SheetId, col: number, row: number): boolean {
    const filter = this.getFilter(sheetId, col, row);
    return Boolean(filter && filter.filteredValues.length);
  }

  isZonesContainFilter(sheetId: SheetId, zones: Zone[]): boolean {
    for (const zone of zones) {
      for (const filterTable of this.getFilterTables(sheetId)) {
        if (intersection(zone, filterTable.zone)) {
          return true;
        }
      }
    }
    return false;
  }

  private getFilterTableId(sheetId: UID, col: number, row: number): number | undefined {
    for (let i = 0; i < this.filters[sheetId].length; i++) {
      const filterTable = this.filters[sheetId][i];
      if (isInside(col, row, filterTable.zone)) {
        return i;
      }
    }
    return undefined;
  }

  private getFilterId(
    sheetId: UID,
    col: number,
    row: number
  ): { filterTableId?: number; filterId?: number } {
    const filterTableId = this.getFilterTableId(sheetId, col, row);
    if (filterTableId === undefined) {
      return {};
    }
    const filterId = this.filters[sheetId][filterTableId].getFilterId(col);
    return { filterId, filterTableId };
  }

  private createFilterTable(sheetId: SheetId, zone: Zone): FilterTable {
    const createRange = (zone: Zone) => this.getters.getRangeFromSheetXC(sheetId, zoneToXc(zone));
    return new FilterTable(zone, createRange);
  }

  // ---------------------------------------------------------------------------
  // Import/Export
  // ---------------------------------------------------------------------------

  import(data: WorkbookData) {
    this.filters = {};
    for (let sheet of data.sheets) {
      const filterTables: FilterTable[] = [];
      for (let filterTableData of sheet.filterTables || []) {
        const table = this.createFilterTable(sheet.id, toZone(filterTableData.range));
        filterTables.push(table);
        for (let filterData of filterTableData.filters) {
          const filter = table.filters.find((f) => f.col === filterData.col);
          if (!filter) {
            console.warn("Error when loading a filter");
            continue;
          }
          filter.filteredValues = filterData.filteredValues;
        }
      }

      this.filters[sheet.id] = filterTables;
    }
  }

  export(data: WorkbookData) {
    for (let sheet of data.sheets) {
      for (let filterTable of this.filters[sheet.id]) {
        const filtersData: FilterData[] = [];
        for (let filter of filterTable.filters) {
          // Only export filtered values that are still in the sheet at the time of export
          const valuesInSheet = this.getters
            .getCellsInZone(sheet.id, filter.filteredZone)
            .map((cell) => cell?.evaluated.value)
            .map((val) => (val !== undefined && val !== null ? String(val) : ""));
          filtersData.push({
            col: filter.col,
            filteredValues: filter.filteredValues.filter((val) => valuesInSheet.includes(val)),
          });
        }
        sheet.filterTables.push({
          range: this.getters.getRangeString(filterTable.range, sheet.id),
          filters: filtersData,
        });
      }
    }
  }

  exportForExcel(data: ExcelWorkbookData) {
    this.export(data);
  }
}
