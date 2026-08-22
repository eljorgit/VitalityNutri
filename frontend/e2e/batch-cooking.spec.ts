import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./test-helpers";

test.describe("Batch Cooking Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto("/");
    // Navigate to batch cooking via navbar
    await page.getByRole("button", { name: /Batch Cooking/i }).first().click();
  });

  test("renders batch cooking overview and sessions", async ({ page }) => {
    await expect(page.getByText("Cocer Quinoa").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("1h 30min").first()).toBeVisible();
    await expect(page.getByText("Taper hermético de cristal").first()).toBeVisible();
  });
});
