import { formatDateTime } from ".";
import { DATETIME_FORMAT } from "..";
import { CellValue, Format, FormattedValue } from "../types";

/**
 *  Constant used to indicate the maximum of digits that is possible to display
 *  in a cell with standard size.
 */
const STANDARD_MAX_SIGNIFICANT_DIGITS = 10;

const MAX_DECIMAL_PLACES = 20;

const thousandsGroupsRegexp = /(\d+?)(?=(\d{3})+(?!\d)|$)/g;

const zeroRegexp = /0/g;

export interface InternalNumberFormat {
  integerPart: string;
  decimalPart?: string; // optional because we need to differentiate a number with a dot but no decimals with a number without any decimals. '5.'  !=== '5' !=== '5.0'
  scientificPart?: string;
  percentPart?: boolean;
}

export interface InternalDateFormat {
  datePart: string;
}

export type InternalFormat = InternalNumberFormat | InternalDateFormat;
/**
 * Format a cell value with its format.
 */
export function applyFormat(value: CellValue, format?: Format): FormattedValue {
  switch (typeof value) {
    case "string":
      return value;
    case "boolean":
      return value ? "TRUE" : "FALSE";
    case "number":
      if (format?.match(DATETIME_FORMAT)) {
        return formatDateTime({ value, format: format });
      }
      if (format) {
        // transform to internalNumberFormat
        return applyNumberFormat(value, format);
      }
      return applyNumberFormat(value);
    case "object":
      return "0";
  }
}

export function applyNumberFormat(
  value: number,
  numberFormat: InternalNumberFormat | undefined = undefined
): FormattedValue {
  if (value < 0) {
    return "-" + applyNumberFormat(-value, numberFormat);
  }

  if (numberFormat === undefined) {
    numberFormat = createDefaultFormat(value);
  }

  // Starting from here; we have an InternalNumberFormat

  const format: InternalNumberFormat = {
    decimalPart: "",
    integerPart: "0",
    // scientificPart: "E+00",
    percentPart: true,
  };

  if (format.percentPart) {
    value = value * 100;
  }

  let formattedValue = applyIntegerFormat(value, format.integerPart);

  if (format.decimalPart) {
    formattedValue += "." + applyDecimalFormat(value, format.decimalPart);
  }

  // if(format.scientificPart){
  //   formattedValue += applyDecimalFormat(format.scientificPart)
  // }

  if (format.percentPart) {
    formattedValue += "%";
  }

  return formattedValue;
}

function applyIntegerFormat(value: number, integerFormat: string): string {
  const hasSeparator = integerFormat.includes(",");
  integerFormat = integerFormat.replace(/,/g, "");
  const { integerDigits } = splitNumber(value);
  const _integerDigits = integerDigits === "0" ? "" : integerDigits;

  let formattedInteger = _integerDigits;
  const delta = integerFormat.length - _integerDigits.length;
  if (delta > 0) {
    // ex: format = "0#000000" and integerDigit: "123"
    const restIntegerFormat = integerFormat.substring(0, delta); // restIntegerFormat = "0#00"
    const countZero = (restIntegerFormat.match(zeroRegexp) || []).length; // countZero = 3
    formattedInteger = "0".repeat(countZero) + formattedInteger; // return "000123"
  }

  if (hasSeparator) {
    formattedInteger = formattedInteger.match(thousandsGroupsRegexp)?.join(",") || formattedInteger; // in this case formattedInteger
  }

  return formattedInteger;
  //  integerValue = "123"  integerFormat = "0"  --> "123"
  //  integerValue = "123"  integerFormat = ""  --> "123"
  //  integerValue = "123"  integerFormat = "#"  --> "123"
  //  integerValue = ""     integerFormat = "0"  --> "0"
  //  integerValue = ""     integerFormat = "#"  --> ""
  //  integerValue = ""     integerFormat = ""  --> ""
  //  integerValue = "123"  integerFormat = "000"  --> "123"
  //  integerValue = "123"  integerFormat = "0000"  --> "0123"
  //  integerValue = "123"  integerFormat = "0###"  --> "0123"
  //  integerValue = "123"  integerFormat = "#0###"  --> "0123"
  //  integerValue = "123"  integerFormat = "0#0###"  --> "00123"
  //  integerValue = "123"  integerFormat = "0#0#0#"  --> "00123"
}

/**
 * Rounds a number to its {precision}-th decimal.
 * Inspired by https://www.delftstack.com/howto/javascript/javascript-round-to-2-decimal-places/#use-double-rounding-to-round-a-number-to2-decimal-places-in-javascript
 */
