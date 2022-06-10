import { App } from "@odoo/owl";
import { Model, Spreadsheet } from "../../src";
import { zoneToXc } from "../../src/helpers";
import { SheetId } from "../../src/types";
import {
  createFilter,
  hideRows,
  setCellContent,
  setFormat,
  updateFilter,
} from "../test_helpers/commands_helpers";
import { simulateClick } from "../test_helpers/dom_helper";
import {
  getCellsObject,
  makeTestFixture,
  mountSpreadsheet,
  nextTick,
  target,
} from "../test_helpers/helpers";

async function openFilterMenu() {
  await simulateClick(".o-filter-icon");
}

describe("Filter menu component", () => {
  let fixture: HTMLElement;
  let model: Model;
  let sheetId: SheetId;
  let parent: Spreadsheet;
  let app: App;

  function getFilterMenuValues() {
    const values: { value: string; isChecked: boolean }[] = [];
    const filterValueEls = fixture.querySelectorAll(".o-filter-menu-value");
    for (let filterValue of filterValueEls) {
      const isChecked = filterValue.querySelector(".o-filter-menu-value-checked") !== null;
      const value = filterValue.querySelector(".o-filter-menu-value-text")!.textContent!;
      values.push({ value, isChecked });
    }
    return values;
  }

  beforeEach(async () => {
    fixture = makeTestFixture();
    ({ app, parent } = await mountSpreadsheet(fixture));
    model = parent.model;
    sheetId = model.getters.getActiveSheetId();
  });

  afterEach(() => {
    fixture.remove();
    app.destroy();
  });

  describe("Filter Tests", () => {
    beforeEach(async () => {
      createFilter(model, "A1:A5");
      setCellContent(model, "A1", "header");
      setCellContent(model, "A2", "1");
      setCellContent(model, "A3", "1");
      setCellContent(model, "A4", "2");

      createFilter(model, "B1:B4");
      setCellContent(model, "B2", "B2");
      setCellContent(model, "B3", "B3");
      setCellContent(model, "B4", "B4");
      await nextTick();
    });

    test("Filter menu is correctly rendered", async () => {
      await openFilterMenu();
      expect(fixture.querySelector(".o-filter-menu")).toMatchSnapshot();
    });

    test("Duplicates values are not displayed twice", async () => {
      await openFilterMenu();
      const values = getFilterMenuValues();
      expect(values.map((val) => val.value)).toEqual(["1", "2", "Blanks"]);
    });

    test("We display the formatted value of the cells", async () => {
      setFormat(model, "m/d/yyyy", target("A4"));
      await openFilterMenu();
      const values = getFilterMenuValues();
      expect(values.map((val) => val.value)).toEqual(["1", "1/1/1900", "Blanks"]);
    });

    test("Values are checked depending on the filter state", async () => {
      updateFilter(model, "A1", ["1"]);
      await openFilterMenu();
      const values = getFilterMenuValues();
      expect(values).toEqual([
        { value: "1", isChecked: false },
        { value: "2", isChecked: true },
        { value: "Blanks", isChecked: true },
      ]);
    });

    test("Hidden values are not displayed", async () => {
      hideRows(model, [3]);
      await openFilterMenu();
      const values = getFilterMenuValues();
      expect(values.map((val) => val.value)).toEqual(["1", "Blanks"]);
    });

    test("Values hidden by another filter are not displayed", async () => {
      updateFilter(model, "B1", ["B2", "B3"]);
      await openFilterMenu();
      const values = getFilterMenuValues();
      expect(values.map((val) => val.value)).toEqual(["2", "Blanks"]);
    });

    test("Clicking on vales check and uncheck them", async () => {
      await openFilterMenu();
      expect(getFilterMenuValues()[0]).toEqual({ value: "1", isChecked: true });
      await simulateClick(".o-filter-menu-value");
      expect(getFilterMenuValues()[0]).toEqual({ value: "1", isChecked: false });
      await simulateClick(".o-filter-menu-value");
      expect(getFilterMenuValues()[0]).toEqual({ value: "1", isChecked: true });
    });

    test("Confirm button updates the filter with formatted cell value", async () => {
      setFormat(model, "m/d/yyyy", target("A4"));
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual([]);
      await openFilterMenu();
      await simulateClick(".o-filter-menu-value:nth-of-type(1)");
      await simulateClick(".o-filter-menu-value:nth-of-type(2)");
      await simulateClick(".o-filter-menu-button-primary");
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual(["1", "1/1/1900"]);
    });

    test("Cancel button don't save the changes", async () => {
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual([]);
      await openFilterMenu();
      await simulateClick(".o-filter-menu-value:nth-of-type(1)");
      await simulateClick(".o-filter-menu-value:nth-of-type(2)");
      await simulateClick(".o-filter-menu-button-cancel");
      expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual([]);
    });

    test("Can clear and select all", async () => {
      await openFilterMenu();
      expect(getFilterMenuValues()).toEqual([
        { value: "1", isChecked: true },
        { value: "2", isChecked: true },
        { value: "Blanks", isChecked: true },
      ]);
      await simulateClick(".o-filter-menu-action-text:nth-of-type(2)");
      expect(getFilterMenuValues()).toEqual([
        { value: "1", isChecked: false },
        { value: "2", isChecked: false },
        { value: "Blanks", isChecked: false },
      ]);
      await simulateClick(".o-filter-menu-action-text:nth-of-type(1)");
      expect(getFilterMenuValues()).toEqual([
        { value: "1", isChecked: true },
        { value: "2", isChecked: true },
        { value: "Blanks", isChecked: true },
      ]);
    });

    test("Can filter values with the search bar", async () => {
      await openFilterMenu();
      const searchInput = fixture.querySelector(".o-filter-menu input") as HTMLInputElement;
      searchInput.value = "1";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await nextTick();
      expect(getFilterMenuValues().map((v) => v.value)).toEqual(["1"]);
    });

    test("Search bar uses fuzzy search", async () => {
      setCellContent(model, "A2", "Karadoc");
      setCellContent(model, "A3", "Perceval");
      setCellContent(model, "A4", "Leodagan");
      setCellContent(model, "A5", "Lancelot");

      await openFilterMenu();
      const searchInput = fixture.querySelector(".o-filter-menu input") as HTMLInputElement;
      searchInput.value = "lo";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      await nextTick();
      expect(getFilterMenuValues().map((v) => v.value)).toEqual(["Leodagan", "Lancelot"]);
    });
  });

  test("Sort filter", async () => {
    console.log(model.getters.getFilterTables(sheetId).map((f) => zoneToXc(f.zone)));
    createFilter(model, "A10:B15");
    setCellContent(model, "A10", "header");
    setCellContent(model, "A11", "olà");
    setCellContent(model, "A12", "1");
    setCellContent(model, "A13", "-1");
    setCellContent(model, "A14", "2");

    setCellContent(model, "B10", "header");
    setCellContent(model, "B11", "");
    setCellContent(model, "B12", "ab");
    setCellContent(model, "B13", "ba");
    setCellContent(model, "B14", "ca");
    await nextTick();

    await openFilterMenu();
    await simulateClick(".o-filter-menu-item:nth-of-type(1)");
    expect(getCellsObject(model, sheetId)).toMatchObject({
      A10: { content: "header" },
      A11: { content: "-1" },
      A13: { content: "1" },
      A14: { content: "2" },
      A15: { content: "olà" },
      B10: { content: "header" },
      B11: { content: "ba" },
      B13: { content: "ab" },
      B14: { content: "ca" },
    });

    await openFilterMenu();
    await simulateClick(".o-filter-menu-item:nth-of-type(2)");
    expect(getCellsObject(model, sheetId)).toMatchObject({
      A10: { content: "header" },
      A11: { content: "olà" },
      A12: { content: "2" },
      A13: { content: "1" },
      A15: { content: "-1" },
      B10: { content: "header" },
      B12: { content: "ca" },
      B13: { content: "ab" },
      B15: { content: "ba" },
    });
  });
});
