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

  test("language switching between EN and ES works", async ({ page }) => {
    // Switch to English explicitly
    const langSelect = page.locator("select").first();
    await langSelect.selectOption("en");
    await page.waitForTimeout(500);

    // Nav button should show English text
    await expect(
      page.getByRole("button", { name: "Calendar" })
    ).toBeVisible();

    // Switch to Spanish
    await langSelect.selectOption("es");
    await page.waitForTimeout(500);

    await expect(
      page.getByRole("button", { name: "Calendario" })
    ).toBeVisible();

    // Switch back to English
    await langSelect.selectOption("en");
    await page.waitForTimeout(500);
    await expect(
      page.getByRole("button", { name: "Calendar" })
    ).toBeVisible();
  });

  test("navigate between all main sections", async ({ page }) => {
    // Set language to English
    const langSelect = page.locator("select").first();
    await langSelect.selectOption("en");
    await page.waitForTimeout(500);

    const sections = [
      { label: "Calendar", url: /\/calendar/ },
      { label: "Grocery List", url: /\/grocery/ },
      { label: "Recipe Book", url: /\/recipe-book/ },
    ];

    for (const { label, url } of sections) {
      await page.getByRole("button", { name: label }).first().click();
      await page.waitForURL(url, { timeout: 5000 });
    }
  });

});
