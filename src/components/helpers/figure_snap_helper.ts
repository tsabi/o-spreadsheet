import { FIGURE_BORDER_WIDTH } from "../../constants";
import { Figure, Pixel } from "../../types";

const SNAP_MARGIN: Pixel = 5;

type HorizontalBorderName = "top" | "bottom" | "vCenter";
type VerticalBorderName = "right" | "left" | "hCenter";

interface HorizontalBorderPosition {
  border: HorizontalBorderName;
  position: Pixel;
}

interface VerticalBorderPosition {
  border: VerticalBorderName;
  position: Pixel;
}

export interface VerticalSnapLine {
  matchedFigs: Figure[];
  x: Pixel;
  snapOffset: number;
}

export interface HorizontalSnapLine {
  matchedFigs: Figure[];
  y: Pixel;
  snapOffset: number;
}

export function snapForMove(figureToSnap: Figure, otherFigures: Figure[]) {
  const snappedFigure = { ...figureToSnap };

  const verticalSnapLine = getVerticalSnapLine(
    snappedFigure,
    ["left", "right", "hCenter"],
    otherFigures,
    ["left", "right", "hCenter"]
  );

  const horizontalSnapLine = getHorizontalSnapLine(
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

  const verticalSnapLine = getVerticalSnapLine(
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

  const horizontalSnapLine = getHorizontalSnapLine(
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
 * Get the position of horizontal borders for the given figure
 *
 * @param figure the figure
 * @param borders the list of border names to return the positions of
 */
function getHorizontalFigureBordersPositions(
  figure: Figure,
  borders: HorizontalBorderName[]
): HorizontalBorderPosition[] {
  const allBorders: HorizontalBorderPosition[] = [
    { border: "top", position: getBorderPosition(figure, "top") },
    { border: "vCenter", position: getBorderPosition(figure, "vCenter") },
    { border: "bottom", position: getBorderPosition(figure, "bottom") },
  ];
  return allBorders.filter((p) => borders.includes(p.border));
}

/**
 * Get the position of vertical borders for the given figure
 *
 * @param figure the figure
 * @param borders the list of border names to return the positions of
 */
function getVerticalFigureBorders(
  figure: Figure,
  borders: VerticalBorderName[]
): VerticalBorderPosition[] {
  const allBorders: VerticalBorderPosition[] = [
    { border: "left", position: getBorderPosition(figure, "left") },
    { border: "hCenter", position: getBorderPosition(figure, "hCenter") },
    { border: "right", position: getBorderPosition(figure, "right") },
  ];
  return allBorders.filter((p) => borders.includes(p.border));
}

/**
 * Get a horizontal snap line for the given figure, if the figure can snap to any other figure
 *
 * @param snapFigure figure to get the snap line for
 * @param bordersOfSnappedFigToMatch borders of the given figure to be considered to find a snap match
 * @param otherFigures figures to match against the snapped figure to find a snap line
 * @param bordersOfOtherFigsToMatch borders of the other figures to be considered to find a snap match
 */
function getHorizontalSnapLine(
  snapFigure: Figure,
  bordersOfSnappedFigToMatch: HorizontalBorderName[],
  otherFigures: Figure[],
  bordersOfOtherFigsToMatch: HorizontalBorderName[]
): HorizontalSnapLine | undefined {
  const snapFigureBorders = getHorizontalFigureBordersPositions(
    snapFigure,
    bordersOfSnappedFigToMatch
  );
  let closestSnap: HorizontalSnapLine | undefined = undefined;
  for (const matchedFig of otherFigures) {
    const matchedBorders = getHorizontalFigureBordersPositions(
      matchedFig,
      bordersOfOtherFigsToMatch
    );

    for (const snapFigureBorder of snapFigureBorders) {
      for (const matchedBorder of matchedBorders) {
        if (canSnap(snapFigureBorder.position, matchedBorder.position)) {
          const offset = snapFigureBorder.position - matchedBorder.position;

          if (closestSnap && offset === closestSnap.snapOffset) {
            closestSnap.matchedFigs.push(matchedFig);
          } else if (!closestSnap || Math.abs(offset) <= Math.abs(closestSnap.snapOffset)) {
            closestSnap = {
              matchedFigs: [matchedFig],
              y: matchedBorder.position,
              snapOffset: offset,
            };
          }
        }
      }
    }
  }
  return closestSnap;
}

/**
 * Get a vertical snap line for the given figure, if the figure can snap to any other figure
 *
 * @param snapFigure figure to get the snap line for
 * @param bordersOfSnappedFigToMatch borders of the given figure to be considered to find  snap match
 * @param otherFigures figures to match against the snapped figure to find a snap line
 * @param bordersOfOtherFigsToMatch borders of the other figures to be considered to find a snap match
 */
function getVerticalSnapLine(
  snapFigure: Figure,
  bordersOfSnappedFigToMatch: VerticalBorderName[],
  otherFigures: Figure[],
  bordersOfOtherFigsToMatch: VerticalBorderName[]
): VerticalSnapLine | undefined {
  const snapFigureBorders = getVerticalFigureBorders(snapFigure, bordersOfSnappedFigToMatch);
  let closestSnap: VerticalSnapLine | undefined = undefined;
  for (const matchedFig of otherFigures) {
    const matchedBorders = getVerticalFigureBorders(matchedFig, bordersOfOtherFigsToMatch);

    for (const snapFigureBorder of snapFigureBorders) {
      for (const matchedBorder of matchedBorders) {
        if (canSnap(snapFigureBorder.position, matchedBorder.position)) {
          const offset = snapFigureBorder.position - matchedBorder.position;

          if (closestSnap && offset === closestSnap.snapOffset) {
            closestSnap.matchedFigs.push(matchedFig);
          } else if (!closestSnap || Math.abs(offset) <= Math.abs(closestSnap.snapOffset)) {
            closestSnap = {
              matchedFigs: [matchedFig],
              x: matchedBorder.position,
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
function getBorderPosition(fig: Figure, border: HorizontalBorderName | VerticalBorderName): Pixel {
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
