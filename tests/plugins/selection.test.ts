import { toZone } from "../../src/helpers";
import { Model } from "../../src/model";
import { CommandResult, SelectionDirection } from "../../src/types";
import {
  activateSheet,
  addColumns,
  alterSelection,
  createSheet,
  deleteColumns,
  hideColumns,
  hideRows,
  merge,
  movePosition,
  redo,
  selectCell,
  setSelection,
  undo,
} from "../test_helpers/commands_helpers";
import { getActiveXc } from "../test_helpers/getters_helpers";

let model: Model;
const hiddenContent = { content: "hidden content to be skipped" };
describe("selection", () => {
  test("if A1 is in a merge, it is initially properly selected", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["A1:B3"],
        },
      ],
    });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 1, bottom: 2 });
  });

  test("can select selection with shift-arrow", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["B1:C2"],
        },
      ],
    });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    alterSelection(model, { direction: "right" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 2, bottom: 1 });
  });

  test("can grow/shrink selection with shift-arrow", () => {
    const model = new Model();

    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    alterSelection(model, { direction: "right" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 1, bottom: 0 });
    alterSelection(model, { direction: "left" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  test("cannot expand select selection with shift-arrow if it is out of bound", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
        },
      ],
    });
    selectCell(model, "A2");
    alterSelection(model, { direction: "up" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 0, bottom: 1 });
    alterSelection(model, { direction: "up" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 0, bottom: 1 });

    selectCell(model, "J1");
    alterSelection(model, { direction: "right" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 9, top: 0, right: 9, bottom: 0 });
    selectCell(model, "A10");
    alterSelection(model, { direction: "down" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 9, right: 0, bottom: 9 });
  });

  test("can expand selection with mouse", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["B1:C2"],
        },
      ],
    });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    alterSelection(model, { cell: [1, 0] });
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 2, bottom: 1 });
  });

  test("move selection in and out of a merge (in opposite direction)", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["C1:D2"],
        },
      ],
    });
    selectCell(model, "B1");

    // move to the right, inside the merge
    alterSelection(model, { direction: "right" });

    expect(model.getters.getSelectedZones()[0]).toEqual({ top: 0, right: 3, left: 1, bottom: 1 });
    expect(getActiveXc(model)).toBe("B1");

    // move to the left, outside the merge
    alterSelection(model, { direction: "left" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ top: 0, right: 1, left: 1, bottom: 1 });
    expect(getActiveXc(model)).toBe("B1");
  });

  test("update selection in some different directions", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["B2:C3"],
        },
      ],
    });
    // move sell to B4
    selectCell(model, "B4");
    expect(getActiveXc(model)).toBe("B4");

    // move up, inside the merge
    alterSelection(model, { direction: "up" });

    expect(model.getters.getSelectedZones()[0]).toEqual({ top: 1, right: 2, left: 1, bottom: 3 });

    // move to the left, outside the merge
    alterSelection(model, { direction: "left" });
    expect(model.getters.getSelectedZones()[0]).toEqual({ top: 1, right: 2, left: 0, bottom: 3 });
  });

  test("expand selection when encountering a merge", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["B2:B3", "C2:D2"],
        },
      ],
    });
    // move sell to B4
    selectCell(model, "B3");
    expect(getActiveXc(model)).toBe("B3");

    // select right cell C3
    alterSelection(model, { cell: [2, 2] });

    expect(model.getters.getSelectedZones()[0]).toEqual({ top: 1, right: 3, left: 1, bottom: 2 });
  });

  test("extend selection through hidden columns", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 5,
          rowNumber: 1,
          cols: { 2: { isHidden: true }, 3: { isHidden: true } },
        },
      ],
    });
    selectCell(model, "B1");
    alterSelection(model, { direction: "right" });
    expect(model.getters.getSelectedZone()).toEqual(toZone("B1:E1"));
  });

  test("extend selection through hidden rows", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 1,
          rowNumber: 5,
          rows: { 2: { isHidden: true }, 3: { isHidden: true } },
        },
      ],
    });
    selectCell(model, "A5");
    alterSelection(model, { direction: "up" });
    expect(model.getters.getSelectedZone()).toEqual(toZone("A2:A5"));
  });

  test("can select a whole column", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
        },
      ],
    });
    model.dispatch("SELECT_COLUMN", { index: 4 });
    expect(getActiveXc(model)).toBe("E1");

    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 4, top: 0, right: 4, bottom: 9 });
  });

  test("can select a whole column with a merged cell", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["A1:B1"],
        },
      ],
    });
    model.dispatch("SELECT_COLUMN", { index: 0 });
    expect(getActiveXc(model)).toBe("A1");
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 0, bottom: 9 });
  });

  test("can select a whole row", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
        },
      ],
    });

    model.dispatch("SELECT_ROW", { index: 4 });
    expect(getActiveXc(model)).toBe("A5");

    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 4, right: 9, bottom: 4 });
  });

  test("can select a whole row with a merged cell", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          merges: ["A1:A2"],
        },
      ],
    });

    model.dispatch("SELECT_ROW", { index: 0 });
    expect(getActiveXc(model)).toBe("A1");
    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 9, bottom: 0 });
  });

  test("cannot select out of bound row", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
        },
      ],
    });
    expect(model.dispatch("SELECT_ROW", { index: -1 })).toBe(CommandResult.SelectionOutOfBound);
    expect(model.dispatch("SELECT_ROW", { index: 11 })).toBe(CommandResult.SelectionOutOfBound);
  });

  test("cannot select out of bound column", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
        },
      ],
    });
    expect(model.dispatch("SELECT_COLUMN", { index: -1 })).toBe(CommandResult.SelectionOutOfBound);
    expect(model.dispatch("SELECT_COLUMN", { index: 11 })).toBe(CommandResult.SelectionOutOfBound);
  });

  test("can select the whole sheet", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
        },
      ],
    });
    model.dispatch("SELECT_ALL");
    expect(getActiveXc(model)).toBe("A1");

    expect(model.getters.getSelectedZones()[0]).toEqual({ left: 0, top: 0, right: 9, bottom: 9 });
  });

  test("invalid selection is updated after undo", () => {
    const model = new Model({
      sheets: [
        {
          id: "42",
          colNumber: 3,
          rowNumber: 3,
        },
      ],
    });
    addColumns(model, "after", "A", 1);
    selectCell(model, "D1");
    undo(model);
    expect(model.getters.getPosition()).toEqual([2, 0]);
    expect(model.getters.getSheetPosition("42")).toEqual([2, 0]);
  });

  test("invalid selection is updated after redo", () => {
    const model = new Model({
      sheets: [
        {
          id: "42",
          colNumber: 3,
          rowNumber: 3,
        },
      ],
    });
    deleteColumns(model, ["A"]);
    undo(model);
    selectCell(model, "C1");
    redo(model);
    expect(model.getters.getPosition()).toEqual([1, 0]);
    expect(model.getters.getSheetPosition("42")).toEqual([1, 0]);
  });
  test("cannot set a selection with an anchor zone not present in the zones provided", () => {
    const model = new Model();
    const zone = { top: 0, bottom: 0, left: 0, right: 0 };
    const anchorZone = { top: 1, bottom: 2, left: 1, right: 2 };
    const zones = [zone];
    const anchor: [number, number] = [1, 1];
    expect(model.dispatch("SET_SELECTION", { zones, anchor, anchorZone })).toBe(
      CommandResult.InvalidAnchorZone
    );
  });
});

