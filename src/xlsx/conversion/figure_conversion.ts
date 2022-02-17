import { isDefined } from "../../helpers";
import { ChartUIDefinition, ExcelChartDefinition, FigureData } from "../../types";
import { XLSXFigure, XLSXWorksheet } from "../../types/xlsx";
import { convertEMUToDotValue, getColPosition, getRowPosition } from "../helpers/content_helpers";

//TODO ; check graph import on device with window.devicePixelRatio > 1 when importing from odoo.
export function convertFigures(sheetData: XLSXWorksheet): FigureData<any>[] {
  let id = 1;
  return sheetData.figures
    .map((figure) => convertFigure(figure, (id++).toString(), sheetData))
    .filter(isDefined);
}

function convertFigure(
  figure: XLSXFigure,
  id: string,
  sheetData: XLSXWorksheet
): FigureData<any> | undefined {
  const x1 =
    getColPosition(figure.anchors[0].col, sheetData) +
    convertEMUToDotValue(figure.anchors[0].colOffset);
  const x2 =
    getColPosition(figure.anchors[1].col, sheetData) +
    convertEMUToDotValue(figure.anchors[1].colOffset);

  const y1 =
    getRowPosition(figure.anchors[0].row, sheetData) +
    convertEMUToDotValue(figure.anchors[0].rowOffset);
  const y2 =
    getRowPosition(figure.anchors[1].row, sheetData) +
    convertEMUToDotValue(figure.anchors[1].rowOffset);

  const width = x2 - x1;
  const height = y2 - y1;

  const chartData = convertChartData(figure.data);
  if (!chartData) return undefined;
  return {
    id: id,
    x: x1,
    y: y1,
    width,
    height,
    tag: "chart",
    data: convertChartData(figure.data),
  };
}

function convertChartData(chartData: ExcelChartDefinition): ChartUIDefinition | undefined {
  const labelRange = chartData.dataSets[0].label?.replace(/\$/g, "");
  return {
    dataSets: chartData.dataSets.map((data) => data.range.replace(/\$/g, "")),
    dataSetsHaveTitle: false,
    labelRange,
    title: chartData.title || "",
    type: chartData.type,
    background: chartData.backgroundColor,
    verticalAxisPosition: chartData.verticalAxisPosition,
    legendPosition: chartData.legendPosition,
    stackedBar: false,
  };
}
