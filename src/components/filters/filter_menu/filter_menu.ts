import { Component, useState } from "@odoo/owl";
import { isDefined, positions } from "../../../helpers";
import { FullMenuItem } from "../../../registries";
import { SpreadsheetChildEnv } from "../../../types";
import { css } from "../../helpers/css";

const CSS = css/* scss */ `
  .o-filter-menu-item {
    box-sizing: border-box;
    padding: 4px 16px;
    display: flex;
    flex-direction: column;

    input {
      margin-bottom: 5px;
    }

    .o-filter-menu-actions {
      display: flex;
      flex-direction: row;
      margin-bottom: 2px;

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
      display: flex;
      flex-direction: row;
      cursor: pointer;
      overflow: visible;

      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }

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
  onClose: () => void;
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
  static template = "o-spreadsheet.FilterMenuItem";
  static style = CSS;

  private state: State | undefined;

  setup() {
    const position = this.env.model.getters.getActiveFilterPosition()!;
    const sheetId = this.env.model.getters.getActiveSheetId();
    const filter = this.env.model.getters.getFilter(sheetId, position.col, position.row);
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
    // this.state.values.map((value) => (value.checked = false));
  }

  confirm() {
    const position = this.env.model.getters.getActiveFilterPosition()!;

    // const values = this.state.values.filter((val) => val.checked).map((val) => val.string);
    // const col = this.env.getters.getActiveFilterCol()!;
    // this.env.dispatch("SET_FILTER_VALUE", { })
    this.env.model.dispatch("UPDATE_FILTER", {
      ...position,
      sheetId: this.env.model.getters.getActiveSheetId(),
      values: this.state!.values.map((val) => (!val.checked ? val.string : undefined)).filter(
        isDefined
      ),
    });
    console.log("Confirm filter menu");
    this.props.onClose();
  }

  cancel() {
    console.log("Cancel filter menu");
    this.props.onClose();
  }
}
