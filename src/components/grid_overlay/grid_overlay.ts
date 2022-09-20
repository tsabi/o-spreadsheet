import { Component, useRef } from "@odoo/owl";
import { HeaderIndex, Pixel, Position, Ref, SpreadsheetChildEnv } from "../../types";

interface ClickModifiers {}
interface Props {
  onCellClicked: (position: Position, modifiers: ClickModifiers) => void;
  onCellDoubleClicked: (position: Position) => void;
  exposeFocus: (focus: () => void) => void;
}

class GridOverlay extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-GridOverlay";
  private gridOverlay!: Ref<HTMLElement>;

  setup() {
    this.gridOverlay = useRef("gridOverlay");
    this.props.exposeFocus(() => this.focus());
  }

  focus() {
    if (!this.env.model.getters.getSelectedFigureId()) {
      this.gridOverlay.el!.focus();
    }
  }

  /**
   * Get the coordinates in pixels, with 0,0 being the top left of the grid itself
   */
  getCoordinates(ev: MouseEvent): [Pixel, Pixel] {
    const rect = this.gridOverlay.el!.getBoundingClientRect();
    const x = ev.pageX - rect.left;
    const y = ev.pageY - rect.top;
    return [x, y];
  }

  getCartesianCoordinates(ev: MouseEvent): [HeaderIndex, HeaderIndex] {
    const [x, y] = this.getCoordinates(ev);
    const colIndex = this.env.model.getters.getColIndex(x);
    const rowIndex = this.env.model.getters.getRowIndex(y);
    return [colIndex, rowIndex];
  }
}
