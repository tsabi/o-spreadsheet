import {
  Component,
  onMounted,
  onPatched,
  onWillUnmount,
  useExternalListener,
  useRef,
  useState,
} from "@odoo/owl";
import {
  BACKGROUND_GRAY_COLOR,
  CANVAS_SHIFT,
  DEFAULT_CELL_HEIGHT,
  SCROLLBAR_WIDTH,
} from "../../constants";
import { isInside } from "../../helpers/index";
import { dashboardMenuRegistry } from "../../registries/menus/dashboard_menu_registry";
import {
  DOMCoordinates,
  DOMDimension,
  HeaderIndex,
  Pixel,
  Position,
  Ref,
  SpreadsheetChildEnv,
} from "../../types/index";
import { GridOverlay } from "../grid_overlay/grid_overlay";
import { GridPopover } from "../grid_popover/grid_popover";
import { css } from "../helpers/css";
import { useAbsolutePosition } from "../helpers/position_hook";
import { Menu, MenuState } from "../menu/menu";
import { Popover } from "../popover/popover";
import { HorizontalScrollBar, VerticalScrollBar } from "../scrollbar/";

// -----------------------------------------------------------------------------
// Error Tooltip Hook
// -----------------------------------------------------------------------------

function useTouchMove(handler: (deltaX: Pixel, deltaY: Pixel) => void, canMoveUp: () => boolean) {
  const canvasRef = useRef("canvas");
  let x = null as number | null;
  let y = null as number | null;

  function onTouchStart(ev: TouchEvent) {
    if (ev.touches.length !== 1) return;
    x = ev.touches[0].clientX;
    y = ev.touches[0].clientY;
  }

  function onTouchEnd() {
    x = null;
    y = null;
  }

  function onTouchMove(ev: TouchEvent) {
    if (ev.touches.length !== 1) return;
    // On mobile browsers, swiping down is often associated with "pull to refresh".
    // We only want this behavior if the grid is already at the top.
    // Otherwise we only want to move the canvas up, without triggering any refresh.
    if (canMoveUp()) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const currentX = ev.touches[0].clientX;
    const currentY = ev.touches[0].clientY;
    handler(x! - currentX, y! - currentY);
    x = currentX;
    y = currentY;
  }

  onMounted(() => {
    canvasRef.el!.addEventListener("touchstart", onTouchStart);
    canvasRef.el!.addEventListener("touchend", onTouchEnd);
    canvasRef.el!.addEventListener("touchmove", onTouchMove);
  });

  onWillUnmount(() => {
    canvasRef.el!.removeEventListener("touchstart", onTouchStart);
    canvasRef.el!.removeEventListener("touchend", onTouchEnd);
    canvasRef.el!.removeEventListener("touchmove", onTouchMove);
  });
}

// -----------------------------------------------------------------------------
// TEMPLATE
// -----------------------------------------------------------------------------

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
    GridOverlay,
    GridPopover,
    Menu,
    Popover,
    VerticalScrollBar,
    HorizontalScrollBar,
  };

  private menuState!: MenuState;
  private gridRef!: Ref<HTMLElement>;
  private canvas!: Ref<HTMLElement>;

  canvasPosition!: DOMCoordinates;
  hoveredCell!: Partial<Position>;

  setup() {
    this.menuState = useState({
      isOpen: false,
      position: null,
      menuItems: [],
    });
    this.gridRef = useRef("grid");
    this.canvas = useRef("canvas");
    this.canvasPosition = useAbsolutePosition(this.canvas);
    this.hoveredCell = useState({ col: undefined, row: undefined });

    useExternalListener(document.body, "copy", this.copy.bind(this));
    useTouchMove(this.moveCanvas.bind(this), () => {
      const { offsetScrollbarY } = this.env.model.getters.getActiveSheetScrollInfo();
      return offsetScrollbarY > 0;
    });
    onMounted(() => this.initGrid());
    onPatched(() => this.drawGrid());
  }

  onCellHovered({ col, row }) {
    this.hoveredCell.col = col;
    this.hoveredCell.row = row;
  }

  private initGrid() {
    this.drawGrid();
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

  drawGrid() {
    // drawing grid on canvas
    const canvas = this.canvas.el as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const thinLineWidth = 0.4 * dpr;
    const renderingContext = {
      ctx,
      dpr,
      thinLineWidth,
    };
    const { width, height } = this.env.model.getters.getSheetViewDimensionWithHeaders();
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.setAttribute("style", `width:${width}px;height:${height}px;`);
    // Imagine each pixel as a large square. The whole-number coordinates (0, 1, 2…)
    // are the edges of the squares. If you draw a one-unit-wide line between whole-number
    // coordinates, it will overlap opposite sides of the pixel square, and the resulting
    // line will be drawn two pixels wide. To draw a line that is only one pixel wide,
    // you need to shift the coordinates by 0.5 perpendicular to the line's direction.
    // http://diveintohtml5.info/canvas.html#pixel-madness
    ctx.translate(-CANVAS_SHIFT, -CANVAS_SHIFT);
    ctx.scale(dpr, dpr);
    this.env.model.drawGrid(renderingContext);
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
