import { UuidGenerator } from "../helpers";
import { AbstractChart } from "../helpers/figures/charts";
import {
  ClipboardFigureData,
  ClipboardOptions,
  ClipboardPasteTarget,
  CommandResult,
  Figure,
  UID,
  Zone,
} from "../types";
import { AbstractFigureClipboardHandler } from "./abstract_figure_clipboard_handler";

type ClipboardContent = {
  figureId: UID;
  copiedFigure?: Figure;
  copiedChart?: AbstractChart;
};

export class ChartClipboardHandler extends AbstractFigureClipboardHandler<ClipboardContent> {
  copy(data: ClipboardFigureData): ClipboardContent | undefined {
    const sheetId = this.getters.getActiveSheetId();
    const figure = this.getters.getFigure(sheetId, data.figureId);
    if (!figure) {
      throw new Error(`No figure for the given id: ${data.figureId}`);
    }
    if (figure.tag !== "chart") {
      return;
    }
    const copiedFigure = { ...figure };
    const chart = this.getters.getChart(data.figureId);
    if (!chart) {
      throw new Error(`No chart for the given id: ${data.figureId}`);
    }
    const copiedChart = chart.copyInSheetId(sheetId);
    return {
      figureId: data.figureId,
      copiedFigure,
      copiedChart,
    };
  }

  getPasteTarget(
    target: Zone[],
    content: ClipboardContent,
    options?: ClipboardOptions
  ): ClipboardPasteTarget {
    if (!content?.copiedFigure || !content?.copiedChart) {
      return { zones: [] };
    }
    const newId = new UuidGenerator().uuidv4();
    return {
      zones: [],
      figureId: newId,
    };
  }

  paste(target: ClipboardPasteTarget, clippedContent: ClipboardContent, options: ClipboardOptions) {
    if (!clippedContent?.copiedFigure || !clippedContent?.copiedChart || !target.figureId) {
      return;
    }
    const { zones, figureId } = target;
    const sheetId = this.getters.getActiveSheetId();
    const numCols = this.getters.getNumberCols(sheetId);
    const numRows = this.getters.getNumberRows(sheetId);
    const targetX = this.getters.getColDimensions(sheetId, zones[0].left).start;
    const targetY = this.getters.getRowDimensions(sheetId, zones[0].top).start;
    const maxX = this.getters.getColDimensions(sheetId, numCols - 1).end;
    const maxY = this.getters.getRowDimensions(sheetId, numRows - 1).end;
    const { width, height } = clippedContent.copiedFigure;
    const position = {
      x: maxX < width ? 0 : Math.min(targetX, maxX - width),
      y: maxY < height ? 0 : Math.min(targetY, maxY - height),
    };
    const copy = clippedContent.copiedChart.copyInSheetId(sheetId);
    this.dispatch("CREATE_CHART", {
      id: figureId,
      sheetId,
      position,
      size: { height, width },
      definition: copy.getDefinition(),
    });

    if (options?.isCutOperation) {
      this.dispatch("DELETE_FIGURE", {
        sheetId: clippedContent.copiedChart.sheetId,
        id: clippedContent.copiedFigure.id,
      });
    }
    this.dispatch("SELECT_FIGURE", { id: figureId });
  }

  isPasteAllowed(sheetId: UID, target: Zone[], content: any, option?: ClipboardOptions) {
    if (target.length === 0) {
      return CommandResult.EmptyTarget;
    }
    if (option?.pasteOption !== undefined) {
      return CommandResult.WrongFigurePasteOption;
    }
    return CommandResult.Success;
  }
}
