import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from "../constants";
import { /*Dimension,*/ Getters, Position, UID, Zone, ZoneDimension } from "../types";

export class Pane {
  getters: Getters;
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
  boundaries: Zone;
  sheetId: UID;
  viewportWidth: number;
  viewportHeight: number;
  isVisible: boolean;

  constructor(
    getters: Getters,
    sheetId: UID,
    boundaries: Zone,
    sizeInGrid: { viewportWidth: number; viewportHeight: number },
    options: { canScrollVertically: boolean; canScrollHorizontally: boolean },
    offsets: { x: number; y: number },
    // TODO maybe remove
    isVisible: boolean = true
  ) {
    this.getters = getters;
    this.isVisible = isVisible;
    this.sheetId = sheetId;
    this.viewportWidth = sizeInGrid.viewportWidth;
    this.viewportHeight = sizeInGrid.viewportHeight;
    this.boundaries = boundaries;
    this.offsetScrollbarX = offsets.x;
    this.offsetScrollbarY = offsets.y;
    this.canScrollVertically = options.canScrollVertically;
    this.canScrollHorizontally = options.canScrollHorizontally;

    this.adjustViewportOffsetX();
    this.adjustViewportOffsetY();
  }

  // PUBLIC
  /**
   * This function will make sure that the provided cell position (or current selected position) is part of
   * the viewport that is actually displayed on the client. We therefore adjust the offset of the snapped
   * viewport until it contains the cell completely.
   */
  adjustPosition(position?: Position) {
    if (!this.isVisible) {
      return;
    }
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
    const { start, end } = this.getters.getColDimensions(sheetId, col);
    while (end > this.offsetX + this.viewportWidth && this.offsetX < start) {
      this.offsetX = this.getters.getColDimensions(sheetId, this.left).end;
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
      this.offsetX = this.getters.getColDimensions(sheetId, leftCol - 1).start;
      this.offsetScrollbarX = this.offsetX;
      this.adjustViewportZoneX();
    }
    while (
      this.getters.getRowDimensions(sheetId, row).end > this.offsetY + this.viewportHeight &&
      this.offsetY < this.getters.getRowDimensions(sheetId, row).start
    ) {
      this.offsetY = this.getters.getRowDimensions(sheetId, this.top).end;
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
      this.offsetY = this.getters.getRowDimensions(sheetId, topRow - 1).start;
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

  // PRIVATE
  private setViewportOffsetX(offsetX: number) {
    if (!this.isVisible || !this.canScrollHorizontally) {
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
  adjustViewportOffsetX() {
    if (!this.isVisible || !this.canScrollHorizontally) {
      return;
    }
    const { width: paneWidth } = this.getMaxSize();
    if (this.viewportWidth + this.offsetScrollbarX > paneWidth) {
      // TODO: remove this.offsetScrollbarX to reduce code but readability ?
      const diff = this.viewportWidth + this.offsetScrollbarX - paneWidth;
      this.offsetScrollbarX = Math.max(0, this.offsetScrollbarX - diff);
    }
    this.adjustViewportZoneX();
  }

  /** Corrects the pane's vertical offset based on the current structure
   *  To make sure that at least on row is visible inside the pane.
   */
  adjustViewportOffsetY() {
    if (!this.isVisible || !this.canScrollVertically) {
      return;
    }
    const { height: paneHeight } = this.getMaxSize();
    if (this.viewportHeight + this.offsetScrollbarY > paneHeight) {
      const diff = this.viewportHeight + this.offsetScrollbarY - paneHeight;
      this.offsetScrollbarY = Math.max(0, this.offsetScrollbarY - diff);
    }
    this.adjustViewportZoneY();
  }

  /** Updates the pane zone based on its horizontal offset (will find Left) and its width (will find Right) */
  private adjustViewportZoneX() {
    const sheetId = this.sheetId;
    this.left = this.getters.searchHeaderIndex(sheetId, "COL", this.offsetScrollbarX);
    this.right = this.getters.searchHeaderIndex(sheetId, "COL", this.viewportWidth, this.left);
    if (this.right === -1) {
      this.right = this.getters.getNumberCols(sheetId) - 1;
    }
    this.offsetX = this.getters.getColDimensions(sheetId, this.left).start;
  }

  /** Updates the pane zone based on its vertical offset (will find Top) and its width (will find Bottom) */
  private adjustViewportZoneY() {
    const sheetId = this.sheetId;
    this.top = this.getters.searchHeaderIndex(sheetId, "ROW", this.offsetScrollbarY);
    this.bottom = this.getters.searchHeaderIndex(sheetId, "ROW", this.viewportHeight, this.top);
    if (this.bottom === -1) {
      this.bottom = this.getters.getNumberRows(sheetId) - 1;
    }
    this.offsetY = this.getters.getRowDimensions(sheetId, this.top).start;
  }

  // prettier-ignore
  getMaxSize(): ZoneDimension {
    if(!this.isVisible){
      return {width: 0, height: 0};
    }
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
    const leftColIndex = this.getters.searchHeaderIndex(this.sheetId, "COL", lastColEnd - this.viewportWidth, 0);
    const leftColSize = this.getters.getColSize(this.sheetId, leftColIndex);
    const leftRowIndex = this.getters.searchHeaderIndex(
      this.sheetId, "ROW",
      lastRowEnd - this.viewportHeight,
      0
    );
    const topRowSize = this.getters.getRowSize(this.sheetId, leftRowIndex);

    const width = lastColEnd + (this.canScrollHorizontally
        ? Math.max(DEFAULT_CELL_WIDTH, Math.min(leftColSize, this.viewportWidth - lastColSize))
        : 0);
    const height = lastRowEnd + (this.canScrollVertically
        ? Math.max(DEFAULT_CELL_HEIGHT + 5, Math.min(topRowSize, this.viewportHeight - lastRowSize))
        : 0);

    return { width, height };
  }
}
