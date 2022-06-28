import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from "../constants";
import {
  /*Dimension,*/ Dimension,
  Getters,
  Position,
  Rect,
  UID,
  Zone,
  ZoneDimension,
} from "../types";
import { intersection, isInside } from "./zones";

export class Pane {
  top!: number;
  bottom!: number;
  left!: number;
  right!: number;
  offsetX!: number;
  offsetY!: number;
  offsetScrollbarX: number;
  offsetScrollbarY: number;
  canScrollVertically: boolean;
  canScrollHorizontally: boolean;
  viewportWidth: number;
  viewportHeight: number;
  offsetCorrectionX: number;
  offsetCorrectionY: number;

  constructor(
    private getters: Getters,
    private sheetId: UID,
    private boundaries: Zone,
    sizeInGrid: { viewportWidth: number; viewportHeight: number },
    options: { canScrollVertically: boolean; canScrollHorizontally: boolean },
    offsets: { x: number; y: number }
  ) {
    this.viewportWidth = sizeInGrid.viewportWidth;
    this.viewportHeight = sizeInGrid.viewportHeight;
    this.offsetScrollbarX = offsets.x;
    this.offsetScrollbarY = offsets.y;
    this.canScrollVertically = options.canScrollVertically;
    this.canScrollHorizontally = options.canScrollHorizontally;

    this.offsetCorrectionX = this.getters.getColDimensions(
      this.sheetId,
      this.boundaries.left
    ).start;
    this.offsetCorrectionY = this.getters.getRowDimensions(this.sheetId, this.boundaries.top).start;

    this.adjustViewportOffsetX();
    this.adjustViewportOffsetY();
  }

  // PUBLIC

  /**
   * Return the index of a column given an offset x, based on the pane left
   * visible cell.
   * It returns -1 if no column is found.
   */
  getColIndex(x: number, absolute = false): number {
    if (x < this.offsetCorrectionX || x > this.offsetCorrectionX + this.viewportWidth) {
      return -1;
    }
    return this.searchHeaderIndex("COL", x - this.offsetCorrectionX, this.left, absolute);
  }

  /**
   * Return the index of a row given an offset y, based on the pane top
   * visible cell.
   * It returns -1 if no row is found.
   */
  getRowIndex(y: number, absolute = false): number {
    if (y < this.offsetCorrectionY || y > this.offsetCorrectionY + this.viewportHeight) {
      return -1;
    }
    return this.searchHeaderIndex("ROW", y - this.offsetCorrectionY, this.top, absolute);
  }

  /**
   * This function will make sure that the provided cell position (or current selected position) is part of
   * the viewport that is actually displayed on the client. We therefore adjust the offset of the snapped
   * viewport until it contains the cell completely.
   */
  adjustPosition(position?: Position) {
    const sheetId = this.sheetId;
    if (!position) {
      position = this.getters.getSheetPosition(sheetId);
    }
    const mainCellPosition = this.getters.getMainCellPosition(sheetId, position.col, position.row);

    const { col, row } = this.getters.getNextVisibleCellPosition(
      sheetId,
      mainCellPosition.col,
      mainCellPosition.row
    );
    if (!isInside(col, row, this.boundaries)) {
      return;
    }
    const { start, end } = this.getters.getColDimensions(sheetId, col);
    while (
      end > this.offsetX + this.offsetCorrectionX + this.viewportWidth &&
      this.offsetX + this.offsetCorrectionX < start
    ) {
      this.offsetX = this.getters.getColDimensions(sheetId, this.left).end - this.offsetCorrectionX;
      this.offsetScrollbarX = this.offsetX;
      this.adjustViewportZoneX();
    }
    while (col < this.left) {
      let leftCol: number;
      for (leftCol = this.left; leftCol >= 0; leftCol--) {
        if (!this.getters.isColHidden(sheetId, leftCol)) {
          break;
        }
      }
      this.offsetX =
        this.getters.getColDimensions(sheetId, leftCol - 1).start - this.offsetCorrectionX;
      this.offsetScrollbarX = this.offsetX;
      this.adjustViewportZoneX();
    }
    while (
      this.getters.getRowDimensions(sheetId, row).end >
        this.offsetY + this.viewportHeight + this.offsetCorrectionY &&
      this.offsetY + this.offsetCorrectionY < this.getters.getRowDimensions(sheetId, row).start
    ) {
      this.offsetY = this.getters.getRowDimensions(sheetId, this.top).end - this.offsetCorrectionY;
      this.offsetScrollbarY = this.offsetY;
      this.adjustViewportZoneY();
    }
    while (row < this.top) {
      let topRow: number;
      for (topRow = this.top; topRow >= 0; topRow--) {
        if (!this.getters.isRowHidden(sheetId, topRow)) {
          break;
        }
      }
      this.offsetY =
        this.getters.getRowDimensions(sheetId, topRow - 1).start - this.offsetCorrectionY;
      this.offsetScrollbarY = this.offsetY;
      this.adjustViewportZoneY();
    }
  }

