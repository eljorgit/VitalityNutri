export interface Ingredient {
  name: string;
  originalAmount: number; // base amount for 1 rating
  unit: string;
  secondaryAmount?: number; // optional: secondary quantity (e.g. weight in g for egg)
  secondaryUnit?: string;   // optional: secondary unit (e.g. "g")
}

export interface Recipe {
  recipeName: string;
  calories: number;
  time: string;
  tag: string;
  image: string;
  ingredients: Ingredient[];
  tips: string;
  steps?: string[]; // optional: detailed culinary steps
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
  fileName: string;
  processedAt: string;
}
