import { FILTER_ICON_MARGIN, ICON_EDGE_LENGTH, PADDING_AUTORESIZE } from "../../constants";
import { computeCfIconWidth, computeTextWidth, positions } from "../../helpers/index";
import { Cell, CellValueType, Command, CommandResult, UID } from "../../types";
import { HeaderIndex, Position } from "../../types/misc";
import { UIPlugin } from "../ui_plugin";

export class SheetUIPlugin extends UIPlugin {
  static getters = ["getCellWidth", "getTextWidth", "getCellText"] as const;

  private ctx = document.createElement("canvas").getContext("2d")!;

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: Command): CommandResult {
    switch (cmd.type) {
      case "AUTORESIZE_ROWS":
      case "AUTORESIZE_COLUMNS":
        try {
          this.getters.getSheet(cmd.sheetId);
          break;
        } catch (error) {
          return CommandResult.InvalidSheetId;
        }
    }
    return CommandResult.Success;
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "AUTORESIZE_COLUMNS":
        for (let col of cmd.cols) {
          const size = this.getColMaxWidth(cmd.sheetId, col);
          if (size !== 0) {
            this.dispatch("RESIZE_COLUMNS_ROWS", {
              elements: [col],
              dimension: "COL",
              size: size + 2 * PADDING_AUTORESIZE,
              sheetId: cmd.sheetId,
            });
          }
        }
        break;
      case "AUTORESIZE_ROWS":
        for (let row of cmd.rows) {
          this.dispatch("RESIZE_COLUMNS_ROWS", {
            elements: [row],
            dimension: "ROW",
            size: null,
            sheetId: cmd.sheetId,
          });
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getCellWidth(sheetId: UID, { col, row }: Position): number {
    let width = 0;
    const cell = this.getters.getCell(sheetId, col, row);
    if (cell) {
      width += this.getTextWidth(cell);
    }
    const cfIcon = this.getters.getConditionalIcon(col, row);
    if (cfIcon) {
      width += computeCfIconWidth(this.ctx, this.getters.getCellStyle(cell));
    }
    const isFilterHeader = this.getters.isFilterHeader(sheetId, col, row);
    if (isFilterHeader) {
      width += ICON_EDGE_LENGTH + FILTER_ICON_MARGIN;
    }
    return width;
  }

  getTextWidth(cell: Cell): number {
    const text = this.getters.getCellText(cell, this.getters.shouldShowFormulas());
    return computeTextWidth(this.ctx, text, this.getters.getCellStyle(cell));
  }

  getCellText(cell: Cell, showFormula: boolean = false): string {
    if (showFormula && (cell.isFormula() || cell.evaluated.type === CellValueType.error)) {
      return cell.content;
    } else {
      return cell.formattedValue;
    }
  }

  // ---------------------------------------------------------------------------
  // Grid manipulation
  // ---------------------------------------------------------------------------

  private getColMaxWidth(sheetId: UID, index: HeaderIndex): number {
    const cellsPositions = positions(this.getters.getColsZone(sheetId, index, index));
    const sizes = cellsPositions.map((position) => this.getCellWidth(sheetId, position));
    return Math.max(0, ...sizes);
  }
}
