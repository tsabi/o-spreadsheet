import { FIGURE_BORDER_WIDTH } from "../../constants";
import { Figure, FIGURE_BORDER_SHIFT, Getters, Pixel, PixelPosition, UID } from "../../types";

const SNAP_MARGIN: Pixel = 5;

export type HSnapAxis = "top" | "bottom" | "vCenter";
export type VSnapAxis = "right" | "left" | "hCenter";

/**
 * We need two positions for the snap axis :
 *  - the position (core) of the axis in the figure. This is used to know whether or not the axis is
 *      displayed, or is hidden by the scroll/the frozen panes
 *  - the position in the DOM, which is used to find snap matches. We cannot use the core position for this,
 *      because figures partially in frozen panes aren't displayed at their actual coordinates
 */
type SnapAxisWithPosition<T extends HSnapAxis | VSnapAxis> = {
  axis: T;
  position: number;
  positionInDOM: number;
};

export interface SnapLine<T extends HSnapAxis | VSnapAxis> {
  matchedFigIds: UID[];
  snapOffset: number;
  snappedAxis: T;
}

interface SnapReturn {
  snappedFigure: Figure;
  verticalSnapLine?: SnapLine<VSnapAxis>;
  horizontalSnapLine?: SnapLine<HSnapAxis>;
}

/**
 * Try to snap the given figure to other figures when moving the figure, and return the snapped
 * figure and the possible snap lines, if any were found
 *
 * @param getters the getters
 * @param figureToSnap figure to snap
 * @param otherFigures other figures the main figure can snap to
 */
export function snapForMove(
  getters: Getters,
  figureToSnap: Figure,
  otherFigures: Figure[]
): SnapReturn {
  const snappedFigure = { ...figureToSnap };

  const verticalSnapLine = getSnapLine(
    getters,
    snappedFigure,
    ["hCenter", "right", "left"],
    otherFigures,
    ["hCenter", "right", "left"]
  );

  const horizontalSnapLine = getSnapLine(
    getters,
    snappedFigure,
    ["vCenter", "bottom", "top"],
    otherFigures,
    ["vCenter", "bottom", "top"]
  );

  snappedFigure.x -= verticalSnapLine?.snapOffset || 0;
  snappedFigure.y -= horizontalSnapLine?.snapOffset || 0;

  return { snappedFigure, verticalSnapLine, horizontalSnapLine };
}

/**
 * Try to snap the given figure to the other figures when resizing the figure, and return the snapped
 * figure and the possible snap lines, if any were found
 *
 * @param getters the getters
 * @param resizeDirX X direction of the resize. -1 : resize from the left border of the figure, 0 : no resize in X, 1 :
 * resize from the right border of the figure
 * @param resizeDirY Y direction of the resize. -1 : resize from the top border of the figure, 0 : no resize in Y, 1 :
 * resize from the bottom border of the figure
 * @param figureToSnap figure to snap
 * @param otherFigures other figures the main figure can snap to
 */
export function snapForResize(
  getters: Getters,
  resizeDirX: -1 | 0 | 1,
  resizeDirY: -1 | 0 | 1,
  figureToSnap: Figure,
  otherFigures: Figure[]
): SnapReturn {
  const snappedFigure = { ...figureToSnap };

  // Vertical snap line
  const verticalSnapLine = getSnapLine(
    getters,
    snappedFigure,
    [resizeDirX === -1 ? "left" : "right"],
    otherFigures,
    ["right", "left"]
  );
  if (verticalSnapLine) {
    if (resizeDirX === 1) {
      snappedFigure.width -= verticalSnapLine.snapOffset;
    } else if (resizeDirX === -1) {
      snappedFigure.x -= verticalSnapLine.snapOffset;
      snappedFigure.width += verticalSnapLine.snapOffset;
    }
  }

  // Horizontal snap line
  const horizontalSnapLine = getSnapLine(
    getters,
    snappedFigure,
    [resizeDirY === -1 ? "top" : "bottom"],
    otherFigures,
    ["bottom", "top"]
  );
  if (horizontalSnapLine) {
    if (resizeDirY === 1) {
      snappedFigure.height -= horizontalSnapLine.snapOffset;
    } else if (resizeDirY === -1) {
      snappedFigure.y -= horizontalSnapLine.snapOffset;
      snappedFigure.height += horizontalSnapLine.snapOffset;
    }
  }

  snappedFigure.x = Math.round(snappedFigure.x);
  snappedFigure.y = Math.round(snappedFigure.y);
  snappedFigure.height = Math.round(snappedFigure.height);
  snappedFigure.width = Math.round(snappedFigure.width);

  return { snappedFigure, verticalSnapLine, horizontalSnapLine };
}

/**
 * Get the position of snap axes for the given figure
 *
 * @param figure the figure
 * @param snapAxes the list of snap axis to return the positions of
 */
function getFigureVisibleSnapAxes<T extends HSnapAxis | VSnapAxis>(
  getters: Getters,
  figure: Figure,
  snapAxes: T[]
): SnapAxisWithPosition<T>[] {
  const axes = snapAxes.map((axis) => getSnapAxisPosition(getters, figure, axis));
  return axes.filter((axis) => isSnapAxisVisible(getters, figure, axis));
}

