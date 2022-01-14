import { loopThroughReferenceType } from "../../src/helpers/reference_type";
describe("loopThroughReferenceType", () => {
  test("on cell", () => {
    let val = "A1";
    val = loopThroughReferenceType(val);
    expect(val).toBe("$A$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("A$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("$A1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("A1");
  });

  test("on range", () => {
    let val = "A1:B1";
    val = loopThroughReferenceType(val);
    expect(val).toBe("$A$1:$B$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("A$1:B$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("$A1:$B1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("A1:B1");
  });

  test("reference type loop separetly on cells of range", () => {
    let val = "$A1:B1";
    val = loopThroughReferenceType(val);
    expect(val).toBe("A1:$B$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("$A$1:B$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("A$1:$B1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("$A1:B1");
  });

  test("can have sheet reference on cell", () => {
    let val = "Sheet2!A1";
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!$A$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!A$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!$A1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!A1");
  });

  test("can have sheet reference on range", () => {
    let val = "Sheet2!A1:B1";
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!$A$1:$B$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!A$1:B$1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!$A1:$B1");
    val = loopThroughReferenceType(val);
    expect(val).toBe("Sheet2!A1:B1");
  });

  test("do nothing on tokens that aren't a cell or range", () => {
    let val = "hey";
    val = loopThroughReferenceType(val);
    expect(val).toBe("hey");
    val = "stringWithANumber123";
    val = loopThroughReferenceType(val);
    expect(val).toBe("stringWithANumber123");
    val = "1A";
    val = loopThroughReferenceType(val);
    expect(val).toBe("1A");
    val = "A1:T";
    val = loopThroughReferenceType(val);
    expect(val).toBe("A1:T");
    val = "T:A1";
    val = loopThroughReferenceType(val);
    expect(val).toBe("T:A1");
  });
});
