import { FIGURE_BORDER_WIDTH } from "../../constants";
import { Figure, Pixel, Rect, UID } from "../../types";

const SNAP_MARGIN: Pixel = 5;

export type HSnapAxis = "top" | "bottom" | "vCenter";
export type VSnapAxis = "right" | "left" | "hCenter";

export interface SnapLine<T extends HSnapAxis | VSnapAxis> {
  matchedFigIds: UID[];
  position: Pixel;
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
 * @param figureToSnap figure to snap
 * @param otherFigures other figures the main figure can snap to
 */
export function snapForMove(figureToSnap: Figure, otherFigures: Figure[]): SnapReturn {
  const snappedFigure = { ...figureToSnap };

  const verticalSnapLine = getSnapLine(snappedFigure, ["left", "right", "hCenter"], otherFigures, [
    "left",
    "right",
    "hCenter",
  ]);

  const horizontalSnapLine = getSnapLine(
    snappedFigure,
    ["top", "bottom", "vCenter"],
    otherFigures,
    ["top", "bottom", "vCenter"]
  );

  snappedFigure.x -= verticalSnapLine?.snapOffset || 0;
  snappedFigure.y -= horizontalSnapLine?.snapOffset || 0;

  return { snappedFigure, verticalSnapLine, horizontalSnapLine };
}

/**
 * Try to snap the given figure to the other figures when resizing the figure, and return the snapped
 * figure and the possible snap lines, if any were found
 *
 * @param resizeDirX X direction of the resize. -1 : resize from the left border of the figure, 0 : no resize in X, 1 :
 * resize from the right border of the figure
 * @param resizeDirY Y direction of the resize. -1 : resize from the top border of the figure, 0 : no resize in Y, 1 :
 * resize from the bottom border of the figure
 * @param figureToSnap figure to snap
 * @param otherFigures other figures the main figure can snap to
 */
export function snapForResize(
  resizeDirX: -1 | 0 | 1,
  resizeDirY: -1 | 0 | 1,
  figureToSnap: Figure,
  otherFigures: Figure[]
): SnapReturn {
  const snappedFigure = { ...figureToSnap };

  // Vertical snap line
  const verticalSnapLine = getSnapLine(
    snappedFigure,
    [resizeDirX === -1 ? "left" : "right"],
    otherFigures,
    ["left", "right"]
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
    snappedFigure,
    [resizeDirY === -1 ? "top" : "bottom"],
    otherFigures,
    ["top", "bottom"]
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
function getFigureSnapAxisPositions<T extends HSnapAxis | VSnapAxis>(
  figure: Figure,
  snapAxes: T[]
): Pixel[] {
  return snapAxes.map((axis) => getSnapAxisPosition(figure, axis));
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
  figureToSnap: Figure,
  axesOfSnappedFigToMatch: T,
  otherFigures: Figure[],
  axesOfOtherFigsToMatch: T
): SnapLine<T[number]> | undefined {
  const snapFigureAxes = axesOfSnappedFigToMatch.map((axis) => ({
    position: getSnapAxisPosition(figureToSnap, axis),
    axis,
  }));

  let closestSnap: SnapLine<T[number]> | undefined = undefined;

  for (const matchedFig of otherFigures) {
    // const matchedAxesPositions = getFigureSnapAxisPositions(matchedFig, axesOfOtherFigsToMatch);
    const matchedAxes = axesOfOtherFigsToMatch.map((axis) => ({
      position: getSnapAxisPosition(matchedFig, axis),
      axis,
    }));

    for (const snapFigureAxis of snapFigureAxes) {
      for (const matchedAxis of matchedAxes) {
        if (!canSnap(snapFigureAxis.position, matchedAxis.position)) continue;

        const snapOffset = snapFigureAxis.position - matchedAxis.position;

        if (closestSnap && snapOffset === closestSnap.snapOffset) {
          closestSnap.matchedFigIds.push(matchedFig.id);
        } else if (!closestSnap || Math.abs(snapOffset) <= Math.abs(closestSnap.snapOffset)) {
          closestSnap = {
            matchedFigIds: [matchedFig.id],
            position: matchedAxis.position,
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

/** Get the position of a snap axis of a figure */
export function getSnapAxisPosition(fig: Rect, axis: HSnapAxis | VSnapAxis): Pixel {
  switch (axis) {
    case "top":
      return fig.y;
    case "bottom":
      return fig.y + fig.height + FIGURE_BORDER_WIDTH;
    case "vCenter":
      return fig.y + Math.ceil((fig.height + FIGURE_BORDER_WIDTH) / 2);
    case "left":
      return fig.x;
    case "right":
      return fig.x + fig.width + FIGURE_BORDER_WIDTH;
    case "hCenter":
      return fig.x + Math.ceil((fig.width + FIGURE_BORDER_WIDTH) / 2);
  }
}
