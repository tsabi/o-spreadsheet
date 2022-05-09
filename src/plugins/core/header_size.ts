import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from "../../constants";
import { deepCopy } from "../../helpers";
import {
  AddColumnsRowsCommand,
  Command,
  ExcelWorkbookData,
  RemoveColumnsRowsCommand,
  ResizeColumnsRowsCommand,
  WorkbookData,
} from "../../types";
import { Dimension, HeaderDisplayInfo, SheetId } from "../../types/misc";
import { CorePlugin } from "../core_plugin";

export class HeaderSizePlugin extends CorePlugin {
  static getters = [
    "getRowSize",
    "getColSize",
    "getColInfo",
    "getRowInfo",
    "getColsInfo",
    "getRowsInfo",
  ] as const;

  private readonly headerSizes: Record<SheetId, Record<Dimension, Array<HeaderDisplayInfo>>> = {};
  private userHeaderSizes: Record<SheetId, Record<Dimension, Array<number | undefined>>> = {};

  handle(cmd: Command) {
    switch (cmd.type) {
      case "CREATE_SHEET":
        this.history.update("userHeaderSizes", cmd.sheetId, { COL: [], ROW: [] });
        this.initSheet(cmd.sheetId);
        break;
      case "DUPLICATE_SHEET":
        this.history.update(
          "userHeaderSizes",
          cmd.sheetIdTo,
          deepCopy(this.userHeaderSizes[cmd.sheetId])
        );
        this.initSheet(cmd.sheetIdTo);
        break;
      case "DELETE_SHEET":
        this.history.update("headerSizes", cmd.sheetId, undefined);
        this.history.update("userHeaderSizes", cmd.sheetId, undefined);
        break;
      case "REMOVE_COLUMNS_ROWS": {
        const newSizeArray = [...this.userHeaderSizes[cmd.sheetId][cmd.dimension]];
        for (let el of [...cmd.elements].sort().reverse()) {
          newSizeArray.splice(el, 1);
        }
        this.history.update("userHeaderSizes", cmd.sheetId, cmd.dimension, newSizeArray);
        this.updateHeadersOnDeletion(cmd);
        break;
      }
      case "ADD_COLUMNS_ROWS": {
        const newSizeArray = [...this.userHeaderSizes[cmd.sheetId][cmd.dimension]];
        const addIndex = this.getAddHeaderStartIndex(cmd.position, cmd.base);
        const baseSize = newSizeArray[addIndex];
        for (let i = 0; i < cmd.quantity; i++) {
          newSizeArray.splice(addIndex, 0, baseSize);
        }
        this.history.update("userHeaderSizes", cmd.sheetId, cmd.dimension, newSizeArray);
        this.updateHeadersOnAddition(cmd);
        break;
      }
      case "UNHIDE_COLUMNS_ROWS":
      case "HIDE_COLUMNS_ROWS":
        const headers = this.computeStartEnd(cmd.sheetId, cmd.dimension);
        this.history.update("headerSizes", cmd.sheetId, cmd.dimension, headers);
        break;
      case "RESIZE_COLUMNS_ROWS":
        for (let el of cmd.elements) {
          this.history.update("userHeaderSizes", cmd.sheetId, cmd.dimension, el, cmd.size);
        }
        this.updateHeadersOnResize(cmd);
        break;
    }
    return;
  }

  getColSize(sheetId: SheetId, index: number): number {
    return this.headerSizes[sheetId]["COL"][index].size;
  }

  getRowSize(sheetId: SheetId, index: number): number {
    return this.headerSizes[sheetId]["ROW"][index].size;
  }

  getColInfo(sheetId: SheetId, index: number): HeaderDisplayInfo {
    return this.headerSizes[sheetId]["COL"][index];
  }

  getRowInfo(sheetId: SheetId, index: number): HeaderDisplayInfo {
    return this.headerSizes[sheetId]["ROW"][index];
  }

  getColsInfo(sheetId: SheetId): HeaderDisplayInfo[] {
    return this.headerSizes[sheetId]["COL"];
  }

  getRowsInfo(sheetId: SheetId): HeaderDisplayInfo[] {
    return this.headerSizes[sheetId]["ROW"];
  }

  private getHeaderSize(sheetId: SheetId, dimension: Dimension, index: number): number {
    return (
      this.userHeaderSizes[sheetId]?.[dimension]?.[index] ||
      this.headerSizes[sheetId]?.[dimension]?.[index]?.size ||
      this.getDefaultHeaderSize(dimension)
    );
  }

  private initSheet(sheetId: SheetId) {
    const sizes: Record<Dimension, Array<HeaderDisplayInfo>> = { COL: [], ROW: [] };
    for (let i = 0; i < this.getters.getNumberCols(sheetId); i++) {
      sizes.COL.push({
        size: this.getHeaderSize(sheetId, "COL", i),
        start: 0,
        end: 0,
      });
    }
    sizes.COL = this.computeStartEnd(sheetId, "COL", sizes.COL);

    for (let i = 0; i < this.getters.getNumberRows(sheetId); i++) {
      sizes.ROW.push({
        size: this.getHeaderSize(sheetId, "ROW", i),
        start: 0,
        end: 0,
      });
    }
    sizes.ROW = this.computeStartEnd(sheetId, "ROW", sizes.ROW);

    this.history.update("headerSizes", sheetId, sizes);
  }

