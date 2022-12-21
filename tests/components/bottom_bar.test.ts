import { App, Component, onMounted, onWillUnmount, xml } from "@odoo/owl";
import { BottomBar } from "../../src/components/bottom_bar/bottom_bar";
import { Model } from "../../src/model";
import { SpreadsheetChildEnv, UID } from "../../src/types";
import { OWL_TEMPLATES } from "../setup/jest.setup";
import { mockGetBoundingClientRect } from "../test_helpers";
import {
  activateSheet,
  createSheet,
  deleteSheet,
  hideSheet,
  redo,
  renameSheet,
  resizeColumns,
  resizeRows,
  selectCell,
  setCellContent,
  undo,
} from "../test_helpers/commands_helpers";
import { dragElement, getElComputedStyle, triggerMouseEvent } from "../test_helpers/dom_helper";
import { makeTestEnv, makeTestFixture, mockUuidV4To, nextTick } from "../test_helpers/helpers";
jest.mock("../../src/helpers/uuid", () => require("../__mocks__/uuid"));

let fixture: HTMLElement;

class Parent extends Component<any, any> {
  static template = xml/* xml */ `
    <div class="o-spreadsheet">
      <BottomBar onClick="()=>{}"/>
    </div>
  `;
  static components = { BottomBar };

  setup() {
    onMounted(() => this.props.model.on("update", this, this.render));
    onWillUnmount(() => this.props.model.off("update", this));
  }
  getSubEnv() {
    return this.__owl__.childEnv;
  }
}

async function mountBottomBar(
  model: Model = new Model(),
  env: Partial<SpreadsheetChildEnv> = {}
): Promise<{ parent: Parent; app: App; model: Model }> {
  const mockEnv = makeTestEnv({ ...env, model });
  const app = new App(Parent, { props: { model }, env: mockEnv });
  app.addTemplates(OWL_TEMPLATES);
  const parent = await app.mount(fixture);
  return { app, parent, model: parent.props.model };
}

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

