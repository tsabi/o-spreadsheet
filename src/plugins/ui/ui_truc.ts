import { Dimension, HeaderDimensions, UID } from "../../types";
import { UIPlugin } from "../ui_plugin";

export class TrucPlugin extends UIPlugin {
  static getters = [
    "getSizeBetweenHeaders",
    "getColDimensions",
    "getRowDimensions",
    "getColRowOffset",
  ] as const;

  /**
   * Get the actual size between two headers.
   * The size from A to B is the distance between A.start and B.end
   */
  getSizeBetweenHeaders(dimension: Dimension, from: number, to: number): number {
    const sheetId = this.getters.getActiveSheetId();
    let size = 0;
    for (let i = from; i <= to; i++) {
      if (this.getters.isHeaderHidden(sheetId, dimension, i)) {
        continue;
      }
      size +=
        dimension === "COL"
          ? this.getters.getColSize(sheetId, i)
          : this.getters.getRowSize(sheetId, i);
    }
    return size;
  }

  /**
   * Returns the size, start and end coordinates of a column
   */
  getColDimensions(sheetId: UID, col: number): HeaderDimensions {
    const start = this.getColRowOffset("COL", 0, col, sheetId);
    const size = this.getters.getColSize(sheetId, col);
    const isColHidden = this.getters.isColHidden(sheetId, col);
    return {
      start,
      size,
      end: start + (isColHidden ? 0 : size),
    };
  }

  /**
   * Returns the size, start and end coordinates of a row
   */
  getRowDimensions(sheetId: UID, row: number): HeaderDimensions {
    const start = this.getColRowOffset("ROW", 0, row, sheetId);
    const size = this.getters.getRowSize(sheetId, row);
    const isRowHidden = this.getters.isRowHidden(sheetId, row);
    return {
      start,
      size: size,
      end: start + (isRowHidden ? 0 : size),
    };
  }

  /**
   * Returns the offset of a header (determined by the dimension) at the given index
   * based on the referenceIndex given. If start === 0, this method will return
   * the start attribute of the header.
   */
  getColRowOffset(
    dimension: Dimension,
    referenceIndex: number,
    index: number,
    sheetId: UID = this.getters.getActiveSheetId()
  ): number {
    if (index < referenceIndex) {
      return -this.getColRowOffset(dimension, index, referenceIndex);
    }
    let offset = 0;
    for (let i = referenceIndex; i < index; i++) {
      if (this.getters.isHeaderHidden(sheetId, dimension, i)) {
        continue;
      }
      offset +=
        dimension === "COL"
          ? this.getters.getColSize(sheetId, i)
          : this.getters.getRowSize(sheetId, i);
    }
    return offset;
  }
}