  private getDefaultHeaderSize(dimension: Dimension): number {
    return dimension === "COL" ? DEFAULT_CELL_WIDTH : DEFAULT_CELL_HEIGHT;
  }

  private updateHeadersOnResize({
    sheetId,
    elements: resizedHeaders,
    dimension,
    size,
  }: ResizeColumnsRowsCommand) {
    let newHeaders = deepCopy(this.headerSizes[sheetId][dimension]);
    for (let headerIndex of resizedHeaders) {
      if (!newHeaders[headerIndex]) {
        newHeaders[headerIndex] = { size, end: 0, start: 0 };
      } else {
        newHeaders[headerIndex].size = size;
      }
    }
    newHeaders = this.computeStartEnd(sheetId, dimension, newHeaders);

    this.history.update("headerSizes", sheetId, dimension, newHeaders);
  }

  /** On header deletion command, remove deleted headers and update start-end of the others  */
  private updateHeadersOnDeletion({
    sheetId,
    elements: deletedHeaders,
    dimension,
  }: RemoveColumnsRowsCommand) {
    let headers: HeaderDisplayInfo[] = [];
    for (let [index, header] of this.headerSizes[sheetId][dimension].entries()) {
      if (deletedHeaders.includes(index)) {
        continue;
      }
      headers.push({ ...header });
    }

    headers = this.computeStartEnd(sheetId, dimension, headers);
    this.history.update("headerSizes", sheetId, dimension, headers);
  }

  /** On header addition command, add new headers and update start-end of all the headers  */
  private updateHeadersOnAddition({
    sheetId,
    dimension,
    base,
    quantity,
    position,
  }: AddColumnsRowsCommand) {
    // Add headers in the list
    let headers = deepCopy(this.headerSizes[sheetId][dimension]);
    const startIndex = this.getAddHeaderStartIndex(position, base);
    const size = this.getHeaderSize(sheetId, dimension, base);
    for (let i = 0; i < quantity; i++) {
      headers.splice(startIndex, 0, { size, start: 0, end: 0 });
    }

    headers = this.computeStartEnd(sheetId, dimension, headers);

    this.history.update("headerSizes", sheetId, dimension, headers);
  }

  /** Update the start-end of the given list of headers using the current sheet state  */
  private computeStartEnd(
    sheetId: SheetId,
    dimension: Dimension,
    headers: HeaderDisplayInfo[] = [...this.headerSizes[sheetId][dimension]]
  ): HeaderDisplayInfo[] {
    const newHeaders: HeaderDisplayInfo[] = [];
    let start = 0;
    for (let [index, header] of headers.entries()) {
      const isHidden =
        dimension === "COL"
          ? this.getters.tryGetCol(sheetId, index)?.isHidden
          : this.getters.tryGetRow(sheetId, index)?.isHidden;
      const size = headers[index].size;
      const end = isHidden ? start : start + size;
      newHeaders.push({ ...header, start, end });
      start = end;
    }

    return newHeaders;
  }

  /** Get index of first header added by an ADD_COLUMNS_ROWS command */
  private getAddHeaderStartIndex(position: "before" | "after", base: number): number {
    return position === "after" ? base + 1 : base;
  }

  import(data: WorkbookData) {
    for (let sheet of data.sheets) {
      this.userHeaderSizes[sheet.id] = { COL: [], ROW: [] };
      for (let [rowIndex, row] of Object.entries(sheet.rows)) {
        if (row.size) {
          this.userHeaderSizes[sheet.id]["ROW"][rowIndex] = row.size;
        }
      }

      for (let [colIndex, col] of Object.entries(sheet.cols)) {
        if (col.size) {
          this.userHeaderSizes[sheet.id]["COL"][colIndex] = col.size;
        }
      }
      this.initSheet(sheet.id);
    }
    return;
  }

  exportForExcel(data: ExcelWorkbookData) {
    this.exportData(data, true);
  }

  export(data: WorkbookData) {
    this.exportData(data);
  }

  exportData(data: WorkbookData, exportDefaults = false) {
    for (let sheet of data.sheets) {
      // Export row sizes
      if (sheet.rows === undefined) {
        sheet.rows = {};
      }
      for (let row = 0; row < this.getters.getNumberRows(sheet.id); row++) {
        if (exportDefaults || this.userHeaderSizes[sheet.id]["ROW"][row]) {
          if (sheet.rows[row] === undefined) {
            sheet.rows[row] = {};
          }
          sheet.rows[row].size = this.getRowSize(sheet.id, row);
        }
      }

      // Export col sizes
      if (sheet.cols === undefined) {
        sheet.cols = {};
      }
      for (let col = 0; col < this.getters.getNumberCols(sheet.id); col++) {
        if (exportDefaults || this.userHeaderSizes[sheet.id]["COL"][col]) {
          if (sheet.cols[col] === undefined) {
            sheet.cols[col] = {};
          }
          sheet.cols[col].size = this.getColSize(sheet.id, col);
        }
      }
    }
  }
}
