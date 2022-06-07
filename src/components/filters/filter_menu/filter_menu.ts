import { Component, useRef, useState } from "@odoo/owl";
import { MENU_ITEM_HEIGHT, MENU_WIDTH } from "../../../constants";
import { getElementHeightWithMargins, isDefined, positions, toLowerCase } from "../../../helpers";
import { fuzzyLookup } from "../../../helpers/search";
import { Position, SortDirection, SpreadsheetChildEnv } from "../../../types";
import { CellPopoverComponent, PopoverBuilders } from "../../../types/cell_popovers";
import { css } from "../../helpers/css";

const FILTER_MENU_HEIGHT = 295;

const CSS = css/* scss */ `
  .o-filter-menu {
    box-sizing: border-box;
    padding: 8px 16px;
    display: flex;
    flex-direction: column;
    height: ${FILTER_MENU_HEIGHT}px;
    background: #fff;
    line-height: 1;

    .o-filter-menu-item {
      display: flex;
      box-sizing: border-box;
      height: ${MENU_ITEM_HEIGHT}px;
      padding: 4px 4px 4px 0px;
      cursor: pointer;
      user-select: none;

      &:hover,
      &.selected {
        background-color: rgba(0, 0, 0, 0.08);
      }
    }

    .o-filter-search {
      position: relative;
    }
    input {
      box-sizing: border-box;
      margin-bottom: 5px;
      border: 1px solid #949494;
      border-radius: 2px;
      width: 100%;
      height: 24px;
      padding-right: 28px;
    }

    .o-search-icon {
      position: absolute;
      right: 5px;
      top: 4px;

      svg {
        height: 16px;
        width: 16px;
        vertical-align: middle;
      }
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
      flex: auto;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      border: 1px solid #949494;
      border-radius: 2px;

      .o-filter-menu-value {
        padding: 4px;
        .o-filter-menu-value-checked {
          width: 20px;
        }

        .o-filter-menu-value-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .o-filter-menu-no-values {
        display: flex;
        justify-content: center;
        align-items: center;
        color: #949494;
        font-style: italic;
        width: 100%;
        height: 100%;
      }
    }

    .o-filter-menu-buttons {
      display: flex;
      justify-content: flex-end;
      margin-top: 9px;

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
        margin-left: 10px;
      }
    }
  }
`;

interface Props {
  filterPosition: Position;
  onClosed?: () => void;
}

interface Value {
  checked: boolean;
  string: string;
}

interface State {
  values: Value[];
  textFilter: string;
  selectedValue: string | undefined;
}

export class FilterMenu extends Component<Props, SpreadsheetChildEnv> {
  static size = { width: MENU_WIDTH, height: FILTER_MENU_HEIGHT };

  static template = "o-spreadsheet-FilterMenuItem";
  static style = CSS;

  private state: State | undefined;

  valueListRef = useRef("filter_value_list");

  setup() {
    const sheetId = this.env.model.getters.getActiveSheetId();
    const filter = this.filter;
    if (!filter) {
      this.state = useState({ values: [], textFilter: "", selectedValue: undefined });
      return;
    }

    const cellValues = (filter.filteredZone ? positions(filter.filteredZone) : [])
      .filter(({ row }) => !this.env.model.getters.isRowHidden(sheetId, row))
      .map(({ col, row }) => this.env.model.getters.getCell(sheetId, col, row)?.formattedValue);

    const strValues = [...cellValues, ...filter.filteredValues];
    const filteredValuesLowerCase = filter.filteredValues.map(toLowerCase);
    const values = [...new Set([...strValues.map(toLowerCase)])]
      .map((val) => {
        const string = val !== undefined ? String(val).toLowerCase() : "";
        return { string, checked: !filteredValuesLowerCase.includes(string) };
      })
      .sort((val1, val2) =>
        val1.string.localeCompare(val2.string, undefined, { numeric: true, sensitivity: "base" })
      )
      .map((val) => {
        const valueWithUpperCase = strValues.find((str) => str?.toLowerCase() === val.string);
        return { checked: val.checked, string: valueWithUpperCase || "" };
      });

    this.state = useState({ values, textFilter: "", selectedValue: undefined });
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
    const position = this.props.filterPosition;
    return this.env.model.getters.getFilter(sheetId, position.col, position.row);
  }

