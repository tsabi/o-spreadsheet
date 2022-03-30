import { Component } from "@odoo/owl";
import { CellValueType, Getters, Position } from "../../types";
import { CellPopoverParameters } from "../../types/cell_popovers";
import { css } from "../helpers/css";

const ERROR_TOOLTIP_HEIGHT = 40;
const ERROR_TOOLTIP_WIDTH = 180;

css/* scss */ `
  .o-error-tooltip {
    font-size: 13px;
    background-color: white;
    border-left: 3px solid red;
    padding: 10px;
  }
`;

interface ErrorToolTipProps {
  text: string;
}

export class ErrorToolTip extends Component<ErrorToolTipProps> {
  static componentSize = { width: ERROR_TOOLTIP_WIDTH, height: ERROR_TOOLTIP_HEIGHT };
  static template = "o-spreadsheet.ErrorToolTip";
  static components = {};
}

export function errorTooltipComponent(
  position: Position,
  getters: Getters
): CellPopoverParameters<ErrorToolTipProps> | undefined {
  const cell = getters.getCell(getters.getActiveSheetId(), position.col, position.row);
  if (!cell || cell.evaluated.type !== CellValueType.error) return;
  return {
    Component: ErrorToolTip,
    cellCorner: "TopRight",
    props: { text: cell.evaluated.error },
  };
}
