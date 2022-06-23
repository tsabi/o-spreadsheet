import { App, Component, useSubEnv, xml } from "@odoo/owl";
import { Model } from "../../src";
import { Popover, PopoverProps } from "../../src/components/popover/popover";
import { TOPBAR_HEIGHT } from "../../src/constants";
import { Pixel } from "../../src/types";
import { OWL_TEMPLATES } from "../setup/jest.setup";
import { getStylePropertyInPx, makeTestFixture } from "../test_helpers/helpers";

const POPOVER_HEIGHT = 200;
const POPOVER_WIDTH = 200;

let fixture: HTMLElement;
let model: Model;
let app: App;

interface PopoverArgs extends Partial<PopoverProps> {
  childWidth: Pixel;
  childHeight: Pixel;
}

async function mountTestPopover(args: PopoverArgs) {
  class Parent extends Component<any, any> {
    static template = xml/* xml */ `
        <div class="o-spreadsheet">
          <Popover t-props="popoverProps">
            <div style="height:${args.childHeight}px;width:${args.childWidth}px;"/>
          </Popover>
        </div>
  `;
    static components = { Popover };

    setup() {
      useSubEnv({
        model: this.props.model,
        isDashboard: () => false,
      });
    }

    popoverProps = {
      anchorRect: args.anchorRect || { x: 0, y: 0, width: 10, height: 10 },
      positioning: args.positioning || "right",
      maxWidth: args.maxHeight,
      maxHeight: args.maxHeight,
      marginTop: args.marginTop || 0,
    };
  }

  app = new App(Parent, { props: { model } });
  app.addTemplates(OWL_TEMPLATES);
  await app.mount(fixture);
}

const originalGetBoundingClientRect = HTMLDivElement.prototype.getBoundingClientRect;
jest
  .spyOn(HTMLDivElement.prototype, "getBoundingClientRect")
  .mockImplementation(function (this: HTMLDivElement) {
    if (this.className.includes("o-popover")) {
      const maxHeight = getStylePropertyInPx(this, "max-height");
      const maxWidth = getStylePropertyInPx(this, "max-height");
      const childHeight = getStylePropertyInPx(this.firstChild! as HTMLElement, "height");
      const childWidth = getStylePropertyInPx(this.firstChild! as HTMLElement, "width");
      return {
        height: childHeight || maxHeight,
        width: childWidth || maxWidth,
      };
    } else if (this.className.includes("o-spreadsheet")) {
      return { top: 0, left: 0, height: 1000, width: 1000 };
    }
    return originalGetBoundingClientRect.call(this);
  });

beforeEach(async () => {
  fixture = makeTestFixture();
  model = new Model();
});

afterEach(() => {
  app?.destroy();
  fixture.remove();
});

describe("Popover sizing", () => {
  test("Prop maxHeight and maxWidth make popover use CSS maxwidth/height", async () => {
    await mountTestPopover({
      anchorRect: { x: 0, y: 0, width: 0, height: 0 },
      positioning: "TopRight",
      maxWidth: POPOVER_WIDTH,
      maxHeight: POPOVER_HEIGHT,
      childHeight: 100,
      childWidth: 100,
    });
    const popover = fixture.querySelector(".o-popover")! as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.style["max-width"]).toEqual(`${POPOVER_WIDTH}px`);
    expect(popover.style["max-height"]).toEqual(`${POPOVER_HEIGHT}px`);
  });

  test("Popover use the spreadsheet size to compute its max size", async () => {
    await mountTestPopover({
      anchorRect: { x: 0, y: 0, width: 0, height: 0 },
      positioning: "TopRight",
      childHeight: 100,
      childWidth: 100,
    });
    const popover = fixture.querySelector(".o-popover")! as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.style["max-width"]).toEqual(`${1000}px`);
    expect(popover.style["max-height"]).toEqual(`${1000}px`);
  });
});

