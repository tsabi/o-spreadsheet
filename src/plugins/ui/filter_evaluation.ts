import { DEFAULT_FILTER_BORDER_DESC } from "../../constants";
import { isInside, range, toLowerCase } from "../../helpers";
import { Border, Command, Position, UID } from "../../types";
import { UIPlugin } from "../ui_plugin";

export class FilterEvaluationPlugin extends UIPlugin {
  static getters = [
    "getFilterBorder",
    "getFilterHeaders",
    "isFilterHeader",
    "isRowFiltered",
  ] as const;

  hiddenRows: Set<number> = new Set();
  isEvaluationDirty = false;

  handle(cmd: Command) {
    switch (cmd.type) {
      case "UNDO":
      case "REDO":
      case "UPDATE_CELL":
      case "EVALUATE_CELLS":
      case "EVALUATE_ALL_SHEETS":
      case "ACTIVATE_SHEET":
        this.isEvaluationDirty = true;
        break;
      case "UPDATE_FILTER":
        this.updateHiddenRows();
        break;
    }
  }

  finalize() {
    if (this.isEvaluationDirty) {
      this.updateHiddenRows();
      this.isEvaluationDirty = false;
    }
  }

  isRowFiltered(sheetId: UID, row: number) {
    if (sheetId !== this.getters.getActiveSheetId()) {
      return false;
    }

    return this.hiddenRows.has(row);
  }

  getFilterBorder(sheetId: UID, col: number, row: number): Border | undefined {
    for (let filters of this.getters.getFilterTables(sheetId)) {
      const zone = filters.zone;

      // The borders should be at the edges of the visible zone of the filter
      const colsRange = range(zone.left, zone.right + 1);
      const rowsRange = range(zone.top, zone.bottom + 1);
      const visibleLeft = this.getters.findVisibleHeader(sheetId, "COL", colsRange);
      const visibleRight = this.getters.findVisibleHeader(sheetId, "COL", colsRange.reverse());
      const visibleTop = this.getters.findVisibleHeader(sheetId, "ROW", rowsRange);
      const visibleBottom = this.getters.findVisibleHeader(sheetId, "ROW", rowsRange.reverse());

      if (isInside(col, row, zone)) {
        const border = {
          top: row === visibleTop ? DEFAULT_FILTER_BORDER_DESC : undefined,
          bottom: row === visibleBottom ? DEFAULT_FILTER_BORDER_DESC : undefined,
          left: col === visibleLeft ? DEFAULT_FILTER_BORDER_DESC : undefined,
          right: col === visibleRight ? DEFAULT_FILTER_BORDER_DESC : undefined,
        };
        if (border.top || border.bottom || border.left || border.right) {
          return border;
        }
      }
    }
    return undefined;
  }

  getFilterHeaders(sheetId: UID): Position[] {
    const headers: Position[] = [];
    for (let filters of this.getters.getFilterTables(sheetId)) {
      const zone = filters.zone;
      if (!zone) {
        continue;
      }
      const row = zone.top;
      for (let col = zone.left; col <= zone.right; col++) {
        if (this.getters.isColHidden(sheetId, col) || this.getters.isRowHidden(sheetId, row)) {
          continue;
        }
        headers.push({ col, row });
      }
    }
    return headers;
  }

  isFilterHeader(sheetId: UID, col: number, row: number): boolean {
    const headers = this.getFilterHeaders(sheetId);
    return headers.some((header) => header.col === col && header.row === row);
  }

  private updateHiddenRows() {
    const sheetId = this.getters.getActiveSheetId();
    const filters = this.getters.getFilters(sheetId);

    const hiddenRows = new Set<number>();
    for (let filter of filters) {
      const filteredValues = filter.filteredValues.map(toLowerCase);
      if (!filter.filteredZone) continue;
      for (let row = filter.filteredZone.top; row <= filter.filteredZone.bottom; row++) {
        const value = this.getCellValueAsString(sheetId, filter.col, row);
        if (filteredValues.includes(value)) {
          hiddenRows.add(row);
        }
      }
    }
    this.hiddenRows = hiddenRows;
  }

  private getCellValueAsString(sheetId: UID, col: number, row: number): string {
    const value = this.getters.getCell(sheetId, col, row)?.formattedValue;
    return value !== undefined && value !== null ? String(value).toLowerCase() : "";
  }
}
