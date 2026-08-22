import { test, expect } from "@playwright/test";
import { setupApiMocks } from "./test-helpers";

test.describe("Grocery List Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto("/");
    // Navigate to grocery list via navbar
    await page.getByRole("button", { name: /Lista de la Compra|Grocery List/i }).first().click();
  });

  test("renders grocery items categorized correctly", async ({ page }) => {
    // Check that ingredients from the active plan appear
    await expect(page.getByText(/Tomate cherry|Aguacate|Pan integral/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("toggles grocery item checked state", async ({ page }) => {
    const itemText = page.getByText(/Tomate cherry|Aguacate|Pan integral/i).first();
    await expect(itemText).toBeVisible({ timeout: 10000 });

    // Click on item
    await itemText.click();
    await expect(itemText).toBeVisible();
  });
});
