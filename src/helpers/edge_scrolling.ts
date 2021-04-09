import { Viewport, Zone } from "../types";

export const MAX_DELAY = 140;
const MIN_DELAY = 20;
const ACCELERATION = 0.035;

/**
 * Decreasing exponential function used to determine the "speed" of edge-scrolling
 * as the timeout delay.
 *
 * Returns a timeout delay in milliseconds.
 */
export function scrollDelay(value: number): number {
  // decreasing exponential from MAX_DELAY to MIN_DELAY
  return MIN_DELAY + (MAX_DELAY - MIN_DELAY) * Math.exp(-ACCELERATION * (value - 1));
}

/**
 * This function will compare the modifications of selection to determine
 * a cell that is part of the new zone and not the previous one.
 */
export function findCellInNewZone(
  oldZone: Zone,
  currentZone: Zone,
  viewport: Viewport
): [number, number] {
  let col: number, row: number;
  const { left: oldLeft, right: oldRight, top: oldTop, bottom: oldBottom } = oldZone!;
  const { left, right, top, bottom } = currentZone;
  if (left != oldLeft) {
    col = left;
  } else if (right != oldRight) {
    col = right;
  } else {
    col = viewport.left;
  }
  if (top != oldTop) {
    row = top;
  } else if (bottom != oldBottom) {
    row = bottom;
  } else {
    row = viewport.top;
  }
  return [col, row];
}
