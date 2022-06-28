import { Component, useState, xml } from "@odoo/owl";
import { AUTOFILL_EDGE_LENGTH } from "../../constants";
import { SpreadsheetChildEnv } from "../../types";
import { css } from "../helpers/css";
import { dragAndDropBeyondTheViewport } from "../helpers/drag_and_drop";

// -----------------------------------------------------------------------------
// Autofill
// -----------------------------------------------------------------------------

css/* scss */ `
  .o-autofill {
    height: 6px;
    width: 6px;
    border: 1px solid white;
    position: absolute;
    background-color: #1a73e8;

    .o-autofill-handler {
      position: absolute;
      height: ${AUTOFILL_EDGE_LENGTH}px;
      width: ${AUTOFILL_EDGE_LENGTH}px;

      &:hover {
        cursor: crosshair;
      }
    }

    .o-autofill-nextvalue {
      position: absolute;
      background-color: white;
      border: 1px solid black;
      padding: 5px;
      font-size: 12px;
      pointer-events: none;
      white-space: nowrap;
    }
  }
`;

interface Props {
  position: Position;
  getGridBoundingClientRect: () => DOMRect;
}

interface Position {
  top: number;
  left: number;
}

interface State {
  position: Position;
  handler: boolean;
}

export class Autofill extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-Autofill";
  state: State = useState({
    position: { left: 0, top: 0 },
    handler: false,
  });

  get style() {
    const { left, top } = this.props.position;
    return `top:${top}px;left:${left}px`;
  }

  get styleHandler() {
    let position: Position = this.state.handler ? this.state.position : { left: 0, top: 0 };
    return `top:${position.top}px;left:${position.left}px;`;
  }

  get styleNextvalue() {
    let position: Position = this.state.handler ? this.state.position : { left: 0, top: 0 };
    return `top:${position.top + 5}px;left:${position.left + 15}px;`;
  }

  getTooltip() {
    const tooltip = this.env.model.getters.getAutofillTooltip();
    if (tooltip && !tooltip.component) {
      tooltip.component = TooltipComponent;
    }
    return tooltip;
  }

  onMouseDown(ev: MouseEvent) {
    this.state.handler = true;
    this.state.position = { left: 0, top: 0 };
    const { offsetY, offsetX } = this.env.model.getters.getViewportOffsetInfo();
    const start = {
      left: ev.clientX + offsetX,
      top: ev.clientY + offsetY,
    };
    let lastCol: number | undefined;
    let lastRow: number | undefined;

    const onMouseUp = () => {
      this.state.handler = false;
      this.env.model.dispatch("AUTOFILL");
    };

    const onMouseMove = (col: number, row: number, ev: MouseEvent) => {
      this.state.position = { left: ev.x - start.left, top: ev.y - start.top };
      if (lastCol !== col || lastRow !== row) {
        lastCol = col === -1 ? lastCol : col;
        lastRow = row === -1 ? lastRow : row;
        if (lastCol !== undefined && lastRow !== undefined) {
          this.env.model.dispatch("AUTOFILL_SELECT", { col: lastCol, row: lastRow });
        }
      }
    };
    dragAndDropBeyondTheViewport(this.env, onMouseMove, onMouseUp);
  }

  onDblClick() {
    this.env.model.dispatch("AUTOFILL_AUTO");
  }
}

class TooltipComponent extends Component<Props> {
  static template = xml/* xml */ `
    <div t-esc="props.content"/>
  `;
}
