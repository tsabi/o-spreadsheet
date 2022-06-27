import { colors, toZone } from "../../src/helpers/index";
import { Model } from "../../src/model";
import { HighlightPlugin } from "../../src/plugins/highlight";
import { triggerMouseEvent } from "../dom_helper";
import { getActiveXc, getCell, GridParent, makeTestFixture, nextTick } from "../helpers";
import { ContentEditableHelper } from "./__mocks__/content_editable_helper";
jest.mock("../../src/components/composer/content_editable_helper", () =>
  require("./__mocks__/content_editable_helper")
);

let model: Model;
let composerEl: Element;
let canvasEl: Element;
let fixture: HTMLElement;
let parent: GridParent;

function getHighlights(model: Model): any[] {
  const highlightPlugin = (model as any).handlers.find((h) => h instanceof HighlightPlugin);
  return highlightPlugin.highlights;
}

async function typeInComposer(text: string, fromScratch: boolean = true) {
  if (fromScratch) {
    await startComposition();
  }
  composerEl.append(text);
  composerEl.dispatchEvent(new Event("input"));
  composerEl.dispatchEvent(new Event("keyup", { bubbles: true }));
  await nextTick();
}

async function startComposition(key: string = "Enter") {
  canvasEl.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  await nextTick();
  composerEl = fixture.querySelector("div.o-composer")!;
}

async function keydown(key: string, options: any = {}) {
  composerEl.dispatchEvent(
    new KeyboardEvent("keydown", Object.assign({ key, bubbles: true }, options))
  );
  await nextTick();
}

beforeEach(async () => {
  fixture = makeTestFixture();
  model = new Model();
  parent = new GridParent(model);
  await parent.mount(fixture);
  canvasEl = parent.grid.el;
});

afterEach(() => {
  fixture.remove();
});

describe("ranges and highlights", () => {
  test("=+Click Cell, the cell ref should be colored", async () => {
    await typeInComposer("=");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(model.getters.getCurrentContent()).toBe("=C8");
    expect(
      (parent.grid.comp.composer.comp.contentHelper as ContentEditableHelper).colors["C8"]
    ).toBe(colors[0]);
  });

  test("=+Click range, the range ref should be colored", async () => {
    await typeInComposer("=");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    triggerMouseEvent("canvas", "mousemove", 200, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 200, clientY: 200 }));
    await nextTick();
    expect(model.getters.getCurrentContent()).toBe("=B8:C8");
    expect(
      (parent.grid.comp.composer.comp.contentHelper as ContentEditableHelper).colors["B8:C8"]
    ).toBe(colors[0]);
  });

  test("=Key DOWN in A1, should select and highlight A2", async () => {
    await typeInComposer("=");
    await keydown("ArrowDown");
    expect(model.getters.getCurrentContent()).toBe("=A2");
  });

  test("=Key DOWN+DOWN in A1, should select and highlight A3", async () => {
    await typeInComposer("=");
    await keydown("ArrowDown");
    await keydown("ArrowDown");
    expect(model.getters.getCurrentContent()).toBe("=A3");
  });

  test("=Key RIGHT in A1, should select and highlight B1", async () => {
    await typeInComposer("=");
    await keydown("ArrowRight");
    expect(model.getters.getCurrentContent()).toBe("=B1");
  });

  test("=Key UP in B2, should select and highlight B1", async () => {
    model.dispatch("SELECT_CELL", { col: 1, row: 1 });
    await typeInComposer("=");
    await keydown("ArrowUp");
    expect(model.getters.getCurrentContent()).toBe("=B1");
  });

  test("=Key LEFT in B2, should select and highlight A2", async () => {
    model.dispatch("SELECT_CELL", { col: 1, row: 1 });
    await typeInComposer("=");
    await keydown("ArrowLeft");
    expect(model.getters.getCurrentContent()).toBe("=A2");
  });

  test("=Key DOWN and UP in B2, should select and highlight B2", async () => {
    model.dispatch("SELECT_CELL", { col: 1, row: 1 });
    await typeInComposer("=");
    await keydown("ArrowDown");
    await keydown("ArrowUp");
    expect(model.getters.getCurrentContent()).toBe("=B2");
  });

  test("=key UP 2 times and key DOWN in B2, should select and highlight B2", async () => {
    model.dispatch("SELECT_CELL", { col: 1, row: 1 });
    await typeInComposer("=");
    await keydown("ArrowUp");
    await keydown("ArrowUp");
    await keydown("ArrowDown");
    expect(model.getters.getCurrentContent()).toBe("=B2");
  });

  test("While selecting a ref, Shift+UP/DOWN/LEFT/RIGHT extend the range selection and updates the composer", async () => {
    await typeInComposer("=");
    await keydown("ArrowDown");
    expect(model.getters.getCurrentContent()).toBe("=A2");
    await keydown("ArrowDown", { shiftKey: true });
    expect(model.getters.getCurrentContent()).toBe("=A2:A3");
    await keydown("ArrowRight", { shiftKey: true });
    expect(model.getters.getCurrentContent()).toBe("=A2:B3");
    await keydown("ArrowUp", { shiftKey: true });
    expect(model.getters.getCurrentContent()).toBe("=A2:B2");
    await keydown("ArrowLeft", { shiftKey: true });
    expect(model.getters.getCurrentContent()).toBe("=A2");
  });

  test("Create a ref with merges with keyboard -> the merge should be treated as one cell", async () => {
    model.dispatch("SELECT_CELL", { col: 1, row: 1 });
    model.dispatch("ALTER_SELECTION", { delta: [1, 1] });
    const sheet1 = model["workbook"].visibleSheets[0];
    model.dispatch("ADD_MERGE", { sheet: sheet1, zone: toZone("B2:C3") });
    model.dispatch("SELECT_CELL", { col: 2, row: 0 });
    await typeInComposer("=");
    await keydown("ArrowDown");
    expect(model.getters.getCurrentContent()).toBe("=B2");
    expect(getHighlights(model)).toHaveLength(1);
    expect(getHighlights(model)[0].zone).toMatchObject({
      top: 1,
      bottom: 2,
      left: 1,
      right: 2,
    });
    await keydown("ArrowDown");
    expect(model.getters.getCurrentContent()).toBe("=C4");
  });
});

