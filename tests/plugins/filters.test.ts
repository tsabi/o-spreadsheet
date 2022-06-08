import { CommandResult, Model } from "../../src";
import { createFilter, merge, redo, undo, updateFilter } from "../test_helpers/commands_helpers";

// function getHiddenRows(model: Model) {
//   return model.getters.getHiddenRowsGroups(model.getters.getActiveSheetId()).flat();
// }

describe("Filters plugin", () => {
  let model: Model;
  //   let sheetId: SheetId;

  beforeEach(() => {
    model = new Model();
    // sheetId = model.getters.getActiveSheetId();
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
        expect(createFilter(model, "A1:A5")).toBeCancelledBecause(CommandResult.MergeAcrossFilter);
      });

      test("Create Filter is correctly rejected when a vertical merge is in the filter", () => {
        merge(model, "A1:A2");
        expect(createFilter(model, "A1:A5")).toBeCancelledBecause(
          CommandResult.VerticalMergeInFilter
        );
      });

      test("Create Filter accepted when horizontal merge is in the filter", () => {
        merge(model, "A1:B1");
        expect(createFilter(model, "A1:B5")).toBeSuccessfullyDispatched();
      });

      test("Add Merge is correctly rejected when the merge is partially inside a filter", () => {
        createFilter(model, "A1:A5");
        expect(merge(model, "A1:B1")).toBeCancelledBecause(CommandResult.MergeAcrossFilter);
      });

      test("Add Merge is correctly rejected when creating a vertical merge inside a filter", () => {
        createFilter(model, "A1:A5");
        expect(merge(model, "A1:A2")).toBeCancelledBecause(CommandResult.VerticalMergeInFilter);
      });

      test("Add Merge accepted when creating horizontal merge inside a filter", () => {
        createFilter(model, "A1:B5");
        expect(merge(model, "A1:B1")).toBeSuccessfullyDispatched();
      });
    });
    // test("Set Filter value is rejected if the filter is not defined", () => {
    //   const model = new Model();
    //   createFilter(model, "A1:A4");
    //   expect(setFilterValue(model, "A1", "ANY")).toBeSuccessfullyDispatched();
    //   expect(setFilterValue(model, "B1", "ANY")).toBeCancelledBecause(
    //     CommandResult.InvalidFilterZone
    //   );
    //   expect(setFilterValue(model, "B2", "ANY")).toBeCancelledBecause(
    //     CommandResult.InvalidFilterZone
    //   );
    //   deleteFilter(model);
    //   expect(setFilterValue(model, "A1", "ANY")).toBeCancelledBecause(CommandResult.MissingFilter);
    // });

    // test("delete filter is rejected if the filter is not defined", () => {
    //   const model = new Model();
    //   expect(deleteFilter(model)).toBeCancelledBecause(CommandResult.MissingFilter);
    // });

    // test("delete filter is accepted if the filter is defined", () => {
    //   const model = new Model();
    //   createSheet(model, { sheetId: "42" });
    //   createFilter(model, "A1:B2");
    //   expect(deleteFilter(model)).toBeSuccessfullyDispatched();
    // });
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

    // test("Can undo/redo a delete filter value", () => {
    //   const model = new Model();
    //   createFilter(model, "A1:A4");
    //   const sheetId = model.getters.getActiveSheetId();
    //   expect(model.getters.isSheetContainsFilter(sheetId)).toBe(true);
    //   removeFilter(model);
    //   expect(model.getters.isSheetContainsFilter(sheetId)).toBe(false);
    //   undo(model);
    //   expect(model.getters.isSheetContainsFilter(sheetId)).toBe(true);
    //   redo(model);
    //   expect(model.getters.isSheetContainsFilter(sheetId)).toBe(false);
    // });
  });
});
