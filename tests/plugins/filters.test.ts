import { deepStrictEqual } from "assert";
import { CommandResult, Model } from "../../src";
import { toZone, zoneToXc } from "../../src/helpers";
import { ClipboardOptions, UID } from "../../src/types";
import {
  addColumns,
  addRows,
  copy,
  createFilter,
  cut,
  deleteColumns,
  deleteFilter,
  deleteRows,
  merge,
  paste,
  redo,
  setCellContent,
  undo,
  updateFilter,
} from "../test_helpers/commands_helpers";

function getFilterValues(model, sheetId = model.getters.getActiveSheetId()) {
  return model.getters.getFilterTables(sheetId)[0].filters.map((filter) => ({
    zone: zoneToXc(filter.zoneWithHeaders),
    value: filter.filteredValues,
  }));
}

describe("Filters plugin", () => {
  let model: Model;
  let sheetId: UID;

  beforeEach(() => {
    model = new Model();
    sheetId = model.getters.getActiveSheetId();
  });

  describe("Dispatch results", () => {
    test("Create Filter is correctly rejected if given invalid zone", () => {
      expect(
        model.dispatch("CREATE_FILTER_TABLE", {
          sheetId: model.getters.getActiveSheetId(),
          target: [{ top: -1, bottom: 0, right: 5, left: 9 }],
        })
      ).toBeCancelledBecause(CommandResult.InvalidRange);
    });

    test("Create Filter is correctly rejected for target out of sheet", () => {
      expect(createFilter(model, "A1:A1000")).toBeCancelledBecause(CommandResult.TargetOutOfSheet);
    });

    test.each(["A1,B3", "A1:B2,A3", "A1,B1:B2"])(
      "For multiple targets, create Filter is correctly rejected for non-continuous target",
      (target) => {
        expect(createFilter(model, target)).toBeCancelledBecause(
          CommandResult.NonContinuousTargets
        );
      }
    );

    test.each(["A1", "B1:B10,A1:A10"])(
      "Create Filter is correctly rejected for target overlapping another filter",
      (target) => {
        createFilter(model, "A1:A10");
        expect(createFilter(model, target)).toBeCancelledBecause(CommandResult.FilterOverlap);
      }
    );

    test("Update Filter is correctly rejected when target is not inside a filter", () => {
      createFilter(model, "A1:A10");
      expect(updateFilter(model, "B1", [])).toBeCancelledBecause(CommandResult.FilterNotFound);
    });

    describe("merges", () => {
      test("Create Filter is correctly rejected when a merge in partially inside the filter", () => {
        merge(model, "A1:B1");
        expect(createFilter(model, "A1:A5")).toBeCancelledBecause(CommandResult.MergeInFilter);
      });

      test("Create Filter is correctly rejected when  merge is in the filter", () => {
        merge(model, "A1:A2");
        expect(createFilter(model, "A1:A5")).toBeCancelledBecause(CommandResult.MergeInFilter);
      });

      test("Add Merge is correctly rejected when the merge is partially inside a filter", () => {
        createFilter(model, "A1:A5");
        expect(merge(model, "A1:B1")).toBeCancelledBecause(CommandResult.MergeInFilter);
      });

      test("Add Merge is correctly rejected when creating a merge inside a filter", () => {
        createFilter(model, "A1:A5");
        expect(merge(model, "A1:A2")).toBeCancelledBecause(CommandResult.MergeInFilter);
      });
    });
  });

  describe("Creating and updating a filter", () => {
    test("Can create a filter", () => {
      createFilter(model, "A1:A5");
      expect(model.getters.getFilterTable(sheetId, 0, 0)!.zone).toEqual(toZone("A1:A5"));

      expect(model.getters.getFilter(sheetId, 0, 0)).toEqual({
        zoneWithHeaders: toZone("A1:A5"),
        filteredValues: [],
      });
    });

    test("Can update  a filter", () => {
      createFilter(model, "A1:A5");
      updateFilter(model, "A1", ["2", "A"]);
      expect(model.getters.getFilters(sheetId)).toEqual([
        { zoneWithHeaders: toZone("A1:A5"), filteredValues: ["2", "A"] },
      ]);
    });

    test("Create a filter with multiple target create a single filter of the union of the targets", () => {
      createFilter(model, "A1:A5, B1:B5");
      expect(model.getters.getFilterTable(sheetId, 0, 0)!.zone).toEqual(toZone("A1:B5"));
    });

    test("Create new filter on sheet duplication", () => {
      createFilter(model, "A1:A3");
      updateFilter(model, "A1", ["C"]);

      const sheet2Id = "42";
      model.dispatch("DUPLICATE_SHEET", {
        sheetId: sheetId,
        sheetIdTo: sheet2Id,
      });
      updateFilter(model, "A1", ["D"], sheet2Id);

      expect(model.getters.getFilter(sheetId, 0, 0)).toMatchObject({
        zoneWithHeaders: toZone("A1:A3"),
        filteredValues: ["C"],
      });
      expect(model.getters.getFilter(sheet2Id, 0, 0)).toMatchObject({
        zoneWithHeaders: toZone("A1:A3"),
        filteredValues: ["D"],
      });
    });
  });

  describe("Filter Table Zone Expansion", () => {
    test("Table zone is expanded when creating a new cell just below the filter", () => {
      createFilter(model, "A1:B3");
      updateFilter(model, "A1", ["C"]);
      setCellContent(model, "A4", "Something");
      setCellContent(model, "B5", "Something Else");
      expect(zoneToXc(model.getters.getFilterTables(sheetId)[0].zone)).toEqual("A1:B5");
      expect(getFilterValues(model)).toEqual([
        { zone: "A1:A5", value: ["C"] },
        { zone: "B1:B5", value: [] },
      ]);
    });

    test("Table zone isn't expanded when creating cells at the side of the table", () => {
      createFilter(model, "B1:B3");
      setCellContent(model, "A1", "Something");
      setCellContent(model, "C3", "Something Else");
      expect(zoneToXc(model.getters.getFilterTables(sheetId)[0].zone)).toEqual("B1:B3");
      expect(getFilterValues(model)).toEqual([{ zone: "B1:B3", value: [] }]);
    });

    test("Table zone isn't expended at creation", () => {
      setCellContent(model, "A4", "Something");
      createFilter(model, "A1:A3");
      expect(zoneToXc(model.getters.getFilterTables(sheetId)[0].zone)).toEqual("A1:A3");
      expect(getFilterValues(model)).toEqual([{ zone: "A1:A3", value: [] }]);
    });

    test("Table zone isn't expanded when modifying existing cell", () => {
      setCellContent(model, "A4", "Something");
      createFilter(model, "A1:A3");
      setCellContent(model, "A4", "Something Else");
      expect(zoneToXc(model.getters.getFilterTables(sheetId)[0].zone)).toEqual("A1:A3");
      expect(getFilterValues(model)).toEqual([{ zone: "A1:A3", value: [] }]);
    });
  });

  describe("Grid manipulation", () => {
    let model: Model;
    let sheetId: UID;
    beforeEach(() => {
      model = new Model();
      createFilter(model, "C3:F6");
      updateFilter(model, "C3", ["C"]);
      updateFilter(model, "D3", ["D"]);
      updateFilter(model, "E3", ["E"]);
      updateFilter(model, "F3", ["F"]);
      sheetId = model.getters.getActiveSheetId();
    });

    describe("Add columns", () => {
      test("Before the zone", () => {
        addColumns(model, "before", "A", 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("D3:G6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "D3:D6", value: ["C"] },
          { zone: "E3:E6", value: ["D"] },
          { zone: "F3:F6", value: ["E"] },
          { zone: "G3:G6", value: ["F"] },
        ]);
      });

      test("On the left part of the zone, add a column before", () => {
        addColumns(model, "before", "C", 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("D3:G6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "D3:D6", value: ["C"] },
          { zone: "E3:E6", value: ["D"] },
          { zone: "F3:F6", value: ["E"] },
          { zone: "G3:G6", value: ["F"] },
        ]);
      });

      test("On the left part of the zone, add a column after", () => {
        addColumns(model, "after", "C", 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:G6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: [] },
          { zone: "E3:E6", value: ["D"] },
          { zone: "F3:F6", value: ["E"] },
          { zone: "G3:G6", value: ["F"] },
        ]);
      });

      test("On the right part of the zone, add a column before", () => {
        addColumns(model, "before", "F", 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:G6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
          { zone: "F3:F6", value: [] },
          { zone: "G3:G6", value: ["F"] },
        ]);
      });

      test("On the right part of the zone, add a column after", () => {
        addColumns(model, "after", "F", 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
          { zone: "F3:F6", value: ["F"] },
        ]);
      });

      test("After the zone", () => {
        addColumns(model, "after", "H", 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
          { zone: "F3:F6", value: ["F"] },
        ]);
      });
    });

    describe("Delete columns", () => {
      test("Before the zone", () => {
        deleteColumns(model, ["A"]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("B3:E6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "B3:B6", value: ["C"] },
          { zone: "C3:C6", value: ["D"] },
          { zone: "D3:D6", value: ["E"] },
          { zone: "E3:E6", value: ["F"] },
        ]);
      });

      test("On the left part of the zone", () => {
        deleteColumns(model, ["C"]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:E6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["D"] },
          { zone: "D3:D6", value: ["E"] },
          { zone: "E3:E6", value: ["F"] },
        ]);
      });

      test("Inside the zone", () => {
        deleteColumns(model, ["D"]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:E6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["E"] },
          { zone: "E3:E6", value: ["F"] },
        ]);
      });

      test("On the right part of the zone", () => {
        deleteColumns(model, ["F"]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:E6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
        ]);
      });

      test("After the zone", () => {
        deleteColumns(model, ["H"]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
          { zone: "F3:F6", value: ["F"] },
        ]);
      });
    });

    describe("Add rows", () => {
      test("Before the zone", () => {
        addRows(model, "before", 0, 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C4:F7"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C4:C7", value: ["C"] },
          { zone: "D4:D7", value: ["D"] },
          { zone: "E4:E7", value: ["E"] },
          { zone: "F4:F7", value: ["F"] },
        ]);
      });

      test("On the top part of the zone, add a row before", () => {
        addRows(model, "before", 2, 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C4:F7"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C4:C7", value: ["C"] },
          { zone: "D4:D7", value: ["D"] },
          { zone: "E4:E7", value: ["E"] },
          { zone: "F4:F7", value: ["F"] },
        ]);
      });

      test("On the top part of the zone, add a row after", () => {
        addRows(model, "after", 2, 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F7"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C7", value: ["C"] },
          { zone: "D3:D7", value: ["D"] },
          { zone: "E3:E7", value: ["E"] },
          { zone: "F3:F7", value: ["F"] },
        ]);
      });

      test("On the bottom part of the zone, add a row before", () => {
        addRows(model, "before", 5, 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F7"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C7", value: ["C"] },
          { zone: "D3:D7", value: ["D"] },
          { zone: "E3:E7", value: ["E"] },
          { zone: "F3:F7", value: ["F"] },
        ]);
      });

      test("On the bottom part of the zone, add a row after", () => {
        addRows(model, "after", 5, 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
          { zone: "F3:F6", value: ["F"] },
        ]);
      });

      test("After the zone", () => {
        addRows(model, "after", 7, 1);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
          { zone: "F3:F6", value: ["F"] },
        ]);
      });
    });

    describe("Delete rows", () => {
      test("Before the zone", () => {
        deleteRows(model, [0]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C2:F5"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C2:C5", value: ["C"] },
          { zone: "D2:D5", value: ["D"] },
          { zone: "E2:E5", value: ["E"] },
          { zone: "F2:F5", value: ["F"] },
        ]);
      });

      test("On the left part of the zone", () => {
        deleteRows(model, [2]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F5"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C5", value: ["C"] },
          { zone: "D3:D5", value: ["D"] },
          { zone: "E3:E5", value: ["E"] },
          { zone: "F3:F5", value: ["F"] },
        ]);
      });

      test("Inside the zone", () => {
        deleteRows(model, [3]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F5"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C5", value: ["C"] },
          { zone: "D3:D5", value: ["D"] },
          { zone: "E3:E5", value: ["E"] },
          { zone: "F3:F5", value: ["F"] },
        ]);
      });

      test("On the right part of the zone", () => {
        deleteRows(model, [5]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F5"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C5", value: ["C"] },
          { zone: "D3:D5", value: ["D"] },
          { zone: "E3:E5", value: ["E"] },
          { zone: "F3:F5", value: ["F"] },
        ]);
      });

      test("After the zone", () => {
        deleteRows(model, [7]);
        expect(model.getters.getFilterTables(sheetId)[0].zone).toEqual(toZone("C3:F6"));
        expect(getFilterValues(model)).toEqual([
          { zone: "C3:C6", value: ["C"] },
          { zone: "D3:D6", value: ["D"] },
          { zone: "E3:E6", value: ["E"] },
          { zone: "F3:F6", value: ["F"] },
        ]);
      });
    });
  });

  describe("Undo/Redo", () => {
    test("Can undo/redo a create filter", () => {
      const model = new Model();
      createFilter(model, "C1:C4");
      const sheetId = model.getters.getActiveSheetId();
      expect(model.getters.getFilterTables(sheetId).length).toBe(1);
      undo(model);
      expect(model.getters.getFilterTables(sheetId).length).toBe(0);
      redo(model);
      expect(model.getters.getFilterTables(sheetId).length).toBe(1);
    });

    test("Can undo/redo a delete filter", () => {
      const model = new Model();
      createFilter(model, "A1:A4");
      const sheetId = model.getters.getActiveSheetId();
      expect(model.getters.getFilter(sheetId, 0, 0)).toBeTruthy();
      deleteFilter(model, "A1");
      expect(model.getters.getFilter(sheetId, 0, 0)).toBeFalsy();
      undo(model);
      expect(model.getters.getFilter(sheetId, 0, 0)).toBeTruthy();
      redo(model);
      expect(model.getters.getFilter(sheetId, 0, 0)).toBeFalsy();
    });

    test("Can undo/redo update a filter", () => {
      const model = new Model();
      createFilter(model, "A1:A4");
      updateFilter(model, "A1", ["Value"]);
      const sheetId = model.getters.getActiveSheetId();
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual(["Value"]);
      updateFilter(model, "A1", ["Modified"]);
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual(["Modified"]);
      undo(model);
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual(["Value"]);
      redo(model);
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual(["Modified"]);
    });
  });

  describe("Cop/Cut/Paste filters", () => {
    beforeEach(() => {
      createFilter(model, "A1:B4");
      updateFilter(model, "A1", ["thisIsAValue"]);
      createFilter(model, "D5:D7");
    });

    test("Can copy and paste a filter table", () => {
      copy(model, "A1:B4");
      paste(model, "A5");
      expect(model.getters.getFilterTable(sheetId, 0, 0)).toBeTruthy();
      const copiedTable = model.getters.getFilterTable(sheetId, 0, 4);
      expect(copiedTable).toBeTruthy();
      expect(copiedTable?.filters[0].filteredValues).toEqual(["thisIsAValue"]);
    });

    test("Can cut and paste a filter table", () => {
      cut(model, "A1:B4");
      paste(model, "A5");
      expect(model.getters.getFilterTable(sheetId, 0, 0)).toBeFalsy();
      const copiedTable = model.getters.getFilterTable(sheetId, 0, 4);
      expect(copiedTable).toBeTruthy();
      expect(copiedTable?.filters[0].filteredValues).toEqual(["thisIsAValue"]);
    });

    test("Can cut and paste multiple filter tables", () => {
      cut(model, "A1:D7");
      paste(model, "A5");
      expect(model.getters.getFilterTable(sheetId, 0, 0)).toBeFalsy();
      expect(model.getters.getFilterTable(sheetId, 3, 4)).toBeFalsy();

      const copiedTable = model.getters.getFilterTable(sheetId, 0, 4);
      expect(copiedTable).toBeTruthy();
      expect(copiedTable?.filters[0].filteredValues).toEqual(["thisIsAValue"]);
      expect(model.getters.getFilterTable(sheetId, 3, 8)).toBeTruthy();
    });

    test("Don't take tables that are not entirety in the selection", () => {
      cut(model, "A1:A2");
      paste(model, "A5");
      expect(model.getters.getFilterTable(sheetId, 0, 0)).toBeTruthy();
      expect(model.getters.getFilterTable(sheetId, 0, 4)).toBeFalsy();
    });

    test.each(["onlyFormat", "onlyValue"] as ClipboardOptions[])(
      "Special paste %s don't paste filter tables",
      (pasteOption: ClipboardOptions) => {
        copy(model, "A1:B4");
        paste(model, "A5", undefined, pasteOption);
        expect(model.getters.getFilterTable(sheetId, 0, 4)).toBeFalsy();
      }
    );
  });

  describe("Import/Export", () => {
    test("Import/Export filters", () => {
      createFilter(model, "A1:B5");
      createFilter(model, "C5:C9");
      setCellContent(model, "A2", "5");
      updateFilter(model, "A1", ["5"]);
      setCellContent(model, "B3", "8");
      setCellContent(model, "B4", "hey");
      updateFilter(model, "B1", ["8", "hey"]);

      const exported = model.exportData();
      expect(exported.sheets[0].filterTables).toMatchObject([
        {
          range: "A1:B5",
          filters: [
            {
              col: 0,
              filteredValues: ["5"],
            },
            {
              col: 1,
              filteredValues: ["8", "hey"],
            },
          ],
        },
        {
          range: "C5:C9",
          filters: [
            {
              col: 2,
              filteredValues: [],
            },
          ],
        },
      ]);

      const imported = new Model(exported);

      // Stringify/Parse to transform classes to POJOs
      deepStrictEqual(
        JSON.parse(JSON.stringify(imported.getters.getFilterTables(sheetId))),
        JSON.parse(JSON.stringify(model.getters.getFilterTables(sheetId))),
        "Expected original filters and imported filters to be equal"
      );
    });

    test("Filtered values that don't filter any row are dropped at export", () => {
      // This happens if we have for example B1 = 5, A1=B1, we filter 5 in the col A, but then we change B1 to 9
      createFilter(model, "A1:A3");
      const filteredValues = ["a", "b", "c", "d", "e", "f"];
      updateFilter(model, "A1", filteredValues);
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual(filteredValues);

      setCellContent(model, "A1", "a");
      setCellContent(model, "A2", "b");
      setCellContent(model, "A3", "e");

      // "a" isn't filtered because it's the header of the filter
      expect(model.exportData().sheets[0].filterTables[0].filters[0].filteredValues).toEqual([
        "b",
        "e",
      ]);
    });
  });
});