function isSnapAxisVisible<T extends HSnapAxis | VSnapAxis>(
  getters: Getters,
  figure: Figure,
  snapAxis: SnapAxisWithPosition<T>
): boolean {
  const { x: mainViewportX, y: mainViewportY } = getters.getMainViewportCoordinates();

  const isFigureInFrozenPane = figure.y < mainViewportY || figure.x < mainViewportX;

  if (isFigureInFrozenPane) return true;

  const axisStartEndPositions: PixelPosition[] = [];
  switch (snapAxis.axis) {
    case "top":
    case "bottom":
    case "vCenter":
      axisStartEndPositions.push({ x: figure.x, y: snapAxis.position });
      axisStartEndPositions.push({ x: figure.x + figure.width, y: snapAxis.position });
      break;
    case "left":
    case "right":
    case "hCenter":
      axisStartEndPositions.push({ x: snapAxis.position, y: figure.y });
      axisStartEndPositions.push({ x: snapAxis.position, y: figure.y + figure.height });
      break;
  }

  return axisStartEndPositions.some(getters.isPositionVisible);
}

/**
 * Get a snap line for the given figure, if the figure can snap to any other figure
 *
 * @param figureToSnap figure to get the snap line for
 * @param axesOfSnappedFigToMatch snap axes of the given figure to be considered to find a snap line
 * @param otherFigures figures to match against the snapped figure to find a snap line
 * @param axesOfOtherFigsToMatch snap axes of the other figures to be considered to find a snap line
 */

function getSnapLine<T extends HSnapAxis[] | VSnapAxis[]>(
  getters: Getters,
  figureToSnap: Figure,
  axesOfSnappedFigToMatch: T,
  otherFigures: Figure[],
  axesOfOtherFigsToMatch: T
): SnapLine<T[number]> | undefined {
  const snapFigureAxes = getFigureVisibleSnapAxes(getters, figureToSnap, axesOfSnappedFigToMatch);

  let closestSnap: SnapLine<T[number]> | undefined = undefined;

  for (const matchedFig of otherFigures) {
    const matchedAxes = getFigureVisibleSnapAxes(getters, matchedFig, axesOfOtherFigsToMatch);
    for (const snapFigureAxis of snapFigureAxes) {
      for (const matchedAxis of matchedAxes) {
        if (!canSnap(snapFigureAxis.positionInDOM, matchedAxis.positionInDOM)) continue;

        const snapOffset = snapFigureAxis.positionInDOM - matchedAxis.positionInDOM;

        if (closestSnap && snapOffset === closestSnap.snapOffset) {
          closestSnap.matchedFigIds.push(matchedFig.id);
        } else if (!closestSnap || Math.abs(snapOffset) <= Math.abs(closestSnap.snapOffset)) {
          closestSnap = {
            matchedFigIds: [matchedFig.id],
            snapOffset,
            snappedAxis: snapFigureAxis.axis,
          };
        }
      }
    }
  }
  return closestSnap;
}

/** Check if two snap axes are close enough to snap */
function canSnap(snapAxisPosition1: Pixel, snapAxisPosition2: Pixel) {
  return Math.abs(snapAxisPosition1 - snapAxisPosition2) <= SNAP_MARGIN;
}

/** Get the core and DOM position of a snap axis of a figure */
export function getSnapAxisPosition<T extends HSnapAxis | VSnapAxis>(
  getters: Getters,
  fig: Figure,
  axis: T
): SnapAxisWithPosition<T> {
  let position = 0;
  let positionInDOM = 0;
  const figInDom = getFigureInDOM(getters, fig);
  switch (axis) {
    case "top":
      position = fig.y;
      positionInDOM = figInDom.y;
      break;
    case "bottom":
      position = fig.y + fig.height + FIGURE_BORDER_WIDTH;
      positionInDOM = figInDom.y + figInDom.height + FIGURE_BORDER_WIDTH;
      break;
    case "vCenter":
      position = fig.y + Math.ceil((fig.height + FIGURE_BORDER_WIDTH) / 2);
      positionInDOM = figInDom.y + Math.ceil((figInDom.height + FIGURE_BORDER_WIDTH) / 2);
      break;
    case "left":
      position = fig.x;
      positionInDOM = figInDom.x;
      break;
    case "right":
      position = fig.x + fig.width + FIGURE_BORDER_WIDTH;
      positionInDOM = figInDom.x + figInDom.width + FIGURE_BORDER_WIDTH;
      break;
    case "hCenter":
      position = fig.x + Math.ceil((fig.width + FIGURE_BORDER_WIDTH) / 2);
      positionInDOM = figInDom.x + Math.ceil((figInDom.width + FIGURE_BORDER_WIDTH) / 2);
      break;
  }

  return { position, positionInDOM, axis };
}

/**
 * Return a figure with its coordinates translated in DOM coordinates.
 *
 * The figure is translated by the scroll of the sheet, except if the figure is in a frozen pane.
 * */
function getFigureInDOM(getters: Getters, figure: Figure): Figure {
  const { x: offsetCorrectionX, y: offsetCorrectionY } = getters.getMainViewportCoordinates();
  const { offsetX: scrollX, offsetY: scrollY } = getters.getActiveSheetScrollInfo();

  const figInDOM = { ...figure };

  if (figure.x + FIGURE_BORDER_SHIFT >= offsetCorrectionX) {
    figInDOM.x -= scrollX;
  }

  if (figure.y + FIGURE_BORDER_SHIFT >= offsetCorrectionY) {
    figInDOM.y -= scrollY;
  }
  return figInDOM;
}
