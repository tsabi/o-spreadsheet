import * as owl from "@odoo/owl";
import { SpreadsheetEnv, Zone, Rect } from "../../types/index";

import { Composer } from "./composer";

const { Component } = owl;
const { xml, css } = owl.tags;
const { useRef } = owl.hooks;

const TEMPLATE = xml/* xml */ `
  <div class="o-cell-composer" t-att-style="positionStyle">
    <Composer t-ref="composer" height="height" autofocus="props.autofocus"/>
  </div>
`;
const CSS = css/* scss */ `
  .o-cell-composer {
    box-sizing: border-box;
    position: absolute;
    border: 1.6px solid #3266ca;
  }
`;

export class CellComposer extends Component<any, SpreadsheetEnv> {
  static template = TEMPLATE;
  static style = CSS;
  static components = { Composer };

  private getters = this.env.getters;
  private composerRef = useRef("composer");
  private zone: Zone;
  private rect: Rect;

  constructor() {
    super(...arguments);
    const [col, row] = this.getters.getPosition();
    this.zone = this.getters.expandZone({ left: col, right: col, top: row, bottom: row });
    this.rect = this.getters.getRect(this.zone, this.props.viewport);
  }

  get height() {
    return this.rect[3];
  }

  get positionStyle() {
    const [x, y, , height] = this.rect;
    return `
      left: ${x - 1}px;
      top:${y}px;
      height:${height}px;
    `;
  }

  mounted() {
    const el = this.composerRef.el!;
    el.style.width = (Math.max(el.scrollWidth + 10, this.rect[2] + 1.5) + "px") as string;
    el.style.height = (this.rect[3] + 1.5 + "px") as string;
  }

  addTextFromSelection() {
    // Change this
    (this.composerRef.comp as Composer).addTextFromSelection();
  }
}
