import { Model } from "../../src";
import { toZone } from "../../src/helpers";
import { SheetId } from "../../src/types";
import { createFilter, setCellContent, updateFilter } from "../test_helpers/commands_helpers";
import { DEFAULT_FILTER_BORDER_DESC } from "./../../src/constants";

describe("Filters plugin", () => {
  let model: Model;
  let sheetId: SheetId;

  beforeEach(() => {
    model = new Model();
    sheetId = model.getters.getActiveSheetId();
    setCellContent(model, "A1", "A1");
    setCellContent(model, "A2", "A2");
    setCellContent(model, "A3", "A3");
    setCellContent(model, "A4", "A4");
    setCellContent(model, "A5", "A5");
    createFilter(model, "A1:A5");

    setCellContent(model, "B1", "Header");
    setCellContent(model, "B2", "1");
    setCellContent(model, "B3", "1");
    setCellContent(model, "B4", "2");
    setCellContent(model, "B5", "2");
    createFilter(model, "B1:B5");
  });

  test("Can filter a row", () => {
    updateFilter(model, "A1", ["A2", "A3"]);
    expect(model.getters.isRowHidden(sheetId, 0)).toEqual(false);
    expect(model.getters.isRowHidden(sheetId, 1)).toEqual(true);
    expect(model.getters.isRowHidden(sheetId, 2)).toEqual(true);
    expect(model.getters.isRowHidden(sheetId, 3)).toEqual(false);
    expect(model.getters.isRowHidden(sheetId, 4)).toEqual(false);
  });

  test("Header isn't filtered", () => {
    updateFilter(model, "A1", ["A1"]);
    expect(model.getters.isRowHidden(sheetId, 0)).toEqual(false);
  });

  test("All filters are correctly applied", () => {
    updateFilter(model, "A1", ["A2"]);
    updateFilter(model, "B1", ["1"]);
    expect(model.getters.isRowHidden(sheetId, 0)).toEqual(false);
    expect(model.getters.isRowHidden(sheetId, 1)).toEqual(true);
    expect(model.getters.isRowHidden(sheetId, 2)).toEqual(true);
    expect(model.getters.isRowHidden(sheetId, 3)).toEqual(false);
    expect(model.getters.isRowHidden(sheetId, 4)).toEqual(false);

    updateFilter(model, "A1", []);
    expect(model.getters.isRowHidden(sheetId, 0)).toEqual(false);
    expect(model.getters.isRowHidden(sheetId, 1)).toEqual(true);
    expect(model.getters.isRowHidden(sheetId, 2)).toEqual(true);
    expect(model.getters.isRowHidden(sheetId, 3)).toEqual(false);
    expect(model.getters.isRowHidden(sheetId, 4)).toEqual(false);
  });

  test("Filters borders are correct", () => {
    createFilter(model, "A7:B9");
    const zone = toZone("A7:B9");
    for (let row = zone.top; row <= zone.bottom; row++) {
      for (let col = zone.left; col <= zone.right; col++) {
        const filterBorder = model.getters.getFilterBorder(sheetId, col, row);
        const expected = {};
        expected["top"] = row === zone.top ? DEFAULT_FILTER_BORDER_DESC : undefined;
        expected["bottom"] = row === zone.bottom ? DEFAULT_FILTER_BORDER_DESC : undefined;
        expected["left"] = col === zone.left ? DEFAULT_FILTER_BORDER_DESC : undefined;
        expected["right"] = col === zone.right ? DEFAULT_FILTER_BORDER_DESC : undefined;
        expect(filterBorder).toEqual(expected);
      }
    }
  });
});
