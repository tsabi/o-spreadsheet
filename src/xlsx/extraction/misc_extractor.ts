import { XLSXColorScheme, XLSXFileStructure, XLSXImportFile, XLSXTheme } from "../../types/xlsx";
import { AUTO_COLOR } from "../constants";
import { XLSXImportWarningManager } from "../helpers/xlsx_parser_error_manager";
import { XlsxBaseExtractor } from "./base_extractor";

/**
 * XLSX Extractor class that can be used for either sharedString XML files or theme XML files.
 *
 * Since they both are quite simple, it make sense to make a single class to manage them all, to avoid unecessary file
 * cluttering.
 */
export class XlsxMiscExtractor extends XlsxBaseExtractor {
  constructor(
    file: XLSXImportFile,
    xlsxStructure: XLSXFileStructure,
    warningManager: XLSXImportWarningManager
  ) {
    super(file, xlsxStructure, warningManager);
  }

  getTheme(): XLSXTheme {
    const clrScheme = this.mapOnElements(
      { query: "a:clrScheme", document: this.rootFile.file, children: true },
      (element): XLSXColorScheme => {
        return {
          name: element.tagName,
          value: this.extractChildAttr(element, 0, "val", {
            required: true,
            default: AUTO_COLOR,
          }).asString()!,
          lastClr: this.extractChildAttr(element, 0, "lastClr", {
            default: AUTO_COLOR,
          }).asString(),
        };
      }
    );
    return { clrScheme };
  }

  /**
   * Get the array of shared strings of the XLSX.
   *
   * Worth noting that running a prettier on the xml can mess up some strings, since there is an option in the
   * xmls to keep the spacing and not trim the string.
   */
  getSharedStrings(): string[] {
    return this.mapOnElements(
      { document: this.rootFile.file, query: "si" },
      (ssElement): string => {
        // Shared string can either be a simple text, or a rich text (text with formatting, possibly in multiple parts)
        if (ssElement.children[0].tagName === "t") {
          return this.extractTextContent(ssElement) || "";
        }
        // We don't support rich text formatting, we'll only extract the text
        else {
          return this.mapOnElements({ parent: ssElement, query: "t" }, (textElement): string => {
            return this.extractTextContent(textElement) || "";
          }).join("");
        }
      }
    );
  }
}
