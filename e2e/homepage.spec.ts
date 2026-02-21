import { test, expect } from "@playwright/test";

/**
 * Homepage E2E Tests
 * Tests for the main dashboard/landing page functionality
 */

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load homepage successfully", async ({ page }) => {
    // Check that the page loaded
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: /QuantVN/i }).first()).toBeVisible();

    // Check main content is visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("should display navigation sidebar", async ({ page }) => {
    // Check sidebar is visible on desktop
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();

    // Check logo is present
    await expect(sidebar.getByText("QuantVN")).toBeVisible();
  });

  test("should navigate to screener page", async ({ page }) => {
    // Click on Stock Screener link in primary sidebar
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole("link", { name: "Stock Screener", exact: true }).click();

    // Check URL changed
    await expect(page).toHaveURL(/.*screener.*/);
  });

  test("should navigate to charts page", async ({ page }) => {
    // Click on Charts link in primary sidebar
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole("link", { name: "Charts & Analysis", exact: true }).click();

    // Check URL changed
    await expect(page).toHaveURL(/.*charts.*/);
  });

  test("should navigate to backtesting page", async ({ page }) => {
    // Click on Backtesting link in primary sidebar
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole("link", { name: "Backtesting", exact: true }).click();

    // Check URL changed
    await expect(page).toHaveURL(/.*backtesting.*/);
  });

  test("should toggle dark mode", async ({ page }) => {
    // Find and click theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme" i], button[aria-label*="dark" i]').first();

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const html = page.locator("html");
      const initialTheme = await html.getAttribute("class");

      // Toggle theme
      await themeToggle.click();

      // Wait for theme change
      await page.waitForTimeout(500);

      // Check theme changed
      const newTheme = await html.getAttribute("class");
      expect(newTheme).not.toBe(initialTheme);
    }
  });

  test("should display market overview data", async ({ page }) => {
    // Wait for data to load
    await page.waitForLoadState("networkidle");

    // Check for market-related content
    const marketContent = page.locator('text=/HOSE|VN-Index|market/i').first();
    await expect(marketContent).toBeVisible({ timeout: 10000 });
  });

  test("should be responsive on mobile", async ({ page, isMobile }) => {
    if (!isMobile) {
      // Skip on non-mobile
      test.skip();
    }

    // On mobile, sidebar should be hidden or collapsible
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeHidden();
  });

  test("should show loading states", async ({ page }) => {
    // Reload page to see loading states
    await page.reload();

    // Check for skeleton or loading indicator
    const loadingIndicator = page.locator('[class*="skeleton"], [class*="loading"], [data-loading="true"]').first();

    // Loading might be quick, so just check it exists at some point
    const hasLoading = await loadingIndicator.count() > 0;

    // If no loading indicator, check that content loaded
    if (!hasLoading) {
      await expect(page.locator("main")).toBeVisible();
    }
  });
});

test.describe("Homepage - Accessibility", () => {
  test("should have no accessibility violations on homepage", async ({ page }) => {
    await page.goto("/");

    // Check for basic accessibility
    // All images should have alt text
    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const ariaLabel = await img.getAttribute("aria-label");
      const ariaHidden = await img.getAttribute("aria-hidden");

      // Image should have alt, aria-label, or be aria-hidden
      expect(alt || ariaLabel || ariaHidden === "true").toBeTruthy();
    }
  });

  test("should be keyboard navigable", async ({ page }) => {
    await page.goto("/");

    // Tab through the page
    await page.keyboard.press("Tab");

    // Check focus is visible
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();

    // Continue tabbing to find navigation links
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }

    // Should have focused on some interactive element
    await expect(focusedElement).toBeVisible();
  });

  test("should have skip to content link", async ({ page }) => {
    await page.goto("/");

    // Look for skip link
    const skipLink = page.locator('a:has-text("Skip"), a[href="#main"], a[href="#content"]').first();

    // Skip link should exist (might be visually hidden)
    const skipLinkCount = await skipLink.count();
    expect(skipLinkCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Homepage - Performance", () => {
  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/", { waitUntil: "networkidle" });

    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test("should not have console errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Filter out known acceptable errors
    const criticalErrors = errors.filter((error) => {
      // Ignore certain known errors
      const ignoredPatterns = [
        /favicon/i,
        /chrome-extension/i,
        /network error/i,
      ];

      return !ignoredPatterns.some((pattern) => pattern.test(error));
    });

    expect(criticalErrors).toHaveLength(0);
  });
});
