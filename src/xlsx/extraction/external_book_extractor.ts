import {
  XLSXExternalBook,
  XLSXExternalSheetData,
  XLSXFileStructure,
  XLSXImportFile,
} from "../../types/xlsx";
import { XLSXImportWarningManager } from "../helpers/xlsx_parser_error_manager";
import { XlsxBaseExtractor } from "./base_extractor";

export class XlsxExternalBookExtractor extends XlsxBaseExtractor {
  constructor(
    externalLinkFile: XLSXImportFile,
    xlsxStructure: XLSXFileStructure,
    warningManager: XLSXImportWarningManager
  ) {
    super(externalLinkFile, xlsxStructure, warningManager);
  }

  getExternalBook(): XLSXExternalBook {
    return this.mapOnElements(
      { document: this.rootFile.file, query: "externalBook" },
      (bookElement): XLSXExternalBook => {
        return {
          rId: this.extractAttr(bookElement, "r:id", { required: true }).asString()!,
          sheetNames: this.mapOnElements(
            { parent: bookElement, query: "sheetName" },
            (sheetNameElement): string => {
              return this.extractAttr(sheetNameElement, "val", { required: true }).asString()!;
            }
          ),
          datasets: this.extractExternalSheetData(bookElement),
        };
      }
    )[0];
  }

  private extractExternalSheetData(externalBookElement: Element): XLSXExternalSheetData[] {
    return this.mapOnElements(
      { parent: externalBookElement, query: "sheetData" },
      (sheetDataElement): XLSXExternalSheetData => {
        const cellsData = this.mapOnElements(
          { parent: sheetDataElement, query: "cell" },
          (cellElement) => {
            return {
              xc: this.extractAttr(cellElement, "r", { required: true }).asString()!,
              value: this.extractChildTextContent(cellElement, "v", { required: true })!,
            };
          }
        );

        const dataMap = {};
        for (let cell of cellsData) {
          dataMap[cell.xc] = cell.value;
        }

        return {
          sheetId: this.extractAttr(sheetDataElement, "sheetId", { required: true }).asNum()!,
          data: dataMap,
        };
      }
    );
  }
}
