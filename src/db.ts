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
  CREATE TABLE IF NOT EXISTS active_plan (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    plan_json TEXT,
    metadata_json TEXT,
    updated_at TEXT
  )
`);

/**
 * Retrieves the currently active meal plan and metadata from the SQLite database.
 */
export function getPlan(): { plan: MealPlan | null; metadata: PlanMetadata | null } {
  try {
    const row = db.prepare("SELECT plan_json, metadata_json FROM active_plan WHERE id = 1").get() as any;
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
export function savePlan(plan: MealPlan, metadata: PlanMetadata): void {
  try {
    const stmt = db.prepare(`
      INSERT INTO active_plan (id, plan_json, metadata_json, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        plan_json = excluded.plan_json,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `);
    stmt.run(JSON.stringify(plan), JSON.stringify(metadata), new Date().toISOString());
  } catch (error) {
    console.error("Error saving meal plan to SQLite database:", error);
  }
}

/**
 * Removes the meal plan and metadata from the database (Resets it).
 */
export function resetPlan(): void {
  try {
    db.prepare("DELETE FROM active_plan WHERE id = 1").run();
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
