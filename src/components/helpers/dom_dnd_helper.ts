import { startDnd } from "./drag_and_drop";

interface DragAndDropItemsPartial {
  id: string;
  size: number;
  position: number;
}

interface DragAndDropItems extends DragAndDropItemsPartial {
  positionAtStart: number;
}

export class DOMDndHelper {
  draggedSheetId: string;
  private items: DragAndDropItems[];
  private containerEl: HTMLElement;

  private initialMousePosition: number;
  private currentMousePosition: number;

  private minPosition: number;
  private maxPosition: number;

  private edgeScrollIntervalId: number | undefined;
  private edgeScrollOffset: number = 0;

  private onChange: (newPositions: Record<string, number>) => void;
  private onCancel: () => void;
  private onDragEnd: (itemId: string, indexAtEnd: number) => void;

  /**
   * The dead zone is an area in which the mousemove events are ignored.
   *
   * This is useful when swapping the dragged item with a larger item. After the swap,
   * the mouse is still hovering on the item  we just swapped with. In this case, we don't want
   * a mouse move to trigger another swap the other way around, so we create a dead zone. We will clear
   * the dead zone when the mouse leaves the swapped item.
   */
  private deadZone: { start: number; end: number } | undefined;

  constructor(args: {
    draggedItemId: string;
    mouseX: number;
    items: DragAndDropItemsPartial[];
    containerEl: HTMLElement;
    onChange: (newPositions: Record<string, number>) => void;
    onCancel: () => void;
    onDragEnd: (itemId: string, indexAtEnd: number) => void;
  }) {
    this.items = args.items.map((item) => ({ ...item, positionAtStart: item.position }));
    this.draggedSheetId = args.draggedItemId;
    this.containerEl = args.containerEl;
    this.onChange = args.onChange;
    this.onCancel = args.onCancel;
    this.onDragEnd = args.onDragEnd;

    this.initialMousePosition = args.mouseX;
    this.currentMousePosition = args.mouseX;

    this.minPosition = this.items[0].position;
    this.maxPosition =
      this.items[this.items.length - 1].position + this.items[this.items.length - 1].size;

    startDnd(this.onMouseMove.bind(this), this.onMouseUp.bind(this));
  }

  private onMouseMove(ev: MouseEvent) {
    if (ev.button !== 0) {
      this.onCancel();
      return;
    }
    const mousePosition = ev.clientX;

    if (mousePosition < this.containerRect.left || mousePosition > this.containerRect.right) {
      this.startEdgeScroll(mousePosition < this.containerRect.left ? -1 : 1);
      return;
    } else {
      this.stopEdgeScroll();
    }

    this.moveDraggedItemToPosition(mousePosition + this.edgeScrollOffset);
  }

  private moveDraggedItemToPosition(mousePosition: number) {
    this.currentMousePosition = mousePosition;

    const hoveredItemIndex = this.getHoveredItemIndex(mousePosition, this.items);
    const draggedItemIndex = this.items.findIndex((item) => item.id === this.draggedSheetId);
    const draggedItem = this.items[draggedItemIndex];

    if (this.deadZone && this.isInZone(mousePosition, this.deadZone)) {
      this.onChange(this.getItemsPositions());
      return;
    } else if (
      this.isInZone(mousePosition, {
        start: draggedItem.position,
        end: draggedItem.position + draggedItem.size,
      })
    ) {
      this.deadZone = undefined;
    }

    if (draggedItemIndex === hoveredItemIndex) {
      this.onChange(this.getItemsPositions());
      return;
    }

    const leftIndex = Math.min(draggedItemIndex, hoveredItemIndex);
    const rightIndex = Math.max(draggedItemIndex, hoveredItemIndex);
    const direction = Math.sign(hoveredItemIndex - draggedItemIndex);

    let draggedItemMoveSize = 0;
    for (let i = leftIndex; i <= rightIndex; i++) {
      if (i === draggedItemIndex) {
        continue;
      }
      if (!this.items[i]) debugger;
      this.items[i].position -= direction * draggedItem.size;
      draggedItemMoveSize += this.items[i].size;
    }

    draggedItem.position += direction * draggedItemMoveSize;
    this.items.sort((item1, item2) => item1.position - item2.position);

    this.deadZone =
      direction > 0
        ? { start: mousePosition, end: draggedItem.position }
        : { start: draggedItem.position + draggedItem.size, end: mousePosition };

    this.onChange(this.getItemsPositions());
  }

  private onMouseUp(ev: MouseEvent) {
    if (ev.button !== 0) {
      this.onCancel();
      return;
    }

    const targetSheetIndex = this.items.findIndex((item) => item.id === this.draggedSheetId);
    this.onDragEnd(this.draggedSheetId, targetSheetIndex);
    this.stopEdgeScroll();
  }

  private startEdgeScroll(direction: -1 | 1) {
    if (this.edgeScrollIntervalId) return;
    this.edgeScrollIntervalId = window.setInterval(() => {
      let newPosition = this.currentMousePosition + direction * 3;

      if (newPosition < this.minPosition) {
        newPosition = this.minPosition;
      } else if (newPosition > this.maxPosition) {
        newPosition = this.maxPosition;
      }

      this.edgeScrollOffset += newPosition - this.currentMousePosition;
      this.moveDraggedItemToPosition(newPosition);
    }, 5);
  }

  private stopEdgeScroll() {
    window.clearInterval(this.edgeScrollIntervalId);
    this.edgeScrollIntervalId = undefined;
  }

  /**
   * Get the index of the item the given mouse position is inside.
   * If the mouse is outside the container, return the first or last item index.
   */
  private getHoveredItemIndex(mousePosition: number, items: DragAndDropItems[]): number {
    if (mousePosition <= this.minPosition) return 0;
    if (mousePosition >= this.maxPosition) return items.length - 1;
    return items.findIndex(
      (item) => mousePosition >= item.position && item.position + item.size > mousePosition
    );
  }

  private getItemsPositions() {
    const positions: Record<string, number> = {};
    for (let item of this.items) {
      if (item.id !== this.draggedSheetId) {
        positions[item.id] = item.position - item.positionAtStart;
        continue;
      }

      let mouseOffset = this.currentMousePosition - this.initialMousePosition;
      let left = mouseOffset;
      left = Math.max(this.minPosition - item.positionAtStart, left);
      left = Math.min(this.maxPosition - item.positionAtStart - item.size, left);

      positions[item.id] = left;
    }
    return positions;
  }

  private get containerRect() {
    return this.containerEl.getBoundingClientRect();
  }

  private isInZone(position: number, zone: { start: number; end: number }) {
    return position >= zone.start && position <= zone.end;
  }
}
