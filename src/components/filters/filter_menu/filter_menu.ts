import { Component, useState } from "@odoo/owl";
import {
  MENU_ITEM_HEIGHT,
  MENU_SEPARATOR_BORDER_WIDTH,
  MENU_SEPARATOR_PADDING,
  MENU_WIDTH,
} from "../../../constants";
import { fuzzyLookup, isDefined, positions } from "../../../helpers";
import { FullMenuItem } from "../../../registries";
import { SortDirection, SpreadsheetChildEnv } from "../../../types";
import { css } from "../../helpers/css";

const CSS = css/* scss */ `
  .o-filter-menu {
    box-sizing: border-box;
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    max-height: 300px;
    background: #fff;

    .o-filter-menu-item {
      display: flex;
      justify-content: space-between;
      box-sizing: border-box;
      height: ${MENU_ITEM_HEIGHT}px;
      padding: 4px 16px;
      overflow: visible;
      cursor: pointer;
      user-select: none;
      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
    }

    .o-separator {
      border-bottom: ${MENU_SEPARATOR_BORDER_WIDTH}px solid #e0e2e4;
      margin-top: ${MENU_SEPARATOR_PADDING}px;
      margin-bottom: ${MENU_SEPARATOR_PADDING}px;
    }

    input {
      margin-bottom: 5px;
    }

    .o-filter-menu-actions {
      display: flex;
      flex-direction: row;
      margin-bottom: 4px;

      .o-filter-menu-action-text {
        cursor: pointer;
        margin-right: 10px;
        color: blue;
        text-decoration: underline;
      }
    }

    .o-filter-menu-list {
      display: flex;
      flex-direction: column;
      max-height: 150px;
      overflow-y: auto;
    }

    .o-filter-menu-value {
      div:first-child {
        width: 20px;
        text-align: center;
      }

      .o-filter-menu-value-text {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .o-filter-menu-buttons {
      display: flex;
      justify-content: flex-end;

      .o-filter-menu-button {
        border: 1px solid lightgrey;
        padding: 6px 10px;
        cursor: pointer;
        border-radius: 4px;
        font-weight: 500;
        line-height: 16px;
        background: white;
        &:hover {
          background-color: rgba(0, 0, 0, 0.08);
        }
      }

      .o-filter-menu-button-primary {
        background-color: #188038;
        &:hover {
          background-color: #1d9641;
        }
        color: white;
        font-weight: bold;
      }

      .o-filter-menu-button:last-child {
        margin-left: 10px;
      }
    }
  }
`;

interface Props {
  menuItem: FullMenuItem;
  onClosed: () => void;
}

interface Value {
  checked: boolean;
  string: string;
}

interface State {
  values: Value[];
  textFilter: string;
}

export class FilterMenuItem extends Component<Props, SpreadsheetChildEnv> {
  static componentSize = { width: MENU_WIDTH, height: 300 };

  static template = "o-spreadsheet.FilterMenuItem";
  static style = CSS;

  private state: State | undefined;

  setup() {
    const sheetId = this.env.model.getters.getActiveSheetId();
    const filter = this.filter;
    if (!filter) {
      this.state = useState({ values: [], textFilter: "" });
      return;
    }
    const cellValues = positions(filter.filteredZone)
      .filter(({ row }) => !this.env.model.getters.isRowHidden(sheetId, row))
      .map(({ col, row }) => this.env.model.getters.getCell(sheetId, col, row)?.formattedValue);

    const values = [...new Set([...cellValues, ...filter.filteredValues])].sort().map((val) => {
      const string = val !== undefined ? String(val) : "";
      return { string, checked: !filter.filteredValues.includes(string) };
    });

    this.state = useState({ values, textFilter: "" });
  }

  selectVal(value: Value) {
    value.checked = !value.checked;
  }

  selectAll() {
    this.state?.values.map((value) => (value.checked = true));
  }

  clearAll() {
    this.state?.values.map((value) => (value.checked = false));
  }

  get filter() {
    const sheetId = this.env.model.getters.getActiveSheetId();
    const position = this.env.model.getters.getActiveFilterPosition()!;
    return this.env.model.getters.getFilter(sheetId, position.col, position.row);
  }

  get filterTable() {
    const sheetId = this.env.model.getters.getActiveSheetId();
    const position = this.env.model.getters.getActiveFilterPosition()!;
    return this.env.model.getters.getFilterTable(sheetId, position.col, position.row);
  }

  get displayedValues() {
    if (!this.state) {
      return [];
    }
    if (!this.state.textFilter) {
      return this.state.values;
    }
    const values = fuzzyLookup(this.state.textFilter, this.state.values, (val) => val.string);
    return values;
  }

  confirm() {
    const position = this.env.model.getters.getActiveFilterPosition()!;
    this.env.model.dispatch("UPDATE_FILTER", {
      ...position,
      sheetId: this.env.model.getters.getActiveSheetId(),
      values: this.state!.values.map((val) => (!val.checked ? val.string : undefined)).filter(
        isDefined
      ),
    });
    this.props.onClosed();
  }

  cancel() {
    this.props.onClosed();
  }

  sortFilterZone(sortDirection: SortDirection) {
    const filter = this.filter;
    const filterTable = this.filterTable;
    if (!filter || !filterTable) {
      return;
    }
    const sheetId = this.env.model.getters.getActiveSheetId();
    const sortAnchor = { col: filter.col, row: filter.filteredZone.top };
    // interactiveSortSelection(this.env, sheetId, sortAnchor, filter.filteredZone, direction, {
    //   staticSelection: true,
    // });
    this.env.model.dispatch("SORT_CELLS", {
      sheetId,
      col: sortAnchor.col,
      row: sortAnchor.row,
      zone: filterTable.contentZone,
      sortDirection,
      sortOptions: { emptyCellAsZero: true, hasNoHeader: true },
    });
    this.props.onClosed();
  }
}
