export const MEAL_TAGS = ["breakfast", "meal", "snack", "dessert"] as const;
export type MealTag = typeof MEAL_TAGS[number];

export const DESCRIPTOR_TAGS = [
  "healthy", "high_protein", "high_fiber", "low_calorie",
  "vegetarian", "vegan", "gluten_free", "quick", "keto",
  "post_workout", "filling", "traditional", "light", "omega3",
  "refreshing", "healthy_fats"
] as const;
export type DescriptorTag = typeof DESCRIPTOR_TAGS[number];

export const MEAL_TAG_ICONS: Record<string, string> = {
  Todos: "restaurant_menu",
  breakfast: "coffee",
  meal: "local_dining",
  snack: "cookie",
  dessert: "cake",
};

export function parseTag(tag: string | undefined): { meal: string | null; descriptor: string | null } {
  if (!tag) return { meal: null, descriptor: null };

  const parts = tag.split("|");
  return {
    meal: parts[0] && MEAL_TAGS.includes(parts[0] as MealTag) ? parts[0] : null,
    descriptor: parts[1] && DESCRIPTOR_TAGS.includes(parts[1] as DescriptorTag) ? parts[1] : null,
  };
}

export function formatTag(meal: string, descriptor?: string): string {
  return descriptor ? `${meal}|${descriptor}` : meal;
}

export function getMealTag(tag: string | undefined): string | null {
  return parseTag(tag).meal;
}

export function translateTag(tag: string | undefined, t: (key: string) => string): string {
  const { meal, descriptor } = parseTag(tag);
  if (!meal) return t("tags.general");
  const mealTranslated = t(`tags.${meal}`);
  if (descriptor) {
    const descTranslated = t(`tags.${descriptor}`);
    return `${mealTranslated} · ${descTranslated}`;
  }
  return mealTranslated;
}

export function translateDescriptor(descriptor: string | undefined, t: (key: string) => string): string {
  if (!descriptor) return "";
  return t(`tags.${descriptor}`);
}
