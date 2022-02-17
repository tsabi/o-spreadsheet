import { _lt } from "../../translation";
import { ExcelChartDefinition } from "../../types";
import { XLSXFigure, XLSXFigureAnchor, XLSXFileStructure, XLSXImportFile } from "../../types/xlsx";
import { XLSXImportWarningManager } from "../helpers/xlsx_parser_error_manager";
import { removeNamespaces } from "../helpers/xml_helpers";
import { XlsxBaseExtractor } from "./base_extractor";
import { XlsxChartExtractor } from "./chart_extractor";

export class XlsxFigureExtractor extends XlsxBaseExtractor {
  constructor(
    drawingfile: XLSXImportFile,
    xlsxStructure: XLSXFileStructure,
    warningManager: XLSXImportWarningManager
  ) {
    super(drawingfile, xlsxStructure, warningManager);
  }

  extractFigures(): XLSXFigure[] {
    return this.mapOnElements(
      { document: this.rootFile.file, query: "xdr:wsDr", children: true },
      (figureElement): XLSXFigure => {
        const anchortype = removeNamespaces(figureElement.tagName);
        if (anchortype !== "twoCellAnchor") {
          throw new Error(_lt("Only twoCellAnchor are supported for xlsx drawings."));
        }

        const chartElement = this.querySelector(figureElement, "c:chart");
        if (!chartElement) {
          throw new Error(_lt("Only chart figures are currently supported."));
        }

        return {
          anchors: [
            this.extractFigureAnchor("xdr:from", figureElement),
            this.extractFigureAnchor("xdr:to", figureElement),
          ],
          data: this.extractChart(chartElement),
        };
      }
    );
  }

  private extractFigureAnchor(anchorTag: string, figureElement: Element): XLSXFigureAnchor {
    const anchor = this.querySelector(figureElement, anchorTag);
    if (!anchor) {
      throw new Error(_lt("Missing anchor element %s", anchorTag));
    }

    return {
      col: Number(this.extractChildTextContent(anchor, "xdr:col", { required: true })!),
      colOffset: Number(this.extractChildTextContent(anchor, "xdr:colOff", { required: true })!),
      row: Number(this.extractChildTextContent(anchor, "xdr:row", { required: true })!),
      rowOffset: Number(this.extractChildTextContent(anchor, "xdr:rowOff", { required: true })!),
    };
  }

  private extractChart(chartElement: Element): ExcelChartDefinition {
    const chartId = this.extractAttr(chartElement, "r:id", { required: true }).asString()!;
    const chartFile = this.getTargetXmlFile(this.relationships[chartId])!;

    return new XlsxChartExtractor(
      chartFile,
      this.xlsxFileStructure,
      this.warningManager
    ).extractChart();
  }
}
