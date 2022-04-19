import { DEFAULT_CELL_HEIGHT } from "../../src/constants";
import { getDefaultCellHeight } from "../../src/helpers";
import { Model } from "../../src/model";
import { CommandResult, Sheet } from "../../src/types";
import {
  activateSheet,
  createSheet,
  deleteColumns,
  merge,
  redo,
  resizeColumns,
  resizeRows,
  setCellContent,
  setStyle,
  undo,
  unMerge,
} from "../test_helpers/commands_helpers";
import { Cell } from "./../../src/types/cells";

describe("Model resizer", () => {
  test("Can resize one column, undo, then redo", async () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    const sheetId = sheet.id;
    const initialSize = model.getters.getCol(sheetId, 1)!.size;
    const initialTop = model.getters.getCol(sheetId, 2)!.start;
    const initialWidth = model.getters.getMaxViewportSize(sheet).width;

    resizeColumns(model, ["B"], model.getters.getCol(sheetId, 1)!.size + 100);
    expect(model.getters.getCol(sheetId, 1)!.size).toBe(196);
    expect(model.getters.getCol(sheetId, 2)!.start).toBe(initialTop + 100);
    expect(model.getters.getMaxViewportSize(sheet).width).toBe(initialWidth + 100);

    undo(model);
    expect(model.getters.getCol(sheetId, 1)!.size).toBe(initialSize);
    expect(model.getters.getCol(sheetId, 2)!.start).toBe(initialTop);
    expect(model.getters.getMaxViewportSize(sheet).width).toBe(initialWidth);

    redo(model);
    expect(model.getters.getCol(sheetId, 1)!.size).toBe(initialSize + 100);
    expect(model.getters.getCol(sheetId, 2)!.start).toBe(initialTop + 100);
    expect(model.getters.getMaxViewportSize(sheet).width).toBe(initialWidth + 100);
  });

  test("Cannot resize column in invalid sheet", async () => {
    const model = new Model();
    expect(resizeColumns(model, ["B"], 100, "invalid")).toBeCancelledBecause(
      CommandResult.InvalidSheetId
    );
  });
  test("Cannot resize row in invalid sheet", async () => {
    const model = new Model();
    expect(resizeRows(model, [1], 100, "invalid")).toBeCancelledBecause(
      CommandResult.InvalidSheetId
    );
  });
  test("Cannot auto resize column in invalid sheet", async () => {
    const model = new Model();
    expect(
      model.dispatch("AUTORESIZE_COLUMNS", {
        sheetId: "invalid",
        cols: [10],
      })
    ).toBeCancelledBecause(CommandResult.InvalidSheetId);
  });
  test("Cannot auto resize row in invalid sheet", async () => {
    const model = new Model();
    expect(
      model.dispatch("AUTORESIZE_ROWS", {
        sheetId: "invalid",
        rows: [10],
      })
    ).toBeCancelledBecause(CommandResult.InvalidSheetId);
  });

  test("Can resize one row, then undo", async () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    const sheetId = sheet.id;
    const initialSize = model.getters.getRow(sheetId, 1)!.size;
    const initialTop = model.getters.getRow(sheetId, 2)!.start;
    const initialHeight = model.getters.getMaxViewportSize(sheet).height;

    resizeRows(model, [1], initialSize + 100);
    expect(model.getters.getRow(sheetId, 1)!.size).toBe(initialSize + 100);
    expect(model.getters.getRow(sheetId, 2)!.start).toBe(initialTop + 100);
    expect(model.getters.getMaxViewportSize(sheet).height).toBe(initialHeight + 100);

    undo(model);
    expect(model.getters.getRow(sheetId, 1)!.size).toBe(initialSize);
    expect(model.getters.getRow(sheetId, 2)!.start).toBe(initialTop);
    expect(model.getters.getMaxViewportSize(sheet).height).toBe(initialHeight);
  });

  test("Can resize row of inactive sheet", async () => {
    const model = new Model();
    createSheet(model, { sheetId: "42" });
    const [, sheet2Id] = model.getters.getSheetIds();
    resizeRows(model, [0], 42, sheet2Id);
    expect(model.getters.getActiveSheetId()).not.toBe(sheet2Id);
    expect(model.getters.getRow(sheet2Id, 0)).toEqual({
      cells: {},
      end: 42,
      size: 42,
      name: "1",
      start: 0,
      isManuallySized: true,
    });
  });

  test("Can resize column of inactive sheet", async () => {
    const model = new Model();
    createSheet(model, { sheetId: "42" });
    const [, sheet2Id] = model.getters.getSheetIds();
    resizeColumns(model, ["A"], 42, sheet2Id);
    expect(model.getters.getActiveSheetId()).not.toBe(sheet2Id);
    expect(model.getters.getCol(sheet2Id, 0)).toEqual({
      end: 42,
      size: 42,
      name: "A",
      start: 0,
      isManuallySized: true,
    });
  });

  test("changing sheets update the sizes", async () => {
    const model = new Model();
    createSheet(model, { activate: true, sheetId: "42" });
    const sheet1 = model.getters.getSheetIds()[0];
    const sheet2 = model.getters.getSheetIds()[1];

    expect(model.getters.getActiveSheetId()).toBe(sheet2);
    resizeColumns(model, ["B"], model.getters.getCol(sheet2, 1)!.size + 100, sheet2);

    const initialWidth = model.getters.getMaxViewportSize(model.getters.getActiveSheet()).width;

    activateSheet(model, sheet1);
    expect(model.getters.getMaxViewportSize(model.getters.getActiveSheet()).width).toBe(
      initialWidth - 100
    );
  });

  test("Can resize multiple columns", async () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheetId();
    const size = model.getters.getCol(sheet, 0)!.size;

    resizeColumns(model, ["B", "D", "E"], 100);
    expect(model.getters.getCol(sheet, 1)!.size).toBe(100);
    expect(model.getters.getCol(sheet, 2)!.size).toBe(size);
    expect(model.getters.getCol(sheet, 3)!.size).toBe(100);
    expect(model.getters.getCol(sheet, 4)!.size).toBe(100);
    expect(model.getters.getCol(sheet, 5)!.start).toBe(size * 2 + 100 * 3);
  });

  test("Can resize multiple rows", async () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheetId();
    const size = model.getters.getRow(sheet, 0)!.size;

    resizeRows(model, [1, 3, 4], 100);

    expect(model.getters.getRow(sheet, 1)!.size).toBe(100);
    expect(model.getters.getRow(sheet, 2)!.size).toBe(size);
    expect(model.getters.getRow(sheet, 3)!.size).toBe(100);
    expect(model.getters.getRow(sheet, 4)!.size).toBe(100);
    expect(model.getters.getRow(sheet, 5)!.start).toBe(2 * size + 100 * 3);
  });

  test("resizing cols/rows update the total width/height", async () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    const sheetId = sheet.id;
    const { width: initialWidth, height: initialHeight } = model.getters.getMaxViewportSize(sheet);
    resizeColumns(model, ["B"], model.getters.getCol(sheetId, 1)!.size + 100);
    expect(model.getters.getMaxViewportSize(sheet).width).toBe(initialWidth + 100);

    resizeRows(model, [1], model.getters.getRow(sheetId, 1)!.size + 42);
    expect(model.getters.getMaxViewportSize(sheet).height).toBe(initialHeight + 42);
  });

  describe("resize rows when changing font", () => {
    let model: Model;
    let sheet: Sheet;
    beforeEach(() => {
      model = new Model({
        sheets: [
          {
            id: "1",
            colNumber: 10,
            rowNumber: 10,
            rows: { 6: { size: 40 } },
            cells: {
              A1: { content: "A1" },
              B1: { content: "B1" },
              A4: { content: "A4", style: 1 },
            },
          },
        ],
        styles: { 1: { fontSize: 36 } },
      });
      sheet = model.getters.getActiveSheet();
    });

    test("After import, the rows are resized based on the font size and the flag isManuallySized is set", () => {
      expect(model.getters.getRow(sheet.id, 6)!.size).toBe(40);
      expect(model.getters.getRow(sheet.id, 6)!.isManuallySized).toBe(true);

      expect(model.getters.getRow(sheet.id, 3)!.size).toBe(
        getDefaultCellHeight({ content: "A4", style: { fontSize: 36 } } as Cell)
      );
      expect(model.getters.getRow(sheet.id, 3)!.isManuallySized).toEqual(false);
    });

    test("Flag isManuallySized in set on rows that were manually sized", () => {
      resizeRows(model, [0], 30);
      expect(model.getters.getRow(sheet.id, 0)!.isManuallySized).toBe(true);
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(30);
    });

    test("Flag isManuallySized is false on rows that were automatically sized", () => {
      resizeRows(model, [0], 30);
      model.dispatch("AUTORESIZE_ROWS", { sheetId: "1", rows: [0] });

      expect(model.getters.getRow(sheet.id, 0)!.isManuallySized).toBe(false);
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("Row sizes that were automatically computed based on font size are not exported", () => {
      setStyle(model, "A1", { fontSize: 36 });
      const exportedData = model.exportData();
      expect(exportedData.sheets[0].rows["0"]).toBeUndefined();
    });

    test("changing the font size change the row height", () => {
      setStyle(model, "A1", { fontSize: 22 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "A1", style: { fontSize: 22 } } as Cell)
      );

      setStyle(model, "A1", { fontSize: 11 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("changing the font size don't modify row height if there is a bigger cell", () => {
      setStyle(model, "A1", { fontSize: 36 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "A1", style: { fontSize: 36 } } as Cell)
      );

      setStyle(model, "B1", { fontSize: 26 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "A1", style: { fontSize: 36 } } as Cell)
      );
    });

    test("changing the font size cannot set row height below default", () => {
      const style = { fontSize: 7.5 };
      setStyle(model, "A1", style);
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test.each([10, 50])(
      "changing the font size don't modify row height if the height was set manually",
      (rowSize) => {
        resizeRows(model, [0], rowSize);

        setStyle(model, "A1", { fontSize: 36 });
        expect(model.getters.getRow(sheet.id, 0)!.size).toBe(rowSize);
      }
    );

    test("cell with no content doesn't impact the row size", () => {
      setStyle(model, "C1", { fontSize: 36 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("adding content to an empty cell update the row size", () => {
      setStyle(model, "C1", { fontSize: 36 });
      setCellContent(model, "C1", "B1");

      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "C1", style: { fontSize: 36 } } as Cell)
      );
    });

    test("emptying tallest cell in the row update row height", () => {
      setStyle(model, "A1", { fontSize: 36 });
      setCellContent(model, "A1", "");
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("deleting col with tallest cell in the row update row height", () => {
      setStyle(model, "A1", { fontSize: 36 });
      deleteColumns(model, ["A"], sheet.id);
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("deleting col with tallest cell in the row update row height", () => {
      setStyle(model, "A1", { fontSize: 36 });
      deleteColumns(model, ["A"], sheet.id);
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("adding a merge overwriting the the tallest cell in a row update row height", () => {
      setStyle(model, "A2", { fontSize: 36 });
      merge(model, "A1:A2");
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("adding a merge with top left being the the tallest cell in a row update row height", () => {
      setStyle(model, "A1", { fontSize: 36 });
      merge(model, "A1:A2");
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("adding style to merge with more than one row don't auto-resize the row", () => {
      merge(model, "A1:A2");
      setStyle(model, "A1", { fontSize: 36 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(DEFAULT_CELL_HEIGHT);
    });

    test("adding style to a single-row merge merge auto-resize the row", () => {
      merge(model, "A1:B1");
      setStyle(model, "A1", { fontSize: 36 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "A1", style: { fontSize: 36 } } as Cell)
      );
    });

    test("auto-resize the row take the size of the highest single-row cell when the tallest cell is removed ", () => {
      setStyle(model, "A1", { fontSize: 36 });
      merge(model, "B1:C1");
      setStyle(model, "B1", { fontSize: 26 });
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "A1", style: { fontSize: 36 } } as Cell)
      );
      deleteColumns(model, ["A"]);
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "B1", style: { fontSize: 26 } } as Cell)
      );
    });

    test("removing a merge with a font height will update the row height", () => {
      merge(model, "A1:A2");
      setStyle(model, "A1", { fontSize: 36 });
      unMerge(model, "A1:A2");
      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "B1", style: { fontSize: 36 } } as Cell)
      );
    });

    test("merge style don't influence auto-resizing of rows", () => {
      merge(model, "A1:A2");
      setStyle(model, "A1", { fontSize: 36 });

      setCellContent(model, "B1", "B1");
      setStyle(model, "B1", { fontSize: 18 });

      expect(model.getters.getRow(sheet.id, 0)!.size).toBe(
        getDefaultCellHeight({ content: "B1", style: { fontSize: 18 } } as Cell)
      );
    });
  });
});
