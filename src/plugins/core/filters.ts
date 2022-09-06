import {
  areZonesContinuous,
  deepCopy,
  expandZoneOnInsertion,
  intersection,
  isInside,
  isZoneInside,
  overlap,
  range,
  reduceZoneOnDeletion,
  toZone,
  union,
  zoneToXc,
} from "../../helpers";
import { Filter, FilterTable } from "../../helpers/filters";
import {
  AddColumnsRowsCommand,
  CommandResult,
  CoreCommand,
  ExcelWorkbookData,
  FilterId,
  RemoveColumnsRowsCommand,
  UID,
  UpdateCellCommand,
  WorkbookData,
  Zone,
} from "../../types/index";
import { CorePlugin } from "../core_plugin";
import { Alias } from "./../../types/misc";

/**
 * There is 2 components in filters : FilterTables and filters.
 * Tables are 100% core.
 * Filters are kinda only UI, the filter values aren't shared/saved.
 *
 * Handle filters 100% in UI plugin :
 *  - The filters are linked to the tables (1 filter per col of the table)
 *      - cannot just handle add/remove cols in the local plugin, because we have no way to handle undo/redo
 *      - the core plugin could dispatch commands when columns are added or removed, and the UI plugin react to these commands
 *        - but not really, also because of uno/redo
 *
 * So I don't think I can handle the filters 100% in an UI plugin. Which kinda sucks because filter do nothing in Core, except
 * being created and deleted when the table is resized.
 *
 * Idea that work (but I don't like it that much):
 *  - Have filters in core
 *    - They contain a position and an ID
 *  - The UI plugin contain mapping filterId/filter values
 *  - And the core plugin know mapping filterId/position
 */

type FilterTableId = UID & Alias;
interface FiltersState {
  tables: Record<UID, Record<FilterTableId, FilterTable>>;
}

export class FiltersPlugin extends CorePlugin<FiltersState> implements FiltersState {
  static getters = [
    "doesZonesContainFilter",
    "getFilter",
    "getFilters",
    "getFilterTable",
    "getFilterTables",
    "getFilterTablesInZone",
    "getFilterId",
  ] as const;

