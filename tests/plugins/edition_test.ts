import { toZone } from "../../src/helpers";
import { Model } from "../../src/model";
import "../helpers"; // to have getcontext mocks
import { getCell } from "../helpers";

describe("edition", () => {
  test("adding and removing a cell (by setting its content to empty string", () => {
    const model = new Model();
    // adding
    model.dispatch("START_EDITION", { text: "a" });
    model.dispatch("STOP_EDITION");
    expect(Object.keys(model["workbook"].activeSheet.cells)).toEqual(["A1"]);
    expect(model["workbook"].activeSheet.cells["A1"].content).toBe("a");

    // removing
    model.dispatch("START_EDITION");
    model.dispatch("SET_CURRENT_CONTENT", { content: "" });
    model.dispatch("STOP_EDITION");
    expect(model["workbook"].activeSheet.cells).toEqual({});
  });

  test("deleting a cell with style does not remove it", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          cells: { A2: { style: 1, content: "a2" } },
        },
      ],
      styles: {
        1: { fillColor: "red" },
      },
    });

    // removing
    expect(model["workbook"].activeSheet.cells["A2"].content).toBe("a2");
    model.dispatch("SELECT_CELL", { col: 0, row: 1 });
    model.dispatch("DELETE_CONTENT", {
      sheet: model.getters.getActiveSheet(),
      target: model.getters.getSelectedZones(),
    });
    expect("A2" in model["workbook"].activeSheet.cells).toBeTruthy();
    expect(model["workbook"].activeSheet.cells["A2"].content).toBe("");
  });

  test("editing a cell, then activating a new sheet: edition should be stopped", () => {
    const model = new Model();
    const sheet1 = model["workbook"].visibleSheets[0];
    model.dispatch("START_EDITION", { text: "a" });
    expect(model.getters.getEditionMode()).toBe("editing");
    model.dispatch("CREATE_SHEET", { activate: true, id: "42" });
    expect(model.getters.getEditionMode()).toBe("inactive");
    expect(getCell(model, "A1")).toBe(null);
    model.dispatch("ACTIVATE_SHEET", { from: model.getters.getActiveSheet(), to: sheet1 });
    expect(getCell(model, "A1")!.content).toBe("a");
  });

  test("editing a cell, start a composer selection, then activating a new sheet: mode should still be selecting", () => {
    const model = new Model();
    const sheet1 = model["workbook"].visibleSheets[0];
    model.dispatch("START_EDITION", { text: "=" });
    model.dispatch("START_COMPOSER_SELECTION");
    expect(model.getters.getEditionMode()).toBe("selecting");
    expect(model.getters.getEditionSheet()).toBe(sheet1);
    model.dispatch("CREATE_SHEET", { activate: true, id: "42", name: "Sheet2" });
    expect(model.getters.getEditionMode()).toBe("selecting");
    expect(model.getters.getEditionSheet()).toBe(sheet1);
    model.dispatch("STOP_EDITION");
    expect(getCell(model, "A1", model.getters.getActiveSheet())).toBeNull();
    model.dispatch("ACTIVATE_SHEET", { from: model.getters.getActiveSheet(), to: sheet1 });
    expect(getCell(model, "A1")!.content).toBe("=");
  });

  test("ignore stopping composer selection if not selecting", () => {
    const model = new Model();
    expect(model.getters.getEditionMode()).toBe("inactive");
    model.dispatch("STOP_COMPOSER_SELECTION");
    expect(model.getters.getEditionMode()).toBe("inactive");
  });

  test("start editing where theres a merge on other sheet, change sheet, and stop edition", () => {
    const model = new Model();
    const sheetId1 = model.getters.getActiveSheet();
    const sheetId2 = "42";
    model.dispatch("ADD_MERGE", {
      sheet: sheetId1,
      zone: toZone("A1:D5"),
    });
    model.dispatch("CREATE_SHEET", { activate: true, id: sheetId2 });
    model.dispatch("SELECT_CELL", { col: 2, row: 2 });

    model.dispatch("START_EDITION", { text: "=" });
    model.dispatch("START_COMPOSER_SELECTION");
    model.dispatch("ACTIVATE_SHEET", { from: sheetId2, to: sheetId1 });
    model.dispatch("STOP_EDITION");
    expect(model.getters.getCell(2, 2, "Sheet2")?.content).toBe("=");
    expect(model.getters.getCell(0, 0, "Sheet2")).toBeNull();
  });
});