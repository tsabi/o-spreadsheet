// Helper file for the reference types in Xcs (the $ symbol, eg. A$1)
import { Token, tokenize } from "../formulas";
import { rangeReference, singleCellReference } from "./references";

type ReferenceType = "col" | "row" | "colrow" | "none";

/**
 * Change the reference types inside the given token, if the token represent a range or a cell
 *
 * Eg. :
 *   A1 => $A$1 => A$1 => $A1 => A1
 *   A1:$B$1 => $A$1:B$1 => A$1:$B1 => $A1:B1 => A1:$B$1
 */
export function loopThroughReferenceType(token: Readonly<Token>): Token {
  if (!(singleCellReference.test(token.value) || rangeReference.test(token.value))) return token;

  // Tokenise to split ranges into 2 cell symbols
  let cellTokens = tokenize(token.value).filter((token) => token.type === "SYMBOL");
  if (!cellTokens) return token;
  cellTokens[0] = removeTokenSheetReference(cellTokens[0]);

  const updatedTokens = cellTokens.map((token) => getTokenNextReferenceType(token));
  if (updatedTokens.length === 1) {
    return {
      ...token,
      value: getTokenSheetReference(token) + updatedTokens[0].value,
    };
  } else if (updatedTokens.length === 2) {
    return {
      ...token,
      value: getTokenSheetReference(token) + updatedTokens[0].value + ":" + updatedTokens[1].value,
    };
  }
  return token;
}

/**
 * Get a new token with a changed type of reference from the given cell token symbol.
 * Undefined behavior if given a token other than a cell or if the Xc contains a sheet reference
 *
 * A1 => $A$1 => A$1 => $A1 => A1
 */
function getTokenNextReferenceType(cellToken: Token): Token {
  const newToken = { ...cellToken };
  switch (getReferenceType(cellToken.value)) {
    case "none":
      newToken.value = setXcToReferenceType(cellToken.value, "colrow");
      break;
    case "colrow":
      newToken.value = setXcToReferenceType(cellToken.value, "row");
      break;
    case "row":
      newToken.value = setXcToReferenceType(cellToken.value, "col");
      break;
    case "col":
      newToken.value = setXcToReferenceType(cellToken.value, "none");
      break;
  }
  return newToken;
}

/**
 * Returns the given XC with the given reference type.
 */
function setXcToReferenceType(xc: string, referenceType: ReferenceType): string {
  xc = xc.replace(/\$/g, "");
  let indexOfNumber: number;
  switch (referenceType) {
    case "col":
      return "$" + xc;
    case "row":
      indexOfNumber = xc.search(/[0-9]/);
      return xc.slice(0, indexOfNumber) + "$" + xc.slice(indexOfNumber);
      break;
    case "colrow":
      indexOfNumber = xc.search(/[0-9]/);
      xc = xc.slice(0, indexOfNumber) + "$" + xc.slice(indexOfNumber);
      return "$" + xc;
    case "none":
      return xc;
  }
}

/**
 * Return the type of reference used in the given XC of a cell.
 * Undefined behavior if the XC have a sheet reference
 */
function getReferenceType(xcCell: string): ReferenceType {
  if (isColAndRowFixed(xcCell)) {
    return "colrow";
  } else if (isColFixed(xcCell)) {
    return "col";
  } else if (isRowFixed(xcCell)) {
    return "row";
  }
  return "none";
}

/**
 * Get the string that represent the reference to another sheet in the given cell/range token
 * or an empty string if there is no sheet reference
 *
 * eg. : token(Sheet2!A1) => "Sheet2!"
 */
function getTokenSheetReference(token: Token): string {
  const splits = token.value.split("!");
  return splits.length === 1 ? "" : splits[0] + "!";
}

/**
 * Remove the string that represent the reference to another sheet in the given cell/range token
 *
 * eg. : token(Sheet2!A1) => token(A1)
 */
function removeTokenSheetReference(token: Token): Token {
  const splits = token.value.split("!");
  const newValue = splits.length === 1 ? token.value : splits[1];
  return { ...token, value: newValue };
}

function isColFixed(xc: string) {
  return xc.startsWith("$");
}

function isRowFixed(xc: string) {
  return !xc.startsWith("$") && xc.includes("$");
}

function isColAndRowFixed(xc: string) {
  return xc.startsWith("$") && xc.length > 1 && xc.slice(1).includes("$");
}
