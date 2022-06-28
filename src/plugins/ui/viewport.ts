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
    "getVisibleFigures",
    "getRect",
    "getFullViewport",
    "getColRowOffsetInViewPort",
    "getViewportOffsetInfo",
    "getViewportOffsetCorrection",
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
      case "FREEZE_ROW": {
        const zone = this.getters.getSelectedZone();
        this.getters.getActiveSheet().panes.vertical =
          cmd.row !== undefined ? cmd.row : zone.top + 1;
        this.resetPanes(this.getters.getActiveSheetId());
        break;
      }
      case "FREEZE_COL": {
        const zone = this.getters.getSelectedZone();
        (this.getters.getActiveSheet().panes.horizontal =
          cmd.col !== undefined ? cmd.col : zone.left + 1),
          this.resetPanes(this.getters.getActiveSheetId());
        break;
      }
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
    const sheetId = this.getters.getActiveSheetId();
    return Math.max(...this.getPanes(sheetId).map((pane) => pane.getColIndex(x)));
  }

  /**
   * Return the index of a row given an offset y, based on the viewport top
   * visible cell.
   * It returns -1 if no row is found.
   */
  getRowIndex(y: number): number {
    const sheetId = this.getters.getActiveSheetId();
    return Math.max(...this.getPanes(sheetId).map((pane) => pane.getRowIndex(y)));
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

  getFullViewport(): Zone {
    const sheetId = this.getters.getActiveSheetId();
    return {
      left: Math.min(...this.getPanes(sheetId).map((pane) => pane.left)),
      right: Math.max(...this.getPanes(sheetId).map((pane) => pane.right)),
      top: Math.min(...this.getPanes(sheetId).map((pane) => pane.top)),
      bottom: Math.max(...this.getPanes(sheetId).map((pane) => pane.bottom)),
    };
  }

  /**
   * Return the maximum viewport size. That is the sheet dimension
   * with some bottom and right padding.
   */
  getMaxViewportSize(sheetId: UID) {
    this.getViewport(sheetId);
    const { vertical, horizontal } = this.getters.getPaneDivisions(sheetId);
    let width: number = this.panes[sheetId].bottomRight.getMaxSize().width;
    let height: number = this.panes[sheetId].bottomRight.getMaxSize().height;
    const startX = this.getters.getColDimensions(sheetId, horizontal).start;
    const startY = this.getters.getRowDimensions(sheetId, vertical).start;
    return { startX, startY, width, height };
  }

  getMaximumViewportOffset(sheetId: UID): { maxOffsetX: number; maxOffsetY: number } {
    const { width, height } = this.getMaxViewportSize(sheetId);
    this.getPanes(sheetId);
    return {
      maxOffsetX: Math.max(0, width - this.panes[sheetId].bottomRight.viewportWidth + 1),
      maxOffsetY: Math.max(0, height - this.panes[sheetId].bottomRight.viewportHeight + 1),
    };
  }

  // This is a copy from a function in renderer.ts. Maybe everything should moved here...
  getColRowOffsetInViewPort(dimension: Dimension, referenceIndex: number, index: number): number {
    const sheetId = this.getters.getActiveSheetId();
    const { top, left } = this.getFullViewport();
    if (index < referenceIndex) {
      return -this.getColRowOffsetInViewPort(dimension, index, referenceIndex);
    }
    let offset = 0;
    for (let i = referenceIndex; i < index; i++) {
      const visibleInViewport =
        dimension == "COL"
          ? this.isVisibleInViewport(sheetId, i, top)
          : this.isVisibleInViewport(sheetId, left, i);
      if (this.getters.isHeaderHidden(sheetId, dimension, i) || !visibleInViewport) {
        continue;
      }
      offset +=
        dimension === "COL"
          ? this.getters.getColSize(sheetId, i)
          : this.getters.getRowSize(sheetId, i);
    }
    return offset;
  }

  /**
   * Check if a given position is visible in the viewport.
   */
  isVisibleInViewport(sheetId: UID, col: number, row: number): boolean {
    return this.getPanes(sheetId).some((pane) => pane.isVisible(col, row));
  }

  // => return s the new offset
  getEdgeScrollCol(x: number, previousX: number, startingX: number): EdgeScrollInfo {
    let canEdgeScroll = false;
    let direction: ScrollDirection = 0;
    let delay = 0;
    /** 4 cas : voir photo
     * 1. previous in XRight, > XLeft
     * 3. previous in XRIght > outside
     * 5. previous in Left > outside
     * A. previous in Left > right
     */
    const { horizontal } = this.getters.getPaneDivisions(this.getters.getActiveSheetId());
    const { width } = this.getViewportDimension();
    const { offsetCorrectionX } = this.getViewportOffsetCorrection();
    const currentOffsetX = this.getViewportOffsetInfo().offsetX;

    if (x > width) {
      // 3 & 5
      canEdgeScroll = true;
      delay = scrollDelay(x - width);
      direction = 1;
    } else if (x < offsetCorrectionX && startingX >= offsetCorrectionX && currentOffsetX > 0) {
      // 1
      canEdgeScroll = true;
      delay = scrollDelay(offsetCorrectionX - x);
      direction = -1;
    } else if (horizontal && previousX < offsetCorrectionX && x > offsetCorrectionX) {
      // A
      canEdgeScroll = true;
      delay = scrollDelay(x);
      direction = "reset";
    }
    return { canEdgeScroll, direction, delay };
  }

  getEdgeScrollRow(y: number, previousY: number, tartingY: number): EdgeScrollInfo {
    let canEdgeScroll = false;
    let direction: ScrollDirection = 0;
    let delay = 0;
    /** 4 cas : voir photo
     * 2. previous in XRight, > XLeft
     * 4. previous in XRIght > outside
     * 6. previous in Left > outside
     * B. previous in Left > right
     */
    const { vertical } = this.getters.getPaneDivisions(this.getters.getActiveSheetId());

    const { height } = this.getViewportDimension();
    const { offsetCorrectionY } = this.getViewportOffsetCorrection();
    const currentOffsetY = this.getViewportOffsetInfo().offsetY;

    if (y > height) {
      // 3 & 5
      canEdgeScroll = true;
      delay = scrollDelay(y - height);
      direction = 1;
    } else if (y < offsetCorrectionY && tartingY >= offsetCorrectionY && currentOffsetY > 0) {
      // 1
      canEdgeScroll = true;
      delay = scrollDelay(offsetCorrectionY - y);
      direction = -1;
    } else if (vertical && previousY < offsetCorrectionY && y > offsetCorrectionY) {
      // B
      canEdgeScroll = true;
      delay = scrollDelay(y);
      direction = "reset";
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
   * Computes the coordinates and size to draw the zone on the canvas
   */
  getRect(zone: Zone): Rect {
    const sheetId = this.getters.getActiveSheetId();
    const paneRects = this.getPanes(sheetId)
      .map((pane) => pane.getRect(zone))
      .filter(isDefined);

    if (paneRects.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const x = Math.min(...paneRects.map((rect) => rect.x));
    const y = Math.min(...paneRects.map((rect) => rect.y));
    const width = Math.max(...paneRects.map((rect) => rect.x + rect.width)) - x;
    const height = Math.max(...paneRects.map((rect) => rect.y + rect.height)) - y;
    return {
      x: this.getters.isDashboard() ? x : x + HEADER_WIDTH,
      y: this.getters.isDashboard() ? y : y + HEADER_HEIGHT,
      width,
      height,
    };
  }

  getViewportOffsetInfo() {
    const sheetId = this.getters.getActiveSheetId();
    this.getPanes(sheetId);
    const pane = this.panes[sheetId].bottomRight;
    return {
      offsetScrollbarX: pane.offsetScrollbarX,
      offsetScrollbarY: pane.offsetScrollbarY,
      offsetX: pane.offsetX,
      offsetY: pane.offsetY,
    };
  }

  getViewportOffsetCorrection() {
    const sheetId = this.getters.getActiveSheetId();
    const { horizontal, vertical } = this.getters.getPaneDivisions(sheetId);
    const offsetCorrectionX = this.getters.getColDimensions(sheetId, horizontal).start;
    const offsetCorrectionY = this.getters.getRowDimensions(sheetId, vertical).start;
    return { offsetCorrectionX, offsetCorrectionY };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getPanes(sheetId: UID): Pane[] {
    if (!this.panes[sheetId]?.bottomRight) {
      this.resetPanes(sheetId);
    }
    return Object.values(this.panes[sheetId]).filter(isDefined);
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
    const colOffset = this.getters.getColRowOffset("COL", 0, horizontal, sheetId);
    const rowOffset = this.getters.getColRowOffset("ROW", 0, vertical, sheetId);
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

    Object.values(this.getPanes(sheetId)).forEach((pane) => {
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
}
