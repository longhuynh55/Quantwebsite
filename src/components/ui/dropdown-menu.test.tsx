import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  function renderMenu(onSelect?: jest.Mock) {
    return render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onSelect}>First item</DropdownMenuItem>
          <DropdownMenuItem>Second item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  it("opens and closes when trigger is clicked", async () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Open menu" });

    fireEvent.click(trigger);
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("closes when clicking outside", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(await screen.findByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("supports keyboard navigation and escape close", async () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("menu");
    const firstItem = screen.getByRole("menuitem", { name: "First item" });
    const secondItem = screen.getByRole("menuitem", { name: "Second item" });

    await waitFor(() => {
      expect(firstItem).toHaveFocus();
    });

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(secondItem).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("calls item handler and closes menu on item click", async () => {
    const onSelect = jest.fn();
    renderMenu(onSelect);

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "First item" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});
