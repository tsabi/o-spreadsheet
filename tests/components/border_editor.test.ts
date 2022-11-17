import { App, Component, onMounted, onWillUnmount, useState, useSubEnv, xml } from "@odoo/owl";
import { TopBar } from "../../src/components/top_bar/top_bar";
import { DEFAULT_BORDER_DESC } from "../../src/constants";
import { Model } from "../../src/model";
import { OWL_TEMPLATES } from "../setup/jest.setup";
import { selectCell, setSelection } from "../test_helpers/commands_helpers";
import { simulateClick } from "../test_helpers/dom_helper";
import { getBorder } from "../test_helpers/getters_helpers";
import { makeTestFixture } from "../test_helpers/helpers";

jest.mock("../../src/components/composer/content_editable_helper", () =>
  require("./__mocks__/content_editable_helper")
);
jest.mock("../../src/helpers/uuid", () => require("../__mocks__/uuid"));

let fixture: HTMLElement;
const t = (s: string): string => s;

async function setBorder(name: string) {
  await simulateClick('.o-tool[title="Borders"]');
  await simulateClick(`.o-line-item[foo="${name}"]`);
}

class Parent extends Component {
  static template = xml/* xml */ `
    <div class="o-spreadsheet">
      <TopBar focusComposer="state.focusComposer" onClick="() => {}"/>
    </div>
  `;
  static components = { TopBar };

  static _t = t;
  state = useState({ focusComposer: <boolean>false });

  setup() {
    useSubEnv({
      openSidePanel: () => {},
      model: this.props.model,
      askConfirmation: jest.fn(),
      _t: Parent._t,
      isDashboard: () => this.props.model.getters.isDashboard(),
    });
    this.state.focusComposer = this.props.focusComposer || false;
    onMounted(() => this.props.model.on("update", this, this.render));
    onWillUnmount(() => this.props.model.off("update", this));
  }

  setFocusComposer(isFocused: boolean) {
    this.state.focusComposer = isFocused;
  }
}

async function mountParent(
  model: Model = new Model(),
  focusComposer: boolean = false
): Promise<{ parent: Parent; app: App }> {
  const app = new App(Parent, { props: { model, focusComposer } });
  app.addTemplates(OWL_TEMPLATES);
  const parent = await app.mount(fixture);
  return { app, parent };
}

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

