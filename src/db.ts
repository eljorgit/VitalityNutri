import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import crypto from "crypto";
import { MealPlan, PlanMetadata, Recipe } from "./types.js";
import { logger } from "./utils/logger.js";

// Determine the database storage directory
const DB_DIR = path.join(process.cwd(), "data");

// Ensure the directory exists
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (error) {
  logger.error("Error creating data directory:", error);
}

const DB_PATH = path.join(DB_DIR, "database.sqlite");

// Connect to SQLite database
const db = new Database(DB_PATH);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT,
    saved_file_name TEXT,
    plan_json TEXT,
    metadata_json TEXT,
    is_active INTEGER DEFAULT 0,
    created_at TEXT,
    batch_cooking_json TEXT,
    batch_cooking_params TEXT,
    file_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS grocery_list_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    checked_items_json TEXT,
    list_type TEXT,
    selected_single_day TEXT,
    selected_3days_start TEXT,
    excluded_meals_json TEXT,
    multipliers_json TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS completed_recipes_state (
    plan_id INTEGER PRIMARY KEY,
    completed_json TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    plan_name TEXT,
    day TEXT,
    meal TEXT,
    recipe_name TEXT,
    image TEXT,
    is_active INTEGER DEFAULT 0,
    clicked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_name TEXT UNIQUE,
    calories INTEGER,
    time TEXT,
    tag TEXT,
    image TEXT,
    ingredients_json TEXT,
    tips TEXT,
    steps_json TEXT,
    nutritionist_tips TEXT,
    servings INTEGER DEFAULT 1,
    source TEXT,
    source_plan_id INTEGER,
    is_ai_generated INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    season TEXT DEFAULT 'Todas',
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    category TEXT,
    created_at TEXT,
    updated_at TEXT
  );
`);

// Create database indexes to optimize read/query performance
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);
    CREATE INDEX IF NOT EXISTS idx_plans_hash ON plans(file_hash);
    CREATE INDEX IF NOT EXISTS idx_completed_recipes_plan ON completed_recipes_state(plan_id);
    CREATE INDEX IF NOT EXISTS idx_search_history_plan ON search_history(plan_id);
    CREATE INDEX IF NOT EXISTS idx_search_history_clicked ON search_history(clicked_at DESC);
  `);
  logger.info("[Migration] Database indexes verified and created.");
} catch (error) {
  logger.error("Error creating database indexes:", error);
}

/**
 * Resolves a recipe in the database. If it exists (by name), returns its ID.
 * Otherwise, inserts it into the database and returns the new auto-incremented ID.
 */
