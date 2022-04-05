import { Component, onWillUpdateProps } from "@odoo/owl";
import { DEFAULT_FONT } from "../../../constants";
import { getFontSizeMatchingWidth } from "../../../helpers";
import { Figure, ScorecardChartRuntime, SpreadsheetChildEnv } from "../../../types";
import { css } from "../../helpers/css";

type ScorecardElement = "title" | "key" | "baseline";

/* Sizes of boxes containing the texts, in percentage of the Chart size */
const TITLE_BOX_HEIGHT_RATIO = 0.25;
const BASELINE_BOX_HEIGHT_RATIO = 0.25;
const KEY_BOX_HEIGHT_RATIO = 0.5;

/** Baseline description should have a smaller font than the baseline */
const BASELINE_DESCR_FONT_RATIO = 0.9;

/* Paddings, in percentage of the element they are inside */
const CHART_VERTICAL_PADDING_RATIO = 0.04;
const CHART_HORIZONTAL_PADDING_RATIO = 0.05;
const VERTICAL_PADDING_KEY_BASELINE_RATIO = 0.03;
const VERTICAL_PADDING_TITLE_KEY_RATIO = 0.06;

css/* scss */ `
  div.o-scorecard {
    user-select: none;
    background-color: white;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    box-sizing: border-box;
    overflow: hidden;
    white-space: nowrap;

    .o-title-text {
      color: #757575;
      line-height: 1em;
    }

    .o-key-text {
      line-height: 1em;
    }

    .o-cf-icon {
      display: inline-block;
      width: 0.65em;
      height: 1em;
      line-height: 1em;
      padding-bottom: 0.07em;
      padding-right: 3px;
    }

    .o-baseline-text {
      color: #757575;
      line-height: 1em;
    }
  }
`;

interface Props {
  figure: Figure;
}

