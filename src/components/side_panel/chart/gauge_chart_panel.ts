import { Component, onWillUpdateProps, useState, xml } from "@odoo/owl";
import { colorNumberString, deepCopy } from "../../../helpers/index";
import {
  CommandResult,
  DispatchResult,
  Figure,
  GaugeChartUIDefinition,
  GaugeChartUIDefinitionUpdate,
  SpreadsheetChildEnv,
} from "../../../types/index";
import { ColorPicker } from "../../color_picker";
import { css } from "../../helpers/css";
import * as icons from "../../icons";
import { SelectionInput } from "../../selection_input";
import { ChartTerms, GenericTerms } from "../../translations_terms";
import { ChartTypeSelect } from "./../chart/chart_type_selection";

const CONFIGURATION_TEMPLATE = xml/* xml */ `
<div>
  <div class="o-section">
    <div class="o-section-title" t-esc="env._t('${ChartTerms.ChartType}')"/>
    <ChartTypeSelect figureId="this.props.figure.id"/>
  </div>
  <div class="o-section o-data-series">
    <div class="o-section-title" t-esc="env._t('${ChartTerms.DataRange}')"/>
    <SelectionInput t-key="getKey('dataRange')"
                    ranges="[state.chart.dataRange]"
                    isInvalid="isDataRangeInvalid"
                    hasSingleRange="true"
                    required="true"
                    onSelectionChanged="(ranges) => this.onDataRangeChanged(ranges)"
                    onSelectionConfirmed="() => this.updateDataRange()" />
  </div>
  <div class="o-section o-sidepanel-error" t-if="configurationErrorMessages">
    <div t-foreach="configurationErrorMessages" t-as="error" t-key="error">
      <t t-esc="error"/>
    </div>
  </div>
</div>
`;

const COLOR_SECTION_TEMPLATE_ROW = xml/* xml */ `
  <tr>
    <td>
      <div class="o-tools">
        <div class="o-tool o-dropdown o-with-color">
          <span title="Fill Color"
                t-attf-style="border-color:{{sectionColor}}"
                t-on-click.stop="(ev) => this.toggleMenu('sectionColor-'+sectionType, ev)">
                ${icons.FILL_COLOR_ICON}
          </span>
          <ColorPicker t-if="state.openedMenu === 'sectionColor-'+sectionType"
            onColorPicked="(color) => this.updateSectionColor(sectionType, color)"
            dropdownDirection="'right'"/>
        </div>
      </div>
    </td>
    <td>
      <t t-esc="env._t('${ChartTerms.WhenValueIsBelow}')"/>
    </td>
    <td>
      <input type="text" class="o-input o-input-{{inflectionPointName}}"
        t-att-class="{ 'o-invalid': isInvalid }"
        t-model="inflectionPoint.value"
      />
    </td>
    <td>
      <select class="o-input" name="valueType" t-model="inflectionPoint.type"
              t-on-change="(ev) => this.updateInflectionPointType(inflectionPointName, ev)">
        <option value="number">
          <t t-esc="env._t('${GenericTerms.FixedNumber}')"/>
        </option>
        <option value="percentage">
          <t t-esc="env._t('${GenericTerms.Percentage}')"/>
        </option>
      </select>
    </td>
  </tr>
`;

const COLOR_SECTION_TEMPLATE = xml/* xml */ `
  <div class="o-gauge-color-set">
    <table>
    <tr>
      <th class="o-gauge-color-set-colorPicker"></th>
      <th class="o-gauge-color-set-text"></th>
      <th class="o-gauge-color-set-value">
      <t t-esc="env._t('${GenericTerms.Value}')"/>
      </th>
      <th class="o-gauge-color-set-type">
      <t t-esc="env._t('${GenericTerms.Type}')"/>
      </th>
    </tr>

    <t t-call="${COLOR_SECTION_TEMPLATE_ROW}">
      <t t-set="sectionColor" t-value="sectionRule.colors.lowerColor" ></t>
      <t t-set="sectionType" t-value="'lowerColor'" ></t>
      <t t-set="inflectionPoint" t-value="sectionRule.lowerInflectionPoint" ></t>
      <t t-set="isInvalid" t-value ="isLowerInflectionPointInvalid" ></t>
      <t t-set="inflectionPointName" t-value="'lowerInflectionPoint'" ></t>
    </t>

    <t t-call="${COLOR_SECTION_TEMPLATE_ROW}">
      <t t-set="sectionColor" t-value="sectionRule.colors.middleColor" ></t>
      <t t-set="sectionType" t-value="'middleColor'" ></t>
      <t t-set="inflectionPoint" t-value="sectionRule.upperInflectionPoint" ></t>
      <t t-set="isInvalid" t-value ="isUpperInflectionPointInvalid" ></t>
      <t t-set="inflectionPointName" t-value="'upperInflectionPoint'" ></t>
    </t>

    <tr>
      <td>
        <div class="o-tools">
          <div class="o-tool o-dropdown o-with-color">
            <span title="Fill Color"
                  t-attf-style="border-color:{{sectionRule.colors.upperColor}}"
                  t-on-click.stop="(ev) => this.toggleMenu('sectionColor-upperColor', ev)">
                  ${icons.FILL_COLOR_ICON}
            </span>
            <ColorPicker t-if="state.openedMenu === 'sectionColor-upperColor'"
              onColorPicked="(color) => this.updateSectionColor('upperColor', color)"
              dropdownDirection="'right'"/>
          </div>
        </div>
      </td>
      <td><t t-esc="env._t('${GenericTerms.Else}')"/></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </table>
  </div>`;

