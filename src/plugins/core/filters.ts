import { deepCopy, intersection, isInside, overlap, union, zoneToXc } from "../../helpers";
import { FilterTable } from "../../types/filters";
import {
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

/**
 * Questions nathan :
 *  - filter quand la valeur change (c'est une formule)
 *     - google fait n'imp, on perd totalement la row et on peu pas la récupérer sans disable le filter
 *     - Excel change la valeur filtrée.
 *  - c'est bien partagé et sauvegardé les filters ?
 *  - Icone filter dans la topbar en plus de dans Data => filter ?
 *  - merge :
 *     - allow single line merges ?
 *  - Searchbar : startwith or contains ?
 *  - sort
 *    - blank spaces : current w/ sort : at the bottom. Same as Excel. GSheet put them on top for ascending, bottom descending
 *    - sort : only filter column, whole table row, or whole sheet
 *    - merge : value only at top-left, or whole merge ?
 *
 * Question:
 *  - faire match du CSS avec odoo
 *    - typiquement, button primary color
 */

export class FiltersPlugin extends CorePlugin<FiltersState> implements FiltersState {
  static getters = ["getFilter", "getFilters", "getFilterTables", "isFilterActive"] as const;

  filters: Record<UID, Array<FilterTable>> = {};

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
            if (zoneToXc(zone) !== zoneToXc(union(merge, zone))) {
              return CommandResult.MergeAcrossFilter;
            }
            if (merge.bottom !== merge.top) {
              return CommandResult.VerticalMergeInFilter;
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
            const zone = filterTable.zone;
            if (overlap(zone, merge)) {
              if (zoneToXc(zone) !== zoneToXc(union(merge, zone))) {
                return CommandResult.MergeAcrossFilter;
              }
              if (merge.bottom !== merge.top) {
                return CommandResult.VerticalMergeInFilter;
              }
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
          const createRange = (zone: Zone) =>
            this.getters.getRangeFromSheetXC(cmd.sheetId, zoneToXc(zone));
          const newFilter = new FilterTable(zone, createRange);
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

  isFilterActive(sheetId: SheetId, col: number, row: number): boolean {
    const filter = this.getFilter(sheetId, col, row);
    return Boolean(filter && filter.filteredValues.length);
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

  // ---------------------------------------------------------------------------
  // Import/Export
  // ---------------------------------------------------------------------------

  import(data: WorkbookData) {
    for (let sheet of data.sheets) {
      this.filters[sheet.id] = [];
    }
  }

  export(data: WorkbookData) {
    //TODO
  }

  exportForExcel(data: ExcelWorkbookData) {
    this.export(data);
  }
}
