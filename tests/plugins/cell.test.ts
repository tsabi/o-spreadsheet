import { Model } from "../../src";
import { DEFAULT_STYLE_ID } from "../../src/constants";
import { CellType } from "../../src/types";

describe("getCellText", () => {
  test.each([
    [undefined, ""],
    [{ hello: 1 }, "0"],
    [{ hello: 1, toString: () => "hello" }, "0"],
    [null, "0"],
  ])("getCellText of cell with %j value", (a, expected) => {
    const model = new Model();
    const sheetId = model.getters.getActiveSheetId();
    expect(
      model.getters.getCellText(
        {
          id: "42",
          value: a,
          type: CellType.text,
          content: "text",
          styleId: DEFAULT_STYLE_ID,
        },
        sheetId
      )
    ).toBe(expected);
  });
});