describe("Popover positioning", () => {
  describe("Popover positioned TopRight", () => {
    test("Popover right of point", async () => {
      await mountTestPopover({
        anchorRect: { x: 0, y: 0, width: 0, height: 0 },
        positioning: "TopRight",
        childHeight: 100,
        childWidth: 100,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual("0px");
      expect(popover.style.top).toEqual("0px");
    });

    test("Popover right of box", async () => {
      const box = { x: 0, y: 0, width: 100, height: 100 };
      await mountTestPopover({
        anchorRect: box,
        positioning: "TopRight",
        childWidth: 50,
        childHeight: 50,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.width}px`);
      expect(popover.style.top).toEqual(`${box.y}px`);
    });

    test("Popover overflowing right is rendered left of box", async () => {
      const viewPortDims = model.getters.getSheetViewDimensionWithHeaders();
      const box = { x: viewPortDims.width - 50, y: 0, width: 100, height: 100 };
      await mountTestPopover({
        anchorRect: box,
        positioning: "TopRight",
        childWidth: 50,
        childHeight: 50,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.x - 50}px`);
      expect(popover.style.top).toEqual(`${box.y}px`);
    });

    test("Popover overflowing down is rendered with its bottom aligned to the bottom of the box", async () => {
      const viewPortDims = model.getters.getSheetViewDimensionWithHeaders();
      const box = { x: 0, y: viewPortDims.height + TOPBAR_HEIGHT - 50, width: 100, height: 100 };
      await mountTestPopover({
        anchorRect: box,
        positioning: "TopRight",
        childHeight: 50,
        childWidth: 100,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.width}px`);
      expect(popover.style.top).toEqual(`${box.y + box.height - 50}px`);
    });

    test("Popover overflowing down and right is rendered to the left of the box with its bottom aligned to the bottom of the box", async () => {
      const viewPortDims = model.getters.getSheetViewDimensionWithHeaders();
      const box = {
        x: viewPortDims.width - 50,
        y: viewPortDims.height + TOPBAR_HEIGHT - 50,
        width: 50,
        height: 50,
      };
      await mountTestPopover({
        anchorRect: box,
        positioning: "TopRight",
        childHeight: 100,
        childWidth: 100,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.x - 100}px`);
      expect(popover.style.top).toEqual(`${box.y + box.height - 100}px`);
    });
  });

  describe("Popover positioned BottomLeft", () => {
    test("Popover bottom of point", async () => {
      await mountTestPopover({
        anchorRect: { x: 0, y: 0, width: 0, height: 0 },
        positioning: "BottomLeft",
        childHeight: 100,
        childWidth: 100,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual("0px");
      expect(popover.style.top).toEqual("0px");
    });

    test("Popover bottom of box", async () => {
      const box = { x: 0, y: 0, width: 100, height: 100 };
      await mountTestPopover({
        anchorRect: box,
        positioning: "BottomLeft",
        childHeight: 100,
        childWidth: 100,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.x}px`);
      expect(popover.style.top).toEqual(`${box.height}px`);
    });

    test("Popover overflowing right is rendered with its right border matching the box right border", async () => {
      const viewPortDims = model.getters.getSheetViewDimensionWithHeaders();
      const box = { x: viewPortDims.width - 50, y: 0, width: 50, height: 50 };
      await mountTestPopover({
        anchorRect: box,
        positioning: "BottomLeft",
        childWidth: 100,
        childHeight: 100,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.x + box.width - 100}px`);
      expect(popover.style.top).toEqual(`${box.height}px`);
    });

    test("Popover overflowing down is rendered above the box", async () => {
      const viewPortDims = model.getters.getSheetViewDimensionWithHeaders();
      const box = { x: 0, y: viewPortDims.height + TOPBAR_HEIGHT - 50, width: 100, height: 100 };
      await mountTestPopover({
        anchorRect: box,
        positioning: "BottomLeft",
        childHeight: 50,
        childWidth: 50,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.x}px`);
      expect(popover.style.top).toEqual(`${box.y - 50}px`);
    });

    test("Popover overflowing down and right is rendered with its right border matching the box right border and above the box", async () => {
      const viewPortDims = model.getters.getSheetViewDimensionWithHeaders();
      const box = {
        x: viewPortDims.width - 50,
        y: viewPortDims.height + TOPBAR_HEIGHT - 50,
        width: 100,
        height: 100,
      };
      await mountTestPopover({
        anchorRect: box,
        positioning: "BottomLeft",
        childHeight: 100,
        childWidth: 100,
      });
      const popover = fixture.querySelector(".o-popover")! as HTMLElement;
      expect(popover).toBeTruthy();
      expect(popover.style.left).toEqual(`${box.x + box.width - 100}px`);
      expect(popover.style.top).toEqual(`${box.y - 100}px`);
    });
  });
});
