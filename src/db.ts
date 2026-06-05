import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { MealPlan, PlanMetadata, Recipe } from "./types.js";

// Determine the database storage directory
const DB_DIR = path.join(process.cwd(), "data");

// Ensure the directory exists
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (error) {
  console.error("Error creating data directory:", error);
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
    created_at TEXT
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
`);

/**
 * Retrieves the currently active meal plan and metadata from the SQLite database.
 */
export function getPlan(): { plan: MealPlan | null; metadata: PlanMetadata | null } {
  try {
    const row = db.prepare("SELECT plan_json, metadata_json FROM plans WHERE is_active = 1 LIMIT 1").get() as any;
    if (row && row.plan_json) {
      return {
        plan: JSON.parse(row.plan_json),
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null
      };
    }
  } catch (error) {
    console.error("Error reading meal plan from SQLite database:", error);
  }
  return { plan: null, metadata: null };
}

/**
 * Saves or updates the active meal plan and metadata in the SQLite database.
 */
export function savePlan(plan: MealPlan, metadata: PlanMetadata, savedFileName?: string): void {
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

    if (existingId) {
      // Update existing plan
      metadata.id = existingId;
      if (savedFileName) {
        metadata.savedFileName = savedFileName;
      }
      const stmt = db.prepare(`
        UPDATE plans
        SET plan_json = ?, metadata_json = ?, is_active = 1, created_at = ?
        WHERE id = ?
      `);
      stmt.run(JSON.stringify(plan), JSON.stringify(metadata), new Date().toISOString(), existingId);
    } else {
      // Insert new plan
      const savedName = savedFileName || metadata.savedFileName || null;
      if (savedName) {
        metadata.savedFileName = savedName;
      }
      const stmt = db.prepare(`
        INSERT INTO plans (file_name, saved_file_name, plan_json, metadata_json, is_active, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `);
      const result = stmt.run(
        metadata.fileName,
        savedName,
        JSON.stringify(plan),
        JSON.stringify(metadata),
        new Date().toISOString()
      );
      
      metadata.id = result.lastInsertRowid as number;
      // Save metadata again with its new auto-increment ID
      db.prepare("UPDATE plans SET metadata_json = ? WHERE id = ?").run(JSON.stringify(metadata), metadata.id);
    }
  } catch (error) {
    console.error("Error saving meal plan to SQLite database:", error);
  }
}

/**
 * Removes the active meal plan and metadata from the database (sets is_active to 0).
 */
export function resetPlan(): void {
  try {
    db.prepare("UPDATE plans SET is_active = 0").run();
  } catch (error) {
    console.error("Error resetting meal plan in SQLite database:", error);
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
        dayData[meal as "desayuno" | "almuerzo" | "merienda" | "cena"] = recipe;
        savePlan(active.plan, active.metadata || { fileName: "Manual Edit", processedAt: new Date().toISOString() });
      }
    }
  } catch (error) {
    console.error("Error updating recipe in SQLite database:", error);
  }
}

/**
 * Retrieves the history of all analyzed plans.
 */
export function getHistory(): any[] {
  try {
    return db.prepare("SELECT id, file_name, saved_file_name, plan_json, metadata_json, is_active, created_at FROM plans ORDER BY created_at DESC").all();
  } catch (error) {
    console.error("Error fetching history from database:", error);
    return [];
  }
}

/**
 * Restores a specific plan from history as the active plan.
 */
export function restorePlanFromHistory(id: number): { plan: MealPlan; metadata: PlanMetadata } | null {
  try {
    const planRow = db.prepare("SELECT plan_json, metadata_json FROM plans WHERE id = ?").get(id) as any;
    if (planRow) {
      // 1. Deactivate all plans
      db.prepare("UPDATE plans SET is_active = 0").run();
      // 2. Set this plan as active
      db.prepare("UPDATE plans SET is_active = 1 WHERE id = ?").run(id);

      const plan = JSON.parse(planRow.plan_json);
      const metadata = JSON.parse(planRow.metadata_json);
      metadata.id = id;
      return { plan, metadata };
    }
  } catch (error) {
    console.error("Error restoring plan from history:", error);
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
    console.error("Error deleting plan from database:", error);
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
    console.error("Error reading grocery list state from database:", error);
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
    console.error("Error saving grocery list state to database:", error);
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
    console.error("Error reading completed recipes state from database:", error);
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
    console.error("Error saving completed recipes state to database:", error);
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
    console.error("Error reading search history from database:", error);
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
    console.error("Error adding search history item to database:", error);
  }
}

/**
 * Deletes a single search history entry by its ID.
 */
export function deleteSearchHistoryItem(id: number): void {
  try {
    db.prepare("DELETE FROM search_history WHERE id = ?").run(id);
  } catch (error) {
    console.error("Error deleting search history item from database:", error);
  }
}

/**
 * Clears all search history entries.
 */
export function clearSearchHistory(): void {
  try {
    db.prepare("DELETE FROM search_history").run();
  } catch (error) {
    console.error("Error clearing search history from database:", error);
  }
}