const DESIGN_TEMPLATE = xml/* xml */ `
<div>
  <div class="o-section o-chart-title">
    <div class="o-section-title" t-esc="env._t('${ChartTerms.Title}')"/>
    <input type="text" t-model="state.chart.title" t-on-change="updateTitle" class="o-input" placeholder="${ChartTerms.TitlePlaceholder}"/>
  </div>
  <div class="o-section">
    <div class="o-section-title"><t t-esc="env._t('${ChartTerms.Range}')"/></div>
    <div class="o-subsection-left">
      <input type="text" t-model="state.chart.sectionRule.rangeMin" class="o-input o-data-range-min"
             t-att-class="{ 'o-invalid': isRangeMinInvalid() }"/>
    </div>
    <div class="o-subsection-right">
      <input type="text" t-model="state.chart.sectionRule.rangeMax" class="o-input o-data-range-max"
             t-att-class="{ 'o-invalid': isRangeMaxInvalid() }"/>
    </div>
  </div>
  <div class="o-section">
    <div class="o-section-title"><t t-esc="env._t('${ChartTerms.Thresholds}')"/></div>
    <t t-call="${COLOR_SECTION_TEMPLATE}">
      <t t-set="sectionRule" t-value="state.chart.sectionRule"/>
    </t>
  </div>

  <div class="o-sidePanelButtons">
    <button
      t-on-click="cancelSectionRule"
      class="o-sidePanelButton o-section-rule-cancel"
      t-esc="env._t('${GenericTerms.Cancel}')"></button>
    <button
      t-on-click="saveSectionRule"
      class="o-sidePanelButton o-section-rule-save"
      t-esc="env._t('${GenericTerms.Save}')"></button>
  </div>

  <div class="o-section o-sidepanel-error" t-if="designErrorMessages">
    <div t-foreach="designErrorMessages" t-as="error" t-key="error">
      <t t-esc="error"/>
    </div>
  </div>
</div>
`;

