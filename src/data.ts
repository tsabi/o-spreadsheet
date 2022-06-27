import { uuidv4 } from "./helpers/index";
import { SheetData, Workbook, WorkbookData } from "./types/index";

/**
 * This is the current state version number. It should be incremented each time
 * a breaking change is made in the way the state is handled, and an upgrade
 * function should be defined
 */
export const CURRENT_VERSION = 5;

/**
 * This function tries to load anything that could look like a valid
 * workbookData object. It applies any migrations, if needed, and return a
 * current, complete workbookData object.
 *
 * It also ensures that there is at least one sheet.
 */
export function load(data?: any): WorkbookData {
  if (!data) {
    return createEmptyWorkbookData();
  }
  data = Object.assign({}, data);

  // apply migrations, if needed
  if ("version" in data) {
    if (data.version < CURRENT_VERSION) {
      data = migrate(data);
    }
  }

  // sanity check: try to fix missing fields/corrupted state by providing
  // sensible default values
  data = Object.assign(createEmptyWorkbookData(), data, { version: CURRENT_VERSION });
  data.sheets = data.sheets.map((s, i) => Object.assign(createEmptySheet(`Sheet${i + 1}`), s));
  if (!data.sheets.map((s) => s.id).includes(data.activeSheet)) {
    data.activeSheet = data.sheets[0].id;
  }

  if (data.sheets.length === 0) {
    data.sheets.push(createEmptySheet());
  }
  return data;
}

// -----------------------------------------------------------------------------
// Migrations
// -----------------------------------------------------------------------------

interface Migration {
  from: number;
  to: number;
  applyMigration(data: any): any;
  description: string;
}

function migrate(data: any): WorkbookData {
  const index = MIGRATIONS.findIndex((m) => m.from === data.version);
  for (let i = index; i < MIGRATIONS.length; i++) {
    data = MIGRATIONS[i].applyMigration(data);
  }
  return data;
}

const MIGRATIONS: Migration[] = [
  {
    description: "add the `activeSheet` field on data",
    from: 1,
    to: 2,
    applyMigration(data: any): any {
      if (data.sheets && data.sheets[0]) {
        data.activeSheet = data.sheets[0].name;
      }
      return data;
    },
  },
  {
    description: "add an id field in each sheet",
    from: 2,
    to: 3,
    applyMigration(data: any): any {
      if (data.sheets && data.sheets.length) {
        for (let sheet of data.sheets) {
          sheet.id = sheet.id || sheet.name;
        }
      }
      return data;
    },
  },
  {
    description: "activeSheet is now an id, not the name of a sheet",
    from: 3,
    to: 4,
    applyMigration(data: any): any {
      const activeSheet = data.sheets.find((s) => s.name === data.activeSheet);
      data.activeSheet = activeSheet.id;
      return data;
    },
  },
  {
    description: "add figures object in each sheets",
    from: 4,
    to: 5,
    applyMigration(data: any): any {
      for (let sheet of data.sheets) {
        sheet.figures = sheet.figures || [];
      }
      return data;
    },
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function createEmptySheet(name: string = "Sheet1"): SheetData {
  return {
    id: uuidv4(),
    name,
    colNumber: 26,
    rowNumber: 100,
    cells: {},
    cols: {},
    rows: {},
    merges: [],
    conditionalFormats: [],
    figures: [],
  };
}

export function createEmptyWorkbookData(): WorkbookData {
  const data = {
    version: CURRENT_VERSION,
    sheets: [createEmptySheet("Sheet1")],
    activeSheet: "",
    entities: {},
    styles: {},
    borders: {},
  };
  data.activeSheet = data.sheets[0].id;
  return data;
}

export function createEmptyWorkbook(): Workbook {
  return {
    visibleSheets: [],
    sheets: {},
    activeSheet: null as any,
  };
}