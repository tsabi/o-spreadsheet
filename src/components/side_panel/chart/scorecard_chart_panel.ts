import { Component, onWillUpdateProps, useState, xml } from "@odoo/owl";
import {
  CommandResult,
  DispatchResult,
  Figure,
  ScorecardChartUIDefinition,
  ScorecardChartUIDefinitionUpdate,
  SpreadsheetChildEnv,
} from "../../../types/index";
import { SelectionInput } from "../../selection_input";
import { ChartTerms } from "../../translations_terms";
import { ChartTypeSelect } from "./chart_type_selection";

const CONFIGURATION_TEMPLATE = xml/* xml */ `
<div>
  <div class="o-section">
    <div class="o-section-title" t-esc="env._t('${ChartTerms.ChartType}')"/>
    <ChartTypeSelect figureId="this.props.figure.id"/>
  </div>
  <div class="o-section o-data-series">
    <div class="o-section-title" t-esc="env._t('${ChartTerms.KeyValue}')"/>
    <SelectionInput t-key="getKey('keyValue')"
                    ranges="[state.chart.keyValue]"
                    isInvalid="isKeyValueInvalid"
                    hasSingleRange="true"
                    required="true"
                    onSelectionChanged="(ranges) => this.onKeyValueRangeChanged(ranges)"
                    onSelectionConfirmed="() => this.updateKeyValueRange()" />
  </div>
  <div class="o-section o-data-labels">
    <div class="o-section-title" t-esc="env._t('${ChartTerms.BaselineValue}')"/>
    <SelectionInput t-key="getKey('baseline')"
                    ranges="[state.chart.baseline || '']"
                    isInvalid="isBaselineInvalid"
                    hasSingleRange="true"
                    onSelectionChanged="(ranges) => this.onBaselineRangeChanged(ranges)"
                    onSelectionConfirmed="() => this.updateBaselineRange()" />
  </div>
  <div class="o-section o-sidepanel-error" t-if="errorMessages">
    <div t-foreach="errorMessages" t-as="error" t-key="error">
      <t t-esc="error"/>
    </div>
  </div>
</div>
`;

const DESIGN_TEMPLATE = xml/* xml */ `
<div>
  <div class="o-section o-chart-title">
    <div class="o-section-title" t-esc="env._t('${ChartTerms.Title}')"/>
    <input type="text" t-model="state.chart.title" t-on-change="updateTitle" class="o-input" placeholder="${ChartTerms.TitlePlaceholder}"/>
  </div>
  <div class="o-section">
    <div class="o-section-title"><t t-esc="env._t('${ChartTerms.BaselineCompToKey}')"/></div>
    <select t-model="state.chart.baselineMode" class="o-input o-type-selector" t-on-change="(ev) => this.updateBaselineMode(ev)">
      <option value="absolute" t-esc="env._t('${ChartTerms.BaselineCompAbsolute}')"/>
      <option value="percentage" t-esc="env._t('${ChartTerms.BaselineCompPercentage}')"/>
    </select>
  </div>
  <div class="o-section">
    <div class="o-section-title"><t t-esc="env._t('${ChartTerms.BaselineDescr}')"/></div>
    <input type="text" t-model="state.chart.baselineDescr" t-on-change="updateBaselineDescr" class="o-input"/>
  </div>
</div>
`;

const TEMPLATE = xml/* xml */ `
  <div class="o-chart">
    <div class="o-panel">
      <div class="o-panel-element"
          t-att-class="state.panel !== 'configuration' ? 'inactive' : ''"
          t-on-click="() => this.activate('configuration')">
        <i class="fa fa-sliders"/>Configuration
      </div>
      <div class="o-panel-element"
          t-att-class="state.panel !== 'design' ? 'inactive' : ''"
          t-on-click="() => this.activate('design')">
        <i class="fa fa-paint-brush"/>Design
      </div>
    </div>

    <t t-if="state.panel === 'configuration'">
      <t t-call="${CONFIGURATION_TEMPLATE}"/>
    </t>
    <t t-else="">
      <t t-call="${DESIGN_TEMPLATE}"/>
    </t>
  </div>
`;

interface Props {
  figure: Figure;
  onCloseSidePanel: () => void;
}

interface PanelState {
  chart: ScorecardChartUIDefinition;
  keyValueDispatchResult?: DispatchResult;
  baselineDispatchResult?: DispatchResult;
  panel: "configuration" | "design";
}

export class ScorecardChartPanel extends Component<Props, SpreadsheetChildEnv> {
  static template = TEMPLATE;
  static components = { SelectionInput, ChartTypeSelect };

  private state: PanelState = useState(this.initialState(this.props.figure));

  setup() {
    onWillUpdateProps((nextProps: Props) => {
      if (!this.env.model.getters.isChartDefined(nextProps.figure.id)) {
        this.props.onCloseSidePanel();
        return;
      }
      if (nextProps.figure.id !== this.props.figure.id) {
        this.state.panel = "configuration";
        this.state.keyValueDispatchResult = undefined;
        this.state.baselineDispatchResult = undefined;
        this.state.chart = this.env.model.getters.getScorecardChartDefinitionUI(
          this.env.model.getters.getActiveSheetId(),
          nextProps.figure.id
        )!;
      }
    });
  }

  get errorMessages(): string[] {
    const cancelledReasons = [
      ...(this.state.keyValueDispatchResult?.reasons || []),
      ...(this.state.baselineDispatchResult?.reasons || []),
    ];
    return cancelledReasons.map(
      (error) => ChartTerms.Errors[error] || ChartTerms.Errors.Unexpected
    );
  }

  get isKeyValueInvalid(): boolean {
    return !!(
      this.state.keyValueDispatchResult?.isCancelledBecause(CommandResult.EmptyScorecardKeyValue) ||
      this.state.keyValueDispatchResult?.isCancelledBecause(CommandResult.InvalidScorecardKeyValue)
    );
  }

  get isBaselineInvalid(): boolean {
    return !!this.state.keyValueDispatchResult?.isCancelledBecause(
      CommandResult.InvalidScorecardBaseline
    );
  }

  onKeyValueRangeChanged(ranges: string[]) {
    this.state.chart.keyValue = ranges[0];
  }

  updateKeyValueRange() {
    this.state.keyValueDispatchResult = this.updateChart({
      keyValue: this.state.chart.keyValue || null,
    });
  }

  onBaselineRangeChanged(ranges: string[]) {
    this.state.chart.baseline = ranges[0];
  }

  updateBaselineRange() {
    this.state.baselineDispatchResult = this.updateChart({
      baseline: this.state.chart.baseline || null,
    });
  }

  updateTitle() {
    this.updateChart({ title: this.state.chart.title });
  }

  updateBaselineDescr() {
    this.updateChart({ baselineDescr: this.state.chart.baselineDescr });
  }

  updateBaselineMode(ev) {
    this.updateChart({ baselineMode: ev.target.value });
  }

  private updateChart(definition: ScorecardChartUIDefinitionUpdate): DispatchResult {
    return this.env.model.dispatch("UPDATE_CHART", {
      id: this.props.figure.id,
      sheetId: this.env.model.getters.getActiveSheetId(),
      definition,
    });
  }

  getKey(label: string) {
    return label + this.props.figure.id;
  }

  activate(panel: "configuration" | "design") {
    this.state.panel = panel;
  }

  private initialState(figure: Figure): PanelState {
    return {
      chart: this.env.model.getters.getScorecardChartDefinitionUI(
        this.env.model.getters.getActiveSheetId(),
        figure.id
      )!,
      panel: "configuration",
    };
  }
}
