import * as owl from "@odoo/owl";
import { SpreadsheetEnv, Zone, Rect, Viewport } from "../../types/index";

import { Composer } from "./composer";
import { fontSizeMap } from "../../fonts";

const { Component } = owl;
const { xml, css } = owl.tags;

const TEMPLATE = xml/* xml */ `
  <div class="o-grid-composer" t-att-style="containerStyle">
    <Composer
      inputStyle="composerStyle"
      t-on-input="onInput"/>
  </div>
`;

const COMPOSER_BORDER_WIDTH = 1.6;
const CSS = css/* scss */ `
  .o-grid-composer {
    box-sizing: border-box;
    position: absolute;
    border: ${COMPOSER_BORDER_WIDTH}px solid #3266ca;
  }
`;

interface Props {
  viewport: Viewport;
}
/**
 * This component is a composer which positions itself on the grid at the anchor cell.
 * It also applies the style of the cell to the composer input.
 */
export class GridComposer extends Component<Props, SpreadsheetEnv> {
  static template = TEMPLATE;
  static style = CSS;
  static components = { Composer };

  private getters = this.env.getters;
  private zone: Zone;
  private rect: Rect;

  constructor() {
    super(...arguments);
    const [col, row] = this.getters.getPosition();
    this.zone = this.getters.expandZone({ left: col, right: col, top: row, bottom: row });
    this.rect = this.getters.getRect(this.zone, this.props.viewport);
  }

  get containerStyle(): string {
    const cell = this.getters.getActiveCell();
    const style = cell ? this.getters.getCurrentStyle(cell) : {};
    const [x, y, , height] = this.rect;
    const weight = `font-weight:${style.bold ? "bold" : 500};`;
    const italic = style.italic ? `font-style: italic;` : ``;
    const strikethrough = style.strikethrough ? `text-decoration:line-through;` : ``;
    return `left: ${x - 1}px;
        top:${y}px;
        height:${height + 1}px;
        font-size:${fontSizeMap[style.fontSize || 10]}px;
        ${weight}${italic}${strikethrough}`;
  }

  get composerStyle(): string {
    const cell = this.getters.getActiveCell();
    const style = cell ? this.getters.getCurrentStyle(cell) : {};
    const type = cell ? cell.type : "text";
    const height = this.rect[3] - COMPOSER_BORDER_WIDTH * 2 + 1;
    const align = "align" in style ? style.align : type === "number" ? "right" : "left";
    return `text-align:${align};
        height: ${height}px;
        line-height:${height}px;`;
  }

  mounted() {
    const el = this.el!;
    el.style.width = (Math.max(el.scrollWidth + 10, this.rect[2] + 1) + "px") as string;
    el.style.height = (this.rect[3] + 1 + "px") as string;
  }

  onInput(ev: KeyboardEvent) {
    const el = this.el! as HTMLInputElement;
    const composerInput = ev.target! as HTMLInputElement;
    if (composerInput.clientWidth !== composerInput.scrollWidth) {
      el.style.width = (composerInput.scrollWidth + 50) as any;
    }
  }
}
