import { GridModel } from "../../src/model";
import "../canvas.mock";

describe("Model resizer", () => {
  test("Can resize one column, undo, then redo", async () => {
    const model = new GridModel();
    model.workbook.viewport = { left: 0, top: 0, right: 25, bottom: 99 };

    const initialSize = model.workbook.cols[1].size;
    const initialTop = model.workbook.cols[2].left;

    model.dispatch({
      type: "RESIZE_COLUMNS",
      sheet: "Sheet1",
      cols: [1],
      size: model.workbook.cols[1].size + 100
    });
    expect(model.workbook.cols[1].size).toBe(196);
    expect(model.workbook.cols[2].left).toBe(initialTop + 100);

    model.dispatch({ type: "UNDO" });
    expect(model.workbook.cols[1].size).toBe(initialSize);
    expect(model.workbook.cols[2].left).toBe(initialTop);

    model.dispatch({ type: "REDO" });
    expect(model.workbook.cols[1].size).toBe(initialSize + 100);
    expect(model.workbook.cols[2].left).toBe(initialTop + 100);
  });

  test("Can resize one row, then undo", async () => {
    const model = new GridModel();
    model.workbook.viewport = { left: 0, top: 0, right: 25, bottom: 99 };

    const initialSize = model.workbook.rows[1].size;
    const initialTop = model.workbook.rows[2].top;

    model.dispatch({
      type: "RESIZE_ROWS",
      sheet: "Sheet1",
      rows: [1],
      size: initialSize + 100
    });
    expect(model.workbook.rows[1].size).toBe(initialSize + 100);
    expect(model.workbook.rows[2].top).toBe(initialTop + 100);

    model.dispatch({ type: "UNDO" });
    expect(model.workbook.rows[1].size).toBe(initialSize);
    expect(model.workbook.rows[2].top).toBe(initialTop);
  });

  test("Can resize multiple columns", async () => {
    const model = new GridModel();
    model.workbook.viewport = { left: 0, top: 0, right: 25, bottom: 99 };

    const size = model.workbook.cols[0].size;

    model.dispatch({
      type: "RESIZE_COLUMNS",
      sheet: "Sheet1",
      cols: [1, 3, 4],
      size: 100
    });
    expect(model.workbook.cols[1].size).toBe(100);
    expect(model.workbook.cols[2].size).toBe(size);
    expect(model.workbook.cols[3].size).toBe(100);
    expect(model.workbook.cols[4].size).toBe(100);
    expect(model.workbook.cols[5].left).toBe(size * 2 + 100 * 3);
  });

  test("Can resize multiple rows", async () => {
    const model = new GridModel();
    model.workbook.viewport = { left: 0, top: 0, right: 25, bottom: 99 };

    const size = model.workbook.rows[0].size;

    model.dispatch({
      type: "RESIZE_ROWS",
      sheet: "Sheet1",
      rows: [1, 3, 4],
      size: 100
    });

    expect(model.workbook.rows[1].size).toBe(100);
    expect(model.workbook.rows[2].size).toBe(size);
    expect(model.workbook.rows[3].size).toBe(100);
    expect(model.workbook.rows[4].size).toBe(100);
    expect(model.workbook.rows[5].top).toBe(2 * size + 100 * 3);
  });

  test("resizing cols/rows update the total width/height", async () => {
    const model = new GridModel();
    model.workbook.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

    const initialWidth = model.workbook.width;
    const initialHeight = model.workbook.height;

    model.dispatch({
      type: "RESIZE_COLUMNS",
      sheet: "Sheet1",
      cols: [1],
      size: model.workbook.cols[1].size + 100
    });
    expect(model.workbook.width).toBe(initialWidth + 100);

    model.dispatch({
      type: "RESIZE_ROWS",
      sheet: "Sheet1",
      rows: [1],
      size: model.workbook.rows[1].size + 42
    });
    expect(model.workbook.height).toBe(initialHeight + 42);
  });
});
