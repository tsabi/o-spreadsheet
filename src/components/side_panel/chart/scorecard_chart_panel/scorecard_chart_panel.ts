import { Component, onWillUpdateProps, useState } from "@odoo/owl";
import {
  CommandResult,
  DispatchResult,
  Figure,
  ScorecardChartUIDefinition,
  ScorecardChartUIDefinitionUpdate,
  SpreadsheetChildEnv,
} from "../../../../types/index";
import { SelectionInput } from "../../../selection_input/selection_input";
import { ChartTerms } from "../../../translations_terms";
import { ChartTypeSelect } from "../chart_type_selection/chart_type_selection";

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
  static template = "o-spreadsheet.ScorecardChartPanel";
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