export function getOrCreateRecipeInBook(recipe: Recipe, planId?: number): number {
  try {
    const existing = db.prepare("SELECT id FROM recipes WHERE LOWER(recipe_name) = ?").get(recipe.recipeName.trim().toLowerCase()) as any;
    if (existing) {
      return existing.id;
    }
    
    const now = new Date().toISOString();
    const servings = typeof recipe.servings === "number" && recipe.servings >= 1 ? recipe.servings : 1;
    const isAiGenerated = recipe.isAiGenerated ? 1 : 0;
    const isFavorite = recipe.isFavorite ? 1 : 0;
    const season = recipe.season || "Todas";
    
    const stmt = db.prepare(`
      INSERT INTO recipes (
        recipe_name, calories, time, tag, image, ingredients_json, tips, steps_json,
        nutritionist_tips, servings, source, source_plan_id, is_ai_generated, is_favorite, season, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      recipe.recipeName,
      recipe.calories || 0,
      recipe.time || "20 min",
      recipe.tag || null,
      recipe.image || null,
      JSON.stringify(recipe.ingredients || []),
      recipe.tips || "",
      JSON.stringify(recipe.steps || []),
      recipe.nutritionistTips || null,
      servings,
      recipe.source || "plan",
      planId || null,
      isAiGenerated,
      isFavorite,
      season,
      now,
      now
    );

    const flatIngredients = getFlatIngredients(recipe.ingredients);
    saveRecipeIngredients(flatIngredients);

    return result.lastInsertRowid as number;
  } catch (error) {
    logger.error("Error in getOrCreateRecipeInBook:", error);
    throw error;
  }
}

/**
 * Ensures that the given plan ID has all its recipes enriched with database IDs.
 * Returns the fully enriched MealPlan.
 */
export function ensurePlanIsEnriched(planId: number): MealPlan | null {
  try {
    const row = db.prepare("SELECT plan_json FROM plans WHERE id = ?").get(planId) as any;
    if (!row || !row.plan_json) return null;
    const plan = JSON.parse(row.plan_json) as MealPlan;
    
    let needsEnrichment = false;
    if (plan && plan.days) {
      const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
      const mealsKeys = ["breakfast", "lunch", "snack", "dinner"] as const;
      for (const day of daysKeys) {
        for (const meal of mealsKeys) {
          const r = plan.days[day]?.[meal];
          if (r?.recipeName && (r.id === undefined || r.id === null)) {
            needsEnrichment = true;
            break;
          }
        }
        if (needsEnrichment) break;
      }
    }

    if (needsEnrichment) {
      if (plan.days) {
        const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
        const mealsKeys = ["breakfast", "lunch", "snack", "dinner"] as const;
        for (const day of daysKeys) {
          for (const meal of mealsKeys) {
            const r = plan.days[day]?.[meal];
            if (r && r.recipeName) {
              r.id = getOrCreateRecipeInBook(r, planId);
            }
          }
        }
      }
      db.prepare("UPDATE plans SET plan_json = ? WHERE id = ?").run(JSON.stringify(plan), planId);
    }
    return plan;
  } catch (error) {
    logger.error(`Error ensuring plan ID ${planId} is enriched with recipe IDs:`, error);
    return null;
  }
}

/**
 * Retrieves the currently active meal plan and metadata from the SQLite database.
 */
export function getPlan(): { plan: MealPlan | null; metadata: PlanMetadata | null } {
  try {
    const row = db.prepare("SELECT id, metadata_json FROM plans WHERE is_active = 1 LIMIT 1").get() as any;
    if (row) {
      const plan = ensurePlanIsEnriched(row.id);
      return {
        plan,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null
      };
    }
  } catch (error) {
    logger.error("Error reading meal plan from SQLite database:", error);
  }
  return { plan: null, metadata: null };
}

/**
 * Saves or updates the active meal plan and metadata in the SQLite database.
 */
export function savePlan(plan: MealPlan, metadata: PlanMetadata, savedFileName?: string, fileHash?: string): void {
  try {
    // 1. Deactivate all other plans
    db.prepare("UPDATE plans SET is_active = 0").run();

    // 2. Check if a plan with the same savedFileName or ID already exists
    let existingId = null;
    if (savedFileName) {
      const row = db.prepare("SELECT id FROM plans WHERE saved_file_name = ? LIMIT 1").get(savedFileName) as any;
      if (row) {
        existingId = row.id;
      }
    } else if (metadata.id) {
      existingId = metadata.id;
    }

    let planId: number;
    if (existingId) {
      planId = existingId;
      metadata.id = planId;
      if (savedFileName) {
        metadata.savedFileName = savedFileName;
      }

      // Enrich in-memory plan object with recipe IDs from the recipe book before saving
      if (plan.days) {
        const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
        const mealsKeys = ["breakfast", "lunch", "snack", "dinner"] as const;
        for (const day of daysKeys) {
          for (const meal of mealsKeys) {
            const r = plan.days[day]?.[meal];
            if (r && r.recipeName) {
              r.id = getOrCreateRecipeInBook(r, planId);
            }
          }
        }
      }

      const stmt = db.prepare(`
        UPDATE plans
        SET plan_json = ?, metadata_json = ?, is_active = 1, created_at = ?, file_hash = COALESCE(?, file_hash)
        WHERE id = ?
      `);
      stmt.run(JSON.stringify(plan), JSON.stringify(metadata), new Date().toISOString(), fileHash || null, planId);
    } else {
      // Insert new plan
      const savedName = savedFileName || metadata.savedFileName || null;
      if (savedName) {
        metadata.savedFileName = savedName;
      }

      // Insert with a temp JSON first to obtain the planId
      const stmt = db.prepare(`
        INSERT INTO plans (file_name, saved_file_name, plan_json, metadata_json, is_active, created_at, file_hash)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `);
      const result = stmt.run(
        metadata.fileName,
        savedName,
        JSON.stringify(plan),
        JSON.stringify(metadata),
        new Date().toISOString(),
        fileHash || null
      );
      
      planId = result.lastInsertRowid as number;
      metadata.id = planId;
      
      // Enrich in-memory plan object with recipe IDs from the recipe book
      if (plan.days) {
        const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
        const mealsKeys = ["breakfast", "lunch", "snack", "dinner"] as const;
        for (const day of daysKeys) {
          for (const meal of mealsKeys) {
            const r = plan.days[day]?.[meal];
            if (r && r.recipeName) {
              r.id = getOrCreateRecipeInBook(r, planId);
            }
          }
        }
      }

      // Finalize database record with the enriched JSON containing IDs
      db.prepare("UPDATE plans SET plan_json = ?, metadata_json = ? WHERE id = ?").run(
        JSON.stringify(plan),
        JSON.stringify(metadata),
        planId
      );
    }
  } catch (error) {
    logger.error("Error saving meal plan to SQLite database:", error);
  }
}

/**
 * Finds a plan in the database by its file hash.
 */
export function findPlanByHash(hash: string): { id: number; file_name: string; is_active: boolean } | null {
  try {
    const row = db.prepare("SELECT id, file_name, is_active FROM plans WHERE file_hash = ? LIMIT 1").get(hash) as any;
    if (row) {
      return {
        id: row.id,
        file_name: row.file_name,
        is_active: !!row.is_active
      };
    }
  } catch (error) {
    logger.error("Error finding plan by hash in SQLite database:", error);
  }
  return null;
}

/**
 * Removes the active meal plan and metadata from the database (sets is_active to 0).
 */
export function resetPlan(): void {
  try {
    db.prepare("UPDATE plans SET is_active = 0").run();
  } catch (error) {
    logger.error("Error resetting meal plan in SQLite database:", error);
  }
}

/**
 * Direct update of a single recipe inside the active meal plan.
 */
export function updateRecipe(day: string, meal: string, recipe: Recipe | null): void {
  try {
    const active = getPlan();
    if (active.plan && active.plan.days) {
      const dayData = active.plan.days[day as keyof typeof active.plan.days];
      if (dayData) {
        dayData[meal as "breakfast" | "lunch" | "snack" | "dinner"] = recipe;
        savePlan(active.plan, active.metadata || { fileName: "Manual Edit", processedAt: new Date().toISOString() });
      }
    }
  } catch (error) {
    logger.error("Error updating recipe in SQLite database:", error);
  }
}

/**
 * Updates the plan_json of a specific plan by its ID.
 */
export function updatePlanJson(id: number, plan: MealPlan): void {
  try {
    db.prepare("UPDATE plans SET plan_json = ? WHERE id = ?").run(JSON.stringify(plan), id);
  } catch (error) {
    logger.error(`Error updating plan JSON for ID ${id} in SQLite database:`, error);
    throw error;
  }
}


/**
 * Retrieves the history of all analyzed plans.
 */
export function getHistory(): any[] {
  try {
    return db.prepare("SELECT id, file_name, saved_file_name, plan_json, metadata_json, is_active, created_at FROM plans ORDER BY created_at DESC").all();
  } catch (error) {
    logger.error("Error fetching history from database:", error);
    return [];
  }
}

/**
 * Restores a specific plan from history as the active plan.
 */
export function restorePlanFromHistory(id: number): { plan: MealPlan; metadata: PlanMetadata } | null {
  try {
    const planRow = db.prepare("SELECT metadata_json FROM plans WHERE id = ?").get(id) as any;
    if (planRow) {
      // 1. Deactivate all plans
      db.prepare("UPDATE plans SET is_active = 0").run();
      // 2. Set this plan as active
      db.prepare("UPDATE plans SET is_active = 1 WHERE id = ?").run(id);

      const plan = ensurePlanIsEnriched(id);
      const metadata = JSON.parse(planRow.metadata_json);
      metadata.id = id;
      return { plan: plan!, metadata };
    }
  } catch (error) {
    logger.error("Error restoring plan from history:", error);
  }
  return null;
}

/**
 * Deletes a plan from history and returns the saved file name so the server can delete the PDF.
 */
export function deleteHistoryItem(id: number): string | null {
  try {
    const row = db.prepare("SELECT saved_file_name FROM plans WHERE id = ?").get(id) as any;
    db.prepare("DELETE FROM plans WHERE id = ?").run(id);
    return row ? row.saved_file_name : null;
  } catch (error) {
    logger.error("Error deleting plan from database:", error);
    return null;
  }
}

/**
 * Retrieves the saved grocery list state from SQLite.
 */
export function getGroceryListState(): any {
  try {
    const row = db.prepare("SELECT * FROM grocery_list_state WHERE id = 1").get() as any;
    if (row) {
      return {
        checkedItems: row.checked_items_json ? JSON.parse(row.checked_items_json) : {},
        listType: row.list_type || "semanal",
        selectedSingleDay: row.selected_single_day || "",
        selected3DaysStart: row.selected_3days_start || "",
        excludedMeals: row.excluded_meals_json ? JSON.parse(row.excluded_meals_json) : [],
        multipliers: row.multipliers_json ? JSON.parse(row.multipliers_json) : {}
      };
    }
  } catch (error) {
    logger.error("Error reading grocery list state from database:", error);
  }
  return null;
}

/**
 * Saves the grocery list state in SQLite.
 */
export function saveGroceryListState(state: {
  checkedItems: any;
  listType: string;
  selectedSingleDay: string;
  selected3DaysStart: string;
  excludedMeals: string[];
  multipliers: any;
}): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO grocery_list_state (id, checked_items_json, list_type, selected_single_day, selected_3days_start, excluded_meals_json, multipliers_json, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        checked_items_json = excluded.checked_items_json,
        list_type = excluded.list_type,
        selected_single_day = excluded.selected_single_day,
        selected_3days_start = excluded.selected_3days_start,
        excluded_meals_json = excluded.excluded_meals_json,
        multipliers_json = excluded.multipliers_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      JSON.stringify(state.checkedItems),
      state.listType,
      state.selectedSingleDay,
      state.selected3DaysStart,
      JSON.stringify(state.excludedMeals),
      JSON.stringify(state.multipliers),
      new Date().toISOString()
    );
  } catch (error) {
    logger.error("Error saving grocery list state to database:", error);
  }
}

/**
 * Retrieves the completed recipes state for a specific plan ID.
 */
export function getCompletedRecipes(planId: number): Record<string, boolean> {
  try {
    const row = db.prepare("SELECT completed_json FROM completed_recipes_state WHERE plan_id = ?").get(planId) as any;
    if (row && row.completed_json) {
      return JSON.parse(row.completed_json);
    }
  } catch (error) {
    logger.error("Error reading completed recipes state from database:", error);
  }
  return {};
}

/**
 * Saves the completed recipes state for a specific plan ID.
 */
export function saveCompletedRecipes(planId: number, completedRecipes: Record<string, boolean>): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO completed_recipes_state (plan_id, completed_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(plan_id) DO UPDATE SET
        completed_json = excluded.completed_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(planId, JSON.stringify(completedRecipes), new Date().toISOString());
  } catch (error) {
    logger.error("Error saving completed recipes state to database:", error);
  }
}

/**
 * Retrieves the most recent 10 search history items.
 */
export interface SearchHistoryItem {
  id: number;
  planId: number;
  planName: string;
  day: string;
  meal: string;
  recipeName: string;
  image: string;
  isActive: boolean;
  clickedAt: string;
}

export function getSearchHistory(): SearchHistoryItem[] {
  try {
    const rows = db.prepare(
      "SELECT id, plan_id, plan_name, day, meal, recipe_name, image, is_active, clicked_at FROM search_history ORDER BY clicked_at DESC LIMIT 10"
    ).all() as any[];
    return rows.map(r => ({
      id: r.id,
      planId: r.plan_id,
      planName: r.plan_name,
      day: r.day,
      meal: r.meal,
      recipeName: r.recipe_name,
      image: r.image,
      isActive: !!r.is_active,
      clickedAt: r.clicked_at
    }));
  } catch (error) {
    logger.error("Error reading search history from database:", error);
    return [];
  }
}

/**
 * Adds a click to the search history, capping the table at 10 records.
 */
export function addSearchHistoryItem(item: Omit<SearchHistoryItem, 'id' | 'clickedAt'>): void {
  try {
    db.prepare(`
      INSERT INTO search_history (plan_id, plan_name, day, meal, recipe_name, image, is_active, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.planId,
      item.planName,
      item.day,
      item.meal,
      item.recipeName,
      item.image,
      item.isActive ? 1 : 0,
      new Date().toISOString()
    );
    // Keep only the 10 most recent entries
    db.prepare(`
      DELETE FROM search_history
      WHERE id NOT IN (
        SELECT id FROM search_history ORDER BY clicked_at DESC LIMIT 10
      )
    `).run();
  } catch (error) {
    logger.error("Error adding search history item to database:", error);
  }
}

/**
 * Deletes a single search history entry by its ID.
 */
export function deleteSearchHistoryItem(id: number): void {
  try {
    db.prepare("DELETE FROM search_history WHERE id = ?").run(id);
  } catch (error) {
    logger.error("Error deleting search history item from database:", error);
  }
}

/**
 * Clears all search history entries.
 */
export function clearSearchHistory(): void {
  try {
    db.prepare("DELETE FROM search_history").run();
  } catch (error) {
    logger.error("Error clearing search history from database:", error);
  }
}

/**
 * Retrieves the batch cooking guide and params for the active plan.
 */
export function getBatchCooking(): { guide: string | null; params: string | null } {
  try {
    const row = db.prepare("SELECT batch_cooking_json, batch_cooking_params FROM plans WHERE is_active = 1 LIMIT 1").get() as any;
    if (row) {
      return {
        guide: row.batch_cooking_json || null,
        params: row.batch_cooking_params || null
      };
    }
  } catch (error) {
    logger.error("Error reading batch cooking from SQLite database:", error);
  }
  return { guide: null, params: null };
}

/**
 * Saves the batch cooking guide and params for the active plan.
 */
export function saveBatchCooking(guide: string, params: string): void {
  try {
    db.prepare("UPDATE plans SET batch_cooking_json = ?, batch_cooking_params = ? WHERE is_active = 1").run(guide, params);
  } catch (error) {
    logger.error("Error saving batch cooking to SQLite database:", error);
  }
}

/**
 * Resets the batch cooking guide for the active plan.
 */
export function resetBatchCooking(): void {
  try {
    db.prepare("UPDATE plans SET batch_cooking_json = NULL, batch_cooking_params = NULL WHERE is_active = 1").run();
  } catch (error) {
    logger.error("Error resetting batch cooking in SQLite database:", error);
  }
}

/**
 * Exports all database tables to a single JSON structure.
 */
export function exportBackupData(): any {
  try {
    const plans = db.prepare("SELECT * FROM plans").all();
    const groceryListState = db.prepare("SELECT * FROM grocery_list_state").all();
    const completedRecipesState = db.prepare("SELECT * FROM completed_recipes_state").all();
    const searchHistory = db.prepare("SELECT * FROM search_history").all();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      plans,
      groceryListState,
      completedRecipesState,
      searchHistory
    };
  } catch (error) {
    logger.error("Error exporting backup data:", error);
    throw error;
  }
}

