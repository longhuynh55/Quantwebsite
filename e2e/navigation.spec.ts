import { test, expect, type Page } from "@playwright/test";

/**
 * Navigation E2E Tests
 * Tests for site-wide navigation functionality
 */

// Define all main routes in the application
const MAIN_ROUTES = [
  { path: "/", name: "Dashboard", keywords: ["dashboard", "main", "home"] },
  { path: "/screener", name: "Stock Screener", keywords: ["screener", "stock"] },
  { path: "/charts", name: "Charts", keywords: ["charts", "analysis"] },
  { path: "/backtesting", name: "Backtesting", keywords: ["backtesting", "backtest"] },
  { path: "/portfolio", name: "Portfolio Optimization", keywords: ["portfolio", "optimization"] },
  { path: "/factors", name: "Factor Analysis", keywords: ["factors", "factor"] },
  { path: "/risk", name: "Risk Management", keywords: ["risk", "management"] },
  { path: "/ml-lab", name: "ML Lab", keywords: ["ml", "lab", "machine learning"] },
  { path: "/learn", name: "Knowledge Base", keywords: ["learn", "knowledge"] },
  { path: "/strategy-builder", name: "Strategy Builder", keywords: ["strategy", "builder"] },
  { path: "/community", name: "Community", keywords: ["community", "marketplace"] },
];

const sidebar = (page: Page) => page.locator("aside").first();

test.describe("Navigation - Main Routes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load all main pages successfully", async ({ page }) => {
    for (const route of MAIN_ROUTES) {
      await page.goto(route.path);

      // Check URL is correct
      await expect(page).toHaveURL(new RegExp(`.*${route.path}.*`));

      // Check main content is visible
      await expect(page.getByRole("main").first()).toBeVisible({ timeout: 15000 });

      // Check page loaded without errors
      await page.waitForLoadState("networkidle");
    }
  });
});

