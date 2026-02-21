import { fireEvent, render, screen } from "@testing-library/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("Tabs", () => {
  function renderTabs() {
    return render(
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview content</TabsContent>
        <TabsContent value="details">Details content</TabsContent>
        <TabsContent value="activity">Activity content</TabsContent>
      </Tabs>
    );
  }

  it("renders default active tab and panel", () => {
    renderTabs();

    const overviewTab = screen.getByRole("tab", { name: "Overview" });
    expect(overviewTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview content");
  });

  it("switches panel when clicking another tab", () => {
    renderTabs();

    fireEvent.click(screen.getByRole("tab", { name: "Details" }));

    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Details content");
    expect(screen.queryByText("Overview content")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation in tablist", () => {
    renderTabs();

    const tablist = screen.getByRole("tablist");
    const overviewTab = screen.getByRole("tab", { name: "Overview" });
    const detailsTab = screen.getByRole("tab", { name: "Details" });
    const activityTab = screen.getByRole("tab", { name: "Activity" });

    overviewTab.focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(detailsTab).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Details content");

    fireEvent.keyDown(tablist, { key: "End" });
    expect(activityTab).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Activity content");

    fireEvent.keyDown(tablist, { key: "Home" });
    expect(overviewTab).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Overview content");
  });
});
