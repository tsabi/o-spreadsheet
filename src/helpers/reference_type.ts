// Helper file for the reference types in Xcs (the $ symbol, eg. A$1)

type ReferenceType = "col" | "row" | "colrow" | "none";

// superRegexQuiChopeTouteLesRefDansUnStringTavu
const reg = new RegExp(
  /^(?:\s*\w*!)\$?[A-Z]{1,3}\$?[0-9]{1,7}\s*(\s*:\s*\$?[A-Z]{1,3}\$?[0-9]{1,7}\s*)?/,
  "ig"
);

/** some stuff */
export function loopReference(reference: string): string {
  const extremities = reference.split(":");
  const update = extremities.map((ref) => {
    switch (getReferenceType(ref)) {
      case "none":
        return setXcToReferenceType(ref, "colrow");
      case "colrow":
        return setXcToReferenceType(ref, "row");
      case "row":
        return setXcToReferenceType(ref, "col");
      case "col":
        return setXcToReferenceType(ref, "none");
    }
  });
  return update.join(":");
}

/**
 * Change the reference types inside the given token, if the token represent a range or a cell
 *
 * Eg. :
 *   A1 => $A$1 => A$1 => $A1 => A1
 *   A1:$B$1 => $A$1:B$1 => A$1:$B1 => $A1:B1 => A1:$B$1
 */
export function loopThroughReferenceType(text: string) {
  return text.replace(reg, loopReference);
}

/**
 * Returns the given XC with the given reference type.
 */
// detect and replace differently ?
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

function isColFixed(xc: string) {
  return xc.startsWith("$");
}

function isRowFixed(xc: string) {
  return !xc.startsWith("$") && xc.includes("$");
}

function isColAndRowFixed(xc: string) {
  return xc.startsWith("$") && xc.length > 1 && xc.slice(1).includes("$");
}
