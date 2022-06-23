import { Component, useEffect, useRef } from "@odoo/owl";
import { ComponentsImportance } from "../../constants";
import { DOMCoordinates, DOMDimension, Pixel, Rect, SpreadsheetChildEnv } from "../../types";
import { PopoverPosition } from "../../types/cell_popovers";
import { css } from "../helpers/css";
import { CSSProperties } from "./../../types/misc";

export interface PopoverProps {
  /**
   * Rectangle beside which the popover is displayed.
   * Coordinates are expressed relative to the "body" element.
   */
  anchorRect: Rect;

  /**
   * Rectangle inside which the popover should stay when being displayed.
   * Coordinates are expressed relative to the "body" element.
   */
  viewportRect?: Rect;

  /** The popover can be positioned below the anchor Rectangle, or to the right of the rectangle */
  positioning: PopoverPosition;

  /** Minimum margin between the top of the screen and the popover */
  marginTop: Pixel;

  maxWidth?: Pixel;
  maxHeight?: Pixel;

  /** Offset to apply to the vertical position of the popover.*/
  verticalOffset: number;

  onMouseWheel?: () => {};
}

css/* scss */ `
  .o-popover {
    position: absolute;
    z-index: ${ComponentsImportance.Popover};
    overflow-y: auto;
    overflow-x: auto;
    box-shadow: 1px 2px 5px 2px rgb(51 51 51 / 15%);
    width: fit-content;
    height: fit-content;
  }
`;
/**
 * TODO: cell half in viewport
 */
export class Popover extends Component<PopoverProps, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-Popover";
  static defaultProps = {
    positioning: "BottomLeft",
    verticalOffset: 0,
    marginTop: 0,
    onMouseWheel: () => {},
  };

  private popoverRef = useRef("popover");

  setup() {
    // useEffect occurs after the DOM is created and the element width/height are computed, but before
    // the element in rendered, so we can still set its position
    useEffect(() => {
      console.log("###### USE EFFECT");
      const propsMaxSize = { width: this.props.maxWidth, height: this.props.maxHeight };

      const el = this.popoverRef.el!;
      el.style["max-height"] = el.style["max-width"] = "";
      el.style["bottom"] = el.style["top"] = el.style["right"] = el.style["left"] = "";

      const elDims = {
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      };

      const spreadsheetRect = el.parentElement!.getBoundingClientRect();
      const spreadsheetOffset = { x: spreadsheetRect.left, y: spreadsheetRect.top };

      const containerRect = {
        x: this.props.viewportRect?.x || 0,
        y: this.props.viewportRect?.y || 0,
        height: this.props.viewportRect?.height || spreadsheetRect.height,
        width: this.props.viewportRect?.width || spreadsheetRect.width,
      };

      const popoverPositionHelper =
        this.props.positioning === "BottomLeft"
          ? new BottomLeftPopoverHelper(this.props.anchorRect, containerRect, propsMaxSize)
          : new TopRightPopoverHelper(this.props.anchorRect, containerRect, propsMaxSize);

      const style = popoverPositionHelper.getCSSStyle(elDims, spreadsheetOffset);
      console.log(style);

      for (const property of Object.keys(style)) {
        el.style[property] = style[property];
      }
    });
  }

  get style() {
    return "";
  }
}

Popover.props = {
  anchorRect: Object,
  viewportRect: { type: Object, optional: true },
  positioning: { type: String, optional: true },
  marginTop: { type: Number, optional: true },
  maxWidth: { type: Number, optional: true },
  maxHeight: { type: Number, optional: true },
  verticalOffset: { type: Number, optional: true },
  onMouseWheel: { type: Function, optional: true },
  slots: Object,
};

abstract class PopoverHelper {
  constructor(
    protected anchorRect: Rect,
    protected viewportRect: Rect,
    private propsMaxSize: Partial<DOMDimension>
  ) {}

  protected abstract get availableHeightUp(): number;
  protected abstract get availableHeightDown(): number;
  protected abstract get availableWidthRight(): number;
  protected abstract get availableWidthLeft(): number;

  protected shouldRenderAtBottom(elementHeight: number): boolean {
    if (elementHeight <= this.availableHeightDown) return true;

    if (
      elementHeight > this.availableHeightUp &&
      this.availableHeightDown >= this.availableHeightUp
    ) {
      return true;
    }

    return false;
  }

  protected shouldRenderAtRight(elementWidth: number): boolean {
    if (elementWidth <= this.availableWidthRight) return true;

    if (
      elementWidth > this.availableWidthLeft &&
      this.availableWidthRight >= this.availableWidthLeft
    ) {
      return true;
    }

    return false;
  }

