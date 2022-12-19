import { startDnd } from "./drag_and_drop";

interface DragAndDropItem {
  id: string;
  width: number;
  startingX: number;
  x: number;
}

export class DOMDndHelper {
  /**
   * The dead zone is an area in which the mousemove events are ignored.
   *
   * This is useful when swapping the dragged item with a larger item. After the swap,
   * the mouse is still hovering on the item  we just swapped with. In this case, we don't want
   * a mouse move to trigger another swap the other way around, so we create a dead zone. We will clear
   * the dead zone when the mouse leaves the swapped item.
   */
  deadZone: { start: number; end: number } | undefined;

  initialMouseX: number;
  currentMouseX: number;

  minX: number;
  maxX: number;

  constructor(
    public draggedItemId: string,
    mouseX: number,
    private items: DragAndDropItem[],
    private onChange: (newPositions: Record<string, number>) => void,
    private onCancel: () => void,
    private onDragEnd: (itemId: string, indexAtEnd: number) => void
  ) {
    this.initialMouseX = mouseX;
    this.currentMouseX = mouseX;

    this.minX = this.items[0].x;
    this.maxX = this.items[this.items.length - 1].x + this.items[this.items.length - 1].width;

    startDnd(this.onMouseMove.bind(this), this.onMouseUp.bind(this));
  }

  private onMouseMove(ev: MouseEvent) {
    if (ev.button !== 0) {
      this.onCancel();
      return;
    }
    const mouseX = ev.clientX;

    const hoveredSheetIndex = this.getHoveredItemIndex(
      mouseX,
      this.items.map((item) => item.x)
    );
    const draggedSheetIndex = this.items.findIndex((item) => item.id === this.draggedItemId);
    const draggedSheet = this.items[draggedSheetIndex];

    this.currentMouseX = mouseX;

    if (this.deadZone && mouseX >= this.deadZone.start && mouseX <= this.deadZone.end) {
      this.onChange(this.getItemsPositions());
      return;
    } else if (mouseX >= draggedSheet.x && mouseX <= draggedSheet.x + draggedSheet.width) {
      this.deadZone = undefined;
    }

    if (draggedSheetIndex === hoveredSheetIndex) {
      this.onChange(this.getItemsPositions());
      return;
    }

    const startIndex = Math.min(draggedSheetIndex, hoveredSheetIndex);
    const endIndex = Math.max(draggedSheetIndex, hoveredSheetIndex);
    const dir = Math.sign(hoveredSheetIndex - draggedSheetIndex);

    let movedWidth = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      if (i === draggedSheetIndex) {
        continue;
      }
      this.items[i].x -= dir * draggedSheet.width;
      movedWidth += this.items[i].width;
    }

    draggedSheet.x += dir * movedWidth;
    this.deadZone =
      dir > 0
        ? { start: mouseX, end: draggedSheet.x }
        : { start: draggedSheet.x + draggedSheet.width, end: mouseX };
    this.items.sort((item1, item2) => item1.x - item2.x);

    this.onChange(this.getItemsPositions());
  }

  private onMouseUp(ev: MouseEvent) {
    if (ev.button !== 0) {
      this.onCancel();
      return;
    }

    const targetSheetIndex = this.items.findIndex((item) => item.id === this.draggedItemId);
    this.onDragEnd(this.draggedItemId, targetSheetIndex);
  }

  private getHoveredItemIndex(mouseX: number, xs: number[]): number {
    let hoveredItemIndex = -1;
    for (let x of xs) {
      if (x > mouseX) {
        break;
      }
      hoveredItemIndex++;
    }
    return Math.max(0, hoveredItemIndex);
  }

  private getItemsPositions() {
    const positions: Record<string, number> = {};
    for (let item of this.items) {
      if (item.id !== this.draggedItemId) {
        positions[item.id] = Math.floor(item.x - item.startingX);
        continue;
      }

      let mouseOffset = this.currentMouseX - this.initialMouseX;
      let left = mouseOffset;
      left = Math.max(this.minX - item.startingX, left);
      left = Math.min(this.maxX - item.startingX - item.width, left);

      positions[item.id] = Math.floor(left);
    }
    return positions;
  }
}
