import { Component, useExternalListener, useSubEnv } from "@odoo/owl";
import { Model } from "../../model";
import { SpreadsheetChildEnv, WorkbookData } from "../../types";
import { css } from "../helpers/css";

// -----------------------------------------------------------------------------
// SpreadSheet
// -----------------------------------------------------------------------------

css/* scss */ `
  .o-spreadsheet {
    position: relative;
    * {
      font-family: "Roboto", "RobotoDraft", Helvetica, Arial, sans-serif;
    }
    &,
    *,
    *:before,
    *:after {
      box-sizing: content-box;
    }
  }
`;

export interface SpreadsheetProps {
  model: Model;
  onUnexpectedRevisionId?: () => void;
  onContentSaved?: (data: WorkbookData) => void;
}

const t = (s: string): string => s;

export class Dashboard extends Component<SpreadsheetProps, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-Dashboard";
  static components = {};
  static _t = t;

  model!: Model;

  setup() {
    this.model = this.props.model;

    useSubEnv({
      model: this.model,
      isDashboard: () => this.model.getters.isDashboard(),
      _t: Dashboard._t,
      clipboard: navigator.clipboard,
    });
    useExternalListener(window as any, "resize", () => this.render(true));
    useExternalListener(document.body, "keyup", this.onKeyup.bind(this));
  }

  get gridOverlayStyle() {
    return `
      top: ${0}px;
      left: ${0}px;
      height: calc(100% - ${0}px);
      width: calc(100% - ${0}px);
    `;
  }

  onMouseDown(ev: MouseEvent) {
    if (ev.button > 0) {
      // not main button, probably a context menu
      return;
    }
    const [col, row] = this.getCartesianCoordinates(ev);
    if (col < 0 || row < 0) {
      return;
    }
    this.env.model.selection.selectCell(col, row);
  }
}
