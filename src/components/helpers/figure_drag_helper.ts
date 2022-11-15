import { MIN_FIG_SIZE } from "../../constants";
import { Figure, PixelPosition, SheetScrollInfo } from "../../types";

export function dragFigureForMove(
  initialMousePosition: PixelPosition,
  currentMousePosition: PixelPosition,
  initialFigure: Figure,
  mainViewportOffset: PixelPosition,
  scrollInfo: SheetScrollInfo
) {
  const initialMouseX = initialMousePosition.x;
  const mouseX = currentMousePosition.x;
  const viewportOffsetX = mainViewportOffset.x;

  const initialMouseY = initialMousePosition.y;
  const mouseY = currentMousePosition.y;
  const viewportOffsetY = mainViewportOffset.y;

  let deltaX = initialMouseX - mouseX;
  // Put the figure on the frozen pane if the mouse is over the pane
  if (mouseX > viewportOffsetX && initialMouseX < viewportOffsetX) {
    deltaX -= scrollInfo.offsetX;
  } else if (mouseX < viewportOffsetX && initialMouseX > viewportOffsetX) {
    deltaX += scrollInfo.offsetX;
  }

  let deltaY = initialMouseY - mouseY;

  // Put the figure on the frozen pane if the mouse is over the pane
  if (mouseY > viewportOffsetY && initialMouseY < viewportOffsetY) {
    deltaY -= scrollInfo.offsetY;
  } else if (mouseY < viewportOffsetY && initialMouseY > viewportOffsetY) {
    deltaY += scrollInfo.offsetY;
  }

  const x = Math.max(initialFigure.x - deltaX, 0);
  const y = Math.max(initialFigure.y - deltaY, 0);

  return { ...initialFigure, x, y };
}

export function dragFigureForResize(
  initialFigure: Figure,
  dirX: -1 | 0 | 1,
  dirY: -1 | 0 | 1,
  initialMousePosition: PixelPosition,
  currentMousePosition: PixelPosition
) {
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
