import { _lt } from "../../translation";
import { ExcelChartDataset, ExcelChartDefinition } from "../../types";
import {
  XLSXChartType,
  XLSXFileStructure,
  XLSXImportFile,
  XLSX_CHART_TYPES,
} from "../../types/xlsx";
import { CHART_TYPE_CONVERSION_MAP, DRAWING_LEGEND_POSITION_CONVERSION_MAP } from "../conversion";
import { XLSXImportWarningManager } from "../helpers/xlsx_parser_error_manager";
import { removeNamespaces } from "../helpers/xml_helpers";
import { XlsxBaseExtractor } from "./base_extractor";

export class XlsxChartExtractor extends XlsxBaseExtractor {
  constructor(
    chartFile: XLSXImportFile,
    xlsxStructure: XLSXFileStructure,
    warningManager: XLSXImportWarningManager
  ) {
    super(chartFile, xlsxStructure, warningManager);
  }

  extractChart(): ExcelChartDefinition {
    return this.mapOnElements(
      { document: this.rootFile.file, query: "c:chartSpace" },
      (rootChartElement): ExcelChartDefinition => {
        const chartType = this.getChartType(rootChartElement);
        if (!CHART_TYPE_CONVERSION_MAP[chartType]) {
          throw new Error(_lt("Unsupported chart type %s", chartType));
        }

        // Title can be separated into multiple xml elements (for styling and such), we only import the text
        const chartTitle = this.mapOnElements(
          { parent: rootChartElement, query: "c:title a:t" },
          (textElement): string => {
            return textElement.textContent || "";
          }
        ).join("");

        return {
          title: chartTitle,
          type: CHART_TYPE_CONVERSION_MAP[chartType]!,
          dataSets: this.extractChartdatasets(
            this.querySelector(rootChartElement, `c:${chartType}`)!
          ),
          backgroundColor: this.extractChildAttr(
            rootChartElement,
            "c:chartSpace > c:spPr a:srgbClr",
            "val",
            {
              default: "ffffff",
            }
          ).asString()!,
          verticalAxisPosition:
            this.extractChildAttr(rootChartElement, "c:valAx > c:axPos", "val", {
              default: "l",
            }).asString() === "r"
              ? "right"
              : "left",
          legendPosition:
            DRAWING_LEGEND_POSITION_CONVERSION_MAP[
              this.extractChildAttr(rootChartElement, "c:legendPos", "val", {
                default: "b",
              }).asString()!
            ],
          stackedBar: true,
        };
      }
    )[0];
  }

  private extractChartdatasets(chartElement: Element): ExcelChartDataset[] {
    return this.mapOnElements(
      { parent: chartElement, query: "c:ser" },
      (chartDataElement): ExcelChartDataset => {
        return {
          label: this.extractChildTextContent(chartDataElement, "c:cat c:f"),
          range: this.extractChildTextContent(chartDataElement, "c:val c:f", { required: true })!,
        };
      }
    );
  }

  /**
   * The chart type in the XML isn't explicitely defined, but there is an XML element that define the
   * chart, and this element tag name tells us which type of chart it is. We just need to find this XML element.
   */
  private getChartType(chartElement: Element): XLSXChartType {
    const plotAreaElement = this.querySelector(chartElement, "c:plotArea");
    if (!plotAreaElement) {
      throw new Error(_lt("Missing plot area in the chart definition."));
    }
    for (let child of plotAreaElement.children) {
      const tag = removeNamespaces(child.tagName);
      if (XLSX_CHART_TYPES.some((chartType) => chartType === tag)) {
        return tag as XLSXChartType;
      }
    }
    throw new Error(_lt("Unknown chart type"));
  }
}