function round(num: number, precision: number = 2) {
  var m = Number((Math.abs(num) * 10 ** precision).toPrecision(15));
  return (Math.round(m) / 10 ** precision) * Math.sign(num);
}

function applyDecimalFormat(value: number, decimalFormat: string): string {
  // assume the format is valid (no commas)
  const { decimalDigits } = splitNumber(value);
  const _decimalDigits = decimalDigits === undefined ? "" : decimalDigits;

  let formattedDecimals = _decimalDigits;
  const decimalFormatLength = decimalFormat.length;
  const delta = decimalFormatLength - _decimalDigits.length;

  if (delta > 0) {
    const restDecimalFormat = decimalFormat.substring(
      decimalFormatLength - delta,
      decimalFormatLength + 1
    );
    const countZero = (restDecimalFormat.match(zeroRegexp) || []).length; // countZero = 3
    formattedDecimals = formattedDecimals + "0".repeat(countZero);
  }
  if (delta < 0) {
    formattedDecimals = splitNumber(round(value % 1, decimalFormat.length)).decimalDigits!;
  }

  return formattedDecimals;

  // decimal value is actually an integer !!!
  //  decimalValue = ".123"  decimalFormat = "0"  --> "1"
  //  decimalValue = ".19"   decimalFormat = "0"  --> "2"
  //  decimalValue = ".123"  decimalFormat = ""  --> ""
  //  decimalValue = ".123"  decimalFormat = "#"  --> "1"
  //  decimalValue = ""      decimalFormat = "0"  --> "0"
  //  decimalValue = ""      decimalFormat = "#"  --> ""
  //  decimalValue = ""      decimalFormat = ""  --> ""
  //  decimalValue = ".123"  decimalFormat = "000"  --> "123"
  //  decimalValue = ".123"  decimalFormat = "0000"  --> "1230"
  //  decimalValue = ".123"  decimalFormat = "0###"  --> "123"
  //  decimalValue = ".123"  decimalFormat = "###0#"  --> "1230"
  //  decimalValue = ".123"  decimalFormat = "0#0#0#"  --> "1230"
  //  decimalValue = ".123"  decimalFormat = "###0#0"  --> "12300"
  //  decimalValue = ".123"  decimalFormat = "#0#0#0"  --> "12300"
}

const decimalStandardRepresentation = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumFractionDigits: MAX_DECIMAL_PLACES,
});

function splitNumber(value: number): { integerDigits: string; decimalDigits: string | undefined } {
  const [integerDigits, decimalDigits] = decimalStandardRepresentation.format(value).split(".");
  return { integerDigits, decimalDigits };
}

// // format = "###0.0E+00%" exemple
// const parts = format.split(".");
// const decimals = parts.length === 1 ? 0 : parts[1].match(/0/g)!.length;
// const separator = parts[0].includes(",") ? "," : "";
// const isPercent = format.includes("%");
// if (isPercent) {
//   absValue = absValue * 100;
// }
// const rawNumber = formatDecimal(absValue, decimals, separator);
// if (isPercent) {
//   return rawNumber + "%";
// }
// return rawNumber;

export function createDefaultFormat(value: number): InternalNumberFormat {
  //   if (requiresScientificFormat(value)) {
  //     return {
  //       integerPart: "0",
  //       decimalPart: "#####",
  //       scientificPart: "E+00",
  //     };
  //   }
  const decimalDigitsLength = (value % 1).toString().length - 2;
  return {
    integerPart: "0",
    decimalPart: "0".repeat(Math.max(decimalDigitsLength, MAX_DECIMAL_PLACES)),
  };
}

export function createComposerNumberFormat(value: number): InternalNumberFormat {
  if (requiresScientificFormat(value)) {
    return {
      integerPart: "0",
      decimalPart: "#".repeat(MAX_DECIMAL_PLACES),
      scientificPart: "E+00",
    };
  }
  return {
    integerPart: "0",
    decimalPart: "#".repeat(MAX_DECIMAL_PLACES),
  };
}

/**
 * Returns wether a number's amount of relevant digits is
 */
function requiresScientificFormat(
  n: number,
  limit: number = STANDARD_MAX_SIGNIFICANT_DIGITS
): boolean {
  const bornSup = 10 ** limit;
  const bornInf = 1 / 10 ** (limit - 1);
  return n < bornInf || bornSup <= n;
}

export function changeNumberFormatDecimalPlaces(
  format: InternalNumberFormat,
  step: number
): InternalNumberFormat {
  const sign = Math.sign(step);
  const decimalLength = format.decimalPart?.length || 0;
  format.decimalPart = "0".repeat(Math.max(decimalLength + sign, MAX_DECIMAL_PLACES));
  if (format.decimalPart === "") {
    delete format.decimalPart;
  }
  return format;
}
