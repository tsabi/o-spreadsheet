import { getFormulaNameAndArgs } from "../../helpers/pivot";
import { CellType, Command, Pivot, UID, WorkbookData } from "../../types";
import { CorePlugin } from "../core_plugin";

interface PivotState {
  pivots: Record<UID, Pivot>;
}

export class PivotPlugin extends CorePlugin<PivotState> implements PivotState {
  static getters = ["getPivot", "getPivots", "getPivotFromPosition"];

  readonly pivots: PivotState["pivots"] = {};

  /**
   * Handle a spreadsheet command
   */
  handle(cmd: Command) {
    switch (cmd.type) {
      case "ADD_PIVOT":
        this.history.update("pivots", cmd.pivotId, cmd.data);
        break;
    }
  }

  // ---------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------

  /**
   * Retrieve the pivot associated to the given Id
   */
  getPivot(pivotId: UID): Pivot {
    return this.pivots[pivotId];
  }

  /**
   * Retrieve all the pivots
   */
  getPivots(): Pivot[] {
    return Object.values(this.pivots);
  }

  getPivotFromPosition(sheetId: UID, col: number, row: number) {
    const cell = this.getters.getCell(sheetId, col, row);
    if (cell && cell.type === CellType.formula && cell.formula.text.startsWith("=PIVOT")) {
      const { args } = getFormulaNameAndArgs(cell.formula.text);
      return args[0];
    }
    return undefined;
  }
  // ---------------------------------------------------------------------
  // Import/Export
  // ---------------------------------------------------------------------

  import(data: WorkbookData) {
    if (data.pivots) {
      this.history.update("pivots", data.pivots);
    }
  }

  export(data: WorkbookData) {
    data.pivots = JSON.parse(JSON.stringify(this.pivots));
    for (const id in data.pivots) {
      data.pivots[id].computedDomain = undefined;
      data.pivots[id].cache = undefined;
      data.pivots[id].lastUpdate = undefined;
      data.pivots[id].isLoaded = false;
    }
  }
}