describe("BottomBar component", () => {
  test("simple rendering", async () => {
    const { app } = await mountBottomBar();

    expect(fixture.querySelector(".o-spreadsheet-bottom-bar")).toMatchSnapshot();
    app.destroy();
  });

  test("Can create a new sheet", async () => {
    const { app, model } = await mountBottomBar();

    const dispatch = jest.spyOn(model, "dispatch");
    mockUuidV4To(model, 42);
    const activeSheetId = model.getters.getActiveSheetId();
    triggerMouseEvent(".o-add-sheet", "click");
    expect(dispatch).toHaveBeenNthCalledWith(1, "CREATE_SHEET", {
      name: "Sheet2",
      sheetId: "42",
      position: 1,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, "ACTIVATE_SHEET", {
      sheetIdTo: "42",
      sheetIdFrom: activeSheetId,
    });
    app.destroy();
  });

  test("create a second sheet while the first one is called Sheet2", async () => {
    const model = new Model({ sheets: [{ name: "Sheet2" }] });
    const { app } = await mountBottomBar(model);
    const dispatch = jest.spyOn(model, "dispatch");
    expect(model.getters.getSheetIds().map(model.getters.getSheetName)).toEqual(["Sheet2"]);
    triggerMouseEvent(".o-add-sheet", "click");
    expect(dispatch).toHaveBeenNthCalledWith(1, "CREATE_SHEET", {
      sheetId: expect.any(String),
      name: "Sheet1",
      position: 1,
    });
    app.destroy();
  });

  test("Can activate a sheet", async () => {
    const { app, parent } = await mountBottomBar();
    const dispatch = jest.spyOn(parent.props.model, "dispatch");
    triggerMouseEvent(".o-sheet", "click");
    const sheetIdFrom = parent.props.model.getters.getActiveSheetId();
    const sheetIdTo = sheetIdFrom;
    expect(dispatch).toHaveBeenCalledWith("ACTIVATE_SHEET", {
      sheetIdFrom,
      sheetIdTo,
    });
    app.destroy();
  });

  test("Can open context menu of a sheet", async () => {
    const { app } = await mountBottomBar();

    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(1);
    app.destroy();
  });

  test("Can open context menu of a sheet with the arrow", async () => {
    const { app } = await mountBottomBar();

    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
    triggerMouseEvent(".o-sheet-icon", "click");
    await nextTick();
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(1);
    app.destroy();
  });

  test("Click on the arrow when the context menu is open should close it", async () => {
    const { app } = await mountBottomBar();

    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
    triggerMouseEvent(".o-sheet-icon", "click");
    await nextTick();
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(1);
    triggerMouseEvent(".o-sheet-icon", "click");
    await nextTick();
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
    app.destroy();
  });

  test("Can move right a sheet", async () => {
    const { app, model } = await mountBottomBar();
    const dispatch = jest.spyOn(model, "dispatch");
    createSheet(model, { sheetId: "42" });
    await nextTick();
    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    const sheetId = model.getters.getActiveSheetId();
    triggerMouseEvent(".o-menu-item[data-name='move_right'", "click");
    expect(dispatch).toHaveBeenCalledWith("MOVE_SHEET", {
      sheetId,
      delta: 1,
    });
    app.destroy();
  });

  test("Can move left a sheet", async () => {
    const { app, model } = await mountBottomBar();
    const dispatch = jest.spyOn(model, "dispatch");
    createSheet(model, { sheetId: "42" });
    activateSheet(model, "42");
    await nextTick();
    triggerMouseEvent(".o-sheet[data-id='42']", "contextmenu");
    await nextTick();
    const sheetId = model.getters.getActiveSheetId();
    triggerMouseEvent(".o-menu-item[data-name='move_left'", "click");
    expect(dispatch).toHaveBeenCalledWith("MOVE_SHEET", {
      sheetId,
      delta: -1,
    });
    app.destroy();
  });

  test("Can hide a sheet", async () => {
    const { app, model } = await mountBottomBar();
    const dispatch = jest.spyOn(model, "dispatch");
    createSheet(model, { sheetId: "42" });
    activateSheet(model, "42");

    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    const sheetId = model.getters.getActiveSheetId();
    triggerMouseEvent(".o-menu-item[data-name='hide_sheet']", "click");
    expect(dispatch).toHaveBeenCalledWith("HIDE_SHEET", {
      sheetId,
    });
    app.destroy();
  });

  test("Hide sheet menu is not visible if there's only one visible sheet", async () => {
    const { app, model } = await mountBottomBar();
    createSheet(model, { sheetId: "42" });
    hideSheet(model, "42");

    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    expect(fixture.querySelector(".o-menu")).not.toBeNull();
    expect(fixture.querySelector(".o-menu-item[data-name='hide_sheet']")).toBeNull();
    app.destroy();
  });

  test("Move right and left are not visible when it's not possible to move", async () => {
    const { app } = await mountBottomBar();

    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    expect(fixture.querySelector(".o-menu-item[data-name='move_left'")).toBeNull();
    expect(fixture.querySelector(".o-menu-item[data-name='move_right'")).toBeNull();
    app.destroy();
  });

  test("Can rename a sheet", async () => {
    const { app, model } = await mountBottomBar(new Model(), {
      editText: jest.fn((title, callback, options) => callback("new_name")),
    });
    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    triggerMouseEvent(".o-menu-item[data-name='rename'", "click");
    expect(model.getters.getActiveSheet().name).toEqual("new_name");
    app.destroy();
  });

  test("Can rename a sheet with dblclick", async () => {
    const { app, model } = await mountBottomBar(new Model(), {
      editText: jest.fn((title, callback, options) => callback("new_name")),
    });
    triggerMouseEvent(".o-sheet-name", "dblclick");
    await nextTick();
    expect(model.getters.getActiveSheet().name).toEqual("new_name");
    app.destroy();
  });

  test("Can duplicate a sheet", async () => {
    const { app, model } = await mountBottomBar();
    const dispatch = jest.spyOn(model, "dispatch");
    mockUuidV4To(model, 123);

    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    const sheet = model.getters.getActiveSheetId();
    triggerMouseEvent(".o-menu-item[data-name='duplicate'", "click");
    expect(dispatch).toHaveBeenCalledWith("DUPLICATE_SHEET", {
      sheetId: sheet,
      sheetIdTo: "123",
    });
    app.destroy();
  });

  test("Can delete a sheet", async () => {
    const { app, model } = await mountBottomBar(new Model(), {
      askConfirmation: jest.fn((title, callback) => callback()),
    });
    const dispatch = jest.spyOn(model, "dispatch");
    createSheet(model, { sheetId: "42" });

    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    const sheetId = model.getters.getActiveSheetId();
    triggerMouseEvent(".o-menu-item[data-name='delete'", "click");
    expect(dispatch).toHaveBeenCalledWith("DELETE_SHEET", { sheetId });
    app.destroy();
  });

  test("Delete sheet is not visible when there is only one sheet", async () => {
    const { app } = await mountBottomBar();

    triggerMouseEvent(".o-sheet", "contextmenu");
    await nextTick();
    expect(fixture.querySelector(".o-menu-item[data-name='delete'")).toBeNull();
    app.destroy();
  });

  test("Can open the list of sheets", async () => {
    const { app } = await mountBottomBar();

    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
    triggerMouseEvent(".o-list-sheets", "click");
    await nextTick();
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(1);
    app.destroy();
  });

  test("Can open the list of sheets", async () => {
    const { app, model } = await mountBottomBar();
    const sheet = model.getters.getActiveSheetId();
    createSheet(model, { sheetId: "42" });
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
    triggerMouseEvent(".o-list-sheets", "click");
    await nextTick();
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(1);
    const sheets = fixture.querySelectorAll(".o-menu-item");
    expect(sheets.length).toBe(2);
    expect((sheets[0] as HTMLElement).dataset.name).toBe(sheet);
    expect((sheets[1] as HTMLElement).dataset.name).toBe("42");
    app.destroy();
  });

  test("Can activate a sheet from the list of sheets", async () => {
    const { app, model } = await mountBottomBar();
    const dispatch = jest.spyOn(model, "dispatch");
    const sheet = model.getters.getActiveSheetId();
    createSheet(model, { sheetId: "42" });

    triggerMouseEvent(".o-list-sheets", "click");
    await nextTick();
    triggerMouseEvent(".o-menu-item[data-name='42'", "click");
    expect(dispatch).toHaveBeenCalledWith("ACTIVATE_SHEET", {
      sheetIdFrom: sheet,
      sheetIdTo: "42",
    });
    app.destroy();
  });

  test("Display the statistic button only if no-empty cells are selected", async () => {
    const { app, model } = await mountBottomBar();
    setCellContent(model, "A2", "24");
    setCellContent(model, "A3", "=A1");

    selectCell(model, "A1");
    await nextTick();
    expect(fixture.querySelector(".o-selection-statistic")).toBeFalsy();

    selectCell(model, "A2");
    await nextTick();
    expect(fixture.querySelector(".o-selection-statistic")?.textContent).toBe("Sum: 24");

    selectCell(model, "A3");
    await nextTick();
    expect(fixture.querySelector(".o-selection-statistic")?.textContent).toBe("Sum: 0");
    app.destroy();
  });

  test("Display empty information if the statistic function doesn't handle the types of the selected cells", async () => {
    const { model } = await mountBottomBar();
    setCellContent(model, "A2", "I am not a number");

    selectCell(model, "A2");
    await nextTick();
    expect(fixture.querySelector(".o-selection-statistic")?.textContent).toBe("Sum: __");
  });

  test("Can open the list of statistics", async () => {
    const { app, model } = await mountBottomBar();
    setCellContent(model, "A2", "24");
    selectCell(model, "A2");
    await nextTick();

    triggerMouseEvent(".o-selection-statistic", "click");
    await nextTick();
    expect(fixture.querySelector(".o-menu")).toMatchSnapshot();
    app.destroy();
  });

  test("Can activate a statistic from the list of statistics", async () => {
    const { app, model } = await mountBottomBar();
    setCellContent(model, "A2", "24");
    selectCell(model, "A2");
    await nextTick();

    expect(fixture.querySelector(".o-selection-statistic")?.textContent).toBe("Sum: 24");

    triggerMouseEvent(".o-selection-statistic", "click");
    await nextTick();
    triggerMouseEvent(".o-menu-item[data-name='Count Numbers'", "click");
    await nextTick();
    expect(fixture.querySelector(".o-selection-statistic")?.textContent).toBe("Count Numbers: 1");
    app.destroy();
  });

  describe("drag & drop sheet", () => {
    const sheetIds: UID[] = ["Sheet1", "Sheet2", "Sheet3", "Sheet4"];
    let model: Model;
    let app: App;

    beforeEach(async () => {
      mockGetBoundingClientRect({
        "o-sheet": (el: HTMLElement) => ({
          x: model.getters.getSheetIds().indexOf(el.dataset.id!) * 100,
          width: 100,
        }),
        "o-all-sheets": () => ({ x: 0, width: 500 }),
      });

      jest.useFakeTimers();
      model = new Model({ sheets: sheetIds.map((sheetId) => ({ id: sheetId })) });
      ({ app } = await mountBottomBar(model));
    });

    afterEach(async () => {
      app.destroy();
    });

    async function dragSheet(
      sheetId: UID,
      args: {
        mouseMoveX: number;
        mouseUp?: boolean;
        mouseInitialX?: number;
      }
    ) {
      const mouseUp = args.mouseUp !== undefined ? args.mouseUp : true;
      const sheetEl = fixture.querySelector(`.o-sheet[data-id="${sheetId}"]`)!;
      const startingX =
        args.mouseInitialX !== undefined ? args.mouseInitialX : sheetEl.getBoundingClientRect().x;
      // const startingX = 0;
      await dragElement(
        `.o-sheet[data-id="${sheetId}"]`,
        { x: args.mouseMoveX, y: 0 },
        { x: startingX, y: 0 },
        mouseUp
      );
    }

    test("Can drag & drop a sheet forward", async () => {
      await dragSheet("Sheet1", { mouseMoveX: 200 });
      expect(model.getters.getVisibleSheetIds()).toEqual(["Sheet2", "Sheet3", "Sheet1", "Sheet4"]);
    });

    test("Can drag & drop a sheet backward", async () => {
      await dragSheet("Sheet4", { mouseMoveX: -200 });
      expect(model.getters.getVisibleSheetIds()).toEqual(["Sheet1", "Sheet4", "Sheet2", "Sheet3"]);
    });

    test("Can drag & drop a sheet on itself", async () => {
      await dragSheet("Sheet1", { mouseMoveX: 10 });
      expect(model.getters.getVisibleSheetIds()).toEqual(["Sheet1", "Sheet2", "Sheet3", "Sheet4"]);
    });

    test("Drag & dropped sheet is activated", async () => {
      expect(model.getters.getActiveSheetId()).toBe("Sheet1");
      await dragSheet("Sheet3", { mouseMoveX: 10, mouseUp: false });
      expect(model.getters.getActiveSheetId()).toBe("Sheet3");
    });

    test("undo/redo drag & drop of a sheet", async () => {
      await dragSheet("Sheet4", { mouseMoveX: -200 });
      expect(model.getters.getVisibleSheetIds()).toEqual(["Sheet1", "Sheet4", "Sheet2", "Sheet3"]);
      undo(model);
      expect(model.getters.getVisibleSheetIds()).toEqual(["Sheet1", "Sheet2", "Sheet3", "Sheet4"]);
      redo(model);
      expect(model.getters.getVisibleSheetIds()).toEqual(["Sheet1", "Sheet4", "Sheet2", "Sheet3"]);
    });

    test("Can edge scroll to the right", async () => {
      createSheet(model, { sheetId: "Sheet5", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet6", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet7", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet8", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet9", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet10", position: model.getters.getSheetIds().length });
      activateSheet(model, "Sheet0");
      await nextTick();

      await dragSheet("Sheet1", { mouseMoveX: 600, mouseUp: false, mouseInitialX: 0 });
      jest.advanceTimersByTime(5000);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      const sheetIds = model.getters.getVisibleSheetIds();
      expect(sheetIds[sheetIds.length - 1]).toEqual("Sheet1");
    });

    test("Can edge scroll to the left", async () => {
      createSheet(model, { sheetId: "Sheet5", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet6", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet7", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet8", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet9", position: model.getters.getSheetIds().length });
      createSheet(model, { sheetId: "Sheet10", position: model.getters.getSheetIds().length });
      activateSheet(model, "Sheet10");
      await nextTick();

      await dragSheet("Sheet10", { mouseMoveX: -500, mouseUp: false, mouseInitialX: 400 });
      jest.advanceTimersByTime(5000);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      expect(model.getters.getVisibleSheetIds()[0]).toEqual("Sheet10");
    });

    test("Swap a sheet with a sheet with a longer name : no back & forth when moving mouse", async () => {
      mockGetBoundingClientRect({
        "o-all-sheets": () => ({ x: 0, width: 500 }),
        "o-sheet": (el: HTMLElement) => {
          if (el.dataset.id === "Sheet1") return { x: 0, width: 100 };
          else if (el.dataset.id === "Sheet2") return { x: 100, width: 300 };
          return { x: model.getters.getSheetIds().indexOf(el.dataset.id!) * 100 + 200, width: 100 };
        },
      });

      triggerMouseEvent('.o-sheet[data-id="Sheet1"]', "mousedown");
      triggerMouseEvent('.o-sheet[data-id="Sheet1"]', "mousemove", 0, 0);
      await nextTick();
      expect(getElComputedStyle('.o-sheet[data-id="Sheet1"]', "left")).toBe("0px");
      expect(getElComputedStyle('.o-sheet[data-id="Sheet2"]', "left")).toBe("0px");

      triggerMouseEvent('.o-sheet[data-id="Sheet1"]', "mousemove", 100, 0);
      await nextTick();
      expect(getElComputedStyle(".o-sheet[data-id=Sheet1]", "left")).toBe("100px");
      expect(getElComputedStyle(".o-sheet[data-id=Sheet2]", "left")).toBe("-100px");

      triggerMouseEvent('.o-sheet[data-id="Sheet1"]', "mousemove", 150, 0); // 150 is the position of the mouse not the move offset
      await nextTick();
      expect(getElComputedStyle(".o-sheet[data-id=Sheet1]", "left")).toBe("150px");
      expect(getElComputedStyle(".o-sheet[data-id=Sheet2]", "left")).toBe("-100px");
    });

    test.each([
      () => createSheet(model, { sheetId: "newSheet" }),
      () => deleteSheet(model, "Sheet2"),
      () => renameSheet(model, "Sheet2", "New name"),
      () => hideSheet(model, "Sheet2"),
    ])(
      "Modifying the sheet list during the drag & drop cancels it",
      async (modifySheetList: () => void) => {
        await dragSheet("Sheet3", { mouseMoveX: 10, mouseUp: false });
        await nextTick();
        expect(fixture.querySelector(".o-sheet.dragging")).toBeTruthy();
        modifySheetList();
        await nextTick();
        expect(fixture.querySelector(".o-sheet.dragging")).toBeFalsy();
      }
    );

    test.each([
      () => resizeColumns(model, ["A"], 10),
      () => resizeRows(model, [1], 10),
      () => setCellContent(model, "A1", "Content"),
    ])("Random actions on sheets does not cancel the drag & drop", async (action: () => void) => {
      await dragSheet("Sheet3", { mouseMoveX: 10, mouseUp: false });
      await nextTick();
      expect(fixture.querySelector(".o-sheet.dragging")).toBeTruthy();
      action();
      await nextTick();
      expect(fixture.querySelector(".o-sheet.dragging")).toBeTruthy();
    });

    test("Bottom bar context menu is closed when starting to drag a sheet", async () => {
      triggerMouseEvent(".o-sheet", "contextmenu");
      await nextTick();
      expect(fixture.querySelector(".o-menu")).toBeTruthy();
      await dragSheet("Sheet1", { mouseMoveX: 10, mouseUp: false });
      expect(fixture.querySelector(".o-menu")).toBeFalsy();
    });
  });
});
