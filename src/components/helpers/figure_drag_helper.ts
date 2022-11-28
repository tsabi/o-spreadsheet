import { MIN_FIG_SIZE } from "../../constants";
import { Figure, PixelPosition, SheetScrollInfo } from "../../types";

export function dragFigureForMove(
  initialMousePosition: PixelPosition,
  currentMousePosition: PixelPosition,
  initialFigure: Figure,
  mainViewportPosition: PixelPosition,
  scrollInfo: SheetScrollInfo,
  frozenPaneOffset: number
): Figure {
  const initialMouseX = initialMousePosition.x;
  const mouseX = currentMousePosition.x;
  const viewportX = mainViewportPosition.x;

  const initialMouseY = initialMousePosition.y;
  const mouseY = currentMousePosition.y;
  const viewportY = mainViewportPosition.y;

  const deltaX = initialMouseX - mouseX;
  let newX = initialFigure.x - deltaX;

  // Freeze panes: always display the figure above the panes
  if (viewportX > 0) {
    const isInitialXInFrozenPane = initialFigure.x < viewportX - frozenPaneOffset;
    const isNewXInFrozenPane = newX < viewportX - frozenPaneOffset;
    const isNewXBelowFrozenPane = newX < scrollInfo.offsetX + viewportX - frozenPaneOffset;
    if (isInitialXInFrozenPane && !isNewXInFrozenPane) {
      newX += scrollInfo.offsetX;
    } else if (!isInitialXInFrozenPane && isNewXBelowFrozenPane) {
      newX -= scrollInfo.offsetX;
    }
  }
  newX = Math.max(newX, 0);

  const deltaY = initialMouseY - mouseY;
  let newY = initialFigure.y - deltaY;

  // Freeze panes: always display the figure above the panes
  if (viewportY > 0) {
    const isInitialYInFrozenPane = initialFigure.y < viewportY - frozenPaneOffset;
    const isNewYInFrozenPane = newY < viewportY - frozenPaneOffset;
    const isNewYBelowFrozenPane = newY < scrollInfo.offsetY + viewportY - frozenPaneOffset;

    if (isInitialYInFrozenPane && !isNewYInFrozenPane) {
      newY += scrollInfo.offsetY;
    } else if (!isInitialYInFrozenPane && isNewYBelowFrozenPane) {
      newY -= scrollInfo.offsetY;
    }
  }
  newY = Math.max(newY, 0);

  return { ...initialFigure, x: newX, y: newY };
}

export function dragFigureForResize(
  initialFigure: Figure,
  dirX: -1 | 0 | 1,
  dirY: -1 | 0 | 1,
  initialMousePosition: PixelPosition,
  currentMousePosition: PixelPosition
): Figure {
  const deltaX = dirX * (currentMousePosition.x - initialMousePosition.x);
  const deltaY = dirY * (currentMousePosition.y - initialMousePosition.y);

  let { width, height, x, y } = initialFigure;
  width = Math.max(initialFigure.width + deltaX, MIN_FIG_SIZE);
  height = Math.max(initialFigure.height + deltaY, MIN_FIG_SIZE);
  if (dirX < 0) {
    x = initialFigure.x - deltaX;
  }
  if (dirY < 0) {
    y = initialFigure.y - deltaY;
  }

  return { ...initialFigure, x, y, width, height };
}
