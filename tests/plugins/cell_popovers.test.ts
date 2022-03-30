import { Model } from "../../src";
import { ErrorToolTip } from "../../src/components/error_tooltip/error_tooltip";
import {
  DEFAULT_CELL_HEIGHT,
  DEFAULT_CELL_WIDTH,
  HEADER_HEIGHT,
  HEADER_WIDTH,
} from "../../src/constants";
import { merge } from "../test_helpers";

describe("cell popover plugin", () => {
  test("position is snapped when the viewport is scrolled", () => {
    const model = new Model();
    const startColOne = HEADER_WIDTH;
    const startColTwo = startColOne + DEFAULT_CELL_WIDTH;
    const endRowOne = HEADER_HEIGHT + DEFAULT_CELL_HEIGHT;
    model.dispatch("OPEN_CELL_POPOVER", {
      col: 1,
      row: 0,
      Component: ErrorToolTip,
      cellCorner: "BottomLeft",
      props: {},
    });
    expect(model.getters.getCellPopovers({ col: 1, row: 1 })[0].popoverProps.position).toEqual({
      x: startColTwo,
      y: endRowOne,
    });
    model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: 2, offsetY: 0 });
    expect(model.getters.getCellPopovers({ col: 1, row: 1 })[0].popoverProps.position).toEqual({
      x: startColTwo,
      y: endRowOne,
    });
    model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: DEFAULT_CELL_WIDTH + 1, offsetY: 0 });
    expect(model.getters.getCellPopovers({ col: 1, row: 1 })[0].popoverProps.position).toEqual({
      x: startColOne,
      y: endRowOne,
    });
  });

  test("bottom left position is correct on a merge", () => {
    const model = new Model();
    merge(model, "A1:B2");
    model.dispatch("OPEN_CELL_POPOVER", {
      col: 0,
      row: 0,
      Component: ErrorToolTip,
      cellCorner: "BottomLeft",
      props: {},
    });
    expect(model.getters.getCellPopovers({ col: 1, row: 1 })[0].popoverProps.position).toEqual({
      x: HEADER_WIDTH,
      y: HEADER_HEIGHT + 2 * DEFAULT_CELL_HEIGHT,
    });
  });

  test("top right position is correct on a merge", () => {
    const model = new Model();
    merge(model, "A1:B2");
    model.dispatch("OPEN_CELL_POPOVER", {
      col: 0,
      row: 0,
      Component: ErrorToolTip,
      cellCorner: "TopRight",
      props: {},
    });
    expect(model.getters.getCellPopovers({ col: 1, row: 1 })[0].popoverProps.position).toEqual({
      x: HEADER_WIDTH + 2 * DEFAULT_CELL_WIDTH,
      y: HEADER_HEIGHT,
    });
  });
});
