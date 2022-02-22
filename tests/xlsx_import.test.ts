import { ICON_SETS } from "../src/components/icons";
import {
  buildSheetLink,
  markdownLink,
  numberToLetters,
  toCartesian,
  toXC,
  toZone,
} from "../src/helpers";
import { Border, CellIsRule, ChartUIDefinition, IconSet, IconSetRule, Style } from "../src/types";
import { XLSXCFOperatorType, XLSXSharedFormula } from "../src/types/xlsx";
import { rgbaToInt } from "../src/xlsx/conversion/color_conversion";
import { adaptFormula } from "../src/xlsx/conversion/formula_conversion";
import {
  TABLE_BORDER_STYLE,
  TABLE_HEADER_STYLE,
  TABLE_HIGHLIGHTED_CELL_STYLE,
} from "../src/xlsx/conversion/table_conversion";
import { getRelativePath } from "../src/xlsx/helpers/misc";
import { XlsxReader } from "../src/xlsx/xlsx_reader";
import { SheetData, WorkbookData } from "./../src/types/workbook_data";
import {
  BORDER_STYLE_CONVERSION_MAP,
  CF_THRESHOLD_CONVERSION_MAP,
  CF_TYPE_CONVERSION_MAP,
  convertCFCellIsOperator,
  H_ALIGNMENT_CONVERSION_MAP,
  ICON_SET_CONVERSION_MAP,
} from "./../src/xlsx/conversion/conversion_maps";
import {
  findCellWithContent,
  findCFWithRange,
  findCFWithRangeBeginningAt,
  findXcCellWithContent,
  getColPosition,
  getRowPosition,
  getWorkbookCell,
  getWorkbookCellBorder,
  getWorkbookCellFormat,
  getWorkbookCellStyle,
  getWorkbookSheet,
  standardizeColor,
} from "./test_helpers/xlsx";
import { get_demo_xlsx } from "./__xlsx__/read_demo_xlsx";

