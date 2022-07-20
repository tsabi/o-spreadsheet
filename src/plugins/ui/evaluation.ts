import { compile } from "../../formulas/index";
import { functionRegistry } from "../../functions/index";
import { intersection, isZoneValid, overlap, visitZone, zoneToXc } from "../../helpers/index";
import { ModelConfig } from "../../model";
import { SelectionStreamProcessor } from "../../selection_stream/selection_stream_processor";
import { StateObserver } from "../../state_observer";
import { _lt } from "../../translation";
import {
  CellErrorLevel,
  CellErrorType,
  CircularDependencyError,
  EvaluationError,
  InvalidReferenceError,
  OverwriteDataError,
} from "../../types/errors";
import {
  Cell,
  CellPosition,
  CellValue,
  CellValueType,
  Command,
  CommandDispatcher,
  EnsureRange,
  EvalContext,
  Format,
  FormattedValue,
  FormulaCell,
  Getters,
  invalidateEvaluationCommands,
  MatrixArg,
  Position,
  PrimitiveArg,
  Range,
  ReferenceDenormalizer,
  UID,
  Zone,
} from "../../types/index";
import { UIPlugin } from "../ui_plugin";

const functionMap = functionRegistry.mapping;

type CompilationParameters = [ReferenceDenormalizer, EnsureRange, EvalContext];

export class EvaluationPlugin extends UIPlugin {
  static getters = ["evaluateFormula", "getRangeFormattedValues", "getRangeValues"] as const;

  private isUpToDate: Set<UID> = new Set(); // Set<sheetIds>
  private readonly evalContext: EvalContext;

  constructor(
    getters: Getters,
    state: StateObserver,
    dispatch: CommandDispatcher["dispatch"],
    config: ModelConfig,
    selection: SelectionStreamProcessor
  ) {
    super(getters, state, dispatch, config, selection);
    this.evalContext = config.evalContext;
  }

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  handle(cmd: Command) {
    if (invalidateEvaluationCommands.has(cmd.type)) {
      this.isUpToDate.clear();
    }
    switch (cmd.type) {
      case "UPDATE_CELL":
        if ("content" in cmd || "format" in cmd) {
          this.isUpToDate.clear();
        }
        break;
      case "ACTIVATE_SHEET": {
        this.evaluate(cmd.sheetIdTo);
        this.isUpToDate.add(cmd.sheetIdTo);
        break;
      }
      case "EVALUATE_CELLS":
        this.evaluate(cmd.sheetId);
        this.isUpToDate.add(cmd.sheetId);
        break;
      case "EVALUATE_ALL_SHEETS":
        this.evaluateAllSheets();
        break;
    }
  }

