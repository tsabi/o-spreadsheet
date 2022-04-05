import { ChartConfiguration, ChartLegendOptions, ChartTooltipItem } from "chart.js";
import { ChartTerms } from "../../components/translations_terms";
import { MAX_CHAR_LABEL } from "../../constants";
import { ChartColors } from "../../helpers/chart";
import { isInside, overlap, recomputeZones, zoneToXc } from "../../helpers/index";
import { range } from "../../helpers/misc";
import { Mode } from "../../model";
import { Cell } from "../../types";
import {
  BasicChartDefinition,
  ChartData,
  ChartDataSet,
  DataSet,
  ScorecardChartDefinition,
  ScorecardChartRuntime,
} from "../../types/chart";
import { Command } from "../../types/commands";
import { UID, Zone } from "../../types/misc";
import { UIPlugin } from "../ui_plugin";
import { CellValue } from "./../../types/cells";
import { ChartDefinition } from "./../../types/chart";

export class EvaluationChartPlugin extends UIPlugin {
  static getters = ["getBasicChartRuntime", "getScorecardChartRuntime"] as const;
  static modes: Mode[] = ["normal"];
  // contains the configuration of the chart with it's values like they should be displayed,
  // as well as all the options needed for the chart library to work correctly
  readonly chartRuntime: { [figureId: string]: ChartConfiguration } = {};
  readonly scorecardChartRuntime: { [figureId: string]: ScorecardChartRuntime } = {}; //TODO :)

  private outOfDate: Set<UID> = new Set<UID>();