/**
 * Restores the database from a backup JSON structure.
 */
export function importBackupData(data: any): void {
  const transaction = db.transaction(() => {
    // 1. Clear existing tables
    db.prepare("DELETE FROM plans").run();
    db.prepare("DELETE FROM grocery_list_state").run();
    db.prepare("DELETE FROM completed_recipes_state").run();
    db.prepare("DELETE FROM search_history").run();

    // 2. Insert plans
    if (Array.isArray(data.plans)) {
      const stmt = db.prepare(`
        INSERT INTO plans (id, file_name, saved_file_name, plan_json, metadata_json, is_active, created_at, file_hash, batch_cooking_json, batch_cooking_params)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of data.plans) {
        stmt.run(
          p.id,
          p.file_name,
          p.saved_file_name,
          p.plan_json,
          p.metadata_json,
          p.is_active,
          p.created_at,
          p.file_hash,
          p.batch_cooking_json,
          p.batch_cooking_params
        );
      }
    }

    // 3. Insert grocery list state
    if (Array.isArray(data.groceryListState)) {
      const stmt = db.prepare(`
        INSERT INTO grocery_list_state (id, checked_items_json, list_type, selected_single_day, selected_3days_start, excluded_meals_json, multipliers_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const g of data.groceryListState) {
        stmt.run(
          g.id,
          g.checked_items_json,
          g.list_type,
          g.selected_single_day,
          g.selected_3days_start,
          g.excluded_meals_json,
          g.multipliers_json,
          g.updated_at
        );
      }
    }

    // 4. Insert completed recipes state
    if (Array.isArray(data.completedRecipesState)) {
      const stmt = db.prepare(`
        INSERT INTO completed_recipes_state (plan_id, completed_json, updated_at)
        VALUES (?, ?, ?)
      `);
      for (const c of data.completedRecipesState) {
        stmt.run(c.plan_id, c.completed_json, c.updated_at);
      }
    }

    // 5. Insert search history
    if (Array.isArray(data.searchHistory)) {
      const stmt = db.prepare(`
        INSERT INTO search_history (id, plan_id, plan_name, day, meal, recipe_name, image, is_active, clicked_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.searchHistory) {
        stmt.run(
          s.id,
          s.plan_id,
          s.plan_name,
          s.day,
          s.meal,
          s.recipe_name,
          s.image,
          s.is_active,
          s.clicked_at
        );
      }
    }
  });

  try {
    transaction();
    logger.info("Database successfully restored from backup.");
  } catch (error) {
    logger.error("Error importing backup data:", error);
    throw error;
  }
}

/**
 * Inserts ingredients into the database.
 */
export function saveRecipeIngredients(ingredientsList: any[]): void {
  const stmt = db.prepare(`
    INSERT INTO ingredients (name, category, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      category = COALESCE(excluded.category, category),
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  
  const transaction = db.transaction((list) => {
    for (const ing of list) {
      if (ing && ing.name) {
        const normalizedName = ing.name.trim().toLowerCase();
        stmt.run(normalizedName, ing.category || "Otros", now, now);
      }
    }
  });

  try {
    transaction(ingredientsList);
  } catch (error) {
    logger.error("Error saving recipe ingredients:", error);
  }
}

/**
 * Normalizes ingredients to a flat list of Ingredient structures
 */
function getFlatIngredients(ingredients: any): any[] {
  if (Array.isArray(ingredients)) {
    return ingredients;
  }
  const results: any[] = [];
  if (ingredients && typeof ingredients === "object") {
    for (const key of ["primerPlato", "segundoPlato", "postre", "general"]) {
      if (Array.isArray(ingredients[key])) {
        results.push(...ingredients[key]);
      }
    }
  }
  return results;
}

/**
 * Extracts and saves unique recipes from a meal plan.
 */
export function saveUniqueRecipesFromPlan(plan: MealPlan, planId?: number): void {
  if (!plan || !plan.days) return;

  const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const mealsKeys = ["breakfast", "lunch", "snack", "dinner"] as const;

  const now = new Date().toISOString();

  // Temporary list to process recipes sequentially without duplicate names in the same plan
  const planRecipesMap = new Map<string, Recipe>();

  for (const day of daysKeys) {
    for (const meal of mealsKeys) {
      const recipe = plan.days[day]?.[meal];
      if (recipe && recipe.recipeName) {
        const normalizedName = recipe.recipeName.trim();
        // Keep the first occurrence (with its image)
        if (!planRecipesMap.has(normalizedName.toLowerCase())) {
          planRecipesMap.set(normalizedName.toLowerCase(), recipe);
        }
      }
    }
  }

  const insertRecipeStmt = db.prepare(`
    INSERT INTO recipes (
      recipe_name, calories, time, tag, image, ingredients_json, tips, steps_json,
      nutritionist_tips, servings, source, source_plan_id, is_ai_generated, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(recipe_name) DO NOTHING
  `);

  for (const [key, recipe] of planRecipesMap.entries()) {
    try {
      const ingredients = recipe.ingredients || [];
      const steps = recipe.steps || [];
      const servings = typeof recipe.servings === "number" && recipe.servings >= 1 ? recipe.servings : 1;
      
      insertRecipeStmt.run(
        recipe.recipeName,
        recipe.calories || 0,
        recipe.time || "20 min",
        recipe.tag || null,
        recipe.image || null,
        JSON.stringify(ingredients),
        recipe.tips || "",
        JSON.stringify(steps),
        recipe.nutritionistTips || null,
        servings,
        "plan",
        planId || null,
        0,
        now,
        now
      );

      // Save the ingredients into the ingredients dictionary
      const flatIngredients = getFlatIngredients(ingredients);
      saveRecipeIngredients(flatIngredients);
    } catch (err) {
      logger.error(`Error saving recipe ${recipe.recipeName} from plan:`, err);
    }
  }
}

/**
 * Enriches the plan_json column of a specific plan by resolving its recipes' names to their database IDs.
 * Returns true if the plan was modified and saved.
 */
export function enrichPlanJsonWithRecipeIds(planId: number): boolean {
  try {
    const row = db.prepare("SELECT plan_json FROM plans WHERE id = ?").get(planId) as any;
    if (!row || !row.plan_json) return false;
    const plan = JSON.parse(row.plan_json) as MealPlan;
    if (!plan || !plan.days) return false;

    const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
    const mealsKeys = ["breakfast", "lunch", "snack", "dinner"] as const;

    const recipeNamesWithoutId: string[] = [];
    for (const day of daysKeys) {
      for (const meal of mealsKeys) {
        const recipe = plan.days[day]?.[meal];
        if (recipe && recipe.recipeName && (recipe.id === undefined || recipe.id === null)) {
          recipeNamesWithoutId.push(recipe.recipeName);
        }
      }
    }

    if (recipeNamesWithoutId.length === 0) return false;

    // Resolve name to ID using our bulk resolver
    const nameToIdMap = getRecipeBookIdsByNames(recipeNamesWithoutId);
    let modified = false;

    for (const day of daysKeys) {
      for (const meal of mealsKeys) {
        const recipe = plan.days[day]?.[meal];
        if (recipe && recipe.recipeName && (recipe.id === undefined || recipe.id === null)) {
          const id = nameToIdMap.get(recipe.recipeName.trim().toLowerCase());
          if (id !== undefined && id !== null) {
            recipe.id = id;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      db.prepare("UPDATE plans SET plan_json = ? WHERE id = ?").run(JSON.stringify(plan), planId);
      return true;
    }
  } catch (error) {
    logger.error(`Error enriching plan JSON for ID ${planId} with recipe IDs:`, error);
  }
  return false;
}

/**
 * CRUD functions for recipes in the Recipe Book
 */

export function getRecipes(): Recipe[] {
  try {
    const rows = db.prepare("SELECT * FROM recipes ORDER BY created_at DESC").all() as any[];
    return rows.map(r => ({
      id: r.id,
      recipeName: r.recipe_name,
      calories: r.calories,
      time: r.time,
      tag: r.tag || undefined,
      image: r.image || undefined,
      ingredients: JSON.parse(r.ingredients_json),
      tips: r.tips,
      steps: JSON.parse(r.steps_json),
      nutritionistTips: r.nutritionist_tips || undefined,
      servings: r.servings || 1,
      source: (r.source as any) || "manual",
      sourcePlanId: r.source_plan_id || undefined,
      isAiGenerated: !!r.is_ai_generated,
      isFavorite: !!r.is_favorite,
      season: r.season || "Todas",
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } catch (error) {
    logger.error("Error reading recipes from database:", error);
    return [];
  }
}

export function getRecipeById(id: number): Recipe | null {
  try {
    const r = db.prepare("SELECT * FROM recipes WHERE id = ?").get(id) as any;
    if (r) {
      return {
        id: r.id,
        recipeName: r.recipe_name,
        calories: r.calories,
        time: r.time,
        tag: r.tag || undefined,
        image: r.image || undefined,
        ingredients: JSON.parse(r.ingredients_json),
        tips: r.tips,
        steps: JSON.parse(r.steps_json),
        nutritionistTips: r.nutritionist_tips || undefined,
        servings: r.servings || 1,
        source: (r.source as any) || "manual",
        sourcePlanId: r.source_plan_id || undefined,
        isAiGenerated: !!r.is_ai_generated,
        isFavorite: !!r.is_favorite,
        season: r.season || "Todas",
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    }
  } catch (error) {
    logger.error(`Error reading recipe ID ${id} from database:`, error);
  }
  return null;
}

export function insertRecipe(recipe: Omit<Recipe, "id">): number {
  try {
    const now = new Date().toISOString();
    const servings = typeof recipe.servings === "number" && recipe.servings >= 1 ? recipe.servings : 1;
    const isAiGenerated = recipe.isAiGenerated ? 1 : 0;
    const isFavorite = recipe.isFavorite ? 1 : 0;
    const season = recipe.season || "Todas";
    
    const stmt = db.prepare(`
      INSERT INTO recipes (
        recipe_name, calories, time, tag, image, ingredients_json, tips, steps_json,
        nutritionist_tips, servings, source, source_plan_id, is_ai_generated, is_favorite, season, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      recipe.recipeName,
      recipe.calories || 0,
      recipe.time || "20 min",
      recipe.tag || null,
      recipe.image || null,
      JSON.stringify(recipe.ingredients),
      recipe.tips || "",
      JSON.stringify(recipe.steps || []),
      recipe.nutritionistTips || null,
      servings,
      recipe.source || "manual",
      recipe.sourcePlanId || null,
      isAiGenerated,
      isFavorite,
      season,
      now,
      now
    );

    // Save ingredients to the dictionary table
    const flatIngredients = getFlatIngredients(recipe.ingredients);
    saveRecipeIngredients(flatIngredients);

    return result.lastInsertRowid as number;
  } catch (error) {
    logger.error("Error inserting recipe into database:", error);
    throw error;
  }
}

export function updateRecipeInBook(id: number, recipe: Recipe): void {
  try {
    const now = new Date().toISOString();
    const servings = typeof recipe.servings === "number" && recipe.servings >= 1 ? recipe.servings : 1;
    const isAiGenerated = recipe.isAiGenerated ? 1 : 0;
    const isFavorite = recipe.isFavorite ? 1 : 0;
    const season = recipe.season || "Todas";

    const stmt = db.prepare(`
      UPDATE recipes
      SET recipe_name = ?, calories = ?, time = ?, tag = ?, image = ?,
          ingredients_json = ?, tips = ?, steps_json = ?, nutritionist_tips = ?,
          servings = ?, source = ?, source_plan_id = ?, is_ai_generated = ?, is_favorite = ?, season = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      recipe.recipeName,
      recipe.calories || 0,
      recipe.time || "20 min",
      recipe.tag || null,
      recipe.image || null,
      JSON.stringify(recipe.ingredients),
      recipe.tips || "",
      JSON.stringify(recipe.steps || []),
      recipe.nutritionistTips || null,
      servings,
      recipe.source || "manual",
      recipe.sourcePlanId || null,
      isAiGenerated,
      isFavorite,
      season,
      now,
      id
    );

    // Save ingredients to the dictionary table
    const flatIngredients = getFlatIngredients(recipe.ingredients);
    saveRecipeIngredients(flatIngredients);
  } catch (error) {
    logger.error(`Error updating recipe ID ${id} in database:`, error);
    throw error;
  }
}

export function deleteRecipeInBook(id: number): void {
  try {
    db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
  } catch (error) {
    logger.error(`Error deleting recipe ID ${id} from database:`, error);
    throw error;
  }
}

export function getRecipeIdByName(recipeName: string): number | null {
  try {
    const row = db.prepare("SELECT id FROM recipes WHERE LOWER(recipe_name) = ?").get(recipeName.trim().toLowerCase()) as any;
    return row ? row.id : null;
  } catch (error) {
    logger.error("Error finding recipe ID by name:", error);
    return null;
  }
}

/**
 * Bulk resolves recipe names to their recipe-book IDs in a single query.
 * Returns a Map from lowercase recipe name to id.
 */
export function getRecipeBookIdsByNames(names: string[]): Map<string, number> {
  const result = new Map<string, number>();
  if (!names.length) return result;
  try {
    const placeholders = names.map(() => "?").join(", ");
    const lowerNames = names.map(n => n.trim().toLowerCase());
    const rows = db.prepare(
      `SELECT id, LOWER(recipe_name) AS lower_name FROM recipes WHERE LOWER(recipe_name) IN (${placeholders})`
    ).all(...lowerNames) as any[];
    for (const row of rows) {
      result.set(row.lower_name, row.id);
    }
  } catch (error) {
    logger.error("Error bulk-resolving recipe IDs by name:", error);
  }
  return result;
}


export function getIngredients(): any[] {
  try {
    return db.prepare("SELECT * FROM ingredients ORDER BY name ASC").all();
  } catch (error) {
    logger.error("Error reading ingredients from database:", error);
    return [];
  }
}

/**
 * Updates the image URL for matching recipes in the Recipe Book.
 */
export function updateRecipeImageInBook(recipeId: number, newImageUrl: string): void {
  try {
    const recipe = getRecipeById(recipeId);
    if (recipe) {
      recipe.image = newImageUrl;
      updateRecipeInBook(recipeId, recipe);
    }
  } catch (error) {
    logger.error("Error updating recipe image in book:", error);
  }
}

/**
 * Updates the image URL for matching recipes in the active or historical plans.
 */
export function updateRecipeImageInPlan(planId: number | undefined, day: string | null | undefined, meal: string | null | undefined, newImageUrl: string, recipeId?: number): { plan: MealPlan | null; metadata: PlanMetadata | null } {
  try {
    let plan: MealPlan | null = null;
    let metadata: PlanMetadata | null = null;
    let targetId: number | null = null;

    if (planId) {
      const row = db.prepare("SELECT plan_json, metadata_json FROM plans WHERE id = ?").get(planId) as any;
      if (row) {
        plan = JSON.parse(row.plan_json);
        metadata = JSON.parse(row.metadata_json);
        targetId = planId;
      }
    } else {
      const active = getPlan();
      plan = active.plan;
      metadata = active.metadata;
      targetId = metadata?.id || null;
    }

    if (plan && plan.days) {
      let modified = false;

      // 1. If day and meal are specified, update that specific position
      if (day && meal) {
        const d = day as keyof typeof plan.days;
        const m = meal as "breakfast" | "lunch" | "snack" | "dinner";
        if (plan.days[d] && plan.days[d][m]) {
          plan.days[d][m]!.image = newImageUrl;
          modified = true;
        }
      }

      // 2. Also search by recipeId to update all occurrences of the same recipe in the plan
      if (recipeId) {
        const daysKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
        const mealsKeys = ["breakfast", "lunch", "snack", "dinner"] as const;
        for (const d of daysKeys) {
          for (const m of mealsKeys) {
            const r = plan.days[d]?.[m];
            if (r && r.id === recipeId) {
              r.image = newImageUrl;
              modified = true;
            }
          }
        }
      }

      if (modified && targetId) {
        db.prepare("UPDATE plans SET plan_json = ? WHERE id = ?").run(JSON.stringify(plan), targetId);
      }
    }
    return { plan, metadata };
  } catch (error) {
    logger.error("Error updating recipe image in plan:", error);
    return { plan: null, metadata: null };
  }
}

export function closeDb(): void {
  try {
    db.close();
  } catch (error) {
    logger.error("Error closing database:", error);
  }
}


