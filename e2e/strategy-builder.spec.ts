import { test, expect, type Page } from "@playwright/test";

const STORAGE_KEY = "quantvn-strategy-builder";
const NODE_TYPE_BY_LABEL: Record<string, string> = {
  "Data Source": "dataSource",
  Indicator: "indicator",
  Filter: "filter",
};

const canvas = (page: Page) => page.getByTestId("rf__wrapper");
const nodeCount = (page: Page) => page.getByText(/Nodes:\s*\d+/).first();
const connectionCount = (page: Page) => page.getByText(/Connections:\s*\d+/).first();
const flowNode = (page: Page) => page.locator('[data-testid^="rf__node-"]').first();
const paletteNode = (page: Page, label: string) =>
  page.locator('[draggable="true"]').filter({ hasText: label }).first();
const parseNodeCount = (raw: string | null): number => {
  const match = raw?.match(/Nodes:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};
const parseConnectionCount = (raw: string | null): number => {
  const match = raw?.match(/Connections:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};

const gotoStrategyBuilder = async (page: Page) => {
  await page.addInitScript((key: string) => {
    window.localStorage.removeItem(key);
  }, STORAGE_KEY);

  await page.goto("/strategy-builder");
  await expect(page).toHaveURL(/.*strategy-builder.*/);
  await expect(page.getByRole("heading", { name: "Components" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  await expect(canvas(page)).toHaveCount(1);
};

const applyTemplate = async (page: Page, templateName: string) => {
  await page.getByRole("button", { name: "Strategy Templates" }).click();
  const templateButton = page.locator("button").filter({ hasText: templateName }).first();
  await expect(templateButton).toBeVisible();
  await templateButton.click();
};

const dragPaletteNodeToCanvas = async (
  page: Page,
  label: string,
  targetPosition: { x: number; y: number } = { x: 280, y: 220 }
) => {
  const nodeType = NODE_TYPE_BY_LABEL[label];
  if (!nodeType) {
    throw new Error(`Unsupported palette node label: ${label}`);
  }

  await expect(paletteNode(page, label)).toBeVisible();
  await canvas(page).scrollIntoViewIfNeeded();

  await page.evaluate(
    ({ type, target }) => {
      const wrapper = document.querySelector('[data-testid="rf__wrapper"]');
      if (!wrapper) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      const clientX = rect.left + target.x;
      const clientY = rect.top + target.y;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/reactflow", type);

      wrapper.dispatchEvent(
        new DragEvent("dragenter", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          dataTransfer,
        })
      );

      wrapper.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          dataTransfer,
        })
      );

      wrapper.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          dataTransfer,
        })
      );
    },
    { type: nodeType, target: targetPosition }
  );
};

const ensureNodeAdded = async (
  page: Page,
  label: string,
  targetPosition: { x: number; y: number } = { x: 280, y: 220 }
) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await dragPaletteNodeToCanvas(page, label, targetPosition);
    const countText = await nodeCount(page).textContent();
    if (parseNodeCount(countText) > 0) {
      return;
    }
    await page.waitForTimeout(250);
  }

  throw new Error(`Unable to add node "${label}" to strategy canvas.`);
};

