import {
  Component,
  onMounted,
  onPatched,
  onWillUpdateProps,
  useExternalListener,
  useRef,
  useState,
} from "@odoo/owl";
import { BACKGROUND_GRAY_COLOR, BOTTOMBAR_HEIGHT, HEADER_WIDTH } from "../../constants";
import { formatValue } from "../../helpers/format";
import { interactiveRenameSheet } from "../../helpers/ui/sheet_interactive";
import { MenuItemRegistry, sheetMenuRegistry } from "../../registries/index";
import { Pixel, Sheet, SpreadsheetChildEnv, UID } from "../../types";
import { css } from "../helpers/css";
import { Menu, MenuState } from "../menu/menu";

// -----------------------------------------------------------------------------
// SpreadSheet
// -----------------------------------------------------------------------------

css/* scss */ `
  .o-spreadsheet-bottom-bar {
    background-color: ${BACKGROUND_GRAY_COLOR};
    padding-left: ${HEADER_WIDTH}px;
    display: flex;
    align-items: center;
    font-size: 15px;
    border-top: 1px solid lightgrey;
    overflow: hidden;

    .o-add-sheet,
    .o-list-sheets {
      margin-right: 5px;
    }

    .o-add-sheet.disabled {
      cursor: not-allowed;
    }

    .o-sheet-item {
      display: flex;
      align-items: center;
      padding: 5px;
      cursor: pointer;
      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
    }

    .o-all-sheets {
      display: flex;
      align-items: center;
      max-width: 80%;
      overflow: hidden;
    }

    .o-sheet {
      color: #666;
      padding: 0 15px;
      padding-right: 10px;
      height: ${BOTTOMBAR_HEIGHT}px;
      line-height: ${BOTTOMBAR_HEIGHT}px;
      user-select: none;
      white-space: nowrap;
      border-left: 1px solid #c1c1c1;
      background-color: ${BACKGROUND_GRAY_COLOR};

      &:last-child {
        border-right: 1px solid #c1c1c1;
      }

      &.dragging {
        cursor: grab;
      }

      &.selected {
        background-color: rgba(0, 0, 0, 0.08);
      }

      &.active {
        color: #484;
        background-color: #ffffff;
        box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
      }

      .o-sheet-icon {
        margin-left: 5px;

        &:hover {
          background-color: rgba(0, 0, 0, 0.08);
        }
      }
    }

    .o-selection-statistic {
      background-color: #ffffff;
      margin-left: auto;
      font-size: 14px;
      margin-right: 20px;
      padding: 4px 8px;
      color: #333;
      border-radius: 3px;
      box-shadow: 0 1px 3px 1px rgba(60, 64, 67, 0.15);
      user-select: none;
      cursor: pointer;
      &:hover {
        background-color: rgba(0, 0, 0, 0.08);
      }
    }

    .fade-enter-active {
      transition: opacity 0.5s;
    }

    .fade-enter {
      opacity: 0;
    }
  }
`;

export interface SheetState {
  draggedSheetId: UID | undefined;
  sheetList: Sheet[];
}

interface Props {
  onClick: () => void;
}

