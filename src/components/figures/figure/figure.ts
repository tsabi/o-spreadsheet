import { Component, useEffect, useRef, useState } from "@odoo/owl";
import {
  ComponentsImportance,
  FIGURE_BORDER_COLOR,
  FIGURE_BORDER_WIDTH,
  SELECTION_BORDER_COLOR,
} from "../../../constants";
import { figureRegistry } from "../../../registries/index";
import {
  ANCHOR_SIZE,
  Figure,
  FIGURE_BORDER_SHIFT,
  Pixel,
  Rect,
  SpreadsheetChildEnv,
  UID,
} from "../../../types/index";
import { css, cssPropertiesToCss } from "../../helpers/css";
import { startDnd } from "../../helpers/drag_and_drop";
import { dragFigureForMove, dragFigureForResize } from "../../helpers/figure_drag_helper";
import {
  HSnapAxis,
  snapForMove,
  snapForResize,
  SnapLine,
  VSnapAxis,
} from "../../helpers/figure_snap_helper";
import { CSSProperties } from "./../../../types/misc";

type Anchor =
  | "top left"
  | "top"
  | "top right"
  | "right"
  | "bottom right"
  | "bottom"
  | "bottom left"
  | "left";

// -----------------------------------------------------------------------------
// STYLE
// -----------------------------------------------------------------------------
const ACTIVE_BORDER_WIDTH = 2;

css/*SCSS*/ `
  div.o-figure {
    box-sizing: content-box;
    position: absolute;
    width: 100%;
    height: 100%;

    bottom: 0px;
    right: 0px;
    border: solid ${FIGURE_BORDER_COLOR};
    &:focus {
      outline: none;
    }
    &.active {
      border: solid ${SELECTION_BORDER_COLOR};
    }

    &.o-dragging {
      opacity: 0.9;
      cursor: grabbing;
    }
  }

  .o-figure-wrapper {
    position: absolute;
    box-sizing: content-box;

    .o-figure-overflow-wrapper {
      position: absolute;
      overflow: hidden;
      width: 100%;
      height: 100%;
    }
    .o-anchor {
      z-index: ${ComponentsImportance.FigureAnchor};
      position: absolute;
      width: ${ANCHOR_SIZE}px;
      height: ${ANCHOR_SIZE}px;
      background-color: #1a73e8;
      outline: ${FIGURE_BORDER_WIDTH}px solid white;

      &.o-top {
        cursor: n-resize;
      }
      &.o-topRight {
        cursor: ne-resize;
      }
      &.o-right {
        cursor: e-resize;
      }
      &.o-bottomRight {
        cursor: se-resize;
      }
      &.o-bottom {
        cursor: s-resize;
      }
      &.o-bottomLeft {
        cursor: sw-resize;
      }
      &.o-left {
        cursor: w-resize;
      }
      &.o-topLeft {
        cursor: nw-resize;
      }
    }
  }

  .o-figure-snap-border {
    position: absolute;
    z-index: ${ComponentsImportance.FigureSnapLine};
    &.vertical {
      width: 0px;
      border-left: 1px dashed black;
    }
    &.horizontal {
      border-top: 1px dashed black;
      height: 0px;
    }
  }
`;

interface Props {
  sidePanelIsOpen: Boolean;
  onFigureDeleted: () => void;
  figure: Figure;
}

interface State {
  draggedFigure?: Figure;
  horizontalSnapLine?: SnapLine<HSnapAxis>;
  verticalSnapLine?: SnapLine<VSnapAxis>;
}

