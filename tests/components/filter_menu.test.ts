import { App } from "@odoo/owl";
import { Model, Spreadsheet } from "../../src";
import { SheetId } from "../../src/types";
import {
  createFilter,
  hideRows,
  setCellContent,
  updateFilter,
} from "../test_helpers/commands_helpers";
import { simulateClick } from "../test_helpers/dom_helper";
import { getCellContent } from "../test_helpers/getters_helpers";
import { makeTestFixture, mountSpreadsheet, nextTick } from "../test_helpers/helpers";

describe("Filter menu component", () => {
  let fixture: HTMLElement;
  let model: Model;
  let sheetId: SheetId;
  let parent: Spreadsheet;
  let app: App;

  async function openFilterMenu() {
    await simulateClick(".o-filter-icon");
  }

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

  afterEach(() => {
    fixture.remove();
    app.destroy();
  });

  //TODO search bar test
  //TODO skip
  test.skip("Filter menu is correctly rendered", async () => {
    await openFilterMenu();
    expect(fixture.querySelector(".o-filter-menu")).toMatchSnapshot();
  });

  test("Duplicates values are not displayed twice", async () => {
    await openFilterMenu();
    const values = getFilterMenuValues();
    expect(values.map((val) => val.value)).toEqual(["1", "2", "Blanks"]);
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

  test("Confirm button updates the filter", async () => {
    expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual([]);
    await openFilterMenu();
    await simulateClick(".o-filter-menu-value:nth-of-type(1)");
    await simulateClick(".o-filter-menu-value:nth-of-type(2)");
    await simulateClick(".o-filter-menu-button-primary");
    expect(model.getters.getFilter(sheetId, 0, 0)!.filteredValues).toEqual(["1", "2"]);
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

  test("Can sort Ascending and descending", async () => {
    await openFilterMenu();
    await simulateClick(".o-filter-menu-item:nth-of-type(2)");
    expect(getCellContent(model, "A2")).toEqual("2");
    expect(getCellContent(model, "A3")).toEqual("1");
    expect(getCellContent(model, "A4")).toEqual("1");
    expect(getCellContent(model, "A5")).toEqual("");

    await openFilterMenu();
    await simulateClick(".o-filter-menu-item:nth-of-type(1)");
    expect(getCellContent(model, "A2")).toEqual("1");
    expect(getCellContent(model, "A3")).toEqual("1");
    expect(getCellContent(model, "A4")).toEqual("1");
    expect(getCellContent(model, "A5")).toEqual("");
  });
});