describe("multiple selections", () => {
  test("can select a new range", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
        },
      ],
    });
    selectCell(model, "C3");
    let selection = model.getters.getSelection();
    expect(selection.zones.length).toBe(1);
    expect(selection.anchor).toEqual([2, 2]);
    alterSelection(model, { cell: [2, 3] });
    selection = model.getters.getSelection();
    expect(selection.zones.length).toBe(1);
    expect(selection.anchor).toEqual([2, 2]);

    // create new range
    model.dispatch("START_SELECTION_EXPANSION");
    selectCell(model, "F3");
    selection = model.getters.getSelection();
    expect(selection.zones).toHaveLength(2);
    expect(selection.anchor).toEqual([5, 2]);
  });
});

describe("multiple sheets", () => {
  test("activating same sheet does not change selection", () => {
    const model = new Model();
    const sheet1 = model.getters.getVisibleSheets()[0];
    selectCell(model, "C3");
    expect(model.getters.getSelectedZones()).toEqual([toZone("C3")]);

    activateSheet(model, sheet1);
    expect(model.getters.getSelectedZones()).toEqual([toZone("C3")]);
  });

  test("selection is restored when coming back to previous sheet", () => {
    const model = new Model();
    selectCell(model, "C3");
    expect(model.getters.getSelectedZones()).toEqual([toZone("C3")]);
    createSheet(model, { activate: true, sheetId: "42" });
    expect(model.getters.getSelectedZones()).toEqual([toZone("A1")]);
    selectCell(model, "B2");
    expect(model.getters.getSelectedZones()).toEqual([toZone("B2")]);

    const sheet1 = model.getters.getVisibleSheets()[0];
    const sheet2 = model.getters.getVisibleSheets()[1];
    activateSheet(model, sheet1);
    expect(model.getters.getSelectedZones()).toEqual([toZone("C3")]);
    activateSheet(model, sheet2);
    expect(model.getters.getSelectedZones()).toEqual([toZone("B2")]);
  });

  test("Selection is updated when deleting the active sheet", () => {
    const model = new Model();
    selectCell(model, "B2");
    const sheetId = model.getters.getActiveSheetId();
    createSheet(model, { sheetId: "42" });
    model.dispatch("DELETE_SHEET", { sheetId });
    expect(model.getters.getSelectedZone()).toEqual(toZone("A1"));
    expect(model.getters.getActiveSheetId()).toBe("42");
  });
});

