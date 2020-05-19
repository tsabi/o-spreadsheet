import { evaluateCell, evaluateGrid } from "../helpers";
import { parseDate } from "../../src/functions/dates";

describe("date", () => {
  //----------------------------------------------------------------------------
  // DATE
  //----------------------------------------------------------------------------

  test("DATE: functional tests on cell arguments", () => {
    // prettier-ignore
    const grid = {
      // YEAR / MONTH / DAY
      A2:  "=DATE(B2 , C2 , D2 )",
      A3:  "=DATE(B3 , C3 , D3 )",                C3: "1"    , D3:  "1",
      A4:  "=DATE(B4 , C4 , D4 )", B4:  "2028"  , C4: "12"   , D4:  "5",
      // calculate numeric dates which fall outside of valid month or day ranges.
      A6:  "=DATE(B6 , C6 , D6 )", B6:  "2028"  , C6: "13"   , D6:  "5" ,
      A7:  "=DATE(B7 , C7 , D7 )", B7:  "2028"  , C7: "5"    , D7:  "87",
      A8:  "=DATE(B8 , C8 , D8 )", B8:  "2028"  , C8: "12"   , D8:  "5" ,
      // truncate decimal values input into the function.
      A10: "=DATE(B10, C10, D10)", B10: "2028"  , C10: "12.9", D10: "5"  ,
      A11: "=DATE(B11, C11, D11)", B11: "2028"  , C11: "12.9", D11: "5.6",
      A12: "=DATE(B12, C12, D12)", B12: "2028.5", C12: "12.9", D12: "5.6",
      // Between 0 and 1899, add value to 1900 to calculate the year.
      A14: "=DATE(B14, C14, D14)", B14: "119"   , C14: "12"  , D14: "5",
      A15: "=DATE(B15, C15, D15)", B15: "19"    , C15: "12"  , D15: "5",
      A16: "=DATE(B16, C16, D16)", B16: "1850"  , C16: "12"  , D16: "5",
      A17: "=DATE(B17, C17, D17)", B17: "1899"  , C17: "12"  , D17: "5",
      A18: "=DATE(B18, C18, D18)", B18: "1900"  , C18: "12"  , D18: "5",
      A19: "=DATE(B19, C19, D19)", B19: "12"    ,
      A20: "=DATE(B20, C20, D20)", B20: "1900"  , C20: "-24" , D20: "5",
      A21: "=DATE(B21, C21, D21)", B21: "2000"  , C21: "-22" , D21: "5",
      A22: "=DATE(B22, C22, D22)", B22: "1899"  , C22: "-22" , D22: "5",
      // For years less than 0 or greater than 10,000 return the #ERROR.
      A24: "=DATE(B24, C24, D24)", B24: "-2020" , C24: "12"  , D24: "5",
      A25: "=DATE(B25, C25, D25)", B25: "9999"  , C25: "12"  , D25: "5",
      A26: "=DATE(B26, C26, D26)", B26: "10000" , C26: "12"  , D26: "5",
      A27: "=DATE(B27, C27, D27)", B27: "-1"    , C27: "12"  , D27: "5",
      A28: "=DATE(B28, C28, D28)", B28: "0"     , C28: "12"  , D28: "5",
      A29: "=DATE(B29, C29, D29)", B29: "2000"  , C29: "-12" , D29: "-5",
      A30: "=DATE(B30, C30, D30)", B30: "0"     , C30: "-12" , D30: "-5",
    };

    const gridResult = evaluateGrid(grid);
    expect(gridResult.A2).toBe("#ERROR");
    expect(gridResult.A3).toEqual(parseDate("1/1/1900"));
    expect(gridResult.A4).toEqual(parseDate("12/5/2028"));
    expect(gridResult.A6).toEqual(parseDate("1/5/2029"));
    expect(gridResult.A7).toEqual(parseDate("7/26/2028"));
    expect(gridResult.A8).toEqual(parseDate("12/5/2028"));
    expect(gridResult.A10).toEqual(parseDate("12/5/2028"));
    expect(gridResult.A11).toEqual(parseDate("12/5/2028"));
    expect(gridResult.A12).toEqual(parseDate("12/5/2028"));
    expect(gridResult.A14).toEqual(parseDate("12/5/2019"));
    expect(gridResult.A15).toEqual(parseDate("12/5/1919"));
    expect(gridResult.A16).toEqual(parseDate("12/5/3750"));
    expect(gridResult.A17).toEqual(parseDate("12/5/3799"));
    expect(gridResult.A18).toEqual(parseDate("12/5/1900"));
    expect(gridResult.A19).toEqual(parseDate("11/30/1911"));
    expect(gridResult.A20).toBe("#ERROR");
    expect(gridResult.A21).toEqual(parseDate("2/5/1998"));
    expect(gridResult.A22).toEqual(parseDate("2/5/3797"));
    expect(gridResult.A24).toBe("#ERROR");
    expect(gridResult.A25).toEqual(parseDate("12/5/9999"));
    expect(gridResult.A26).toBe("#ERROR");
    expect(gridResult.A27).toBe("#ERROR");
    expect(gridResult.A28).toEqual(parseDate("12/5/1900"));
    expect(gridResult.A29).toEqual(parseDate("11/25/1998"));
    expect(gridResult.A30).toBe("#ERROR");
  });

  test("DATE: casting tests on cell arguments", () => {
    // prettier-ignore
    const grid = {
      A33: "=DATE(B33, C33, D33)", B33: "2028", C33:"12", D33:'="5"'  ,
      A34: "=DATE(B34, C34, D34)", B34: "2028", C34:"12", D34:"TRUE"  ,
      A35: "=DATE(B35, C35, D35)", B35: "TRUE", C35:"12", D35:"TRUE"  ,
      A36: "=DATE(B36, C36, D36)", B36: '="5"', C36:"12", D36:"TRUE"  ,
    };

    const gridResult = evaluateGrid(grid);
    expect(gridResult.A33).toEqual(parseDate("12/5/2028"));
    expect(gridResult.A34).toEqual(parseDate("12/1/2028"));
    expect(gridResult.A35).toEqual(parseDate("12/1/1901"));
    expect(gridResult.A36).toEqual(parseDate("12/1/1905"));
  });

  //----------------------------------------------------------------------------
  // DATEVALUE
  //----------------------------------------------------------------------------

  test("DATEVALUE: functional tests on simple arguments", () => {
    expect(evaluateCell("A1", { A1: "=DATEVALUE(40931)" })).toBe("#ERROR"); // @compatibility, retrun #VALUE! on Google Sheet
    expect(evaluateCell("A1", { A1: "=DATEVALUE(1/23/2012)" })).toBe("#ERROR"); // @compatibility, retrun #VALUE! on Google Sheet
    expect(evaluateCell("A1", { A1: '=DATEVALUE("1/23/2012")' })).toBe(40931);
    //expect(evaluateCell("A1", { A1: '=DATEVALUE("1/23/2012 8:10:30")' })).toBe(40931);
    expect(evaluateCell("A1", { A1: '=DATEVALUE("2012/1/23")' })).toBe(40931);
    expect(evaluateCell("A1", { A1: '=DATEVALUE("2012-1-23")' })).toBe(40931);
    expect(evaluateCell("A1", { A1: '=DATEVALUE("1/23/2012")' })).toBe(40931);
    expect(evaluateCell("A1", { A1: '=DATEVALUE("13/8/1999")' })).toBe("#ERROR"); // @compatibility, retrun #VALUE! on Google Sheet
  });

  test("DATEVALUE: functional tests on cell arguments", () => {
    expect(evaluateCell("A1", { A1: "=DATEVALUE(A2)", A2: "36380" })).toBe("#ERROR"); // @compatibility, retrun #VALUE! on Google Sheet
    expect(evaluateCell("A1", { A1: "=DATEVALUE(A2)", A2: "8/8/1999" })).toBe("#ERROR"); // @compatibility, retrun 8/8/1999 on Google Sheet
    expect(evaluateCell("A1", { A1: "=DATEVALUE(A2)", A2: "13/8/1999" })).toBe("#ERROR"); // @compatibility, retrun #VALUE! on Google Sheet
  });

  //----------------------------------------------------------------------------
  // DAY
  //----------------------------------------------------------------------------

  test("DAY: functional tests on simple arguments", () => {
    expect(evaluateCell("A1", { A1: '=DAY("3/28/2017")' })).toBe(28);
    expect(evaluateCell("A1", { A1: '=DAY("5/31/2012")' })).toBe(31);
    expect(evaluateCell("A1", { A1: '=DAY("41060")' })).toBe(31);
    expect(evaluateCell("A1", { A1: "=DAY(41060)" })).toBe(31);
  });

  test("DAY: functional tests on cell arguments", () => {
    expect(evaluateCell("A1", { A1: "=DAY(A2)", A2: "5/31/2012" })).toBe(31);
    expect(evaluateCell("A1", { A1: "=DAY(A2)", A2: "41060" })).toBe(31);
  });

  //----------------------------------------------------------------------------
  // DAYS
  //----------------------------------------------------------------------------

  test("DAYS: functional tests on simple arguments", () => {
    const grid = {
      A1: '=DAYS("2/13/2015", "2/23/2014")',
      A2: '=DAYS("7/15/2020", "7/16/2016")',
      A3: '=DAYS("2/23/1234", "2/13/1245")',
      A4: '=DAYS("7/17/2016", "7/16/2016")',
      A5: '=DAYS("7/18/2016", "7/16/2016")',
      A6: '=DAYS("7/16/2017", "7/16/2016")',
      A7: '=DAYS("7/16/2020", "7/16/2019")',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.A1).toBe(355);
    expect(gridResult.A2).toBe(1460);
    expect(gridResult.A3).toBe(-4008);
    expect(gridResult.A4).toBe(1);
    expect(gridResult.A5).toBe(2);
    expect(gridResult.A6).toBe(365);
    expect(gridResult.A7).toBe(366);
  });

  //----------------------------------------------------------------------------
  // EDATE
  //----------------------------------------------------------------------------

  test("EDATE: functional tests on simple arguments", () => {
    const grid = {
      A1: '=EDATE("7/20/1969", 0)',
      A2: '=EDATE("7/21/1969", 1)',
      A3: '=EDATE("7/22/1969", -2)',
      A4: '=EDATE("7/23/1969", -13)',
      A5: '=EDATE("7/24/1969", 1234)',
      A6: '=EDATE("7/21/1969", 1.9)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.A1).toEqual(parseDate("7/20/1969"));
    expect(gridResult.A2).toEqual(parseDate("8/21/1969"));
    expect(gridResult.A3).toEqual(parseDate("5/22/1969"));
    expect(gridResult.A4).toEqual(parseDate("6/23/1968"));
    expect(gridResult.A5).toEqual(parseDate("5/24/2072"));
    expect(gridResult.A6).toEqual(parseDate("8/21/1969"));
  });

  test("EDATE: casting tests on cell arguments", () => {
    const grid = {
      A7: '=EDATE("7/21/1969", "1")',
      A8: '=EDATE("7/21/1969", True)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.A7).toEqual(parseDate("8/21/1969"));
    expect(gridResult.A8).toEqual(parseDate("8/21/1969"));
  });

  //----------------------------------------------------------------------------
  // EOMONTH
  //----------------------------------------------------------------------------

  test("EOMONTH: functional tests on simple arguments", () => {
    const grid = {
      A1: '=EOMONTH("7/20/2020", 0)',
      A2: '=EOMONTH("7/21/2020", 1)',
      A3: '=EOMONTH("7/22/2020", -2)',
      A4: '=EOMONTH("7/23/2020", -5)',
      A5: '=EOMONTH("7/24/2020", 1234)',
      A6: '=EOMONTH("7/25/2020", 1.9)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.A1).toEqual(parseDate("7/31/2020"));
    expect(gridResult.A2).toEqual(parseDate("8/31/2020"));
    expect(gridResult.A3).toEqual(parseDate("5/31/2020"));
    expect(gridResult.A4).toEqual(parseDate("2/29/2020"));
    expect(gridResult.A5).toEqual(parseDate("5/31/2123"));
    expect(gridResult.A6).toEqual(parseDate("8/31/2020"));
  });

  test("EOMONTH: casting tests on cell arguments", () => {
    const grid = {
      A7: '=EOMONTH("7/21/1920", "1")',
      A8: '=EOMONTH("7/21/2020", True)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.A7).toEqual(parseDate("8/31/1920"));
    expect(gridResult.A8).toEqual(parseDate("8/31/2020"));
  });

  //----------------------------------------------------------------------------
  // ISOWEEKNUM
  //----------------------------------------------------------------------------

  test("ISOWEEKNUM: functional tests on cell arguments", () => {
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/1/2016" })).toBe(53);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/3/2016" })).toBe(53);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/4/2016" })).toBe(1);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/1/2017" })).toBe(52);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/2/2017" })).toBe(1);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/1/2018" })).toBe(1);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/7/2018" })).toBe(1);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/8/2018" })).toBe(2);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/1/2020" })).toBe(1);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/5/2020" })).toBe(1);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/6/2020" })).toBe(2);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/1/2021" })).toBe(53);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/3/2021" })).toBe(53);
    expect(evaluateCell("A1", { A1: "=ISOWEEKNUM(A2)", A2: "1/4/2021" })).toBe(1);
  });

  //----------------------------------------------------------------------------
  // MONTH
  //----------------------------------------------------------------------------

  test("MONTH: functional tests on cell arguments", () => {
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: "1/2/1954" })).toBe(1);
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: "5/13/1954" })).toBe(5);
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: "43964" })).toBe(5); // 43964 corespond to 5/13/195
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: "0" })).toBe(12); // 0 corespond to 12/30/1899
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: "1" })).toBe(12); // 1 corespond to 12/31/1899
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: "2" })).toBe(1); // 2 corespond to 1/1/1900
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: '="43964"' })).toBe(5);
    expect(evaluateCell("A1", { A1: "=MONTH(A2)", A2: "TRUE" })).toBe(12);
  });

  //----------------------------------------------------------------------------
  // NETWORKDAYS
  //----------------------------------------------------------------------------

  test("NETWORKDAYS: functional tests on cell arguments", () => {
    // prettier-ignore
    const grid = {
      A1: "1/1/2013",  A2: "1/21/2013", A3: "2/18/2013",   A4: "5/27/2013",
      A5: "1/21/2013", A6: "1/12/2013", A7: "Hello there", A8: "1/1/2015",
    
      A15: "1/1/2013", B15: "2/1/2013", C15: "=NETWORKDAYS(A15,B15)",
      A16: "1/1/2013", B16: "2/1/2013", C16: "=NETWORKDAYS(A16,B16,A1:A5)",
      A17: "3/1/2013", B17: "7/1/2013", C17: '=NETWORKDAYS("3/1/2013","7/1/2013",A1:A5)',
      A18: "2/1/2013", B18: "1/1/2013", C18: "=NETWORKDAYS(A18,B18)",
      A19: "1/1/2013", B19: "1/2/2013", C19: "=NETWORKDAYS(A19,B19)",
      A20: "1/1/2013", B20: "2/1/2013", C20: "=NETWORKDAYS(A20,B20,A1)",
      A21: "1/1/2013", B21: "2/1/2013", C21: "=NETWORKDAYS(A21,B21,A1,A2)",
      A22: "1/1/2013", B22: "2/1/2013", C22: "=NETWORKDAYS(A22,B22,A6:A7)",
      A23: "1/1/2013", B23: "2/1/2013", C23: "=NETWORKDAYS(A23,B23,A6)",
      A24: "1/1/2013", B24: "2/1/2013", C24: "=NETWORKDAYS(A24,B24,A8)",
    };
    const gridResult = evaluateGrid(grid);

    expect(gridResult.C15).toBe(24);
    expect(gridResult.C16).toBe(22);
    expect(gridResult.C17).toBe(86);
    expect(gridResult.C18).toBe(-24);
    expect(gridResult.C19).toBe(2);
    expect(gridResult.C20).toBe(23);
    expect(gridResult.C21).toBe("#BAD_EXPR"); // @compatibility on Google Sheets, return  #N/A
    expect(gridResult.C22).toBe("#ERROR"); // @compatibility on Google Sheets, return  #VALUE!
    expect(gridResult.C23).toBe(24);
    expect(gridResult.C24).toBe(24);
  });

  //----------------------------------------------------------------------------
  // NETWORKDAYS.INTL
  //----------------------------------------------------------------------------
  test("NETWORKDAYS.INTL: functional tests on cell arguments, string method", () => {
    // prettier-ignore
    const grid = {
      B2:  "5/4/2020", C2:  "5/17/2020", D2:  "=NETWORKDAYS.INTL(B2, C2)",
      B3:  "5/4/2020", C3:  "5/17/2020", D3:  '=NETWORKDAYS.INTL(B3, C3, "0")',
      B4:  "5/4/2020", C4:  "5/17/2020", D4:  '=NETWORKDAYS.INTL(B4, C4, "00")',
      B5:  "5/4/2020", C5:  "5/17/2020", D5:  '=NETWORKDAYS.INTL(B5, C5, "000000")',
      B6:  "5/4/2020", C6:  "5/17/2020", D6:  '=NETWORKDAYS.INTL(B6, C6, "0000000")',
      B7:  "5/4/2020", C7:  "5/17/2020", D7:  '=NETWORKDAYS.INTL(B7, C7, "0000011")',
      B8:  "5/4/2020", C8:  "5/17/2020", D8:  '=NETWORKDAYS.INTL(B8, C8, "0000111")',
      B9:  "5/4/2020", C9:  "5/17/2020", D9:  '=NETWORKDAYS.INTL(B9, C9, "1000111")',
      B10: "5/4/2020", C10: "5/17/2020", D10: '=NETWORKDAYS.INTL(B10, C10, "1110111")',
      B11: "5/4/2020", C11: "5/17/2020", D11: '=NETWORKDAYS.INTL(B11, C11, "1111111")',
      B12: "5/4/2020", C12: "5/17/2020", D12: '=NETWORKDAYS.INTL(B12, C12, "1000211")',
                       C13: "5/17/2020", D13: '=NETWORKDAYS.INTL(B13, C13, "0000000")',
      B14: "5/4/2020",                   D14: '=NETWORKDAYS.INTL(B14, C14, "0000000")',
    
      B75: "5/4/2020", C75: "5/17/2020", D75: '=NETWORKDAYS.INTL(B75, C75, "0000000")',
      B76: "5/4/2020", C76: "5/8/2020" , D76: '=NETWORKDAYS.INTL(B76, C76, "0000011")',
      B77: "5/9/2020", C77: "5/10/2020", D77: '=NETWORKDAYS.INTL(B77, C77, "0000011")',
      B78: "5/4/2020", C78: "5/8/2020" , D78: '=NETWORKDAYS.INTL(B78, C78, "0000111")',
      B79: "5/8/2020", C79: "5/10/2020", D79: '=NETWORKDAYS.INTL(B79, C79, "0000111")',
      B80: "5/5/2020", C80: "5/7/2020" , D80: '=NETWORKDAYS.INTL(B80, C80, "1000111")',
      B81: "5/8/2020", C81: "5/11/2020", D81: '=NETWORKDAYS.INTL(B81, C81, "1000111")',
      B82: "5/7/2020", C82: "5/7/2020" , D82: '=NETWORKDAYS.INTL(B82, C82, "1110111")',
      B83: "5/8/2020", C83: "5/12/2020", D83: '=NETWORKDAYS.INTL(B83, C83, "1110111")',

    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.D2).toBe(10);
    expect(gridResult.D3).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D4).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D5).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D6).toBe(14);
    expect(gridResult.D7).toBe(10);
    expect(gridResult.D8).toBe(8);
    expect(gridResult.D9).toBe(6);
    expect(gridResult.D10).toBe(2);
    expect(gridResult.D11).toBe(0); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D12).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    // To do:
    //expect(gridResult.D13).toBe(43969);
    //expect(gridResult.D14).toBe(-43956);

    expect(gridResult.D75).toBe(14);
    expect(gridResult.D76).toBe(5);
    expect(gridResult.D77).toBe(0);
    expect(gridResult.D78).toBe(4);
    expect(gridResult.D79).toBe(0);
    expect(gridResult.D80).toBe(3);
    expect(gridResult.D81).toBe(0);
    expect(gridResult.D82).toBe(1);
    expect(gridResult.D83).toBe(0);
  });

  test("NETWORKDAYS.INTL: functional tests on cell arguments, number method", () => {
    // prettier-ignore
    const grid = {
      B18: "5/4/2020",  C18: "5/17/2020", D18: '=NETWORKDAYS.INTL(B18, C18, 0)',
      B19: "5/9/2020",  C19: "5/10/2020", D19: '=NETWORKDAYS.INTL(B19, C19, 1)',
      B20: "5/10/2020", C20: "5/11/2020", D20: '=NETWORKDAYS.INTL(B20, C20, 1)',
      B21: "5/10/2020", C21: "5/11/2020", D21: '=NETWORKDAYS.INTL(B21, C21, 2)',
      B22: "5/11/2020", C22: "5/12/2020", D22: '=NETWORKDAYS.INTL(B22, C22, 2)',
      B23: "5/11/2020", C23: "5/12/2020", D23: '=NETWORKDAYS.INTL(B23, C23, 3)',
      B24: "5/12/2020", C24: "5/13/2020", D24: '=NETWORKDAYS.INTL(B24, C24, 3)',
      B25: "5/12/2020", C25: "5/13/2020", D25: '=NETWORKDAYS.INTL(B25, C25, 4)',
      B26: "5/13/2020", C26: "5/14/2020", D26: '=NETWORKDAYS.INTL(B26, C26, 4)',
      B27: "5/13/2020", C27: "5/14/2020", D27: '=NETWORKDAYS.INTL(B27, C27, 5)',
      B28: "5/14/2020", C28: "5/15/2020", D28: '=NETWORKDAYS.INTL(B28, C28, 5)',
      B29: "5/14/2020", C29: "5/15/2020", D29: '=NETWORKDAYS.INTL(B29, C29, 6)',
      B30: "5/15/2020", C30: "5/16/2020", D30: '=NETWORKDAYS.INTL(B30, C30, 6)',
      B31: "5/15/2020", C31: "5/16/2020", D31: '=NETWORKDAYS.INTL(B31, C31, 7)',
      B32: "5/16/2020", C32: "5/17/2020", D32: '=NETWORKDAYS.INTL(B32, C32, 7)',
      B33: "5/16/2020", C33: "5/17/2020", D33: '=NETWORKDAYS.INTL(B33, C33, 8)',

      B39: "5/4/2020",  C39: "5/17/2020", D39: '=NETWORKDAYS.INTL(B39, C39, 10)',
      B40: "5/9/2020",  C40: "5/9/2020" , D40: '=NETWORKDAYS.INTL(B40, C40, 11)',
      B41: "5/10/2020", C41: "5/10/2020", D41: '=NETWORKDAYS.INTL(B41, C41, 11)',
      B42: "5/10/2020", C42: "5/10/2020", D42: '=NETWORKDAYS.INTL(B42, C42, 12)',
      B43: "5/11/2020", C43: "5/11/2020", D43: '=NETWORKDAYS.INTL(B43, C43, 12)',
      B44: "5/11/2020", C44: "5/11/2020", D44: '=NETWORKDAYS.INTL(B44, C44, 13)',
      B45: "5/12/2020", C45: "5/12/2020", D45: '=NETWORKDAYS.INTL(B45, C45, 13)',
      B46: "5/12/2020", C46: "5/12/2020", D46: '=NETWORKDAYS.INTL(B46, C46, 14)',
      B47: "5/13/2020", C47: "5/13/2020", D47: '=NETWORKDAYS.INTL(B47, C47, 14)',
      B48: "5/13/2020", C48: "5/13/2020", D48: '=NETWORKDAYS.INTL(B48, C48, 15)',
      B49: "5/14/2020", C49: "5/14/2020", D49: '=NETWORKDAYS.INTL(B49, C49, 15)',
      B50: "5/14/2020", C50: "5/14/2020", D50: '=NETWORKDAYS.INTL(B50, C50, 16)',
      B51: "5/15/2020", C51: "5/15/2020", D51: '=NETWORKDAYS.INTL(B51, C51, 16)',
      B52: "5/15/2020", C52: "5/15/2020", D52: '=NETWORKDAYS.INTL(B52, C52, 17)',
      B53: "5/16/2020", C53: "5/16/2020", D53: '=NETWORKDAYS.INTL(B53, C53, 17)',
      B54: "5/16/2020", C54: "5/16/2020", D54: '=NETWORKDAYS.INTL(B54, C54, 18)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.D18).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D19).toBe(0);
    expect(gridResult.D20).toBe(1);
    expect(gridResult.D21).toBe(0);
    expect(gridResult.D22).toBe(1);
    expect(gridResult.D23).toBe(0);
    expect(gridResult.D24).toBe(1);
    expect(gridResult.D25).toBe(0);
    expect(gridResult.D26).toBe(1);
    expect(gridResult.D27).toBe(0);
    expect(gridResult.D28).toBe(1);
    expect(gridResult.D29).toBe(0);
    expect(gridResult.D30).toBe(1);
    expect(gridResult.D31).toBe(0);
    expect(gridResult.D32).toBe(1);
    expect(gridResult.D33).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!

    expect(gridResult.D39).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D40).toBe(1);
    expect(gridResult.D41).toBe(0);
    expect(gridResult.D42).toBe(1);
    expect(gridResult.D43).toBe(0);
    expect(gridResult.D44).toBe(1);
    expect(gridResult.D45).toBe(0);
    expect(gridResult.D46).toBe(1);
    expect(gridResult.D47).toBe(0);
    expect(gridResult.D48).toBe(1);
    expect(gridResult.D49).toBe(0);
    expect(gridResult.D50).toBe(1);
    expect(gridResult.D51).toBe(0);
    expect(gridResult.D52).toBe(1);
    expect(gridResult.D53).toBe(0);
    expect(gridResult.D54).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
  });

  test("NETWORKDAYS.INTL: casting tests on cell arguments", () => {
    // prettier-ignore
    const grid = {
      B68: "5/4/2020",  C68: "5/17/2020", D68: '=NETWORKDAYS.INTL(B68, C68, 1110111)',
      B69: "5/5/2020",  C69: "5/18/2020", D69: '=NETWORKDAYS.INTL(B69, C69, "test")',
      B70: "5/11/2020", C70: "5/12/2020", D70: '=NETWORKDAYS.INTL(B70, C70, "2")',
      B71: "5/11/2020", C71: "5/12/2020", D71: '=NETWORKDAYS.INTL(B71, C71, A71)',
      B72: "5/11/2020", C72: "5/17/2020", D72: '=NETWORKDAYS.INTL(B72, C72)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.D68).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D69).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D70).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D71).toBe("#ERROR"); // @compatibility on Google Sheets, return  #VALUE!
    expect(gridResult.D72).toBe(5);
  });

  //----------------------------------------------------------------------------
  // TODAY
  //----------------------------------------------------------------------------

  test("TODAY: functional tests on simple arguments", () => {
    const grid = { A1: "=TODAY()" };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.A1.jsDate.getTime()).toBeLessThan(new Date().getTime());
  });

  //----------------------------------------------------------------------------
  // WEEKDAY
  //----------------------------------------------------------------------------

  test("WEEKDAY: functional tests on cell arguments, option 1", () => {
    // prettier-ignore
    const grid = {
      A3: "1/1/2020", B3: "1", C3: "=WEEKDAY(A3,B3)",
      A4: "1/2/2020", B4: "1", C4: "=WEEKDAY(A4,B4)",
      A5: "1/3/2020", B5: "1", C5: "=WEEKDAY(A5,B5)",
      A6: "1/4/2020", B6: "1", C6: "=WEEKDAY(A6,B6)",
      A7: "1/5/2020", B7: "1", C7: "=WEEKDAY(A7,B7)",
      A8: "1/6/2020", B8: "1", C8: "=WEEKDAY(A8,B8)",
      A9: "1/7/2020", B9: "1", C9: "=WEEKDAY(A9,B9)",
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.C3).toBe(4);
    expect(gridResult.C4).toBe(5);
    expect(gridResult.C5).toBe(6);
    expect(gridResult.C6).toBe(7);
    expect(gridResult.C7).toBe(1);
    expect(gridResult.C8).toBe(2);
    expect(gridResult.C9).toBe(3);
  });

  test("WEEKDAY: functional tests on cell arguments, option 2", () => {
    // prettier-ignore
    const grid = {
      A11: "1/1/2020", B11: "2", C11: "=WEEKDAY(A11,B11)",
      A12: "1/2/2020", B12: "2", C12: "=WEEKDAY(A12,B12)",
      A13: "1/3/2020", B13: "2", C13: "=WEEKDAY(A13,B13)",
      A14: "1/4/2020", B14: "2", C14: "=WEEKDAY(A14,B14)",
      A15: "1/5/2020", B15: "2", C15: "=WEEKDAY(A15,B15)",
      A16: "1/6/2020", B16: "2", C16: "=WEEKDAY(A16,B16)",
      A17: "1/7/2020", B17: "2", C17: "=WEEKDAY(A17,B17)",
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.C11).toBe(3);
    expect(gridResult.C12).toBe(4);
    expect(gridResult.C13).toBe(5);
    expect(gridResult.C14).toBe(6);
    expect(gridResult.C15).toBe(7);
    expect(gridResult.C16).toBe(1);
    expect(gridResult.C17).toBe(2);
  });

  test("WEEKDAY: functional tests on cell arguments, option 3", () => {
    // prettier-ignore
    const grid = {
      A19: "1/1/2020", B19: "3", C19: "=WEEKDAY(A19,B19)",
      A20: "1/2/2020", B20: "3", C20: "=WEEKDAY(A20,B20)",
      A21: "1/3/2020", B21: "3", C21: "=WEEKDAY(A21,B21)",
      A22: "1/4/2020", B22: "3", C22: "=WEEKDAY(A22,B22)",
      A23: "1/5/2020", B23: "3", C23: "=WEEKDAY(A23,B23)",
      A24: "1/6/2020", B24: "3", C24: "=WEEKDAY(A24,B24)",
      A25: "1/7/2020", B25: "3", C25: "=WEEKDAY(A25,B25)",
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.C19).toBe(2);
    expect(gridResult.C20).toBe(3);
    expect(gridResult.C21).toBe(4);
    expect(gridResult.C22).toBe(5);
    expect(gridResult.C23).toBe(6);
    expect(gridResult.C24).toBe(0);
    expect(gridResult.C25).toBe(1);
  });

  //----------------------------------------------------------------------------
  // WEEKNUM
  //----------------------------------------------------------------------------

  test("WEEKNUM: functional tests on cell arguments", () => {
    // prettier-ignore
    const grid = {
      A11: "12/31/2019", B11: "1" , C11: "=WEEKNUM(A11, B11)", 
      A12: "1/1/2020"  , B12: "1" , C12: "=WEEKNUM(A12, B12)", 
      A13: "1/4/2020"  , B13: "1" , C13: "=WEEKNUM(A13, B13)", 
      A14: "1/5/2020"  , B14: "1" , C14: "=WEEKNUM(A14, B14)", 
      A15: "12/31/2019", B15: "2" , C15: "=WEEKNUM(A15, B15)", 
      A16: "1/1/2020"  , B16: "2" , C16: "=WEEKNUM(A16, B16)", 
      A17: "1/5/2020"  , B17: "2" , C17: "=WEEKNUM(A17, B17)", 
      A18: "1/6/2020"  , B18: "2" , C18: "=WEEKNUM(A18, B18)", 
      A19: "12/31/2019", B19: "11", C19: "=WEEKNUM(A19, B19)", 
      A20: "1/1/2020"  , B20: "11", C20: "=WEEKNUM(A20, B20)", 
      A21: "1/5/2020"  , B21: "11", C21: "=WEEKNUM(A21, B21)", 
      A22: "1/6/2020"  , B22: "11", C22: "=WEEKNUM(A22, B22)", 
      A23: "12/31/2019", B23: "12", C23: "=WEEKNUM(A23, B23)", 
      A24: "1/1/2020"  , B24: "12", C24: "=WEEKNUM(A24, B24)", 
      A25: "1/6/2020"  , B25: "12", C25: "=WEEKNUM(A25, B25)", 
      A26: "1/7/2020"  , B26: "12", C26: "=WEEKNUM(A26, B26)", 
      A27: "12/31/2019", B27: "13", C27: "=WEEKNUM(A27, B27)", 
      A28: "1/1/2020"  , B28: "13", C28: "=WEEKNUM(A28, B28)", 
      A29: "1/7/2020"  , B29: "13", C29: "=WEEKNUM(A29, B29)", 
      A30: "1/8/2020"  , B30: "13", C30: "=WEEKNUM(A30, B30)", 
      A31: "12/31/2019", B31: "14", C31: "=WEEKNUM(A31, B31)", 
      A32: "1/1/2020"  , B32: "14", C32: "=WEEKNUM(A32, B32)", 
      A33: "1/2/2020"  , B33: "14", C33: "=WEEKNUM(A33, B33)", 
      A34: "12/31/2019", B34: "15", C34: "=WEEKNUM(A34, B34)", 
      A35: "1/1/2020"  , B35: "15", C35: "=WEEKNUM(A35, B35)", 
      A36: "1/2/2020"  , B36: "15", C36: "=WEEKNUM(A36, B36)", 
      A37: "1/3/2020"  , B37: "15", C37: "=WEEKNUM(A37, B37)", 
      A38: "12/31/2019", B38: "16", C38: "=WEEKNUM(A38, B38)", 
      A39: "1/1/2020"  , B39: "16", C39: "=WEEKNUM(A39, B39)", 
      A40: "1/3/2020"  , B40: "16", C40: "=WEEKNUM(A40, B40)", 
      A41: "1/4/2020"  , B41: "16", C41: "=WEEKNUM(A41, B41)", 
      A42: "12/31/2019", B42: "17", C42: "=WEEKNUM(A42, B42)", 
      A43: "1/1/2020"  , B43: "17", C43: "=WEEKNUM(A43, B43)", 
      A44: "1/4/2020"  , B44: "17", C44: "=WEEKNUM(A44, B44)", 
      A45: "1/5/2020"  , B45: "17", C45: "=WEEKNUM(A45, B45)", 
      A46: "12/29/2019", B46: "21", C46: "=WEEKNUM(A46, B46)", 
      A47: "12/30/2019", B47: "21", C47: "=WEEKNUM(A47, B47)", 
      A48: "12/31/2019", B48: "21", C48: "=WEEKNUM(A48, B48)", 
      A49: "1/1/2020"  , B49: "21", C49: "=WEEKNUM(A49, B49)", 
      A50: "1/5/2020"  , B50: "21", C50: "=WEEKNUM(A50, B50)", 
      A51: "1/6/2020"  , B51: "21", C51: "=WEEKNUM(A51, B51)", 
      A52: "1/1/2020"  , B52: "18", C52: "=WEEKNUM(A52, B52)", 
      A53: "1/1/2020"  , B53: "0" , C53: "=WEEKNUM(A53, B53)", 
      A54: "1/1/2020"  , B54: "10", C54: "=WEEKNUM(A54, B54)", 
    };
    const gridResult = evaluateGrid(grid);

    expect(gridResult.C11).toBe(53);
    expect(gridResult.C12).toBe(1);
    expect(gridResult.C13).toBe(1);
    expect(gridResult.C14).toBe(2);
    expect(gridResult.C15).toBe(53);
    expect(gridResult.C16).toBe(1);
    expect(gridResult.C17).toBe(1);
    expect(gridResult.C18).toBe(2);
    expect(gridResult.C19).toBe(53);
    expect(gridResult.C20).toBe(1);
    expect(gridResult.C21).toBe(1);
    expect(gridResult.C22).toBe(2);
    expect(gridResult.C23).toBe(53);
    expect(gridResult.C24).toBe(1);
    expect(gridResult.C25).toBe(1);
    expect(gridResult.C26).toBe(2);
    expect(gridResult.C27).toBe(53);
    expect(gridResult.C28).toBe(1);
    expect(gridResult.C29).toBe(1);
    expect(gridResult.C30).toBe(2);
    expect(gridResult.C31).toBe(53);
    expect(gridResult.C32).toBe(1);
    expect(gridResult.C33).toBe(2);
    expect(gridResult.C34).toBe(53);
    expect(gridResult.C35).toBe(1);
    expect(gridResult.C36).toBe(1);
    expect(gridResult.C37).toBe(2);
    expect(gridResult.C38).toBe(53);
    expect(gridResult.C39).toBe(1);
    expect(gridResult.C40).toBe(1);
    expect(gridResult.C41).toBe(2);
    expect(gridResult.C42).toBe(53);
    expect(gridResult.C43).toBe(1);
    expect(gridResult.C44).toBe(1);
    expect(gridResult.C45).toBe(2);
    expect(gridResult.C46).toBe(52);
    expect(gridResult.C47).toBe(1);
    expect(gridResult.C48).toBe(1);
    expect(gridResult.C49).toBe(1);
    expect(gridResult.C50).toBe(1);
    expect(gridResult.C51).toBe(2);
    expect(gridResult.C52).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.C53).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.C54).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
  });

  //----------------------------------------------------------------------------
  // WORKDAY
  //----------------------------------------------------------------------------

  test("WORKDAY: functional tests on cell arguments", () => {
    // prettier-ignore
    const grid = {
      A1: "1/1/2013" , A2: "1/21/2013", A3: "2/18/2013", A4: "5/27/2013",
      A5: "1/21/2013", A6: "1/12/2013", A7: "1/2/2013" , A8: "12/31/2012",
    
      A11: "1/1/2013", B11: "3"  , C11: "=WORKDAY(A11, B11)",
      A12: "1/1/2013", B12: "3"  , C12: "=WORKDAY(A12, B12, A1)",
      A13: "1/1/2013", B13: "3"  , C13: '=WORKDAY(A13, B13, A7)',
      A14: "3/1/2013", B14: "120", C14: "=WORKDAY(A14, B14)",
      A15: "3/1/2013", B15: "120", C15: "=WORKDAY(A15, B15,A1: A6)",
      A16: "2/1/2013", B16: "22" , C16: "=WORKDAY(A16, B16)",
      A17: "1/1/2013", B17: "-3" , C17: "=WORKDAY(A17, B17)",
      A18: "1/1/2013", B18: "-3" , C18: "=WORKDAY(A18, B18, A1)",
      A19: "1/1/2013", B19: "-3" , C19: "=WORKDAY(A19, B19, A8)",
    };
    const gridResult = evaluateGrid(grid);

    expect(gridResult.C11).toEqual(parseDate("1/4/2013"));
    expect(gridResult.C12).toEqual(parseDate("1/4/2013"));
    expect(gridResult.C13).toEqual(parseDate("1/7/2013"));
    expect(gridResult.C14).toEqual(parseDate("8/16/2013"));
    expect(gridResult.C15).toEqual(parseDate("8/19/2013"));
    expect(gridResult.C16).toEqual(parseDate("3/5/2013"));
    expect(gridResult.C17).toEqual(parseDate("12/27/2012"));
    expect(gridResult.C18).toEqual(parseDate("12/27/2012"));
    expect(gridResult.C19).toEqual(parseDate("12/26/2012"));
  });

  //----------------------------------------------------------------------------
  // WORKDAY.INTL
  //----------------------------------------------------------------------------
  test("WORKDAY.INTL: functional tests on cell arguments, string method", () => {
    // prettier-ignore
    const grid = {
      B2:  "5/4/2020", C2:  "4", D2:  '=WORKDAY.INTL(B2,  C2)', 
      B3:  "5/4/2020", C3:  "4", D3:  '=WORKDAY.INTL(B3,  C3,  "0")', 
      B4:  "5/4/2020", C4:  "4", D4:  '=WORKDAY.INTL(B4,  C4,  "00")',
      B5:  "5/4/2020", C5:  "4", D5:  '=WORKDAY.INTL(B5,  C5,  "000000")',
      B6:  "5/4/2020", C6:  "4", D6:  '=WORKDAY.INTL(B6,  C6,  "0000000")', 
      B7:  "5/4/2020", C7:  "4", D7:  '=WORKDAY.INTL(B7,  C7,  "0000011")',
      B8:  "5/4/2020", C8:  "4", D8:  '=WORKDAY.INTL(B8,  C8,  "0000111")',
      B9:  "5/4/2020", C9:  "4", D9:  '=WORKDAY.INTL(B9,  C9,  "1000111")',
      B10: "5/4/2020", C10: "4", D10: '=WORKDAY.INTL(B10, C10, "1110111")', 
      B11: "5/4/2020", C11: "4", D11: '=WORKDAY.INTL(B11, C11, "1111111")', 
      B12: "5/4/2020", C12: "4", D12: '=WORKDAY.INTL(B12, C12, "1000211")', 
                       C13: "4", D13: '=WORKDAY.INTL(B13, C13, "0000000")', 
      B14: "5/4/2020",           D14: '=WORKDAY.INTL(B14, C14, "0000000")', 
    
      B75: "5/4/2020", C75: "7" , D75: '=WORKDAY.INTL(B75, C75, "0000000")',
      B76: "5/4/2020", C76: "-3", D76: '=WORKDAY.INTL(B76, C76, "0000011")',
      B77: "5/9/2020", C77: "1" , D77: '=WORKDAY.INTL(B77, C77, "0000011")',
      B78: "5/4/2020", C78: "-4", D78: '=WORKDAY.INTL(B78, C78, "0000111")',
      B79: "5/8/2020", C79: "5" , D79: '=WORKDAY.INTL(B79, C79, "0000111")',
      B80: "5/5/2020", C80: "-4", D80: '=WORKDAY.INTL(B80, C80, "1000111")',
      B81: "5/8/2020", C81: "1" , D81: '=WORKDAY.INTL(B81, C81, "1000111")',
      B82: "5/7/2020", C82: "-4", D82: '=WORKDAY.INTL(B82, C82, "1110111")',
      B83: "5/8/2020", C83: "4" , D83: '=WORKDAY.INTL(B83, C83, "1110111")',
    };

    const gridResult = evaluateGrid(grid);
    expect(gridResult.D2).toEqual(parseDate("5/8/2020")); // @compatibility on Google Sheets, return  #VALUE!
    expect(gridResult.D3).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D4).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D5).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D6).toEqual(parseDate("5/8/2020"));
    expect(gridResult.D7).toEqual(parseDate("5/8/2020"));
    expect(gridResult.D8).toEqual(parseDate("5/11/2020"));
    expect(gridResult.D9).toEqual(parseDate("5/12/2020"));
    expect(gridResult.D10).toEqual(parseDate("5/28/2020"));
    expect(gridResult.D11).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D12).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D13).toEqual(parseDate("1/3/1900"));
    expect(gridResult.D14).toEqual(parseDate("5/4/2020"));

    expect(gridResult.D75).toEqual(parseDate("5/11/2020"));
    expect(gridResult.D76).toEqual(parseDate("4/29/2020"));
    expect(gridResult.D77).toEqual(parseDate("5/11/2020"));
    expect(gridResult.D78).toEqual(parseDate("4/27/2020"));
    expect(gridResult.D79).toEqual(parseDate("5/18/2020"));
    expect(gridResult.D80).toEqual(parseDate("4/23/2020"));
    expect(gridResult.D81).toEqual(parseDate("5/12/2020"));
    expect(gridResult.D82).toEqual(parseDate("4/9/2020"));
    expect(gridResult.D83).toEqual(parseDate("6/4/2020"));
  });

  test("WORKDAY.INTL: functional tests on cell arguments, number method", () => {
    // prettier-ignore
    const grid = {
      B18: "5/4/2020",  C18: "1", D18: '=WORKDAY.INTL(B18, C18, 0)',
      B19: "5/9/2020",  C19: "1", D19: '=WORKDAY.INTL(B19, C19, 1)',
      B20: "5/10/2020", C20: "1", D20: '=WORKDAY.INTL(B20, C20, 1)',
      B21: "5/10/2020", C21: "1", D21: '=WORKDAY.INTL(B21, C21, 2)',
      B22: "5/11/2020", C22: "1", D22: '=WORKDAY.INTL(B22, C22, 2)',
      B23: "5/11/2020", C23: "1", D23: '=WORKDAY.INTL(B23, C23, 3)',
      B24: "5/12/2020", C24: "1", D24: '=WORKDAY.INTL(B24, C24, 3)',
      B25: "5/12/2020", C25: "1", D25: '=WORKDAY.INTL(B25, C25, 4)',
      B26: "5/13/2020", C26: "1", D26: '=WORKDAY.INTL(B26, C26, 4)',
      B27: "5/13/2020", C27: "1", D27: '=WORKDAY.INTL(B27, C27, 5)',
      B28: "5/14/2020", C28: "1", D28: '=WORKDAY.INTL(B28, C28, 5)',
      B29: "5/14/2020", C29: "1", D29: '=WORKDAY.INTL(B29, C29, 6)',
      B30: "5/15/2020", C30: "1", D30: '=WORKDAY.INTL(B30, C30, 6)',
      B31: "5/15/2020", C31: "1", D31: '=WORKDAY.INTL(B31, C31, 7)',
      B32: "5/16/2020", C32: "1", D32: '=WORKDAY.INTL(B32, C32, 7)',
      B33: "5/16/2020", C33: "1", D33: '=WORKDAY.INTL(B33, C33, 8)',

      B39: "5/4/2020",  C39: "1", D39: '=WORKDAY.INTL(B39, C39, 10)',
      B40: "5/9/2020",  C40: "1", D40: '=WORKDAY.INTL(B40, C40, 11)',
      B41: "5/10/2020", C41: "1", D41: '=WORKDAY.INTL(B41, C41, 11)',
      B42: "5/10/2020", C42: "1", D42: '=WORKDAY.INTL(B42, C42, 12)',
      B43: "5/11/2020", C43: "1", D43: '=WORKDAY.INTL(B43, C43, 12)',
      B44: "5/11/2020", C44: "1", D44: '=WORKDAY.INTL(B44, C44, 13)',
      B45: "5/12/2020", C45: "1", D45: '=WORKDAY.INTL(B45, C45, 13)',
      B46: "5/12/2020", C46: "1", D46: '=WORKDAY.INTL(B46, C46, 14)',
      B47: "5/13/2020", C47: "1", D47: '=WORKDAY.INTL(B47, C47, 14)',
      B48: "5/13/2020", C48: "1", D48: '=WORKDAY.INTL(B48, C48, 15)',
      B49: "5/14/2020", C49: "1", D49: '=WORKDAY.INTL(B49, C49, 15)',
      B50: "5/14/2020", C50: "1", D50: '=WORKDAY.INTL(B50, C50, 16)',
      B51: "5/15/2020", C51: "1", D51: '=WORKDAY.INTL(B51, C51, 16)',
      B52: "5/15/2020", C52: "1", D52: '=WORKDAY.INTL(B52, C52, 17)',
      B53: "5/16/2020", C53: "1", D53: '=WORKDAY.INTL(B53, C53, 17)',
      B54: "5/16/2020", C54: "1", D54: '=WORKDAY.INTL(B54, C54, 18)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.D18).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D19).toEqual(parseDate("5/11/2020"));
    expect(gridResult.D20).toEqual(parseDate("5/11/2020"));
    expect(gridResult.D21).toEqual(parseDate("5/12/2020"));
    expect(gridResult.D22).toEqual(parseDate("5/12/2020"));
    expect(gridResult.D23).toEqual(parseDate("5/13/2020"));
    expect(gridResult.D24).toEqual(parseDate("5/13/2020"));
    expect(gridResult.D25).toEqual(parseDate("5/14/2020"));
    expect(gridResult.D26).toEqual(parseDate("5/14/2020"));
    expect(gridResult.D27).toEqual(parseDate("5/15/2020"));
    expect(gridResult.D28).toEqual(parseDate("5/15/2020"));
    expect(gridResult.D29).toEqual(parseDate("5/16/2020"));
    expect(gridResult.D30).toEqual(parseDate("5/16/2020"));
    expect(gridResult.D31).toEqual(parseDate("5/17/2020"));
    expect(gridResult.D32).toEqual(parseDate("5/17/2020"));
    expect(gridResult.D33).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!

    expect(gridResult.D39).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D40).toEqual(parseDate("5/11/2020"));
    expect(gridResult.D41).toEqual(parseDate("5/11/2020"));
    expect(gridResult.D42).toEqual(parseDate("5/12/2020"));
    expect(gridResult.D43).toEqual(parseDate("5/12/2020"));
    expect(gridResult.D44).toEqual(parseDate("5/13/2020"));
    expect(gridResult.D45).toEqual(parseDate("5/13/2020"));
    expect(gridResult.D46).toEqual(parseDate("5/14/2020"));
    expect(gridResult.D47).toEqual(parseDate("5/14/2020"));
    expect(gridResult.D48).toEqual(parseDate("5/15/2020"));
    expect(gridResult.D49).toEqual(parseDate("5/15/2020"));
    expect(gridResult.D50).toEqual(parseDate("5/16/2020"));
    expect(gridResult.D51).toEqual(parseDate("5/16/2020"));
    expect(gridResult.D52).toEqual(parseDate("5/17/2020"));
    expect(gridResult.D53).toEqual(parseDate("5/17/2020"));
    expect(gridResult.D54).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
  });

  test("WORKDAY.INTL: casting tests on cell arguments", () => {
    // prettier-ignore
    const grid = {
      B68: "5/4/2020",  C68: "1", D68: '=WORKDAY.INTL(B68, C68, 1110111)',
      B69: "5/5/2020",  C69: "1", D69: '=WORKDAY.INTL(B69, C69, "test")',
      B70: "5/11/2020", C70: "1", D70: '=WORKDAY.INTL(B70, C70, "2")',
      B71: "5/11/2020", C71: "1", D71: '=WORKDAY.INTL(B71, C71, A71)',
      B72: "5/11/2020", C72: "1", D72: '=WORKDAY.INTL(B72, C72)',
    };
    const gridResult = evaluateGrid(grid);
    expect(gridResult.D68).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D69).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D70).toBe("#ERROR"); // @compatibility on Google Sheets, return  #NUM!
    expect(gridResult.D71).toBe("#ERROR"); // @compatibility on Google Sheets, return  #VALUE!
    expect(gridResult.D72).toEqual(parseDate("5/12/2020"));
  });

  //----------------------------------------------------------------------------
  // YEAR
  //----------------------------------------------------------------------------

  test("YEAR: functional tests on cell arguments", () => {
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: "5/13/1950" })).toBe(1950);
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: "5/13/2020" })).toBe(2020);
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: "43964" })).toBe(2020); // 43964 corespond to 5/13/2020
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: "0" })).toBe(1899); // 0 corespond to 12/30/1899
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: "1" })).toBe(1899); // 1 corespond to 12/31/1899
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: "2" })).toBe(1900); // 2 corespond to 1/1/1900
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: '="43964"' })).toBe(2020);
    expect(evaluateCell("A1", { A1: "=YEAR(A2)", A2: "TRUE" })).toBe(1899);
  });
});
