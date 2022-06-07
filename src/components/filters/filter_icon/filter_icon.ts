import * as owl from "@odoo/owl";
import { DEFAULT_FILTER_BORDER_DESC } from "../../../constants";
import { DOMCoordinates, SpreadsheetEnv } from "../../../types";
import { css } from "../../helpers/css";

const { Component } = owl;

const CSS = css/* scss */ `
  .o-filter-icon {
    color: ${DEFAULT_FILTER_BORDER_DESC[1]};
    position: absolute;
    svg {
      path {
        fill: ${DEFAULT_FILTER_BORDER_DESC[1]};
      }
    }
    .o-filter-active-icon {
      svg {
        padding: 2px;
      }
    }
  }
  .o-filter-icon:hover {
    background: ${DEFAULT_FILTER_BORDER_DESC[1]};
    svg {
      path {
        fill: white;
      }
    }
  }
`;

interface Props {
  position: DOMCoordinates;
  isActive: boolean;
  onClick: () => void;
}

export class FilterIcon extends Component<Props, SpreadsheetEnv> {
  static style = CSS;
  static template = "o-spreadsheet.FilterIcon";

  get style() {
    const { x, y } = this.props.position;
    return `top:${y}px;left:${x}px`;
  }
}
