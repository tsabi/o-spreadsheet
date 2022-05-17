import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH } from "../../constants";
import { deepCopy, getDefaultCellHeight } from "../../helpers";
import {
  AddColumnsRowsCommand,
  Cell,
  Command,
  ExcelWorkbookData,
  RemoveColumnsRowsCommand,
  ResizeColumnsRowsCommand,
  WorkbookData,
} from "../../types";
import { Dimension, HeaderDisplayInfo, SheetId, UID } from "../../types/misc";
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
  private tallestCellInRows: Record<SheetId, Array<UID | undefined>> = {};

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
      case "UPDATE_CELL":
        if (
          this.headerSizes[cmd.sheetId]?.["ROW"]?.[cmd.row] &&
          !this.userHeaderSizes[cmd.sheetId]?.["ROW"]?.[cmd.row]
        ) {
          this.adjustRowSizeWithCellFont(cmd.sheetId, cmd.col, cmd.row);
        }
        break;
      case "ADD_MERGE":
      case "REMOVE_MERGE":
        for (let target of cmd.target) {
          for (let row = target.top; row <= target.bottom; row++) {
            const { height: rowHeight, cell: tallestCell } = this.getRowMaxHeight(cmd.sheetId, row);
            this.history.update("tallestCellInRows", cmd.sheetId, row, tallestCell?.id);
            if (rowHeight !== this.getRowSize(cmd.sheetId, row)) {
              let newRows = deepCopy(this.headerSizes[cmd.sheetId]["ROW"]);
              newRows[row].size = rowHeight;
              newRows = this.computeStartEnd(cmd.sheetId, "ROW", newRows);
              this.history.update("headerSizes", cmd.sheetId, "ROW", newRows);
            }
          }
        }
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

  /**
   * Change the size of a row to match the cell with the biggest font size.
   */
  private adjustRowSizeWithCellFont(sheetId: UID, col: number, row: number) {
    const currentCell = this.getters.getCell(sheetId, col, row);
    const currentRowSize = this.getRowSize(sheetId, row);
    const newCellHeight = this.getCellHeight(sheetId, col, row);

    const tallestCell = this.tallestCellInRows[sheetId]?.[row];
    let shouldRowBeUpdated =
      !tallestCell ||
      !this.getters.tryGetCellById(tallestCell) || // tallest cell was deleted
      (currentCell?.id === tallestCell && newCellHeight < currentRowSize); // tallest cell is smaller than before;

    let newRowHeight: number | undefined = undefined;
    if (shouldRowBeUpdated) {
      const { height: maxHeight, cell: tallestCell } = this.getRowMaxHeight(sheetId, row);
      newRowHeight = maxHeight;
      this.history.update("tallestCellInRows", sheetId, row, tallestCell?.id);
    } else if (newCellHeight > currentRowSize) {
      newRowHeight = newCellHeight;
      const tallestCell = this.getters.getCell(sheetId, col, row);
      this.history.update("tallestCellInRows", sheetId, row, tallestCell?.id);
    }

    if (newRowHeight !== undefined && newRowHeight !== currentRowSize) {
      let newHeaders = deepCopy(this.headerSizes[sheetId]["ROW"]);
      newHeaders[row].size = newRowHeight;
      newHeaders = this.computeStartEnd(sheetId, "ROW", newHeaders);
      this.history.update("headerSizes", sheetId, "ROW", newHeaders);
    }
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
      let rowSize = this.userHeaderSizes[sheetId]["ROW"][i];
      if (!rowSize) {
        const { cell: tallestCell, height } = this.getRowMaxHeight(sheetId, i);
        rowSize = height;
        this.history.update("tallestCellInRows", sheetId, i, tallestCell?.id);
      }
      sizes.ROW.push({
        size: rowSize,
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
      if (!size) {
        if (dimension === "COL") {
          size = this.getDefaultHeaderSize("COL");
        } else {
          const { cell: tallestCell, height } = this.getRowMaxHeight(sheetId, headerIndex);
          size = height;
          this.history.update("tallestCellInRows", sheetId, headerIndex, tallestCell?.id);
        }
      }
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
    const tallestCells: Array<UID | undefined> = [];
    for (let [index, header] of this.headerSizes[sheetId][dimension].entries()) {
      if (deletedHeaders.includes(index)) {
        continue;
      }
      headers.push({ ...header });
      if (dimension === "ROW") {
        tallestCells.push(this.tallestCellInRows[sheetId][index]);
      }
    }

    headers = this.computeStartEnd(sheetId, dimension, headers);
    this.history.update("headerSizes", sheetId, dimension, headers);
    if (dimension === "ROW") {
      this.history.update("tallestCellInRows", sheetId, tallestCells);
    }
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
    const tallestCells = [...this.tallestCellInRows[sheetId]];
    const startIndex = this.getAddHeaderStartIndex(position, base);
    const size = this.getHeaderSize(sheetId, dimension, base);
    for (let i = 0; i < quantity; i++) {
      headers.splice(startIndex, 0, { size, start: 0, end: 0 });
      if (dimension === "ROW") {
        tallestCells.splice(startIndex, 0, undefined);
      }
    }

    headers = this.computeStartEnd(sheetId, dimension, headers);

    this.history.update("headerSizes", sheetId, dimension, headers);
    if (dimension === "ROW") {
      this.history.update("tallestCellInRows", sheetId, tallestCells);
    }
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

  /**
   * Return the height the cell should have in the sheet, which is either DEFAULT_CELL_HEIGHT if the cell is in a multi-row
   * merge, or the height of the cell computed based on its font size.
   */
  private getCellHeight(sheetId: SheetId, col: number, row: number) {
    const merge = this.getters.getMerge(sheetId, col, row);
    if (merge && merge.bottom !== merge.top) {
      return DEFAULT_CELL_HEIGHT;
    }
    const cell = this.getters.getCell(sheetId, col, row);
    return getDefaultCellHeight(cell);
  }

  /**
   * Get the max height of a row based on its cells.
   *
   * The max height of the row correspond to the cell with the biggest font size that has a content,
   * and that is not part of a multi-line merge.
   */
  private getRowMaxHeight(sheetId: SheetId, row: number): { cell?: Cell; height: number } {
    const cells = this.getters.getRowCells(sheetId, row);
    let maxHeight = 0,
      tallestCell: Cell | undefined = undefined;
    for (let i = 0; i < cells.length; i++) {
      const { col, row } = this.getters.getCellPosition(cells[i].id);
      const cellHeight = this.getCellHeight(sheetId, col, row);
      if (cellHeight > maxHeight && cellHeight > DEFAULT_CELL_HEIGHT) {
        maxHeight = cellHeight;
        tallestCell = cells[i];
      }
    }

    if (maxHeight <= DEFAULT_CELL_HEIGHT) {
      return { height: DEFAULT_CELL_HEIGHT };
    }
    return { cell: tallestCell, height: maxHeight };
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
