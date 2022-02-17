import { buildSheetLink, markdownLink, toCartesian, toXC } from "../../helpers";
import { cellReference } from "../../helpers/references";
import { CellData, HeaderData, RangePart, SheetData } from "../../types";
import {
  XLSXCell,
  XLSXHyperLink,
  XLSXImportData,
  XLSXSharedFormula,
  XLSXWorksheet,
} from "../../types/xlsx";
import {
  EXCEL_DEFAULT_COL_WIDTH,
  EXCEL_DEFAULT_NUMBER_OF_COLS,
  EXCEL_DEFAULT_NUMBER_OF_ROWS,
  EXCEL_DEFAULT_ROW_HEIGHT,
} from "../constants";
import { convertHeightFromExcel, convertWidthFromExcel } from "../helpers/content_helpers";
import { WarningTypes, XLSXImportWarningManager } from "../helpers/xlsx_parser_error_manager";
import { convertConditionalFormats } from "./cf_conversion";
import { SUBTOTAL_FUNCTION_CONVERSION_MAP } from "./conversion_maps";
import { convertFigures } from "./figure_conversion";

type SharedFormulasMap = Record<number, XLSXSharedFormula>;

/** map XC : Hyperlink */
type HyperlinkMap = Record<string, XLSXHyperLink>;

export function convertSheets(
  data: XLSXImportData,
  warningManager: XLSXImportWarningManager
): SheetData[] {
  return data.sheets.map((sheet): SheetData => {
    const sheetDims = getSheetDims(sheet);
    const sharedFormulas = getSharedFormulasMap(sheet);

    return {
      id: sheet.sheetName,
      name: sheet.sheetName,
      colNumber: sheetDims[0],
      rowNumber: sheetDims[1],
      cells: convertCells(sheet, data, sharedFormulas, warningManager),
      merges: sheet.merges,
      cols: convertCols(sheet, sheetDims[0]),
      rows: convertRows(sheet, sheetDims[1]),
      conditionalFormats: convertConditionalFormats(sheet, data.dxfs, warningManager),
      figures: convertFigures(sheet),
    };
  });
}

function convertCols(sheet: XLSXWorksheet, numberOfCols: number): Record<number, HeaderData> {
  const cols: Record<number, HeaderData> = {};
  // Excel begins indexes at 1
  for (let i = 1; i < numberOfCols + 1; i++) {
    const col = sheet.cols.find((col) => col.min <= i && i <= col.max);
    let colSize: number;
    if (col && col.width) colSize = col.width;
    else if (sheet.sheetFormat?.defaultColWidth) colSize = sheet.sheetFormat.defaultColWidth;
    else colSize = EXCEL_DEFAULT_COL_WIDTH;
    cols[i - 1] = { size: convertWidthFromExcel(colSize), isHidden: col?.hidden };
  }
  return cols;
}

function convertRows(sheet: XLSXWorksheet, numberOfRows: number): Record<number, HeaderData> {
  const rows: Record<number, HeaderData> = {};
  // Excel begins indexes at 1
  for (let i = 1; i < numberOfRows + 1; i++) {
    const row = sheet.rows.find((row) => row.index === i);
    let rowSize: number;
    if (row && row.height) rowSize = row.height;
    else if (sheet.sheetFormat?.defaultRowHeight) rowSize = sheet.sheetFormat.defaultRowHeight;
    else rowSize = EXCEL_DEFAULT_ROW_HEIGHT;
    rows[i - 1] = { size: convertHeightFromExcel(rowSize), isHidden: row?.hidden };
  }
  return rows;
}

function convertCells(
  sheet: XLSXWorksheet,
  data: XLSXImportData,
  sfMap: SharedFormulasMap,
  warningManager: XLSXImportWarningManager
): Record<string, CellData | undefined> {
  const cells: Record<string, CellData | undefined> = {};
  const hyperlinkMap = sheet.hyperlinks.reduce((map, link) => {
    map[link.xc] = link;
    return map;
  }, {} as HyperlinkMap);

  for (let row of sheet.rows) {
    for (let cell of row.cells) {
      cells[cell.xc] = {
        content: getCellValue(cell, data, sfMap, hyperlinkMap, warningManager),
        style: cell.styleIndex ? cell.styleIndex + 1 : undefined,
        border: cell.styleIndex ? data.styles[cell.styleIndex].borderId + 1 : undefined,
        format: cell.styleIndex ? data.styles[cell.styleIndex].numFmtId + 1 : undefined,
      };
    }
  }
  return cells;
}