describe("Can set borders", () => {
  let model: Model;
  let app;
  beforeEach(async () => {
    model = new Model();
    ({ app } = await mountParent(model));
  });

  afterEach(() => {
    app.destroy();
  });

  test("Can set all borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("all");

    for (const cell of ["A1", "A2", "B1", "B2"]) {
      expect(getBorder(model, cell)).toEqual({
        top: DEFAULT_BORDER_DESC,
        bottom: DEFAULT_BORDER_DESC,
        left: DEFAULT_BORDER_DESC,
        right: DEFAULT_BORDER_DESC,
      });
    }
  });

  test("Can set only left borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("left");

    expect(getBorder(model, "A1")).toEqual({ left: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "A2")).toEqual({ left: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B1")).toBeNull();
    expect(getBorder(model, "B2")).toBeNull();
  });

  test("Can set only right borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("right");

    expect(getBorder(model, "B1")).toEqual({ right: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B2")).toEqual({ right: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "A1")).toBeNull();
    expect(getBorder(model, "A2")).toBeNull();
  });

  test("Can set only top borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("top");

    expect(getBorder(model, "A1")).toEqual({ top: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B1")).toEqual({ top: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "A2")).toBeNull();
    expect(getBorder(model, "B2")).toBeNull();
  });

  test("Can set only bottom borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("bottom");

    expect(getBorder(model, "A2")).toEqual({ bottom: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B2")).toEqual({ bottom: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "A1")).toBeNull();
    expect(getBorder(model, "B1")).toBeNull();
  });

  test("Can set only inside hv borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("hv");

    expect(getBorder(model, "A1")).toEqual({
      right: DEFAULT_BORDER_DESC,
      bottom: DEFAULT_BORDER_DESC,
    });
    expect(getBorder(model, "A2")).toEqual({
      right: DEFAULT_BORDER_DESC,
      top: DEFAULT_BORDER_DESC,
    });
    expect(getBorder(model, "B1")).toEqual({
      left: DEFAULT_BORDER_DESC,
      bottom: DEFAULT_BORDER_DESC,
    });
    expect(getBorder(model, "B2")).toEqual({
      left: DEFAULT_BORDER_DESC,
      top: DEFAULT_BORDER_DESC,
    });
  });

  test("Can set only inside hv borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("h");

    expect(getBorder(model, "A1")).toEqual({ bottom: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "A2")).toEqual({ top: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B1")).toEqual({ bottom: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B2")).toEqual({ top: DEFAULT_BORDER_DESC });
  });

  test("Can set only inside hv borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("v");

    expect(getBorder(model, "A1")).toEqual({ right: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "A2")).toEqual({ right: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B1")).toEqual({ left: DEFAULT_BORDER_DESC });
    expect(getBorder(model, "B2")).toEqual({ left: DEFAULT_BORDER_DESC });
  });

  test("Can set only inside hv borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("external");

    expect(getBorder(model, "A1")).toEqual({
      left: DEFAULT_BORDER_DESC,
      top: DEFAULT_BORDER_DESC,
    });
    expect(getBorder(model, "A2")).toEqual({
      left: DEFAULT_BORDER_DESC,
      bottom: DEFAULT_BORDER_DESC,
    });
    expect(getBorder(model, "B1")).toEqual({
      right: DEFAULT_BORDER_DESC,
      top: DEFAULT_BORDER_DESC,
    });
    expect(getBorder(model, "B2")).toEqual({
      right: DEFAULT_BORDER_DESC,
      bottom: DEFAULT_BORDER_DESC,
    });
  });

  test("Can set all borders", async () => {
    setSelection(model, ["A1:B2"]);
    await setBorder("clear");

    for (const cell of ["A1", "A2", "B1", "B2"]) {
      expect(getBorder(model, cell)).toBeNull();
    }
  });

  test.each(["thin", "medium", "thick", "dotted", "dashed"])(
    "Can change borders type",
    async (style: String) => {
      selectCell(model, "A1");
      await setBorder("left");
      expect(getBorder(model, "A1")).toEqual({ left: DEFAULT_BORDER_DESC });

      await simulateClick('.o-tool[title="Line style"]');
      await simulateClick(`.o-dropdown-item[title="${style}"]`);
      expect(getBorder(model, "A1")).toEqual({ left: { style, color: "#000000" } });
    }
  );

  test.each(["left", "right", "top", "bottom"])(
    "Can set a border color and let other as is",
    async (position: string) => {
      selectCell(model, "A1");
      await setBorder("all");

      await simulateClick(`.o-line-item[foo="${position}"]`);
      await simulateClick('.o-tool[title="Border color"]');
      await simulateClick('div[data-color="#ff9900"]');
      for (const dir of ["left", "right", "top", "bottom"]) {
        expect(getBorder(model, "A1")![dir]).toEqual({
          style: DEFAULT_BORDER_DESC.style,
          color: dir === position ? "#ff9900" : DEFAULT_BORDER_DESC.color,
        });
      }
    }
  );

  test("Updating the color without selecting a border position doesn't impact previous border", async () => {
    setSelection(model, ["A1:A10"]);
    await setBorder("external");

    await simulateClick('.o-tool[title="Borders"]');

    setSelection(model, ["A1:A5"]);

    await simulateClick('.o-tool[title="Borders"]');
    await simulateClick('.o-tool[title="Border color"]');
    await simulateClick('div[data-color="#ff9900"]');

    expect(getBorder(model, "A1")).toEqual({
      left: DEFAULT_BORDER_DESC,
      top: DEFAULT_BORDER_DESC,
      bottom: undefined,
      right: DEFAULT_BORDER_DESC,
    });

    for (const cell of ["A2", "A3", "A4", "A5"]) {
      expect(getBorder(model, cell)).toEqual({
        left: DEFAULT_BORDER_DESC,
        top: undefined,
        bottom: undefined,
        right: DEFAULT_BORDER_DESC,
      });
    }
  });

  test("Updating the line style without selecting a border position doesn't impact previous border", async () => {
    setSelection(model, ["A1:A10"]);
    await setBorder("external");

    await simulateClick('.o-tool[title="Borders"]');

    setSelection(model, ["A1:A5"]);

    await simulateClick('.o-tool[title="Borders"]');
    await simulateClick('.o-tool[title="Line style"]');
    await simulateClick(`.o-dropdown-item[title="medium"]`);

    expect(getBorder(model, "A1")).toEqual({
      left: DEFAULT_BORDER_DESC,
      top: DEFAULT_BORDER_DESC,
      bottom: undefined,
      right: DEFAULT_BORDER_DESC,
    });

    for (const cell of ["A2", "A3", "A4", "A5"]) {
      expect(getBorder(model, cell)).toEqual({
        left: DEFAULT_BORDER_DESC,
        top: undefined,
        bottom: undefined,
        right: DEFAULT_BORDER_DESC,
      });
    }
  });
});
