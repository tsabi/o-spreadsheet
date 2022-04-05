import { Component, onWillUpdateProps, useState, xml } from "@odoo/owl";
import { ChartType, SpreadsheetChildEnv, UID } from "../../../types";
import { ChartTerms } from "../../translations_terms";

const TEMPLATE = xml/* xml */ `
    <select t-model="state.chartType" class="o-input o-type-selector" t-on-change="(ev) => this.updateChartType(ev.target.value)">
        <option value="bar" t-esc="env._t('${ChartTerms.Bar}')"/>
        <option value="line" t-esc="env._t('${ChartTerms.Line}')"/>
        <option value="pie" t-esc="env._t('${ChartTerms.Pie}')"/>
        <option value="scorecard" t-esc="env._t('${ChartTerms.Scorecard}')"/>
    </select>
`;

interface Props {
  figureId: UID;
}

interface State {
  chartType: ChartType | undefined;
}

export class ChartTypeSelect extends Component<Props, SpreadsheetChildEnv> {
  static template = TEMPLATE;
  static components = {};

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
