import { DATETIME_FORMAT } from "../../constants";
import {
  BooleanEvaluation,
  CellEvaluation,
  CellValueType,
  EmptyEvaluation,
  EvaluatedCell,
  Format,
  InvalidEvaluation,
  NumberEvaluation,
  TextEvaluation,
} from "../../types";
import { CellErrorType, EvaluationError } from "../../types/errors";
import { formatValue } from "../format";
/**
 * Abstract base implementation of a cell.
 * Concrete cell classes are responsible to build the raw cell `content` based on
 * whatever data they have (formula, string, ...).
 */
abstract class AbstractEvaluatedCell<T extends CellEvaluation = CellEvaluation>
  implements EvaluatedCell
{
  readonly evaluation: T;
  readonly url?: string;

  constructor(evaluation: T, url?: string) {
    this.evaluation = evaluation; //{ ...evaluated, format: evaluated.format || properties.format };
    this.url = url;
  }

  get formattedValue() {
    return formatValue(this.evaluation.value, this.evaluation.format);
  }

  abstract get composerContent();

  get defaultAlign() {
    switch (this.evaluation.type) {
      case CellValueType.number:
      case CellValueType.empty:
        return "right";
      case CellValueType.boolean:
      case CellValueType.error:
        return "center";
      case CellValueType.text:
        return "left";
    }
  }

  /**
   * Only empty cells, text cells and numbers are valid
   */
  get isAutoSummable() {
    switch (this.evaluation.type) {
      case CellValueType.empty:
      case CellValueType.text:
        return true;
      case CellValueType.number:
        return !this.evaluation.format?.match(DATETIME_FORMAT);
      case CellValueType.error:
      case CellValueType.boolean:
        return false;
    }
  }
}

export class EvaluatedCellEmpty extends AbstractEvaluatedCell<EmptyEvaluation> {
  constructor(format?: string, url?: string) {
    super({ value: "", type: CellValueType.empty, format }, url);
  }
  get composerContent() {
    return "";
  }
}

export class EvaluatedCellNumber extends AbstractEvaluatedCell<NumberEvaluation> {
  constructor(value: number, format?: string, url?: string) {
    super({ value: value, type: CellValueType.number, format }, url);
  }

  get composerContent() {
    if (this.evaluation.format?.includes("%")) {
      return `${this.evaluation.value * 100}%`;
    }
    return formatValue(this.evaluation.value);
  }
}

export class EvaluatedCellBoolean extends AbstractEvaluatedCell<BooleanEvaluation> {
  constructor(value: boolean, format?: string, url?: string) {
    super({ value: value, type: CellValueType.boolean, format }, url);
  }

  get composerContent() {
    return this.evaluation.value ? "TRUE" : "FALSE";
  }
}
export class EvaluatedCellText extends AbstractEvaluatedCell<TextEvaluation> {
  constructor(value: string, format?: string, url?: string) {
    super({ value: value, type: CellValueType.text, format }, url);
  }

  get composerContent() {
    return this.evaluation.value;
  }
}

/**
 * A date time cell is a number cell with a required
 * date time format.
 */
export class EvaluatedCellDateTime extends EvaluatedCellNumber {
  constructor(value: number, format: Format, url?: string) {
    super(value, format, url);
  }

  get composerContent() {
    return this.formattedValue;
  }
}

/**
 * Cell containing a formula which could not be compiled
 * or a content which could not be parsed.
 */
export class EvaluatedCellBadFormula extends AbstractEvaluatedCell<InvalidEvaluation> {
  constructor(error: EvaluationError) {
    super({
      value: CellErrorType.BadExpression,
      type: CellValueType.error,
      error,
    });
  }

  get composerContent() {
    return this.evaluation.value;
  }
}