const TEMPLATE = xml/* xml */ `
  <div class="o-chart">
    <div class="o-panel">
      <div class="o-panel-element o-panel-configuration"
          t-att-class="state.panel !== 'configuration' ? 'inactive' : ''"
          t-on-click="() => this.activate('configuration')">
        <i class="fa fa-sliders"/>Configuration
      </div>
      <div class="o-panel-element o-panel-design"
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

css/* scss */ `
  .o-gauge-color-set {
    .o-gauge-color-set-color-button {
      display: inline-block;
      border: 1px solid #dadce0;
      border-radius: 4px;
      cursor: pointer;
      padding: 1px 2px;
    }
    .o-gauge-color-set-color-button:hover {
      background-color: rgba(0, 0, 0, 0.08);
    }
    table {
      table-layout: fixed;
      margin-top: 2%;
      display: table;
      text-align: left;
      font-size: 12px;
      line-height: 18px;
      width: 100%;
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

type GaugeMenu = "sectionColor-lowerColor" | "sectionColor-middleColor" | "sectionColor-upperColor";

interface Props {
  figure: Figure;
  onCloseSidePanel: () => void;
}

interface PanelState {
  chart: GaugeChartUIDefinition;
  panel: "configuration" | "design";
  openedMenu?: GaugeMenu;
  dataRangeDispatchResult?: DispatchResult;
  sectionRuleDispatchResult?: DispatchResult;
}

export class GaugeChartPanel extends Component<Props, SpreadsheetChildEnv> {
  static template = TEMPLATE;
  static components = { SelectionInput, ChartTypeSelect, ColorPicker };

  colorNumberString = colorNumberString;

  private state: PanelState = useState(this.initialState(this.props.figure));
  private sheetId = this.env.model.getters.getActiveSheetId();

  setup() {
    onWillUpdateProps((nextProps: Props) => {
      if (!this.env.model.getters.isChartDefined(nextProps.figure.id)) {
        this.props.onCloseSidePanel();
        return;
      }
      if (nextProps.figure.id !== this.props.figure.id) {
        this.state.panel = "configuration";
        this.state.dataRangeDispatchResult = undefined;
        this.state.sectionRuleDispatchResult = undefined;
        this.sheetId = this.env.model.getters.getActiveSheetId();
        this.state.chart = this.getGaugeChartDefinitionUI(this.sheetId, nextProps.figure.id)!;
      }
    });
  }

  activate(panel: "configuration" | "design") {
    this.state.panel = panel;
  }

  private initialState(figure: Figure): PanelState {
    return {
      chart: this.getGaugeChartDefinitionUI(this.env.model.getters.getActiveSheetId(), figure.id)!,
      panel: "configuration",
      dataRangeDispatchResult: undefined,
      sectionRuleDispatchResult: undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // CONFIGURATION TEMPLATE
  // ---------------------------------------------------------------------------

  get configurationErrorMessages(): string[] {
    const cancelledReasons = [...(this.state.dataRangeDispatchResult?.reasons || [])];
    return cancelledReasons.map(
      (error) => ChartTerms.Errors[error] || ChartTerms.Errors.Unexpected
    );
  }

  get isDataRangeInvalid(): boolean {
    return !!(
      this.state.dataRangeDispatchResult?.isCancelledBecause(CommandResult.EmptyGaugeDataRange) ||
      this.state.dataRangeDispatchResult?.isCancelledBecause(CommandResult.InvalidGaugeDataRange)
    );
  }

  onDataRangeChanged(ranges: string[]) {
    this.state.chart.dataRange = ranges[0];
  }

  updateDataRange() {
    this.state.dataRangeDispatchResult = this.updateChart({
      dataRange: this.state.chart.dataRange,
    });
  }

  getKey(label: string) {
    return label + this.props.figure.id;
  }

  // ---------------------------------------------------------------------------
  // DESIGN_TEMPLATE
  // ---------------------------------------------------------------------------

  get designErrorMessages(): string[] {
    const cancelledReasons = [...(this.state.sectionRuleDispatchResult?.reasons || [])];
    return cancelledReasons.map(
      (error) => ChartTerms.Errors[error] || ChartTerms.Errors.Unexpected
    );
  }

  updateTitle() {
    this.updateChart({ title: this.state.chart.title });
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

  getSectionColor(color: number) {
    return colorNumberString(color);
  }

  updateSectionColor(target: string, color: string) {
    if (this.state.chart.sectionRule) {
      this.state.chart.sectionRule.colors[target] = color;
    }
    this.closeMenus();
  }

  toggleMenu(menu: GaugeMenu) {
    const isSelected: boolean = this.state.openedMenu === menu;
    this.closeMenus();
    if (!isSelected) {
      this.state.openedMenu = menu;
    }
  }

  private closeMenus() {
    this.state.openedMenu = undefined;
  }

  // ---------------------------------------------------------------------------
  // COLOR_SECTION_TEMPLATE_ROW
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

  updateInflectionPointType(attr: string, ev) {
    this.state.chart.sectionRule[attr].type = ev.target.value;
  }

  // ---------------------------------------------------------------------------
  // GLOBAL
  // ---------------------------------------------------------------------------

  cancelSectionRule() {
    this.state.sectionRuleDispatchResult = undefined;
    this.state.chart.sectionRule = this.getGaugeChartDefinitionUI(
      this.sheetId,
      this.props.figure.id
    )!.sectionRule;
  }

  saveSectionRule() {
    this.state.sectionRuleDispatchResult = this.updateChart({
      sectionRule: this.state.chart.sectionRule,
    });
  }

  private getGaugeChartDefinitionUI(
    sheetId: string,
    figureId: string
  ): GaugeChartUIDefinition | undefined {
    return deepCopy(this.env.model.getters.getGaugeChartDefinitionUI(sheetId, figureId));
  }

  private updateChart(definition: GaugeChartUIDefinitionUpdate): DispatchResult {
    return this.env.model.dispatch("UPDATE_CHART", {
      id: this.props.figure.id,
      sheetId: this.env.model.getters.getActiveSheetId(),
      definition,
    });
  }
}