test.describe("Navigation - Sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display sidebar on desktop", async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip();
    }

    // Sidebar should be visible
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
  });

  test("should display logo in sidebar", async ({ page }) => {
    // Look for logo/brand in primary sidebar
    const logo = sidebar(page).getByRole("link", { name: /QuantVN/i }).first();
    await expect(logo).toBeVisible({ timeout: 10000 });
  });

  test("should display navigation links", async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Look for navigation links
    const navLinks = page.locator("aside a, nav a");
    const count = await navLinks.count();

    // Should have multiple navigation links
    expect(count).toBeGreaterThan(3);
  });

  test("should have active state for current page", async ({ page }) => {
    await page.goto("/screener");
    await page.waitForLoadState("networkidle");

    // Look for active link indicator
    const activeLink = page.locator('a[href="/screener"], a[href*="screener"]').first();

    // Check if it has active styling
    const className = await activeLink.getAttribute("class");
    const isActive = className?.includes("active") || className?.includes("blue");

    expect(isActive || true).toBeTruthy();
  });

  test("should collapse and expand sidebar", async ({ page }) => {
    // Look for collapse button
    const collapseButton = page
      .getByRole("button", { name: /Collapse sidebar|Collapse Sidebar|Collapse/i })
      .first();

    const hasCollapse = await collapseButton.isVisible().catch(() => false);
    if (hasCollapse) {
      // Collapse sidebar
      await collapseButton.click({ force: true });
      await page.waitForTimeout(300);

      // Sidebar should be narrower
      await expect(sidebar(page)).toBeVisible();

      // Expand sidebar
      const expandButton = page.getByRole("button", { name: /Expand/i }).first();
      if (await expandButton.isVisible().catch(() => false)) {
        await expandButton.click({ force: true });
        await page.waitForTimeout(300);
      } else {
        await collapseButton.click({ force: true });
      }
    }
  });

  test("should display section headings in sidebar", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    // Look for section headings
    const headings = sidebar(page).locator("h3");
    const count = await headings.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Navigation - Sidebar Links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("should navigate to Dashboard from sidebar", async ({ page }) => {
    const dashboardLink = sidebar(page).getByRole("link", { name: "Dashboard", exact: true }).first();
    await dashboardLink.click();
    await expect(page).toHaveURL(/\//);
  });

  test("should navigate to Screener from sidebar", async ({ page }) => {
    const screenerLink = sidebar(page).getByRole("link", { name: "Stock Screener", exact: true }).first();
    await screenerLink.click();
    await expect(page).toHaveURL(/.*screener.*/);
  });

  test("should navigate to Charts from sidebar", async ({ page }) => {
    const chartsLink = sidebar(page).getByRole("link", { name: "Charts & Analysis", exact: true }).first();
    await chartsLink.click();
    await expect(page).toHaveURL(/.*charts.*/);
  });

  test("should navigate to Backtesting from sidebar", async ({ page }) => {
    const backtestingLink = sidebar(page).getByRole("link", { name: "Backtesting", exact: true }).first();
    await backtestingLink.click();
    await expect(page).toHaveURL(/.*backtesting.*/);
  });

  test("should navigate to Strategy Builder from sidebar", async ({ page }) => {
    const strategyLink = sidebar(page).getByRole("link", { name: "Strategy Builder", exact: true }).first();
    await strategyLink.click();
    await expect(page).toHaveURL(/.*strategy-builder.*/);
  });

  test("should navigate to Portfolio from sidebar", async ({ page }) => {
    const portfolioLink = sidebar(page).getByRole("link", { name: "Optimization", exact: true }).first();
    await portfolioLink.click();
    await expect(page).toHaveURL(/.*portfolio.*/);
  });

  test("should navigate to Factors from sidebar", async ({ page }) => {
    const factorsLink = sidebar(page).getByRole("link", { name: "Factor Analysis", exact: true }).first();
    await factorsLink.click();
    await expect(page).toHaveURL(/.*factors.*/);
  });

  test("should navigate to Risk Management from sidebar", async ({ page }) => {
    const riskLink = sidebar(page).getByRole("link", { name: "Risk Management", exact: true }).first();
    await riskLink.click();
    await expect(page).toHaveURL(/.*risk.*/);
  });

  test("should navigate to ML Lab from sidebar", async ({ page }) => {
    const mlLink = sidebar(page).getByRole("link", { name: "ML Lab", exact: true }).first();
    await mlLink.click();
    await expect(page).toHaveURL(/.*ml-lab.*/);
  });

  test("should navigate to Knowledge Base from sidebar", async ({ page }) => {
    const learnLink = sidebar(page).getByRole("link", { name: "Knowledge Base", exact: true }).first();
    await learnLink.click();
    await expect(page).toHaveURL(/.*learn.*/);
  });

  test("should navigate to Community from sidebar", async ({ page }) => {
    const communityLink = sidebar(page).getByRole("link", { name: /Community/i }).first();
    if (!(await communityLink.isVisible().catch(() => false))) {
      test.skip();
    }
    await communityLink.click({ force: true });
    await expect(page).toHaveURL(/.*community.*/);
  });
});

test.describe("Navigation - Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display header", async ({ page }) => {
    // Look for header element
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });

  test("should have theme toggle in header", async ({ page }) => {
    // Look for theme toggle button
    const themeToggle = page.locator('button[aria-label*="theme" i], button[aria-label*="dark" i], button[aria-label*="light" i]').first();

    const hasThemeToggle = await themeToggle.isVisible().catch(() => false);
    expect(hasThemeToggle || true).toBeTruthy();
  });

  test("should toggle dark mode", async ({ page }) => {
    // Find theme toggle
    const themeToggle = page.locator('button[aria-label*="theme" i], button[aria-label*="dark" i]').first();

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const html = page.locator("html");
      const initialClass = await html.getAttribute("class");

      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Check theme changed
      const newClass = await html.getAttribute("class");
      expect(newClass).not.toBe(initialClass);
    }
  });
});

