import { composerTokenize, EnrichedToken } from "../../formulas/index";
import { POSTFIX_UNARY_OPERATORS } from "../../formulas/tokenizer";
import {
  colors,
  concat,
  getComposerSheetName,
  getZoneArea,
  isDateTimeFormat,
  isEqual,
  isNumber,
  markdownLink,
  numberToString,
  positionToZone,
  updateSelectionOnDeletion,
  updateSelectionOnInsertion,
} from "../../helpers/index";
import { loopThroughReferenceType } from "../../helpers/reference_type";
import { _lt } from "../../translation";
import {
  CellPosition,
  CellValueType,
  Format,
  Highlight,
  Range,
  RangePart,
  UID,
  Zone,
} from "../../types";
import { SelectionEvent } from "../../types/event_stream";
import {
  AddColumnsRowsCommand,
  Command,
  CommandResult,
  RemoveColumnsRowsCommand,
} from "../../types/index";
import { UIPlugin, UIPluginConfig } from "../ui_plugin";

type EditionMode =
  | "editing"
  | "selecting" // should tell if you need to underline the current range selected.
  | "inactive";

const CELL_DELETED_MESSAGE = _lt("The cell you are trying to edit has been deleted.");

export interface ComposerSelection {
  start: number;
  end: number;
}

interface EditingState {
  col: number;
  row: number;
  mode: "editing" | "selecting";
  sheetId: UID;
  currentContent: string;
  currentTokens: EnrichedToken[];
  selectionStart: number;
  selectionEnd: number;
  selectionInitialStart: number;
  initialContent: string | undefined;
  previousRef: string;
  previousRange: Range | undefined;
  colorIndexByRange: { [xc: string]: number };
}

interface EmptyState {
  col: undefined;
  row: undefined;
  sheetId: undefined;
  mode: "inactive";
  currentContent: string;
  currentTokens: EnrichedToken[];
  selectionStart: number;
  selectionEnd: number;
  selectionInitialStart: number;
  initialContent: undefined;
  previousRef: undefined;
  previousRange: undefined;
  colorIndexByRange: {};
}

type State = EmptyState | EditingState;

export const SelectionIndicator = "␣";

export class EditionPlugin extends UIPlugin {
  static getters = [
    "getEditionMode",
    "isSelectingForComposer",
    "showSelectionIndicator",
    "getCurrentContent",
    "getEditionSheet",
    "getComposerSelection",
    "getCurrentTokens",
    "getTokenAtCursor",
    "getComposerHighlights",
  ] as const;

  private state!: State;

  constructor(config: UIPluginConfig) {
    super(config);
    this.setDefaultState();
  }

