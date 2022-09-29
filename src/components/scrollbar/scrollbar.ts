import { Component, onMounted, useRef } from "@odoo/owl";
import { CSSProperties, Pixel, Ref } from "../../types";
import { cssPropertiesToCss } from "../helpers/dom_helpers";
import { ScrollBar as ScrollBarBRol, ScrollDirection } from "../scrollbar";

interface Props {
  width: Pixel;
  height: Pixel;
  direction: ScrollDirection;
  position: CSSProperties;
  offset: Pixel;
  onScroll: (offset: Pixel) => void;
}

export class ScrollBar extends Component<Props> {
  static template = "o-spreadsheet-ScrollBar";
  static defaultProps = {
    width: 1,
    height: 1,
  };
  private scrollbarRef!: Ref<HTMLElement>;
  private scrollbar!: ScrollBarBRol;

  setup() {
    this.scrollbarRef = useRef("scrollbar");
    this.scrollbar = new ScrollBarBRol(this.scrollbarRef.el, "vertical");
    onMounted(() => {
      debugger;
      this.scrollbar.el = this.scrollbarRef.el!;
    });
  }

  get sizeCss() {
    return cssPropertiesToCss({
      width: `${this.props.width}px`,
      height: `${this.props.height}px`,
    });
  }

  get positionCss() {
    return cssPropertiesToCss(this.props.position);
  }

  onScroll() {
    if (this.props.offset !== this.scrollbar.scroll) {
      this.props.onScroll(this.scrollbar.scroll);
      //   const { maxOffsetX, maxOffsetY } = this.env.model.getters.getMaximumSheetOffset();
      //   this.env.model.dispatch("SET_VIEWPORT_OFFSET", {
      //     offsetX: Math.min(this.hScrollbar.scroll, maxOffsetX),
      //     offsetY: Math.min(this.vScrollbar.scroll, maxOffsetY),
      //   });
    }
  }
}
