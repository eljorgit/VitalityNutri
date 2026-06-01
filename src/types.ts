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

export interface Recipe {
  recipeName: string;
  calories: number;
  time: string;
  tag: string;
  image: string;
  ingredients: CategorizedIngredients | Ingredient[];
  tips: string;
  steps?: CategorizedSteps | string[]; // optional: detailed culinary steps
}

export type MealType = "desayuno" | "almuerzo" | "merienda" | "cena";

export type DayType = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

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