  get filterTable() {
    const sheetId = this.env.model.getters.getActiveSheetId();
    const position = this.props.filterPosition;
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
    const position = this.props.filterPosition;
    this.env.model.dispatch("UPDATE_FILTER", {
      ...position,
      sheetId: this.env.model.getters.getActiveSheetId(),
      values: this.state!.values.map((val) => (!val.checked ? val.string : undefined)).filter(
        isDefined
      ),
    });
    this.props.onClosed?.();
  }

  cancel() {
    this.props.onClosed?.();
  }

  onKeyDown(ev: KeyboardEvent) {
    const displayedValues = this.displayedValues;

    if (!this.state || displayedValues.length === 0) return;

    let selectedIndex: number | undefined = undefined;
    if (this.state.selectedValue !== undefined) {
      const index = displayedValues.findIndex((val) => val.string === this.state!.selectedValue);
      selectedIndex = index === -1 ? undefined : index;
    }

    switch (ev.key) {
      case "ArrowDown":
        if (selectedIndex === undefined) {
          selectedIndex = 0;
        } else {
          selectedIndex = Math.min(selectedIndex + 1, displayedValues.length - 1);
        }
        ev.preventDefault();
        break;
      case "ArrowUp":
        if (selectedIndex === undefined) {
          selectedIndex = displayedValues.length - 1;
        } else {
          selectedIndex = Math.max(selectedIndex - 1, 0);
        }
        ev.preventDefault();
        break;
      case "Enter":
        if (selectedIndex !== undefined) {
          this.selectVal(displayedValues[selectedIndex]);
        }
        ev.preventDefault();
        break;
    }

    this.state.selectedValue =
      selectedIndex !== undefined ? displayedValues[selectedIndex].string : undefined;
    this.scrollListToSelectedValue(selectedIndex);
  }

  /** If the selected value is out of the list, scroll until it's displayed */
  private scrollListToSelectedValue(selectedIndex: number | undefined) {
    const listElement = this.valueListRef.el;
    const listItem = listElement?.querySelector(".o-filter-menu-item") as HTMLElement;

    if (!listElement || !listItem || selectedIndex === undefined) {
      return;
    }

    const listHeight = listElement.clientHeight;
    const itemHeight = getElementHeightWithMargins(listItem);

    const selectedItemPosition = selectedIndex * itemHeight;
    if (selectedItemPosition < listElement.scrollTop) {
      listElement.scrollTop = selectedItemPosition;
    } else if (selectedItemPosition + itemHeight > listElement.scrollTop + listHeight) {
      listElement.scrollTop = selectedItemPosition + itemHeight - listHeight;
    }
  }

  sortFilterZone(sortDirection: SortDirection) {
    const filter = this.filter;
    const filterTable = this.filterTable;
    if (!filter || !filterTable || !filterTable.contentZone) {
      return;
    }
    const sheetId = this.env.model.getters.getActiveSheetId();
    const sortAnchor = { col: filter.col, row: filterTable.contentZone.top };
    this.env.model.dispatch("SORT_CELLS", {
      sheetId,
      col: sortAnchor.col,
      row: sortAnchor.row,
      zone: filterTable.contentZone,
      sortDirection,
      sortOptions: { emptyCellAsZero: true, hasNoHeader: true },
    });
    this.props.onClosed?.();
  }
}

export const FilterMenuPopoverBuilder: PopoverBuilders = {
  onOpen: (position, getters): CellPopoverComponent<typeof FilterMenu> => {
    return {
      isOpen: true,
      props: { filterPosition: position },
      Component: FilterMenu,
      cellCorner: "BottomLeft",
      popoverType: "FilterMenu",
    };
  },
};
