import { ExcelIconSet } from "../types/xlsx";

/** In XLSX color format (no #)  */
export const AUTO_COLOR = "0000";

export const XLSX_FORMAT_MAP = {
  General: 0,
  "0": 1,
  "0.00": 2,
  "#,#00": 3,
  "#,##0.00": 4,
  "0%": 9,
  "0.00%": 10,
  "0.00E+00": 11,
  "# ?/?": 12,
  "# ??/??": 13,
  "mm-dd-yy": 14,
  "d-mm-yy": 15,
  "mm-yy": 16,
  "mmm-yy": 17,
  "h:mm AM/PM": 18,
  "h:mm:ss AM/PM": 19,
  "h:mm": 20,
  "h:mm:ss": 21,
  "m/d/yy h:mm": 22,
  "#,##0 ;(#,##0)": 37,
  "#,##0 ;[Red](#,##0)": 38,
  "#,##0.00;(#,##0.00)": 39,
  "#,##0.00;[Red](#,##0.00)": 40,
  "mm:ss": 45,
  "[h]:mm:ss": 46,
  "mmss.0": 47,
  "##0.0E+0": 48,
  "@": 49,
  "hh:mm:ss a": 19, // TODO: discuss: this format is not recognized by excel for example (doesn't follow their guidelines I guess)
};

export const XLSX_ICONSET_MAP: Record<string, ExcelIconSet> = {
  arrow: "3Arrows",
  smiley: "3Symbols",
  dot: "3TrafficLights1",
};

export const NAMESPACE = {
  styleSheet: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  sst: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  Relationships: "http://schemas.openxmlformats.org/package/2006/relationships",
  Types: "http://schemas.openxmlformats.org/package/2006/content-types",
  worksheet: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  workbook: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  drawing: "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
};

export const DRAWING_NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
export const DRAWING_NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";

export const CONTENT_TYPES = {
  workbook: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
  sheet: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
  sharedStrings: "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml",
  styles: "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml",
  drawing: "application/vnd.openxmlformats-officedocument.drawing+xml",
  chart: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
  themes: "application/vnd.openxmlformats-officedocument.theme+xml",
  table: "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml",
  pivot: "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml",
} as const;

export const RELATIONSHIP_NSR =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export const HEIGHT_FACTOR = 0.75; // 100px => 75 u
export const WIDTH_FACTOR = 0.1317; // 100px => 13.17 u

/** unit : maximum number of characters a column can hold at the standard font size. What. */
export const EXCEL_DEFAULT_COL_WIDTH = 8.43;
/** unit : points */
export const EXCEL_DEFAULT_ROW_HEIGHT = 12.75;

export const EXCEL_DEFAULT_NUMBER_OF_COLS = 30;
export const EXCEL_DEFAULT_NUMBER_OF_ROWS = 100;

export const FIRST_NUMFMT_ID = 164;

export interface functionDefaultArg {
  type: "NUMBER";
  value: number;
}

export const FORCE_DEFAULT_ARGS_FUNCTIONS: Record<string, functionDefaultArg[]> = {
  FLOOR: [{ type: "NUMBER", value: 1 }],
  CEILING: [{ type: "NUMBER", value: 1 }],
  ROUND: [{ type: "NUMBER", value: 0 }],
  ROUNDUP: [{ type: "NUMBER", value: 0 }],
  ROUNDDOWN: [{ type: "NUMBER", value: 0 }],
};

/**
 * This list contains all "future" functions that are not compatible with older versions of Excel
 * For more information, see https://docs.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/5d1b6d44-6fc1-4ecd-8fef-0b27406cc2bf
 */
