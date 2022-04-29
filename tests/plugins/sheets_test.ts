import { toCartesian, toZone, uuidv4 } from "../../src/helpers";
import { Model } from "../../src/model";
import { CancelledReason } from "../../src/types";
import "../helpers"; // to have getcontext mocks
import { createEqualCF, getCell, testUndoRedo } from "../helpers";

describe("sheets", () => {
  test("can create a new sheet, then undo, then redo", () => {
    const model = new Model();
    expect(model["workbook"].visibleSheets.length).toBe(1);
    expect(model["workbook"].activeSheet.name).toBe("Sheet1");

    model.dispatch("CREATE_SHEET", { activate: true, id: "42" });
    expect(model["workbook"].visibleSheets.length).toBe(2);
    expect(model["workbook"].activeSheet.name).toBe("Sheet2");

    model.dispatch("UNDO");
    expect(model["workbook"].visibleSheets.length).toBe(1);
    expect(model["workbook"].activeSheet.name).toBe("Sheet1");

    model.dispatch("REDO");
    expect(model["workbook"].visibleSheets.length).toBe(2);
    expect(model["workbook"].activeSheet.name).toBe("Sheet2");
  });

  test("Creating a new sheet insert it just after the active", () => {
    const model = new Model();
    model.dispatch("CREATE_SHEET", { id: "42", name: "42" });
    model.dispatch("CREATE_SHEET", { id: "43", name: "43" });
    expect(model.getters.getSheets()[1].id).toBe("43");
    expect(model.getters.getSheets()[2].id).toBe("42");
  });

  test("Creating a new sheet does not activate it by default", () => {
    const model = new Model();
    const sheet1 = model["workbook"].visibleSheets[0];

    expect(model.getters.getActiveSheet()).toBe(sheet1);
    expect(model.getters.getSheets().map((s) => s.id)).toEqual([sheet1]);
    model.dispatch("CREATE_SHEET", { id: "42" });
    const sheet2 = model["workbook"].visibleSheets[1];
    expect(model.getters.getActiveSheet()).toBe(sheet1);
    expect(model.getters.getSheets().map((s) => s.id)).toEqual([sheet1, sheet2]);
  });

  test("Can create a new sheet with given size and name", () => {
    const model = new Model();
    model.dispatch("CREATE_SHEET", {
      rows: 2,
      cols: 4,
      name: "SheetTest",
      activate: true,
      id: "42",
    });
    expect(model["workbook"].activeSheet.colNumber).toBe(4);
    expect(model["workbook"].activeSheet.cols.length).toBe(4);
    expect(model["workbook"].activeSheet.rowNumber).toBe(2);
    expect(model["workbook"].activeSheet.rows.length).toBe(2);
    expect(model["workbook"].activeSheet.name).toBe("SheetTest");
  });

  test("Cannot create a sheet with a name already existent", () => {
    const model = new Model();
    const name = model["workbook"].activeSheet.name;
    expect(model.dispatch("CREATE_SHEET", { name, id: "42" })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetName,
    });
  });

  test("Name is correctly generated when creating a sheet without given name", () => {
    const model = new Model();
    expect(model.getters.getSheetName(model.getters.getActiveSheet())).toBe("Sheet1");
    model.dispatch("CREATE_SHEET", { id: "42", activate: true });
    expect(model.getters.getSheetName(model.getters.getActiveSheet())).toBe("Sheet2");
    model.dispatch("CREATE_SHEET", { id: "43", activate: true });
    expect(model.getters.getSheetName(model.getters.getActiveSheet())).toBe("Sheet3");
    model.dispatch("DELETE_SHEET", { sheet: "42" });
    expect(model.getters.getSheets()[0].name).toBe("Sheet1");
    expect(model.getters.getSheets()[1].name).toBe("Sheet3");
    model.dispatch("CREATE_SHEET", { id: "44", activate: true });
    expect(model.getters.getSheetName(model.getters.getActiveSheet())).toBe("Sheet2");
  });

  test("can read a value in same sheet", () => {
    const model = new Model();
    expect(model["workbook"].activeSheet.name).toBe("Sheet1");

    model.dispatch("SET_VALUE", { xc: "A1", text: "3" });
    model.dispatch("SET_VALUE", { xc: "A2", text: "=Sheet1!A1" });

    expect(getCell(model, "A2")!.value).toBe(3);
  });

  test("can read a value in another sheet", () => {
    const model = new Model();
    expect(model["workbook"].activeSheet.name).toBe("Sheet1");

    model.dispatch("SET_VALUE", { xc: "A1", text: "3" });
    model.dispatch("CREATE_SHEET", { activate: true, id: "42" });
    expect(model["workbook"].activeSheet.name).toBe("Sheet2");
    model.dispatch("SET_VALUE", { xc: "A1", text: "=Sheet1!A1" });
    expect(getCell(model, "A1")!.value).toBe(3);
  });

  test("throw if invalid sheet name", () => {
    const model = new Model();
    model.dispatch("SET_VALUE", { xc: "A1", text: "=Sheet133!A1" });

    expect(getCell(model, "A1")!.value).toBe("#ERROR");
  });

  test("evaluating multiple sheets", () => {
    const model = new Model({
      sheets: [
        {
          name: "ABC",
          colNumber: 10,
          rowNumber: 10,
          cells: { B1: { content: "=DEF!B2" } },
        },
        {
          name: "DEF",
          colNumber: 10,
          rowNumber: 10,
          cells: { B2: { content: "3" } },
        },
      ],
    });

    expect(model["workbook"].activeSheet.name).toBe("ABC");
    expect(getCell(model, "B1")!.value).toBe(3);
  });

  test("evaluating multiple sheets, 2", () => {
    const model = new Model({
      sheets: [
        {
          name: "ABC",
          colNumber: 10,
          rowNumber: 10,
          cells: { B1: { content: "=DEF!B2" } },
        },
        {
          name: "DEF",
          colNumber: 10,
          rowNumber: 10,
          cells: {
            B2: { content: "=A4" },
            A4: { content: "3" },
          },
        },
      ],
    });

    expect(model["workbook"].activeSheet.name).toBe("ABC");
    expect(getCell(model, "B1")!.value).toBe(3);
  });

  test("evaluating multiple sheets, 3 (with range)", () => {
    const model = new Model({
      sheets: [
        {
          name: "ABC",
          colNumber: 10,
          rowNumber: 10,
          cells: { B1: { content: "=DEF!B2" } },
        },
        {
          name: "DEF",
          colNumber: 10,
          rowNumber: 10,
          cells: {
            B2: { content: "=SUM(A1:A5)" },
            A1: { content: "2" },
            A4: { content: "3" },
          },
        },
      ],
    });

    expect(model["workbook"].activeSheet.name).toBe("ABC");
    expect(getCell(model, "B1")!.value).toBe(5);
  });

  test("evaluating multiple sheets: cycles", () => {
    const model = new Model({
      sheets: [
        {
          name: "ABC",
          colNumber: 10,
          rowNumber: 10,
          cells: {
            B1: { content: "=DEF!B2" },
            C3: { content: "=DEF!C5 + 1" },
            C4: { content: "40" },
          },
        },
        {
          name: "DEF",
          colNumber: 10,
          rowNumber: 10,
          cells: {
            B2: { content: "=ABC!B1" },
            C5: { content: "=ABC!C4 + 1" },
          },
        },
      ],
    });

    expect(model["workbook"].activeSheet.name).toBe("ABC");
    expect(getCell(model, "B1")!.value).toBe("#CYCLE");
    expect(getCell(model, "C3")!.value).toBe(42);
  });

  test("evaluation from one sheet to another no render", () => {
    const model = new Model({
      sheets: [
        {
          name: "small",
          id: "smallId",
          colNumber: 2,
          rowNumber: 2,
          cells: {
            A2: { content: "=big!A2" },
          },
        },
        {
          name: "big",
          id: "bigId",
          colNumber: 5,
          rowNumber: 5,
          cells: {
            A1: { content: "23" },
            A2: { content: "=A1" },
          },
        },
      ],
    });
    expect(getCell(model, "A2")!.value).toBe(23);
  });

  test("cells are updated when dependency in other sheet is updated", () => {
    const model = new Model();
    model.dispatch("CREATE_SHEET", { activate: true, id: "42" });
    const sheet1 = model["workbook"].visibleSheets[0];
    const sheet2 = model["workbook"].visibleSheets[1];

    expect(model.getters.getActiveSheet()).toEqual(sheet2);
    model.dispatch("ACTIVATE_SHEET", { from: sheet2, to: sheet1 });
    expect(model.getters.getActiveSheet()).toEqual(sheet1);
    model.dispatch("SET_VALUE", { text: "=Sheet2!A1", xc: "A1" });
    expect(getText(model, "A1")).toEqual("0");
    model.dispatch("ACTIVATE_SHEET", { from: sheet1, to: sheet2 });
    model.dispatch("SET_VALUE", { text: "3", xc: "A1" });
    model.dispatch("ACTIVATE_SHEET", { from: sheet2, to: sheet1 });
    expect(model.getters.getActiveSheet()).toEqual(sheet1);
    expect(getText(model, "A1")).toEqual("3");
  });

  test("can move a sheet", () => {
    const model = new Model();
    model.dispatch("CREATE_SHEET", { id: "42" });
    const sheet1 = model["workbook"].visibleSheets[0];
    const sheet2 = model["workbook"].visibleSheets[1];
    const beforeMoveSheet = model.exportData();
    model.dispatch("MOVE_SHEET", { sheet: sheet1, direction: "right" });
    expect(model.getters.getActiveSheet()).toEqual(sheet1);
    expect(model["workbook"].visibleSheets[0]).toEqual(sheet2);
    expect(model["workbook"].visibleSheets[1]).toEqual(sheet1);
    model.dispatch("UNDO");
    expect(model["workbook"].visibleSheets[0]).toEqual(sheet1);
    expect(model["workbook"].visibleSheets[1]).toEqual(sheet2);
    expect(beforeMoveSheet).toEqual(model.exportData());
  });

  test("cannot move the first sheet to left and the last to right", () => {
    const model = new Model();
    model.dispatch("CREATE_SHEET", { id: "42" });
    const sheet1 = model["workbook"].visibleSheets[0];
    const sheet2 = model["workbook"].visibleSheets[1];
    expect(model.dispatch("MOVE_SHEET", { sheet: sheet1, direction: "left" })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetMove,
    });
    expect(model.dispatch("MOVE_SHEET", { sheet: sheet2, direction: "right" })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetMove,
    });
  });

  test("Can rename a sheet", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    const name = "NEW_NAME";
    model.dispatch("RENAME_SHEET", { sheet, name });
    expect(model.getters.getSheets().find((s) => s.id === sheet)!.name).toBe(name);
  });

  test("New sheet name is trimmed", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    const name = " NEW_NAME   ";
    model.dispatch("RENAME_SHEET", { sheet, name });
    expect(model.getters.getSheets().find((s) => s.id === sheet)!.name).toBe("NEW_NAME");
  });

  test("Cannot rename a sheet with existing name", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    const name = "NEW_NAME";
    model.dispatch("CREATE_SHEET", { name, id: "42" });
    expect(model.dispatch("RENAME_SHEET", { sheet, name })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetName,
    });
    expect(model.dispatch("RENAME_SHEET", { sheet, name: "new_name" })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetName,
    });
    expect(model.dispatch("RENAME_SHEET", { sheet, name: "new_name " })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetName,
    });
  });

  test("Cannot rename a sheet without name", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    expect(model.dispatch("RENAME_SHEET", { sheet, name: undefined })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetName,
    });
    expect(model.dispatch("RENAME_SHEET", { sheet, name: "    " })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetName,
    });
  });

  test("Sheet reference are correctly updated", () => {
    const model = new Model();
    const name = "NEW_NAME";
    const sheet1 = model.getters.getActiveSheet();
    model.dispatch("SET_VALUE", {
      xc: "A1",
      text: "=NEW_NAME!A1",
    });

    model.dispatch("CREATE_SHEET", { name, id: "42", activate: true });
    const sheet2 = model.getters.getActiveSheet();
    model.dispatch("SET_VALUE", { xc: "A1", text: "42" });
    const nextName = "NEXT NAME";
    model.dispatch("RENAME_SHEET", { sheet: sheet2, name: nextName });
    model.dispatch("ACTIVATE_SHEET", { from: sheet2, to: sheet1 });
    expect(model.getters.getCell(0, 0)!.content).toBe("='NEXT NAME'!A1");
    model.dispatch("UNDO"); // Activate Sheet
    model.dispatch("UNDO"); // Rename sheet
    model.dispatch("ACTIVATE_SHEET", { from: sheet2, to: sheet1 });
    expect(model.getters.getCell(0, 0)!.content).toBe("=NEW_NAME!A1");
  });

  test("Rename a sheet will call editText", async () => {
    const editText = jest.fn();
    const model = new Model(
      {
        sheets: [
          {
            colNumber: 5,
            rowNumber: 5,
          },
        ],
      },
      { editText }
    );
    model.dispatch("RENAME_SHEET", { sheet: model.getters.getActiveSheet(), interactive: true });
    expect(editText).toHaveBeenCalled();
  });

  test("Rename a sheet with interaction", async () => {
    const editText = jest.fn(
      (title: string, placeholder: string, callback: (text: string | null) => any) => {
        callback("new name");
      }
    );
    const model = new Model(
      {
        sheets: [
          {
            colNumber: 5,
            rowNumber: 5,
          },
        ],
      },
      { editText }
    );
    model.dispatch("RENAME_SHEET", { sheet: model.getters.getActiveSheet(), interactive: true });
    expect(model.getters.getSheetName(model.getters.getActiveSheet())).toBe("new name");
  });

  test("Can duplicate a sheet", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    model.dispatch("DUPLICATE_SHEET", { sheet, id: uuidv4(), name: "dup" });
    expect(model.getters.getSheets()).toHaveLength(2);
    model.dispatch("UNDO");
    expect(model.getters.getSheets()).toHaveLength(1);
    model.dispatch("REDO");
    expect(model.getters.getSheets()).toHaveLength(2);
  });

  test("Duplicate a sheet make the newly created active", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    model.dispatch("DUPLICATE_SHEET", { sheet, id: "42", name: "dup" });
    expect(model.getters.getActiveSheet()).toBe("42");
  });

  test("Cannot duplicate a sheet with the same name", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    const name = model.getters.getSheets()[0].name;
    const id = uuidv4();
    expect(model.dispatch("DUPLICATE_SHEET", { sheet, id, name })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.WrongSheetName,
    });
  });

  test("Properties of sheet are correctly duplicated", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 5,
          rowNumber: 5,
          merges: ["B1:C2"],
          conditionalFormats: [
            {
              id: "1",
              ranges: ["A1:A2"],
              rule: {
                values: ["42"],
                operator: "Equal",
                type: "CellIsRule",
                style: { fillColor: "orange" },
              },
            },
          ],
        },
      ],
    });
    const sheet = model.getters.getActiveSheet();
    model.dispatch("SET_VALUE", { xc: "A1", text: "42" });
    model.dispatch("DUPLICATE_SHEET", { sheet, id: uuidv4(), name: "dup" });
    expect(model.getters.getSheets()).toHaveLength(2);
    const newSheet = model.getters.getSheets()[1].id;
    model.dispatch("ACTIVATE_SHEET", { from: sheet, to: newSheet });
    expect(getText(model, "A1")).toBe("42");
    expect(model.getters.getNumberCols(model.getters.getActiveSheet())).toBe(5);
    expect(model.getters.getNumberRows(model.getters.getActiveSheet())).toBe(5);
    expect(model.getters.getConditionalStyle("A1")).toEqual({ fillColor: "orange" });
  });

  test("CFs of sheets are correctly duplicated", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 5,
          rowNumber: 5,
          conditionalFormats: [
            {
              id: "1",
              ranges: ["A1:A2"],
              rule: {
                values: ["42"],
                operator: "Equal",
                type: "CellIsRule",
                style: { fillColor: "orange" },
              },
            },
          ],
        },
      ],
    });
    const sheet = model.getters.getActiveSheet();
    model.dispatch("SET_VALUE", { xc: "A1", text: "42" });
    model.dispatch("DUPLICATE_SHEET", { sheet, id: uuidv4(), name: "dup" });
    expect(model.getters.getSheets()).toHaveLength(2);
    const newSheet = model.getters.getSheets()[1].id;
    model.dispatch("ACTIVATE_SHEET", { from: sheet, to: newSheet });
    expect(getText(model, "A1")).toBe("42");
    expect(model.getters.getConditionalStyle("A1")).toEqual({ fillColor: "orange" });
    expect(model.getters.getConditionalFormats()).toHaveLength(1);
    model.dispatch("ADD_CONDITIONAL_FORMAT", {
      cf: createEqualCF(["A1:A2"], "42", { fillColor: "blue" }, "1"),
      sheet: model.getters.getActiveSheet(),
    });
    expect(model.getters.getConditionalStyle("A1")).toEqual({ fillColor: "blue" });
    expect(model.getters.getConditionalFormats()).toHaveLength(1);
    model.dispatch("ACTIVATE_SHEET", { from: newSheet, to: sheet });
    expect(model.getters.getConditionalStyle("A1")).toEqual({ fillColor: "orange" });
    expect(model.getters.getConditionalFormats()).toHaveLength(1);
  });

  test("Cells are correctly duplicated", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 5,
          rowNumber: 5,
          cells: {
            A1: { content: "42" },
          },
        },
      ],
    });
    const sheet = model.getters.getActiveSheet();
    model.dispatch("DUPLICATE_SHEET", { sheet, id: uuidv4(), name: "dup" });
    expect(model.getters.getSheets()).toHaveLength(2);
    const newSheet = model.getters.getSheets()[1].id;
    model.dispatch("ACTIVATE_SHEET", { from: sheet, to: newSheet });
    expect(getText(model, "A1")).toBe("42");
    model.dispatch("SET_VALUE", { xc: "A1", text: "24" });
    expect(getText(model, "A1")).toBe("24");
    model.dispatch("ACTIVATE_SHEET", { from: newSheet, to: sheet });
    expect(getText(model, "A1")).toBe("42");
  });

  test("Cols and Rows are correctly duplicated", () => {
    const model = new Model();
    const sheet = model.getters.getActiveSheet();
    model.dispatch("DUPLICATE_SHEET", { sheet, id: uuidv4(), name: "dup" });
    expect(model.getters.getSheets()).toHaveLength(2);
    model.dispatch("RESIZE_COLUMNS", { cols: [0], size: 1, sheet });
    model.dispatch("RESIZE_ROWS", { rows: [0], size: 1, sheet });
    const newSheet = model.getters.getSheets()[1].id;
    model.dispatch("ACTIVATE_SHEET", { from: sheet, to: newSheet });
    expect(model.getters.getCol(model.getters.getActiveSheet(), 0).size).not.toBe(1);
    expect(model.getters.getRow(model.getters.getActiveSheet(), 0).size).not.toBe(1);
  });

  test("Merges are correctly duplicated", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 5,
          rowNumber: 5,
          merges: ["A1:A2"],
        },
      ],
    });
    const sheet = model.getters.getActiveSheet();
    model.dispatch("DUPLICATE_SHEET", { sheet, id: uuidv4(), name: "dup" });
    expect(model.getters.getSheets()).toHaveLength(2);
    model.dispatch("REMOVE_MERGE", { sheet, zone: toZone("A1:A2") });
    const newSheet = model.getters.getSheets()[1].id;
    model.dispatch("ACTIVATE_SHEET", { from: sheet, to: newSheet });
    expect(model.exportData().sheets[0].merges).toHaveLength(0);
    expect(model.exportData().sheets[1].merges).toHaveLength(1);
  });

  test("Can delete the active sheet", () => {
    const model = new Model();
    const sheet1 = model.getters.getActiveSheet();
    model.dispatch("CREATE_SHEET", { id: "42", activate: true });
    const sheet2 = model.getters.getActiveSheet();
    model.dispatch("DELETE_SHEET", { sheet: sheet2 });
    expect(model.getters.getSheets()).toHaveLength(1);
    expect(model.getters.getSheets()[0].id).toEqual(sheet1);
    expect(model.getters.getActiveSheet()).toEqual(sheet1);
    model.dispatch("UNDO");
    expect(model.getters.getSheets()).toHaveLength(2);
    expect(model.getters.getActiveSheet()).toEqual(sheet2);
    model.dispatch("REDO");
    expect(model.getters.getSheets()).toHaveLength(1);
    expect(model.getters.getActiveSheet()).toEqual(sheet1);
  });

  test("Can delete a non-active sheet", () => {
    const model = new Model();
    const sheet1 = model.getters.getActiveSheet();
    model.dispatch("CREATE_SHEET", { id: "42", activate: true });
    const sheet2 = model.getters.getSheets()[1].id;
    model.dispatch("DELETE_SHEET", { sheet: sheet1 });
    expect(model.getters.getSheets()).toHaveLength(1);
    expect(model.getters.getSheets()[0].id).toEqual(sheet2);
    expect(model.getters.getActiveSheet()).toEqual(sheet2);
  });

  test("Cannot delete sheet if there is only one", () => {
    const model = new Model();
    expect(model.dispatch("DELETE_SHEET", { sheet: model.getters.getActiveSheet() })).toEqual({
      status: "CANCELLED",
      reason: CancelledReason.NotEnoughSheets,
    });
  });

  test("Can undo-redo a sheet deletion", () => {
    const model = new Model();
    model.dispatch("CREATE_SHEET", { id: "42" });
    testUndoRedo(model, expect, "DELETE_SHEET", { sheet: "42" });
  });

  test("Can undo-redo a sheet renaming", () => {
    const model = new Model();
    testUndoRedo(model, expect, "RENAME_SHEET", {
      sheet: model.getters.getActiveSheet(),
      name: "New name",
    });
  });

  test("Can undo-redo a sheet duplication", () => {
    const model = new Model();
    testUndoRedo(model, expect, "DUPLICATE_SHEET", {
      id: "42",
      sheet: model.getters.getActiveSheet(),
      name: "dup",
    });
  });

  test("Sheet reference are correctly marked as #REF on sheet deletion", () => {
    const model = new Model();
    const name = "NEW_NAME";
    const sheet1 = model.getters.getActiveSheet();
    model.dispatch("SET_VALUE", {
      xc: "A1",
      text: "=NEW_NAME!A1",
    });

    model.dispatch("CREATE_SHEET", { id: "42", name, activate: true });
    const sheet2 = model.getters.getActiveSheet();
    model.dispatch("SET_VALUE", { xc: "A1", text: "42" });
    model.dispatch("DELETE_SHEET", { sheet: sheet2 });
    expect(model.getters.getCell(0, 0)!.content).toBe("=#REF");
    model.dispatch("UNDO");
    model.dispatch("ACTIVATE_SHEET", { from: sheet2, to: sheet1 });
    expect(model.getters.getCell(0, 0)!.content).toBe("=NEW_NAME!A1");
  });
});

function getText(model: Model, xc: string): string {
  const cell = model.getters.getCell(...toCartesian(xc));
  return cell ? model.getters.getCellText(cell) : "";
}