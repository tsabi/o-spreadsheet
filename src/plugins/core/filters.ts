import {
  areZonesContinuous,
  deepCopy,
  expandZoneOnInsertion,
  intersection,
  isInside,
  isZoneInside,
  overlap,
  reduceZoneOnDeletion,
  toZone,
  union,
  zoneToXc,
} from "../../helpers";
import { FilterData, FilterTable } from "../../types/filters";
import {
  AddColumnsRowsCommand,
  CommandResult,
  CoreCommand,
  ExcelWorkbookData,
  RemoveColumnsRowsCommand,
  UID,
  UpdateCellCommand,
  WorkbookData,
  Zone,
} from "../../types/index";
import { CorePlugin } from "../core_plugin";
import { Filter } from "./../../types/filters";

interface FiltersState {
  filters: Record<UID, Record<UID, FilterTable>>;
}

export class FiltersPlugin extends CorePlugin<FiltersState> implements FiltersState {
  static getters = [
    "getFilter",
    "getFilters",
    "getFilterTable",
    "getFilterTables",
    "getFilterTablesInZone",
    "isFilterActive",
    "isZonesContainFilter",
  ] as const;

  filters: Record<UID, Record<UID, FilterTable>> = {};

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
        if (!areZonesContinuous(...cmd.target)) {
          return CommandResult.NonContinuousTargets;
        }
        const zone = union(...cmd.target);
        if (this.getFilterTables(cmd.sheetId).some((filter) => overlap(filter.zone, zone))) {
          return CommandResult.FilterOverlap;
        }
        const mergesInTarget = this.getters.getMergesInZone(cmd.sheetId, zone);
        for (let merge of mergesInTarget) {
          if (overlap(zone, merge)) {
            return CommandResult.MergeInFilter;
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
        this.history.update("filters", cmd.sheetId, {});
        break;
      case "DELETE_SHEET":
        const filterTables = { ...this.filters };
        delete filterTables[cmd.sheetId];
        this.history.update("filters", filterTables);
        break;
      case "DUPLICATE_SHEET":
        this.history.update("filters", cmd.sheetIdTo, deepCopy(this.filters[cmd.sheetId]));
        break;
      case "ADD_COLUMNS_ROWS":
        this.onAddColumnsRows(cmd);
        break;
      case "REMOVE_COLUMNS_ROWS":
        this.onDeleteColumnsRows(cmd);
        break;
      case "CREATE_FILTER_TABLE": {
        const zone = union(...cmd.target);
        const filterId = this.uuidGenerator.uuidv4();
        const newFilter = this.createFilterTable(zone);
        this.history.update("filters", cmd.sheetId, filterId, newFilter);

        break;
      }
      case "REMOVE_FILTER_TABLE": {
        const tables: Record<UID, FilterTable> = {};
        for (const filterTableId of this.getFilterTablesIds(cmd.sheetId)) {
          const filterTable = this.filters[cmd.sheetId][filterTableId];
          if (cmd.target.every((zone) => !intersection(zone, filterTable.zone))) {
            tables[filterTableId] = filterTable;
          }
        }
        this.history.update("filters", cmd.sheetId, tables);
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
      case "UPDATE_CELL": {
        // Since this plugin is loaded before CellPlugin, the getters still give us the old cell content
        const oldCellContent = this.getters.getCell(cmd.sheetId, cmd.col, cmd.row)?.content;
        this.onUpdateCell(cmd, oldCellContent);
      }
    }
  }

  getFilters(sheetId: UID): Filter[] {
    const filters: Filter[] = [];
    for (let filterTable of this.getFilterTables(sheetId)) {
      for (let filter of filterTable.filters) {
        filters.push(filter);
      }
    }
    return filters;
  }

  getFilterTables(sheetId: UID): FilterTable[] {
    return this.filters[sheetId] ? Object.values(this.filters[sheetId]) : [];
  }

  getFilter(sheetId: UID, col: number, row: number): Filter | undefined {
    for (let filterTable of this.getFilterTables(sheetId)) {
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

  getFilterTable(sheetId: UID, col: number, row: number): FilterTable | undefined {
    for (let filterTable of this.getFilterTables(sheetId)) {
      if (isInside(col, row, filterTable.zone)) {
        return filterTable;
      }
    }
    return undefined;
  }

  /** Get the filter tables that are fully inside the given zone */
  getFilterTablesInZone(sheetId: UID, zone: Zone): FilterTable[] {
    const tables: FilterTable[] = [];
    for (let filterTable of this.getFilterTables(sheetId)) {
      if (isZoneInside(filterTable.zone, zone)) {
        tables.push(filterTable);
      }
    }
    return tables;
  }

  isFilterActive(sheetId: UID, col: number, row: number): boolean {
    const filter = this.getFilter(sheetId, col, row);
    return Boolean(filter && filter.filteredValues.length);
  }

  isZonesContainFilter(sheetId: UID, zones: Zone[]): boolean {
    for (const zone of zones) {
      for (const filterTable of this.getFilterTables(sheetId)) {
        if (intersection(zone, filterTable.zone)) {
          return true;
        }
      }
    }
    return false;
  }

  private onAddColumnsRows(cmd: AddColumnsRowsCommand) {
    for (let tableId of this.getFilterTablesIds(cmd.sheetId)) {
      const filterTable = this.filters[cmd.sheetId][tableId];
      if (!filterTable) {
        return;
      }
      const zone = expandZoneOnInsertion(
        filterTable.zone,
        cmd.dimension === "COL" ? "left" : "top",
        cmd.base,
        cmd.position,
        cmd.quantity
      );
      if (zoneToXc(zone) !== zoneToXc(filterTable.zone)) {
        const filters: Filter[] = [];
        for (let filterId = 0; filterId < filterTable.filters.length; filterId++) {
          const filter = filterTable.filters[filterId];
          const filterZone = expandZoneOnInsertion(
            filter.zoneWithHeaders,
            cmd.dimension === "COL" ? "left" : "top",
            cmd.base,
            cmd.position,
            cmd.quantity,
            true
          );
          filters.push(new Filter(filterZone, filter.filteredValues));
        }

        // Add filters for new columns
        if (filters.length < zone.right - zone.left + 1) {
          for (let col = zone.left; col <= zone.right; col++) {
            if (!filters.find((filter) => filter.col === col)) {
              filters.push(new Filter({ ...zone, left: col, right: col }, []));
            }
          }
          filters.sort((f1, f2) => f1.col - f2.col);
        }
        this.history.update("filters", cmd.sheetId, tableId, "zone", zone);
        this.history.update("filters", cmd.sheetId, tableId, "filters", filters);
      }
    }
  }

  private onDeleteColumnsRows(cmd: RemoveColumnsRowsCommand) {
    for (let tableId of this.getFilterTablesIds(cmd.sheetId)) {
      const table = this.filters[cmd.sheetId][tableId];
      if (!table) {
        return;
      }
      const zone = reduceZoneOnDeletion(
        table.zone,
        cmd.dimension === "COL" ? "left" : "top",
        cmd.elements
      );
      if (!zone) {
        const tables = { ...this.filters[cmd.sheetId] };
        delete tables[tableId];
        this.history.update("filters", cmd.sheetId, tables);
      } else {
        if (zoneToXc(zone) !== zoneToXc(table.zone)) {
          const filters: Filter[] = [];
          for (let filterId = 0; filterId < table.filters.length; filterId++) {
            const filter = table.filters[filterId];
            const newFilterZone = reduceZoneOnDeletion(
              filter.zoneWithHeaders,
              cmd.dimension === "COL" ? "left" : "top",
              cmd.elements
            );
            if (newFilterZone) {
              filters.push(new Filter(newFilterZone, filter.filteredValues));
            }
          }
          this.history.update("filters", cmd.sheetId, tableId, "zone", zone);
          this.history.update("filters", cmd.sheetId, tableId, "filters", filters);
        }
      }
    }
  }

  private getFilterTableId(sheetId: UID, col: number, row: number): UID | undefined {
    for (let tableId of this.getFilterTablesIds(sheetId)) {
      const filterTable = this.filters[sheetId][tableId];
      if (isInside(col, row, filterTable.zone)) {
        return tableId;
      }
    }
    return undefined;
  }

  private getFilterTablesIds(sheetId: UID): UID[] {
    return this.filters[sheetId] ? Object.keys(this.filters[sheetId]) : [];
  }

  private getFilterId(
    sheetId: UID,
    col: number,
    row: number
  ): { filterTableId?: UID; filterId?: number } {
    const filterTableId = this.getFilterTableId(sheetId, col, row);
    if (filterTableId === undefined) {
      return {};
    }
    const filterId = this.filters[sheetId][filterTableId].getFilterId(col);
    return { filterId, filterTableId };
  }

  private createFilterTable(zone: Zone): FilterTable {
    return new FilterTable(zone);
  }

  private onUpdateCell(
    { content: cellContent, sheetId, col, row }: UpdateCellCommand,
    oldCellContent: string | undefined
  ) {
    if (oldCellContent === undefined && cellContent !== undefined) {
      for (let tableId of this.getFilterTablesIds(sheetId)) {
        const table = this.filters[sheetId][tableId];
        const zone = table.zone;
        if (zone.bottom + 1 === row && col >= zone.left && col <= zone.right) {
          const newZone = { ...zone, bottom: zone.bottom + 1 };
          this.history.update("filters", sheetId, tableId, "zone", newZone);
          for (let filterId = 0; filterId < table.filters.length; filterId++) {
            const filter = table.filters[filterId];
            const newFilterZone = {
              ...filter.zoneWithHeaders,
              bottom: filter.zoneWithHeaders.bottom + 1,
            };
            this.history.update(
              "filters",
              sheetId,
              tableId,
              "filters",
              filterId,
              "zoneWithHeaders",
              newFilterZone
            );
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Import/Export
  // ---------------------------------------------------------------------------

  import(data: WorkbookData) {
    this.filters = {};
    for (let sheet of data.sheets) {
      const filterTables: Record<UID, FilterTable> = {};
      for (let filterTableData of sheet.filterTables || []) {
        const table = this.createFilterTable(toZone(filterTableData.range));
        const tableId = this.uuidGenerator.uuidv4();
        filterTables[tableId] = table;
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
      for (let filterTable of this.getFilterTables(sheet.id)) {
        const filtersData: FilterData[] = [];
        for (let filter of filterTable.filters) {
          // Only export filtered values that are still in the sheet at the time of export
          let valuesInSheet: string[] = [];
          if (filter.filteredZone) {
            valuesInSheet = this.getters
              .getCellsInZone(sheet.id, filter.filteredZone)
              .map((cell) => cell?.evaluated.value)
              .map((val) => (val !== undefined && val !== null ? String(val) : ""));
          }
          filtersData.push({
            col: filter.col,
            filteredValues: filter.filteredValues.filter((val) => valuesInSheet.includes(val)),
          });
        }
        sheet.filterTables.push({
          range: zoneToXc(filterTable.zone),
          filters: filtersData,
        });
      }
    }
  }

  exportForExcel(data: ExcelWorkbookData) {
    this.export(data);
  }
}
