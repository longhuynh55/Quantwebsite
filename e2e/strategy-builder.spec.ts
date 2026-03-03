import { test, expect, type Page } from "@playwright/test";

const STORAGE_KEY = "quantvn-strategy-builder";

const clearBuilderStorage = async (page: Page) => {
  await page.addInitScript((key: string) => {
    window.localStorage.removeItem(key);
  }, STORAGE_KEY);
};

const gotoStrategyBuilder = async (page: Page) => {
  await clearBuilderStorage(page);
  await page.goto("/strategy-builder", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/.*strategy-builder.*/);
  await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
};

const nodesCounter = (page: Page) => page.getByText(/Nodes:\s*\d+/).first();

const readNodeCount = async (page: Page): Promise<number> => {
  const text = await nodesCounter(page).textContent();
  const match = text?.match(/Nodes:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};

test.describe("Strategy Builder UI", () => {
  test.beforeEach(async ({ page }) => {
    await gotoStrategyBuilder(page);
  });

  test("loads key builder sections", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Components" })).toBeVisible();
    await expect(page.getByRole("button", { name: "AI Suggest" })).toBeVisible();
    await expect(page.locator('[data-testid="rf__wrapper"]')).toHaveCount(1);
  });

  test("adds a node from palette by click and updates counter", async ({ page }) => {
    const before = await readNodeCount(page);
    await page.getByTestId("node-palette-item-dataSource").click();

    await expect
      .poll(async () => readNodeCount(page))
      .toBeGreaterThan(before);
  });

  test("opens property panel for selected node and edits label", async ({ page }) => {
    await page.getByTestId("node-palette-item-indicator").click();
    await expect
      .poll(async () => readNodeCount(page))
      .toBeGreaterThan(0);

    const node = page.locator('[data-testid^="rf__node-"]').first();
    await expect(node).toBeVisible();
    await node.click();

    const labelInput = page.getByPlaceholder("Enter label...");
    await expect(labelInput).toBeVisible();
    await labelInput.fill("Momentum Indicator");
    await expect(labelInput).toHaveValue("Momentum Indicator");
  });

  test("creates new strategy and clears existing nodes", async ({ page }) => {
    await page.getByTestId("node-palette-item-dataSource").click();
    await expect
      .poll(async () => readNodeCount(page))
      .toBeGreaterThan(0);

    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "New" }).click();

    await expect(nodesCounter(page)).toHaveText(/Nodes:\s*0/);
  });

  test("shows mobile/tablet toggle controls", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole("button", { name: "Blocks" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Properties" })).toBeVisible();
  });
});
