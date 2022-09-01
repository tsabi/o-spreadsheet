import {
  Component,
  onWillStart,
  onWillUpdateProps,
  useExternalListener,
  useRef,
  useState,
} from "@odoo/owl";
import { DEFAULT_FONT_SIZE, FONT_SIZES } from "../../constants";
import { clip } from "../../helpers/index";
import { setStyle } from "../../registries/index";
import { SpreadsheetChildEnv, Style } from "../../types/index";
import { css } from "../helpers/css";
import { MenuState } from "../menu/menu";

interface State {
  menuState: MenuState;
}

interface Props {
  callback: () => void;
}

// -----------------------------------------------------------------------------
// TopBar
// -----------------------------------------------------------------------------
css/* scss */ `
  .o-spreadsheet-topbar {
    /* Toolbar + Cell Content */
    .o-topbar-toolbar {
      input.o-font-size {
        height: 20px;
        width: 23px;
        border: none;
        background-color: rgba(0, 0, 0, 0);
      }
      input[type="number"] {
        -moz-appearance: textfield;
      }
      input::-webkit-outer-spin-button,
      input::-webkit-inner-spin-button {
        -webkit-appearance: none;
      }
    }
  }
`;

export class FontEditor extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-FontEditor";
  static components = {};
  fontSizes = FONT_SIZES;

  style: Style = {};
  state: State = useState({
    menuState: { isOpen: false, position: null, menuItems: [] },
  });
  openedEl: HTMLElement | null = null;

  private inputFontSize = useRef("inputFontSize");
  private parentDiv = useRef("FontSizeContainer");

  setup() {
    useExternalListener(window, "click", this.onExternalClick);
    onWillStart(() => this.updateCellState());
    onWillUpdateProps(() => this.updateCellState());
  }

  onExternalClick(ev: MouseEvent) {
    //@ts-ignore
    if (!this.parentDiv.el?.contains(ev.target)) {
      this.closeFontList();
    }
  }

  toggleFontList(ev: MouseEvent | InputEvent) {
    const isOpen = this.state.menuState.isOpen;
    if (!isOpen) {
      this.props.callback();
      this.inputFontSize.el?.focus();
    } else {
      this.closeFontList();
    }
  }

  closeFontList() {
    this.state.menuState.isOpen = false;
    this.openedEl = null;
  }

  updateCellState() {
    this.style = { ...this.env.model.getters.getCurrentStyle() };
    this.style.fontSize = this.style.fontSize || DEFAULT_FONT_SIZE;
  }

  setSize(fontSizeStr: string) {
    this.style.fontSize = clip(parseFloat(fontSizeStr), 1, 400);
    setStyle(this.env, { fontSize: this.style.fontSize });
    this.closeFontList();
  }

  setSizeFromInput(ev: InputEvent) {
    this.setSize((ev.target as HTMLInputElement).value);
  }

  onFontsizeInputFocused(ev: InputEvent) {
    this.state.menuState.isOpen = true;
    (ev.target as HTMLInputElement).select();
  }

  onFontSizeKeydown(ev: KeyboardEvent) {
    if (ev.key === "Enter" || ev.key === "Escape") {
      this.closeFontList();
      const target = ev.target as HTMLInputElement;
      if (ev.key === "Escape") {
        target.value = `${this.style.fontSize || DEFAULT_FONT_SIZE}`;
      }
      target.blur();
    }
  }
}
