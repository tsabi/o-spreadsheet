import { Color } from "../../types";
import { XLSXColor } from "../../types/xlsx";
import { AUTO_COLOR, XLSX_INDEXED_COLORS } from "../constants";

/**
 * Most of the functions could stay private, but are exported for testing purposes
 */

export interface RGBA {
  a: number;
  r: number;
  g: number;
  b: number;
}

export interface HSLA {
  a: number;
  h: number;
  s: number;
  l: number;
}

/**
 *
 * Extract the color referenced inside of an XML element and return it as an hex string #RRGGBBAA (or #RRGGBB
 * if alpha = FF)
 *
 *  The color is an attribute of the element that can be :
 *  - rgb : an rgb string
 *  - theme : a reference to a theme element
 *  - auto : automatic coloring. Return const AUTO_COLOR in constants.ts.
 *  - indexed : a legacy indexing scheme for colors. The only value that should be present in a xlsx is
 *      64 = System Foreground, that we can replace with AUTO_COLOR.
 */
export function convertColor(xlsxColor: XLSXColor | undefined): Color | undefined {
  if (!xlsxColor) {
    return undefined;
  }
  let rgb: string;
  if (xlsxColor.rgb) {
    rgb = xlsxColor.rgb;
  } else if (xlsxColor.auto) {
    rgb = AUTO_COLOR;
  } else if (xlsxColor.indexed) {
    rgb = XLSX_INDEXED_COLORS[xlsxColor.indexed];
  } else {
    return undefined;
  }

  rgb = xlsxColorToRGBA(rgb);

  if (xlsxColor.tint) {
    rgb = applyTint(rgb, xlsxColor.tint);
  }
  rgb = rgb.toUpperCase();

  // Remve unnecessary alpha
  if (rgb.length === 9 && rgb.endsWith("FF")) {
    rgb = rgb.slice(0, 7);
  }
  return rgb;
}

/**
 * Convert a hex color AARRGGBB (or RRGGBB)(representation inside XLSX Xmls) to a standard js color
 * representation #RRGGBBAA
 */
function xlsxColorToRGBA(color: Color): Color {
  if (color.length === 6) return "#" + color + "FF";
  return "#" + color.slice(2) + color.slice(0, 2);
}

/**
 *  Apply tint to a color (see OpenXml spec §18.3.1.15);
 */
export function applyTint(color: Color, tint: number): Color {
  const rgba = hexToRGBA(color);
  const hsla = rgbaToHSLA(rgba);

  if (tint < 0) {
    hsla.l = hsla.l * (1 + tint);
  }
  if (tint > 0) {
    hsla.l = hsla.l * (1 - tint) + (100 - 100 * (1 - tint));
  }

  return rgbaToHex(hslaToRGBA(hsla));
}

/**
 * RGBA to HEX representation (#RRGGBBAA).
 *
 * https://css-tricks.com/converting-color-spaces-in-javascript/
 */
export function rgbaToHex(rgba: RGBA): Color {
  let r = rgba.r.toString(16);
  let g = rgba.g.toString(16);
  let b = rgba.b.toString(16);
  let a = Math.round(rgba.a * 255).toString(16);

  if (r.length == 1) r = "0" + r;
  if (g.length == 1) g = "0" + g;
  if (b.length == 1) b = "0" + b;
  if (a.length == 1) a = "0" + a;

  return "#" + r + g + b + a;
}

/**
 * HEX (#RRGGBBAA or #RRGGBB) string to RGBA representation
 */
export function hexToRGBA(hex: Color): RGBA {
  let r: number;
  let g: number;
  let b: number;
  let a: number;

  if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
    a = 255;
  } else {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
    a = parseInt(hex[7] + hex[8], 16);
  }
  a = +(a / 255).toFixed(3);

  return { a, r, g, b };
}

/**
 * HSLA to RGBA.
 *
 * https://css-tricks.com/converting-color-spaces-in-javascript/
 */
export function hslaToRGBA(hsla: HSLA): RGBA {
  // Must be fractions of 1
  hsla.s /= 100;
  hsla.l /= 100;

  let c = (1 - Math.abs(2 * hsla.l - 1)) * hsla.s;
  let x = c * (1 - Math.abs(((hsla.h / 60) % 2) - 1));
  let m = hsla.l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= hsla.h && hsla.h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (60 <= hsla.h && hsla.h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (120 <= hsla.h && hsla.h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (180 <= hsla.h && hsla.h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (240 <= hsla.h && hsla.h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (300 <= hsla.h && hsla.h < 360) {
    r = c;
    g = 0;
    b = x;
  }
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return { a: hsla.a, r, g, b };
}

/**
 * HSLA to RGBA.
 *
 * https://css-tricks.com/converting-color-spaces-in-javascript/
 */
export function rgbaToHSLA(rgba: RGBA): HSLA {
  // Make r, g, and b fractions of 1
  const r = rgba.r / 255;
  const g = rgba.g / 255;
  const b = rgba.b / 255;

  // Find greatest and smallest channel values
  let cmin = Math.min(r, g, b);
  let cmax = Math.max(r, g, b);
  let delta = cmax - cmin;
  let h = 0;
  let s = 0;
  let l = 0;

  // Calculate hue
  // No difference
  if (delta == 0) h = 0;
  // Red is max
  else if (cmax == r) h = ((g - b) / delta) % 6;
  // Green is max
  else if (cmax == g) h = (b - r) / delta + 2;
  // Blue is max
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);

  // Make negative hues positive behind 360°
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;

  // Calculate saturation
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  // Multiply l and s by 100
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return { a: rgba.a, h, s, l };
}

/**
 * Convert a rgba color string to an integer representation. Also remove the alpha.
 *
 * eg. #FF0000FF => 4278190335
 */
export function rgbaToInt(rgba: Color) {
  if (rgba.length === 9) {
    rgba = rgba.slice(0, 7);
  }
  return parseInt(rgba.replace("#", ""), 16);
}
