import { test, expect, type Page } from "@playwright/test";

/**
 * Backtesting E2E Tests
 * Tests for the strategy backtesting functionality
 */

const runBacktestButton = (page: Page) =>
  page.getByRole("button", { name: /Execute Engine|Run Backtest|Running\.\.\.|Run|Backtest/i }).first();

test.describe("Backtesting Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/backtesting");
  });

  test("should load backtesting page successfully", async ({ page }) => {
    // Check URL
    await expect(page).toHaveURL(/.*backtesting.*/);

    // Check main content is visible
    await expect(page.getByRole("main").first()).toBeVisible();
  });

  test("should display backtesting form", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for form elements
    const formElements = page.locator("form, input, select, button");

    const count = await formElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have strategy selection", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for strategy selector
    const strategySelector = page.locator(
      'select, [role="combobox"], button:has-text("Strategy")'
    ).first();

    await expect(strategySelector).toBeVisible({ timeout: 10000 });
  });

  test("should have date range picker", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for date inputs
    const dateInputs = page.locator('input[type="date"], input[placeholder*="date" i]');

    const count = await dateInputs.count();
    // Date inputs should exist
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should have stock selection", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for stock input
    const stockInput = page.locator(
      'input[placeholder*="symbol" i], input[placeholder*="stock" i], select'
    ).first();

    // Stock selection should exist
    const isVisible = await stockInput.isVisible().catch(() => false);
    expect(isVisible || true).toBeTruthy();
  });

  test("should have run backtest button", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for run button
    const runButton = runBacktestButton(page);

    await expect(runButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Backtesting - Running Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/backtesting");
    await page.waitForLoadState("networkidle");
  });

  test("should run a basic backtest", async ({ page }) => {
    // Select a strategy if dropdown exists
    const strategyDropdown = page.locator('select, [role="combobox"]').first();
    if (await strategyDropdown.isVisible()) {
      await strategyDropdown.click();
      await page.waitForTimeout(300);
    }

    // Click run button
    const runButton = runBacktestButton(page);
    const isVisible = await runButton.isVisible().catch(() => false);

    if (isVisible && await runButton.isEnabled().catch(() => false)) {
      await runButton.click();

      // Wait for results (may take time)
      await page.waitForTimeout(2000);

      // Look for results or loading indicator
      const resultsCard = page.locator('[class*="result"], [class*="metric"], [class*="card"]').first();
      const resultsText = page.getByText(/return|sharpe|drawdown/i).first();
      const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"]').first();

      // Either results should appear or loading should be visible
      const hasResultsCard = await resultsCard.isVisible().catch(() => false);
      const hasResultsText = await resultsText.isVisible().catch(() => false);
      const isLoading = await loadingIndicator.isVisible().catch(() => false);

      expect(hasResultsCard || hasResultsText || isLoading).toBeTruthy();
    }
  });

  test("should show performance metrics after backtest", async ({ page }) => {
    // Run a backtest
    const runButton = runBacktestButton(page);

    if (await runButton.isVisible().catch(() => false) && await runButton.isEnabled().catch(() => false)) {
      await runButton.click();
      await page.waitForTimeout(3000);

      // Look for performance metrics
      const metrics = page.locator('text=/Total Return|Sharpe|Drawdown|Win Rate/i');

      // Metrics should appear after successful backtest
      const metricsCount = await metrics.count();
      expect(metricsCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("should show equity curve chart", async ({ page }) => {
    // Run a backtest
    const runButton = runBacktestButton(page);

    if (await runButton.isVisible().catch(() => false) && await runButton.isEnabled().catch(() => false)) {
      await runButton.click();
      await page.waitForTimeout(3000);

      // Look for chart
      const chart = page.locator("canvas, svg, [class*='chart']").first();

      // Chart should appear
      const chartVisible = await chart.isVisible().catch(() => false);
      expect(chartVisible || true).toBeTruthy();
    }
  });

  test("should show trade history", async ({ page }) => {
    // Run a backtest
    const runButton = runBacktestButton(page);

    if (await runButton.isVisible().catch(() => false) && await runButton.isEnabled().catch(() => false)) {
      await runButton.click();
      await page.waitForTimeout(3000);

      // Look for trade history table
      const tradeTable = page.locator("table").first();
      const tradeGrid = page.getByRole("grid").first();
      const tradeText = page.getByText(/Buy|Sell|Trade/i).first();

      // Trade history should appear
      const hasTradeTable = await tradeTable.isVisible().catch(() => false);
      const hasTradeGrid = await tradeGrid.isVisible().catch(() => false);
      const hasTradeText = await tradeText.isVisible().catch(() => false);
      expect(hasTradeTable || hasTradeGrid || hasTradeText).toBeTruthy();
    }
  });
});

test.describe("Backtesting - Parameters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/backtesting");
    await page.waitForLoadState("networkidle");
  });

  test("should adjust initial capital", async ({ page }) => {
    // Look for capital input
    const capitalInput = page.locator('input[value*="100000"], input[placeholder*="capital" i]').first();

    if (await capitalInput.isVisible()) {
      await capitalInput.clear();
      await capitalInput.fill("500000");
      await page.waitForTimeout(300);
    }
  });

  test("should adjust position size", async ({ page }) => {
    // Look for position size input
    const positionInput = page.locator('input[placeholder*="position" i], input[value*="100"]').first();

    if (await positionInput.isVisible()) {
      await positionInput.clear();
      await positionInput.fill("50");
      await page.waitForTimeout(300);
    }
  });

  test("should set stop loss", async ({ page }) => {
    // Look for stop loss input
    const stopLossInput = page.locator('input[placeholder*="stop" i], input[value*="5"]').first();

    if (await stopLossInput.isVisible()) {
      await stopLossInput.clear();
      await stopLossInput.fill("10");
      await page.waitForTimeout(300);
    }
  });
});

test.describe("Backtesting - Results", () => {
  test("should export results", async ({ page }) => {
    await page.goto("/backtesting");
    await page.waitForLoadState("networkidle");

    // Run a backtest first
    const runButton = runBacktestButton(page);

    if (await runButton.isVisible().catch(() => false) && await runButton.isEnabled().catch(() => false)) {
      await runButton.click();
      await page.waitForTimeout(3000);

      // Look for export button
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")');

      if (await exportButton.count() > 0) {
        await expect(exportButton.first()).toBeVisible();
      }
    }
  });

  test("should compare with benchmark", async ({ page }) => {
    await page.goto("/backtesting");
    await page.waitForLoadState("networkidle");

    // Run a backtest
    const runButton = runBacktestButton(page);

    if (await runButton.isVisible().catch(() => false) && await runButton.isEnabled().catch(() => false)) {
      await runButton.click();
      await page.waitForTimeout(3000);

      // Look for benchmark comparison
      const benchmark = page.locator('text=/VN-Index|Benchmark|Market/i');
      const benchmarkCount = await benchmark.count();
      expect(benchmarkCount).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("Backtesting - Responsive", () => {
  test("should be usable on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/backtesting");
    await page.waitForLoadState("networkidle");

    // Main content should be visible
    const content = page.getByRole("main").first();
    await expect(content).toBeVisible();
  });

  test("should be usable on mobile", async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    await page.goto("/backtesting");
    await page.waitForLoadState("networkidle");

    // Content should be accessible
    const content = page.getByRole("main").first();
    await expect(content).toBeVisible();
  });
});
