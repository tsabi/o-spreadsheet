import { SUBTOTAL_FUNCTION_CONVERSION_MAP } from ".";
import { cellReference, toCartesian, toXC } from "../../helpers";
import { RangePart } from "../../types";
import { XLSXImportData, XLSXSharedFormula, XLSXWorksheet } from "../../types/xlsx";

type SharedFormulasMap = Record<number, XLSXSharedFormula>;

export function convertFormulasContent(sheet: XLSXWorksheet, data: XLSXImportData) {
  const sfMap = getSharedFormulasMap(sheet);

  for (let cell of sheet.rows.map((row) => row.cells).flat()) {
    if (cell?.formula) {
      cell.formula.content =
        cell.formula.sharedIndex !== undefined && !cell.formula.content
          ? "=" + adaptFormula(cell.xc, sfMap[cell.formula.sharedIndex])
          : "=" + cell.formula.content;
      cell.formula.content = convertFormula(cell.formula.content);
    }
  }
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

/**
 * Convert an XLSX formula into something we can evaluate.
 * - remove _xlfn. flags before function names
 * - convert the SUBTOTAL(index, formula) function to the function given by its index
 * - change #REF! into #REF
 */
function convertFormula(formula: string): string {
  formula = formula.replace("_xlfn.", "");

  formula = formula.replace(/#REF!/g, "#REF");

  formula = formula.replace(new RegExp("SUBTOTAL\\(([0-9]*),", "g"), (match, p1) => {
    const convertedFunction = SUBTOTAL_FUNCTION_CONVERSION_MAP[p1];
    return convertedFunction ? convertedFunction + "(" : match;
  });
  return formula;
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
