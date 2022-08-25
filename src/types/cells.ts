import { EvaluationError } from "./errors";
import { Format, FormattedValue } from "./format";
import { CompiledFormula, Style, UID } from "./misc";
import { Range } from "./range";

export type Cell = BasicCell | CompiledFormulaCell;
export interface BasicCell {
  readonly id: UID;
  /**
   * Raw cell content
   */
  readonly content: string;
  readonly style?: Style;
  readonly format?: Format;
  readonly isFormula: boolean;
}

export interface CompiledFormulaCell extends BasicCell {
  readonly compiledFormula: CompiledFormula;
  readonly dependencies: Range[];
}

export interface EvaluatedCell {
  /**
   * Evaluated cell content
   */
  readonly evaluation: CellEvaluation;
  /**
   * Evaluated cell displayed in the composer.
   */
  readonly composerContent: string;
  readonly url?: string;
  /**
   * Evaluated cell formatted based on the format
   */
  readonly formattedValue: FormattedValue;
  readonly defaultAlign: "right" | "center" | "left";
  /**
   * Can the evaluated cell appear in an automatic sum zone.
   */
  readonly isAutoSummable: boolean;
}

export type CellValue = string | number | boolean;

export type CellEvaluation =
  | NumberEvaluation
  | TextEvaluation
  | BooleanEvaluation
  | EmptyEvaluation
  | InvalidEvaluation;

export type NumberEvaluation = {
  readonly type: CellValueType.number;
  readonly value: number;
  readonly format?: Format;
};

export type TextEvaluation = {
  readonly type: CellValueType.text;
  readonly value: string;
  readonly format?: Format;
};

export type BooleanEvaluation = {
  readonly type: CellValueType.boolean;
  readonly value: boolean;
  readonly format?: Format;
};

export type EmptyEvaluation = {
  readonly type: CellValueType.empty;
  readonly value: "";
  readonly format?: Format;
};

export type InvalidEvaluation = {
  readonly type: CellValueType.error;
  readonly value: string;
  readonly error: EvaluationError;
  readonly format?: Format;
};

export enum CellValueType {
  boolean = "boolean",
  number = "number",
  text = "text",
  empty = "empty",
  error = "error",
}
