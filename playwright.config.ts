import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration for QuantVN
 * @see https://playwright.dev/docs/test-configuration
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const outputDir = process.env.PW_OUTPUT_DIR || "test-results";

export default defineConfig({
  // Test directory
  testDir: "./e2e",
  outputDir,

  // Run tests in parallel
  fullyParallel: true,

  // Fail build on CI if you accidentally left test.only in source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["list"],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL,

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",

    // Timeout for each action
    actionTimeout: 10000,

    // Browser context options
    contextOptions: {
      // Ignore HTTPS errors
      ignoreHTTPSErrors: true,
    },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    // Mobile viewports
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },

    {
      name: "mobile-safari",
      use: { ...devices["iPhone 12"] },
    },

    // Tablet viewports
    {
      name: "tablet",
      use: { ...devices["iPad Pro"] },
    },

    // Accessibility tests
    {
      name: "accessibility",
      testMatch: /.*accessibility.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // Visual regression tests
    {
      name: "visual",
      testMatch: /.*visual.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: "pnpm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
