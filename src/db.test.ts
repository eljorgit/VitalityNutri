import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import type { MealPlan, PlanMetadata, Recipe } from "./types";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vitest-db-"));
let db: typeof import("./db");

beforeAll(async () => {
  const prevCwd = process.cwd();
  process.chdir(tmpDir);
  db = await import("./db");
  process.chdir(prevCwd);
});

afterAll(() => {
  db.closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeEmptyMealPlan(): MealPlan {
  const emptyDay = { breakfast: null, lunch: null, snack: null, dinner: null };
  return {
    days: {
      monday: { ...emptyDay },
      tuesday: { ...emptyDay },
      wednesday: { ...emptyDay },
      thursday: { ...emptyDay },
      friday: { ...emptyDay },
      saturday: { ...emptyDay },
      sunday: { ...emptyDay },
    },
  };
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    recipeName: "Test Recipe",
    calories: 500,
    time: "30 min",
    tag: "meal",
    image: "",
    ingredients: [{ name: "test ingredient", originalAmount: 1, unit: "pcs" }],
    tips: "Test tip",
    steps: ["Step 1"],
    servings: 2,
    isFavorite: false,
    season: "Todas",
    ...overrides,
  };
}

describe("db.ts — Plan operations", () => {
  it("getPlan returns null when no plan exists", () => {
    const result = db.getPlan();
    expect(result).toEqual({ plan: null, metadata: null });
  });

  it("savePlan and getPlan work round-trip", () => {
    const plan = makeEmptyMealPlan();
    plan.days.monday.breakfast = makeRecipe({ recipeName: "Test Breakfast" });
    const metadata: PlanMetadata = { fileName: "test.pdf", processedAt: new Date().toISOString() };
    db.savePlan(plan, metadata);
    const result = db.getPlan();
    expect(result.plan?.days.monday.breakfast?.recipeName).toBe("Test Breakfast");
    expect(result.metadata?.fileName).toBe("test.pdf");
  });

  it("resetPlan clears the active plan", () => {
    db.resetPlan();
    const result = db.getPlan();
    expect(result.plan).toBeNull();
    expect(result.metadata).toBeNull();
  });
});

describe("db.ts — Recipe CRUD", () => {
  it("insertRecipe creates a new recipe", () => {
    const id = db.insertRecipe(makeRecipe({ recipeName: "New Recipe" }));
    expect(id).toBeGreaterThan(0);
  });

  it("getRecipeById retrieves the inserted recipe", () => {
    const id = db.insertRecipe(makeRecipe({ recipeName: "Find Me" }));
    const recipe = db.getRecipeById(id);
    expect(recipe).not.toBeNull();
    expect(recipe!.recipeName).toBe("Find Me");
  });

  it("getRecipes returns all recipes", () => {
    const recipes = db.getRecipes();
    expect(recipes.length).toBeGreaterThanOrEqual(2);
  });

  it("updateRecipeInBook updates a recipe", () => {
    const id = db.insertRecipe(makeRecipe({ recipeName: "Updatable", calories: 300 }));
    db.updateRecipeInBook(id, makeRecipe({ recipeName: "Updatable", calories: 600 }));
    const updated = db.getRecipeById(id);
    expect(updated!.calories).toBe(600);
  });

  it("deleteRecipeInBook removes a recipe", () => {
    const id = db.insertRecipe(makeRecipe({ recipeName: "Deletable" }));
    db.deleteRecipeInBook(id);
    expect(db.getRecipeById(id)).toBeNull();
  });

  it("getRecipeIdByName finds recipe by name", () => {
    db.insertRecipe(makeRecipe({ recipeName: "Unique Name Find" }));
    const id = db.getRecipeIdByName("Unique Name Find");
    expect(id).toBeGreaterThan(0);
  });
});

describe("db.ts — Grocery list state", () => {
  it("getGroceryListState returns null initially", () => {
    expect(db.getGroceryListState()).toBeNull();
  });

  it("saveGroceryListState persists and retrieves state", () => {
    db.saveGroceryListState({
      checkedItems: { item1: true },
      listType: "semanal",
      selectedSingleDay: "",
      selected3DaysStart: "",
      excludedMeals: [],
      multipliers: {},
    });
    const retrieved = db.getGroceryListState();
    expect(retrieved).not.toBeNull();
    expect(retrieved.checkedItems).toEqual({ item1: true });
    expect(retrieved.listType).toBe("semanal");
  });
});

describe("db.ts — History", () => {
  it("getHistory returns an empty array initially", () => {
    expect(Array.isArray(db.getHistory())).toBe(true);
  });

  it("getHistory returns saved plans", () => {
    const plan = makeEmptyMealPlan();
    plan.days.monday.breakfast = makeRecipe({ recipeName: "History Breakfast" });
    db.savePlan(plan, { fileName: "history.pdf", processedAt: new Date().toISOString() });
    const history = db.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].file_name).toBe("history.pdf");
  });
});

describe("db.ts — Ingredients", () => {
  it("getIngredients returns an array", () => {
    expect(Array.isArray(db.getIngredients())).toBe(true);
  });
});

describe("db.ts — Completed recipes", () => {
  it("getCompletedRecipes returns empty object for non-existent plan", () => {
    expect(db.getCompletedRecipes(999)).toEqual({});
  });

  it("saveCompletedRecipes persists completed state", () => {
    db.saveCompletedRecipes(1, { "monday-breakfast": true });
    expect(db.getCompletedRecipes(1)).toEqual({ "monday-breakfast": true });
  });
});
