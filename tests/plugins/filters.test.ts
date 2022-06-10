import { CommandResult, Model } from "../../src";
import { SheetId } from "../../src/types";
import {
  createFilter,
  deleteFilter,
  merge,
  redo,
  setCellContent,
  undo,
  updateFilter,
} from "../test_helpers/commands_helpers";

// function getHiddenRows(model: Model) {
//   return model.getters.getHiddenRowsGroups(model.getters.getActiveSheetId()).flat();
// }

describe("Filters plugin", () => {
  let model: Model;
  let sheetId: SheetId;

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

    test("Create Filter is correctly rejected for target overlapping another filter", () => {
      createFilter(model, "A1:A10");
      expect(createFilter(model, "A1:A5")).toBeCancelledBecause(CommandResult.FilterOverlap);
    });

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

  //   test("GetFilterZoneValues", () => {
  //     const model = new Model();
  //     setCellContent(model, "A1", "A1");
  //     setCellContent(model, "A2", "A2");
  //     setCellContent(model, "A3", "A3");
  //     setCellContent(model, "A4", "A4");
  //     hideRows(model, [0, 1]);
  //     expect(model.getters.getFilterZoneValues(toZone("A1:A4"))).toEqual(["A1", "A2", "A3", "A4"]);
  //     expect(model.getters.getFilterZoneValues(toZone("A1:A4"), true)).toEqual(["A3", "A4"]);
  //   });

  //   describe("Grid manipulation", () => {
  //     let model: Model;
  //     let sheetId: UID;
  //     beforeEach(() => {
  //       model = new Model();
  //       createFilter(model, "C3:F6");
  //       sheetId = model.getters.getActiveSheetId();
  //     });

  //     describe("Add columns", () => {
  //       test("Before the zone", () => {
  //         addColumns(model, "before", "A", 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("D3:G6"));
  //       });

  //       test("On the left part of the zone, add a column before", () => {
  //         addColumns(model, "before", "C", 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("D3:G6"));
  //       });

  //       test("On the left part of the zone, add a column after", () => {
  //         addColumns(model, "after", "C", 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:G6"));
  //       });

  //       test("On the right part of the zone, add a column before", () => {
  //         addColumns(model, "before", "F", 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:G6"));
  //       });

  //       test("On the right part of the zone, add a column after", () => {
  //         addColumns(model, "after", "F", 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:G6"));
  //       });

  //       test("After the zone", () => {
  //         addColumns(model, "after", "H", 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F6"));
  //       });
  //     });

  //     describe("Delete columns", () => {
  //       test("Before the zone", () => {
  //         deleteColumns(model, ["A"]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("B3:E6"));
  //       });

  //       test("On the left part of the zone", () => {
  //         deleteColumns(model, ["C"]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:E6"));
  //       });

  //       test("Inside the zone", () => {
  //         deleteColumns(model, ["D"]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:E6"));
  //       });

  //       test("On the right part of the zone", () => {
  //         deleteColumns(model, ["F"]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:E6"));
  //       });

  //       test("After the zone", () => {
  //         deleteColumns(model, ["H"]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F6"));
  //       });
  //     });

  //     describe("Add rows", () => {
  //       test("Before the zone", () => {
  //         addRows(model, "before", 0, 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C4:F7"));
  //       });

  //       test("On the top part of the zone, add a row before", () => {
  //         addRows(model, "before", 2, 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C4:F7"));
  //       });

  //       test("On the top part of the zone, add a row after", () => {
  //         addRows(model, "after", 2, 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F7"));
  //       });

  //       test("On the bottom part of the zone, add a row before", () => {
  //         addRows(model, "before", 5, 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F7"));
  //       });

  //       test("On the bottom part of the zone, add a row after", () => {
  //         addRows(model, "after", 5, 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F7"));
  //       });

  //       test("After the zone", () => {
  //         addRows(model, "after", 7, 1);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F6"));
  //       });
  //     });

  //     describe("Delete rows", () => {
  //       test("Before the zone", () => {
  //         deleteRows(model, [0]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C2:F5"));
  //       });

  //       test("On the left part of the zone", () => {
  //         deleteRows(model, [2]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F5"));
  //       });

  //       test("Inside the zone", () => {
  //         deleteRows(model, [3]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F5"));
  //       });

  //       test("On the right part of the zone", () => {
  //         deleteRows(model, [5]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F5"));
  //       });

  //       test("After the zone", () => {
  //         deleteRows(model, [7]);
  //         expect(model.getters.getFilter(sheetId)?.zone).toEqual(toZone("C3:F6"));
  //       });
  //     });
  //   });

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

  test("Import/Export filters", () => {
    createFilter(model, "A1:B5");
    createFilter(model, "C5:C9");
    updateFilter(model, "A1", ["5"]);
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
    expect(JSON.stringify(imported.getters.getFilterTables(sheetId))).toEqual(
      JSON.stringify(model.getters.getFilterTables(sheetId))
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
