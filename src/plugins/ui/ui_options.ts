import { Command } from "../../types/index";
import { UIPlugin } from "../ui_plugin";

export class UIOptionsPlugin extends UIPlugin {
  static getters = ["shouldShowFormulas", "isFrozen"] as const;
  private showFormulas: boolean = false;

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  handle(cmd: Command) {
    switch (cmd.type) {
      case "SET_FORMULA_VISIBILITY":
        this.showFormulas = cmd.show;
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  shouldShowFormulas(): boolean {
    return this.showFormulas;
  }

  isFrozen(): boolean {
    const panes = this.getters.getPaneDivisions(this.getters.getActiveSheetId());
    return panes.vertical > 0 || panes.horizontal > 0;
  }
}
