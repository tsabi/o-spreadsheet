import { FIGURE_BORDER_WIDTH } from "../../constants";
import { Figure, Pixel } from "../../types";

const SNAP_MARGIN: Pixel = 5;

type SnappingAxis = "top" | "bottom" | "vCenter" | "right" | "left" | "hCenter";

interface BorderPosition {
  border: SnappingAxis;
  position: Pixel;
}

export interface SnapLine {
  matchedFigs: Figure[];
  position: Pixel;
  snapOffset: number;
}

export function snapForMove(figureToSnap: Figure, otherFigures: Figure[]) {
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

export function snapForResize(
  resizeDirX: -1 | 0 | 1,
  resizeDirY: -1 | 0 | 1,
  figureToSnap: Figure,
  otherFigures: Figure[]
) {
  const snappedFigure = { ...figureToSnap };

  const verticalSnapLine = getSnapLine(
    snappedFigure,
    [resizeDirX < 0 ? "left" : "right"],
    otherFigures,
    ["left", "right"]
  );
  if (verticalSnapLine) {
    if (resizeDirX > 0) {
      snappedFigure.width -= verticalSnapLine.snapOffset;
    } else if (resizeDirX < 0) {
      snappedFigure.x -= verticalSnapLine.snapOffset;
      snappedFigure.width += verticalSnapLine.snapOffset;
    }
  }

  const horizontalSnapLine = getSnapLine(
    snappedFigure,
    [resizeDirY < 0 ? "top" : "bottom"],
    otherFigures,
    ["top", "bottom"]
  );
  if (horizontalSnapLine) {
    if (resizeDirY > 0) {
      snappedFigure.height -= horizontalSnapLine.snapOffset;
    } else if (resizeDirY < 0) {
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
 * Get the position of borders for the given figure
 *
 * @param figure the figure
 * @param borders the list of border names to return the positions of
 */
function getFigureBordersPositions(figure: Figure, borders: SnappingAxis[]): BorderPosition[] {
  return borders.map((border) => ({ border, position: getBorderPosition(figure, border) }));
}

/**
 * Get a snap line for the given figure, if the figure can snap to any other figure
 *
 * @param snapFigure figure to get the snap line for
 * @param bordersOfSnappedFigToMatch borders of the given figure to be considered to find a snap match
 * @param otherFigures figures to match against the snapped figure to find a snap line
 * @param bordersOfOtherFigsToMatch borders of the other figures to be considered to find a snap match
 */
function getSnapLine(
  snapFigure: Figure,
  bordersOfSnappedFigToMatch: SnappingAxis[],
  otherFigures: Figure[],
  bordersOfOtherFigsToMatch: SnappingAxis[]
): SnapLine | undefined {
  const snapFigureBorders = getFigureBordersPositions(snapFigure, bordersOfSnappedFigToMatch);
  let closestSnap: SnapLine | undefined = undefined;
  for (const matchedFig of otherFigures) {
    const matchedBorders = getFigureBordersPositions(matchedFig, bordersOfOtherFigsToMatch);

    for (const snapFigureBorder of snapFigureBorders) {
      for (const matchedBorder of matchedBorders) {
        if (canSnap(snapFigureBorder.position, matchedBorder.position)) {
          const offset = snapFigureBorder.position - matchedBorder.position;

          if (closestSnap && Math.abs(offset) === Math.abs(closestSnap.snapOffset)) {
            closestSnap.matchedFigs.push(matchedFig);
          } else if (!closestSnap || Math.abs(offset) <= Math.abs(closestSnap.snapOffset)) {
            closestSnap = {
              matchedFigs: [matchedFig],
              position: matchedBorder.position,
              snapOffset: offset,
            };
          }
        }
      }
    }
  }
  return closestSnap;
}

/** Check if two borders are close enough to snap */
function canSnap(borderPosition1: Pixel, borderPosition2: Pixel) {
  return Math.abs(borderPosition1 - borderPosition2) <= SNAP_MARGIN;
}

/** Get the position of a border of a figure */
function getBorderPosition(fig: Figure, border: SnappingAxis): Pixel {
  switch (border) {
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