describe("composer", () => {
  test("starting the edition with enter, the composer should have the focus", async () => {
    await startComposition();
    expect(model.getters.getEditionMode()).toBe("editing");
    expect(model.getters.getPosition()).toEqual([0, 0]);
    expect(document.activeElement).toBe(fixture.querySelector("div.o-composer")!);
  });

  test("starting the edition with a key stroke =, the composer should have the focus after the key input", async () => {
    await startComposition("=");
    expect(composerEl.textContent).toBe("=");
  });

  test("starting the edition with a key stroke B, the composer should have the focus after the key input", async () => {
    await startComposition("b");
    expect(composerEl.textContent).toBe("b");
  });

  test("type '=', backspace and select a cell should not add it", async () => {
    await typeInComposer("=");
    model.dispatch("SET_CURRENT_CONTENT", { content: "" });
    const cehMock = parent.grid.comp.composer.comp.contentHelper as ContentEditableHelper;
    cehMock.removeAll();
    composerEl.dispatchEvent(new Event("keyup"));
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    await nextTick();
    expect(getActiveXc(model)).toBe("C8");
    expect(fixture.getElementsByClassName("o-composer")).toHaveLength(0);
  });

  test("type '=', select twice a cell", async () => {
    await typeInComposer("=");
    expect(model.getters.getEditionMode()).toBe("selecting");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(model.getters.getEditionMode()).toBe("selecting");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(composerEl.textContent).toBe("=C8");
  });

  test("type '=', select a cell, press enter", async () => {
    await typeInComposer("=");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(composerEl.textContent).toBe("=C8");
    expect(model.getters.getEditionMode()).toBe("selecting");
    await keydown("Enter");
    expect(model.getters.getEditionMode()).toBe("inactive");
    expect(getCell(model, "A1")!.content).toBe("=C8");
  });

  test("clicking on the composer while typing text (not formula) does not duplicates text", async () => {
    await typeInComposer("a");
    composerEl.dispatchEvent(new MouseEvent("click"));
    await nextTick();
    expect(composerEl.textContent).toBe("a");
  });

  test("typing incorrect formula then enter exits the edit mode and moves to the next cell down", async () => {
    await startComposition();
    await typeInComposer("=qsdf");
    await keydown("Enter");
    expect(getCell(model, "A1")!.content).toBe("=qsdf");
    expect(getCell(model, "A1")!.value).toBe("#BAD_EXPR");
  });

  test("typing text then enter exits the edit mode and moves to the next cell down", async () => {
    await startComposition();
    await typeInComposer("qsdf");
    await keydown("Enter");
    expect(getCell(model, "A1")!.content).toBe("qsdf");
    expect(getCell(model, "A1")!.value).toBe("qsdf");
  });

  test("typing CTRL+C does not type C in the cell", async () => {
    canvasEl.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true })
    );
    await nextTick();
    expect(model.getters.getCurrentContent()).toBe("");
  });
  test("keyup event triggered after edition end", async () => {
    canvasEl.dispatchEvent(
      new KeyboardEvent("keydown", Object.assign({ key: "d", bubbles: true }))
    );
    await nextTick();
    const composerEl = fixture.querySelector("div.o-composer")!;
    expect(model.getters.getEditionMode()).toBe("editing");
    // Enter is pressed really fast while another character is pressed such that
    // the character keyup event happens after the Enter
    composerEl.dispatchEvent(
      new KeyboardEvent("keydown", Object.assign({ key: "Enter", bubbles: true }))
    );
    composerEl.dispatchEvent(
      new KeyboardEvent("keyup", Object.assign({ key: "Enter", bubbles: true }))
    );
    composerEl.dispatchEvent(
      new KeyboardEvent("keyup", Object.assign({ key: "d", bubbles: true }))
    );
    await nextTick();
    expect(model.getters.getEditionMode()).toBe("inactive");
  });

  test("typing a formula with a space should put the composer in 'selecting' mode", async () => {
    await startComposition();
    await typeInComposer("= ");
    expect(model.getters.getEditionMode()).toBe("selecting");
  });

  test("type '=', select a cell in another sheet", async () => {
    await typeInComposer("=");
    expect(model.getters.getEditionMode()).toBe("selecting");
    model.dispatch("CREATE_SHEET", { id: "42", name: "Sheet2", activate: true });
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(model.getters.getEditionMode()).toBe("selecting");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(composerEl.textContent).toBe("=Sheet2!C8");
  });

  test("type =, select a cell in another sheet with space in name", async () => {
    await typeInComposer("=");
    expect(model.getters.getEditionMode()).toBe("selecting");
    model.dispatch("CREATE_SHEET", { id: "42", name: "Sheet 2", activate: true });
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(model.getters.getEditionMode()).toBe("selecting");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(composerEl.textContent).toBe("='Sheet 2'!C8");
  });

  test("type '=', select a cell in another sheet, select a cell in the active sheet", async () => {
    await typeInComposer("=");
    const sheet = model.getters.getActiveSheet();
    model.dispatch("CREATE_SHEET", { id: "42", name: "Sheet2", activate: true });
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    model.dispatch("ACTIVATE_SHEET", { from: "42", to: sheet });
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    window.dispatchEvent(new MouseEvent("mouseup", { clientX: 300, clientY: 200 }));
    await nextTick();
    expect(composerEl.textContent).toBe("=C8");
  });
});

