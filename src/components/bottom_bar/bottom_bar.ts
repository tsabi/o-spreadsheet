import { Component, onMounted, onPatched, onWillUpdateProps, useRef, useState } from "@odoo/owl";
import { BACKGROUND_GRAY_COLOR, BOTTOMBAR_HEIGHT, HEADER_WIDTH } from "../../constants";
import { deepEquals } from "../../helpers";
import { formatValue } from "../../helpers/format";
import { interactiveRenameSheet } from "../../helpers/ui/sheet_interactive";
import { MenuItemRegistry, sheetMenuRegistry } from "../../registries/index";
import { Pixel, Rect, SpreadsheetChildEnv, UID } from "../../types";
import { css, cssPropertiesToCss } from "../helpers/css";
import { startDnd } from "../helpers/drag_and_drop";
import { Menu, MenuState } from "../menu/menu";

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
      padding-left: 1px;
    }

    .o-sheet {
      color: #666;
      padding: 0 15px;
      padding-right: 10px;
      height: ${BOTTOMBAR_HEIGHT}px;
      line-height: ${BOTTOMBAR_HEIGHT}px;
      user-select: none;
      white-space: nowrap;
      background-color: ${BACKGROUND_GRAY_COLOR};

      border-left: 1px solid #c1c1c1;

      &:last-child {
        border-right: 1px solid #c1c1c1;
      }

      &.dragging {
        left: 0px;
        border-right: 1px solid #c1c1c1;
        margin-right: -1px;

        position: relative;
        transition: left 0.5s;
        cursor: move;
      }

      &.dragged {
        transition: left 0s;
        background-color: rgba(0, 0, 0, 0.08);
        z-index: 1000;
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

interface BottomBarSheet {
  id: UID;
  name: string;
}

interface DragAndDropSheet {
  sheetId: UID;
  width: number;
  startingX: number;
  x: number;
}

interface SheetState {
  sheetList: BottomBarSheet[];
  dnd: DragSheetState | undefined;
}

interface DragSheetState {
  draggedSheetId: UID;
  sheets: DragAndDropSheet[];
  initialMouseX: number;
  currentMouseX: number;

  /**
   * The dead zone is an area in which the mousemove events are ignored.
   *
   * This is useful when swapping the dragged sheet with a larger sheet item. After the swap,
   * the mouse is still hovering on the sheet item  we just swapped. In this case, we don't want
   * a mouse move to trigger another swap the other way around, so we create a dead zone. We will clear
   * the dead zone when the mouse leaves the swapped sheet item.
   */
  deadZone: { start: number; end: number } | undefined;
}

interface Props {
  onClick: () => void;
}

export class BottomBar extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-BottomBar";
  static components = { Menu };

  private bottomBarRef = useRef("bottomBar");

  menuState: MenuState = useState({ isOpen: false, position: null, menuItems: [] });
  sheetState: SheetState = useState({
    sheetList: this.getVisibleSheets(),
    dnd: undefined,
  });
  selectedStatisticFn: string = "";

  setup() {
    onMounted(() => this.focusSheet());
    onPatched(() => {
      if (!this.sheetState.dnd) document.body.style.cursor = "";
      this.focusSheet();
    });
    onWillUpdateProps(() => {
      const visibleSheets = this.getVisibleSheets();
      // Cancel sheet dragging when there is a change in the sheets
      if (this.sheetState.dnd && !deepEquals(this.sheetState.sheetList, visibleSheets)) {
        this.stopDragging();
      }
      this.sheetState.sheetList = visibleSheets;
    });
  }

  isDragged(sheetId: UID): boolean {
    return this.sheetState.dnd?.draggedSheetId === sheetId;
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

  private getVisibleSheets(): BottomBarSheet[] {
    return this.env.model.getters.getVisibleSheetIds().map((sheetId) => {
      const sheet = this.env.model.getters.getSheet(sheetId);
      return { id: sheet.id, name: sheet.name };
    });
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

  closeContextMenu() {
    this.menuState.isOpen = false;
  }

  onIconClick(sheet: string, ev: MouseEvent) {
    if (this.env.model.getters.getActiveSheetId() !== sheet) {
      this.activateSheet(sheet);
    }
    if (this.menuState.isOpen) {
      this.closeContextMenu();
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
    const mouseX = event.clientX;

    document.body.style.cursor = "move";
    this.activateSheet(sheetId);
    const visibleSheets = this.getVisibleSheets();
    const sheetRects = this.getSheetItemRects();

    this.sheetState.dnd = {
      draggedSheetId: sheetId,
      sheets: visibleSheets.map((sheet, index) => ({
        sheetId: sheet.id,
        width: sheetRects[index].width,
        x: sheetRects[index].x,
        startingX: sheetRects[index].x,
      })),
      currentMouseX: mouseX,
      deadZone: undefined,
      initialMouseX: mouseX,
    };

    this.closeContextMenu();
    startDnd(this.dragSheetMouseMove.bind(this), this.dragSheetMouseUp.bind(this));
  }

  private dragSheetMouseMove(event: MouseEvent) {
    const dndState = this.sheetState.dnd;
    if (!dndState || event.button !== 0) {
      this.stopDragging();
      return;
    }
    const mouseX = event.clientX;

    const hoveredSheetIndex = this.getHoveredSheetIndex(
      mouseX,
      dndState.sheets.map((sheet) => sheet.x)
    );
    const draggedSheetIndex = dndState.sheets.findIndex(
      (sheet) => sheet.sheetId === dndState.draggedSheetId
    );
    const draggedSheet = dndState.sheets[draggedSheetIndex];

    dndState.currentMouseX = mouseX;

    if (dndState.deadZone && mouseX >= dndState.deadZone.start && mouseX <= dndState.deadZone.end) {
      return;
    } else if (mouseX >= draggedSheet.x && mouseX <= draggedSheet.x + draggedSheet.width) {
      dndState.deadZone = undefined;
    }

    if (draggedSheetIndex === hoveredSheetIndex) return;

    const startIndex = Math.min(draggedSheetIndex, hoveredSheetIndex);
    const endIndex = Math.max(draggedSheetIndex, hoveredSheetIndex);
    const dir = Math.sign(hoveredSheetIndex - draggedSheetIndex);

    let movedWidth = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      if (i === draggedSheetIndex) {
        continue;
      }
      dndState.sheets[i].x -= dir * draggedSheet.width;
      movedWidth += dndState.sheets[i].width;
    }

    draggedSheet.x += dir * movedWidth;
    dndState.deadZone =
      dir > 0
        ? { start: mouseX, end: draggedSheet.x }
        : { start: draggedSheet.x + draggedSheet.width, end: mouseX };
    dndState.sheets.sort((sheet1, sheet2) => sheet1.x - sheet2.x);
  }

  private getHoveredSheetIndex(mouseX: number, xs: number[]): number {
    let hoveredSheetIndex = -1;
    for (let x of xs) {
      if (x > mouseX) {
        break;
      }
      hoveredSheetIndex++;
    }
    return Math.max(0, hoveredSheetIndex);
  }

  private dragSheetMouseUp(event: MouseEvent) {
    const dndState = this.sheetState.dnd;
    if (!dndState || event.button !== 0) return;

    const sheetId = dndState.draggedSheetId;
    const originalIndex = this.sheetState.sheetList.findIndex((sheet) => sheet.id === sheetId);
    const targetSheetIndex = dndState.sheets.findIndex((sheet) => sheet.sheetId === sheetId);
    const delta = targetSheetIndex - originalIndex;
    if (sheetId && delta !== 0) {
      this.env.model.dispatch("MOVE_SHEET", {
        sheetId: sheetId,
        delta: delta,
      });
    }
    this.stopDragging();
  }

  getSheetItemStyle(id: UID) {
    const dndState = this.sheetState.dnd;
    const sheet = this.sheetState.dnd?.sheets.find((sheet) => sheet.sheetId === id);

    if (!dndState || !sheet) return "";
    if (id !== dndState.draggedSheetId) {
      return cssPropertiesToCss({
        left: `${Math.floor(sheet ? sheet.x - sheet.startingX : 0)}px`,
      });
    }

    const firstSheetX = dndState.sheets[0].x;
    const lastSheet = dndState.sheets[dndState.sheets.length - 1];
    const lastSheetX = lastSheet.x + lastSheet.width;

    let mouseOffset = dndState.currentMouseX - dndState.initialMouseX;
    let left = mouseOffset;
    left = Math.max(firstSheetX - sheet.startingX, left);
    left = Math.min(lastSheetX - sheet.startingX - sheet.width, left);

    return cssPropertiesToCss({
      left: `${Math.floor(left)}px`,
    });
  }

  private stopDragging() {
    document.body.style.cursor = "";
    this.sheetState.sheetList = this.getVisibleSheets();
    this.sheetState.dnd = undefined;
  }

  private getSheetItemRects(): Rect[] {
    return Array.from(document.querySelectorAll<HTMLElement>(`.o-sheet.o-sheet-item`)).map(
      (sheetEl) => sheetEl.getBoundingClientRect()
    );
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
