import { test, expect, type Page } from "@playwright/test";

const STORAGE_KEY = "quantvn-strategy-builder";
const NODE_TYPE_BY_LABEL: Record<"Data Source" | "Indicator" | "Filter", string> = {
  "Data Source": "dataSource",
  Indicator: "indicator",
  Filter: "filter",
};

const canvas = (page: Page) => page.getByTestId("rf__wrapper");
const nodeCountLabel = (page: Page) => page.getByText(/Nodes:\s*\d+/).first();
const runErrorAlert = (page: Page) => page.locator('[role="alert"]').first();
const strategyNameInput = (page: Page) =>
  page.getByPlaceholder("Strategy name...");

const parseNodeCount = (raw: string | null): number => {
  const match = raw?.match(/Nodes:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};

const clearBuilderStorage = async (page: Page) => {
  await page.evaluate((key: string) => {
    window.localStorage.removeItem(key);
  }, STORAGE_KEY);
};

const gotoBuilder = async (page: Page) => {
  await page.goto("/strategy-builder", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/.*strategy-builder.*/);
  await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  await expect(canvas(page)).toHaveCount(1);
};

const applyTemplate = async (page: Page, templateName: string) => {
  const templateButton = page.locator("button").filter({ hasText: templateName }).first();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await templateButton.isVisible().catch(() => false)) {
      break;
    }
    await page.getByRole("button", { name: "Strategy Templates" }).click();
    await page.waitForTimeout(150);
  }
  await expect(templateButton).toBeVisible();
  await templateButton.click();
};

const addNodeFromPalette = async (page: Page, label: "Data Source" | "Indicator" | "Filter") => {
  const beforeCount = parseNodeCount(await nodeCountLabel(page).textContent());
  const paletteItem = page.locator('[draggable="true"]').filter({ hasText: label }).first();
  await expect(paletteItem).toBeVisible();

  // Fast path: click-to-add from palette.
  await paletteItem.click();

  const afterClickCount = parseNodeCount(await nodeCountLabel(page).textContent());
  if (afterClickCount > beforeCount) {
    return;
  }

  // Fallback: dispatch a React Flow drop event when click is intercepted.
  const nodeType = NODE_TYPE_BY_LABEL[label];
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
    { type: nodeType, target: { x: 280, y: 220 } }
  );

  await expect
    .poll(async () => parseNodeCount(await nodeCountLabel(page).textContent()), {
      timeout: 10000,
      intervals: [500],
    })
    .toBeGreaterThan(beforeCount);
};

test.describe("Strategy Builder Deep Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await gotoBuilder(page);
    await clearBuilderStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*strategy-builder.*/);
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
    await expect(canvas(page)).toHaveCount(1);
  });

  test("quick template populates builder and persists after save/reload", async ({ page }) => {
    await applyTemplate(page, "RSI Reversal");

    await expect
      .poll(async () => parseNodeCount(await nodeCountLabel(page).textContent()), {
        timeout: 10000,
        intervals: [500],
      })
      .toBeGreaterThanOrEqual(4);
    await expect(strategyNameInput(page)).toHaveValue("RSI Reversal");
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: /Save|Saving\.\.\./ })).toBeDisabled();
    await expect(page.getByText(/Last saved:/)).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/.*strategy-builder.*/);
    await expect
      .poll(async () => parseNodeCount(await nodeCountLabel(page).textContent()), {
        timeout: 20000,
        intervals: [500],
      })
      .toBeGreaterThanOrEqual(4);
    await expect(strategyNameInput(page)).toHaveValue("RSI Reversal");
  });

  test("editing data source properties updates node details on canvas", async ({ page }) => {
    await addNodeFromPalette(page, "Data Source");

    await expect
      .poll(async () => parseNodeCount(await nodeCountLabel(page).textContent()), {
        timeout: 10000,
        intervals: [500],
      })
      .toBe(1);

    const node = page.locator('[data-testid^="rf__node-"]').first();
    await expect(node).toHaveCount(1);
    await node.dispatchEvent("click");

    const stockInput = page.getByPlaceholder(/Type symbol \+ Enter|Add\.\.\./i).first();
    await stockInput.fill("FPT, VNM, HPG");
    await stockInput.press("Enter");

    const timeframeSelect = page
      .locator("label")
      .filter({ hasText: "Timeframe" })
      .locator("xpath=following-sibling::select[1]");
    await timeframeSelect.selectOption("1h");

    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill("2024-01-01");
    await dateInputs.nth(1).fill("2024-12-31");

    await expect
      .poll(async () => (await node.textContent()) ?? "", { timeout: 10000, intervals: [500] })
      .toContain("FPT, VNM, HPG");
    await expect
      .poll(async () => (await node.textContent()) ?? "", { timeout: 10000, intervals: [500] })
      .toContain("1h");
    await expect
      .poll(async () => (await node.textContent()) ?? "", { timeout: 10000, intervals: [500] })
      .toContain("2024-01-01");
    await expect
      .poll(async () => (await node.textContent()) ?? "", { timeout: 10000, intervals: [500] })
      .toContain("2024-12-31");
  });

  test("export downloads strategy json after editing", async ({ page }) => {
    await addNodeFromPalette(page, "Data Source");
    await expect
      .poll(async () => parseNodeCount(await nodeCountLabel(page).textContent()), {
        timeout: 10000,
        intervals: [500],
      })
      .toBe(1);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/i);
    expect(download.suggestedFilename()).toContain("untitled-strategy");
  });

  test("run backtest shows terminal feedback (status/result/error) in real flow", async ({ page }) => {
    await applyTemplate(page, "RSI Reversal");
    await expect
      .poll(async () => parseNodeCount(await nodeCountLabel(page).textContent()), {
        timeout: 10000,
        intervals: [500],
      })
      .toBeGreaterThanOrEqual(4);

    await page.getByRole("button", { name: "Run Backtest" }).click();

    await expect
      .poll(
        async () => {
          const hasResult = await page.getByText("Backtest Results").first().isVisible().catch(() => false);
          if (hasResult) return "result";

          const hasError = await runErrorAlert(page).isVisible().catch(() => false);
          if (hasError) return "error";

          const hasCancel = await page.getByRole("button", { name: "Cancel" }).isVisible().catch(() => false);
          if (hasCancel) {
            return "running";
          }

          return "pending";
        },
        { timeout: 100000, intervals: [1000] }
      )
      .not.toBe("pending");

    const cancelRun = page.getByRole("button", { name: "Cancel" });
    if (await cancelRun.isVisible().catch(() => false)) {
      await cancelRun.click();
      await expect(cancelRun).toBeHidden({ timeout: 30000 });
    } else {
      const hasResult = await page.getByText("Backtest Results").first().isVisible().catch(() => false);
      const hasError = await runErrorAlert(page).isVisible().catch(() => false);
      expect(hasResult || hasError).toBeTruthy();
    }
  });
});