describe("Import xlsx data", () => {
  let convertedData: WorkbookData;
  beforeAll(() => {
    const demo_xlsx = get_demo_xlsx();
    const reader = new XlsxReader(demo_xlsx);
    convertedData = reader.convertXlsx();
  });

  // test("Yep", () => {
  //   const demo_xlsx = get_demo_xlsx();
  //   let reader;
  //   try {
  //     reader = new XlsxReader(demo_xlsx);
  //     //@ts-ignore
  //     reader.convertXlsx();
  //     console.log(reader.errorManager.warnings);
  //     // console.log(converted);
  //   } catch (e) {
  //     console.log(e.stack);
  //     console.log(reader?.errorManager.warnings);
  //   }
  // });

  test("Can import cell content", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const cellXC = findXcCellWithContent("string", testSheet);
    expect(cellXC).toBeTruthy();
  });

  test("Can import formula", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const cellXC = findXcCellWithContent("=SUM(A1)", testSheet);
    expect(cellXC).toBeTruthy();
  });

  test("Can import merge", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const mergeXc = findXcCellWithContent("merge 2x2", testSheet)!;
    const mergeTopPosition = toCartesian(mergeXc);
    const mergeRange =
      mergeXc + `:${numberToLetters(mergeTopPosition[0] + 1)}${mergeTopPosition[1] + 2}`;
    expect(testSheet.merges.includes(mergeRange)).toBeTruthy();
  });

  test("Can import hyperlink", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const linkXc = findXcCellWithContent(
      markdownLink("hyperlink", "https://www.odoo.com/"),
      testSheet
    );
    expect(linkXc).toBeTruthy();
    const sheetLink = markdownLink("sheetLink", buildSheetLink("jestSheet"));
    const sheetLinkXc = findXcCellWithContent(sheetLink, testSheet);
    expect(sheetLinkXc).toBeTruthy();
  });

  test("Can import row size", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const xc = findXcCellWithContent("rowSize 100", testSheet)!;
    const position = toCartesian(xc);
    expect(testSheet.rows[position[1]].size).toEqual(100);
  });

  test("Can import col size", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const xc = findXcCellWithContent("colSize 100", testSheet)!;
    const position = toCartesian(xc);
    // Columns size in excel are dumb, I don't want to spend days finding out exactly how it works.
    // In the UI it was saying "size 13.57, 100 px", then it saves size = 14.28 in the xml...
    // And if I open and save the xlsx with Excel in another language it changes the size...
    expect(testSheet.cols[position[0]].size).toBeTruthy();
  });

  test("Can import hidden rows", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const xc = findXcCellWithContent("hidden row", testSheet)!;
    const position = toCartesian(xc);
    expect(testSheet.rows[position[1]].isHidden).toBeTruthy();
  });

  test("Can import hidden cols", () => {
    const testSheet = getWorkbookSheet("jestSheet", convertedData)!;
    const xc = findXcCellWithContent("hidden col", testSheet)!;
    const position = toCartesian(xc);
    expect(testSheet.cols[position[0]].isHidden).toBeTruthy();
  });

  test.each([
    "darkGray",
    "mediumGray",
    "lightGray",
    "gray0625",
    "darkHorizontal",
    "darkVertical",
    "darkDown",
    "darkUp",
    "darkGrid",
    "darkTrellis",
    "lightHorizontal",
    "lightVertical",
    "lightDown",
    "lightUp",
    "lightGrid",
    "lightTrellis",
  ])("Can import fills", (fillType) => {
    const testSheet = getWorkbookSheet("jestStyles", convertedData)!;
    const cell = findCellWithContent(fillType, testSheet)!;
    const cellStyle = getWorkbookCellStyle(cell, convertedData);
    expect(standardizeColor(cellStyle!.fillColor!)).toEqual("#FFC000FF");
  });

  test.each([
    "thin",
    "hair",
    "dotted",
    "dashDotDot",
    "dashDot",
    "dashed",
    "mediumDashDotDot",
    "slantDashDot",
    "mediumDashDot",
    "mediumDashed",
    "medium",
    "thick",
    "double",
    "thick #ff0000",
  ])("Can import borders", (borderType) => {
    const testSheet = getWorkbookSheet("jestStyles", convertedData)!;
    const cell = findCellWithContent(borderType, testSheet)!;
    const cellBorders = getWorkbookCellBorder(cell, convertedData)!;
    const cellContentSplit = borderType.split(" ");
    const expectedBorderStyle = BORDER_STYLE_CONVERSION_MAP[cellContentSplit[0]];
    const expectedBorderColor =
      cellContentSplit.length === 2 ? standardizeColor(cellContentSplit[1]) : "#000000FF";
    for (let side of ["top", "bottom", "left", "right"]) {
      expect([cellBorders[side][0], standardizeColor(cellBorders[side][1])]).toEqual([
        expectedBorderStyle,
        expectedBorderColor,
      ]);
    }
  });

  test.each([
    "general",
    "left",
    "center",
    "right",
    "fill",
    "justify",
    "centerContinuous",
    "distributed",
  ])("Can import Horizontal Alignements", (alignType) => {
    const testSheet = getWorkbookSheet("jestStyles", convertedData)!;
    // In sheet : cell at (x,y) : name of alignment, cell at (x+1, y) text with the alignment
    const descrCellPosition = toCartesian(findXcCellWithContent(alignType, testSheet)!);
    const styledCell = testSheet.cells[toXC(descrCellPosition[0] + 1, descrCellPosition[1])]!;
    const cellStyle = getWorkbookCellStyle(styledCell, convertedData);
    expect(cellStyle?.align).toEqual(H_ALIGNMENT_CONVERSION_MAP[alignType]);
  });

  test.each(["0.00", "0.00%", "m/d/yyyy"])("Can import formats", (format) => {
    const testSheet = getWorkbookSheet("jestStyles", convertedData)!;
    // In sheet : cell at (x,y) content = format, cell at (x+1, y) content = text with the format
    const descrCellPosition = toCartesian(findXcCellWithContent(format, testSheet)!);
    const formattedCell = testSheet.cells[toXC(descrCellPosition[0] + 1, descrCellPosition[1])]!;
    const cellFormat = getWorkbookCellFormat(formattedCell, convertedData);
    expect(cellFormat).toEqual(format);
  });

  test.each(["Normal", "Red", "Italic", "Bold", "Striked", "Underlined", "size12", "size16"])(
    "Can import font styles",
    (style) => {
      const testSheet = getWorkbookSheet("jestStyles", convertedData)!;
      const cell = findCellWithContent(style, testSheet)!;
      const cellStyle = getWorkbookCellStyle(cell, convertedData);
      switch (style) {
        case "Normal":
          expect(cellStyle).toBeUndefined();
          break;
        case "Red":
          expect(standardizeColor(cellStyle!.textColor!)).toEqual("#FF0000FF");
          break;
        case "Italic":
          expect(cellStyle!.italic).toBeTruthy();
          break;
        case "Bold":
          expect(cellStyle!.bold).toBeTruthy();
          break;
        case "Striked":
          expect(cellStyle!.strikethrough).toBeTruthy();
          break;
        case "Underlined":
          expect(cellStyle!.underline).toBeTruthy();
          break;
        case "size12":
          expect(cellStyle!.fontSize).toEqual(12);
          break;
        case "size16":
          expect(cellStyle!.fontSize).toEqual(16);
          break;
      }
    }
  );

  test("Can import conditional formats", () => {
    const testSheet = getWorkbookSheet("jestCfs", convertedData)!;
    const originCellXc = findXcCellWithContent("Conditional Formats:", testSheet)!;
    const position = toCartesian(originCellXc);
    let cell = testSheet.cells[toXC(position[0], ++position[1])];
    while (cell && cell.content) {
      const splittedCellContent = cell.content.split(" ");
      const ruleType = splittedCellContent[0];
      const cellIsOperator = splittedCellContent[1];
      const cf = findCFWithRangeBeginningAt(`${toXC(position[0] + 1, position[1])}`, testSheet)!;

      let operator = "";
      const values: string[] = [];
      switch (ruleType) {
        case "containsErrors":
        case "notContainsErrors":
        case "timePeriod":
        case "aboveAverage":
        case "top10":
        case "uniqueValues":
        case "duplicateValues":
        case "dataBar":
        case "expression":
          // Unsupported CF type
          position[1] += 1;
          cell = testSheet.cells[toXC(position[0], position[1])];
          continue;
        case "containsText":
        case "notContainsText":
        case "beginsWith":
        case "endsWith":
          operator = CF_TYPE_CONVERSION_MAP[ruleType]!;
          values.push("rule");
          break;
        case "containsBlanks":
        case "notContainsBlanks":
          operator = CF_TYPE_CONVERSION_MAP[ruleType]!;
          break;
        case "cellIs":
          operator = convertCFCellIsOperator(cellIsOperator as XLSXCFOperatorType);
          values.push("2");
          if (["between", "notBetween"].includes(cellIsOperator)) {
            values.push("4");
          }
          break;
      }
      expect(cf.rule.type).toEqual("CellIsRule");
      expect((cf.rule as CellIsRule).operator).toEqual(operator);
      expect((cf.rule as CellIsRule).values).toEqual(values);

      position[1] += 1;
      cell = testSheet.cells[toXC(position[0], position[1])];
    }
  });

  test("Can import Color Scales", () => {
    const testSheet = getWorkbookSheet("jestCfs", convertedData)!;
    const originCellXc = findXcCellWithContent("Color Scales:", testSheet)!;
    const position = toCartesian(originCellXc);
    let cell = testSheet.cells[toXC(position[0], ++position[1])];
    while (cell && cell.content) {
      const cf = findCFWithRange(
        `${toXC(position[0] + 1, position[1])}:${toXC(position[0] + 3, position[1])}`,
        testSheet
      )!;
      const cellContentSplit = cell.content.split(" ");
      const numberOfThresholds = Number(cellContentSplit[0]);
      const thresholdType = cellContentSplit[2];
      let values: (string | undefined)[] = [];
      switch (thresholdType) {
        case "max":
          values = [undefined, undefined];
          break;
        case "num":
          values = ["1", "5"];
          break;
        case "percent":
        case "percentile":
          values = ["10", "90"];
          break;
        case "formula":
          values = ["$J$6", "$H$6"];
          break;
      }
      const minThreshold = {
        color: rgbaToInt("#ed7d31"),
        type: CF_THRESHOLD_CONVERSION_MAP[thresholdType],
        value: values[0],
      };
      const maxThreshold = {
        color: rgbaToInt("#ffc000"),
        type: CF_THRESHOLD_CONVERSION_MAP[thresholdType],
        value: values[1],
      };
      const middleThresold =
        numberOfThresholds === 2
          ? undefined
          : {
              color: rgbaToInt("#f69e19"),
              type: "percentile",
              value: "50",
            };

      expect(cf.rule).toMatchObject({
        type: "ColorScaleRule",
        minimum: minThreshold,
        maximum: maxThreshold,
        midpoint: middleThresold,
      });

      position[1] += 1;
      cell = testSheet.cells[toXC(position[0], position[1])];
    }
  });

  test("Can import icon sets", () => {
    const testSheet = getWorkbookSheet("jestCfs", convertedData)!;
    const originCellXc = findXcCellWithContent("Icon Sets:", testSheet)!;
    const position = toCartesian(originCellXc);
    let cell = testSheet.cells[toXC(position[0], ++position[1])];
    while (cell && cell.content) {
      const cellContentSplit = cell.content.split(" ");
      const iconSetName = cellContentSplit[0];
      const thresholdType = cellContentSplit.length > 1 ? cellContentSplit[1] : "percent";

      let iconset: IconSet | undefined = undefined;
      if (ICON_SET_CONVERSION_MAP[iconSetName]) {
        iconset = {
          upper: ICON_SETS[ICON_SET_CONVERSION_MAP[iconSetName]]["good"],
          middle: ICON_SETS[ICON_SET_CONVERSION_MAP[iconSetName]]["neutral"],
          lower: ICON_SETS[ICON_SET_CONVERSION_MAP[iconSetName]]["bad"],
        };
      } else {
        switch (cell.content) {
          case "Reverse":
            iconset = {
              upper: ICON_SETS.arrows.bad,
              middle: ICON_SETS.arrows.neutral,
              lower: ICON_SETS.arrows.good,
            };
            break;
          case "MixIcons":
            iconset = {
              upper: ICON_SETS.dots.good,
              middle: ICON_SETS.dots.neutral,
              lower: ICON_SETS.arrows.bad,
            };
            break;
          case "GreaterNotEqual":
            iconset = {
              upper: ICON_SETS.arrows.good,
              middle: ICON_SETS.arrows.neutral,
              lower: ICON_SETS.arrows.bad,
            };
            break;
          case "NoIcons":
          case "ShowOnlyIcon":
          case "2Icons":
          case "1Icons":
            // Unsupported rules
            iconset = undefined;
        }
      }

      if (iconset) {
        const cf = findCFWithRangeBeginningAt(`${toXC(position[0] + 1, position[1])}`, testSheet)!;

        expect(cf.rule).toMatchObject({
          type: "IconSetRule",
          icons: iconset,
        });
        expect((cf.rule as IconSetRule).lowerInflectionPoint.type).toEqual(
          CF_THRESHOLD_CONVERSION_MAP[thresholdType]
        );
        expect((cf.rule as IconSetRule).upperInflectionPoint.type).toEqual(
          CF_THRESHOLD_CONVERSION_MAP[thresholdType]
        );
      }

      position[1] += 1;
      cell = testSheet.cells[toXC(position[0], position[1])];
    }
  });

  describe("table styles", () => {
    /** Test tables for styles are 2x2 tables located at the right of the cell describing them */
    let tableTestSheet: SheetData;
    beforeAll(() => {
      tableTestSheet = getWorkbookSheet("jestTable", convertedData)!;
    });

    test("Can display basic table style (borders on table outline)", () => {
      const position = toCartesian(findXcCellWithContent("BasicTable", tableTestSheet)!);
      const [tabLeft, tabTop] = [position[0] + 1, position[1]];
      expect(
        getWorkbookCellBorder(getWorkbookCell(tabLeft, tabTop, tableTestSheet)!, convertedData)
      ).toMatchObject({
        top: TABLE_BORDER_STYLE,
        bottom: undefined,
        left: TABLE_BORDER_STYLE,
        right: undefined,
      });
      expect(
        getWorkbookCellBorder(getWorkbookCell(tabLeft + 1, tabTop, tableTestSheet)!, convertedData)
      ).toMatchObject({
        top: TABLE_BORDER_STYLE,
        bottom: undefined,
        right: TABLE_BORDER_STYLE,
        left: undefined,
      });
      expect(
        getWorkbookCellBorder(getWorkbookCell(tabLeft, tabTop + 1, tableTestSheet)!, convertedData)
      ).toMatchObject({
        bottom: TABLE_BORDER_STYLE,
        top: undefined,
        left: TABLE_BORDER_STYLE,
        right: undefined,
      });
      expect(
        getWorkbookCellBorder(
          getWorkbookCell(tabLeft + 1, tabTop + 1, tableTestSheet)!,
          convertedData
        )
      ).toMatchObject({
        bottom: TABLE_BORDER_STYLE,
        top: undefined,
        right: TABLE_BORDER_STYLE,
        left: undefined,
      });
    });

    test("Can display header style", () => {
      const position = toCartesian(findXcCellWithContent("Header", tableTestSheet)!);
      const [tabLeft, tabTop] = [position[0] + 1, position[1]];
      expect(
        getWorkbookCellStyle(getWorkbookCell(tabLeft, tabTop, tableTestSheet)!, convertedData)
      ).toMatchObject(TABLE_HEADER_STYLE);
      expect(
        getWorkbookCellStyle(getWorkbookCell(tabLeft + 1, tabTop, tableTestSheet)!, convertedData)
      ).toMatchObject(TABLE_HEADER_STYLE);
    });

    test("Can highlight first table column", () => {
      const position = toCartesian(findXcCellWithContent("HighlightFirstCol", tableTestSheet)!);
      const [tabLeft, tabTop] = [position[0] + 1, position[1]];
      expect(
        getWorkbookCellStyle(getWorkbookCell(tabLeft, tabTop, tableTestSheet)!, convertedData)
      ).toMatchObject(TABLE_HIGHLIGHTED_CELL_STYLE);
      expect(
        getWorkbookCellStyle(getWorkbookCell(tabLeft, tabTop + 1, tableTestSheet)!, convertedData)
      ).toMatchObject(TABLE_HIGHLIGHTED_CELL_STYLE);
    });

    test("Can highlight last table column", () => {
      const position = toCartesian(findXcCellWithContent("HighlightLastCol", tableTestSheet)!);
      const [tabLeft, tabTop] = [position[0] + 1, position[1]];
      expect(
        getWorkbookCellStyle(getWorkbookCell(tabLeft + 1, tabTop, tableTestSheet)!, convertedData)
      ).toMatchObject(TABLE_HIGHLIGHTED_CELL_STYLE);
      expect(
        getWorkbookCellStyle(
          getWorkbookCell(tabLeft + 1, tabTop + 1, tableTestSheet)!,
          convertedData
        )
      ).toMatchObject(TABLE_HIGHLIGHTED_CELL_STYLE);
    });

    test("Can display banded rows (borders between rows)", () => {
      const position = toCartesian(findXcCellWithContent("BandedRows", tableTestSheet)!);
      const [tabLeft, tabTop] = [position[0] + 1, position[1]];
      expect(
        getWorkbookCellBorder(getWorkbookCell(tabLeft, tabTop + 1, tableTestSheet)!, convertedData)
      ).toMatchObject({ top: TABLE_BORDER_STYLE });
      expect(
        getWorkbookCellBorder(
          getWorkbookCell(tabLeft + 1, tabTop + 1, tableTestSheet)!,
          convertedData
        )
      ).toMatchObject({ top: TABLE_BORDER_STYLE });
    });

    test("Can display banded columns (borders between columns)", () => {
      const position = toCartesian(findXcCellWithContent("BandedCols", tableTestSheet)!);
      const [tabLeft, tabTop] = [position[0] + 1, position[1]];
      expect(
        getWorkbookCellBorder(getWorkbookCell(tabLeft + 1, tabTop, tableTestSheet)!, convertedData)
      ).toMatchObject({ left: TABLE_BORDER_STYLE });
      expect(
        getWorkbookCellBorder(
          getWorkbookCell(tabLeft + 1, tabTop + 1, tableTestSheet)!,
          convertedData
        )
      ).toMatchObject({ left: TABLE_BORDER_STYLE });
    });

    test("Can display total row", () => {
      const position = toCartesian(findXcCellWithContent("TotalRow", tableTestSheet)!);
      const [tabLeft, tabTop] = [position[0] + 1, position[1]];
      expect(getWorkbookCell(tabLeft, tabTop + 2, tableTestSheet)!.content).toEqual("Total");
    });
  });

  test("Can convert table formula ", () => {
    // Test table coordinates are in A1
    const testSheet = getWorkbookSheet("jestTable", convertedData)!;
    const tableXc = testSheet.cells["A1"]!.content!.split(" ")[1];
    const tableZone = toZone(tableXc);

    // Table header is "[description of what is tested] =[expected formula for first row]"
    for (let col = tableZone.left; col <= tableZone.right; col++) {
      const tableHeader = testSheet.cells[toXC(col, tableZone.top)]!.content!;
      const tableContent = testSheet.cells[toXC(col, tableZone.top + 1)]!.content!;

      const tableHeaderSplit = tableHeader.split(" ");
      if (tableHeaderSplit.length > 1) {
        const expectedFormula = tableHeaderSplit[1];
        expect(tableContent).toEqual(expectedFormula);
      }
    }
  });

  // We just import pivots as a Table (cell with some styling/borders).
  test("can import pivots", () => {
    // Test pivot coordinates are in A1
    const testSheet = getWorkbookSheet("jestPivot", convertedData)!;
    const pivotXc = testSheet.cells["A1"]!.content!.split(" ")[1];
    const pivotZone = toZone(pivotXc);

    for (let col = pivotZone.left; col <= pivotZone.right; col++) {
      for (let row = pivotZone.top; row <= pivotZone.bottom; row++) {
        // Special style for headers and first column
        let expectedStyle: Style | undefined = undefined;
        if (row === pivotZone.top || row === pivotZone.top + 1) {
          expectedStyle = TABLE_HEADER_STYLE;
        } else if (col === pivotZone.left) {
          expectedStyle = TABLE_HIGHLIGHTED_CELL_STYLE;
        }

        // Borders = outline of the table + top border between each row
        const expectedBorder: Border = {};
        if (col === pivotZone.right) {
          expectedBorder.right = TABLE_BORDER_STYLE;
        }
        if (col === pivotZone.left) {
          expectedBorder.left = TABLE_BORDER_STYLE;
        }
        if (row === pivotZone.bottom) {
          expectedBorder.bottom = TABLE_BORDER_STYLE;
        }
        expectedBorder.top = TABLE_BORDER_STYLE;

        if (expectedStyle) {
          expect(
            getWorkbookCellStyle(getWorkbookCell(col, row, testSheet)!, convertedData)
          ).toMatchObject(expectedStyle);
        }
        expect(getWorkbookCellBorder(getWorkbookCell(col, row, testSheet)!, convertedData)).toEqual(
          expectedBorder
        );
      }
    }
  });

  test.skip("Can import figures ", () => {
    const testSheet = getWorkbookSheet("jestCharts", convertedData)!;
    for (let i = 0; i < testSheet.figures.length; i++) {
      // Cells in the 1st column of the sheet contains jsons with expected figure data
      const expectedInfo = JSON.parse(testSheet.cells[toXC(0, i)]!.content!);
      const figZone = toZone(expectedInfo.zone);
      const figure = testSheet.figures[i];

      // Don't test exact positions, because excel does some esoteric magic for units and sizes (+our conversion is wonky, hello hardcoded DPI)
      // We'll only test that the figure corners are located in the correct cells
      expect(figure.x).toBeBetween(
        getColPosition(figZone.left, testSheet),
        getColPosition(figZone.left + 1, testSheet)
      );
      expect(figure.y).toBeBetween(
        getRowPosition(figZone.top, testSheet),
        getRowPosition(figZone.top + 1, testSheet)
      );
      expect(figure.width).toBeBetween(
        getColPosition(figZone.right, testSheet) - getColPosition(figZone.left, testSheet),
        getColPosition(figZone.right + 1, testSheet) - getColPosition(figZone.left, testSheet)
      );
      expect(figure.height).toBeBetween(
        getRowPosition(figZone.bottom, testSheet) - getRowPosition(figZone.top, testSheet),
        getRowPosition(figZone.bottom + 1, testSheet) - getRowPosition(figZone.top, testSheet)
      );
      expect(figure.tag).toEqual("chart");
    }
  });

  test("Can import charts ", () => {
    const testSheet = getWorkbookSheet("jestCharts", convertedData)!;
    for (let i = 0; i < testSheet.figures.length; i++) {
      // Cells in the 1st column of the sheet contains jsons with expected chart data
      const expectedInfo = JSON.parse(testSheet.cells[toXC(0, i)]!.content!);
      const chartData = testSheet.figures[i].data as ChartUIDefinition;

      expect(chartData.title).toEqual(expectedInfo.title);
      expect(chartData.type).toEqual(expectedInfo.type);
      if (expectedInfo.color) {
        expect(standardizeColor(chartData.background)).toEqual(
          standardizeColor(expectedInfo.color)
        );
      }
      const datasets = expectedInfo.dataset.split(" ");
      expect(chartData.labelRange).toEqual(expectedInfo.labels);
      for (let i = 0; i < datasets.length; i++) {
        expect(chartData.dataSets[i]).toEqual(datasets[i]);
      }
    }
  });
});

test.each([
  ["xl/workbook.xml", "xl/worksheets/sheet0.xml", "worksheets/sheet0.xml"],
  ["xl/worksheets/sheet0.xml", "xl/workbook.xml", "../workbook.xml"],
  ["test/path/long/file.xml", "test/my/path/file2.xml", "../../my/path/file2.xml"],
])("get relative path", async (from: string, to: string, expected: string) => {
  expect(getRelativePath(from, to)).toEqual(expected);
});

test.each([
  ["A1", "=A1", "C3", "=C3"],
  ["A1", "=$A1", "C3", "=$A3"],
  ["A1", "=A$1", "C3", "=C$1"],
  ["A1", "=$A$1", "C3", "=$A$1"],
  ["A1", "=SUM(A1:B2, 3, C2)", "C3", "=SUM(C3:D4, 3, E4)"],
  ["A1", "=SUM($A$1:$B$2, 3, $C$2)", "C3", "=SUM($A$1:$B$2, 3, $C$2)"],
])("adapt formula", async (from: string, formula: string, target: string, expected: string) => {
  const sf = { refCellXc: from, formula: formula } as XLSXSharedFormula;
  expect(adaptFormula(target, sf)).toEqual(expected);
});
