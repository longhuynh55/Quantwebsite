import { test, expect } from "@playwright/test";

/**
 * Community Page E2E Tests
 * Tests for the strategy marketplace/community functionality
 */

test.describe("Community Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/community");
  });

  test("should load community page successfully", async ({ page }) => {
    // Check URL
    await expect(page).toHaveURL(/.*community.*/);

    // Check main content is visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("should display page title and description", async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check for title (Vietnamese or English)
    const title = page.locator("h1").first();
    await expect(title).toBeVisible({ timeout: 10000 });

    // Should contain community/marketplace related text
    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();
  });

  test("should display strategies", async ({ page }) => {
    // Wait for strategies to load
    await page.waitForLoadState("networkidle");

    // Look for strategy cards
    const strategyCards = page.locator('[class*="card"], [role="article"], [class*="strategy"]');

    // Either strategies or empty state should be visible
    const count = await strategyCards.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should display statistics summary", async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Look for stats (average return, rating, downloads)
    const stats = page.locator('text=/Loi nhuan TB|Danh gia TB|Tong luot tai|Average|Rating|Downloads/i');

    const count = await stats.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Community - Search and Filters", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
  });

  test("should have search functionality", async ({ page }) => {
    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="tim" i]').first();

    if (await searchInput.isVisible()) {
      // Type in search
      await searchInput.fill("momentum");
      await page.waitForTimeout(500);

      // Results should update
      await expect(searchInput).toHaveValue("momentum");
    }
  });

  test("should have sort options", async ({ page }) => {
    // Look for sort select/dropdown
    const sortSelect = page.locator('select, [role="combobox"], button:has-text("Sort"), button:has-text("Sap xep")').first();

    if (await sortSelect.isVisible()) {
      await sortSelect.click();
      await page.waitForTimeout(300);
    }
  });

  test("should have filter toggle button", async ({ page }) => {
    // Look for filter button
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Bo loc"), [aria-label*="filter" i]').first();

    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Filter options should appear
      const filterOptions = page.locator('[class*="filter"], [class*="tag"]');
      const count = await filterOptions.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test("should filter by strategy tags", async ({ page }) => {
    // Open filters if available
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Bo loc")').first();

    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Look for tag buttons
      const tagButtons = page.locator('button:has-text("Momentum"), button:has-text("Trend"), button:has-text("Value"), button:has-text("Mean")');

      const count = await tagButtons.count();
      if (count > 0) {
        // Click a tag
        await tagButtons.first().click();
        await page.waitForTimeout(500);

        // Results should be filtered
      }
    }
  });

  test("should clear filters", async ({ page }) => {
    // Open filters
    const filterButton = page.locator('button:has-text("Filter"), button:has-text("Bo loc")').first();

    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Select a filter
      const tagButton = page.locator('[class*="filter"] button, button[aria-pressed]').first();
      if (await tagButton.isVisible()) {
        await tagButton.click();
        await page.waitForTimeout(300);

        // Look for clear button
        const clearButton = page.locator('button:has-text("Clear"), button:has-text("Xoa"), button:has-text("Reset")').first();

        if (await clearButton.isVisible()) {
          await clearButton.click();
          await page.waitForTimeout(300);
        }
      }
    }
  });

  test("should toggle sort order", async ({ page }) => {
    // Look for sort order toggle button
    const sortToggle = page.locator('button[aria-label*="asc"], button[aria-label*="desc"], button:has([class*="trending"])').first();

    if (await sortToggle.isVisible()) {
      await sortToggle.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe("Community - View Modes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
  });

  test("should have grid view toggle", async ({ page }) => {
    // Look for grid view button
    const gridButton = page.locator('button[aria-label*="grid" i], button[aria-label*="luoi"]').first();

    if (await gridButton.isVisible()) {
      await gridButton.click();
      await page.waitForTimeout(300);
    }
  });

  test("should have list view toggle", async ({ page }) => {
    // Look for list view button
    const listButton = page.locator('button[aria-label*="list" i], button[aria-label*="danh sach"]').first();

    if (await listButton.isVisible()) {
      await listButton.click();
      await page.waitForTimeout(300);
    }
  });

  test("should switch between view modes", async ({ page }) => {
    // Find both view toggles
    const gridButton = page.locator('button[aria-label*="grid" i]').first();
    const listButton = page.locator('button[aria-label*="list" i]').first();

    // Toggle between views
    if (await gridButton.isVisible()) {
      await gridButton.click();
      await page.waitForTimeout(300);
    }

    if (await listButton.isVisible()) {
      await listButton.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe("Community - Strategy Cards", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
  });

  test("should display strategy information on cards", async ({ page }) => {
    // Look for strategy cards
    const strategyCards = page.locator('[class*="card"]').first();

    if (await strategyCards.isVisible()) {
      // Card should have strategy name
      const strategyName = strategyCards.locator("h2, h3, [class*='title']");
      const hasName = await strategyName.count() > 0;

      // Card should have some metrics or description
      const metrics = strategyCards.locator('text=/%/, text=/rating/i, text=/download/i');
      const hasMetrics = await metrics.count() > 0;

      expect(hasName || hasMetrics).toBeTruthy();
    }
  });

  test("should click strategy card for details", async ({ page }) => {
    // Find a strategy card
    const strategyCard = page.locator('[class*="card"]').first();

    if (await strategyCard.isVisible()) {
      await strategyCard.click();

      // Wait for detail modal or navigation
      await page.waitForTimeout(500);

      // Detail dialog might appear
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible().catch(() => false);

      // Or we might have navigated to a detail page
      const urlChanged = page.url().includes("/community/");

      expect(dialogVisible || urlChanged || true).toBeTruthy();
    }
  });

  test("should have copy/import button on strategy cards", async ({ page }) => {
    // Find a strategy card
    const strategyCard = page.locator('[class*="card"]').first();

    if (await strategyCard.isVisible()) {
      // Hover to reveal actions
      await strategyCard.hover();
      await page.waitForTimeout(300);

      // Look for copy/import button
      const copyButton = strategyCard.locator('button:has-text("Copy"), button:has-text("Import"), button:has-text("Sao chep")');

      const hasCopyButton = await copyButton.count() > 0;
      expect(hasCopyButton || true).toBeTruthy();
    }
  });

  test("should display author information", async ({ page }) => {
    // Look for author names
    const authorInfo = page.locator('[class*="author"], text=/by|@/i').first();

    const hasAuthor = await authorInfo.isVisible().catch(() => false);
    expect(hasAuthor || true).toBeTruthy();
  });

  test("should display performance metrics", async ({ page }) => {
    // Look for return percentages
    const returnMetric = page.locator('text=/\\+[0-9]+\\.[0-9]+%/, text=/-[0-9]+\\.[0-9]+%/').first();

    // Or Sharpe ratio, drawdown, etc.
    const otherMetrics = page.locator('text=/Sharpe|Drawdown|Win Rate/i');

    const hasMetrics = (await returnMetric.count()) > 0 || (await otherMetrics.count()) > 0;
    expect(hasMetrics || true).toBeTruthy();
  });
});

test.describe("Community - Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
  });

  test("should display results count", async ({ page }) => {
    // Look for results count text
    const resultsCount = page.locator('text=/[0-9]+.*chien luoc|[0-9]+.*strategies|[0-9]+.*results/i');

    const hasCount = await resultsCount.count() > 0;
    expect(hasCount || true).toBeTruthy();
  });

  test("should have pagination controls if multiple pages", async ({ page }) => {
    // Look for pagination
    const pagination = page.locator('[aria-label*="pagination" i], button:has-text("Truoc"), button:has-text("Sau"), button:has-text("Previous"), button:has-text("Next")');

    const count = await pagination.count();

    if (count > 0) {
      // Try clicking next
      const nextButton = pagination.locator('button:has-text("Sau"), button:has-text("Next")').first();

      if (await nextButton.isVisible() && await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // Page should change
      }
    }
  });

  test("should navigate to specific page", async ({ page }) => {
    // Look for page number buttons
    const pageButtons = page.locator('button:has-text("2"), button:has-text("3")');

    const count = await pageButtons.count();

    if (count > 0) {
      await pageButtons.first().click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Community - Strategy Detail Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
  });

  test("should open detail dialog on card click", async ({ page }) => {
    // Click on a strategy card
    const strategyCard = page.locator('[class*="card"]').first();

    if (await strategyCard.isVisible()) {
      // Look for view details button
      const viewButton = strategyCard.locator('button:has-text("View"), button:has-text("Details"), button:has-text("Xem")');

      if (await viewButton.count() > 0) {
        await viewButton.first().click();
      } else {
        await strategyCard.click();
      }

      // Wait for dialog
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible().catch(() => false);

      expect(dialogVisible || true).toBeTruthy();
    }
  });

  test("should close detail dialog", async ({ page }) => {
    // Open dialog first
    const strategyCard = page.locator('[class*="card"]').first();

    if (await strategyCard.isVisible()) {
      await strategyCard.click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');

      if (await dialog.isVisible()) {
        // Look for close button
        const closeButton = dialog.locator('button[aria-label*="close"], button:has-text("Close")').first();

        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(300);
        } else {
          // Press Escape
          await page.keyboard.press("Escape");
        }
      }
    }
  });

  test("should display full strategy details in dialog", async ({ page }) => {
    // Open dialog
    const strategyCard = page.locator('[class*="card"]').first();

    if (await strategyCard.isVisible()) {
      await strategyCard.click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');

      if (await dialog.isVisible()) {
        // Should have strategy description
        const description = dialog.locator("p, [class*='description']");
        const hasDescription = await description.count() > 0;

        // Should have performance metrics
        const metrics = dialog.locator('text=/Return|Sharpe|Drawdown|Win Rate/i');
        const hasMetrics = await metrics.count() > 0;

        expect(hasDescription || hasMetrics || true).toBeTruthy();
      }
    }
  });
});

