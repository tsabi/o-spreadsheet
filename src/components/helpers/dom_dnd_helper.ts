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

  edgeScrollInterval: number | undefined;
  edgeScrollOffset: number = 0;

  constructor(
    public draggedItemId: string,
    mouseX: number,
    private items: DragAndDropItem[],
    private containerEl: HTMLElement,
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

    if (mouseX < this.containerRect.left || mouseX > this.containerRect.right) {
      this.startEdgeScroll(mouseX < this.containerRect.left ? -1 : 1);
      return;
    } else {
      this.stopEdgeScroll();
    }

    this.moveDraggedToPosition(mouseX + this.edgeScrollOffset);
  }

  private startEdgeScroll(direction: -1 | 1) {
    if (this.edgeScrollInterval) return;
    this.edgeScrollInterval = window.setInterval(() => {
      let newPosition = this.currentMouseX + direction * 3;

      if (newPosition < this.minX) {
        newPosition = this.minX;
      } else if (newPosition > this.maxX) {
        newPosition = this.maxX;
      }

      this.edgeScrollOffset += newPosition - this.currentMouseX;
      this.moveDraggedToPosition(newPosition);
    }, 8);
  }

  private stopEdgeScroll() {
    window.clearInterval(this.edgeScrollInterval);
    this.edgeScrollInterval = undefined;
  }

  private moveDraggedToPosition(mouseX: number) {
    this.currentMouseX = mouseX;

    const hoveredSheetIndex = this.getHoveredItemIndex(
      mouseX,
      this.items.map((item) => item.x)
    );
    const draggedItemIndex = this.items.findIndex((item) => item.id === this.draggedItemId);
    const draggedItem = this.items[draggedItemIndex];

    if (this.deadZone && mouseX >= this.deadZone.start && mouseX <= this.deadZone.end) {
      this.onChange(this.getItemsPositions());
      return;
    } else if (mouseX >= draggedItem.x && mouseX <= draggedItem.x + draggedItem.width) {
      this.deadZone = undefined;
    }

    if (draggedItemIndex === hoveredSheetIndex) {
      this.onChange(this.getItemsPositions());
      return;
    }

    const startIndex = Math.min(draggedItemIndex, hoveredSheetIndex);
    const endIndex = Math.max(draggedItemIndex, hoveredSheetIndex);
    const dir = Math.sign(hoveredSheetIndex - draggedItemIndex);

    let movedWidth = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      if (i === draggedItemIndex) {
        continue;
      }
      this.items[i].x -= dir * draggedItem.width;
      movedWidth += this.items[i].width;
    }

    draggedItem.x += dir * movedWidth;
    this.deadZone =
      dir > 0
        ? { start: mouseX, end: draggedItem.x }
        : { start: draggedItem.x + draggedItem.width, end: mouseX };
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
    this.stopEdgeScroll();
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

  private get containerRect() {
    return this.containerEl.getBoundingClientRect();
  }
}