export class FigureComponent extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-FigureComponent";
  static components = {};
  figureRegistry = figureRegistry;

  private figureRef = useRef("figure");

  state: State = useState({
    draggedFigure: undefined,
    horizontalSnapLine: undefined,
    verticalSnapLine: undefined,
  });

  get displayedFigure(): Figure {
    return this.state.draggedFigure ? this.state.draggedFigure : this.props.figure;
  }

  get isSelected(): boolean {
    return this.env.model.getters.getSelectedFigureId() === this.props.figure.id;
  }

  private getFigureSizeWithBorders(figure: Figure) {
    const { width, height } = figure;
    const borders = this.getBorderWidth(figure) * 2;
    return { width: width + borders, height: height + borders };
  }

  private getBorderWidth(figure: Figure) {
    return this.env.model.getters.getSelectedFigureId() === figure.id
      ? ACTIVE_BORDER_WIDTH
      : this.env.isDashboard()
      ? 0
      : FIGURE_BORDER_WIDTH;
  }

  getFigureStyle() {
    const { width, height } = this.displayedFigure;
    return cssPropertiesToCss({
      width: width + "px",
      height: height + "px",
      "border-width": this.getBorderWidth(this.displayedFigure) + "px",
    });
  }

  getContainerStyle() {
    const { x, y, height, width } = this.getContainerDOMRect(this.displayedFigure);

    if (width < 0 || height < 0) {
      return cssPropertiesToCss({ display: "none" });
    }
    return cssPropertiesToCss({
      top: y + "px",
      left: x + "px",
      width: width + "px",
      height: height + "px",
      "z-index": (ComponentsImportance.Figure + (this.isSelected ? 1 : 0)).toString(),
    });
  }

  getAnchorPosition(anchor: Anchor) {
    let { width, height } = this.getFigureSizeWithBorders(this.displayedFigure);

    const anchorCenteringOffset = (ANCHOR_SIZE - ACTIVE_BORDER_WIDTH) / 2;
    const target = this.displayedFigure;

    let x = 0;
    let y = 0;

    const { x: offsetCorrectionX, y: offsetCorrectionY } =
      this.env.model.getters.getMainViewportCoordinates();
    const { offsetX, offsetY } = this.env.model.getters.getActiveSheetScrollInfo();

    if (target.x + FIGURE_BORDER_SHIFT < offsetCorrectionX) {
      x = 0;
    } else if (target.x + FIGURE_BORDER_SHIFT < offsetCorrectionX + offsetX) {
      x = target.x - offsetCorrectionX - offsetX;
    } else {
      x = 0;
    }

    if (target.y + FIGURE_BORDER_SHIFT < offsetCorrectionY) {
      y = 0;
    } else if (target.y + FIGURE_BORDER_SHIFT < offsetCorrectionY + offsetY) {
      y = target.y - offsetCorrectionY - offsetY;
    } else {
      y = 0;
    }

    if (anchor.includes("top")) {
      y -= anchorCenteringOffset;
    } else if (anchor.includes("bottom")) {
      y += height - ACTIVE_BORDER_WIDTH - anchorCenteringOffset;
    } else {
      y += (height - ACTIVE_BORDER_WIDTH) / 2 - anchorCenteringOffset;
    }

    if (anchor.includes("left")) {
      x += -anchorCenteringOffset;
    } else if (anchor.includes("right")) {
      x += width - ACTIVE_BORDER_WIDTH - anchorCenteringOffset;
    } else {
      x += (width - ACTIVE_BORDER_WIDTH) / 2 - anchorCenteringOffset;
    }

    let visibility = "visible";
    if (x < -anchorCenteringOffset || y < -anchorCenteringOffset) {
      visibility = "hidden";
    }
    return cssPropertiesToCss({
      visibility,
      top: y + "px",
      left: x + "px",
    });
  }

  setup() {
    useEffect(
      (selectedFigureId: UID | null, thisFigureId: UID, el: HTMLElement | null) => {
        if (selectedFigureId === thisFigureId) {
          el?.focus();
        }
      },
      () => [this.env.model.getters.getSelectedFigureId(), this.props.figure.id, this.figureRef.el]
    );
  }

  /**
   * Initialize the resize of a figure with mouse movements
   *
   * @param dirX X direction of the resize. -1 : resize from the left border of the figure, 0 : no resize in X, 1 :
   * resize from the right border of the figure
   * @param dirY Y direction of the resize. -1 : resize from the top border of the figure, 0 : no resize in Y, 1 :
   * resize from the bottom border of the figure
   * @param ev Mouse Event
   */
  resize(dirX: -1 | 0 | 1, dirY: -1 | 0 | 1, ev: MouseEvent) {
    const figure = this.props.figure;

    ev.stopPropagation();
    const initialMousePosition = { x: ev.clientX, y: ev.clientY };

    const onMouseMove = (ev: MouseEvent) => {
      const currentMousePosition = { x: ev.clientX, y: ev.clientY };
      const draggedFigure = dragFigureForResize(
        figure,
        dirX,
        dirY,
        initialMousePosition,
        currentMousePosition
      );

      const visibleFigures = this.env.model.getters.getVisibleFigures();
      const otherFigures = visibleFigures.filter((fig) => fig.id !== figure.id);
      const snapResult = snapForResize(
        this.env.model.getters,
        dirX,
        dirY,
        draggedFigure,
        otherFigures
      );

      this.state.draggedFigure = snapResult.snappedFigure;
      this.state.horizontalSnapLine = snapResult.horizontalSnapLine;
      this.state.verticalSnapLine = snapResult.verticalSnapLine;
    };
    const onMouseUp = (ev: MouseEvent) => {
      if (!this.state.draggedFigure) return;
      const update: Partial<Figure> = {
        x: this.state.draggedFigure.x,
        y: this.state.draggedFigure.y,
        width: this.state.draggedFigure.width,
        height: this.state.draggedFigure.height,
      };
      this.env.model.dispatch("UPDATE_FIGURE", {
        sheetId: this.env.model.getters.getActiveSheetId(),
        id: figure.id,
        ...update,
      });
      this.state.draggedFigure = undefined;
      this.state.verticalSnapLine = undefined;
      this.state.horizontalSnapLine = undefined;
    };
    startDnd(onMouseMove, onMouseUp);
  }

  onMouseDown(ev: MouseEvent) {
    const figure = this.props.figure;
    // const gridPosition = gridOverlayPosition();

    if (ev.button > 0 || this.env.model.getters.isReadonly()) {
      // not main button, probably a context menu
      return;
    }
    const selectResult = this.env.model.dispatch("SELECT_FIGURE", { id: figure.id });
    if (!selectResult.isSuccessful) {
      return;
    }
    if (this.props.sidePanelIsOpen) {
      this.env.openSidePanel("ChartPanel");
    }
    const initialMousePosition = { x: ev.clientX, y: ev.clientY };
    const mainViewportPosition = this.env.model.getters.getMainViewportCoordinates();
    const onMouseMove = (ev: MouseEvent) => {
      const currentMousePosition = { x: ev.clientX, y: ev.clientY };
      const draggedFigure = dragFigureForMove(
        initialMousePosition,
        currentMousePosition,
        figure,
        mainViewportPosition,
        this.env.model.getters.getActiveSheetScrollInfo()
      );

      const visibleFigures = this.env.model.getters.getVisibleFigures();
      const otherFigures = visibleFigures.filter((fig) => fig.id !== figure.id);
      const snapResult = snapForMove(this.env.model.getters, draggedFigure, otherFigures);

      const snappedFigure = { ...draggedFigure };
      snappedFigure.x -= snapResult.verticalSnapLine?.snapOffset || 0;
      snappedFigure.y -= snapResult.horizontalSnapLine?.snapOffset || 0;

      this.state.draggedFigure = snappedFigure;
      this.state.horizontalSnapLine = snapResult.horizontalSnapLine;
      this.state.verticalSnapLine = snapResult.verticalSnapLine;
    };
    const onMouseUp = (ev: MouseEvent) => {
      if (!this.state.draggedFigure) return;
      this.env.model.dispatch("UPDATE_FIGURE", {
        sheetId: this.env.model.getters.getActiveSheetId(),
        id: figure.id,
        x: this.state.draggedFigure.x,
        y: this.state.draggedFigure.y,
      });
      this.state.draggedFigure = undefined;
      this.state.verticalSnapLine = undefined;
      this.state.horizontalSnapLine = undefined;
    };
    startDnd(onMouseMove, onMouseUp);
  }

  onKeyDown(ev: KeyboardEvent) {
    const figure = this.props.figure;

    switch (ev.key) {
      case "Delete":
        this.env.model.dispatch("DELETE_FIGURE", {
          sheetId: this.env.model.getters.getActiveSheetId(),
          id: figure.id,
        });
        this.props.onFigureDeleted();
        ev.stopPropagation();
        ev.preventDefault();
        break;
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowUp":
        const deltaMap = {
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
        };
        const delta = deltaMap[ev.key];
        this.env.model.dispatch("UPDATE_FIGURE", {
          sheetId: this.env.model.getters.getActiveSheetId(),
          id: figure.id,
          x: figure.x + delta[0],
          y: figure.y + delta[1],
        });
        ev.stopPropagation();
        ev.preventDefault();
        break;
    }
  }

  get horizontalSnapLineStyle(): string {
    if (!this.state.horizontalSnapLine || !this.state.draggedFigure) return "";

    const snap = this.state.horizontalSnapLine;
    const draggedFigure = this.state.draggedFigure;
    const draggedFigureDOMRect = this.getContainerDOMRect(this.state.draggedFigure);
    // const { offsetX, offsetY } = this.env.model.getters.getActiveSheetScrollInfo();

    if (!snap) return "";

    const matchedFigs = this.env.model.getters
      .getVisibleFigures()
      .filter((fig) => snap.matchedFigIds.includes(fig.id));
    const matchedFigureRects = matchedFigs.map(this.getContainerDOMRect, this);

    const leftMost = Math.min(draggedFigureDOMRect.x, ...matchedFigureRects.map((rect) => rect.x));
    const rightMost = Math.max(
      draggedFigureDOMRect.x + draggedFigureDOMRect.width,
      ...matchedFigureRects.map((rect) => rect.x + rect.width)
    );

    // Coordinates relative to the figure, not the grid
    const cssProperties: CSSProperties = {};
    cssProperties.left =
      (leftMost === draggedFigureDOMRect.x ? 0 : leftMost - draggedFigureDOMRect.x) + "px";
    cssProperties.width = rightMost - leftMost + "px";

    switch (snap.snappedAxis) {
      case "top":
        cssProperties.top = FIGURE_BORDER_WIDTH + "px";
        break;
      case "bottom":
        cssProperties.bottom = FIGURE_BORDER_WIDTH + "px";
        break;
      case "vCenter":
        const isFigureOverflowingTop = draggedFigureDOMRect.y === 0 && draggedFigure.y !== 0;
        if (!isFigureOverflowingTop) {
          cssProperties.top = draggedFigure.height / 2 + 2 * FIGURE_BORDER_WIDTH + "px";
        } else {
          cssProperties.bottom = draggedFigure.height / 2 + FIGURE_BORDER_WIDTH + "px";
        }
        break;
    }

    return cssPropertiesToCss(cssProperties);
  }

  get verticalSnapLineStyle(): string {
    if (!this.state.verticalSnapLine || !this.state.draggedFigure) return "";

    const snap = this.state.verticalSnapLine;
    const draggedFigure = this.state.draggedFigure;
    const draggedFigureDOMRect = this.getContainerDOMRect(draggedFigure);

    if (!snap) return "";

    const matchedFigs = this.env.model.getters
      .getVisibleFigures()
      .filter((fig) => snap.matchedFigIds.includes(fig.id));
    const matchedFigureRects = matchedFigs.map(this.getContainerDOMRect, this);

    const topMost = Math.min(draggedFigureDOMRect.y, ...matchedFigureRects.map((rect) => rect.y));
    const bottomMost = Math.max(
      draggedFigureDOMRect.y + draggedFigureDOMRect.height,
      ...matchedFigureRects.map((rect) => rect.y + rect.height)
    );

    // Coordinates relative to the figure, not the grid
    const cssProperties: CSSProperties = {};
    cssProperties.top =
      (topMost === draggedFigureDOMRect.y ? 0 : topMost - draggedFigureDOMRect.y) + "px";
    cssProperties.height = bottomMost - topMost + "px";

    switch (snap.snappedAxis) {
      case "left":
        cssProperties.left = FIGURE_BORDER_WIDTH + "px";
        break;
      case "right":
        cssProperties.right = FIGURE_BORDER_WIDTH + "px";
        break;
      case "hCenter":
        const isFigureOverflowingLeft = draggedFigureDOMRect.x === -1 && draggedFigure.x !== 0;
        if (!isFigureOverflowingLeft) {
          cssProperties.left = draggedFigure.width / 2 + 2 * FIGURE_BORDER_WIDTH + "px";
        } else {
          cssProperties.right = draggedFigure.width / 2 + 2 * FIGURE_BORDER_WIDTH + "px";
        }
        break;
    }

    return cssPropertiesToCss(cssProperties);
  }

  private getContainerDOMRect(target: Figure): Rect {
    const { x: offsetCorrectionX, y: offsetCorrectionY } =
      this.env.model.getters.getMainViewportCoordinates();

    const { offsetX, offsetY } = this.env.model.getters.getActiveSheetScrollInfo();
    let { width, height } = this.getFigureSizeWithBorders(target);
    let x: Pixel, y: Pixel;

    if (target.x + FIGURE_BORDER_SHIFT < offsetCorrectionX) {
      x = target.x;
    } else if (target.x + FIGURE_BORDER_SHIFT < offsetCorrectionX + offsetX) {
      x = offsetCorrectionX;
      width += target.x - offsetCorrectionX - offsetX;
    } else {
      x = target.x - offsetX;
    }

    if (target.y + FIGURE_BORDER_SHIFT < offsetCorrectionY) {
      y = target.y;
    } else if (target.y + FIGURE_BORDER_SHIFT < offsetCorrectionY + offsetY) {
      y = offsetCorrectionY;
      height += target.y - offsetCorrectionY - offsetY;
    } else {
      y = target.y - offsetY;
    }

    const borderOffset = FIGURE_BORDER_WIDTH - this.getBorderWidth(this.displayedFigure);

    return {
      // TODO : remove the +1 once 2951210 is fixed
      y: y + borderOffset + 1,
      x: x + borderOffset,
      width,
      height,
    };
  }

  // private xPositionToFigureDOMCoordinate(x : number, figure : Figure){
  //   const figureDOMRect = this.getContainerDOMRect(figure);

  //   const overflow =
  // }
}

FigureComponent.props = {
  sidePanelIsOpen: Boolean,
  onFigureDeleted: Function,
  figure: Object,
};