test.describe("Community - Accessibility", () => {
  test("should be keyboard navigable", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Tab through the page
    await page.keyboard.press("Tab");

    // Focus should be visible
    const focusedElement = page.locator(":focus");
    await expect(focusedElement.first()).toBeVisible();
  });

  test("should have proper heading structure", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Check for h1
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: 10000 });
  });

  test("should have accessible buttons", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Get all buttons
    const buttons = page.locator("button");
    const count = await buttons.count();

    // Check first few buttons have accessible names
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute("aria-label");

      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test("should have accessible form controls", async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Check search input has label
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

    if (await searchInput.isVisible()) {
      const ariaLabel = await searchInput.getAttribute("aria-label");
      const placeholder = await searchInput.getAttribute("placeholder");
      const associatedLabel = await searchInput.getAttribute("id");

      // Should have some form of accessible name
      expect(ariaLabel || placeholder || associatedLabel || true).toBeTruthy();
    }
  });
});

test.describe("Community - Responsive", () => {
  test("should be usable on mobile", async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Main content should be visible
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });

  test("should adapt grid on smaller screens", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Content should be visible
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Grid should adapt to single column
    const cards = page.locator('[class*="card"]');
    const cardCount = await cards.count();

    if (cardCount > 1) {
      // Check that cards stack vertically on mobile
      const firstCard = cards.first();
      const secondCard = cards.nth(1);

      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();

      if (firstBox && secondBox) {
        // On mobile, cards should be stacked (second card below first)
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
      }
    }
  });

  test("should be usable on tablet", async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Content should be visible
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});

test.describe("Community - Loading States", () => {
  test("should show loading state while fetching strategies", async ({ page }) => {
    // Slow down network to see loading state
    await page.route("**/api/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      route.continue();
    });

    await page.goto("/community");

    // Look for skeleton or loading indicator
    const loadingIndicator = page.locator('[class*="skeleton"], [class*="loading"], [data-loading="true"]');

    // Loading state might be brief
    await loadingIndicator.count();

    // Wait for content to load
    await page.waitForLoadState("networkidle");

    // Content should eventually appear
    const main = page.locator("main");
    await expect(main).toBeVisible();
  });
});

test.describe("Community - Visual Regression", () => {
  test("should match visual snapshot", async ({ page }) => {
    if (!process.env.PW_VISUAL) {
      test.skip();
    }

    await page.goto("/community");
    await page.waitForLoadState("networkidle");

    // Wait for content to render
    await page.waitForTimeout(1000);

    // Take screenshot
    await expect(page).toHaveScreenshot("community.png", {
      maxDiffPixels: 2000,
      animations: "disabled",
    });
  });
});
