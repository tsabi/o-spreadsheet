import {
  hexToRGBA,
  HSLA,
  hslaToRGBA,
  RGBA,
  rgbaToHex,
  rgbaToHSLA,
} from "../../src/xlsx/conversion/color_conversion";

const testcolors = [
  ["#000000", { a: 1, r: 0, g: 0, b: 0 }, { a: 1, h: 0, s: 0, l: 0 }],
  ["#FF0000FF", { a: 1, r: 255, g: 0, b: 0 }, { a: 1, h: 0, s: 100, l: 50 }],
  ["#1d51a333", { a: 0.2, r: 29, g: 81, b: 163 }, { a: 0.2, h: 217, s: 69.8, l: 37.6 }],
];

function areARGBEqualWithRounding(c1: RGBA, c2: RGBA) {
  if (Math.abs(c1.a * 255 - c2.a * 255) > 1) return false;
  if (Math.abs(c1.r - c2.r) > 1) return false;
  if (Math.abs(c1.g - c2.g) > 1) return false;
  if (Math.abs(c1.b - c2.b) > 1) return false;
  return true;
}

function areAHSLEqualWithRounding(c1: HSLA, c2: HSLA) {
  if (Math.abs(c1.a * 255 - c2.a * 255) > 1) return false;
  if (Math.abs(c1.h - c2.h) > 1) return false;
  if (Math.abs(c1.s - c2.s) > 1) return false;
  if (Math.abs(c1.l - c2.l) > 1) return false;

  return true;
}

describe("hexToARGB", () => {
  test.each(testcolors)("basic functionality", (hex: string, argb: RGBA) => {
    expect(hexToRGBA(hex)).toEqual(argb);
  });
});

describe("argbToHex", () => {
  test.each(testcolors)("basic functionality", (hex: string, argb: RGBA) => {
    if (hex.length === 7) {
      hex += "FF";
    }
    expect(rgbaToHex(argb).toLowerCase()).toEqual(hex.toLowerCase());
  });
});

describe("argbToAHSL", () => {
  test.each(testcolors)("basic functionality", (_, argb: RGBA, ahsl: HSLA) => {
    expect(areAHSLEqualWithRounding(rgbaToHSLA(argb), ahsl)).toBeTruthy();
  });
});

describe("ahslToARGB", () => {
  test.each(testcolors)("basic functionality", (_, argb: RGBA, ahsl: HSLA) => {
    expect(areARGBEqualWithRounding(hslaToRGBA(ahsl), argb)).toBeTruthy();
  });
});
