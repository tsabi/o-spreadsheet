import { Component, onMounted, onPatched, onWillUnmount, useRef } from "@odoo/owl";
import {
  DOMCoordinates,
  DOMDimension,
  HeaderIndex,
  Position,
  Ref,
  SpreadsheetChildEnv,
} from "../../types";
import { FiguresContainer } from "../figures/container/container";
import { useInterval } from "../helpers/time_hooks";

function useCellHovered(
  env: SpreadsheetChildEnv,
  gridRef: Ref<HTMLElement>,
  callback: (position: Partial<Position>) => void
): Partial<Position> {
  let hoveredPosition: Partial<Position> = {
    col: undefined,
    row: undefined,
  };
  const { Date } = window;
  let x = 0;
  let y = 0;
  let lastMoved = 0;

  function getPosition(): Position {
    const col = env.model.getters.getColIndex(x);
    const row = env.model.getters.getRowIndex(y);
    return { col, row };
  }

  const { pause, resume } = useInterval(checkTiming, 200);

  function checkTiming() {
    const { col, row } = getPosition();
    const delta = Date.now() - lastMoved;
    if (delta > 300 && (col !== hoveredPosition.col || row !== hoveredPosition.row)) {
      setPosition(undefined, undefined);
    }
    if (delta > 300) {
      if (col < 0 || row < 0) {
        return;
      }
      setPosition(col, row);
    }
  }
  function updateMousePosition(e: MouseEvent) {
    x = e.offsetX;
    y = e.offsetY;
    lastMoved = Date.now();
  }

  function recompute() {
    const { col, row } = getPosition();
    if (col !== hoveredPosition.col || row !== hoveredPosition.row) {
      setPosition(undefined, undefined);
    }
  }

  onMounted(() => {
    const grid = gridRef.el!;
    grid.addEventListener("mousemove", updateMousePosition);
    grid.addEventListener("mouseleave", pause);
    grid.addEventListener("mouseenter", resume);
    grid.addEventListener("mousedown", recompute);
  });

  onWillUnmount(() => {
    const grid = gridRef.el!;
    grid.removeEventListener("mousemove", updateMousePosition);
    grid.removeEventListener("mouseleave", pause);
    grid.removeEventListener("mouseenter", resume);
    grid.removeEventListener("mousedown", recompute);
  });

  function setPosition(col?: number, row?: number) {
    if (col !== hoveredPosition.col || row !== hoveredPosition.row) {
      hoveredPosition.col = col;
      hoveredPosition.row = row;
      callback({ col, row });
    }
  }
  return hoveredPosition;
}

interface Props {
  onCellHovered: (position: Partial<Position>) => void;
  onCellDoubleClicked: (col: HeaderIndex, row: HeaderIndex) => void;
  onCellClicked: (
    col: HeaderIndex,
    row: HeaderIndex,
    modifiers: { ctrlKey: boolean; shiftKey: boolean }
  ) => void;
  onCellRightClicked: (col: HeaderIndex, row: HeaderIndex, coordinates: DOMCoordinates) => void;
  onGridResized: (dimension: DOMDimension) => void;
  gridOverlayDimensions: string;
  sidePanelIsOpen: boolean;
  onFigureDeleted: () => void;
}

export class GridOverlay extends Component<Props> {
  static template = "o-spreadsheet-GridOverlay";
  static components = { FiguresContainer };
  private gridOverlay!: Ref<HTMLElement>;

  setup() {
    this.gridOverlay = useRef("gridOverlay");
    useCellHovered(this.env, this.gridOverlay, this.props.onCellHovered);
    onMounted(() => this.resizeGrid());
    onPatched(() => this.resizeGrid());
  }

  get gridOverlayEl(): HTMLElement {
    if (!this.gridOverlay.el) {
      throw new Error("GridOverlay el is not defined.");
    }
    return this.gridOverlay.el;
  }

  onMouseDown(ev: MouseEvent) {
    if (ev.button > 0) {
      // not main button, probably a context menu
      return;
    }
    const [col, row] = this.getCartesianCoordinates(ev);
    this.props.onCellClicked(col, row, { shiftKey: ev.shiftKey, ctrlKey: ev.ctrlKey });
  }

  onDoubleClick(ev: MouseEvent) {
    const [col, row] = this.getCartesianCoordinates(ev);
    this.props.onCellDoubleClicked(col, row);
  }

  onContextMenu(ev: MouseEvent) {
    ev.preventDefault();
    const [col, row] = this.getCartesianCoordinates(ev);
    this.props.onCellRightClicked(col, row, { x: ev.clientX, y: ev.clientY });
  }

  private getCartesianCoordinates(ev: MouseEvent): [HeaderIndex, HeaderIndex] {
    const colIndex = this.env.model.getters.getColIndex(ev.offsetX);
    const rowIndex = this.env.model.getters.getRowIndex(ev.offsetY);
    return [colIndex, rowIndex];
  }

  private resizeGrid() {
    this.props.onGridResized({
      height: this.gridOverlayEl.clientHeight,
      width: this.gridOverlayEl.clientWidth,
    });
  }
}