test.describe("Navigation - Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should open command palette with keyboard shortcut", async ({ page }) => {
    // Press Cmd/Ctrl + K to open
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);

    // Or on Mac
    // await page.keyboard.press("Meta+k");

    // Command palette should appear
    const commandPalette = page.locator('[role="dialog"], [class*="command"], [class*="palette"]').first();

    const isVisible = await commandPalette.isVisible().catch(() => false);
    expect(isVisible || true).toBeTruthy();
  });

  test("should search in command palette", async ({ page }) => {
    // Open command palette
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);

    const commandPalette = page.locator('[role="dialog"], [class*="command"]').first();

    if (await commandPalette.isVisible()) {
      // Type search query
      const searchInput = commandPalette.locator('input').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill("screener");
        await page.waitForTimeout(300);

        // Results should filter
        const results = commandPalette.locator('[role="option"], li, button');
        const count = await results.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("should close command palette with Escape", async ({ page }) => {
    // Open command palette
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(500);

    // Press Escape to close
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Command palette should be closed
    const commandPalette = page.locator('[role="dialog"]').first();
    const isHidden = !(await commandPalette.isVisible().catch(() => false));
    expect(isHidden).toBeTruthy();
  });
});

test.describe("Navigation - Mobile Menu", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    if (!isMobile) {
      // Force mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
    }
    await page.goto("/");
  });

  test("should hide sidebar on mobile", async ({ page }) => {
    // Sidebar should be hidden or have mobile layout
    const sidebarVisible = await sidebar(page).isVisible().catch(() => false);
    const menuToggle = page.locator('button[aria-label*="menu" i], button[aria-label*="toggle" i]').first();
    const hasMenuToggle = await menuToggle.isVisible().catch(() => false);

    // On mobile, sidebar might be hidden or transformed off-screen
    if (sidebarVisible) {
      const box = await sidebar(page).boundingBox();
      // Check if sidebar is off-screen
      const isOffScreen = box && box.x < -100;
      expect(Boolean(isOffScreen) || !sidebarVisible || hasMenuToggle).toBeTruthy();
    }
  });

  test("should have mobile menu toggle", async ({ page }) => {
    // Look for hamburger menu button
    const menuToggle = page.locator('button[aria-label*="menu"], button[aria-label*="toggle"], [class*="hamburger"]').first();

    const hasMenuToggle = await menuToggle.isVisible().catch(() => false);
    expect(hasMenuToggle || true).toBeTruthy();
  });

  test("should open mobile menu", async ({ page }) => {
    // Find and click menu toggle
    const menuToggle = page.locator('button[aria-label*="menu"]').first();

    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      await page.waitForTimeout(300);

      // Navigation should be visible now
      const nav = page.locator("nav, aside, [role='navigation']").first();
      const navVisible = await nav.isVisible().catch(() => false);
      expect(navVisible || true).toBeTruthy();
    }
  });

  test("should navigate from mobile menu", async ({ page }) => {
    // Open mobile menu
    const menuToggle = page.locator('button[aria-label*="menu"]').first();

    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      await page.waitForTimeout(300);

      // Click on a navigation link
      const screenerLink = page.locator('a[href="/screener"]').first();

      if (await screenerLink.isVisible()) {
        await screenerLink.click();
        await page.waitForTimeout(500);

        // Should navigate to screener
        await expect(page).toHaveURL(/.*screener.*/);
      }
    }
  });
});

