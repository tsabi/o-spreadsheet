import { App, Component, xml } from "@odoo/owl";
import { Model, Spreadsheet } from "../../src";
import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH, FIGURE_BORDER_WIDTH } from "../../src/constants";
import { figureRegistry } from "../../src/registries";
import { CreateFigureCommand, Figure, Pixel, SpreadsheetChildEnv, UID } from "../../src/types";
import {
  activateSheet,
  createSheet,
  freezeColumns,
  freezeRows,
  selectCell,
  setCellContent,
  setViewportOffset,
} from "../test_helpers/commands_helpers";
import {
  dragElement,
  getElComputedStyle,
  pixelsToNumber,
  simulateClick,
  triggerMouseEvent,
} from "../test_helpers/dom_helper";
import { getCellContent, getCellText } from "../test_helpers/getters_helpers";
import { makeTestFixture, mountSpreadsheet, nextTick } from "../test_helpers/helpers";

let fixture: HTMLElement;
let model: Model;
let sheetId: UID;
let parent: Spreadsheet;
let app: App;

function createFigure(
  model: Model,
  figureParameters: Partial<CreateFigureCommand["figure"]> = {},
  sheetId: UID = model.getters.getActiveSheetId()
) {
  const defaultParameters: CreateFigureCommand["figure"] = {
    id: "someuuid",
    x: 1,
    y: 1,
    height: 100,
    width: 100,
    tag: "text",
  };

  model.dispatch("CREATE_FIGURE", {
    sheetId,
    figure: { ...defaultParameters, ...figureParameters },
  });
}

const anchorSelectors = {
  top: ".o-anchor.o-top",
  topRight: ".o-anchor.o-topRight",
  right: ".o-anchor.o-right",
  bottomRight: ".o-anchor.o-bottomRight",
  bottom: ".o-anchor.o-bottom",
  bottomLeft: ".o-anchor.o-bottomLeft",
  left: ".o-anchor.o-left",
  topLeft: ".o-anchor.o-topLeft",
};
async function dragAnchor(anchor: string, dragX: number, dragY: number, mouseUp = false) {
  const anchorElement = fixture.querySelector(anchorSelectors[anchor])!;
  await dragElement(anchorElement, dragX, dragY, mouseUp);
}

//Test Component required as we don't especially want/need to load an entire chart
const TEMPLATE = xml/* xml */ `
  <div class="o-fig-text">
    <t t-esc='"coucou"'/>
  </div>
`;

interface Props {
  figure: Figure;
}
class TextFigure extends Component<Props, SpreadsheetChildEnv> {
  static template = TEMPLATE;
}

beforeAll(() => {
  figureRegistry.add("text", { Component: TextFigure });
});
afterAll(() => {
  figureRegistry.remove("text");
});

