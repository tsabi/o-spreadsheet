import { range } from "../../helpers";
import { Dimension, Position, SheetId } from "../../types";
import { UIPlugin } from "../ui_plugin";

export class HeaderVisibilityUIPlugin extends UIPlugin {
  static getters = [
    "getNextVisibleCellPosition",
    "getNextVisibleCellPosition",
    "findVisibleHeader",
    "findLastVisibleColRowIndex",
    "findFirstVisibleColRowIndex",
    "isRowHidden",
    "isColHidden",
    "isHeaderHidden",
  ] as const;

  isRowHidden(sheetId: SheetId, index: number): boolean {
    return (
      this.getters.isRowHiddenByUser(sheetId, index) || this.getters.isRowFiltered(sheetId, index)
    );
  }

  isColHidden(sheetId: SheetId, index: number): boolean {
    return this.getters.isColHiddenByUser(sheetId, index);
  }

  isHeaderHidden(sheetId: SheetId, dimension: Dimension, index: number) {
    return dimension === "COL"
      ? this.isColHidden(sheetId, index)
      : this.isRowHidden(sheetId, index);
  }

  getNextVisibleCellPosition(sheetId: SheetId, col: number, row: number): Position {
    return {
      col: this.findVisibleHeader(sheetId, "COL", range(col, this.getters.getNumberCols(sheetId)))!,
      row: this.findVisibleHeader(sheetId, "ROW", range(row, this.getters.getNumberRows(sheetId)))!,
    };
  }

  findVisibleHeader(sheetId: SheetId, dimension: Dimension, indexes: number[]): number | undefined {
    return indexes.find(
      (index) =>
        this.getters.doesHeaderExist(sheetId, dimension, index) &&
        !this.isHeaderHidden(sheetId, dimension, index)
    );
  }

  findLastVisibleColRowIndex(sheetId: SheetId, dimension: Dimension): number {
    let lastIndex: number;
    for (
      lastIndex = this.getters.getNumberHeaders(sheetId, dimension) - 1;
      lastIndex >= 0;
      lastIndex--
    ) {
      if (!this.isHeaderHidden(sheetId, dimension, lastIndex)) {
        return lastIndex;
      }
    }
    return lastIndex;
  }

  findFirstVisibleColRowIndex(sheetId: SheetId, dimension: Dimension) {
    const numberOfHeaders = this.getters.getNumberHeaders(sheetId, dimension);

    for (let i = 0; i < numberOfHeaders - 1; i++) {
      if (dimension === "COL" && !this.isColHidden(sheetId, i)) {
        return i;
      }
      if (dimension === "ROW" && !this.isRowHidden(sheetId, i)) {
        return i;
      }
    }
    return undefined;
  }
}
