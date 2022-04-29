import { nextTick } from "./helpers";

export async function simulateClick(selector: string, x: number = 10, y: number = 10) {
  const target = document.querySelector(selector)! as HTMLElement;
  triggerMouseEvent(selector, "mousedown", x, y);
  if (target !== document.activeElement) {
    (document.activeElement as HTMLElement | null)?.blur();
    target.focus();
  }
  triggerMouseEvent(selector, "mouseup", x, y);
  triggerMouseEvent(selector, "click", x, y);
  await nextTick();
}

export function triggerMouseEvent(
  selector: string | any,
  type: string,
  x?: number,
  y?: number,
  extra: any = { bubbles: true }
): void {
  const ev = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    ...extra,
  });
  (ev as any).offsetX = x;
  (ev as any).offsetY = y;
  (ev as any).pageX = x;
  (ev as any).pageY = y;
  if (typeof selector === "string") {
    document.querySelector(selector)!.dispatchEvent(ev);
  } else {
    selector!.dispatchEvent(ev);
  }
}

export function setInputValueAndTrigger(selector: string, value: string, eventType: string): void {
  const rangeInput = document.querySelector(selector) as HTMLInputElement;
  rangeInput.value = value;
  rangeInput.dispatchEvent(new Event(eventType));
}