  beforeHandle(cmd: Command) {
    switch (cmd.type) {
      case "REMOVE_COLUMNS_ROWS":
        const sheet = this.getters.getSheet(cmd.sheetId);
        const length = cmd.dimension === "ROW" ? sheet.cols.length : sheet.rows.length;
        const zones: Zone[] = cmd.elements.map((el) => ({
          top: cmd.dimension === "ROW" ? el : 0,
          bottom: cmd.dimension === "ROW" ? el : length - 1,
          left: cmd.dimension === "ROW" ? 0 : el,
          right: cmd.dimension === "ROW" ? length - 1 : el,
        }));
        for (const chartId of this.getAllChartIds()) {
          if (this.areZonesUsedInChart(cmd.sheetId, zones, chartId)) {
            this.outOfDate.add(chartId);
          }
        }
        break;
    }
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "UPDATE_CHART":
      case "CREATE_CHART":
        this.removeChartEvaluation(cmd.id);
        let chartDefinition: ChartDefinition | undefined;
        if ((chartDefinition = this.getters.getBasicChartDefinition(cmd.id))) {
          this.chartRuntime[cmd.id] = this.mapDefinitionToRuntime(chartDefinition);
        }
        if ((chartDefinition = this.getters.getScorecardChartDefinition(cmd.id))) {
          this.scorecardChartRuntime[cmd.id] =
            this.mapScorecardDefinitionToRuntime(chartDefinition);
        }
        break;
      case "DELETE_FIGURE":
        this.removeChartEvaluation(cmd.id);
        break;
      case "REFRESH_CHART":
        this.evaluateUsedSheets([cmd.id]);
        this.outOfDate.add(cmd.id);
        break;
      case "ACTIVATE_SHEET":
        const chartsIds = this.getters.getChartsIdBySheet(cmd.sheetIdTo);
        this.evaluateUsedSheets(chartsIds);
        break;
      case "UPDATE_CELL":
        for (let chartId of this.getAllChartIds()) {
          if (this.isCellUsedInChart(cmd.sheetId, chartId, cmd.col, cmd.row)) {
            this.outOfDate.add(chartId);
          }
        }
        break;
      case "DELETE_SHEET":
        for (let chartId of this.getAllChartIds()) {
          if (!this.getters.isChartDefined(chartId)) {
            if (this.chartRuntime[chartId]) {
              delete this.chartRuntime[chartId];
            }
            if (this.scorecardChartRuntime[chartId]) {
              delete this.scorecardChartRuntime[chartId];
            }
          }
        }
        break;
      case "ADD_COLUMNS_ROWS":
        const sheet = this.getters.getSheet(cmd.sheetId);
        const numberOfElem = cmd.dimension === "ROW" ? sheet.cols.length : sheet.rows.length;
        const offset = cmd.position === "before" ? 0 : 1;
        const zone: Zone = {
          top: cmd.dimension === "ROW" ? cmd.base + offset : 0,
          bottom: cmd.dimension === "ROW" ? cmd.base + cmd.quantity + offset : numberOfElem - 1,
          left: cmd.dimension === "ROW" ? 0 : cmd.base + offset,
          right: cmd.dimension === "ROW" ? numberOfElem - 1 : cmd.base + cmd.quantity + offset,
        };
        for (const chartId of this.getAllChartIds()) {
          if (this.areZonesUsedInChart(cmd.sheetId, [zone], chartId)) {
            this.outOfDate.add(chartId);
          }
        }
        break;
      case "UNDO":
      case "REDO":
        for (let chartId of this.getAllChartIds()) {
          this.outOfDate.add(chartId);
        }
        break;
      case "EVALUATE_CELLS":
        // if there was an async evaluation of cell, there is no way to know which was updated so all charts must be updated
        //TODO Need to check that someday
        for (let id of this.getAllChartIds()) {
          this.outOfDate.add(id);
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getBasicChartRuntime(figureId: string): ChartConfiguration | undefined {
    if (this.outOfDate.has(figureId) || !(figureId in this.chartRuntime)) {
      const chartDefinition = this.getters.getBasicChartDefinition(figureId);
      if (chartDefinition === undefined) return;
      this.chartRuntime[figureId] = this.mapDefinitionToRuntime(chartDefinition);
      this.outOfDate.delete(figureId);
    }
    return this.chartRuntime[figureId];
  }

  getScorecardChartRuntime(figureId: string): ScorecardChartRuntime | undefined {
    if (this.outOfDate.has(figureId) || !(figureId in this.scorecardChartRuntime)) {
      const chartDefinition = this.getters.getScorecardChartDefinition(figureId);
      if (!chartDefinition) return;

      this.scorecardChartRuntime[figureId] = this.mapScorecardDefinitionToRuntime(chartDefinition);
      this.outOfDate.delete(figureId);
    }
    return this.scorecardChartRuntime[figureId];
  }

  private removeChartEvaluation(chartId: string) {
    if (this.chartRuntime[chartId]) {
      delete this.chartRuntime[chartId];
    }
    if (this.scorecardChartRuntime[chartId]) {
      delete this.scorecardChartRuntime[chartId];
    }
  }

  private truncateLabel(label: string | undefined): string {
    if (!label) {
      return "";
    }
    if (label.length > MAX_CHAR_LABEL) {
      return label.substring(0, MAX_CHAR_LABEL) + "…";
    }
    return label;
  }

  private getDefaultConfiguration(
    definition: BasicChartDefinition,
    labels: string[]
  ): ChartConfiguration {
    const legend: ChartLegendOptions = {};
    if (!definition.labelRange && definition.dataSets.length === 1) {
      legend.display = false;
    } else {
      legend.position = definition.legendPosition;
    }
    const config: ChartConfiguration = {
      type: definition.type,
      options: {
        legend,
        // https://www.chartjs.org/docs/latest/general/responsive.html
        responsive: true, // will resize when its container is resized
        maintainAspectRatio: false, // doesn't maintain the aspect ration (width/height =2 by default) so the user has the choice of the exact layout
        layout: {
          padding: { left: 20, right: 20, top: definition.title ? 10 : 25, bottom: 10 },
        },
        elements: {
          line: {
            fill: false, // do not fill the area under line charts
          },
          point: {
            hitRadius: 15, // increased hit radius to display point tooltip when hovering nearby
          },
        },
        animation: {
          duration: 0, // general animation time
        },
        hover: {
          animationDuration: 10, // duration of animations when hovering an item
        },
        responsiveAnimationDuration: 0, // animation duration after a resize
        title: {
          display: !!definition.title,
          fontSize: 22,
          fontStyle: "normal",
          text: definition.title,
        },
      },
      data: {
        labels: labels.map(this.truncateLabel),
        datasets: [],
      },
    };

    if (definition.type !== "pie") {
      config.options!.scales = {
        xAxes: [
          {
            ticks: {
              // x axis configuration
              maxRotation: 60,
              minRotation: 15,
              padding: 5,
              labelOffset: 2,
            },
          },
        ],
        yAxes: [
          {
            position: definition.verticalAxisPosition,
            ticks: {
              // y axis configuration
              beginAtZero: true, // the origin of the y axis is always zero
            },
          },
        ],
      };
      if (definition.type === "bar" && definition.stackedBar) {
        config.options!.scales.xAxes![0].stacked = true;
        config.options!.scales.yAxes![0].stacked = true;
      }
    } else {
      config.options!.tooltips = {
        callbacks: {
          title: function (tooltipItems: ChartTooltipItem[], data: ChartData) {
            return data.datasets![tooltipItems[0]!.datasetIndex!].label!;
          },
        },
      };
    }
    return config;
  }

  /** Get the ids of all the charts defined in this plugin (basicCharts + scorecards) */
  private getAllChartIds() {
    return [...Object.keys(this.chartRuntime), ...Object.keys(this.scorecardChartRuntime)];
  }

  private areZonesUsedInChart(sheetId: UID, zones: Zone[], chartId: UID): boolean {
    const chartSheetId = this.getters.getChartSheetId(chartId);
    if (!chartSheetId || sheetId !== chartSheetId) {
      return false;
    }
    const ranges = this.getters.getChartRanges(chartId);
    for (let zone of zones) {
      for (let range of ranges) {
        if (range.sheetId === sheetId && overlap(range.zone, zone)) {
          return true;
        }
      }
    }
    return false;
  }

  private isCellUsedInChart(sheetId: UID, chartId: UID, col: number, row: number): boolean {
    const ranges = this.getters.getChartRanges(chartId);

    for (let range of ranges) {
      if (range.sheetId === sheetId && isInside(col, row, range.zone)) {
        return true;
      }
    }
    return false;
  }

  private getSheetIdsUsedInChart(chartId: UID): Set<UID> {
    const sheetIds: Set<UID> = new Set();
    const chartRanges = this.getters.getChartRanges(chartId);
    for (let range of chartRanges) {
      sheetIds.add(range.sheetId);
    }
    return sheetIds;
  }

  private evaluateUsedSheets(chartsIds: UID[]) {
    const usedSheetsId: Set<UID> = new Set();
    for (let chartId of chartsIds) {
      const sheetsIds = this.getters.isChartDefined(chartId)
        ? this.getSheetIdsUsedInChart(chartId)
        : [];
      sheetsIds.forEach((sheetId) => {
        if (sheetId !== this.getters.getActiveSheetId()) {
          usedSheetsId.add(sheetId);
        }
      });
    }
    for (let sheetId of usedSheetsId) {
      this.dispatch("EVALUATE_CELLS", { sheetId });
    }
  }

  private mapScorecardDefinitionToRuntime(
    definition: ScorecardChartDefinition
  ): ScorecardChartRuntime {
    let keyValue: CellValue | undefined = undefined,
      formattedKeyValue = "";
    if (definition.keyValue) {
      const keyValueCell = this.getters.getCellsInZone(
        definition.sheetId,
        definition.keyValue.zone
      )[0];
      keyValue = keyValueCell?.evaluated.value;
      formattedKeyValue = keyValueCell?.formattedValue || "";
    }
    return {
      ...definition,
      keyValue,
      formattedKeyValue,
      baseline: definition.baseline
        ? this.getters.getRangeValues(definition.baseline)[0]
        : undefined,
    };
  }

  private mapDefinitionToRuntime(definition: BasicChartDefinition): ChartConfiguration {
    let labels: string[] = [];
    if (definition.labelRange) {
      if (!definition.labelRange.invalidXc && !definition.labelRange.invalidSheetName) {
        labels = this.getters.getRangeFormattedValues(definition.labelRange);
      }
    } else if (definition.dataSets.length === 1) {
      for (let i = 0; i < this.getData(definition.dataSets[0], definition.sheetId).length; i++) {
        labels.push("");
      }
    } else {
      if (definition.dataSets[0]) {
        const ranges = this.getData(definition.dataSets[0], definition.sheetId);
        labels = range(0, ranges.length).map((r) => r.toString());
      }
    }
    const runtime = this.getDefaultConfiguration(definition, labels);

    const colors = new ChartColors();
    const pieColors: string[] = [];
    if (definition.type === "pie") {
      const maxLength = Math.max(
        ...definition.dataSets.map((ds) => this.getData(ds, definition.sheetId).length)
      );
      for (let i = 0; i <= maxLength; i++) {
        pieColors.push(colors.next());
      }
    }
    for (const [dsIndex, ds] of Object.entries(definition.dataSets)) {
      let label: string;
      if (ds.labelCell) {
        const labelRange = ds.labelCell;
        const cell: Cell | undefined = labelRange
          ? this.getters.getCell(labelRange.sheetId, labelRange.zone.left, labelRange.zone.top)
          : undefined;
        label =
          cell && labelRange
            ? this.truncateLabel(cell.formattedValue)
            : (label = `${ChartTerms.Series} ${parseInt(dsIndex) + 1}`);
      } else {
        label = label = `${ChartTerms.Series} ${parseInt(dsIndex) + 1}`;
      }
      const color = definition.type !== "pie" ? colors.next() : "#FFFFFF"; // white border for pie chart
      const dataset: ChartDataSet = {
        label,
        data: ds.dataRange ? this.getData(ds, definition.sheetId) : [],
        lineTension: 0, // 0 -> render straight lines, which is much faster
        borderColor: color,
        backgroundColor: color,
      };
      if (definition.type === "pie") {
        // In case of pie graph, dataset.backgroundColor is an array of string
        dataset.backgroundColor = pieColors;
      }
      runtime.data!.datasets!.push(dataset);
    }
    return { ...runtime, data: this.filterEmptyDataPoints(runtime.data as ChartData) };
  }

  private filterEmptyDataPoints(chartData: ChartData): ChartData {
    const labels = chartData.labels;
    const datasets = chartData.datasets;
    const numberOfDataPoints = Math.max(
      labels.length,
      ...datasets.map((dataset) => dataset.data?.length || 0)
    );
    const dataPointsIndexes = range(0, numberOfDataPoints).filter((dataPointIndex) => {
      const label = labels[dataPointIndex];
      const values = datasets.map((dataset) => dataset.data?.[dataPointIndex]);
      return label || values.some((value) => value === 0 || Boolean(value));
    });
    return {
      ...chartData,
      labels: dataPointsIndexes.map((i) => labels[i] || ""),
      datasets: datasets.map((dataset) => ({
        ...dataset,
        data: dataPointsIndexes.map((i) => dataset.data[i]),
      })),
    };
  }

  // TODO type this with Chart.js types.
  private getData(ds: DataSet, sheetId: UID): any[] {
    if (ds.dataRange) {
      const labelCellZone = ds.labelCell ? [zoneToXc(ds.labelCell.zone)] : [];
      const dataXC = recomputeZones([zoneToXc(ds.dataRange.zone)], labelCellZone)[0];
      if (dataXC === undefined) {
        return [];
      }
      const dataRange = this.getters.getRangeFromSheetXC(ds.dataRange.sheetId, dataXC);
      return this.getters.getRangeValues(dataRange);
    }
    return [];
  }
}