export class BottomBar extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-BottomBar";
  static components = { Menu };

  private bottomBarRef = useRef("bottomBar");

  private sheetPositionList: number[] = [];

  menuState: MenuState = useState({ isOpen: false, position: null, menuItems: [] });
  sheetState: SheetState = useState({
    draggedSheetId: undefined,
    sheetList: this.getUpdatedSheetsOrder(),
  });
  selectedStatisticFn: string = "";

  setup() {
    onMounted(() => this.focusSheet());
    onPatched(() => this.focusSheet());
    onWillUpdateProps(() => (this.sheetState.sheetList = this.getUpdatedSheetsOrder()));
    // listening the mouse events on window rather than the sheet element allows for the events mousemove/up
    // to be captured after a mousedown even after the mouse has left the window
    useExternalListener(window, "mousemove", this.onSheetMouseMove);
    useExternalListener(window, "mouseup", this.onSheetMouseUp);
  }

  get dragging(): boolean {
    return this.sheetState.draggedSheetId !== undefined;
  }

  focusSheet() {
    const div = this.bottomBarRef.el!.querySelector(
      `[data-id="${this.env.model.getters.getActiveSheetId()}"]`
    );
    if (div && div.scrollIntoView) {
      div.scrollIntoView();
    }
  }

  addSheet() {
    const activeSheetId = this.env.model.getters.getActiveSheetId();
    const position =
      this.env.model.getters.getSheetIds().findIndex((sheetId) => sheetId === activeSheetId) + 1;
    const sheetId = this.env.model.uuidGenerator.uuidv4();
    const name = this.env.model.getters.getNextSheetName(this.env._t("Sheet"));
    this.env.model.dispatch("CREATE_SHEET", { sheetId, position, name });
    this.env.model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: activeSheetId, sheetIdTo: sheetId });
  }

  private getUpdatedSheetsOrder() {
    return this.env.model.getters
      .getVisibleSheetIds()
      .map((sheetId) => this.env.model.getters.getSheet(sheetId));
  }

  getSheets() {
    return this.sheetState.sheetList;
  }

  listSheets(ev: MouseEvent) {
    const registry = new MenuItemRegistry();
    const from = this.env.model.getters.getActiveSheetId();
    let i = 0;
    for (const sheetId of this.env.model.getters.getSheetIds()) {
      const sheet = this.env.model.getters.getSheet(sheetId);
      registry.add(sheetId, {
        name: sheet.name,
        sequence: i,
        isReadonlyAllowed: true,
        textColor: sheet.isVisible ? undefined : "grey",
        action: (env) => {
          env.model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: from, sheetIdTo: sheetId });
        },
      });
      i++;
    }
    const target = ev.currentTarget as HTMLElement;
    const { top, left } = target.getBoundingClientRect();
    this.openContextMenu(left, top, registry);
  }

  activateSheet(name: string) {
    this.env.model.dispatch("ACTIVATE_SHEET", {
      sheetIdFrom: this.env.model.getters.getActiveSheetId(),
      sheetIdTo: name,
    });
  }

  onDblClick(sheetId: UID) {
    interactiveRenameSheet(this.env, sheetId);
  }

  openContextMenu(x: Pixel, y: Pixel, registry: MenuItemRegistry) {
    this.menuState.isOpen = true;
    this.menuState.menuItems = registry.getAll().filter((x) => x.isVisible(this.env));
    this.menuState.position = { x, y };
  }

  onIconClick(sheet: string, ev: MouseEvent) {
    if (this.env.model.getters.getActiveSheetId() !== sheet) {
      this.activateSheet(sheet);
    }
    if (this.menuState.isOpen) {
      this.menuState.isOpen = false;
    } else {
      const target = (ev.currentTarget as HTMLElement).parentElement as HTMLElement;
      const { top, left } = target.getBoundingClientRect();
      this.openContextMenu(left, top, sheetMenuRegistry);
    }
  }

  onContextMenu(sheet: string, ev: MouseEvent) {
    if (this.env.model.getters.getActiveSheetId() !== sheet) {
      this.activateSheet(sheet);
    }
    const target = ev.currentTarget as HTMLElement;
    const { top, left } = target.getBoundingClientRect();
    this.openContextMenu(left, top, sheetMenuRegistry);
  }

  onSheetMouseDown(sheetId: UID, event: MouseEvent) {
    if (event.button !== 0) return;

    document.body.style.cursor = "grab";
    this.sheetState.draggedSheetId = sheetId;
    if (this.sheetPositionList.length === 0) {
      this.updateSheetsPositions();
    }
  }

  onSheetMouseMove(event: MouseEvent) {
    if (!this.dragging || event.clientX === 0) return;
    if (event.button !== 0) {
      this.stopDragging();
      return;
    }
    let hoveredSheetIndex = -1;
    for (let sheetPositionX of this.sheetPositionList) {
      if (sheetPositionX > event.clientX) {
        break;
      }
      hoveredSheetIndex++;
    }
    hoveredSheetIndex = Math.max(0, hoveredSheetIndex);
    const draggedSheetIndex = this.sheetState.sheetList.findIndex(
      (sheet) => sheet.id === this.sheetState.draggedSheetId
    );
    if (draggedSheetIndex !== hoveredSheetIndex) {
      this.sheetState.sheetList.splice(
        hoveredSheetIndex,
        0,
        this.sheetState.sheetList.splice(draggedSheetIndex, 1)[0]
      );
    }
  }

  onSheetMouseUp(event: MouseEvent) {
    if (!this.dragging && event.button !== 0) return;
    const sheetId = this.sheetState.draggedSheetId;
    const draggedSheetIndex = this.env.model.getters
      .getVisibleSheetIds()
      .findIndex((id) => id === sheetId);
    const targetSheetIndex = this.sheetState.sheetList.findIndex((sheet) => sheet.id === sheetId);
    const delta = targetSheetIndex - draggedSheetIndex;
    if (sheetId && delta !== 0) {
      this.env.model.dispatch("MOVE_SHEET", {
        sheetId: sheetId,
        delta: delta,
      });
    }
    this.stopDragging();
  }

  private stopDragging() {
    document.body.style.cursor = "";
    this.sheetState.sheetList = this.getUpdatedSheetsOrder();
    this.updateSheetsPositions();
    this.sheetState.draggedSheetId = undefined;
  }

  private updateSheetsPositions() {
    const sheets = this.env.model.getters.getVisibleSheetIds();
    this.sheetPositionList = [];
    for (let sheet of sheets) {
      const position = this.getSheetPosition(sheet);
      if (position) {
        this.sheetPositionList.push(position);
      }
    }
  }

  private getSheetPosition(sheetId: UID): number | undefined {
    const sheet = document.querySelector<HTMLElement>(`.o-sheet[data-id="${sheetId}"]`);
    if (!sheet) return undefined;
    const position = sheet.getBoundingClientRect();
    return position.left;
  }

  getSelectedStatistic() {
    const statisticFnResults = this.env.model.getters.getStatisticFnResults();
    // don't display button if no function has a result
    if (Object.values(statisticFnResults).every((result) => result === undefined)) {
      return undefined;
    }
    if (this.selectedStatisticFn === "") {
      this.selectedStatisticFn = Object.keys(statisticFnResults)[0];
    }
    return this.getComposedFnName(
      this.selectedStatisticFn,
      statisticFnResults[this.selectedStatisticFn]
    );
  }

  listSelectionStatistics(ev: MouseEvent) {
    const registry = new MenuItemRegistry();
    let i = 0;
    for (let [fnName, fnValue] of Object.entries(this.env.model.getters.getStatisticFnResults())) {
      registry.add(fnName, {
        name: this.getComposedFnName(fnName, fnValue),
        sequence: i,
        isReadonlyAllowed: true,
        action: () => {
          this.selectedStatisticFn = fnName;
        },
      });
      i++;
    }
    const target = ev.currentTarget as HTMLElement;
    const { top, left, width } = target.getBoundingClientRect();
    this.openContextMenu(left + width, top, registry);
  }

  private getComposedFnName(fnName: string, fnValue: number | undefined): string {
    return fnName + ": " + (fnValue !== undefined ? formatValue(fnValue) : "__");
  }
}

BottomBar.props = {
  onClick: Function,
};