  setViewportOffset(offsetX: number, offsetY: number) {
    this.setViewportOffsetX(offsetX);
    this.setViewportOffsetY(offsetY);
  }

  adjustViewportZone() {
    this.adjustViewportZoneX();
    this.adjustViewportZoneY();
  }

  getRect(zone: Zone): Rect | undefined {
    const targetZone = intersection(zone, this.zone);
    if (targetZone) {
      return {
        x:
          this.getters.getSizeBetweenHeaders("COL", this.zone.left, targetZone.left - 1) +
          this.offsetCorrectionX,
        y:
          this.getters.getSizeBetweenHeaders("ROW", this.zone.top, targetZone.top - 1) +
          this.offsetCorrectionY,
        width: this.getters.getSizeBetweenHeaders("COL", targetZone.left, targetZone.right),
        height: this.getters.getSizeBetweenHeaders("ROW", targetZone.top, targetZone.bottom),
      };
    } else {
      return undefined;
    }
  }

  isVisible(col: number, row: number) {
    return row <= this.bottom && row >= this.top && col >= this.left && col <= this.right;
  }

  // PRIVATE
  private searchHeaderIndex(
    dimension: Dimension,
    position: number,
    startIndex: number = 0,
    absolute = false
  ): number {
    let size = 0;
    const sheetId = this.sheetId;
    const headers = this.getters.getNumberHeaders(sheetId, dimension);
    for (let i = startIndex; i <= headers - 1; i++) {
      const isHiddenInPane =
        !absolute && dimension === "COL"
          ? i < this.left && i > this.right
          : i < this.top && i > this.bottom;
      if (this.getters.isHeaderHidden(sheetId, dimension, i) || isHiddenInPane) {
        continue;
      }
      size +=
        dimension === "COL"
          ? this.getters.getColSize(sheetId, i)
          : this.getters.getRowSize(sheetId, i);
      if (size > position) {
        return i;
      }
    }
    return -1;
  }

  get zone() {
    return { left: this.left, right: this.right, top: this.top, bottom: this.bottom };
  }
  private setViewportOffsetX(offsetX: number) {
    if (!this.canScrollHorizontally) {
      return;
    }
    this.offsetScrollbarX = offsetX;
    this.adjustViewportZoneX();
  }
  private setViewportOffsetY(offsetY: number) {
    if (!this.canScrollVertically) {
      return;
    }
    this.offsetScrollbarY = offsetY;
    this.adjustViewportZoneY();
  }

  /** Corrects the pane's horizontal offset based on the current structure
   *  To make sure that at least on column is visible inside the pane.
   */
  private adjustViewportOffsetX() {
    if (this.canScrollHorizontally) {
      const { width: paneWidth } = this.getMaxSize();
      if (this.viewportWidth + this.offsetScrollbarX > paneWidth) {
        // TODO: remove this.offsetScrollbarX to reduce code but readability ?
        const diff = this.viewportWidth + this.offsetScrollbarX - paneWidth;
        this.offsetScrollbarX = Math.max(0, this.offsetScrollbarX - diff);
      }
    }
    this.left = this.getColIndex(this.offsetScrollbarX, true);
    this.right = this.getColIndex(this.offsetScrollbarX + this.viewportWidth, true);
    if (this.right === -1) this.right = this.boundaries.right;
    this.adjustViewportZoneX();
  }

