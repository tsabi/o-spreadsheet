import {
  DEFAULT_GAUGE_LOWER_COLOR,
  DEFAULT_GAUGE_MIDDLE_COLOR,
  DEFAULT_GAUGE_UPPER_COLOR,
} from "../constants";
import {
  BasicChartDefinition,
  ChartDefinition,
  GaugeChartDefinition,
  Range,
  ScorecardChartDefinition,
  UID,
} from "../types";
import { isDefined } from "./misc";

const GraphColors = [
  // the same colors as those used in odoo reporting
  "rgb(31,119,180)",
  "rgb(255,127,14)",
  "rgb(174,199,232)",
  "rgb(255,187,120)",
  "rgb(44,160,44)",
  "rgb(152,223,138)",
  "rgb(214,39,40)",
  "rgb(255,152,150)",
  "rgb(148,103,189)",
  "rgb(197,176,213)",
  "rgb(140,86,75)",
  "rgb(196,156,148)",
  "rgb(227,119,194)",
  "rgb(247,182,210)",
  "rgb(127,127,127)",
  "rgb(199,199,199)",
  "rgb(188,189,34)",
  "rgb(219,219,141)",
  "rgb(23,190,207)",
  "rgb(158,218,229)",
];

export class ChartColors {
  private graphColorIndex = 0;

  next(): string {
    return GraphColors[this.graphColorIndex++ % GraphColors.length];
  }
}

/** Returns all the ranges contained in a chart definition */
export function getRangesInChartDefinition(definition: ChartDefinition): Range[] {
  const ranges: Range[] = [];
  if ("dataSets" in definition) {
    definition.dataSets.map((ds) => ds.dataRange).map((range) => ranges.push(range));
    definition.dataSets
      .map((ds) => ds.labelCell)
      .filter(isDefined)
      .map((range) => ranges.push(range));
  }
  if ("labelRange" in definition && definition.labelRange) {
    ranges.push(definition.labelRange);
  }
  if ("baseline" in definition && definition.baseline) {
    ranges.push(definition.baseline);
  }
  if ("keyValue" in definition && definition.keyValue) {
    ranges.push(definition.keyValue);
  }
  if ("dataRange" in definition && definition.dataRange) {
    ranges.push(definition.dataRange);
  }
  return ranges;
}

export function getDefaultBasicChartDefinition(sheetId: UID): BasicChartDefinition {
  return {
    type: "line",
    dataSets: [],
    labelRange: undefined,
    title: "",
    background: "#FFFFFF",
    sheetId,
    verticalAxisPosition: "left",
    legendPosition: "top",
    stackedBar: false,
  };
}

export function getDefaultScorecardChartDefinition(sheetId: UID): ScorecardChartDefinition {
  return {
    type: "scorecard",
    keyValue: undefined,
    title: "",
    sheetId,
    baselineMode: "absolute",
  };
}

export function getDefaultGaugeChartDefinition(sheetId: UID): GaugeChartDefinition {
  return {
    type: "gauge",
    dataRange: undefined,
    title: "",
    sheetId,
    sectionRule: {
      colors: {
        lowerColor: DEFAULT_GAUGE_LOWER_COLOR,
        middleColor: DEFAULT_GAUGE_MIDDLE_COLOR,
        upperColor: DEFAULT_GAUGE_UPPER_COLOR,
      },
      rangeMin: "0",
      rangeMax: "100",
      lowerInflectionPoint: {
        type: "percentage",
        value: "33",
      },
      upperInflectionPoint: {
        type: "percentage",
        value: "66",
      },
    },
  };
}
