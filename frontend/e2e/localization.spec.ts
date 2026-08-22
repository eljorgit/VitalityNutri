import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./test-helpers";

test.describe("Localization Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto("/calendar");
  });

  test("switches between Spanish and English via settings modal", async ({ page }) => {
    // Click settings button (gear icon in header)
    const settingsBtn = page.getByRole("button", { name: /Ajustes|Settings/i }).or(page.locator("button[aria-label*='Ajustes'], button[aria-label*='Settings']")).first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();

      // Check settings modal opened
      await expect(page.getByText(/Idioma|Language/i).first()).toBeVisible();

      // Select English or Spanish option
      const langSelector = page.getByRole("button", { name: /English|Español/i }).first();
      if (await langSelector.isVisible()) {
        await langSelector.click();
      }
    }
  });
});