  finalize() {
    const sheetId = this.getters.getActiveSheetId();
    if (!this.isUpToDate.has(sheetId)) {
      this.evaluate(sheetId);
      this.isUpToDate.add(sheetId);
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  evaluateFormula(formulaString: string, sheetId: UID = this.getters.getActiveSheetId()): any {
    const compiledFormula = compile(formulaString);
    const params = this.getCompilationParameters(() => {});

    const ranges: Range[] = [];
    for (let xc of compiledFormula.dependencies) {
      ranges.push(this.getters.getRangeFromSheetXC(sheetId, xc));
    }
    return compiledFormula.execute(ranges, ...params).value;
  }

  /**
   * Return the value of each cell in the range as they are displayed in the grid.
   */
  getRangeFormattedValues(range: Range): FormattedValue[] {
    const sheet = this.getters.tryGetSheet(range.sheetId);
    if (sheet === undefined) return [];
    return this.getters
      .getCellsInZone(sheet.id, range.zone)
      .map((cell) => cell?.formattedValue || "");
  }

  /**
   * Return the value of each cell in the range.
   */
  getRangeValues(range: Range): (CellValue | undefined)[] {
    const sheet = this.getters.tryGetSheet(range.sheetId);
    if (sheet === undefined) return [];
    return this.getters.getCellsInZone(sheet.id, range.zone).map((cell) => cell?.evaluated.value);
  }

  // ---------------------------------------------------------------------------
  // Evaluator
  // ---------------------------------------------------------------------------

  private evaluate(sheetId: UID) {
    const cells = this.getters.getCells(sheetId);
    const compilationParameters = this.getCompilationParameters(computeCell);
    // a computed cell is a cell for wich we know its evaluated value
    const computedCells: { [cellId: string]: true | "waitingRefEvaluation" } = {};

    // Flag 1: main loop
    for (let cell of Object.values(cells)) {
      compilationParameters[2].__originCellPosition = undefined;
      computeCell(cell);
    } // Flag 1 end

    function computeCell(cell) {
      if (computedCells[cell.id] === true) {
        return;
      }
      if (cell.isEmpty()) {
        // in this case, the content of the cell is empty but since a formule can
        // spread values on several cells, the value can be infered from evaluation
        // of previous cells. So we need to evaluate previous cells to make sure
        // to know the current cell final value.
        computePreviousCells(cell);
      } else if (cell.isFormula()) {
        computeFormulaCell(cell);
      }
      computedCells[cell.id] = true;
    }

    function computePreviousCells(cell: Cell) {
      // in this function we want evaluate cells before the input cell
      // --> we want at the end of this function that the previous cells return
      // true if we interrogate each one with computedCells

      // Note that it's not necessary to execute directly this fonction if we are
      // in the main loop (see Flag 1). Indeed, in this loop, all previous cells
      // are supposed to be already evaluated.

      const originCellPosition = compilationParameters[2].__originCellPosition?.();
      if (originCellPosition) {
        // have originCellPosition not undefine
        // --> mean that we are in the process evaluation of a cell
        // --> mean precisely that we compute previousCells after an empty ref
        // --> mean precisely that we are not executing 'computePreviousCells' directly
        // in the main loop (Flag 1)
        const cellPosition = compilationParameters[2].getters.getCellPosition(cell.id);
        _computePreviousCells(cellPosition, originCellPosition);
      }
    }

    function _computePreviousCells(cellPosition: CellPosition, originCellPosition: CellPosition) {
      const sameSheet = cellPosition.sheetId === originCellPosition.sheetId;
      const startCol = cellPosition.col;
      const startRow = cellPosition.row;

      // this is the limit position to not evaluate the cells before:
      // When the cell originCell has the reference to the empty cell, all the cells
      // located before originCell will not be able to influence the evaluation
      // of the cells preceding the empty cell. It is therefore not necessary to
      // evaluate them.
      const positionLimit: Position =
        sameSheet &&
        originCellPosition.col < cellPosition.col &&
        originCellPosition.row < cellPosition.row
          ? { col: originCellPosition.col, row: originCellPosition.row }
          : { col: -1, row: -1 };

      let endRow = -1;

      // run the loop "for" in the opposite direction for performance reasons
      for (let col = startCol; col > -1; col--) {
        for (let row = startRow; row > endRow; row--) {
          // don't check the last cell (it's the evaluating cell)
          if (col === startCol && row === startRow) continue;

          if (col <= positionLimit.col) {
            endRow = positionLimit.row;
          }

          const cellToCompute = compilationParameters[2].getters.getCell(
            cellPosition.sheetId,
            col,
            row
          );

          if (computedCells[cellToCompute.id] === true) {
            positionLimit.col = col;
            positionLimit.row = row;
          } else {
            computeCell(cellToCompute);
          }
        }
      }
    }

    function computeFormulaCell(cell) {
      if (computedCells[cell.id] === "waitingRefEvaluation") {
        cell.assignError(CellErrorType.CircularDependency, new CircularDependencyError());
      }
      computedCells[cell.id] = "waitingRefEvaluation";

      try {
        compilationParameters[2].__originCellPosition = () => {
          // compute the value lazily for performance reasons
          return compilationParameters[2].getters.getCellPosition(cell.id);
        };

        const computedCell = cell.compiledFormula.execute(
          cell.dependencies,
          ...compilationParameters
        );

        if (Array.isArray(computedCell.value)) {
          if (compilationParameters[2].__lastFnCalled === undefined) {
            // if a value returns an array (like =A1:A3)
            throw new Error(_lt("This formula depends on invalid values"));
          }
          asignResultArray(cell, computedCell);
        } else {
          cell.assignEvaluation(computedCell.value, cell.format || computedCell.format);
        }
      } catch (e) {
        handleError(e, cell);
      }
    }

    function asignResultArray(cell, resultArray) {
      const position = compilationParameters[2].getters.getCellPosition(cell.id);
      const zoneToFill: Zone = {
        left: position.col,
        right: position.col + resultArray.value[0].length,
        top: position.row,
        bottom: position.row + resultArray.value.length,
      };

      // assert no ("content" or "evaluated value") present in the result zone
      // note that evaluated value could be an empty value come from other result array
      visitZone(zoneToFill, (col, row) => {
        // don't check the first cell
        if (col === zoneToFill.left && row === zoneToFill.top) return;

        const cellToFill = compilationParameters[2].getters.getCell(position.sheetId, col, row);
        if (!cellToFill === undefined && computedCells[cellToFill.id] === true) {
          cell.assignError(CellErrorType.OverwriteData, new OverwriteDataError());
        }
        // what's happening if computedCells[cellToFill.id] === "waiting" ?
        // if === "waiting" --> case 1: cell has content --> !computedCells.isEmpty() matching --> return error
        // if === "waiting" --> case 2: cell is empty ---> cell waiting value from other cells --> we give it the value in the next visitZone
      });

      // assert deep dependency references arn't present in the result zone
      visitDeepDependencies(cell, (dependency) => {
        if (dependency.sheetId === position.sheetId && overlap(dependency.zone, zoneToFill)) {
          cell.assignError(CellErrorType.CircularDependency, new CircularDependencyError());
        }
      });

      // fill the zoneToFill with the resultArray values
      visitZone(zoneToFill, (col, row) => {
        const cellToFill = compilationParameters[2].getters.getCell(position.sheetId, col, row);
        const value = resultArray.value[col - zoneToFill.left][row - zoneToFill.top];
        const format =
          cellToFill?.format || resultArray.format?.[col - zoneToFill.left][row - zoneToFill.top];

        cellToFill.assignEvaluation(value, format);
        computedCells[cellToFill.id] = true;
      });
    }

    function visitDeepDependencies(cell, cb: (dependency: Range) => void) {
      for (let dependency of cell.dependencies) {
        cb(dependency);

        visitZone(dependency.zone, (col, row) => {
          const deepCell = compilationParameters[2].getters.getCell(dependency.sheetId, col, row);
          visitDeepDependencies(deepCell, cb);
        });
      }
    }

    function handleError(e: Error | any, cell: FormulaCell) {
      if (!(e instanceof Error)) {
        e = new Error(e);
      }
      if (cell.evaluated.type !== CellValueType.error) {
        const msg = e?.errorType || CellErrorType.GenericError;
        // apply function name
        const __lastFnCalled = compilationParameters[2].__lastFnCalled || "";
        cell.assignError(
          msg,
          new EvaluationError(
            msg,
            e.message.replace("[[FUNCTION_NAME]]", __lastFnCalled),
            e.logLevel !== undefined ? e.logLevel : CellErrorLevel.error
          )
        );
      }
    }

    // REF visit zone helper
    // REF visitCells --> computedCells  /   type boolean | null --> true | "waitingRefEvaluation"
    // REF change __originCellXC to __originCellPosition
    // REF compilationParameters could retourn a dict
    // REF FormulaCell --> IFormulaCell
  }

  /**
   * Return all functions necessary to properly evaluate a formula:
   * - a refFn function to read any reference, cell or range of a normalized formula
   * - a range function to convert any reference to a proper value array
   * - an evaluation context
   */
  private getCompilationParameters(computeCell: (cell: Cell) => void): CompilationParameters {
    const evalContext = Object.assign(Object.create(functionMap), this.evalContext, {
      getters: this.getters,
    });
    const getters = this.getters;

    function readCell(range: Range): PrimitiveArg {
      let cell: Cell | undefined;
      if (!getters.tryGetSheet(range.sheetId)) {
        throw new Error(_lt("Invalid sheet name"));
      }
      cell = getters.getCell(range.sheetId, range.zone.left, range.zone.top);
      if (!cell || cell.isEmpty()) {
        // magic "empty" value
        // Returning {value: null} instead of undefined will ensure that we don't
        // fall back on the default value of the argument provided to the formula's compute function
        return { value: null };
      }
      return getEvaluatedCell(cell);
    }

    function getEvaluatedCell(cell: Cell): { value: CellValue; format?: Format } {
      computeCell(cell);
      if (cell.evaluated.type === CellValueType.error) {
        throw new EvaluationError(
          cell.evaluated.value,
          cell.evaluated.error.message,
          cell.evaluated.error.logLevel
        );
      }
      return cell.evaluated;
    }

    /**
     * Return the values of the cell(s) used in reference, but always in the format of a range even
     * if a single cell is referenced. It is a list of col values. This is useful for the formulas that describe parameters as
     * range<number> etc.
     *
     * Note that each col is possibly sparse: it only contain the values of cells
     * that are actually present in the grid.
     */
    function range(range: Range): MatrixArg {
      const sheetId = range.sheetId;

      if (!isZoneValid(range.zone)) {
        throw new InvalidReferenceError();
      }

      // Performance issue: Avoid fetching data on positions that are out of the spreadsheet
      // e.g. A1:ZZZ9999 in a sheet with 10 cols and 10 rows should ignore everything past J10 and return a 10x10 array
      const sheetZone = {
        top: 0,
        bottom: getters.getNumberRows(sheetId) - 1,
        left: 0,
        right: getters.getNumberCols(sheetId) - 1,
      };
      const result: MatrixArg = [];

      const zone = intersection(range.zone, sheetZone);
      if (!zone) {
        result.push([]);
        return result;
      }

      // Performance issue: nested loop is faster than a map here
      for (let col = zone.left; col <= zone.right; col++) {
        const rowValues: ({ value: CellValue; format?: Format } | undefined)[] = [];
        for (let row = zone.top; row <= zone.bottom; row++) {
          const cell = evalContext.getters.getCell(range.sheetId, col, row);
          rowValues.push(cell ? getEvaluatedCell(cell) : undefined);
        }
        result.push(rowValues);
      }
      return result;
    }

    /**
     * Returns the value of the cell(s) used in reference
     *
     * @param range the references used
     * @param isMeta if a reference is supposed to be used in a `meta` parameter as described in the
     *        function for which this parameter is used, we just return the string of the parameter.
     *        The `compute` of the formula's function must process it completely
     */
    function refFn(
      range: Range,
      isMeta: boolean,
      functionName: string,
      paramNumber?: number
    ): PrimitiveArg {
      if (isMeta) {
        // Use zoneToXc of zone instead of getRangeString to avoid sending unbounded ranges
        return { value: zoneToXc(range.zone) };
      }

      if (!isZoneValid(range.zone)) {
        throw new InvalidReferenceError();
      }

      // if the formula definition could have accepted a range, we would pass through the _range function and not here
      if (range.zone.bottom !== range.zone.top || range.zone.left !== range.zone.right) {
        throw new Error(
          paramNumber
            ? _lt(
                "Function %s expects the parameter %s to be a single value or a single cell reference, not a range.",
                functionName.toString(),
                paramNumber.toString()
              )
            : _lt(
                "Function %s expects its parameters to be single values or single cell references, not ranges.",
                functionName.toString()
              )
        );
      }

      if (range.invalidSheetName) {
        throw new Error(_lt("Invalid sheet name: %s", range.invalidSheetName));
      }

      return readCell(range);
    }
    return [refFn, range, evalContext];
  }

  /**
   * Triggers an evaluation of all cells on all sheets.
   */
  private evaluateAllSheets() {
    for (const sheetId of this.getters.getSheetIds()) {
      this.evaluate(sheetId);
      this.isUpToDate.add(sheetId);
    }
  }
}
