import {
  COMMAND_PALETTE_OPEN_EVENT,
  dispatchCommandPaletteOpenEvent,
} from "./commandPaletteEvents";

describe("commandPaletteEvents", () => {
  it("dispatches the open event on window", () => {
    const handler = jest.fn();
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);

    dispatchCommandPaletteOpenEvent();

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, handler);
  });
});
