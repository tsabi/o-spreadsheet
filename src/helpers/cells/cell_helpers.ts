import { isBoolean, isDateTime, isNumber, parseDateTime, parseNumber } from "..";
import { CellValue, Format, FormattedValue } from "../../types";
import { createDefaultNumberFormat } from "../numbers";

/**
 * Format a cell value with its format.
 */
export function formatValue(value: CellValue, format?: Format): FormattedValue {
  switch (typeof value) {
    case "string":
      return value;
    case "boolean":
      return value ? "TRUE" : "FALSE";
    case "number":
      format = format || createDefaultNumberFormat(value);
      try {
        // @ts-ignore
        return window.SSF.format(format || "", value);
      } catch (e) {
        console.log(`value ${value} cannot be formatted with format ${format}`);
        return value.toString();
      }
    // if (format?.match(DATETIME_FORMAT)) {
    //   return formatDateTime({ value, format: format });
    // }
    // return format ? formatNumber(value, format) : formatStandardNumber(value);
    case "object":
      return "0";
  }
}

/**
 * Parse a string representing a primitive cell value
 */
export function parsePrimitiveContent(content: string): CellValue {
  if (content === "") {
    return "";
  } else if (isNumber(content)) {
    return parseNumber(content);
  } else if (isBoolean(content)) {
    return content.toUpperCase() === "TRUE" ? true : false;
  } else if (isDateTime(content)) {
    return parseDateTime(content)!.value;
  } else {
    return content;
  }
}