describe("Alter selection starting from hidden cells", () => {
  test("Cannot change selection if the current one is completely hidden", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 5,
          rowNumber: 2,
        },
      ],
    });
    selectCell(model, "C1");
    hideColumns(model, ["C"]);
    hideRows(model, [0]);

    const alter1 = alterSelection(model, { direction: "down" });

    expect(alter1).toBe(CommandResult.SelectionOutOfBound);
    const alter2 = alterSelection(model, { direction: "right" });
    expect(alter2).toBe(CommandResult.SelectionOutOfBound);
  });

  test("Cannot move position vertically from hidden column", () => {
    const model = new Model({
      sheets: [
        {
          colNumber: 5,
          rowNumber: 2,
        },
      ],
    });
    selectCell(model, "C1");
    hideColumns(model, ["C"]);
    const move1 = movePosition(model, "down");
    expect(move1).toBe(CommandResult.SelectionOutOfBound);
    const move2 = movePosition(model, "up");
    expect(move2).toBe(CommandResult.SelectionOutOfBound);
  });

  test.each([
    [["A"], "A1", "right", "A1:B1"],
    [["A", "B"], "A1", "right", "A1:C1"],
    [["A"], "A1", "left", "A1:B1"],
    [["A", "B"], "A1", "left", "A1:C1"],
    [["A", "B"], "B1", "left", "B1:C1"],

    [["Z"], "Z1", "left", "Y1:Z1"],
    [["Y", "Z"], "Z1", "left", "X1:Z1"],
    [["Z"], "Z1", "right", "Y1:Z1"],
    [["Y", "Z"], "Z1", "right", "X1:Z1"],
    [["Y", "Z"], "Y1", "right", "X1:Y1"],
  ])(
    "Alter selection horizontally from hidden col",
    (hiddenCols, startPosition, direction: SelectionDirection, endPosition) => {
      const model = new Model();
      selectCell(model, startPosition);
      hideColumns(model, hiddenCols);
      alterSelection(model, { direction });
      expect(model.getters.getSelectedZone()).toEqual(toZone(endPosition));
    }
  );

  test.each([
    [["A"], "A1", "down", "A1"], // won't move
    [["A"], "A1:B1", "down", "A1:B2"],
    [["A", "B"], "A1:B1", "down", "A1:B1"], //won't move
    [["A", "C"], "A1:C1", "down", "A1:C2"],
  ])(
    "Alter selection vertically from hidden col needs at least one visible selected cell",
    (hiddenCols, startPosition, direction: SelectionDirection, endPosition) => {
      const model = new Model();
      setSelection(model, [startPosition]);
      hideColumns(model, hiddenCols);
      alterSelection(model, { direction });
      expect(model.getters.getSelectedZone()).toEqual(toZone(endPosition));
    }
  );

  test.each([
    [[0], "A1", "down", "A1:A2"],
    [[0, 1], "A1", "down", "A1:A3"],
    [[0], "A1", "up", "A1:A2"],
    [[0, 1], "A1", "up", "A1:A3"],
    [[0, 1], "A2", "up", "A2:A3"],

    [[99], "A100", "up", "A99:A100"],
    [[98, 99], "A100", "up", "A98:A100"],
    [[99], "A100", "down", "A99:A100"],
    [[98, 99], "A100", "down", "A98:A100"],
    [[98, 99], "A99", "down", "A98:A99"],
  ])(
    "Alter selection vertically from hidden col",
    (hiddenRows, startPosition, direction: SelectionDirection, endPosition) => {
      const model = new Model();
      selectCell(model, startPosition);
      hideRows(model, hiddenRows);
      alterSelection(model, { direction });
      expect(model.getters.getSelectedZone()).toEqual(toZone(endPosition));
    }
  );

  test.each([
    [[0], "A1", "right", "A1"], // won't move
    [[0], "A1:A2", "right", "A1:B2"],
    [[0, 1], "A1:A2", "right", "A1:A2"], // won't move
    [[0, 2], "A1:A3", "right", "A1:B3"],
  ])(
    "Alter selection horizontally from hidden col",
    (hiddenRows, startPosition, direction: SelectionDirection, endPosition) => {
      const model = new Model();
      setSelection(model, [startPosition]);
      hideRows(model, hiddenRows);
      alterSelection(model, { direction });
      expect(model.getters.getSelectedZone()).toEqual(toZone(endPosition));
    }
  );
});

