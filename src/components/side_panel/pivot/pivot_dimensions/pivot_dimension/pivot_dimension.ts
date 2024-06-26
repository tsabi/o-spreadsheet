import { Component } from "@odoo/owl";
import { SpreadsheetChildEnv } from "../../../../..";
import { css } from "../../../../helpers";

interface Props {
  dimension: PivotDimension;
  onRemoved: (dimension: PivotDimension) => void;
}

// don't use bg-white since it's flipped to dark in dark mode and we don't support dark mode
css/* scss */ `
  .pivot-dimension {
    background-color: white;

    select > option {
      background-color: white;
    }
  }
`;

export class PivotDimension extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-PivotDimension";
  static props = {
    dimension: Object,
    onRemoved: { type: Function, optional: true },
    slots: { type: Object, optional: true },
  };
}