function getSharedFormulasMap(sheet: XLSXWorksheet): SharedFormulasMap {
  const formulas: SharedFormulasMap = {};
  for (let row of sheet?.rows) {
    for (let cell of row.cells) {
      if (cell.formula && cell.formula.sharedIndex !== undefined && cell.formula.content) {
        formulas[cell.formula.sharedIndex] = { refCellXc: cell.xc, formula: cell.formula.content };
      }
    }
  }
  return formulas;
}

function getCellValue(
  cell: XLSXCell,
  data: XLSXImportData,
  sfMap: SharedFormulasMap,
  hyperLinksMap: HyperlinkMap,
  warningManager: XLSXImportWarningManager
) {
  let cellValue: string | undefined;
  switch (cell.type) {
    case "sharedString":
      const ssIndex = parseInt(cell.value!, 10);
      cellValue = data.sharedStrings[ssIndex];
      break;
    case "boolean":
      cellValue = Number(cell.value) ? "TRUE" : "FALSE";
      break;
    case "date": // I'm not sure where this is used rather than a number with a format
    case "error": // I don't think Excel really uses this
    case "inlineStr":
    case "number":
    case "str":
      cellValue = cell.value;
      break;
  }

  if (cellValue && hyperLinksMap[cell.xc]) {
    cellValue = convertHyperlink(hyperLinksMap[cell.xc], cellValue, warningManager);
  }

  if (cell.formula) {
    cellValue =
      cell.formula.sharedIndex !== undefined && !cell.formula.content
        ? "=" + adaptFormula(cell.xc, sfMap[cell.formula.sharedIndex])
        : "=" + cell.formula.content;
    cellValue = convertFormula(cellValue);
  }

  return cellValue;
}

/**
 * Convert an XLSX formula into something we can evaluate.
 * - remove _xlfn. flags before function names
 * - convert the SUBTOTAL(index, formula) function to the function given by its index
 */
function convertFormula(formula: string): string {
  formula = formula.replace("_xlfn.", "");

  formula = formula.replace(new RegExp("SUBTOTAL\\(([0-9]*),", "g"), (match, p1) => {
    const convertedFunction = SUBTOTAL_FUNCTION_CONVERSION_MAP[p1];
    return convertedFunction ? convertedFunction + "(" : match;
  });
  return formula;
}

function convertHyperlink(
  link: XLSXHyperLink,
  cellValue: string,
  warningManager: XLSXImportWarningManager
): string {
  const label = link.display || cellValue;
  if (!link.relTarget && !link.location) {
    warningManager.generateNotsupportedWarning(WarningTypes.BadlyFormattedHyperlink);
  }
  const url = link.relTarget ? link.relTarget : buildSheetLink(link.location!.split("!")[0]);
  return markdownLink(label, url);
}

/**
 * Tranform a shared formula for the given target.
 *
 * This will compute the offset between the original cell of the shared formula and the target cell,
 * then apply this offset to all the ranges in the formula (taking fixed references into account)
 */
export function adaptFormula(targetCell: string, sf: XLSXSharedFormula) {
  const cellRegex = new RegExp(cellReference.source, "ig");
  const refPosition = toCartesian(sf.refCellXc);
  let newFormula = sf.formula.slice();

  let match: RegExpExecArray | null;
  do {
    match = cellRegex.exec(newFormula);
    if (match) {
      const formulaPosition = toCartesian(match[0].replace("$", ""));
      const targetPosition = toCartesian(targetCell);
      const rangePart: RangePart = {
        colFixed: match[0].startsWith("$"),
        rowFixed: match[0].includes("$", 1),
      };
      const offset = [targetPosition[0] - refPosition[0], targetPosition[1] - refPosition[1]];
      const offsetedPositon = [
        rangePart.colFixed ? formulaPosition[0] : formulaPosition[0] + offset[0],
        rangePart.rowFixed ? formulaPosition[1] : formulaPosition[1] + offset[1],
      ];
      newFormula =
        newFormula.slice(0, match.index) +
        toXC(offsetedPositon[0], offsetedPositon[1], rangePart) +
        newFormula.slice(match.index + match[0].length);
    }
  } while (match);

  return newFormula;
}

function getSheetDims(sheet: XLSXWorksheet): number[] {
  const dims = [0, 0];

  for (let row of sheet.rows) {
    dims[0] = Math.max(dims[0], ...row.cells.map((cell) => toCartesian(cell.xc)[0]));
    dims[1] = Math.max(dims[1], row.index);
  }

  dims[0] = Math.max(dims[0], EXCEL_DEFAULT_NUMBER_OF_COLS);
  dims[1] = Math.max(dims[1], EXCEL_DEFAULT_NUMBER_OF_ROWS);

  return dims;
}