describe("Change selection to sheet extremities", () => {
  test.each([
    [[], [], "F10", "left", "A10"],
    [["A"], [], "F10", "left", "B10"],
    [[], [], "F10", "right", "Z10"],
    [["Z", "Y"], [], "F10", "right", "X10"],
    [["A"], ["B1:C20"], "F10", "left", "B1:C20"],
  ])(
    "Move selection horizontally to sheet extremities",
    (hiddenCols, merges, selection, direction: SelectionDirection, result) => {
      const model = new Model();
      selectCell(model, selection);
      for (const mergeXc of merges) {
        merge(model, mergeXc);
      }
      hideColumns(model, hiddenCols);
      movePosition(model, direction, "end");
      expect(model.getters.getSelectedZone()).toEqual(toZone(result));
    }
  );

  test.each([
    [[], [], "F10", "up", "F1"],
    [[0], [], "F10", "up", "F2"],
    [[], [], "F10", "down", "F100"],
    [[99, 98], [], "F10", "down", "F98"],
    [[0], ["A2:G3"], "F10", "up", "A2:G3"],
  ])(
    "Move selection vertically to sheet extremities",
    (hiddenRows, merges, selection, direction: SelectionDirection, result) => {
      const model = new Model();
      selectCell(model, selection);
      for (const mergeXc of merges) {
        merge(model, mergeXc);
      }
      hideRows(model, hiddenRows);
      movePosition(model, direction, "end");
      expect(model.getters.getSelectedZone()).toEqual(toZone(result));
    }
  );

  test.each([
    [[], [], "F10", "left", "A10:F10"],
    [["A"], [], "F10", "left", "B10:F10"],
    [[], [], "F10", "right", "F10:Z10"],
    [["Z", "Y"], [], "F10", "right", "F10:X10"],
    [["A"], ["B1:C20"], "F10", "left", "B1:F20"],
  ])(
    "Alter selection horizontally to sheet extremities",
    (hiddenCols, merges, selection, direction: SelectionDirection, result) => {
      const model = new Model();
      selectCell(model, selection);
      for (const mergeXc of merges) {
        merge(model, mergeXc);
      }
      hideColumns(model, hiddenCols);
      alterSelection(model, { direction, step: "end" });
      expect(model.getters.getSelectedZone()).toEqual(toZone(result));
    }
  );

  test.each([
    [[], [], "F10", "up", "F1:F10"],
    [[0], [], "F10", "up", "F2:F10"],
    [[], [], "F10", "down", "F10:F100"],
    [[99, 98], [], "F10", "down", "F10:F98"],
    [[0], ["A2:G3"], "F10", "up", "A2:G10"],
  ])(
    "Alter selection vertically to sheet extremities",
    (hiddenRows, merges, selection, direction: SelectionDirection, result) => {
      const model = new Model();
      selectCell(model, selection);
      for (const mergeXc of merges) {
        merge(model, mergeXc);
      }
      hideRows(model, hiddenRows);
      alterSelection(model, { direction, step: "end" });
      expect(model.getters.getSelectedZone()).toEqual(toZone(result));
    }
  );
});

