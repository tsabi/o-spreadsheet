import { ComponentConstructor } from "@odoo/owl/dist/types/component/component";
import { Getters, Position } from ".";

type StaticSizeComponent<Props> = ComponentConstructor<Props> & {
  componentSize: { width: number; height: number };
};

/**
 * Description of a cell component.
 * i.e. which component class, which props and where to
 * display it relative to the cell
 */
export interface CellPopoverParameters<Props> {
  Component: StaticSizeComponent<Props>;
  props: Props;
  cellCorner: "TopRight" | "BottomLeft";
}

/**
 * If the cell at the given position have an associated component (linkDisplay, errorTooltip, ...),
 * returns the parameters the component
 */
export type CellPopoverMatcher = (
  position: Position,
  getters: Getters
) => CellPopoverParameters<any> | undefined;
