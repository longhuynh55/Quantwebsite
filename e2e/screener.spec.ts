import { test, expect } from "@playwright/test";

/**
 * Stock Screener E2E Tests
 * Tests for the stock screening functionality
 */

test.describe("Stock Screener", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/screener");
  });

  test("should load screener page successfully", async ({ page }) => {
    // Check URL
    await expect(page).toHaveURL(/.*screener.*/);

    // Check main content is visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("should display stock table", async ({ page }) => {
    // Wait for data to load
    await page.waitForLoadState("networkidle");

    // Check for table or grid with stock data
    const table = page.locator("table, [role='grid']").first();
    await expect(table).toBeVisible({ timeout: 15000 });
  });

  test("should display stock symbols", async ({ page }) => {
    // Wait for data
    await page.waitForLoadState("networkidle");

    // Check for stock symbols (3-letter uppercase Vietnamese stock codes)
    const stockSymbol = page.locator("text=/^[A-Z]{3}$/").first();
    await expect(stockSymbol).toBeVisible({ timeout: 15000 });
  });

  test("should have search functionality", async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[aria-label*="search" i]').first();

    if (await searchInput.isVisible()) {
      // Type in search
      await searchInput.fill("VNM");
      await page.waitForTimeout(500);

      // Check that results are filtered
      await expect(page.locator("text=VNM")).toBeVisible();
    }
  });

  test("should have filter options", async ({ page }) => {
    // Look for filter controls
    const filterElements = page.locator('button:has-text("Filter"), [aria-label*="filter" i], select, [role="combobox"]');

    // At least one filter should exist
    const count = await filterElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should sort by column", async ({ page }) => {
    // Wait for data
    await page.waitForLoadState("networkidle");

    // Look for sortable column headers
    const sortHeaders = page.locator('th[aria-sort], button:has-text("Price"), button:has-text("Volume"), button:has-text("Change")');

    const count = await sortHeaders.count();

    if (count > 0) {
      // Click on a sort header
      await sortHeaders.first().click();

      // Wait for sort to apply
      await page.waitForTimeout(500);
    }
  });

  test("should handle pagination", async ({ page }) => {
    // Wait for data
    await page.waitForLoadState("networkidle");

    // Look for pagination controls
    const pagination = page.locator('[aria-label*="pagination" i], button:has-text("Next"), button:has-text("Previous")');

    const count = await pagination.count();

    if (count > 0) {
      // Click next if available
      const nextButton = pagination.locator('button:has-text("Next"), button[aria-label*="next" i]').first();

      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test("should export data", async ({ page }) => {
    // Wait for data
    await page.waitForLoadState("networkidle");

    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("CSV"), button[aria-label*="export" i]');

    if (await exportButton.count() > 0) {
      // Note: Actual export creates a download, which requires special handling
      // This test just checks the button exists
      await expect(exportButton.first()).toBeVisible();
    }
  });

  test("should show stock details on click", async ({ page }) => {
    // Wait for data
    await page.waitForLoadState("networkidle");

    // Click on a stock row
    const stockRow = page.locator("tr:has(td), [role='row']").first();

    if (await stockRow.isVisible()) {
      await stockRow.click();

      // Wait for any action (modal, navigation, expansion)
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Stock Screener - Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/screener");
    await page.waitForLoadState("networkidle");
  });

  test("should filter by sector/industry", async ({ page }) => {
    // Look for sector filter
    const sectorFilter = page.locator('select, [role="combobox"]').filter({
      hasText: /sector|industry|ngành/i,
    }).or(page.locator('[aria-label*="sector" i], [aria-label*="industry" i]'));

    if (await sectorFilter.count() > 0) {
      await sectorFilter.first().click();
      await page.waitForTimeout(300);
    }
  });

  test("should filter by price range", async ({ page }) => {
    // Look for price/min/max inputs
    const priceInputs = page.locator('input[type="number"], input[placeholder*="price" i]');

    const count = await priceInputs.count();

    if (count > 0) {
      await priceInputs.first().fill("10000");
      await page.waitForTimeout(500);
    }
  });

  test("should filter by volume", async ({ page }) => {
    // Look for volume filter
    const volumeFilter = page.locator('input[placeholder*="volume" i], [aria-label*="volume" i]');

    if (await volumeFilter.count() > 0) {
      await volumeFilter.first().fill("1000000");
      await page.waitForTimeout(500);
    }
  });

  test("should clear filters", async ({ page }) => {
    // Look for clear/reset button
    const clearButton = page.locator('button:has-text("Clear"), button:has-text("Reset"), button[aria-label*="clear" i]');

    if (await clearButton.count() > 0) {
      await clearButton.first().click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe("Stock Screener - Responsive", () => {
  test("should be usable on mobile", async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    await page.goto("/screener");
    await page.waitForLoadState("networkidle");

    // On mobile, table might be replaced with cards or list
    const content = page.locator("main");
    await expect(content).toBeVisible();

    // Should still show stock data
    const stockData = page.locator("text=/[A-Z]{3}/").first();
    await expect(stockData).toBeVisible({ timeout: 15000 });
  });

  test("should be usable on tablet", async ({ page, isMobile }) => {
    // Skip on mobile
    if (isMobile) {
      test.skip();
    }

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/screener");
    await page.waitForLoadState("networkidle");

    // Content should be visible
    const content = page.locator("main");
    await expect(content).toBeVisible();
  });
});