describe("Change selection to next clusters", () => {
  beforeEach(() => {
    model = new Model({
      sheets: [
        {
          colNumber: 9,
          rowNumber: 16,
          cols: { 4: { isHidden: true } },
          rows: { 8: { isHidden: true } },
          cells: {
            B2: { content: "Merge With Content" },
            E2: hiddenContent,
            G2: { content: "content on same line as merge topLeft" },
            E3: hiddenContent,
            G3: { content: "content on line of merge but aligned with topLeft" },
            B6: { content: "content on same line as empty merge topLeft" },
            E6: hiddenContent,
            B7: { content: "content on line of empty merge but aligned with topLeft" },
            E7: hiddenContent,
            A9: hiddenContent,
            B9: hiddenContent,
            C9: hiddenContent,
            D9: hiddenContent,
            E9: hiddenContent,
            F9: hiddenContent,
            G9: hiddenContent,
            A11: { content: "A9" },
            B11: { content: "B9" },
            C11: { content: "C9" },
            E11: hiddenContent,
            F11: { content: "", style: 1 },
            G11: { content: "F9" },
            H11: { content: "G9" },
            B13: { content: "B11" },
            C13: { content: "C11" },
            D13: { content: "D11" },
            B14: { content: "B12" },
            C14: { content: "C12" },
          },
          merges: ["B2:D4", "C6:D7"],
          styles: { 1: { textColor: "#fe0000" } },
        },
      ],
    });
  });
  test.each([
    ["A2", "right", ["B2:D4", "G2", "I2"]],
    ["A3", "right", ["G3", "I3"]],
    ["A6", "right", ["B6", "I6"]],
    ["B11", "right", ["C11", "G11", "H11", "I11"]],
    ["A13", "right", ["B13", "D13", "I13"]],
    ["I1", "right", ["I1", "I1"]],
    ["I2", "left", ["G2", "B2:D4", "A2"]],
    ["I3", "left", ["G3", "A3"]],
    ["I6", "left", ["B6", "A6"]],
    ["I11", "left", ["H11", "G11", "C11", "A11"]],
    ["I13", "left", ["D13", "B13", "A13"]],
    ["A1", "left", ["A1", "A1"]],
  ])(
    "Move selection horizontally",
    (startPosition: string, direction: SelectionDirection, targetXCs: string[]) => {
      selectCell(model, startPosition);
      for (let targetXC of targetXCs) {
        movePosition(model, direction, "end");
        expect(model.getters.getSelectedZone()).toEqual(toZone(targetXC));
      }
    }
  );

  test.each([
    ["A1", "down", ["A11", "A16"]],
    ["B1", "down", ["B2:D4", "B6", "B7", "B11", "B13", "B14", "B16"]],
    ["C1", "down", ["C11", "C13", "C14", "C16"]],
    ["F1", "down", ["F16"]],
    ["G1", "down", ["G2", "G3", "G11", "G16"]],
    ["A16", "down", ["A16", "A16"]],
    ["A16", "up", ["A11", "A1"]],
    ["B16", "up", ["B14", "B13", "B11", "B7", "B6", "B2:D4", "B1"]],
    ["C16", "up", ["C14", "C13", "C11", "C1"]],
    ["F16", "up", ["F1"]],
    ["G16", "up", ["G11", "G3", "G2", "G1"]],
    ["A1", "up", ["A1", "A1"]],
  ])(
    "Move selection vertically",
    (startPosition: string, direction: SelectionDirection, targetXCs: string[]) => {
      selectCell(model, startPosition);
      for (let targetXC of targetXCs) {
        movePosition(model, direction, "end");
        expect(model.getters.getSelectedZone()).toEqual(toZone(targetXC));
      }
    }
  );

  test.each([
    ["A2", "A2", "right", ["A2:D4", "A2:G4", "A2:I4"]],
    ["A3", "A3", "right", ["A2:G4", "A2:I4"]],
    ["A6", "A6", "right", ["A6:B6", "A6:I7"]],
    ["B11", "B11", "right", ["B11:C11", "B11:G11", "B11:H11", "B11:I11"]],
    ["A13", "A13", "right", ["A13:B13", "A13:D13", "A13:I13"]],
    ["A13", "A13:A14", "right", ["A13:B14", "A13:D14", "A13:I14"]],
    ["A14", "A13:A14", "right", ["A13:B14", "A13:C14", "A13:I14"]],
    ["I1", "I1", "right", ["I1", "I1"]],
    ["G2", "G2", "left", ["B2:G4", "A2:G4"]],
    ["H4", "H4", "left", ["A2:H4"]],
    ["I7", "I7", "left", ["B6:I7", "A6:I7"]],
    ["I11", "I11", "left", ["H11:I11", "G11:I11", "C11:I11", "A11:I11"]],
  ])(
    "Alter selection horizontally",
    (anchor: string, selection: string, direction: SelectionDirection, targetXCs: string[]) => {
      setSelection(model, [selection], { anchor });
      for (let targetXC of targetXCs) {
        alterSelection(model, { direction, step: "end" });
        expect(model.getters.getSelectedZone()).toEqual(toZone(targetXC));
      }
    }
  );

  test.each([
    ["A1", "A1", "down", ["A1:A11", "A1:A16"]],
    ["B1", "B1", "down", ["B1:D4", "B1:D7", "B1:D11", "B1:D13", "B1:D14", "B1:D16"]],
    ["C1", "C1", "down", ["B1:D11", "B1:D13", "B1:D14", "B1:D16"]],
    ["F1", "F1", "down", ["F1:F16"]],
    ["G1", "G1", "down", ["G1:G2", "G1:G3", "G1:G11", "G1:G16"]],
    ["B12", "B12:D12", "down", ["B12:D13", "B12:D14", "B12:D16"]],
    ["D12", "B12:D12", "down", ["B12:D13", "B12:D16"]],
    ["A16", "A16", "down", ["A16", "A16"]],
    ["B16", "B16", "up", ["B14:B16", "B13:B16", "B11:B16", "B7:B16", "B6:B16", "B2:D16", "B1:D16"]],
    ["C16", "C16", "up", ["C14:C16", "C13:C16", "C11:C16", "B1:D16"]],
    ["F16", "F16", "up", ["F1:F16"]],
    ["B13", "B13:D15", "up", ["B13:D14", "B13:D13"]],
    ["D13", "B13:D15", "up", ["B13:D13"]],
    ["A1", "A1", "up", ["A1", "A1"]],
  ])(
    "Alter selection vertically",
    (anchor: string, selection: string, direction: SelectionDirection, targetXCs: string[]) => {
      setSelection(model, [selection], { anchor });
      for (let targetXC of targetXCs) {
        alterSelection(model, { direction, step: "end" });
        expect(model.getters.getSelectedZone()).toEqual(toZone(targetXC));
      }
    }
  );
});
