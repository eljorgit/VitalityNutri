import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test.describe("Smoke tests", () => {

  test("app shell renders on homepage", async ({ page }) => {
    // The header logo button should be visible
    await expect(
      page.getByRole("button", { name: /VitalityNutri/i })
    ).toBeVisible();
  });

  test("app renders in the language set by VITE_LANGUAGE env var", async ({ page }) => {
    // Language is configured via VITE_LANGUAGE env var (default: "en").
    // Verify the app displays translated navigation in that language.
    await expect(
      page.getByRole("button", { name: "Calendar" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Recipe Book" })
    ).toBeVisible();
  });

  test("navigate between all main sections", async ({ page }) => {
    // Language is set via VITE_LANGUAGE env var; default is "en" (English).
    const sections = [
      { label: "Calendar", url: /\/calendar/ },
      { label: "Grocery List", url: /\/grocery-list/ },
      { label: "Recipe Book", url: /\/recipe-book/ },
    ];

    for (const { label, url } of sections) {
      await page.getByRole("button", { name: label }).first().click();
      await page.waitForURL(url, { timeout: 5000 });
    }
  });

});
