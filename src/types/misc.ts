// -----------------------------------------------------------------------------
// MISC
// -----------------------------------------------------------------------------
import { ComponentConstructor } from "@odoo/owl/dist/types/component/component";
import { Token } from "../formulas";
import { Cell, CellValue } from "./cells";
import { CommandResult } from "./commands";
import { Format } from "./format";
import { Range } from "./range";

/**
 * The following type is meant to be used in union with other aliases to prevent
 * Intellisense from resolving it.
 * See https://github.com/microsoft/TypeScript/issues/31940#issuecomment-841712377
 */
export type Alias = {};

// Col/row Index
export type HeaderIndex = number & Alias;

// any DOM pixel value
export type Pixel = number & Alias;

export type UID = string & Alias;

export type SetDecimalStep = 1 | -1;

/**
 * CSS style color string
 * e.g. "#ABC", "#AAAFFF", "rgb(30, 80, 16)"
 */
export type Color = string & Alias;

export interface RGBA {
  a: number;
  r: number;
  g: number;
  b: number;
}

export interface HSLA {
  a: number;
  h: number;
  s: number;
  l: number;
}

export interface Link {
  label: string;
  url: string;
  /**
   * Specifies if the resource is external and can
   * be opened in a new tab.
   */
  isExternal?: boolean;
}

export interface Zone {
  left: HeaderIndex;
  right: HeaderIndex;
  top: HeaderIndex;
  bottom: HeaderIndex;
}

export interface AnchorZone {
  zone: Zone;
  cell: Position;
}

export interface Selection {
  anchor: AnchorZone;
  zones: Zone[];
}

export interface UnboundedZone {
  top: HeaderIndex;
  bottom: HeaderIndex | undefined;
  left: HeaderIndex;
  right: HeaderIndex | undefined;
  hasHeader?: boolean;
}

export interface ZoneDimension {
  height: HeaderIndex;
  width: HeaderIndex;
}

export type Align = "left" | "right" | "center" | undefined;
export interface Style {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  align?: Align;
  fillColor?: string;
  textColor?: string;
  fontSize?: number; // in pt, not in px!
}

export interface UpdateCellData {
  content?: string;
  formula?: string;
  style?: Style | null;
  format?: Format;
}

export interface Sheet {
  id: UID;
  name: string;
  numberOfCols: number;
  rows: Row[];
  areGridLinesVisible: boolean;
  isVisible: boolean;
}

export interface CellPosition {
  col: HeaderIndex;
  row: HeaderIndex;
  sheetId: UID;
}

// A border description is a pair [style, ]
export type BorderStyle = "thin" | "medium" | "thick" | "dashed" | "dotted" | "double";
export type BorderDescr = [BorderStyle, string];

export interface Border {
  top?: BorderDescr;
  left?: BorderDescr;
  bottom?: BorderDescr;
  right?: BorderDescr;
}

export type ReferenceDenormalizer = (
  range: Range,
  isMeta: boolean,
  functionName: string,
  paramNumber: number
) => any | any[][];

export type EnsureRange = (range: Range) => any[][];

export type NumberParser = (str: string) => number;

export type _CompiledFormula = (
  deps: Range[],
  refFn: ReferenceDenormalizer,
  range: EnsureRange,
  ctx: {}
) => FunctionReturn;

export interface CompiledFormula {
  execute: _CompiledFormula;
  tokens: Token[];
  dependencies: string[];
}

export type Arg = MatrixArg | PrimitiveArg;
export type MatrixArg = ({ value: CellValue; format?: Format } | undefined)[][];
export type PrimitiveArg = { value: PrimitiveArgValue; format?: Format };

export type ArgValue = PrimitiveArgValue | MatrixArgValue;
export type MatrixArgValue = (CellValue | undefined)[][];
export type PrimitiveArgValue = string | number | boolean | null;

export type FunctionReturn = { value: ReturnValue; format?: Format };
export type ReturnValue = string | number | boolean;

export interface ClipboardCell {
  cell?: Cell;
  border?: Border;
  position: CellPosition;
}

export interface HeaderDimensions {
  start: Pixel;
  size: Pixel;
  end: Pixel;
}

export interface Row {
  cells: Record<number, UID | undefined>; // number is a column index
}

export interface Position {
  col: HeaderIndex;
  row: HeaderIndex;
}
export interface Merge extends Zone {
  id: number;
  topLeft: Position;
}

export interface Highlight {
  zone: Zone;
  sheetId: UID;
  color: string | null;
}

export type BorderCommand =
  | "all"
  | "hv"
  | "h"
  | "v"
  | "external"
  | "left"
  | "top"
  | "right"
  | "bottom"
  | "clear";

export type BorderDescription = { vertical?: BorderDescr; horizontal?: BorderDescr } | undefined;

export const enum DIRECTION {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

export type ChangeType = "REMOVE" | "RESIZE" | "MOVE" | "CHANGE" | "NONE";
export type ApplyRangeChangeResult =
  | { changeType: Exclude<ChangeType, "NONE">; range: Range }
  | { changeType: "NONE" };
export type ApplyRangeChange = (range: Range) => ApplyRangeChangeResult;

export type Dimension = "COL" | "ROW";

export type ConsecutiveIndexes = HeaderIndex[];

export interface RangeProvider {
  adaptRanges: (applyChange: ApplyRangeChange, sheetId?: UID) => void;
}

export type Validation<T> = (toValidate: T) => CommandResult | CommandResult[];

export type ClipboardOptions = "onlyFormat" | "onlyValue";

export type Increment = 1 | -1 | 0;

export interface Ref<T> {
  el: T | null;
}

/**
 * Return the prop's type of a component
 */
export type PropsOf<C> = C extends ComponentConstructor<infer Props> ? Props : never;

/**
 * Container for a lazy computed value
 */
export interface Lazy<T> {
  /**
   * Return the computed value.
   * The value is computed only once and memoized.
   */
  (): T;
  /**
   * Map a lazy value to another lazy value.
   *
   * ```ts
   * // neither function is called here
   * const lazyValue = lazy(() => veryExpensive(...)).map((result) => alsoVeryExpensive(result));
   *
   * // both values are computed now
   * const value = lazyValue()
   * ```
   */
  map: <U>(callback: (value: T) => U) => Lazy<U>;
}

export interface Cloneable<T> {
  clone: (args?: Partial<T>) => T;
}

export interface SortOptions {
  hasNoHeader?: boolean;
  emptyCellAsZero?: boolean;
}
