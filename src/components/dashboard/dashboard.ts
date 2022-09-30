import { Component, useExternalListener, useRef, useState } from "@odoo/owl";
import { BACKGROUND_GRAY_COLOR, DEFAULT_CELL_HEIGHT, SCROLLBAR_WIDTH } from "../../constants";
import { isInside } from "../../helpers/index";
import { dashboardMenuRegistry } from "../../registries/menus/dashboard_menu_registry";
import {
  DOMCoordinates,
  DOMDimension,
  HeaderIndex,
  Position,
  Ref,
  SpreadsheetChildEnv,
} from "../../types/index";
import { GridCanvas } from "../grid_canvas/grid_canvas";
import { GridOverlay } from "../grid_overlay/grid_overlay";
import { GridPopover } from "../grid_popover/grid_popover";
import { css } from "../helpers/css";
import { useAbsolutePosition } from "../helpers/position_hook";
import { Menu, MenuState } from "../menu/menu";
import { Popover } from "../popover/popover";
import { HorizontalScrollBar, VerticalScrollBar } from "../scrollbar/";

// -----------------------------------------------------------------------------
// STYLE
// -----------------------------------------------------------------------------
css/* scss */ `
  .o-grid {
    position: relative;
    overflow: hidden;
    background-color: ${BACKGROUND_GRAY_COLOR};
    &:focus {
      outline: none;
    }

    > canvas {
      border-top: 1px solid #e2e3e3;
      border-bottom: 1px solid #e2e3e3;
    }
    .o-scrollbar {
      position: absolute;
      overflow: auto;

      &.corner {
        right: 0px;
        bottom: 0px;
        height: ${SCROLLBAR_WIDTH}px;
        width: ${SCROLLBAR_WIDTH}px;
        border-top: 1px solid #e2e3e3;
        border-left: 1px solid #e2e3e3;
      }
    }

    .o-grid-overlay {
      position: absolute;
      outline: none;
    }
  }
`;

interface Props {}

export class SpreadsheetDashboard extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-SpreadsheetDashboard";
  static components = {
    GridCanvas,
    GridOverlay,
    GridPopover,
    Menu,
    Popover,
    VerticalScrollBar,
    HorizontalScrollBar,
  };

  private menuState!: MenuState;
  private gridRef!: Ref<HTMLElement>;

  canvasPosition!: DOMCoordinates;
  hoveredCell!: Partial<Position>;

  setup() {
    this.menuState = useState({
      isOpen: false,
      position: null,
      menuItems: [],
    });
    this.gridRef = useRef("grid");
    this.canvasPosition = useAbsolutePosition(this.gridRef);
    this.hoveredCell = useState({ col: undefined, row: undefined });

    useExternalListener(document.body, "copy", this.copy.bind(this));
  }

  onCellHovered({ col, row }) {
    this.hoveredCell.col = col;
    this.hoveredCell.row = row;
  }

  get gridOverlayDimensions() {
    return `
      top: 0px;
      left: 0px;
      height: calc(100% - ${SCROLLBAR_WIDTH}px);
      width: calc(100% - ${SCROLLBAR_WIDTH}px);
    `;
  }

  onClosePopover() {
    this.closeOpenedPopover();
  }

  get gridEl(): HTMLElement {
    if (!this.gridRef.el) {
      throw new Error("Grid el is not defined.");
    }
    return this.gridRef.el;
  }

  onGridResized({ height, width }: DOMDimension) {
    const { height: viewportHeight, width: viewportWidth } =
      this.env.model.getters.getSheetViewDimensionWithHeaders();
    //TODO I think that getSheetViewDimension should work
    if (height != viewportHeight || width !== viewportWidth) {
      this.env.model.dispatch("RESIZE_SHEETVIEW", {
        width: width,
        height: height,
        gridOffsetX: 0,
        gridOffsetY: 0,
      });
    }
  }

  private moveCanvas(deltaX, deltaY) {
    const { offsetScrollbarX, offsetScrollbarY } =
      this.env.model.getters.getActiveSheetScrollInfo();
    this.env.model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: Math.max(offsetScrollbarX + deltaX, 0),
      offsetY: Math.max(offsetScrollbarY + deltaY, 0),
    });
  }

  onMouseWheel(ev: WheelEvent) {
    if (ev.ctrlKey) {
      return;
    }
    function normalize(val: number): number {
      return val * (ev.deltaMode === 0 ? 1 : DEFAULT_CELL_HEIGHT);
    }

    const deltaX = ev.shiftKey ? ev.deltaY : ev.deltaX;
    const deltaY = ev.shiftKey ? ev.deltaX : ev.deltaY;
    this.hoveredCell.col = undefined;
    this.hoveredCell.row = undefined;
    this.moveCanvas(normalize(deltaX), normalize(deltaY));
  }

  isCellHovered(col: HeaderIndex, row: HeaderIndex): boolean {
    return this.hoveredCell.col === col && this.hoveredCell.row === row;
  }

  // ---------------------------------------------------------------------------
  // Zone selection with mouse
  // ---------------------------------------------------------------------------

  onCellClicked(col: HeaderIndex, row: HeaderIndex) {
    this.env.model.selection.selectCell(col, row);
  }

  closeOpenedPopover() {
    this.env.model.dispatch("CLOSE_CELL_POPOVER");
  }

  // ---------------------------------------------------------------------------
  // Context Menu
  // ---------------------------------------------------------------------------

  onCellRightClicked(col: HeaderIndex, row: HeaderIndex, { x, y }: DOMCoordinates) {
    const zones = this.env.model.getters.getSelectedZones();
    const lastZone = zones[zones.length - 1];
    if (!isInside(col, row, lastZone)) {
      this.env.model.selection.selectCell(col, row);
    }
    this.closeOpenedPopover();
    this.menuState.isOpen = true;
    this.menuState.position = { x, y };
    this.menuState.menuItems = dashboardMenuRegistry
      .getAll()
      .filter((item) => !item.isVisible || item.isVisible(this.env));
  }

  copy(ev: ClipboardEvent) {
    if (!this.gridEl.contains(document.activeElement)) {
      return;
    }
    this.env.model.dispatch("COPY");
    const content = this.env.model.getters.getClipboardContent();
    ev.clipboardData!.setData("text/plain", content);
    ev.preventDefault();
  }

  closeMenu() {
    this.menuState.isOpen = false;
  }
}
