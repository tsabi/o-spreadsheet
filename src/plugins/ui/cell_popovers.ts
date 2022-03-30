import { ComponentConstructor } from "@odoo/owl/dist/types/component/component";
import { PopoverProps } from "../../components/popover/popover";
import { isDefined, positionToZone } from "../../helpers";
import { Mode } from "../../model";
import { cellPopoverRegistry } from "../../registries/cell_popovers_registry";
import { Command, Position } from "../../types";
import { CellPopoverParameters } from "../../types/cell_popovers";
import { UIPlugin } from "../ui_plugin";

export interface PopoverParameters {
  ChildComponent: ComponentConstructor;
  key: string;
  childProps: Object;
  popoverProps: PopoverProps;
}

/**
 * Plugin managing the display of components next to cells.
 */
export class CellPopoverPlugin extends UIPlugin {
  static getters = ["getCellPopovers"] as const;
  static modes: Mode[] = ["normal"];

  private persistentPopover?: CellPopoverParameters<any> & Position;

  handle(cmd: Command) {
    switch (cmd.type) {
      case "ACTIVATE_SHEET":
        this.persistentPopover = undefined;
        break;
      case "OPEN_CELL_POPOVER":
        this.persistentPopover = cmd;
        break;
      case "CLOSE_CELL_POPOVER":
        this.persistentPopover = undefined;
        break;
    }
  }

  getCellPopovers({ col, row }: Partial<Position>): PopoverParameters[] {
    const sheetId = this.getters.getActiveSheetId();
    if (this.persistentPopover) {
      const { col, row } = this.getters.getMainCellPosition(
        sheetId,
        this.persistentPopover.col,
        this.persistentPopover.row
      );
      return [this.computePopoverProps(this.persistentPopover, { col, row })];
    }
    if (col === undefined || row === undefined) return [];
    const mainPosition = this.getters.getMainCellPosition(sheetId, col, row);
    return cellPopoverRegistry
      .getAll()
      .map((matcher) => matcher(mainPosition, this.getters))
      .filter(isDefined)
      .map((popoverParams, index) => this.computePopoverProps(popoverParams, mainPosition, index));
  }

  private computePopoverProps(
    popoverParams: CellPopoverParameters<any>,
    { col, row }: Position,
    index: number = 0
  ): PopoverParameters {
    const viewport = this.getters.getActiveSnappedViewport();
    const [, , width, height] = this.getters.getRect(positionToZone({ col, row }), viewport);
    return {
      ChildComponent: popoverParams.Component,
      childProps: popoverParams.props,
      key: `c${col}r${row}i${index}`,
      popoverProps: {
        position: this.computePopoverPosition({ col, row }, popoverParams.cellCorner),
        childWidth: popoverParams.Component.componentSize.width,
        childHeight: popoverParams.Component.componentSize.height,
        marginTop: 0,
        flipHorizontalOffset: -width,
        flipVerticalOffset: -height,
      },
    };
  }

  private computePopoverPosition(
    { col, row }: Position,
    corner: "TopRight" | "BottomLeft"
  ): PopoverProps["position"] {
    const sheetId = this.getters.getActiveSheetId();
    const viewport = this.getters.getActiveSnappedViewport();
    const merge = this.getters.getMerge(sheetId, col, row);
    if (merge) {
      col = corner === "TopRight" ? merge.right : merge.left;
      row = corner === "TopRight" ? merge.top : merge.bottom;
    }
    // x, y are relative to the canvas
    const [x, y, width, height] = this.getters.getRect(positionToZone({ col, row }), viewport);
    switch (corner) {
      case "BottomLeft":
        return { x, y: y + height };
      case "TopRight":
        return { x: x + width, y: y };
    }
  }
}
