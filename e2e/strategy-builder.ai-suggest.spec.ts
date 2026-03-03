import { test, expect, type Page } from "@playwright/test";

const STORAGE_KEY = "quantvn-strategy-builder";
const AI_SUGGEST_MODE = (process.env.E2E_AI_SUGGEST_MODE || "mock").trim().toLowerCase();
const USE_MOCK = AI_SUGGEST_MODE !== "real";

const clearBuilderStorage = async (page: Page) => {
  await page.addInitScript((key: string) => {
    window.localStorage.removeItem(key);
  }, STORAGE_KEY);
};

const readNodeCount = async (page: Page): Promise<number> => {
  const text = await page.getByText(/Nodes:\s*\d+/i).first().textContent();
  const match = text?.match(/Nodes:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
};

test.describe(`Strategy Builder AI Suggest (${USE_MOCK ? "mock" : "real"})`, () => {
  test.beforeEach(async ({ page }) => {
    await clearBuilderStorage(page);
    await page.goto("/strategy-builder", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  });

  test("generate mode: create and apply strategy", async ({ page }) => {
    test.setTimeout(USE_MOCK ? 60_000 : 180_000);

    if (USE_MOCK) {
      await page.route("**/api/ai/generate-strategy", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            strategy: {
              name: "AI Test Strategy",
              explanation: "test",
              nodes: [
                {
                  id: "ds",
                  type: "dataSource",
                  position: { x: 80, y: 100 },
                  data: {
                    type: "dataSource",
                    label: "Market Data",
                    config: { stocks: ["VNM"], timeframe: "1d" },
                  },
                },
                {
                  id: "ind",
                  type: "indicator",
                  position: { x: 340, y: 100 },
                  data: {
                    type: "indicator",
                    label: "RSI(14)",
                    config: { indicatorType: "rsi", period: 14 },
                  },
                },
              ],
              edges: [{ id: "e1", source: "ds", target: "ind" }],
            },
            latencyMs: 10,
            providerUsed: "mock",
            requestId: "mock-1",
          }),
        });
      });
    }

    await page.getByTestId("ai-suggest-open-button").click();
    await expect(page.getByTestId("ai-suggest-dialog")).toBeVisible();

    await page.getByLabel("Mo ta chien luoc").fill(
      USE_MOCK
        ? "Tao chien luoc RSI cho VNM"
        : "Tao chien luoc ngan gon cho VNM, toi da 4 node"
    );
    await page.getByRole("button", { name: "Tao Chien Luoc" }).click();

    await expect(page.getByText("Chien Luoc Da Tao")).toBeVisible({
      timeout: USE_MOCK ? 20_000 : 120_000,
    });

    await page.getByRole("button", { name: "Ap Dung Vao Strategy Builder" }).click();

    await expect
      .poll(async () => readNodeCount(page))
      .toBeGreaterThan(0);
  });

  test("edit mode: preview patch and apply", async ({ page }) => {
    await page.getByTestId("node-palette-item-dataSource").click();
    await expect
      .poll(async () => readNodeCount(page))
      .toBeGreaterThan(0);

    if (USE_MOCK) {
      await page.route("**/api/ai/strategy-patch", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            mode: "preview",
            patchedGraph: {
              name: "Patched Strategy",
              nodes: [
                {
                  id: "ds",
                  type: "dataSource",
                  position: { x: 80, y: 100 },
                  data: {
                    type: "dataSource",
                    label: "Data Source",
                    config: { stocks: ["VNM"], timeframe: "1d" },
                  },
                },
                {
                  id: "sig",
                  type: "signal",
                  position: { x: 800, y: 100 },
                  data: {
                    type: "signal",
                    label: "Buy Signal",
                    config: { signalType: "buy", condition: "RSI < 30" },
                  },
                },
              ],
              edges: [{ id: "e1", source: "ds", target: "sig" }],
            },
            diffSummary: ["Added 1 node(s).", "Added 1 edge(s)."],
            warnings: [],
            summary: "Added signal node.",
            issues: [],
            requestId: "patch-1",
            providerUsed: "mock",
            latencyMs: 10,
          }),
        });
      });
    }

    await page.getByTestId("ai-suggest-open-button").click();
    await expect(page.getByTestId("ai-suggest-dialog")).toBeVisible();
    await page.getByRole("button", { name: "Edit Graph" }).click();

    await page
      .getByTestId("ai-suggest-patch-prompt")
      .fill("Add a buy signal after data source and connect to output");
    await page.getByTestId("ai-suggest-preview-patch").click();

    await expect(page.getByText("Patch is valid and ready to apply.")).toBeVisible({
      timeout: USE_MOCK ? 15_000 : 120_000,
    });

    page.once("dialog", (dialog) => {
      void dialog.accept();
    });
    await page.getByTestId("ai-suggest-apply-patch").click();

    await expect
      .poll(async () => readNodeCount(page))
      .toBeGreaterThan(1);
  });
});