describe("composer highlights color", () => {
  test("colors start with first color", async () => {
    model.dispatch("SET_VALUE", { xc: "A1", text: "=a1+a2" });
    await startComposition();
    expect(getHighlights(model).length).toBe(2);
    expect(getHighlights(model)[0].color).toBe(colors[0]);
    expect(getHighlights(model)[1].color).toBe(colors[1]);
  });

  test("colors always start with first color", async () => {
    model.dispatch("SET_VALUE", { xc: "A1", text: "=b1+b2" });
    model.dispatch("SET_VALUE", { xc: "A2", text: "=b1+b3" });
    await startComposition();
    expect(getHighlights(model).length).toBe(2);
    expect(getHighlights(model)[0].color).toBe(colors[0]);
    expect(getHighlights(model)[1].color).toBe(colors[1]);

    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await nextTick();
    canvasEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await nextTick();
    expect(getHighlights(model).length).toBe(2);
    expect(getHighlights(model)[0].color).toBe(colors[0]);
    expect(getHighlights(model)[1].color).toBe(colors[1]);
  });

  test("highlight do not duplicate", async () => {
    model.dispatch("SET_VALUE", { xc: "A1", text: "=a1+a1" });
    await startComposition();
    expect(getHighlights(model).length).toBe(1);
    expect(getHighlights(model)[0].color).toBe(colors[0]);
  });

  test("highlight range", async () => {
    model.dispatch("SET_VALUE", { xc: "A1", text: "=sum(a1:a10)" });
    await startComposition();
    expect(getHighlights(model).length).toBe(1);
    expect(getHighlights(model)[0].color).toBe(colors[0]);
    expect(composerEl.textContent).toBe("=sum(a1:a10)");
  });

  test("highlight 'reverse' ranges", async () => {
    model.dispatch("SET_VALUE", { xc: "A1", text: "=sum(B3:a1)" });
    await startComposition();
    expect(getHighlights(model)[0].zone).toEqual({ left: 0, right: 1, top: 0, bottom: 2 });
  });

  test.each(["=A0", "=ZZ1", "=A101"])("Do not highlight invalid ref", async (ref) => {
    model.dispatch("SET_VALUE", { xc: "A1", text: ref });
    await startComposition();
    expect(getHighlights(model).length).toBe(0);
    expect(composerEl.textContent).toBe(ref);
  });

  test("highlight cross-sheet ranges", async () => {
    model.dispatch("CREATE_SHEET", { id: "42", name: "Sheet2" });
    model.dispatch("SET_VALUE", { xc: "A1", text: "=B1+Sheet2!A1" });
    await startComposition();
    const highlights = getHighlights(model);
    expect(highlights).toHaveLength(2);
    expect(highlights[0].sheet).toBe(model.getters.getActiveSheet());
    expect(highlights[0].zone).toEqual({ left: 1, right: 1, top: 0, bottom: 0 });
    expect(highlights[1].sheet).toBe("42");
    expect(highlights[1].zone).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  test("composer is resized when input content is larger than composer", async () => {
    await typeInComposer("Hello");
    const composerEl = fixture.querySelector("div.o-composer")! as HTMLElement;
    const styleSpy = jest.spyOn(composerEl.style, "width", "set");
    jest.spyOn(composerEl, "clientWidth", "get").mockImplementation(() => 100);
    jest.spyOn(composerEl, "scrollWidth", "get").mockImplementation(() => 120);
    await typeInComposer("world", false);
    expect(styleSpy).toHaveBeenCalledWith("140px"); // scrollWidth + padding 20px
  });
});