  setDefaultState() {
    this.state = {
      col: undefined,
      row: undefined,
      sheetId: undefined,
      mode: "inactive",
      currentContent: "string",
      currentTokens: [],
      selectionStart: 0,
      selectionEnd: 0,
      selectionInitialStart: 0,
      initialContent: undefined,
      previousRef: undefined,
      previousRange: undefined,
      colorIndexByRange: {},
    };
  }

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: Command): CommandResult {
    switch (cmd.type) {
      case "CHANGE_COMPOSER_CURSOR_SELECTION":
        if (this.state.mode === "inactive") {
          return CommandResult.WrongEditionMode;
        }
        return this.validateSelection(this.state.currentContent.length, cmd.start, cmd.end);
      case "SET_CURRENT_CONTENT":
        if (this.state.mode === "inactive") {
          return CommandResult.WrongEditionMode;
        }
        if (cmd.selection) {
          return this.validateSelection(cmd.content.length, cmd.selection.start, cmd.selection.end);
        } else {
          return CommandResult.Success;
        }
      case "REPLACE_COMPOSER_CURSOR_SELECTION":
      case "CHANGE_COMPOSER_CURSOR_SELECTION":
      case "STOP_COMPOSER_RANGE_SELECTION":
      case "SET_CURRENT_CONTENT":
      case "CHANGE_HIGHLIGHT":
      case "CYCLE_EDITION_REFERENCES":
      case "START_CHANGE_HIGHLIGHT":
        return this.state.mode === "inactive"
          ? CommandResult.WrongEditionMode
          : CommandResult.Success;
      case "START_EDITION":
        if (cmd.selection) {
          const content = cmd.text || this.getComposerContent(this.getters.getActivePosition());
          return this.validateSelection(content.length, cmd.selection.start, cmd.selection.end);
        } else {
          return CommandResult.Success;
        }
      default:
        return CommandResult.Success;
    }
  }

  private handleEvent(event: SelectionEvent) {
    if (this.state.mode !== "selecting") {
      return;
    }
    switch (event.mode) {
      case "newAnchor":
        this.insertSelectedRange(event.anchor.zone);
        break;
      default:
        this.replaceSelectedRanges(event.anchor.zone);
        break;
    }
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "CHANGE_COMPOSER_CURSOR_SELECTION":
        if (this.state.mode !== "inactive") {
          this.state.selectionStart = cmd.start;
          this.state.selectionEnd = cmd.end;
        }
        break;
      case "STOP_COMPOSER_RANGE_SELECTION":
        if (this.isSelectingForComposer()) {
          this.state.mode = "editing";
        }
        break;
      case "START_EDITION":
        this.startEdition(cmd.text, cmd.selection);
        this.updateRangeColor();
        break;
      case "STOP_EDITION":
        if (cmd.cancel) {
          this.cancelEditionAndActivateSheet();
          this.resetContent();
        } else {
          this.stopEdition();
        }
        this.state.colorIndexByRange = {};
        break;
      case "SET_CURRENT_CONTENT":
        this.setContent(cmd.content, cmd.selection, true);
        this.updateRangeColor();
        break;
      case "REPLACE_COMPOSER_CURSOR_SELECTION":
        this.replaceSelection(cmd.text);
        break;
      case "SELECT_FIGURE":
        this.cancelEditionAndActivateSheet();
        this.resetContent();
        break;
      case "ADD_COLUMNS_ROWS":
        this.onAddElements(cmd);
        break;
      case "REMOVE_COLUMNS_ROWS":
        if (cmd.dimension === "COL") {
          this.onColumnsRemoved(cmd);
        } else {
          this.onRowsRemoved(cmd);
        }
        break;
      case "START_CHANGE_HIGHLIGHT":
        this.dispatch("STOP_COMPOSER_RANGE_SELECTION");
        const state = this.state as EditingState;
        const range = this.getters.getRangeFromRangeData(cmd.range);
        const previousRefToken = this.state.currentTokens
          .filter((token) => token.type === "REFERENCE")
          .find((token) => {
            let value = token.value;
            const [xc, sheet] = value.split("!").reverse();
            const sheetName = sheet || this.getters.getSheetName(state.sheetId);
            const activeSheetId = this.getters.getActiveSheetId();
            if (this.getters.getSheetName(activeSheetId) !== sheetName) {
              return false;
            }
            const refRange = this.getters.getRangeFromSheetXC(activeSheetId, xc);
            return isEqual(this.getters.expandZone(activeSheetId, refRange.zone), range.zone);
          });
        this.state.previousRef = previousRefToken!.value;
        this.state.previousRange = this.getters.getRangeFromSheetXC(
          this.getters.getActiveSheetId(),
          this.state.previousRef
        );
        this.state.selectionInitialStart = previousRefToken!.start;
        break;
      case "CHANGE_HIGHLIGHT":
        if (this.state.mode !== "inactive") {
          const cmdRange = this.getters.getRangeFromRangeData(cmd.range);
          const newRef = this.getRangeReference(
            cmdRange,
            this.state.previousRange!.parts,
            this.state.sheetId
          );
          this.state.selectionStart = this.state.selectionInitialStart;
          this.state.selectionEnd =
            this.state.selectionInitialStart + this.state.previousRef.length;
          this.replaceSelection(newRef);
          this.state.previousRef = newRef;
          this.state.selectionStart = this.state.currentContent.length;
          this.state.selectionEnd = this.state.currentContent.length;
        }
        break;
      case "ACTIVATE_SHEET":
        if (this.state.mode !== "selecting") {
          this.cancelEdition();
          this.resetContent();
        }
        if (cmd.sheetIdFrom !== cmd.sheetIdTo) {
          const { col, row } = this.getters.getNextVisibleCellPosition({
            sheetId: cmd.sheetIdTo,
            col: 0,
            row: 0,
          });
          const zone = this.getters.expandZone(cmd.sheetIdTo, positionToZone({ col, row }));
          this.selection.resetAnchor(this, { cell: { col, row }, zone });
        }
        break;
      case "DELETE_SHEET":
      case "UNDO":
      case "REDO":
        if (this.state.mode !== "inactive") {
          const sheetIdExists = !!this.getters.tryGetSheet(this.state.sheetId);
          if (!sheetIdExists) {
            // stupid code. setting sheetId just to cancel it, which should clean
            // the state.
            this.state.sheetId = this.getters.getActiveSheetId();
            this.cancelEditionAndActivateSheet();
            this.resetContent();
            this.ui.notifyUI({
              type: "ERROR",
              text: CELL_DELETED_MESSAGE,
            });
          }
        }
        break;
      case "CYCLE_EDITION_REFERENCES":
        this.cycleReferences();
        break;
    }
  }

  unsubscribe() {
    this.setDefaultState();
  }
  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getEditionMode(): EditionMode {
    return this.state.mode;
  }

  getCurrentContent(): string {
    if (this.state.mode === "inactive") {
      return this.getComposerContent(this.getters.getActivePosition());
    }
    return this.state.currentContent;
  }

  getEditionSheet(): string {
    if (this.state.mode === "inactive") {
      throw new Error("You are not currently editing a cell");
    }
    return this.state.sheetId;
  }

  getComposerSelection(): ComposerSelection {
    if (this.state.mode === "inactive") {
      throw new Error("You are not currently editing a cell");
    }
    return {
      start: this.state.selectionStart,
      end: this.state.selectionEnd,
    };
  }

  isSelectingForComposer(): boolean {
    return this.state.mode === "selecting";
  }

  showSelectionIndicator(): boolean {
    if (this.state.mode === "inactive") {
      throw new Error("You are not currently editing a cell");
    }
    return this.isSelectingForComposer() && this.canStartComposerRangeSelection();
  }

  getCurrentTokens(): EnrichedToken[] {
    if (this.state.mode === "inactive") {
      throw new Error("You are not currently editing a cell");
    }
    return this.state.currentTokens;
  }

  /**
   * Return the (enriched) token just before the cursor.
   */
  getTokenAtCursor(): EnrichedToken | undefined {
    if (this.state.mode === "inactive") {
      throw new Error("You are not currently editing a cell");
    }
    const [start, end] = [this.state.selectionStart, this.state.selectionEnd].sort();
    if (start === end && end === 0) {
      return undefined;
    } else {
      return this.state.currentTokens.find((t) => t.start <= start && t.end >= end);
    }
  }

  /**
   * Highlight all ranges that can be found in the composer content.
   */
  getComposerHighlights(): Highlight[] {
    if (!this.state.currentContent.startsWith("=") || this.state.mode === "inactive") {
      return [];
    }
    // implies non incative mode
    const editionSheetId = this.state.sheetId;
    const rangeColor = (rangeString: string) => {
      const colorIndex = this.state.colorIndexByRange[rangeString];
      return colors[colorIndex % colors.length];
    };
    return this.getReferencedRanges().map((range) => {
      const rangeString = this.getters.getRangeString(range, editionSheetId);
      return {
        zone: range.zone,
        color: rangeColor(rangeString),
        sheetId: range.sheetId,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

  private cycleReferences() {
    const tokens = this.getTokensInSelection();
    const refTokens = tokens.filter((token) => token.type === "REFERENCE");
    if (refTokens.length === 0) return;

    const updatedReferences = tokens
      .map(loopThroughReferenceType)
      .map((token) => token.value)
      .join("");

    const content = this.state.currentContent;
    const start = tokens[0].start;
    const end = tokens[tokens.length - 1].end;
    const newContent = content.slice(0, start) + updatedReferences + content.slice(end);
    const lengthDiff = newContent.length - content.length;

    const startOfTokens = refTokens[0].start;
    const endOfTokens = refTokens[refTokens.length - 1].end + lengthDiff;
    const selection = { start: startOfTokens, end: endOfTokens };
    // Put the selection at the end of the token if we cycled on a single token
    if (refTokens.length === 1 && this.state.selectionStart === this.state.selectionEnd) {
      selection.start = selection.end;
    }

    this.dispatch("SET_CURRENT_CONTENT", {
      content: newContent,
      selection,
    });
  }

  private validateSelection(
    length: number,
    start: number,
    end: number
  ): CommandResult.Success | CommandResult.WrongComposerSelection {
    return start >= 0 && start <= length && end >= 0 && end <= length
      ? CommandResult.Success
      : CommandResult.WrongComposerSelection;
  }

  private onColumnsRemoved(cmd: RemoveColumnsRowsCommand) {
    if (this.state.mode !== "inactive" && cmd.elements.includes(this.state.col)) {
      this.dispatch("STOP_EDITION", { cancel: true });
      this.ui.notifyUI({
        type: "ERROR",
        text: CELL_DELETED_MESSAGE,
      });
      return;
    } else if (this.state.mode !== "inactive") {
      const { top, left } = updateSelectionOnDeletion(
        {
          left: this.state.col,
          right: this.state.col,
          top: this.state.row,
          bottom: this.state.row,
        },
        "left",
        [...cmd.elements]
      );
      this.state.col = left;
      this.state.row = top;
    }
  }

  private onRowsRemoved(cmd: RemoveColumnsRowsCommand) {
    if (this.state.mode !== "inactive" && cmd.elements.includes(this.state.row)) {
      this.dispatch("STOP_EDITION", { cancel: true });
      this.ui.notifyUI({
        type: "ERROR",
        text: CELL_DELETED_MESSAGE,
      });
      return;
    } else if (this.state.mode !== "inactive") {
      const { top, left } = updateSelectionOnDeletion(
        {
          left: this.state.col,
          right: this.state.col,
          top: this.state.row,
          bottom: this.state.row,
        },
        "top",
        [...cmd.elements]
      );
      this.state.col = left;
      this.state.row = top;
    }
  }

  private onAddElements(cmd: AddColumnsRowsCommand) {
    if (this.state.mode !== "inactive") {
      const { top, left } = updateSelectionOnInsertion(
        {
          left: this.state.col,
          right: this.state.col,
          top: this.state.row,
          bottom: this.state.row,
        },
        cmd.dimension === "COL" ? "left" : "top",
        cmd.base,
        cmd.position,
        cmd.quantity
      );
      this.state.col = left;
      this.state.row = top;
    }
  }

  /**
   * Enable the selecting mode
   */
  private startComposerRangeSelection() {
    if (this.state.sheetId === this.getters.getActiveSheetId()) {
      const zone = positionToZone({ col: this.state.col, row: this.state.row });
      this.selection.resetAnchor(this, {
        cell: { col: this.state.col, row: this.state.row },
        zone,
      });
    }
    this.state.mode = "selecting";
    this.state.selectionInitialStart = this.state.selectionStart;
  }

  /**
   * start the edition of a cell
   * @param str the key that is used to start the edition if it is a "content" key like a letter or number
   * @param selection
   * @private
   */
  private startEdition(str?: string, selection?: ComposerSelection) {
    const evaluatedCell = this.getters.getActiveCell();
    if (str && evaluatedCell.format?.includes("%") && isNumber(str)) {
      selection = selection || { start: str.length, end: str.length };
      str = `${str}%`;
    }
    const sheetId = this.getters.getActiveSheetId();
    const { col, row } = this.getters.getActivePosition();
    this.state.col = col;
    this.state.sheetId = sheetId;
    this.state.row = row;
    this.state.initialContent = this.getComposerContent({ sheetId, col, row });
    this.state.mode = "editing";
    this.setContent(str || this.state.initialContent, selection);
    this.state.colorIndexByRange = {};
    const zone = positionToZone({ col: this.state.col, row: this.state.row });
    this.selection.capture(
      this,
      { cell: { col: this.state.col, row: this.state.row }, zone },
      {
        handleEvent: this.handleEvent.bind(this),
        release: () => (this.state.mode = "inactive"),
      }
    );
  }

  private stopEdition() {
    if (this.state.mode !== "inactive") {
      this.cancelEditionAndActivateSheet();
      const col = this.state.col;
      const row = this.state.row;
      let content = this.state.currentContent;
      const didChange = this.state.initialContent !== content;
      if (!didChange) {
        return;
      }
      if (content) {
        const sheetId = this.getters.getActiveSheetId();
        const cell = this.getters.getEvaluatedCell({
          sheetId,
          col: this.state.col,
          row: this.state.row,
        });
        if (content.startsWith("=")) {
          const left = this.state.currentTokens.filter((t) => t.type === "LEFT_PAREN").length;
          const right = this.state.currentTokens.filter((t) => t.type === "RIGHT_PAREN").length;
          const missing = left - right;
          if (missing > 0) {
            content += concat(new Array(missing).fill(")"));
          }
        } else if (cell.link) {
          content = markdownLink(content, cell.link.url);
        }
        this.dispatch("UPDATE_CELL", {
          sheetId: this.state.sheetId,
          col,
          row,
          content,
        });
      } else {
        this.dispatch("UPDATE_CELL", {
          sheetId: this.state.sheetId,
          content: "",
          col,
          row,
        });
      }
      this.setContent("");
    }
  }

  private cancelEditionAndActivateSheet() {
    if (this.state.mode === "inactive") {
      return;
    }
    this.cancelEdition();
    const sheetId = this.getters.getActiveSheetId();
    if (sheetId !== this.state.sheetId) {
      this.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: this.getters.getActiveSheetId(),
        sheetIdTo: this.state.sheetId,
      });
    }
    this.setDefaultState();
  }

  private getComposerContent(position: CellPosition): string {
    const cell = this.getters.getCell(position);
    if (cell?.isFormula) {
      return cell.content;
    }
    const { format, value, type, formattedValue } = this.getters.getEvaluatedCell(position);
    switch (type) {
      case CellValueType.text:
      case CellValueType.empty:
        return value;
      case CellValueType.boolean:
        return formattedValue;
      case CellValueType.error:
        return cell?.content || "";
      case CellValueType.number:
        if (format && isDateTimeFormat(format)) {
          return formattedValue;
        }
        return this.numberComposerContent(value, format);
    }
  }

  private numberComposerContent(value: number, format?: Format): string {
    if (format?.includes("%")) {
      return `${value * 100}%`;
    }
    return numberToString(value);
  }

  private cancelEdition() {
    if (this.state.mode === "inactive") {
      return;
    }
    this.setDefaultState();
    this.selection.release(this);
  }

  /**
   * Reset the current content to the active cell content
   */
  private resetContent() {
    this.setContent(this.state.initialContent || "");
  }

  private setContent(text: string, selection?: ComposerSelection, raise?: boolean) {
    // requires to be currently editing
    const isNewCurrentContent = this.state.currentContent !== text;
    this.state.currentContent = text;

    if (selection) {
      this.state.selectionStart = selection.start;
      this.state.selectionEnd = selection.end;
    } else {
      this.state.selectionStart = this.state.selectionEnd = text.length;
    }
    if (isNewCurrentContent || this.state.mode !== "inactive") {
      this.state.currentTokens = text.startsWith("=") ? composerTokenize(text) : [];
      if (this.state.currentTokens.length > 100) {
        if (raise) {
          this.ui.notifyUI({
            type: "ERROR",
            text: _lt(
              "This formula has over 100 parts. It can't be processed properly, consider splitting it into multiple cells"
            ),
          });
        }
      }
    }
    if (this.canStartComposerRangeSelection()) {
      this.startComposerRangeSelection();
    }
  }

  private insertSelectedRange(zone: Zone) {
    // implies state in "selecting" mode
    // infer if range selected or selecting range from cursor position
    const start = Math.min(this.state.selectionStart, this.state.selectionEnd);
    const ref = this.getZoneReference(zone);
    if (this.canStartComposerRangeSelection()) {
      this.insertText(ref, start);
      this.state.selectionInitialStart = start;
    } else {
      this.insertText("," + ref, start);
      this.state.selectionInitialStart = start + 1;
    }
  }
  /**
   * Replace the current reference selected by the new one.
   * */
  private replaceSelectedRanges(zone: Zone) {
    // implies state in "selecting" mode and that selectionInitialStart is defined
    const ref = this.getZoneReference(zone);
    this.replaceText(ref, this.state.selectionInitialStart, this.state.selectionEnd);
  }

  private getZoneReference(
    zone: Zone,
    fixedParts: RangePart[] = [{ colFixed: false, rowFixed: false }]
  ): string {
    const sheetId = this.getters.getActiveSheetId();
    let selectedXc = this.getters.zoneToXC(sheetId, zone, fixedParts);
    if (this.getters.getEditionSheet() !== this.getters.getActiveSheetId()) {
      const sheetName = getComposerSheetName(
        this.getters.getSheetName(this.getters.getActiveSheetId())
      );
      selectedXc = `${sheetName}!${selectedXc}`;
    }
    return selectedXc;
  }

  private getRangeReference(
    range: Range,
    fixedParts: Range["parts"] = [{ colFixed: false, rowFixed: false }],
    sheetId: UID
  ) {
    let _fixedParts = [...fixedParts];
    if (fixedParts.length === 1 && getZoneArea(range.zone) > 1) {
      _fixedParts.push({ ...fixedParts[0] });
    } else if (fixedParts.length === 2 && getZoneArea(range.zone) === 1) {
      _fixedParts.pop();
    }
    const newRange = range.clone({ parts: _fixedParts });
    return this.getters.getSelectionRangeString(newRange, sheetId);
  }

  /**
   * Replace the current selection by a new text.
   * The cursor is then set at the end of the text.
   */
  private replaceSelection(text: string) {
    const start = Math.min(this.state.selectionStart, this.state.selectionEnd);
    const end = Math.max(this.state.selectionStart, this.state.selectionEnd);
    this.replaceText(text, start, end);
  }

  private replaceText(text: string, start: number, end: number) {
    this.state.currentContent =
      this.state.currentContent.slice(0, start) +
      this.state.currentContent.slice(end, this.state.currentContent.length);
    this.insertText(text, start);
  }

  /**
   * Insert a text at the given position.
   * The cursor is then set at the end of the text.
   */
  private insertText(text: string, start: number) {
    const content =
      this.state.currentContent.slice(0, start) + text + this.state.currentContent.slice(start);
    const end = start + text.length;
    this.dispatch("SET_CURRENT_CONTENT", {
      content,
      selection: { start: end, end },
    });
  }

  private updateRangeColor() {
    if (!this.state.currentContent.startsWith("=") || this.state.mode === "inactive") {
      return;
    }
    // implies editing mode
    const editionSheetId = this.state.sheetId;
    const XCs = this.getReferencedRanges().map((range) =>
      this.getters.getRangeString(range, editionSheetId)
    );
    const colorsToKeep = {};
    for (const xc of XCs) {
      if (this.state.colorIndexByRange[xc] !== undefined) {
        colorsToKeep[xc] = this.state.colorIndexByRange[xc];
      }
    }
    const usedIndexes = new Set(Object.values(colorsToKeep));
    let currentIndex = 0;
    const nextIndex = () => {
      while (usedIndexes.has(currentIndex)) currentIndex++;
      usedIndexes.add(currentIndex);
      return currentIndex;
    };
    for (const xc of XCs) {
      const colorIndex = xc in colorsToKeep ? colorsToKeep[xc] : nextIndex();
      colorsToKeep[xc] = colorIndex;
    }
    this.state.colorIndexByRange = colorsToKeep;
  }

  /**
   * Return ranges currently referenced in the composer
   */
  private getReferencedRanges(): Range[] {
    if (!this.state.currentContent.startsWith("=") || this.state.mode === "inactive") {
      return [];
    }
    const editionSheetId = this.state.sheetId;
    return this.state.currentTokens
      .filter((token) => token.type === "REFERENCE")
      .map((token) => this.getters.getRangeFromSheetXC(editionSheetId, token.value));
  }

  /**
   * Function used to determine when composer selection can start.
   * Three conditions are necessary:
   * - the previous token is among ["COMMA", "LEFT_PAREN", "OPERATOR"], and is not a postfix unary operator
   * - the next token is missing or is among ["COMMA", "RIGHT_PAREN", "OPERATOR"]
   * - Previous and next tokens can be separated by spaces
   */
  private canStartComposerRangeSelection(): boolean {
    if (this.state.currentContent.startsWith("=")) {
      const tokenAtCursor = this.getTokenAtCursor();
      if (!tokenAtCursor) {
        return false;
      }

      const tokenIdex = this.state.currentTokens
        .map((token) => token.start)
        .indexOf(tokenAtCursor.start);

      let count = tokenIdex;
      let currentToken = tokenAtCursor;
      // check previous token
      while (
        !["COMMA", "LEFT_PAREN", "OPERATOR"].includes(currentToken.type) ||
        POSTFIX_UNARY_OPERATORS.includes(currentToken.value)
      ) {
        if (currentToken.type !== "SPACE" || count < 1) {
          return false;
        }
        count--;
        currentToken = this.state.currentTokens[count];
      }

      count = tokenIdex + 1;
      currentToken = this.state.currentTokens[count];
      // check next token
      while (currentToken && !["COMMA", "RIGHT_PAREN", "OPERATOR"].includes(currentToken.type)) {
        if (currentToken.type !== "SPACE") {
          return false;
        }
        count++;
        currentToken = this.state.currentTokens[count];
      }
      return true;
    }
    return false;
  }

  /**
   * Returns all the tokens between selectionStart and selectionEnd.
   * Includes token that begin right on selectionStart or end right on selectionEnd.
   */
  private getTokensInSelection(): EnrichedToken[] {
    const start = Math.min(this.state.selectionStart, this.state.selectionEnd);
    const end = Math.max(this.state.selectionStart, this.state.selectionEnd);
    return this.state.currentTokens.filter(
      (t) => (t.start <= start && t.end >= start) || (t.start >= start && t.start < end)
    );
  }
}
