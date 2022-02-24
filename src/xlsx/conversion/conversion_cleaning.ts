import { deepEquals, removeFalslyAttributes, stringify } from "../../helpers";
import { WorkbookData } from "./../../types/workbook_data";

/**
 * Remove duplicates styles in the WorkbookData and also remove undefined/false elements in the styles objects.
 * This will make a pass on the cells of the sheet to update the style index with the new index.
 *
 * Is necessary because in the Xlsx, the style also contains the borders and num formats, but our styles don't,
 * which leave us with a lot of duplicate styles.
 */
export function cleanImportedStyles(data: WorkbookData) {
  const { newMap: styles, conversionMap } = cleanMap(data.styles);

  for (let sheet of data.sheets) {
    for (let cell of Object.values(sheet.cells)) {
      if (cell?.style) {
        cell.style = conversionMap[cell.style];
      }
    }
  }

  Object.keys(styles).map((key) => {
    styles[key] = removeFalslyAttributes(styles[key]);
  });

  data.styles = styles;
}

/**
 * Remove duplicates borders in the WorkbookData.
 * This will make a pass on the cells of the sheet to update the borders index with the new index.
 *
 * Duplicates borders may happen for borders styles that we don't support and that are replaced by another style
 */
export function cleanImportedBorders(data: WorkbookData) {
  const { newMap: borders, conversionMap } = cleanMap(data.borders);

  for (let sheet of data.sheets) {
    for (let cell of Object.values(sheet.cells)) {
      if (cell?.border) {
        cell.border = conversionMap[cell.border];
      }
    }
  }

  data.borders = borders;
}

/**
 * Remove duplicates formats in the WorkbookData.
 * This will make a pass on the cells of the sheet to update the format index with the new index.
 *
 * Duplicates formats may happen for formats that we don't support and that are replaced by another format.
 */
export function cleanFormats(data: WorkbookData) {
  const { newMap: formats, conversionMap } = cleanMap(data.formats);

  for (let sheet of data.sheets) {
    for (let cell of Object.values(sheet.cells)) {
      if (cell?.format) {
        cell.format = conversionMap[cell.format];
      }
    }
  }
  data.formats = formats;
}

/**
 * Removes the duplicates and the undefined values in a map <key :number, Object>.
 *
 * Returns the map without the duplicates and a map to convert the keys of the old map to keys of the new map.
 */
function cleanMap<T>(objectMap: Record<number, T>): {
  newMap: Record<number, T>;
  conversionMap: Record<number, number>;
} {
  const uniquesJsons = new Set<string>();
  const indexesMap: Record<number, number> = {};
  const newObjs: Record<number, T> = {};

  for (let [key, obj] of Object.entries(objectMap)) {
    const objJson = stringify(obj);
    if (!uniquesJsons.has(objJson)) {
      uniquesJsons.add(objJson);
      const newKey = uniquesJsons.size;
      newObjs[newKey] = obj;
      indexesMap[key] = newKey;
    } else {
      const uniqueObjKey = Object.keys(newObjs).find((k) => deepEquals(newObjs[k], obj));
      indexesMap[key] = Number(uniqueObjKey);
    }
  }

  return { newMap: newObjs, conversionMap: indexesMap };
}
