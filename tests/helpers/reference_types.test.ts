import { loopThroughReferenceType } from "../../src/helpers/reference_type";
import { Token } from "./../../src/formulas/tokenizer";
describe("loopThroughReferenceType", () => {
  test("on cell", () => {
    const token = { type: "SYMBOL", value: "A1" } as Token;
    expect(loopThroughReferenceType(token)).toBe("$A$1");
    expect(loopThroughReferenceType({ type: "SYMBOL", value: "$A$1" })).toBe("A$1");
    expect(loopThroughReferenceType(token)).toBe("$A1");
    expect(loopThroughReferenceType(token)).toBe("A1");
  });

  test("on range", () => {
    const token = { type: "SYMBOL", value: "A1:B1" } as Token;
    expect(loopThroughReferenceType(token)).toBe("$A$1:$B$1");
    expect(loopThroughReferenceType(token)).toBe("A$1:B$1");
    expect(loopThroughReferenceType(token)).toBe("$A1:$B1");
    expect(loopThroughReferenceType(token)).toBe("A1:B1");
  });

  test("reference type loop separetly on cells of range", () => {
    const token = { type: "SYMBOL", value: "$A1:B1" } as Token;
    expect(loopThroughReferenceType(token)).toBe("A1:$B$1");
    expect(loopThroughReferenceType(token)).toBe("$A$1:B$1");
    expect(loopThroughReferenceType(token)).toBe("A$1:$B1");
    expect(loopThroughReferenceType(token)).toBe("$A1:B1");
  });

  test("can have sheet reference on cell", () => {
    const token = { type: "SYMBOL", value: "Sheet2!A1" } as Token;
    expect(loopThroughReferenceType(token)).toBe("Sheet2!$A$1");
    expect(loopThroughReferenceType(token)).toBe("Sheet2!A$1");
    expect(loopThroughReferenceType(token)).toBe("Sheet2!$A1");
    expect(loopThroughReferenceType(token)).toBe("Sheet2!A1");
  });

  test("can have sheet reference on range", () => {
    const token = { type: "SYMBOL", value: "Sheet2!A1:B1" } as Token;
    expect(loopThroughReferenceType(token)).toBe("Sheet2!$A$1:$B$1");
    expect(loopThroughReferenceType(token)).toBe("Sheet2!A$1:B$1");
    expect(loopThroughReferenceType(token)).toBe("Sheet2!$A1:$B1");
    expect(loopThroughReferenceType(token)).toBe("Sheet2!A1:B1");
  });

  test("do nothing on tokens that aren't a cell or range", () => {
    const token = { type: "SYMBOL", value: "" } as Token;

    token.value = "hey";
    loopThroughReferenceType(token);
    expect(token.value).toBe("hey");
    token.value = "stringWithANumber123";
    loopThroughReferenceType(token);
    expect(token.value).toBe("stringWithANumber123");
    token.value = "1A";
    loopThroughReferenceType(token);
    expect(token.value).toBe("1A");
    token.value = "A1:T";
    loopThroughReferenceType(token);
    expect(token.value).toBe("A1:T");
    token.value = "T:A1";
    loopThroughReferenceType(token);
    expect(token.value).toBe("T:A1");
  });
});
