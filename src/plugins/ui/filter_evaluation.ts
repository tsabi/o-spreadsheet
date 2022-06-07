import { DEFAULT_FILTER_BORDER_DESC } from "../../constants";
import { isInside } from "../../helpers";
import { Border, Position, UID } from "../../types";
import { UIPlugin } from "../ui_plugin";

export class FilterEvaluationPlugin extends UIPlugin {
  static getters = [
    "getFilteredRows",
    "getFilterBorder",
    "getFilterHeaders",
    "isFilterHeader",
    "isRowFiltered",
  ] as const;

  hiddenRows: Set<number> = new Set();

  finalize() {
    const sheetId = this.getters.getActiveSheetId();
    const filters = this.getters.getFilters(sheetId);

    const hiddenRows = new Set<number>();
    for (let filter of filters) {
      for (let row = filter.startRow; row <= filter.endRow; row++) {
        const value = this.getCellValue(sheetId, filter.col, row);
        if (filter.filteredValues.includes(value)) {
          hiddenRows.add(row);
        }
      }
    }
    this.hiddenRows = hiddenRows;
  }

  //TODO probably delete this
  getFilteredRows(sheetId: UID) {
    if (this.getters.getActiveSheetId() !== sheetId) return [];
    return Array.from(this.hiddenRows);
  }

  isRowFiltered(sheetId: UID, row: number) {
    if (sheetId !== this.getters.getActiveSheetId()) {
      return false;
    }

    return this.hiddenRows.has(row);
  }

  getFilterBorder(sheetId: UID, col: number, row: number): Border | undefined {
    //TODO : when bottom/top is hidden
    for (let filters of this.getters.getFilterTables(sheetId)) {
      const zone = filters.zone;
      if (isInside(col, row, zone)) {
        const border = {
          top: row === zone.top ? DEFAULT_FILTER_BORDER_DESC : undefined,
          bottom: row === zone.bottom ? DEFAULT_FILTER_BORDER_DESC : undefined,
          left: col === zone.left ? DEFAULT_FILTER_BORDER_DESC : undefined,
          right: col === zone.right ? DEFAULT_FILTER_BORDER_DESC : undefined,
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

  private getCellValue(sheetId: UID, col: number, row: number): string {
    const value = this.getters.getCell(sheetId, col, row)?.evaluated.value;
    return value !== undefined ? String(value) : "";
  }
}
