import { Pixel, UID } from ".";

export interface Figure {
  id: UID;
  x: Pixel;
  y: Pixel;
  width: Pixel;
  height: Pixel;
  tag: string;
}

export const ANCHOR_SIZE = 8;

/**
 * Visually, the content of the figure container is slightly shifted as it includes borders and/or corners.
 * If we want to make assertions on the position of the content, we need to take this shift into account
 */
export const FIGURE_BORDER_SHIFT = ANCHOR_SIZE / 2;