export class ScorecardChart extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet.ScorecardChart";
  private ctx = document.createElement("canvas").getContext("2d")!;

  private runtime: ScorecardChartRuntime | undefined;

  setup() {
    this.runtime = this.env.model.getters.getScorecardChartRuntime(this.props.figure.id);
    onWillUpdateProps(() => {
      this.runtime = this.env.model.getters.getScorecardChartRuntime(this.props.figure.id);
    });
  }

  get title() {
    return this.runtime?.title || "";
  }

  get keyValue() {
    return this.runtime?.formattedKeyValue || this.runtime?.keyValue?.toString() || "";
  }

  get baselineDescr() {
    return this.runtime?.baselineDescr ? " " + this.runtime.baselineDescr : "";
  }

  get chartStyle() {
    return `
      height:${this.props.figure.height}px;
      width:${this.props.figure.width}px;
      padding-top:${this.props.figure.height * CHART_VERTICAL_PADDING_RATIO}px;
      padding-bottom:${this.props.figure.height * CHART_VERTICAL_PADDING_RATIO}px;
      padding-left:${this.props.figure.width * CHART_HORIZONTAL_PADDING_RATIO}px;
      padding-right:${this.props.figure.width * CHART_HORIZONTAL_PADDING_RATIO}px;
    `;
  }

  get baseline(): string {
    if (!this.runtime) return "";
    let baselineValue: string = "";
    if (!this.runtime.baseline) {
      baselineValue = "";
    } else if (isNaN(Number(this.runtime.baseline)) || isNaN(Number(this.runtime.keyValue))) {
      baselineValue = this.runtime.baseline.toString();
    } else {
      let diff = Number(this.runtime.keyValue) - Number(this.runtime.baseline);
      if (this.runtime.baselineMode === "percentage") {
        diff = (diff / Number(this.runtime.baseline)) * 100;
      }
      baselineValue = Math.abs(parseFloat(diff.toFixed(2))).toLocaleString();
      if (this.runtime.baselineMode === "percentage") {
        baselineValue += "%";
      }
    }

    return baselineValue;
  }

  get baselineColor(): string {
    let style = "";
    if (!this.runtime) return style;
    let diff = Number(this.runtime.keyValue) - Number(this.runtime.baseline);
    if (isNaN(diff)) {
      return "";
    }
    if (diff > 0) {
      style = `color:#00A04A`;
    } else if (diff < 0) {
      style = `color:#DC6965`;
    }
    return style;
  }

  get baselineArrowDirection(): string {
    let direction = "neutral";
    if (!this.runtime) return direction;
    let diff = Number(this.runtime.keyValue) - Number(this.runtime.baseline);
    if (isNaN(diff)) {
      return direction;
    }

    if (diff > 0) {
      direction = "up";
    } else if (diff < 0) {
      direction = "down";
    }
    return direction;
  }

  getTextStyles() {
    // If the widest text overflows horizontally, scale it down, and apply the same scaling factors to all the other fonts.
    const maxLineWidth = this.props.figure.width * (1 - 2 * CHART_HORIZONTAL_PADDING_RATIO);
    const widestElement = this.getWidestElement();
    const baseFontSize = this.getElementMaxHeight(widestElement);
    const fontSizeMatchingWidth = getFontSizeMatchingWidth(
      maxLineWidth,
      1,
      baseFontSize,
      (fontSize: number) => this.getElementWidth(widestElement, fontSize)
    );
    let scalingFactor = fontSizeMatchingWidth / baseFontSize;

    // Fonts sizes in px
    const keyFontSize = this.getElementMaxHeight("key") * scalingFactor;
    const baselineFontSize = this.getElementMaxHeight("baseline") * scalingFactor;
    const titleFontSize = this.getElementMaxHeight("title") * scalingFactor;

    return {
      titleStyle: this.getTextStyle({
        fontSize: titleFontSize,
        paddingBottom: VERTICAL_PADDING_TITLE_KEY_RATIO * this.props.figure.height,
      }),
      keyStyle: this.getTextStyle({
        fontSize: keyFontSize,
      }),
      baselineStyle: this.getTextStyle({
        fontSize: baselineFontSize,
        paddingTop: VERTICAL_PADDING_KEY_BASELINE_RATIO * this.props.figure.height,
      }),
      baselineDescrStyle: this.getTextStyle({
        fontSize: baselineFontSize * BASELINE_DESCR_FONT_RATIO,
      }),
    };
  }

  /** Return an CSS style string corresponding to the given arguments */
  private getTextStyle(args: { fontSize: number; paddingBottom?: number; paddingTop?: number }) {
    return `
    padding-top:${args.paddingTop || 0}px;
    padding-bottom:${args.paddingBottom || 0}px;
    font-size:${args.fontSize}px;
  `;
  }

  /** Get the height of the chart minus all the vertical paddings */
  private getDrawableHeight() {
    const haveBaseline = this.baseline || this.baselineDescr;
    let totalPaddingRatio = 2 * CHART_VERTICAL_PADDING_RATIO;
    totalPaddingRatio += haveBaseline ? VERTICAL_PADDING_KEY_BASELINE_RATIO : 0;
    totalPaddingRatio += this.title ? VERTICAL_PADDING_TITLE_KEY_RATIO : 0;

    return this.props.figure.height * (1 - totalPaddingRatio);
  }

  /**
   * Get the maximal height of an element of the scorecard.
   *
   * This is computed such as all the height is taken by the elements, even if there is no title or baseline.
   */
  private getElementMaxHeight(element: ScorecardElement): number {
    const height = this.getDrawableHeight();
    const haveBaseline = this.baseline || this.baselineDescr;
    let totalOccupiedRatio = KEY_BOX_HEIGHT_RATIO;
    totalOccupiedRatio += haveBaseline ? BASELINE_BOX_HEIGHT_RATIO : 0;
    totalOccupiedRatio += this.title ? TITLE_BOX_HEIGHT_RATIO : 0;

    switch (element) {
      case "baseline":
        return (BASELINE_BOX_HEIGHT_RATIO / totalOccupiedRatio) * height;
      case "key":
        return (KEY_BOX_HEIGHT_RATIO / totalOccupiedRatio) * height;
      case "title":
        return (TITLE_BOX_HEIGHT_RATIO / totalOccupiedRatio) * height;
    }
  }

  /** Return the element with he widest text in the chart */
  private getWidestElement(): ScorecardElement {
    const titleWidth = this.getElementWidth("title", TITLE_BOX_HEIGHT_RATIO);
    const keyValueWidth = this.getElementWidth("key", KEY_BOX_HEIGHT_RATIO);

    let widest: ScorecardElement = titleWidth > keyValueWidth ? "title" : "key";

    const baselineWidth = this.getElementWidth("baseline", BASELINE_BOX_HEIGHT_RATIO);

    if (baselineWidth > titleWidth && baselineWidth > keyValueWidth) {
      widest = "baseline";
    }

    return widest;
  }

  /** Return the width of an scorecard element in pixels */
  private getElementWidth(text: ScorecardElement, fontSize: number) {
    let str = "";
    switch (text) {
      case "baseline":
        // Put mock text to simulate the width of the up/down arrow
        const largeText =
          this.baselineArrowDirection !== "neutral" ? "A " + this.baseline : this.baseline;
        this.ctx.font = `${fontSize}px ${DEFAULT_FONT}`;
        let textWidth = this.ctx.measureText(largeText).width;
        // Baseline descr font size should be smaller than baseline font size
        this.ctx.font = `${fontSize * BASELINE_DESCR_FONT_RATIO}px ${DEFAULT_FONT}`;
        textWidth += this.ctx.measureText(this.baselineDescr).width;
        return textWidth;
      case "key":
        str = this.keyValue;
        break;
      case "title":
        str = this.title;
        break;
    }
    this.ctx.font = `${fontSize}px ${DEFAULT_FONT}`;
    return this.ctx.measureText(str).width;
  }
}
