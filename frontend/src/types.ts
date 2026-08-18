export interface Ingredient {
  name: string;
  originalAmount: number; // base amount for 1 rating
  unit: string;
  secondaryAmount?: number; // optional: secondary quantity (e.g. weight in g for egg)
  secondaryUnit?: string;   // optional: secondary unit (e.g. "g")
  category?: string;        // category for grocery list grouping
  preparation?: string;     // preparation method (e.g. "hervido", "lonchas")
}

export interface CategorizedIngredients {
  primerPlato?: Ingredient[];
  segundoPlato?: Ingredient[];
  postre?: Ingredient[];
  general?: Ingredient[];
}

export interface CategorizedSteps {
  primerPlato?: string[];
  segundoPlato?: string[];
  postre?: string[];
  general?: string[];
}

export interface RecipeNutrition {
  calories: number; // kcal per serving
  protein: number; // grams per serving
  carbs: number; // grams per serving
  fat: number; // grams per serving
}

export interface Recipe {
  id?: number;
  recipeName: string;
  calories: number;
  time: string;
  tag?: string; // optional
  image?: string; // optional
  ingredients: CategorizedIngredients | Ingredient[];
  tips: string;
  steps?: CategorizedSteps | string[]; // optional: detailed culinary steps
  servings?: number; // optional, minimum 1
  nutritionistTips?: string; // optional
  nutrition?: RecipeNutrition; // optional: per-serving macros, absent = not available
  source?: "plan" | "manual" | "ocr" | "document" | "text"; // optional since plans parsed from PDFs might not have it initially
  sourcePlanId?: number; // optional
  isAiGenerated?: boolean; // optional
  isFavorite?: boolean; // optional
  season?: string; // optional
  createdAt?: string; // optional
  updatedAt?: string; // optional
}

export type MealType = "breakfast" | "lunch" | "snack" | "dinner";

export type DayType = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export interface MealPlan {
  days: {
    [key in DayType]: {
      [key in MealType]: Recipe | null; // null if empty or skipped
    };
  };
}

export interface PlanMetadata {
  id?: number;
  fileName: string;
  savedFileName?: string;
  processedAt: string;
}
