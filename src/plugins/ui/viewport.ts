import { DEFAULT_VIEWPORT_SIZE, HEADER_HEIGHT, HEADER_WIDTH } from "../../constants";
import { findCellInNewZone, isDefined } from "../../helpers";
import { scrollDelay } from "../../helpers/index";
import { Pane } from "../../helpers/pane";
import { SelectionEvent } from "../../types/event_stream";
import {
  Command,
  CommandResult,
  Dimension,
  EdgeScrollInfo,
  Figure,
  Position,
  Rect,
  ScrollDirection,
  UID,
  Viewport,
  Zone,
  ZoneDimension,
} from "../../types/index";
import { UIPlugin } from "../ui_plugin";

type SheetPanes = {
  topLeft: Pane | undefined;
  bottomLeft: Pane | undefined;
  topRight: Pane | undefined;
  bottomRight: Pane;
};

/**
 * Viewport plugin.
 *
 * This plugin manages all things related to all viewport states.
 *
 */
export class ViewportPlugin extends UIPlugin {
  static getters = [
    "getColIndex",
    "getRowIndex",
    "getActiveViewport",
    "getViewportDimension",
    "getViewportDimensionWithHeaders",
    "getMaxViewportSize",
    "getMaximumViewportOffset",
    "isVisibleInViewport",
    "getEdgeScrollCol",
    "getEdgeScrollRow",
    "searchHeaderIndex",
    "getVisibleFigures",
    "getRect",
  ] as const;

  readonly panes: Record<UID, SheetPanes> = {};

