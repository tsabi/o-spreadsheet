import { Component, useEffect, useState } from "@odoo/owl";
import { createRange, zoneToXc } from "../../../../helpers";
import { createDataSets } from "../../../../helpers/figures/charts";
import { BarChartDefinition } from "../../../../types/chart/bar_chart";
import { LineChartDefinition } from "../../../../types/chart/line_chart";
import { PieChartDefinition } from "../../../../types/chart/pie_chart";
import { CommandResult, DispatchResult, SpreadsheetChildEnv, UID } from "../../../../types/index";
import { SelectionInput } from "../../../selection_input/selection_input";
import { ChartTerms } from "../../../translations_terms";

interface Props {
  figureId: UID;
  definition: LineChartDefinition | BarChartDefinition | PieChartDefinition;
  updateChart: (
    definition: Partial<LineChartDefinition | BarChartDefinition | PieChartDefinition>
  ) => DispatchResult;
}

interface ChartPanelState {
  datasetDispatchResult?: DispatchResult;
  labelsDispatchResult?: DispatchResult;
  headerPosition?: {
    direction: "row" | "column";
    index: number | string;
  };
}

export class LineBarPieConfigPanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-LineBarPieConfigPanel";
  static components = { SelectionInput };

  private state: ChartPanelState = useState({
    datasetDispatchResult: undefined,
    labelsDispatchResult: undefined,
    headerPosition: {
      direction: "row",
      index: 1,
    },
  });

  private dataSeriesRanges: string[] = [];
  private labelRange: string | undefined;

  setup() {
    this.dataSeriesRanges = this.props.definition.dataSets;
    this.labelRange = this.props.definition.labelRange;

    useEffect(
      () => {
        this.state.headerPosition = this.calculateHeaderPosition();
      },
      () => [this.state.datasetDispatchResult, this.state.labelsDispatchResult]
    );
  }

  get errorMessages(): string[] {
    const cancelledReasons = [
      ...(this.state.datasetDispatchResult?.reasons || []),
      ...(this.state.labelsDispatchResult?.reasons || []),
    ];
    return cancelledReasons.map(
      (error) => ChartTerms.Errors[error] || ChartTerms.Errors.Unexpected
    );
  }

  get isDatasetInvalid(): boolean {
    return !!this.state.datasetDispatchResult?.isCancelledBecause(CommandResult.InvalidDataSet);
  }

  get isLabelInvalid(): boolean {
    return !!this.state.labelsDispatchResult?.isCancelledBecause(CommandResult.InvalidLabelRange);
  }

  onUpdateDataSetsHaveTitle(ev) {
    this.props.updateChart({
      dataSetsHaveTitle: ev.target.checked,
    });
  }

  /**
   * Change the local dataSeriesRanges. The model should be updated when the
   * button "confirm" is clicked
   */
  onDataSeriesRangesChanged(ranges: string[]) {
    this.dataSeriesRanges = ranges;
  }

  onDataSeriesConfirmed() {
    this.state.datasetDispatchResult = this.props.updateChart({
      dataSets: this.dataSeriesRanges,
    });
  }

  /**
   * Change the local labelRange. The model should be updated when the
   * button "confirm" is clicked
   */
  onLabelRangeChanged(ranges: string[]) {
    this.labelRange = ranges[0];
  }

  onLabelRangeConfirmed() {
    this.state.labelsDispatchResult = this.props.updateChart({
      labelRange: this.labelRange,
    });
  }

  calculateHeaderPosition(): typeof this.state.headerPosition {
    if (this.isDatasetInvalid || this.isLabelInvalid) {
      return {
        index: 1,
        direction: "row" as const,
      };
    }
    const sheetId = this.env.model.getters.getActiveSheetId();
    const getters = this.env.model.getters;
    const labelRange = createRange(getters, sheetId, this.labelRange);
    const dataSets = createDataSets(
      getters,
      this.dataSeriesRanges,
      sheetId,
      this.props.definition.dataSetsHaveTitle
    );
    let headerDirection: "row" | "column" = "row";
    if (
      (dataSets.length && dataSets[0].dataRange.zone.right > dataSets[0].dataRange.zone.left) ||
      (dataSets.length === 0 && labelRange && labelRange.zone.right > labelRange.zone.left)
    ) {
      headerDirection = "column";
    }
    let headerIndex: number | string = headerDirection === "row" ? 1 : "A";
    if (dataSets.length) {
      if (headerDirection === "row") {
        headerIndex = dataSets[0].dataRange.zone.top + 1;
      } else {
        headerIndex = zoneToXc(dataSets[0].dataRange.zone)[0];
      }
    } else if (labelRange) {
      if (headerDirection === "row") {
        headerIndex = labelRange.zone.top + 1;
      } else {
        headerIndex = zoneToXc(labelRange.zone)[0];
      }
    }
    return {
      index: headerIndex,
      direction: headerDirection,
    };
  }
}

LineBarPieConfigPanel.props = {
  figureId: String,
  definition: Object,
  updateChart: Function,
};