  protected getMaxHeight(elementHeight: number) {
    const shouldRenderAtBottom = this.shouldRenderAtBottom(elementHeight);
    const computedMaxHeight = shouldRenderAtBottom
      ? this.availableHeightDown
      : this.availableHeightUp;

    return this.propsMaxSize.height
      ? Math.min(computedMaxHeight, this.propsMaxSize.height)
      : computedMaxHeight;
  }

  protected getMaxWidth(elementWidth: number) {
    const shouldRenderAtRight = this.shouldRenderAtRight(elementWidth);
    const computedMaxWidth = shouldRenderAtRight
      ? this.availableWidthRight
      : this.availableWidthLeft;

    return this.propsMaxSize.height
      ? Math.min(computedMaxWidth, this.propsMaxSize.height)
      : computedMaxWidth;
  }

  protected abstract getTopCoordinate(
    actualElementHeight: number,
    shouldRenderAtBottom: boolean
  ): number;

  protected abstract getLeftCoordinate(
    actualElementWidth: number,
    shouldRenderAtRight: boolean
  ): number;

  getCSSStyle(elDims: DOMDimension, spreadsheetOffset: DOMCoordinates): CSSProperties {
    const maxHeight = this.getMaxHeight(elDims.height);
    const maxWidth = this.getMaxWidth(elDims.width);

    const actualHeight = Math.min(maxHeight, elDims.height);
    const actualWidth = Math.min(maxWidth, elDims.width);

    const shouldRenderAtBottom = this.shouldRenderAtBottom(elDims.height);
    const shouldRenderAtRight = this.shouldRenderAtRight(elDims.width);

    const cssProperties: CSSProperties = {
      "max-height": maxHeight + "px",
      "max-width": maxWidth + "px",
      top: this.getTopCoordinate(actualHeight, shouldRenderAtBottom) - spreadsheetOffset.y + "px",
      left: this.getLeftCoordinate(actualWidth, shouldRenderAtRight) - spreadsheetOffset.x + "px",
    };

    return cssProperties;
  }
}

class BottomLeftPopoverHelper extends PopoverHelper {
  constructor(anchorRect: Rect, viewportRect: Rect, propsMaxSize: Partial<DOMDimension>) {
    super(anchorRect, viewportRect, propsMaxSize);
    console.log("BottomLeftPopover");
  }

  protected get availableHeightUp() {
    return this.anchorRect.y - this.viewportRect.y;
  }

  protected get availableHeightDown() {
    return (
      this.viewportRect.y + this.viewportRect.height - (this.anchorRect.y + this.anchorRect.height)
    );
  }

  protected get availableWidthRight() {
    return this.viewportRect.x + this.viewportRect.width - this.anchorRect.x;
  }

  protected get availableWidthLeft() {
    return this.anchorRect.x + this.anchorRect.width - this.viewportRect.x;
  }

  protected getTopCoordinate(actualElementHeight: number, shouldRenderAtBottom: boolean): number {
    if (shouldRenderAtBottom) {
      return this.anchorRect.y + this.anchorRect.height;
    } else {
      return this.anchorRect.y - actualElementHeight;
    }
  }

  protected getLeftCoordinate(actualElementWidth: number, shouldRenderAtRight: boolean): number {
    if (shouldRenderAtRight) {
      return this.anchorRect.x;
    } else {
      return this.anchorRect.x + this.anchorRect.width - actualElementWidth;
    }
  }
}

class TopRightPopoverHelper extends PopoverHelper {
  constructor(anchorRect: Rect, viewportRect: Rect, propsMaxSize: Partial<DOMDimension>) {
    super(anchorRect, viewportRect, propsMaxSize);
    console.log("TopRightPopover");
  }

  protected get availableHeightUp() {
    return this.anchorRect.y + this.anchorRect.height - this.viewportRect.y;
  }

  protected get availableHeightDown() {
    return this.viewportRect.y + this.viewportRect.height - this.anchorRect.y;
  }

  protected get availableWidthRight() {
    return (
      this.viewportRect.x + this.viewportRect.width - (this.anchorRect.x + this.anchorRect.width)
    );
  }

  protected get availableWidthLeft() {
    return this.anchorRect.x - this.viewportRect.x;
  }

  protected getTopCoordinate(actualElementHeight: number, shouldRenderAtBottom: boolean): number {
    if (shouldRenderAtBottom) {
      return this.anchorRect.y;
    } else {
      return this.anchorRect.y + this.anchorRect.height - actualElementHeight;
    }
  }

  protected getLeftCoordinate(actualElementWidth: number, shouldRenderAtRight: boolean): number {
    if (shouldRenderAtRight) {
      return this.anchorRect.x + this.anchorRect.width;
    } else {
      return this.anchorRect.x - actualElementWidth;
    }
  }
}
