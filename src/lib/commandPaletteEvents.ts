export const COMMAND_PALETTE_OPEN_EVENT = "quantvn:command-palette-open";

export function dispatchCommandPaletteOpenEvent() {
  window.dispatchEvent(new Event(COMMAND_PALETTE_OPEN_EVENT));
}