export const NON_RETROCOMPATIBLE_FUNCTIONS = [
  "ACOT",
  "ACOTH",
  "AGGREGATE",
  "ARABIC",
  "BASE",
  "BETA.DIST",
  "BETA.INV",
  "BINOM.DIST",
  "BINOM.DIST.RANGE",
  "BINOM.INV",
  "BITAND",
  "BITLSHIFT",
  "BITOR",
  "BITRSHIFT",
  "BITXOR",
  "CEILING.MATH",
  "CEILING.PRECISE",
  "CHISQ.DIST",
  "CHISQ.DIST.RT",
  "CHISQ.INV",
  "CHISQ.INV.RT",
  "CHISQ.TEST",
  "COMBINA",
  "CONCAT",
  "CONFIDENCE.NORM",
  "CONFIDENCE.T",
  "COT",
  "COTH",
  "COVARIANCE.P",
  "COVARIANCE.S",
  "CSC",
  "CSCH",
  "DAYS",
  "DECIMAL",
  "ERF.PRECISE",
  "ERFC.PRECISE",
  "EXPON.DIST",
  "F.DIST",
  "F.DIST.RT",
  "F.INV",
  "F.INV.RT",
  "F.TEST",
  "FILTERXML",
  "FLOOR.MATH",
  "FLOOR.PRECISE",
  "FORECAST.ETS",
  "FORECAST.ETS.CONFINT",
  "FORECAST.ETS.SEASONALITY",
  "FORECAST.ETS.STAT",
  "FORECAST.LINEAR",
  "FORMULATEXT",
  "GAMMA",
  "GAMMA.DIST",
  "GAMMA.INV",
  "GAMMALN.PRECISE",
  "GAUSS",
  "HYPGEOM.DIST",
  "IFNA",
  "IFS",
  "IMCOSH",
  "IMCOT",
  "IMCSC",
  "IMCSCH",
  "IMSEC",
  "IMSECH",
  "IMSINH",
  "IMTAN",
  "ISFORMULA",
  "ISOWEEKNUM",
  "LOGNORM.DIST",
  "LOGNORM.INV",
  "MAXIFS",
  "MINIFS",
  "MODE.MULT",
  "MODE.SNGL",
  "MUNIT",
  "NEGBINOM.DIST",
  "NORM.DIST",
  "NORM.INV",
  "NORM.S.DIST",
  "NORM.S.INV",
  "NUMBERVALUE",
  "PDURATION",
  "PERCENTILE.EXC",
  "PERCENTILE.INC",
  "PERCENTRANK.EXC",
  "PERCENTRANK.INC",
  "PERMUTATIONA",
  "PHI",
  "POISSON.DIST",
  "QUARTILE.EXC",
  "QUARTILE.INC",
  "QUERYSTRING",
  "RANK.AVG",
  "RANK.EQ",
  "RRI",
  "SEC",
  "SECH",
  "SHEET",
  "SHEETS",
  "SKEW.P",
  "STDEV.P",
  "STDEV.S",
  "SWITCH",
  "T.DIST",
  "T.DIST.2T",
  "T.DIST.RT",
  "T.INV",
  "T.INV.2T",
  "T.TEST",
  "TEXTJOIN",
  "UNICHAR",
  "UNICODE",
  "VAR.P",
  "VAR.S",
  "WEBSERVICE",
  "WEIBULL.DIST",
  "XOR",
  "Z.TEST",
];

export const CONTENT_TYPES_FILE = "[Content_Types].xml";

export const XLSX_INDEXED_COLORS = {
  0: "000000",
  1: "FFFFFF",
  2: "FF0000",
  3: "00FF00",
  4: "0000FF",
  5: "FFFF00",
  6: "FF00FF",
  7: "00FFFF",
  8: "000000",
  9: "FFFFFF",
  10: "FF0000",
  11: "00FF00",
  12: "0000FF",
  13: "FFFF00",
  14: "FF00FF",
  15: "00FFFF",
  16: "800000",
  17: "008000",
  18: "000080",
  19: "808000",
  20: "800080",
  21: "008080",
  22: "C0C0C0",
  23: "808080",
  24: "9999FF",
  25: "993366",
  26: "FFFFCC",
  27: "CCFFFF",
  28: "660066",
  29: "FF8080",
  30: "0066CC",
  31: "CCCCFF",
  32: "000080",
  33: "FF00FF",
  34: "FFFF00",
  35: "00FFFF",
  36: "800080",
  37: "800000",
  38: "008080",
  39: "0000FF",
  40: "00CCFF",
  41: "CCFFFF",
  42: "CCFFCC",
  43: "FFFF99",
  44: "99CCFF",
  45: "FF99CC",
  46: "CC99FF",
  47: "FFCC99",
  48: "3366FF",
  49: "33CCCC",
  50: "99CC00",
  51: "FFCC00",
  52: "FF9900",
  53: "FF6600",
  54: "666699",
  55: "969696",
  56: "003366",
  57: "339966",
  58: "003300",
  59: "333300",
  60: "993300",
  61: "993366",
  62: "333399",
  63: "333333",
  64: "000000", // system foreground
  65: "FFFFFF", // system background
};
