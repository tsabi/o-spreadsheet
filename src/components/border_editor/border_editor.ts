import { Component, useState } from "@odoo/owl";
import { DEFAULT_BORDER_DESC } from "../../constants";
import {
  BorderPosition,
  BorderStyle,
  borderStyles,
  Color,
  SpreadsheetChildEnv,
} from "../../types/index";
import { ColorPicker } from "../color_picker/color_picker";
import { css } from "../helpers/css";
import { MenuState } from "../menu/menu";

type Tool = "" | "borderColorTool" | "borderTypeTool";

interface State {
  menuState: MenuState;
  activeTool: Tool;
  borderColor: Color;
  borderStyle: BorderStyle;
  borderPosition: BorderPosition | "";
}

/**
 * List the available borders positions and the corresponding icons.
 * The structure of this array is defined to match the order/lines we want
 * to display in the topbar's border tool.
 */
const BORDER_POSITIONS: [BorderPosition, string][][] = [
  [
    ["all", "o-spreadsheet-Icon.BORDERS"],
    ["hv", "o-spreadsheet-Icon.BORDER_HV"],
    ["h", "o-spreadsheet-Icon.BORDER_H"],
    ["v", "o-spreadsheet-Icon.BORDER_V"],
    ["external", "o-spreadsheet-Icon.BORDER_EXTERNAL"],
  ],
  [
    ["left", "o-spreadsheet-Icon.BORDER_LEFT"],
    ["top", "o-spreadsheet-Icon.BORDER_TOP"],
    ["right", "o-spreadsheet-Icon.BORDER_RIGHT"],
    ["bottom", "o-spreadsheet-Icon.BORDER_BOTTOM"],
    ["clear", "o-spreadsheet-Icon.BORDER_CLEAR"],
  ],
];

interface Props {}

// -----------------------------------------------------------------------------
// Border Editor
// -----------------------------------------------------------------------------
css/* scss */ `
  .o-topbar-toolbar {
    .o-toolbar-tools {
      .o-border-dropdown {
        padding: 4px;
        display: flex;
      }
      .o-border-dropdown-section {
        display: block;
        .o-tool.o-border-color-tool {
          padding: 1px 3px;
        }
        .o-tool.o-border-style-tool {
          padding: 4px 3px;
        }
      }
      .o-dropdown {
        .o-dropdown-content {
          padding: 4px;
          .o-dropdown-line {
            .o-line-item.active {
              background-color: rgba(0, 0, 0, 0.2);
            }
          }
        }
      }
    }
  }
  .o-style-preview {
    margin-top: 5px;
    margin-bottom: 8px;
    width: 60px;
    height: 5px;
  }
  .o-style-thin {
    border-bottom: 1px solid #000000;
  }
  .o-style-medium {
    border-bottom: 2px solid #000000;
  }
  .o-style-thick {
    border-bottom: 3px solid #000000;
  }
  .o-style-dashed {
    border-bottom: 1px dashed #000000;
  }
  .o-style-dotted {
    border-bottom: 1px dotted #000000;
  }
  .o-dropdown-border-type {
    display: flex;
  }
  .o-dropdown-border-check {
    width: 20px;
    font-size: 16px;
  }
`;

export class BorderEditor extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-BorderEditor";
  BORDER_POSITIONS = BORDER_POSITIONS;

  static components = { ColorPicker };
  borderStyles = borderStyles;
  state: State = useState({
    menuState: { isOpen: false, position: null, menuItems: [] },
    activeTool: "",
    borderStyle: DEFAULT_BORDER_DESC.style,
    borderColor: DEFAULT_BORDER_DESC.color,
    borderPosition: "",
  });

  toggleDropdownTool(tool: Tool, ev: MouseEvent) {
    const isOpen = this.state.activeTool === tool;
    this.closeMenus();
    this.state.activeTool = isOpen ? "" : tool;
  }

  closeMenus() {
    this.state.activeTool = "";
    this.state.menuState.isOpen = false;
    this.state.menuState.parentMenu = undefined;
  }

  setBorderPosition(position: BorderPosition) {
    this.state.borderPosition = position;
    this.updateBorder();
    this.closeMenus();
  }

  setBorderColor(color: Color) {
    this.state.borderColor = color;
    this.updateBorder();
    this.closeMenus();
  }

  setBorderStyle(style: BorderStyle) {
    this.state.borderStyle = style;
    this.updateBorder();
  }

  private updateBorder() {
    if (this.state.borderPosition === "") {
      return;
    }
    this.env.model.dispatch("SET_ZONE_BORDERS", {
      sheetId: this.env.model.getters.getActiveSheetId(),
      target: this.env.model.getters.getSelectedZones(),
      border: {
        position: this.state.borderPosition as BorderPosition,
        color: this.state.borderColor,
        style: this.state.borderStyle,
      },
    });
  }
}