  /** Corrects the pane's vertical offset based on the current structure
   *  To make sure that at least on row is visible inside the pane.
   */
  private adjustViewportOffsetY() {
    if (this.canScrollVertically) {
      const { height: paneHeight } = this.getMaxSize();
      if (this.viewportHeight + this.offsetScrollbarY > paneHeight) {
        // TODO: remove this.offsetScrollbarY to reduce code but readability ?
        const diff = this.viewportHeight + this.offsetScrollbarY - paneHeight;
        this.offsetScrollbarY = Math.max(0, this.offsetScrollbarY - diff);
      }
    }
    this.top = this.getRowIndex(this.offsetScrollbarY, true);
    this.bottom = this.getRowIndex(this.offsetScrollbarY + this.viewportWidth, true);
    if (this.bottom === -1) this.bottom = this.boundaries.bottom;
    this.adjustViewportZoneY();
  }

  /** Updates the pane zone based on its horizontal offset (will find Left) and its width (will find Right) */
  private adjustViewportZoneX() {
    const sheetId = this.sheetId;
    this.left = this.searchHeaderIndex("COL", this.offsetScrollbarX, this.boundaries.left);
    this.right = Math.min(
      this.boundaries.right,
      this.searchHeaderIndex("COL", this.viewportWidth, this.left)
    );
    if (this.right === -1) {
      this.right = this.getters.getNumberCols(sheetId) - 1;
    }
    this.offsetX =
      this.getters.getColDimensions(sheetId, this.left).start -
      this.getters.getColDimensions(sheetId, this.boundaries.left).start;
  }

  /** Updates the pane zone based on its vertical offset (will find Top) and its width (will find Bottom) */
  private adjustViewportZoneY() {
    const sheetId = this.sheetId;
    this.top = this.searchHeaderIndex("ROW", this.offsetScrollbarY, this.boundaries.top);
    this.bottom = Math.min(
      this.boundaries.bottom,
      this.searchHeaderIndex("ROW", this.viewportHeight, this.top)
    );
    if (this.bottom === -1) {
      this.bottom = this.getters.getNumberRows(sheetId) - 1;
    }
    this.offsetY =
      this.getters.getRowDimensions(sheetId, this.top).start -
      this.getters.getRowDimensions(sheetId, this.boundaries.top).start;
  }

  // prettier-ignore
  getMaxSize(): ZoneDimension {
    const lastCol = this.getters.findLastVisibleColRowIndex(
      this.sheetId, "COL",
      {
        first: this.boundaries.left,
        last: this.boundaries.right
      }
    );
    const lastRow = this.getters.findLastVisibleColRowIndex(
      this.sheetId, "ROW",
      {
        first: this.boundaries.top,
        last: this.boundaries.bottom
      }
    );
    const { end: lastColEnd, size: lastColSize } = this.getters.getColDimensions(this.sheetId, lastCol);
    const { end: lastRowEnd, size: lastRowSize } = this.getters.getRowDimensions(this.sheetId, lastRow);
    const leftColIndex = this.searchHeaderIndex("COL", lastColEnd - this.viewportWidth, 0);
    const leftColSize = this.getters.getColSize(this.sheetId, leftColIndex);
    const leftRowIndex = this.searchHeaderIndex(
      "ROW",
      lastRowEnd - this.viewportHeight,
      0
    );
    const topRowSize = this.getters.getRowSize(this.sheetId, leftRowIndex);

    const width = lastColEnd  - this.offsetCorrectionX + (this.canScrollHorizontally
        ? Math.max(DEFAULT_CELL_WIDTH, Math.min(leftColSize, this.viewportWidth - lastColSize))
        : 0);
    const height = lastRowEnd  - this.offsetCorrectionY + (this.canScrollVertically
        ? Math.max(DEFAULT_CELL_HEIGHT + 5, Math.min(topRowSize, this.viewportHeight - lastRowSize))
        : 0);

    return { width, height };
  }
}
