import { Command, Position } from "../../types/index";
import { UIPlugin } from "../ui_plugin";

export class UIOptionsPlugin extends UIPlugin {
  static getters = ["shouldShowFormulas", "getActiveFilterPosition"] as const;
  private showFormulas: boolean = false;
  private usedFilterPosition: Position | undefined;

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  handle(cmd: Command) {
    switch (cmd.type) {
      case "SET_FORMULA_VISIBILITY":
        this.showFormulas = cmd.show;
        break;
      case "SET_CURRENT_USED_FILTER":
        this.usedFilterPosition = { col: cmd.col, row: cmd.row };
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  shouldShowFormulas(): boolean {
    return this.showFormulas;
  }

  getActiveFilterPosition(): Position | undefined {
    return this.usedFilterPosition;
  }
}
