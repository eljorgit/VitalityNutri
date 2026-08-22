import { test, expect } from "@playwright/test";
import { setupApiMocks, sampleRecipe } from "./test-helpers";

test.describe("Meal Plan & Calendar Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto("/calendar");
    await page.evaluate(() => localStorage.clear());
  });

  test("renders active weekly meal plan and displays meals for days", async ({ page }) => {
    // Check that Monday meal card is rendered
    await expect(page.getByText("Tostadas con Aguacate y Huevo").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(sampleRecipe.recipeName).first()).toBeVisible();
    await expect(page.getByText("Yogur Griego con Nueces").first()).toBeVisible();
    await expect(page.getByText("Salmón al Horno con Espárragos").first()).toBeVisible();
  });

  test("clicking a recipe card opens detailed recipe modal", async ({ page }) => {
    // Click on the recipe card
    await page.getByText(sampleRecipe.recipeName).first().click();

    // Check that recipe detail opens with title, ingredients, and steps
    await expect(page.getByText("Quinoa cocida").first()).toBeVisible();
    await expect(page.getByText("Tomate cherry").first()).toBeVisible();
    await expect(page.getByText("Queso feta").first()).toBeVisible();
  });
});
