import { errorTooltipComponent } from "../components/error_tooltip/error_tooltip";
import { linkCellComponent } from "../components/link";
import { Registry } from "../registry";
import { CellPopoverMatcher } from "../types/cell_popovers";

export const cellPopoverRegistry = new Registry<CellPopoverMatcher>();
cellPopoverRegistry
  .add("errorToolTip", errorTooltipComponent)
  .add("linkCellComponent", linkCellComponent);
