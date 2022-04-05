import { Component, onWillUpdateProps, useState } from "@odoo/owl";
import { ChartType, SpreadsheetChildEnv, UID } from "../../../../types";

interface Props {
  figureId: UID;
}

interface State {
  chartType: ChartType | undefined;
}

export class ChartTypeSelect extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet.ChartTypeSelect";

  state: State = useState({ chartType: this.env.model.getters.getChartType(this.props.figureId) });

  setup() {
    onWillUpdateProps(() => {
      this.state.chartType = this.env.model.getters.getChartType(this.props.figureId);
    });
  }

  updateChartType(type: ChartType) {
    this.env.model.dispatch("UPDATE_CHART", {
      id: this.props.figureId,
      sheetId: this.env.model.getters.getActiveSheetId(),
      definition: { type },
    });
  }
}