  /**
   * The viewport dimensions are usually set by one of the components
   * (i.e. when grid component is mounted) to properly reflect its state in the DOM.
   * In the absence of a component (standalone model), is it mandatory to set reasonable default values
   * to ensure the correct operation of this plugin.
   */
  private viewportWidth: number = DEFAULT_VIEWPORT_SIZE;
  private viewportHeight: number = DEFAULT_VIEWPORT_SIZE;

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: Command): CommandResult {
    switch (cmd.type) {
      case "SET_VIEWPORT_OFFSET":
        return this.checkOffsetValidity(cmd.offsetX, cmd.offsetY);
      case "RESIZE_VIEWPORT":
        if (cmd.width < 0 || cmd.height < 0) {
          return CommandResult.InvalidViewportSize;
        }
        return CommandResult.Success;
      default:
        return CommandResult.Success;
    }
  }

  private handleEvent(event: SelectionEvent) {
    switch (event.type) {
      case "HeadersSelected":
      case "AlterZoneCorner":
        break;
      case "ZonesSelected":
        // altering a zone should not move the viewport
        const sheetId = this.getters.getActiveSheetId();
        let { col, row } = findCellInNewZone(event.previousAnchor.zone, event.anchor.zone);
        col = Math.min(col, this.getters.getNumberCols(sheetId) - 1);
        row = Math.min(row, this.getters.getNumberRows(sheetId) - 1);
        this.refreshViewport(this.getters.getActiveSheetId(), { col, row });
        break;
    }
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "START":
        this.selection.observe(this, {
          handleEvent: this.handleEvent.bind(this),
        });
        this.generateViewportState(this.getters.getActiveSheetId());
        break;
      case "UNDO":
      case "REDO":
        this.cleanViewports();
        this.resetViewports();
        break;
      case "RESIZE_VIEWPORT":
        this.cleanViewports();
        this.resizeViewport(cmd.height, cmd.width);
        break;
      case "SET_VIEWPORT_OFFSET":
        this.setViewportOffset(cmd.offsetX, cmd.offsetY);
        break;
      case "SHIFT_VIEWPORT_DOWN":
        const { top } = this.getActiveViewport();
        const sheetId = this.getters.getActiveSheetId();
        const shiftedOffsetY = this.clipOffsetY(
          this.getters.getRowDimensions(sheetId, top).start + this.viewportHeight
        );
        this.shiftVertically(shiftedOffsetY);
        break;
      case "SHIFT_VIEWPORT_UP": {
        const { top } = this.getActiveViewport();
        const sheetId = this.getters.getActiveSheetId();
        const shiftedOffsetY = this.clipOffsetY(
          this.getters.getRowDimensions(sheetId, top).end - this.viewportHeight
        );
        this.shiftVertically(shiftedOffsetY);
        break;
      }
      case "REMOVE_COLUMNS_ROWS":
      case "RESIZE_COLUMNS_ROWS":
      case "HIDE_COLUMNS_ROWS":
      case "ADD_COLUMNS_ROWS":
      case "UNHIDE_COLUMNS_ROWS":
        this.resetPanes(cmd.sheetId);
        break;
      case "ACTIVATE_SHEET":
        this.refreshViewport(cmd.sheetIdTo);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Return the index of a column given an offset x, based on the viewport left
   * visible cell.
   * It returns -1 if no column is found.
   */
  getColIndex(x: number): number {
    if (x < 0) {
      return -1;
    }
    const viewport = this.getActiveViewport();
    return this.searchHeaderIndex(this.getters.getActiveSheetId(), "COL", x, viewport.left);
  }

  /**
   * Return the index of a row given an offset y, based on the viewport top
   * visible cell.
   * It returns -1 if no row is found.
   */
  getRowIndex(y: number): number {
    if (y < 0) {
      return -1;
    }
    const viewport = this.getActiveViewport();
    return this.searchHeaderIndex(this.getters.getActiveSheetId(), "ROW", y, viewport.top);
  }

  getViewportDimensionWithHeaders(): ZoneDimension {
    return {
      width: this.viewportWidth + (this.getters.isDashboard() ? 0 : HEADER_WIDTH),
      height: this.viewportHeight + (this.getters.isDashboard() ? 0 : HEADER_HEIGHT),
    };
  }

  getViewportDimension(): ZoneDimension {
    return {
      width: this.viewportWidth,
      height: this.viewportHeight,
    };
  }

  getActiveViewport(): Viewport {
    const sheetId = this.getters.getActiveSheetId();
    return this.getViewport(sheetId);
  }

  /**
   * Return the maximum viewport size. That is the sheet dimension
   * with some bottom and right padding.
   */
  getMaxViewportSize(sheetId: UID): ZoneDimension {
    this.getViewport(sheetId);
    let width: number = this.panes[sheetId].bottomRight!.getMaxSize().width;
    if (this.panes[sheetId].topRight) {
      width += this.panes[sheetId].topRight!.getMaxSize().width;
    }
    let height: number = this.panes[sheetId].bottomRight!.getMaxSize().height;
    if (this.panes[sheetId].bottomLeft) {
      height += this.panes[sheetId].bottomLeft!.getMaxSize().height;
    }
    return { width, height };
  }

  getMaximumViewportOffset(sheetId: UID): { maxOffsetX: number; maxOffsetY: number } {
    const { width, height } = this.getMaxViewportSize(sheetId);
    return {
      maxOffsetX: Math.max(0, width - this.viewportWidth + 1),
      maxOffsetY: Math.max(0, height - this.viewportHeight + 1),
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  getPanes(sheetId: UID): Pane[] {
    return Object.values(this.panes[sheetId]).filter(isDefined);
  }

  searchHeaderIndex(
    sheetId: UID,
    dimension: Dimension,
    position: number,
    startIndex: number = 0
  ): number {
    let size = 0;
    const headers = this.getters.getNumberHeaders(sheetId, dimension);
    for (let i = startIndex; i <= headers - 1; i++) {
      if (this.getters.isHeaderHidden(sheetId, dimension, i)) {
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

  private checkOffsetValidity(offsetX: number, offsetY: number): CommandResult {
    const sheetId = this.getters.getActiveSheetId();
    const { maxOffsetX, maxOffsetY } = this.getMaximumViewportOffset(sheetId);
    if (offsetX < 0 || offsetY < 0 || offsetY > maxOffsetY || offsetX > maxOffsetX) {
      return CommandResult.InvalidOffset;
    }
    return CommandResult.Success;
  }

  private getViewport(sheetId: UID) {
    if (!this.panes[sheetId]) {
      this.generateViewportState(sheetId);
    }
    const a = this.panes[sheetId].bottomRight;
    const result = {};

    [
      "top",
      "left",
      "bottom",
      "right",
      "offsetX",
      "offsetY",
      "offsetScrollbarX",
      "offsetScrollbarY",
    ].forEach((key) => (result[key] = a[key]));

    return result as Viewport;
  }

  /** gets rid of deprecated sheetIds */
  private cleanViewports() {
    const sheets = this.getters.getSheetIds();
    for (let sheetId of Object.keys(this.panes)) {
      if (!sheets.includes(sheetId)) {
        delete this.panes[sheetId];
      }
    }
  }

  private resetViewports() {
    for (let [sheetId, panes] of Object.entries(this.panes)) {
      const position = this.getters.getSheetPosition(sheetId);
      this.resetPanes(sheetId);
      Object.values(panes)
        .filter(isDefined)
        .forEach((pane) => {
          pane.adjustPosition(position);
        });
    }
  }

  private resizeViewport(height: number, width: number) {
    this.viewportHeight = height;
    this.viewportWidth = width;
    this.recomputeViewports();
  }

  private recomputeViewports() {
    for (let sheetId of Object.keys(this.panes)) {
      this.resetPanes(sheetId);
    }
  }

  private setViewportOffset(offsetX: number, offsetY: number) {
    const sheetId = this.getters.getActiveSheetId();
    this.getViewport(sheetId);

    Object.values(this.getPanes(sheetId)).forEach((pane) =>
      pane.setViewportOffset(offsetX, offsetY)
    );
  }

  /**
   * Clip the vertical offset within the allowed range.
   * Not above the sheet, nor below the sheet.
   */
  private clipOffsetY(offsetY: number): number {
    const { height } = this.getters.getMaxViewportSize(this.getters.getActiveSheetId());
    const maxOffset = height - this.viewportHeight;
    offsetY = Math.min(offsetY, maxOffset);
    offsetY = Math.max(offsetY, 0);
    return offsetY;
  }

  // This is a copy from a function in renderer.ts. Maybe everything should moved here...
  private getColRowOffset(
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

  private generateViewportState(sheetId: UID) {
    this.resetPanes(sheetId);
  }

  private getPaneOffset(sheetId: UID, key: string) {
    return {
      x: this.panes[sheetId]?.[key]?.offsetScrollbarX || 0,
      y: this.panes[sheetId]?.[key]?.offsetScrollbarY || 0,
    };
  }

  private resetPanes(sheetId: UID) {
    const { vertical, horizontal } = this.getters.getPaneDivisions(sheetId);
    const nCols = this.getters.getNumberCols(sheetId);
    const nRows = this.getters.getNumberRows(sheetId);
    const colOffset = this.getColRowOffset("COL", 0, horizontal, sheetId);
    const rowOffset = this.getColRowOffset("ROW", 0, vertical, sheetId);
    this.panes[sheetId] = {
      topLeft:
        (vertical &&
          horizontal &&
          new Pane(
            this.getters,
            sheetId,
            { left: 0, right: horizontal - 1, top: 0, bottom: vertical - 1 },
            { viewportWidth: colOffset, viewportHeight: rowOffset },
            { canScrollVertically: false, canScrollHorizontally: false },
            this.getPaneOffset(sheetId, "topLeft")
          )) ||
        undefined,
      topRight:
        (vertical &&
          new Pane(
            this.getters,
            sheetId,
            { left: horizontal, right: nCols - 1, top: 0, bottom: vertical - 1 },
            { viewportWidth: this.viewportWidth - colOffset, viewportHeight: rowOffset },
            { canScrollVertically: false, canScrollHorizontally: true },
            this.getPaneOffset(sheetId, "topRight")
          )) ||
        undefined,
      bottomLeft:
        (horizontal &&
          new Pane(
            this.getters,
            sheetId,
            { left: 0, right: horizontal - 1, top: vertical, bottom: nRows - 1 },
            { viewportWidth: colOffset, viewportHeight: this.viewportHeight - rowOffset },
            { canScrollVertically: true, canScrollHorizontally: false },
            this.getPaneOffset(sheetId, "bottomLeft")
          )) ||
        undefined,
      bottomRight: new Pane(
        this.getters,
        sheetId,
        { left: horizontal, right: nCols - 1, top: vertical, bottom: nRows - 1 },
        {
          viewportWidth: this.viewportWidth - colOffset,
          viewportHeight: this.viewportHeight - rowOffset,
        },
        { canScrollVertically: true, canScrollHorizontally: true },
        this.getPaneOffset(sheetId, "bottomRight")
      ),
    };
  }

  /**
   * Adjust the viewport such that the anchor position is visible
   */
  private refreshViewport(sheetId: UID, anchorPosition?: Position) {
    this.getViewport(sheetId);

    Object.values(this.getPanes(sheetId)) // this.getViewport(sheetId)
      .forEach((pane) => {
        pane.adjustViewportZone();
        pane.adjustPosition(anchorPosition);
      });
  }

  /**
   * Shift the viewport vertically and move the selection anchor
   * such that it remains at the same place relative to the
   * viewport top.
   */
  private shiftVertically(offset: number) {
    const { top, offsetX } = this.getActiveViewport();
    this.setViewportOffset(offsetX, offset);
    const { anchor } = this.getters.getSelection();
    const deltaRow = this.getActiveViewport().top - top;
    this.selection.selectCell(anchor.cell.col, anchor.cell.row + deltaRow);
  }

  /**
   * Check if a given position is visible in the viewport.
   */
  isVisibleInViewport(col: number, row: number, viewport: Viewport): boolean {
    const { right, left, top, bottom } = viewport;
    return row <= bottom && row >= top && col >= left && col <= right;
  }

  getEdgeScrollCol(x: number): EdgeScrollInfo {
    let canEdgeScroll = false;
    let direction: ScrollDirection = 0;
    let delay = 0;
    const { width } = this.getViewportDimension();
    const { width: gridWidth } = this.getMaxViewportSize(this.getters.getActiveSheet().id);
    const { left, offsetX } = this.getActiveViewport();
    if (x < 0 && left > 0) {
      canEdgeScroll = true;
      direction = -1;
      delay = scrollDelay(-x);
    } else if (x > width && offsetX < gridWidth - width) {
      canEdgeScroll = true;
      direction = +1;
      delay = scrollDelay(x - width);
    }
    return { canEdgeScroll, direction, delay };
  }

  getEdgeScrollRow(y: number): EdgeScrollInfo {
    let canEdgeScroll = false;
    let direction: ScrollDirection = 0;
    let delay = 0;
    const { height } = this.getViewportDimension();
    const { height: gridHeight } = this.getMaxViewportSize(this.getters.getActiveSheet().id);
    const { top, offsetY } = this.getActiveViewport();
    if (y < 0 && top > 0) {
      canEdgeScroll = true;
      direction = -1;
      delay = scrollDelay(-y);
    } else if (y > height && offsetY < gridHeight - height) {
      canEdgeScroll = true;
      direction = +1;
      delay = scrollDelay(y - height);
    }
    return { canEdgeScroll, direction, delay };
  }

  getVisibleFigures(): Figure[] {
    const sheetId = this.getters.getActiveSheetId();
    const result: Figure[] = [];
    const figures = this.getters.getFigures(sheetId);
    const { offsetX, offsetY } = this.getters.getActiveViewport();
    const { width, height } = this.getters.getViewportDimensionWithHeaders();
    for (let figure of figures) {
      if (figure.x >= offsetX + width || figure.x + figure.width <= offsetX) {
        continue;
      }
      if (figure.y >= offsetY + height || figure.y + figure.height <= offsetY) {
        continue;
      }
      result.push(figure);
    }
    return result;
  }

  /**
   * Get the offset of a header (see getColRowOffset), adjusted with the header
   * size (HEADER_HEIGHT and HEADER_WIDTH)
   */
  /*private getHeaderOffset(dimension: Dimension, start: number, index: number): number {
    let size = this.getColRowOffset(dimension, start, index);
    if (!this.getters.isDashboard()) {
      size += dimension === "ROW" ? HEADER_HEIGHT : HEADER_WIDTH;
    }
    return size;
  }*/

  /**
   * Get the actual size between two headers.
   * The size from A to B is the distance between A.start and B.end
   */
  /*private getSizeBetweenHeaders(dimension: Dimension, from: number, to: number): number {
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
  }*/

  /**
   * Computes the coordinates and size to draw the zone on the canvas
   */
  getRect(zone: Zone): Rect {
    //const { left, top } = this.getActiveViewport();
    //const x = this.getHeaderOffset("COL", left, zone.left);
    //const width = this.getSizeBetweenHeaders("COL", zone.left, zone.right);
    //const y = this.getHeaderOffset("ROW", top, zone.top);
    //const height = this.getSizeBetweenHeaders("ROW", zone.top, zone.bottom);
    //return [x, y, width, height];

    const sheetId = this.getters.getActiveSheetId();
    const paneRects = this.getPanes(sheetId)
      .map((pane) => pane.getRect(zone))
      .filter(isDefined);

    const x = Math.min(...paneRects.map((rect) => rect.x));
    const y = Math.min(...paneRects.map((rect) => rect.y));
    const width = Math.max(...paneRects.map((rect) => rect.x + rect.width)) - x;
    const height = Math.max(...paneRects.map((rect) => rect.y + rect.height)) - y;
    return { x, y, width, height };
  }
}
