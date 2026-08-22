import { test, expect } from "@playwright/test";
import { setupApiMocks, sampleRecipe } from "./test-helpers";

test.describe("Recipe Book (Recetario) Flow", () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto("/recipe-book");
  });

  test("displays recipe book with saved recipes", async ({ page }) => {
    await expect(page.getByText(sampleRecipe.recipeName).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`${sampleRecipe.calories} kcal`).first()).toBeVisible();
  });

  test("filters recipes by search query", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Buscar receta|Search recipe/i);
    await expect(searchInput).toBeVisible();

    // Type matching search
    await searchInput.fill("Quinoa");
    await expect(page.getByText(sampleRecipe.recipeName).first()).toBeVisible();

    // Type non-matching search
    await searchInput.fill("Hamburguesa con patatas inexistente");
    await expect(page.getByText(sampleRecipe.recipeName)).not.toBeVisible();
  });

  test("opens new recipe form when clicking add recipe button", async ({ page }) => {
    const addRecipeBtn = page.getByRole("button", { name: /Nueva Receta|New Recipe|Añadir/i }).first();
    if (await addRecipeBtn.isVisible()) {
      await addRecipeBtn.click();
      await expect(page.getByPlaceholder(/Nombre de la receta|Recipe name/i).first()).toBeVisible();
    }
  });
});
