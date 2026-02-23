import { test, expect, type Page } from "@playwright/test";

const STORAGE_KEY = "quantvn-strategy-builder";
const AI_SUGGEST_MODE = (process.env.E2E_AI_SUGGEST_MODE || "mock").trim().toLowerCase();
const USE_MOCK = AI_SUGGEST_MODE !== "real";

const clearBuilderStorage = async (page: Page) => {
  await page.evaluate((key: string) => {
    window.localStorage.removeItem(key);
  }, STORAGE_KEY);
};

test.describe(`Strategy Builder AI Suggest (${USE_MOCK ? "mock" : "real"})`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/strategy-builder", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
    await clearBuilderStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Run Backtest" })).toBeVisible();
  });

  test("generates and applies an AI strategy", async ({ page }) => {
    test.setTimeout(USE_MOCK ? 60_000 : 180_000);

    if (USE_MOCK) {
      await page.route("**/api/ai/generate-strategy", async (route) => {
        const body = {
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
                  config: { stocks: ["VNM"], timeframe: "1d", startDate: "2024-01-01", endDate: "2024-12-31" },
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
              {
                id: "out",
                type: "output",
                position: { x: 1100, y: 100 },
                data: {
                  type: "output",
                  label: "Results",
                  config: { metrics: ["returns", "sharpe", "drawdown"] },
                },
              },
            ],
            edges: [
              { id: "e1", source: "ds", target: "ind" },
              { id: "e2", source: "ind", target: "out" },
            ],
          },
          latencyMs: 10,
          providerUsed: "mock",
          requestId: "mock-1",
        };

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
    }

    await page.getByRole("button", { name: "AI Suggest" }).click();
    await expect(page.getByText("AI Strategy Suggest")).toBeVisible();

    const prompt = USE_MOCK
      ? "Tao chien luoc RSI cho VNM"
      : "Tao chien luoc rat ngan gon, toi da 4 node, khong giai thich dai, chi thong so can thiet cho VNM";
    await page.getByLabel("Mo ta chien luoc").fill(prompt);
    await page.getByRole("button", { name: "Tao Chien Luoc" }).click();

    await expect(page.getByText("Chien Luoc Da Tao")).toBeVisible({ timeout: USE_MOCK ? 15_000 : 120_000 });
    await page.getByRole("button", { name: "Ap Dung Vao Strategy Builder" }).click();

    await expect(page.getByPlaceholder("Strategy name...")).not.toHaveValue("Untitled Strategy");
    await expect
      .poll(async () => {
        const text = await page.getByText(/Nodes:\s*\d+/i).first().textContent();
        const match = text?.match(/Nodes:\s*(\d+)/i);
        return match ? Number(match[1]) : 0;
      })
      .toBeGreaterThan(0);
  });
});
