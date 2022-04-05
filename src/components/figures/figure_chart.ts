import { Component, useRef, useState, xml } from "@odoo/owl";
import { BACKGROUND_CHART_COLOR, MENU_WIDTH } from "../../constants";
import { MenuItemRegistry } from "../../registries/index";
import { _lt } from "../../translation";
import { Figure, SpreadsheetChildEnv } from "../../types";
import { css } from "../helpers/css";
import { useAbsolutePosition } from "../helpers/position_hook";
import { LIST } from "../icons";
import { Menu, MenuState } from "../menu";
import { BasicChart } from "./basic_chart";
import { ScorecardChart } from "./scorecard_chart";

const TEMPLATE = xml/* xml */ `
<div class="o-chart-container" t-ref="chartContainer">
  <div class="o-chart-menu" t-on-click="showMenu">${LIST}</div>
    <t t-if="figureChartType === 'scorecard'">
      <ScorecardChart figure="props.figure"/>
    </t>
    <t t-if="figureChartType === 'basicChart'">
      <BasicChart figure="props.figure"/>
    </t>
  <Menu t-if="menuState.isOpen"
    position="menuState.position"
    menuItems="menuState.menuItems"
    onClose="() => this.menuState.isOpen=false"/>
</div>`;

// -----------------------------------------------------------------------------
// STYLE
// -----------------------------------------------------------------------------
css/* scss */ `
  .o-chart-container {
    width: 100%;
    height: 100%;
    position: relative;

    .o-chart-menu {
      right: 0px;
      display: none;
      position: absolute;
      padding: 5px;
      cursor: pointer;
    }
  }
  .o-figure.active:focus {
    .o-chart-container {
      .o-chart-menu {
        display: flex;
      }
    }
  }
`;

type FigureChartType = "scorecard" | "basicChart" | undefined;

interface Props {
  figure: Figure;
  sidePanelIsOpen: boolean;
  onFigureDeleted: () => void;
}

interface State {
  background: string;
}

export class ChartFigure extends Component<Props, SpreadsheetChildEnv> {
  static template = TEMPLATE;
  static components = { Menu, BasicChart, ScorecardChart };
  private menuState: MenuState = useState({ isOpen: false, position: null, menuItems: [] });

  private chartContainerRef = useRef("chartContainer");
  private state: State = { background: BACKGROUND_CHART_COLOR };
  private position = useAbsolutePosition(this.chartContainerRef);

  get canvasStyle() {
    return `background-color: ${this.state.background}`;
  }

  setup() {}

  showMenu(ev: MouseEvent) {
    const registry = new MenuItemRegistry();
    registry.add("edit", {
      name: _lt("Edit"),
      sequence: 1,
      action: () => this.env.openSidePanel("ChartPanel", { figure: this.props.figure }),
    });
    registry.add("delete", {
      name: _lt("Delete"),
      sequence: 10,
      action: () => {
        this.env.model.dispatch("DELETE_FIGURE", {
          sheetId: this.env.model.getters.getActiveSheetId(),
          id: this.props.figure.id,
        });
        if (this.props.sidePanelIsOpen) {
          this.env.toggleSidePanel("ChartPanel", { figure: this.props.figure });
        }
        this.props.onFigureDeleted();
      },
    });
    registry.add("refresh", {
      name: _lt("Refresh"),
      sequence: 11,
      action: () => {
        this.env.model.dispatch("REFRESH_CHART", {
          id: this.props.figure.id,
        });
      },
    });
    this.openContextMenu(ev.currentTarget as HTMLElement, registry);
  }

  private openContextMenu(target: HTMLElement, registry: MenuItemRegistry) {
    const x = target.offsetLeft;
    const y = target.offsetTop;
    this.menuState.isOpen = true;
    this.menuState.menuItems = registry.getAll().filter((x) => x.isVisible(this.env));
    this.menuState.position = {
      x: this.position.x + x - MENU_WIDTH,
      y: this.position.y + y,
    };
  }

  get figureChartType(): FigureChartType {
    switch (this.env.model.getters.getChartType(this.props.figure.id)) {
      case "bar":
      case "line":
      case "pie":
        return "basicChart";
      case "scorecard":
        return "scorecard";
    }
    return undefined;
  }
}
