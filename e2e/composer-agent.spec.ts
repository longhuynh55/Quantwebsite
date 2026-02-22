import { test, expect } from "@playwright/test";

type ComposerAssistantExecuteBody = {
  approvalToken: string;
  toolName: string;
  arguments: {
    symbol: string;
    strategy: string;
    [key: string]: unknown;
  };
};

test.describe("Composer Agent Tool Calling", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, "Composer panel E2E is validated on desktop layouts.");
    await page.goto("/");
    await page.getByRole("button", { name: "Open AI Assistant Copilot" }).click();
    await expect(page.getByRole("heading", { name: "AI Assistant", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Open Composer (Agent Tool Calling)" }).click();
    await expect(page.getByText("Plan and Execute Tool Calling")).toBeVisible();
  });

  test("drafts plan and executes tool call with approval token", async ({ page }) => {
    let capturedBody: ComposerAssistantExecuteBody | null = null;
    await page.route("**/api/assistant/execute", async (route) => {
      const payload = route.request().postDataJSON() as ComposerAssistantExecuteBody;
      capturedBody = payload;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          requestId: "e2e-mocked-request",
          execution: {
            toolName: payload.toolName,
            approved: true,
            trace: { method: "POST", path: "/api/backtesting" },
          },
          result: { ok: true, netReturn: 1.23 },
        }),
      });
    });

    await page.getByLabel("Objective").fill("Run backtest for FPT with SMA crossover");
    await page.getByRole("button", { name: "Draft Plan" }).click();
    await expect(page.getByText("Suggested:").first()).toContainText("backtest_run");

    await page.getByLabel("Approval Token").fill("token-e2e");
    await page.getByRole("button", { name: "Execute Tool" }).click();

    await expect(page.getByText("Execution Result")).toBeVisible();
    await expect(page.locator("pre")).toContainText("\"success\": true");
    await expect(page.locator("pre")).toContainText("\"requestId\": \"e2e-mocked-request\"");

    expect(capturedBody).not.toBeNull();
    if (!capturedBody) {
      throw new Error("Expected /api/assistant/execute request body to be captured.");
    }
    const body = capturedBody as ComposerAssistantExecuteBody;
    expect(body.approvalToken).toBe("token-e2e");
    expect(body.toolName).toBe("backtest_run");
    expect(body.arguments).toEqual(
      expect.objectContaining({
        symbol: "FPT",
        strategy: "sma_crossover",
      })
    );
  });

  test("shows validation error when arguments json is invalid", async ({ page }) => {
    await page.getByLabel("Objective").fill("Analyze risk for VNM");
    await page.getByRole("button", { name: "Draft Plan" }).click();
    await page.getByLabel("Arguments JSON").fill("{invalid json");
    await page.getByLabel("Approval Token").fill("token-e2e");
    await page.getByRole("button", { name: "Execute Tool" }).click();
    await expect(page.getByText("Arguments JSON is invalid. Please fix formatting before execute.")).toBeVisible();
  });
});
