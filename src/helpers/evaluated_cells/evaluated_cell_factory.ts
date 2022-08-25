import { isDateTimeFormat } from "..";
import { evaluatedCellRegistry } from "../../registries/cell_types";
import { EvaluatedCell } from "../../types";
import { parseDateTime } from "../dates";
import { isBoolean, isDateTime, isMarkdownLink, isWebLink, parseMarkdownLink } from "../misc";
import { isNumber, parseNumber } from "../numbers";
import {
  EvaluatedCellBoolean,
  EvaluatedCellDateTime,
  EvaluatedCellEmpty,
  EvaluatedCellNumber,
  EvaluatedCellText,
} from "./evaluated_cell_types";

evaluatedCellRegistry
  .add("EmptyLabel", {
    sequence: 10,
    match: (label) => label === "",
    createEvaluatedCell: (label, format, url) => new EvaluatedCellEmpty(format, url),
  })
  .add("NumberLabelWithDateTimeFormat", {
    sequence: 20,
    match: (label, format) => !!format && isNumber(label) && isDateTimeFormat(format),
    createEvaluatedCell: (label, format, url) =>
      new EvaluatedCellDateTime(parseNumber(label), format!, url),
  })
  .add("NumberLabel", {
    sequence: 30,
    match: (label) => isNumber(label),
    createEvaluatedCell: (label, format, url) => {
      if (!format) {
        format = detectNumberFormat(label);
      }
      return new EvaluatedCellNumber(parseNumber(label), format, url);
    },
  })
  .add("BooleanLabel", {
    sequence: 40,
    match: (label) => isBoolean(label),
    createEvaluatedCell: (label, format, url) => {
      return new EvaluatedCellBoolean(label.toUpperCase() === "TRUE" ? true : false, format, url);
    },
  })
  .add("DateTimeLabelWithNumberFormat", {
    sequence: 50,
    match: (label, format) => !!format && isDateTime(label) && !isDateTimeFormat(format),
    createEvaluatedCell: (label, format, url) => {
      const internalDate = parseDateTime(label)!;
      return new EvaluatedCellNumber(internalDate.value, format, url);
    },
  })
  .add("DateTimeLabel", {
    sequence: 60,
    match: (label) => isDateTime(label),
    createEvaluatedCell: (label, format, url) => {
      const internalDate = parseDateTime(label)!;
      format = format || internalDate.format;
      return new EvaluatedCellDateTime(internalDate.value, format, url);
    },
  });

/**
 * Return a factory function which can instantiate evaluated cells of
 * different types, based on a raw cell content.
 *
 * ```
 * // the createEvaluatedCell function can be used to instantiate new  evaluated cells
 * const createEvaluatedCell = evaluatedCellFactory();
 * const cell = createEvaluatedCell(id, cellContent, cellProperties, sheetId)
 * ```
 */
export function evaluatedCellFactory() {
  const builders = evaluatedCellRegistry.getAll().sort((a, b) => a.sequence - b.sequence);
  return function createEvaluatedCell(content: string, format: string): EvaluatedCell {
    let label = content;
    let url: string | undefined = undefined;

    if (isMarkdownLink(content)) {
      const parsedMarkdown = parseMarkdownLink(content);
      label = parsedMarkdown.label;
      url = parsedMarkdown.url;
    } else if (isWebLink(content)) {
      url = content;
    }

    const builder = builders.find((factory) => factory.match(label, format));
    if (!builder) {
      return new EvaluatedCellText(label, format, url);
    }

    return builder.createEvaluatedCell(label, format, url);
  };
}

function detectNumberFormat(content: string): string | undefined {
  const digitBase = content.includes(".") ? "0.00" : "0";
  const matchedCurrencies = content.match(/[\$€]/);
  if (matchedCurrencies) {
    const matchedFirstDigit = content.match(/[\d]/);
    const currency = "[$" + matchedCurrencies.values().next().value + "]";
    if (matchedFirstDigit!.index! < matchedCurrencies.index!) {
      return "#,##" + digitBase + currency;
    }
    return currency + "#,##" + digitBase;
  }
  if (content.includes("%")) {
    return digitBase + "%";
  }
  return undefined;
}