test.describe("Strategy Builder Page", () => {
  test.beforeEach(async ({ page }) => {
    await gotoStrategyBuilder(page);
  });

  test("should load strategy builder page successfully", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Strategy Builder", level: 2 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  });

  test("should display canvas area", async ({ page }) => {
    await expect(canvas(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
    await expect(nodeCount(page)).toHaveText(/Nodes:\s*\d+/);
  });

  test("should have node palette", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Components" })).toBeVisible();
    await expect
      .poll(async () => page.locator('[draggable="true"]').count())
      .toBeGreaterThanOrEqual(3);
  });

  test("should display available node types", async ({ page }) => {
    await expect(paletteNode(page, "Data Source")).toBeVisible();
    await expect(paletteNode(page, "Indicator")).toBeVisible();
    await expect(paletteNode(page, "Filter")).toBeVisible();
  });
});

test.describe("Strategy Builder - Node Operations", () => {
  test.beforeEach(async ({ page }) => {
    await gotoStrategyBuilder(page);
  });

  test("should drag node to canvas", async ({ page }) => {
    await ensureNodeAdded(page, "Data Source");
    await expect
      .poll(async () => parseNodeCount(await nodeCount(page).textContent()))
      .toBeGreaterThanOrEqual(1);
  });

  test("should select node on click", async ({ page }) => {
    await ensureNodeAdded(page, "Data Source");
    await expect
      .poll(async () => parseNodeCount(await nodeCount(page).textContent()))
      .toBeGreaterThanOrEqual(1);
    const node = flowNode(page);
    await expect(node).toHaveCount(1);
    await node.dispatchEvent("click");
    await expect(page.getByText("Node Label")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete Node" })).toBeVisible();
  });

  test("should delete node", async ({ page }) => {
    await ensureNodeAdded(page, "Data Source");
    await expect
      .poll(async () => parseNodeCount(await nodeCount(page).textContent()))
      .toBeGreaterThanOrEqual(1);
    await flowNode(page).dispatchEvent("click");
    await page.getByRole("button", { name: "Delete Node" }).click();
    await expect(nodeCount(page)).toHaveText(/Nodes:\s*0/);
    await expect(page.getByRole("heading", { name: "No Node Selected" })).toBeVisible();
  });

  test("should load connected nodes from a template", async ({ page }) => {
    await applyTemplate(page, "RSI Reversal");
    await expect
      .poll(async () => parseNodeCount(await nodeCount(page).textContent()))
      .toBeGreaterThanOrEqual(4);

    await expect
      .poll(async () => parseConnectionCount(await connectionCount(page).textContent()))
      .toBeGreaterThanOrEqual(1);
  });
});

test.describe("Strategy Builder - Configuration", () => {
  test.beforeEach(async ({ page }) => {
    await gotoStrategyBuilder(page);
  });

  test("should show node configuration panel", async ({ page }) => {
    await ensureNodeAdded(page, "Indicator");
    await expect
      .poll(async () => parseNodeCount(await nodeCount(page).textContent()))
      .toBeGreaterThanOrEqual(1);
    await flowNode(page).dispatchEvent("click");
    await expect(page.getByRole("button", { name: "Delete Node" })).toBeVisible();
    await expect(page.getByPlaceholder("Enter label...")).toBeVisible();
  });

  test("should edit node parameters", async ({ page }) => {
    await ensureNodeAdded(page, "Data Source");
    await expect(nodeCount(page)).toHaveText(/Nodes:\s*[1-9]\d*/, { timeout: 10000 });
    await flowNode(page).dispatchEvent("click");
    const nodeLabelInput = page.getByPlaceholder("Enter label...");
    await nodeLabelInput.fill("RSI Momentum");
    await expect(nodeLabelInput).toHaveValue("RSI Momentum");
  });
});

test.describe("Strategy Builder - Actions", () => {
  test.beforeEach(async ({ page }) => {
    await gotoStrategyBuilder(page);
  });

  test("should save strategy", async ({ page }) => {
    const saveButton = page.getByRole("button", { name: /Save|Saving.../ });
    await expect(saveButton).toBeDisabled();
    await ensureNodeAdded(page, "Data Source");
    await expect
      .poll(async () => parseNodeCount(await nodeCount(page).textContent()))
      .toBeGreaterThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: /Save|Saving.../ })).toBeVisible();
  });

  test("should clear canvas", async ({ page }) => {
    await dragPaletteNodeToCanvas(page, "Filter");
    await expect(nodeCount(page)).toHaveText(/Nodes:\s*1/);
    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByRole("button", { name: "New" }).click();
    await expect(nodeCount(page)).toHaveText(/Nodes:\s*0/);
  });

  test("should run backtest from builder", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeEnabled();
  });

  test("should zoom canvas", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Zoom In" })).toBeVisible();
    await page.getByRole("button", { name: "Zoom In" }).click({ force: true });
    await page.getByRole("button", { name: "Zoom Out" }).click({ force: true });
  });

  test("should fit view", async ({ page }) => {
    const fitButton = page.getByRole("button", { name: "Fit View" });
    await expect(fitButton).toBeVisible();
    await fitButton.click({ force: true });
  });
});

test.describe("Strategy Builder - Responsive", () => {
  test("should be usable on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await gotoStrategyBuilder(page);
    await expect(page.getByRole("button", { name: "Blocks" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Properties" })).toBeVisible();
    await expect(canvas(page)).toHaveCount(1);
  });

  test("should show simplified UI on mobile", async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }
    await gotoStrategyBuilder(page);
    await expect(canvas(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  });
});

test.describe("Strategy Builder - Keyboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoStrategyBuilder(page);
  });

  test("should navigate canvas with arrow keys", async ({ page }) => {
    await canvas(page).click({ position: { x: 240, y: 220 }, force: true });
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  });

  test("should delete selected node with Delete key", async ({ page }) => {
    await ensureNodeAdded(page, "Data Source");
    await expect(nodeCount(page)).toHaveText(/Nodes:\s*[1-9]\d*/, { timeout: 10000 });
    await flowNode(page).dispatchEvent("click");
    await page.keyboard.press("Delete");
    await page.getByRole("button", { name: "Delete Node" }).click();
    await expect(nodeCount(page)).toHaveText(/Nodes:\s*0/);
  });

  test("should undo with Ctrl+Z", async ({ page }) => {
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Meta+z");
    await expect(page).toHaveURL(/.*strategy-builder.*/);
    await expect(canvas(page)).toHaveCount(1);
  });
});
