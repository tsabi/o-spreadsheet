import { deepCopy, isInside, zoneToXc } from "../../helpers";
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
 *  - Searchbar : startwith or contains ?
 *
 * Question:
 *  - faire match du CSS avec odoo
 *    - typiquement, button primary color
 */

export class FiltersPlugin extends CorePlugin<FiltersState> implements FiltersState {
  static getters = ["getFilter", "getFilters", "getFilterTables"] as const;

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
      case "CREATE_FILTER_TABLE":
        const filters = this.filters[cmd.sheetId] ? [...this.filters[cmd.sheetId]] : [];
        const createRange = (zone: Zone) =>
          this.getters.getRangeFromSheetXC(cmd.sheetId, zoneToXc(zone));
        const newFilter = new FilterTable(cmd.target[0], createRange);
        filters.push(newFilter);
        this.history.update("filters", cmd.sheetId, filters);
        break;
      case "UPDATE_FILTER":
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
        console.log(this.getFilter(cmd.sheetId, cmd.col, cmd.row));
        break;
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
