import { Component, onMounted, onPatched, onRendered, useEffect, useRef, xml } from "@odoo/owl";
import { CANVAS_SHIFT } from "../../constants";
import { Ref } from "../../types";

export class GridCanvas extends Component {
  static template = xml/*xml*/ `<canvas t-ref="canvas"/>`;
  private canvas!: Ref<HTMLElement>;
  setup() {
    this.canvas = useRef("canvas");
    onMounted(() => {
      // this.drawGrid()
    });
    onPatched(() => {
      // console.log("patched")
      // this.drawGrid()
    });
    onRendered(() => {
      // console.log("sqdf")
    });
    useEffect(() => {
      // console.log("effect canvas");
      this.drawGrid();
    });
  }

  private drawGrid() {
    // drawing grid on canvas
    const canvas = this.canvas.el as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const thinLineWidth = 0.4 * dpr;
    const renderingContext = {
      ctx,
      dpr,
      thinLineWidth,
    };
    const { width, height } = this.env.model.getters.getSheetViewDimensionWithHeaders();
    // console.log(width)
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.setAttribute("style", `width:${width}px;height:${height}px;`);
    // Imagine each pixel as a large square. The whole-number coordinates (0, 1, 2…)
    // are the edges of the squares. If you draw a one-unit-wide line between whole-number
    // coordinates, it will overlap opposite sides of the pixel square, and the resulting
    // line will be drawn two pixels wide. To draw a line that is only one pixel wide,
    // you need to shift the coordinates by 0.5 perpendicular to the line's direction.
    // http://diveintohtml5.info/canvas.html#pixel-madness
    ctx.translate(-CANVAS_SHIFT, -CANVAS_SHIFT);
    ctx.scale(dpr, dpr);
    this.env.model.drawGrid(renderingContext);
  }
}