  readonly tables: Record<UID, Record<FilterTableId, FilterTable>> = {};

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: CoreCommand): CommandResult {
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
        this.history.update("tables", cmd.sheetId, {});
        break;
      case "DELETE_SHEET":
        const filterTables = { ...this.tables };
        delete filterTables[cmd.sheetId];
        this.history.update("tables", filterTables);
        break;
      case "DUPLICATE_SHEET":
        this.history.update("tables", cmd.sheetIdTo, deepCopy(this.tables[cmd.sheetId]));
        break;
      case "ADD_COLUMNS_ROWS":
        this.onAddColumnsRows(cmd);
        break;
      case "REMOVE_COLUMNS_ROWS":
        this.onDeleteColumnsRows(cmd);
        break;
      case "CREATE_FILTER_TABLE": {
        const zone = union(...cmd.target);
        const filterTableId = this.uuidGenerator.uuidv4();
        const newFilterTable = this.createFilterTable(zone);
        this.history.update("tables", cmd.sheetId, filterTableId, newFilterTable);
        break;
      }
      case "REMOVE_FILTER_TABLE": {
        const tables: Record<UID, FilterTable> = {};
        for (const filterTableId of this.getFilterTablesIds(cmd.sheetId)) {
          const filterTable = this.tables[cmd.sheetId][filterTableId];
          if (cmd.target.every((zone) => !intersection(zone, filterTable.zone))) {
            tables[filterTableId] = filterTable;
          }
        }
        this.history.update("tables", cmd.sheetId, tables);
        break;
      }
      case "UPDATE_CELL": {
        this.onUpdateCell(cmd);
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
    return this.tables[sheetId] ? Object.values(this.tables[sheetId]) : [];
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

  getFilterId(sheetId: UID, col: number, row: number): FilterId | undefined {
    return this.getFilter(sheetId, col, row)?.id;
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

  doesZonesContainFilter(sheetId: UID, zones: Zone[]): boolean {
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
      const filterTable = this.tables[cmd.sheetId][tableId];
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
        for (const filter of filterTable.filters) {
          const filterZone = expandZoneOnInsertion(
            filter.zoneWithHeaders,
            cmd.dimension === "COL" ? "left" : "top",
            cmd.base,
            cmd.position,
            cmd.quantity
          );
          filters.push(new Filter(filter.id, filterZone));
        }

        // Add filters for new columns
        if (filters.length < zone.right - zone.left + 1) {
          for (let col = zone.left; col <= zone.right; col++) {
            if (!filters.find((filter) => filter.col === col)) {
              filters.push(
                new Filter(this.uuidGenerator.uuidv4(), { ...zone, left: col, right: col })
              );
            }
          }
          filters.sort((f1, f2) => f1.col - f2.col);
        }
        this.history.update("tables", cmd.sheetId, tableId, "zone", zone);
        this.history.update("tables", cmd.sheetId, tableId, "filters", filters);
      }
    }
  }

  private onDeleteColumnsRows(cmd: RemoveColumnsRowsCommand) {
    for (let tableId of this.getFilterTablesIds(cmd.sheetId)) {
      const table = this.tables[cmd.sheetId][tableId];
      if (!table) {
        return;
      }
      const zone = reduceZoneOnDeletion(
        table.zone,
        cmd.dimension === "COL" ? "left" : "top",
        cmd.elements
      );
      if (!zone) {
        const tables = { ...this.tables[cmd.sheetId] };
        delete tables[tableId];
        this.history.update("tables", cmd.sheetId, tables);
      } else {
        if (zoneToXc(zone) !== zoneToXc(table.zone)) {
          const filters: Filter[] = [];
          for (const filter of table.filters) {
            const newFilterZone = reduceZoneOnDeletion(
              filter.zoneWithHeaders,
              cmd.dimension === "COL" ? "left" : "top",
              cmd.elements
            );
            if (newFilterZone) {
              filters.push(new Filter(filter.id, newFilterZone));
            }
          }
          this.history.update("tables", cmd.sheetId, tableId, "zone", zone);
          this.history.update("tables", cmd.sheetId, tableId, "filters", filters);
        }
      }
    }
  }

  private getFilterTablesIds(sheetId: UID): UID[] {
    return this.tables[sheetId] ? Object.keys(this.tables[sheetId]) : [];
  }

  private createFilterTable(zone: Zone): FilterTable {
    return new FilterTable(zone);
  }

  private onUpdateCell(cmd: UpdateCellCommand) {
    const sheetId = cmd.sheetId;
    for (let tableId of this.getFilterTablesIds(sheetId)) {
      const table = this.tables[sheetId][tableId];
      if (this.canUpdateCellCmdExtendTable(cmd, table)) {
        const newZone = { ...table.zone, bottom: table.zone.bottom + 1 };
        this.history.update("tables", sheetId, tableId, "zone", newZone);
        for (let filterIndex = 0; filterIndex < table.filters.length; filterIndex++) {
          const filter = table.filters[filterIndex];
          const newFilterZone = {
            ...filter.zoneWithHeaders,
            bottom: filter.zoneWithHeaders.bottom + 1,
          };
          this.history.update(
            "tables",
            sheetId,
            tableId,
            "filters",
            filterIndex,
            "zoneWithHeaders",
            newFilterZone
          );
        }
        return;
      }
    }
  }

  /**
   * Check if an UpdateCell command should cause the given table to be extended by one row.
   *
   * The table should be extended if :
   * 1) The cell updated is right below the table
   * 2) The command add a content to the cell
   * 3) No cell right below the table had any content before the command
   *
   */
  private canUpdateCellCmdExtendTable(
    { content: newCellContent, sheetId, col, row }: UpdateCellCommand,
    table: FilterTable
  ) {
    if (!newCellContent) {
      return;
    }

    const zone = table.zone;
    if (!(zone.bottom + 1 === row && col >= zone.left && col <= zone.right)) {
      return false;
    }

    for (const col of range(zone.left, zone.right + 1)) {
      // Since this plugin is loaded before CellPlugin, the getters still give us the old cell content
      const cellContent = this.getters.getCell(sheetId, col, row)?.content;
      if (cellContent !== undefined) {
        return false;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Import/Export
  // ---------------------------------------------------------------------------

  import(data: WorkbookData) {
    for (let sheet of data.sheets) {
      for (let filterTableData of sheet.filterTables || []) {
        const table = this.createFilterTable(toZone(filterTableData.range));
        const tableId = this.uuidGenerator.uuidv4();
        this.history.update("tables", sheet.id, tableId, table);
      }
    }
  }

  export(data: WorkbookData) {
    for (let sheet of data.sheets) {
      for (let filterTable of this.getFilterTables(sheet.id)) {
        sheet.filterTables.push({
          range: zoneToXc(filterTable.zone),
        });
      }
    }
  }

  exportForExcel(data: ExcelWorkbookData) {
    this.export(data);
  }
}
