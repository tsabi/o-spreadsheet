import { Component, useRef } from "@odoo/owl";
import { HeaderIndex, Pixel, Position, Ref } from "../../types";

interface Props {
  onCellClicked: (position: Position) => void;
}

class GridOverlay extends Component<Props> {
  static template = "o-spreadsheet-GridOverlay";
  private gridOverlay!: Ref<HTMLElement>;

  setup() {
    this.gridOverlay = useRef("gridOverlay");
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