describe("figures", () => {
  beforeEach(async () => {
    fixture = makeTestFixture();
    ({ app, parent } = await mountSpreadsheet(fixture));
    model = parent.model;
    sheetId = model.getters.getActiveSheetId();
  });

  afterEach(() => {
    app.destroy();
  });

  test("can create a figure with some data", () => {
    createFigure(model);
    expect(model.getters.getFigures(sheetId)).toEqual([
      { id: "someuuid", height: 100, tag: "text", width: 100, x: 1, y: 1 },
    ]);
  });
  test("focus a figure", async () => {
    createFigure(model);
    await nextTick();
    expect(fixture.querySelector(".o-figure")).not.toBeNull();
    await simulateClick(".o-figure");
    expect(document.activeElement).toBe(fixture.querySelector(".o-figure"));
  });

  test("deleting a figure focuses the grid hidden input", async () => {
    createFigure(model);
    await nextTick();
    const figure = fixture.querySelector(".o-figure")!;
    await simulateClick(".o-figure");
    expect(document.activeElement).toBe(figure);
    figure.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    await nextTick();
    expect(fixture.querySelector(".o-figure")).toBeNull();
    expect(document.activeElement).toBe(fixture.querySelector(".o-grid>input"));
  });

  test("deleting a figure doesn't delete selection", async () => {
    createFigure(model);
    setCellContent(model, "A1", "content");
    selectCell(model, "A1");
    await nextTick();
    const figure = fixture.querySelector(".o-figure")!;
    await simulateClick(".o-figure");
    figure.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    await nextTick();
    expect(fixture.querySelector(".o-figure")).toBeNull();
    expect(getCellContent(model, "A1")).toBe("content");
  });

  test("Add a figure on sheet2, scroll down on sheet 1, switch to sheet 2, the figure should be displayed", async () => {
    createSheet(model, { sheetId: "42", position: 1 });
    createFigure(model, {}, "42");
    fixture.querySelector(".o-grid")!.dispatchEvent(new WheelEvent("wheel", { deltaX: 1500 }));
    fixture.querySelector(".o-scrollbar.vertical")!.dispatchEvent(new Event("scroll"));
    await nextTick();
    activateSheet(model, "42");
    await nextTick();
    expect(fixture.querySelectorAll(".o-figure")).toHaveLength(1);
  });

  test("Can move a figure with keyboard", async () => {
    createFigure(model);
    let figure = model.getters.getFigure(sheetId, "someuuid");
    expect(figure).toMatchObject({ id: "someuuid", x: 1, y: 1 });
    await nextTick();
    const figureContainer = fixture.querySelector(".o-figure")!;
    await simulateClick(".o-figure");
    await nextTick();
    const selectedFigure = model.getters.getSelectedFigureId();
    expect(selectedFigure).toBe("someuuid");
    //down
    figureContainer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    figureContainer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    await nextTick();
    figure = model.getters.getFigure(sheetId, "someuuid");
    expect(figure).toMatchObject({ id: "someuuid", x: 1, y: 3 });
    //right
    figureContainer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    figureContainer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    await nextTick();
    figure = model.getters.getFigure(sheetId, "someuuid");
    expect(figure).toMatchObject({ id: "someuuid", x: 3, y: 3 });
    //left
    figureContainer.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
    );
    await nextTick();
    figure = model.getters.getFigure(sheetId, "someuuid");
    expect(figure).toMatchObject({ id: "someuuid", x: 2, y: 3 });
    //up
    figureContainer.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await nextTick();
    figure = model.getters.getFigure(sheetId, "someuuid");
    expect(figure).toMatchObject({ id: "someuuid", x: 2, y: 2 });
  });

  test("figure is focused after a SELECT_FIGURE", async () => {
    createFigure(model);
    await nextTick();
    model.dispatch("SELECT_FIGURE", { id: "someuuid" });
    await nextTick();
    expect(document.activeElement?.classList).toContain("o-figure");
  });

  test("select a figure, it should have the  resize handles", async () => {
    createFigure(model);
    model.dispatch("SELECT_FIGURE", { id: "someuuid" });
    await nextTick();
    const anchors = fixture.querySelectorAll(".o-anchor");
    expect(anchors).toHaveLength(8);
  });

  test("Can undo/redo with a figure focused", async () => {
    createFigure(model);
    await nextTick();
    setCellContent(model, "A1", "hello");
    await simulateClick(".o-figure");
    fixture
      .querySelector(".o-figure")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    expect(getCellText(model, "A1")).toBe("");
  });

  test.each([
    ["top", { mouseOffsetX: 0, mouseOffsetY: -50 }, { width: 100, height: 150 }],
    ["topRight", { mouseOffsetX: 50, mouseOffsetY: -50 }, { width: 150, height: 150 }],
    ["right", { mouseOffsetX: 50, mouseOffsetY: 0 }, { width: 150, height: 100 }],
    ["bottomRight", { mouseOffsetX: 50, mouseOffsetY: 50 }, { width: 150, height: 150 }],
    ["bottom", { mouseOffsetX: 0, mouseOffsetY: 50 }, { width: 100, height: 150 }],
    ["bottomLeft", { mouseOffsetX: -50, mouseOffsetY: 50 }, { width: 150, height: 150 }],
    ["left", { mouseOffsetX: -50, mouseOffsetY: 0 }, { width: 150, height: 100 }],
    ["topLeft", { mouseOffsetX: -50, mouseOffsetY: -50 }, { width: 150, height: 150 }],
  ])("Can resize a figure through its anchors", async (anchor: string, mouseMove, expectedSize) => {
    const figureId = "someuuid";
    createFigure(model, { id: figureId, y: 200, x: 200, width: 100, height: 100 });
    await nextTick();
    await simulateClick(".o-figure");
    await dragAnchor(anchor, mouseMove.mouseOffsetX, mouseMove.mouseOffsetY, true);
    expect(model.getters.getFigure(sheetId, figureId)).toMatchObject(expectedSize);
  });

  describe("Move a figure with drag & drop ", () => {
    test("Can move a figure with drag & drop", async () => {
      createFigure(model, { id: "someuuid", x: 200, y: 100 });
      await nextTick();
      const figureEl = fixture.querySelector(".o-figure")!;
      await dragElement(figureEl, 150, 100, true);
      await nextTick();
      expect(model.getters.getFigure(sheetId, "someuuid")).toMatchObject({
        x: 350,
        y: 200,
      });
    });

    describe("Figure drag & drop with frozen pane", () => {
      const cellWidth = DEFAULT_CELL_WIDTH;
      const cellHeight = DEFAULT_CELL_HEIGHT;
      const id = "someId";
      const figureSelector = ".o-figure";
      beforeEach(async () => {
        freezeRows(model, 5);
        freezeColumns(model, 5);
        model.dispatch("SET_VIEWPORT_OFFSET", {
          offsetX: 10 * cellWidth,
          offsetY: 10 * cellHeight,
        });
      });

      test("Figure in frozen rows can be dragged to main viewport", async () => {
        createFigure(model, { id, x: 16 * cellWidth, y: 4 * cellHeight });
        await nextTick();
        await dragElement(figureSelector, 0, 3 * cellHeight, true);
        expect(model.getters.getFigure(sheetId, id)).toMatchObject({
          x: 16 * cellWidth,
          y: 17 * cellHeight, // initial position + drag offset + scroll offset
        });
      });

      test("Figure in main viewport can be dragged to frozen rows", async () => {
        createFigure(model, { id, x: 16 * cellWidth, y: 16 * cellHeight });
        await nextTick();
        await dragElement(figureSelector, 0, -3 * cellHeight, true);
        expect(model.getters.getFigure(sheetId, id)).toMatchObject({
          x: 16 * cellWidth,
          y: 3 * cellHeight, // initial position + drag offset - scroll offset
        });
      });

      test("Dragging figure that is half hidden by frozen rows will put in on top of the freeze pane", async () => {
        createFigure(model, { id, x: 16 * cellWidth, y: 14 * cellHeight, height: 5 * cellHeight });
        await nextTick();
        await dragElement(figureSelector, 1, 0, true);
        expect(model.getters.getFigure(sheetId, id)).toMatchObject({
          x: 16 * cellWidth + 1,
          y: 4 * cellHeight, // initial position - scroll offset
        });
      });

      test("Figure in frozen cols can be dragged to main viewport", async () => {
        createFigure(model, { id, x: 4 * cellWidth, y: 16 * cellHeight });
        await nextTick();
        await dragElement(figureSelector, 3 * cellWidth, 0, true);
        expect(model.getters.getFigure(sheetId, id)).toMatchObject({
          x: 17 * cellWidth, // initial position + drag offset + scroll offset
          y: 16 * cellHeight,
        });
      });

      test("Figure in main viewport can be dragged to frozen cols", async () => {
        createFigure(model, { id, x: 16 * cellWidth, y: 16 * cellHeight });
        await nextTick();
        await dragElement(figureSelector, -3 * cellWidth, 0, true);
        expect(model.getters.getFigure(sheetId, id)).toMatchObject({
          x: 3 * cellWidth, // initial position + drag offset - scroll offset
          y: 16 * cellHeight,
        });
      });

      test("Dragging figure that is half hidden by frozen cols will put in on top of the freeze pane", async () => {
        createFigure(model, { id, x: 14 * cellWidth, y: 16 * cellHeight, width: 5 * cellWidth });
        await nextTick();
        await dragElement(figureSelector, 0, 1, true);
        expect(model.getters.getFigure(sheetId, id)).toMatchObject({
          x: 4 * cellWidth, // initial position - scroll offset
          y: 16 * cellHeight + 1,
        });
      });
    });
  });

  test("Cannot select/move figure in readonly mode", async () => {
    const figureId = "someuuid";
    createFigure(model, { id: figureId, y: 200 });
    model.updateMode("readonly");
    await nextTick();
    const figure = fixture.querySelector(".o-figure")!;
    await simulateClick(".o-figure");
    expect(document.activeElement).not.toBe(figure);
    expect(fixture.querySelector(".o-anchor")).toBeNull();

    triggerMouseEvent(figure, "mousedown", 300, 200);
    await nextTick();
    expect(figure.classList).not.toContain("o-dragging");
  });

  test("Figure border disabled on dashboard mode", async () => {
    const figureId = "someuuid";
    createFigure(model, { id: figureId, y: 200 });
    await nextTick();
    let figure = fixture.querySelector(".o-figure")! as HTMLElement;
    expect(window.getComputedStyle(figure)["border-width"]).toEqual("1px");

    model.updateMode("dashboard");
    await nextTick();
    figure = fixture.querySelector(".o-figure")! as HTMLElement;
    expect(window.getComputedStyle(figure)["border-width"]).toEqual("0px");
  });

  test("Figures are cropped to avoid overlap with headers", async () => {
    const figureId = "someuuid";
    createFigure(model, { id: figureId, x: 100, y: 20, height: 200, width: 100 });
    await nextTick();
    const figure = fixture.querySelector(".o-figure-wrapper")!;
    expect(window.getComputedStyle(figure).width).toBe("102px"); // width + borders
    expect(window.getComputedStyle(figure).height).toBe("202px"); // height + borders
    model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: 2 * DEFAULT_CELL_WIDTH,
      offsetY: 3 * DEFAULT_CELL_HEIGHT,
    });
    await nextTick();

    const expectedWidth = 102 - (2 * DEFAULT_CELL_WIDTH - 100); // = width + borders - (overflow = viewport offset X - x)
    const expectedHeight = 202 - (3 * DEFAULT_CELL_HEIGHT - 20); // = height + borders - (overflow = viewport offset Y - y)

    expect(window.getComputedStyle(figure).width).toBe(`${expectedWidth}px`);
    expect(window.getComputedStyle(figure).height).toBe(`${expectedHeight}px`);
  });

  test("Selected figure isn't removed by scroll", async () => {
    createFigure(model);
    model.dispatch("SELECT_FIGURE", { id: "someuuid" });
    fixture.querySelector(".o-grid")!.dispatchEvent(new WheelEvent("wheel", { deltaX: 1500 }));
    fixture.querySelector(".o-scrollbar.vertical")!.dispatchEvent(new Event("scroll"));
    expect(model.getters.getSelectedFigureId()).toEqual("someuuid");
  });

  describe("Figure drag & drop snap", () => {
    describe("Move figure", () => {
      test.each([
        [48, 50], // left border snaps with left border of other figure
        [77, 75 + FIGURE_BORDER_WIDTH], // left border snaps with center of other figure
        [102, 100 + FIGURE_BORDER_WIDTH], // left border snaps with right border of other figure
        [38, 40 - FIGURE_BORDER_WIDTH], // center snaps with left border of other figure
        [67, 65], // center snaps with center of other figure
        [92, 90], // center snaps with right border of other figure
        [31, 30 - FIGURE_BORDER_WIDTH], // right border snaps with left border of other figure
        [57, 55], // right border snaps with center of other figure
        [79, 80], // right border snaps with right border of other figure
      ])("Snap x with x mouseMove %s", async (mouseMove: Pixel, expectedResult: Pixel) => {
        createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
        createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
        await nextTick();
        const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
        await dragElement(figureEl, mouseMove, 0, true);
        expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ x: expectedResult, y: 0 });
      });

      test.each([
        [48, 50], // top border snaps with top border of other figure
        [77, 75 + FIGURE_BORDER_WIDTH], // top border snaps with center of other figure
        [102, 100 + FIGURE_BORDER_WIDTH], // top border snaps with bottom border of other figure
        [38, 40 - FIGURE_BORDER_WIDTH], // center snaps with top border of other figure
        [67, 65], // center snaps with center of other figure
        [92, 90], // center snaps with bottom border of other figure
        [31, 30 - FIGURE_BORDER_WIDTH], // bottom border snaps with top border of other figure
        [57, 55], // bottom border snaps with center of other figure
        [79, 80], // bottom border snaps with bottom border of other figure
      ])("Snap y with y mouseMove %s", async (mouseMove: Pixel, expectedResult: Pixel) => {
        createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
        createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
        await nextTick();
        const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
        await dragElement(figureEl, 0, mouseMove, true);
        expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ x: 0, y: expectedResult });
      });
    });

    describe("Resize figure", () => {
      describe.each(["left", "topLeft", "bottomLeft"])(
        "Snap when resizing to the left with the %s anchor",
        (anchor: string) => {
          test.each([
            [-48, { x: 150 + FIGURE_BORDER_WIDTH, width: 150 - FIGURE_BORDER_WIDTH }], // left border snaps with right border of other figure
            [-151, { x: 50, width: 250 }], // left border snaps with left border of other figure
          ])("snap with mouseMove %s", async (mouseMove: Pixel, expectedResult) => {
            createFigure(model, { id: "f1", x: 200, y: 200, width: 100, height: 100 });
            createFigure(model, { id: "f2", x: 50, y: 50, width: 100, height: 100 });
            await nextTick();
            await simulateClick(".o-figure");
            await dragAnchor(anchor, mouseMove, 0, true);
            expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ ...expectedResult });
          });
        }
      );

      describe.each(["right", "topRight", "bottomRight"])(
        "Snap when resizing to the right with the %s anchor",
        (anchor: string) => {
          test.each([
            [47, { x: 50, width: 150 - FIGURE_BORDER_WIDTH }], // right border snaps with left border of other figure
            [152, { x: 50, width: 250 }], // right border snaps with right border of other figure
          ])("snap with mouseMove %s", async (mouseMove: Pixel, expectedResult) => {
            createFigure(model, { id: "f1", x: 50, y: 50, width: 100, height: 100 });
            createFigure(model, { id: "f2", x: 200, y: 200, width: 100, height: 100 });
            await nextTick();
            await simulateClick(".o-figure");
            await dragAnchor(anchor, mouseMove, 0, true);
            expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ ...expectedResult });
          });
        }
      );

      describe.each(["bottom", "bottomRight", "bottomLeft"])(
        "Snap when resizing down with the %s anchor",
        (anchor: string) => {
          test.each([
            [46, { y: 50, height: 150 - FIGURE_BORDER_WIDTH }], // bottom border snaps with top border of other figure
            [154, { y: 50, height: 250 }], // bottom border snaps with bottom border of other figure
          ])("snap with mouseMove %s", async (mouseMove: Pixel, expectedResult) => {
            createFigure(model, { id: "f1", x: 50, y: 50, width: 100, height: 100 });
            createFigure(model, { id: "f2", x: 200, y: 200, width: 100, height: 100 });
            await nextTick();
            await simulateClick(".o-figure");
            await dragAnchor(anchor, 0, mouseMove, true);
            expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ ...expectedResult });
          });
        }
      );

      describe.each(["top", "topRight", "topLeft"])(
        "Snap when resizing up with the %s anchor",
        (anchor: string) => {
          test.each([
            [-54, { y: 150 + FIGURE_BORDER_WIDTH, height: 150 - FIGURE_BORDER_WIDTH }], // top border snaps with bottom border of other figure
            [-153, { y: 50, height: 250 }], // top border snaps with top border of other figure
          ])("snap with mouseMove %s", async (mouseMove: Pixel, expectedResult) => {
            createFigure(model, { id: "f1", x: 200, y: 200, width: 100, height: 100 });
            createFigure(model, { id: "f2", x: 50, y: 50, width: 100, height: 100 });
            await nextTick();
            await simulateClick(".o-figure");
            await dragAnchor(anchor, 0, mouseMove, true);
            expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ ...expectedResult });
          });
        }
      );

      test.each([
        ["left", 48, 50], // left border snaps with left border of other figure
        ["left", 77, 75 + FIGURE_BORDER_WIDTH], // left border snaps with center of other figure
        ["topLeft", 48, 50], // left border snaps with left border of other figure
        ["topLeft", 77, 75 + FIGURE_BORDER_WIDTH], // left border snaps with center of other figure
        ["bottomLeft", 48, 50], // left border snaps with left border of other figure
        ["bottomLeft", 77, 75 + FIGURE_BORDER_WIDTH], // left border snaps with center of other figure
      ])(
        "Snap when resizing to the left",
        async (anchor: string, mouseMove: Pixel, expectedResult: Pixel) => {
          createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
          createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
          await nextTick();
          const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
          await dragElement(figureEl, mouseMove, 0, true);
          expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ x: expectedResult, y: 0 });
        }
      );

      test.each([
        [48, 50], // top border snaps with top border of other figure
        [77, 75 + FIGURE_BORDER_WIDTH], // top border snaps with center of other figure
        [102, 100 + FIGURE_BORDER_WIDTH], // top border snaps with bottom border of other figure
        [38, 40 - FIGURE_BORDER_WIDTH], // center snaps with top border of other figure
        [67, 65], // center snaps with center of other figure
        [92, 90], // center snaps with bottom border of other figure
        [31, 30 - FIGURE_BORDER_WIDTH], // bottom border snaps with top border of other figure
        [57, 55], // bottom border snaps with center of other figure
        [79, 80], // bottom border snaps with bottom border of other figure
      ])("Snap y with y mouseMove %s", async (mouseMove: Pixel, expectedResult: Pixel) => {
        createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
        createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
        await nextTick();
        const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
        await dragElement(figureEl, 0, mouseMove, true);
        expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ x: 0, y: expectedResult });
      });
    });

    describe("Snap lines display", () => {
      describe("Snap lines are displayed during the drag & drop", () => {
        test("If the figure is snapping horizontally left of the other figure", async () => {
          createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
          createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
          await nextTick();
          const selector = ".o-figure-snap-border.horizontal";
          expect(fixture.querySelectorAll(selector)).toHaveLength(0);
          const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
          await dragElement(figureEl, 0, 50, false);
          expect(fixture.querySelectorAll(selector)).toHaveLength(1);

          expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(FIGURE_BORDER_WIDTH);
          expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(0);
          expect(pixelsToNumber(getElComputedStyle(selector, "width"))).toBe(100);
        });

        test("If the figure is snapping horizontally right of the other figure", async () => {
          createFigure(model, { id: "f1", x: 120, y: 0, width: 20, height: 20 });
          createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
          await nextTick();
          const selector = ".o-figure-snap-border.horizontal";
          expect(fixture.querySelectorAll(selector)).toHaveLength(0);
          const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
          await dragElement(figureEl, 0, 50, false);
          expect(fixture.querySelectorAll(selector)).toHaveLength(1);

          expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(FIGURE_BORDER_WIDTH);
          expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(-(120 - 50));
          expect(pixelsToNumber(getElComputedStyle(selector, "width"))).toBe(120 + 20 - 50);
        });

        test("If the figure is snapping vertically above the other figure", async () => {
          createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
          createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
          await nextTick();
          const selector = ".o-figure-snap-border.vertical";
          expect(fixture.querySelectorAll(selector)).toHaveLength(0);
          const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
          await dragElement(figureEl, 50, 0, false);
          expect(fixture.querySelectorAll(selector)).toHaveLength(1);

          expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(FIGURE_BORDER_WIDTH);
          expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(0);
          expect(pixelsToNumber(getElComputedStyle(selector, "height"))).toBe(100);
        });

        test("If the figure is snapping vertically below the other figure", async () => {
          createFigure(model, { id: "f1", x: 0, y: 120, width: 20, height: 20 });
          createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
          await nextTick();
          const selector = ".o-figure-snap-border.vertical";
          expect(fixture.querySelectorAll(selector)).toHaveLength(0);
          const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
          await dragElement(figureEl, 50, 0, false);
          expect(fixture.querySelectorAll(selector)).toHaveLength(1);

          expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(FIGURE_BORDER_WIDTH);
          expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(-(120 - 50));
          expect(pixelsToNumber(getElComputedStyle(selector, "height"))).toBe(120 + 20 - 50);
        });

        test("If there are multiple horizontal matches, the snap line include all of them", async () => {
          createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
          createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
          createFigure(model, { id: "f3", x: 200, y: 50, width: 50, height: 50 });
          await nextTick();

          const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
          await dragElement(figureEl, 0, 50, false);

          const selector = ".o-figure-snap-border.horizontal";
          expect(fixture.querySelectorAll(selector)).toHaveLength(1);
          expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(FIGURE_BORDER_WIDTH);
          expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(0);
          expect(pixelsToNumber(getElComputedStyle(selector, "width"))).toBe(250);
        });

        test("If there are multiple vertical matches, the snap line include all of them", async () => {
          createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
          createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
          createFigure(model, { id: "f3", x: 50, y: 200, width: 50, height: 50 });
          await nextTick();

          const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
          await dragElement(figureEl, 50, 0, false);

          const selector = ".o-figure-snap-border.vertical";
          expect(fixture.querySelectorAll(selector)).toHaveLength(1);
          expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(FIGURE_BORDER_WIDTH);
          expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(0);
          expect(pixelsToNumber(getElComputedStyle(selector, "height"))).toBe(250);
        });
      });

      test("Snap lines disappear after the drag & drop ends", async () => {
        createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
        createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
        await nextTick();
        expect(fixture.querySelectorAll(".o-figure-snap-border")).toHaveLength(0);
        const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
        await dragElement(figureEl, 50, 50, false);
        expect(fixture.querySelectorAll(".o-figure-snap-border")).toHaveLength(2);
        triggerMouseEvent(figureEl, "mouseup");
        await nextTick();
        expect(fixture.querySelectorAll(".o-figure-snap-border")).toHaveLength(0);
      });

      describe("Snap lines are cut to not overflow over the headers", () => {
        describe("If the dragged figure is overflowing left", () => {
          beforeEach(async () => {
            setViewportOffset(model, DEFAULT_CELL_WIDTH, 0);
            createFigure(model, {
              id: "f1",
              x: DEFAULT_CELL_WIDTH - 10,
              y: 0,
              width: 20,
              height: 20,
            });
            createFigure(model, {
              id: "f2",
              x: DEFAULT_CELL_WIDTH + 5,
              y: 50,
              width: 50,
              height: 50,
            });
            await nextTick();
          });

          test("If the dragged figure have an horizontal snap line", async () => {
            const selector = ".o-figure-snap-border.horizontal";
            expect(fixture.querySelectorAll(selector)).toHaveLength(0);
            const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
            await dragElement(figureEl, 0, 50, false);
            expect(fixture.querySelectorAll(selector)).toHaveLength(1);

            expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(FIGURE_BORDER_WIDTH);
            expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(0);
            expect(pixelsToNumber(getElComputedStyle(selector, "width"))).toBe(55);
          });

          test("If the dragged figure have an vertical snap line", async () => {
            const selector = ".o-figure-snap-border.vertical";
            expect(fixture.querySelectorAll(selector)).toHaveLength(0);
            const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
            await dragElement(figureEl, -5, 0, false);
            expect(fixture.querySelectorAll(selector)).toHaveLength(1);
            expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(
              5 + FIGURE_BORDER_WIDTH
            );
            expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(0);
            expect(pixelsToNumber(getElComputedStyle(selector, "height"))).toBe(100);
          });
        });

        describe("If the dragged figure is overflowing top", () => {
          beforeEach(async () => {
            setViewportOffset(model, 0, DEFAULT_CELL_HEIGHT);
            createFigure(model, {
              id: "f1",
              x: 0,
              y: DEFAULT_CELL_HEIGHT - 10,
              width: 20,
              height: 20,
            });
            createFigure(model, {
              id: "f2",
              x: 50,
              y: DEFAULT_CELL_HEIGHT + 5,
              width: 50,
              height: 50,
            });
            await nextTick();
          });

          test("If the dragged figure have an horizontal snap line", async () => {
            const selector = ".o-figure-snap-border.horizontal";
            expect(fixture.querySelectorAll(selector)).toHaveLength(0);
            const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
            await dragElement(figureEl, 0, -5, false);
            expect(fixture.querySelectorAll(selector)).toHaveLength(1);
            expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(
              5 + FIGURE_BORDER_WIDTH
            );
            expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(0);
            expect(pixelsToNumber(getElComputedStyle(selector, "width"))).toBe(100);
          });

          test("If the dragged figure have an vertical snap line", async () => {
            const selector = ".o-figure-snap-border.vertical";
            expect(fixture.querySelectorAll(selector)).toHaveLength(0);
            const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
            await dragElement(figureEl, 50, 0, false);
            expect(fixture.querySelectorAll(selector)).toHaveLength(1);
            expect(pixelsToNumber(getElComputedStyle(selector, "left"))).toBe(FIGURE_BORDER_WIDTH);
            expect(pixelsToNumber(getElComputedStyle(selector, "top"))).toBe(0);
            expect(pixelsToNumber(getElComputedStyle(selector, "height"))).toBe(55);
          });
        });
      });
    });

    jest.setTimeout(100000);
    describe("Snap with freeze pane", () => {
      const cellHeight = DEFAULT_CELL_HEIGHT;
      const cellWidth = DEFAULT_CELL_WIDTH;

      test.each([
        { figHeight: 50, scrollY: 0 }, // Figure totally in frozen pane
        { figHeight: 6 * cellHeight, scrollY: 0 }, // Figure half in frozen pane, no scroll
        { figHeight: 6 * cellHeight, scrollY: 2 * cellHeight }, // Figure half in frozen pane, with scroll
      ])("Frozen rows and snap, %s ", async (params) => {
        freezeRows(model, 5);
        createFigure(model, { id: "f1", x: 0, y: 0, width: 50, height: params.figHeight });
        createFigure(model, { id: "f2", x: 0, y: 0, width: 50, height: params.figHeight });
        setViewportOffset(model, 0, params.scrollY);
        await nextTick();
        const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;

        await dragElement(figureEl, 0, 0, false);
        expect(fixture.querySelector(".o-figure-snap-border.horizontal")).toBeTruthy();
        expect(fixture.querySelector(".o-figure-snap-border.vertical")).toBeTruthy();

        await dragElement(figureEl, 0, 10, false);
        expect(fixture.querySelector(".o-figure-snap-border.horizontal")).toBeFalsy();
        expect(fixture.querySelector(".o-figure-snap-border.vertical")).toBeTruthy();

        await dragElement(figureEl, 0, params.figHeight, false);
        expect(fixture.querySelector(".o-figure-snap-border.horizontal")).toBeTruthy();
        expect(fixture.querySelector(".o-figure-snap-border.vertical")).toBeTruthy();
      });

      test.each([
        { figWidth: 50, scrollX: 0 }, // Figure totally in frozen pane
        { figWidth: 6 * cellWidth, scrollX: 0 }, // Figure half in frozen pane, no scroll
        { figWidth: 6 * cellWidth, scrollX: 2 * cellWidth }, // Figure half in frozen pane, with scroll
      ])("Frozen cols and snap, %s ", async (params) => {
        freezeColumns(model, 5);
        createFigure(model, { id: "f1", x: 0, y: 0, width: params.figWidth, height: 50 });
        createFigure(model, { id: "f2", x: 0, y: 0, width: params.figWidth, height: 50 });
        setViewportOffset(model, params.scrollX, 0);
        await nextTick();
        const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;

        await dragElement(figureEl, 0, 0, false);
        expect(fixture.querySelector(".o-figure-snap-border.vertical")).toBeTruthy();
        expect(fixture.querySelector(".o-figure-snap-border.horizontal")).toBeTruthy();

        await dragElement(figureEl, 10, 0, false);
        expect(fixture.querySelector(".o-figure-snap-border.vertical")).toBeFalsy();
        expect(fixture.querySelector(".o-figure-snap-border.horizontal")).toBeTruthy();

        await dragElement(figureEl, params.figWidth, 0, false);
        expect(fixture.querySelector(".o-figure-snap-border.vertical")).toBeTruthy();
        expect(fixture.querySelector(".o-figure-snap-border.horizontal")).toBeTruthy();
      });

      test.each([
        [48, 50], // top border snaps with top border of other figure
        [77, 75 + FIGURE_BORDER_WIDTH], // top border snaps with center of other figure
        [102, 100 + FIGURE_BORDER_WIDTH], // top border snaps with bottom border of other figure
        [38, 40 - FIGURE_BORDER_WIDTH], // center snaps with top border of other figure
        [67, 65], // center snaps with center of other figure
        [92, 90], // center snaps with bottom border of other figure
        [31, 30 - FIGURE_BORDER_WIDTH], // bottom border snaps with top border of other figure
        [57, 55], // bottom border snaps with center of other figure
        [79, 80], // bottom border snaps with bottom border of other figure
      ])("Snap y with y mouseMove %s", async (mouseMove: Pixel, expectedResult: Pixel) => {
        createFigure(model, { id: "f1", x: 0, y: 0, width: 20, height: 20 });
        createFigure(model, { id: "f2", x: 50, y: 50, width: 50, height: 50 });
        await nextTick();
        const figureEl = fixture.querySelector(".o-figure")! as HTMLElement;
        await dragElement(figureEl, 0, mouseMove, true);
        expect(model.getters.getFigure(sheetId, "f1")).toMatchObject({ x: 0, y: expectedResult });
      });
    });
  });
});
