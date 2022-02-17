import {
  Align,
  BorderStyle,
  ChartTypes,
  ConditionalFormattingOperatorValues,
  LegendPosition,
  ThresholdType,
} from "../../types";
import {
  ExcelIconSet,
  XLSXBorderStyle,
  XLSXCellType,
  XLSXCFOperatorType,
  XLSXCFType,
  XLSXCFValueObjectType,
  XLSXChartType,
  XLSXHorizontalAlignment,
} from "../../types/xlsx";

export const SUPPORTED_BORDER_STYLES = ["thin"];
export const SUPPORTED_HORIZONTAL_ALIGNMENTS = ["general", "left", "center", "right"];
export const SUPPORTED_FONTS = ["Arial"];
export const SUPPORTED_FILL_PATTERNS = ["solid"];
export const SUPPORTED_CF_TYPES = [
  "expression",
  "cellIs",
  "colorScale",
  "iconSet",
  "containsText",
  "notContainsText",
  "beginsWith",
  "endsWith",
  "containsBlanks",
  "notContainsBlanks",
];

/** Map between cell type in XLSX file and human readable cell type  */
export const CELL_TYPE_CONVERSION_MAP: Record<string, XLSXCellType> = {
  b: "boolean",
  d: "date",
  e: "error",
  inlineStr: "inlineStr",
  n: "number",
  s: "sharedString",
  str: "str",
};

/** Conversion map Border Style in XLSX <=> Border style in o_spreadsheet*/
export const BORDER_STYLE_CONVERSION_MAP: Record<XLSXBorderStyle, BorderStyle | undefined> = {
  dashDot: "thin",
  dashDotDot: "thin",
  dashed: "thin",
  dotted: "thin",
  double: "thin",
  hair: "thin",
  medium: "thin",
  mediumDashDot: "thin",
  mediumDashDotDot: "thin",
  mediumDashed: "thin",
  none: undefined,
  slantDashDot: "thin",
  thick: "thin",
  thin: "thin",
};

/** Conversion map Horizontal Alignment in XLSX <=> Horizontal Alignment in o_spreadsheet*/
export const H_ALIGNMENT_CONVERSION_MAP: Record<XLSXHorizontalAlignment, Align> = {
  general: undefined,
  left: "left",
  center: "center",
  right: "right",
  fill: "left",
  justify: "left",
  centerContinuous: "center",
  distributed: "center",
};

/** Convert the "CellIs" cf operator.
 * We have all the operators that the xlsx have, but ours begin with a uppercase character */
export function convertCFCellIsOperator(
  xlsxCfOperator: XLSXCFOperatorType
): ConditionalFormattingOperatorValues {
  return (xlsxCfOperator.slice(0, 1).toUpperCase() +
    xlsxCfOperator.slice(1)) as ConditionalFormattingOperatorValues;
}

/** Conversion map CF types in XLSX <=> Cf types in o_spreadsheet */
export const CF_TYPE_CONVERSION_MAP: Record<
  XLSXCFType,
  ConditionalFormattingOperatorValues | undefined
> = {
  aboveAverage: undefined,
  expression: undefined,
  cellIs: undefined, // exist but isn't an operator in o_spreadsheet
  colorScale: undefined, // exist but isn't an operator in o_spreadsheet
  dataBar: undefined,
  iconSet: undefined, // exist but isn't an operator in o_spreadsheet
  top10: undefined,
  uniqueValues: undefined,
  duplicateValues: undefined,
  containsText: "ContainsText",
  notContainsText: "NotContains",
  beginsWith: "BeginsWith",
  endsWith: "EndsWith",
  containsBlanks: "IsEmpty",
  notContainsBlanks: "IsNotEmpty",
  containsErrors: undefined,
  notContainsErrors: undefined,
  timePeriod: undefined,
};

/** Conversion map CF thresholds types in XLSX <=> Cf thresholds types in o_spreadsheet */
export const CF_THRESHOLD_CONVERSION_MAP: Record<XLSXCFValueObjectType, ThresholdType> = {
  num: "number",
  percent: "percentage",
  max: "value",
  min: "value",
  percentile: "percentile",
  formula: "formula",
};

/**
 * Conversion map between Excels IconSets and our own IconSets. The string is the key of the iconset in the ICON_SETS constant.
 *
 * NoIcons is undefined instead of an empty string because we don't support it and need to mange it separetly.
 */
export const ICON_SET_CONVERSION_MAP: Record<ExcelIconSet, string | undefined> = {
  NoIcons: undefined,
  "3Arrows": "arrows",
  "3ArrowsGray": "arrows",
  "3Symbols": "smiley",
  "3Symbols2": "smiley",
  "3Signs": "dots",
  "3Flags": "dots",
  "3TrafficLights1": "dots",
  "3TrafficLights2": "dots",
  "4Arrows": "arrows",
  "4ArrowsGray": "arrows",
  "4RedToBlack": "dots",
  "4Rating": "smiley",
  "4TrafficLights": "dots",
  "5Arrows": "arrows",
  "5ArrowsGray": "arrows",
  "5Rating": "smiley",
  "5Quarters": "dots",
  "3Stars": "smiley",
  "3Triangles": "arrows",
  "5Boxes": "dots",
};

/** Map between legend position in XLSX file and human readable position  */
export const DRAWING_LEGEND_POSITION_CONVERSION_MAP: Record<string, LegendPosition> = {
  b: "bottom",
  t: "top",
  l: "left",
  r: "right",
  tr: "right",
};

/** Conversion map chart types in XLSX <=> Cf chart types o_spreadsheet (undefined for unsupported chart types)*/
export const CHART_TYPE_CONVERSION_MAP: Record<XLSXChartType, ChartTypes | undefined> = {
  areaChart: undefined,
  area3DChart: undefined,
  lineChart: "line",
  line3DChart: undefined,
  stockChart: undefined,
  radarChart: undefined,
  scatterChart: undefined,
  pieChart: "pie",
  pie3DChart: undefined,
  doughnutChart: "pie",
  barChart: "bar",
  bar3DChart: undefined,
  ofPieChart: undefined,
  surfaceChart: undefined,
  surface3DChart: undefined,
  bubbleChart: undefined,
};

/** Conversion map for the SUBTOTAL(index, formula) function in xlsx, index <=> actual function*/
export const SUBTOTAL_FUNCTION_CONVERSION_MAP = {
  "1": "AVERAGE",
  "2": "COUNT",
  "3": "COUNTA",
  "4": "MAX",
  "5": "MIN",
  "6": "PRODUCT",
  "7": "STDEV",
  "8": "STDEVP",
  "9": "SUM",
  "10": "VAR",
  "11": "VARP",
  "101": "AVERAGE",
  "102": "COUNT",
  "103": "COUNTA",
  "104": "MAX",
  "105": "MIN",
  "106": "PRODUCT",
  "107": "STDEV",
  "108": "STDEVP",
  "109": "SUM",
  "110": "VAR",
  "111": "VARP",
};