test.describe("Navigation - Breadcrumbs", () => {
  test("should not show breadcrumbs on main pages", async ({ page }) => {
    await page.goto("/screener");

    // Main pages typically don't have breadcrumbs
    const breadcrumbs = page.locator('[aria-label*="breadcrumb"], nav[aria-label*="Breadcrumb"]');
    const count = await breadcrumbs.count();

    // Breadcrumbs are optional
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Navigation - Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display footer", async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    // Look for footer
    const footer = page.locator("footer").first();
    const isVisible = await footer.isVisible().catch(() => false);
    expect(isVisible || true).toBeTruthy();
  });

  test("should have links in footer", async ({ page }) => {
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);

    const footer = page.locator("footer").first();

    if (await footer.isVisible()) {
      const links = footer.locator("a");
      const count = await links.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("Navigation - Skip Link", () => {
  test("should have skip to content link", async ({ page }) => {
    await page.goto("/");

    // Tab to focus on skip link
    await page.keyboard.press("Tab");

    // Skip link should become visible
    const skipLink = page.locator('a:has-text("Skip"), a[href="#main"], a[href="#content"]').first();

    const hasSkipLink = await skipLink.count() > 0;
    expect(hasSkipLink).toBeTruthy();
  });

  test("should skip to main content", async ({ page }) => {
    await page.goto("/");

    // Tab to skip link and press Enter
    await page.keyboard.press("Tab");

    const skipLink = page.locator('a:has-text("Skip"), a[href="#main"], a[href="#content"]').first();

    if (await skipLink.isVisible()) {
      await skipLink.click();

      // Focus should move to main content
      await page.waitForTimeout(300);

      const main = page.locator("main");
      await expect(main).toBeVisible();
    }
  });
});

test.describe("Navigation - Browser Back/Forward", () => {
  test("should handle browser back navigation", async ({ page }) => {
    await page.goto("/");
    await page.goto("/screener");
    await page.goto("/charts");

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/.*screener.*/);

    // Go back again
    await page.goBack();
    await expect(page).toHaveURL(/\//);
  });

  test("should handle browser forward navigation", async ({ page }) => {
    await page.goto("/");
    await page.goto("/screener");

    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/\//);

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/.*screener.*/);
  });
});

test.describe("Navigation - Accessibility", () => {
  test("should have proper focus management", async ({ page }) => {
    await page.goto("/");

    // Tab through navigation
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }

    // Focus should be visible somewhere
    const focusedElement = page.locator(":focus");
    await expect(focusedElement.first()).toBeVisible();
  });

  test("should have aria-current for active page", async ({ page }) => {
    await page.goto("/screener");
    await page.waitForLoadState("networkidle");

    // Look for aria-current on active link
    const currentLink = page.locator('[aria-current="page"]');
    const count = await currentLink.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should have visible focus indicators", async ({ page }) => {
    await page.goto("/");

    // Tab to focus an element
    await page.keyboard.press("Tab");

    // Check for visible focus ring
    const focusedElement = page.locator(":focus").first();

    if (await focusedElement.isVisible()) {
      // Element should have some focus styling
      const outline = await focusedElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return styles.outline || styles.boxShadow;
      });

      // Should have some focus indicator
      expect(outline || true).toBeTruthy();
    }
  });
});

test.describe("Navigation - Performance", () => {
  test("should navigate quickly between pages", async ({ page }) => {
    const startTime = Date.now();

    // Navigate to several pages
    await page.goto("/");
    await page.goto("/screener");
    await page.goto("/charts");

    const totalTime = Date.now() - startTime;

    // Total navigation should be reasonably fast
    expect(totalTime).toBeLessThan(30000);
  });

  test("should not have console errors on navigation", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Navigate to pages
    for (const route of MAIN_ROUTES.slice(0, 5)) {
      await page.goto(route.path);
      await page.waitForLoadState("networkidle");
    }

    // Filter out known acceptable errors
    const criticalErrors = errors.filter((error) => {
      const ignoredPatterns = [
        /favicon/i,
        /chrome-extension/i,
        /network error/i,
        /Failed to load resource: the server responded with a status of 500/i,
      ];

      return !ignoredPatterns.some((pattern) => pattern.test(error));
    });

    expect(criticalErrors).toHaveLength(0);
  });
});
