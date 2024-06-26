import { Component, useState } from "@odoo/owl";
import { deepCopy } from "../../../../helpers/index";
import { _t } from "../../../../translation";
import { GaugeChartDefinition, SectionRule } from "../../../../types/chart/gauge_chart";
import {
  Color,
  CommandResult,
  DispatchResult,
  SpreadsheetChildEnv,
  UID,
} from "../../../../types/index";
import { css } from "../../../helpers/css";
import { ChartTerms } from "../../../translations_terms";
import { Section } from "../../components/section/section";
import { ChartErrorSection } from "../building_blocks/error_section/error_section";
import { ChartTitle } from "../building_blocks/title/title";
import { RoundColorPicker } from "./../../components/round_color_picker/round_color_picker";

css/* scss */ `
  .o-gauge-color-set {
    table {
      table-layout: fixed;
      margin-top: 2%;
      display: table;
      text-align: left;
      font-size: 12px;
      line-height: 18px;
      width: 100%;
    }
    td {
      box-sizing: border-box;
      height: 30px;
    }
    th.o-gauge-color-set-colorPicker {
      width: 8%;
    }
    th.o-gauge-color-set-text {
      width: 40%;
    }
    th.o-gauge-color-set-value {
      width: 22%;
    }
    th.o-gauge-color-set-type {
      width: 30%;
    }
    input,
    select {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
  }
`;

interface Props {
  figureId: UID;
  definition: GaugeChartDefinition;
  canUpdateChart: (figureId: UID, definition: Partial<GaugeChartDefinition>) => DispatchResult;
  updateChart: (figureId: UID, definition: Partial<GaugeChartDefinition>) => DispatchResult;
}

interface PanelState {
  sectionRuleDispatchResult?: DispatchResult;
  sectionRule: SectionRule;
}

export class GaugeChartDesignPanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-GaugeChartDesignPanel";
  static components = {
    ChartErrorSection,
    RoundColorPicker,
    ChartTitle,
    Section,
  };
  static props = {
    figureId: String,
    definition: Object,
    updateChart: Function,
    canUpdateChart: Function,
  };

  private state: PanelState = useState({
    openedMenu: undefined,
    sectionRuleDispatchResult: undefined,
    sectionRule: deepCopy(this.props.definition.sectionRule),
  });

  get title() {
    return _t(this.props.definition.title);
  }

  get designErrorMessages(): string[] {
    const cancelledReasons = [...(this.state.sectionRuleDispatchResult?.reasons || [])];
    return cancelledReasons.map(
      (error) => ChartTerms.Errors[error] || ChartTerms.Errors.Unexpected
    );
  }

  updateBackgroundColor(color: Color) {
    this.props.updateChart(this.props.figureId, {
      background: color,
    });
  }

  updateTitle(title: string) {
    this.props.updateChart(this.props.figureId, { title });
  }

  isRangeMinInvalid() {
    return !!(
      this.state.sectionRuleDispatchResult?.isCancelledBecause(CommandResult.EmptyGaugeRangeMin) ||
      this.state.sectionRuleDispatchResult?.isCancelledBecause(CommandResult.GaugeRangeMinNaN) ||
      this.state.sectionRuleDispatchResult?.isCancelledBecause(
        CommandResult.GaugeRangeMinBiggerThanRangeMax
      )
    );
  }

  isRangeMaxInvalid() {
    return !!(
      this.state.sectionRuleDispatchResult?.isCancelledBecause(CommandResult.EmptyGaugeRangeMax) ||
      this.state.sectionRuleDispatchResult?.isCancelledBecause(CommandResult.GaugeRangeMaxNaN) ||
      this.state.sectionRuleDispatchResult?.isCancelledBecause(
        CommandResult.GaugeRangeMinBiggerThanRangeMax
      )
    );
  }

  // ---------------------------------------------------------------------------
  // COLOR_SECTION_TEMPLATE
  // ---------------------------------------------------------------------------

  get isLowerInflectionPointInvalid() {
    return !!(
      this.state.sectionRuleDispatchResult?.isCancelledBecause(
        CommandResult.GaugeLowerInflectionPointNaN
      ) ||
      this.state.sectionRuleDispatchResult?.isCancelledBecause(
        CommandResult.GaugeLowerBiggerThanUpper
      )
    );
  }

  get isUpperInflectionPointInvalid() {
    return !!(
      this.state.sectionRuleDispatchResult?.isCancelledBecause(
        CommandResult.GaugeUpperInflectionPointNaN
      ) ||
      this.state.sectionRuleDispatchResult?.isCancelledBecause(
        CommandResult.GaugeLowerBiggerThanUpper
      )
    );
  }

  updateSectionColor(target: string, color: Color) {
    const sectionRule = deepCopy(this.state.sectionRule);
    sectionRule.colors[target] = color;
    this.updateSectionRule(sectionRule);
  }

  updateSectionRule(sectionRule: SectionRule) {
    this.state.sectionRuleDispatchResult = this.props.updateChart(this.props.figureId, {
      sectionRule,
    });
    if (this.state.sectionRuleDispatchResult.isSuccessful) {
      this.state.sectionRule = deepCopy(sectionRule);
    }
  }

  canUpdateSectionRule(sectionRule: SectionRule) {
    this.state.sectionRuleDispatchResult = this.props.canUpdateChart(this.props.figureId, {
      sectionRule,
    });
  }

  get backgroundColorTitle() {
    return ChartTerms.BackgroundColor;
  }
}
