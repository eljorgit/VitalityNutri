import i18n from "../i18n/config";
import { SUPPORTED_LANGS, type SupportedLang } from "../i18n/config";

type RouteDict = Record<string, string>;

function getRouteDict(lang: string): RouteDict {
  const resources = i18n.getResourceBundle(lang, "translation") as any;
  return resources?.routes || {};
}

function getDayDict(lang: string): Record<string, string> {
  const resources = i18n.getResourceBundle(lang, "translation") as any;
  return resources?.days || {};
}

function getMealDict(lang: string): Record<string, string> {
  const resources = i18n.getResourceBundle(lang, "translation") as any;
  return resources?.meals || {};
}

function reverseDict(d: Record<string, string>): Record<string, string> {
  const rev: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    rev[v] = k;
  }
  return rev;
}

const VALID_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const VALID_MEALS = ["breakfast", "lunch", "snack", "dinner"];

/**
 * Convert a canonical (English-internal) path to a localized URL path.
 * Example: /recipe/monday/breakfast → /receta/lunes/desayuno
 */
export function getLocalizedPath(canonicalPath: string, lang: string): string {
  const routes = getRouteDict(lang);
  const days = getDayDict(lang);
  const meals = getMealDict(lang);

  let result = canonicalPath;

  // Replace /recipe/:day/:meal → /{localized_recipe}/{localized_day}/{localized_meal}
  const recipeMatch = canonicalPath.match(/^\/recipe\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (recipeMatch) {
    const day = recipeMatch[1];
    const meal = recipeMatch[2];
    const rest = recipeMatch[3] || "";
    const localizedRecipe = routes["recipe"] || "recipe";
    const localizedDay = days[day] || day;
    const localizedMeal = meals[meal] || meal;
    return `/${localizedRecipe}/${localizedDay}/${localizedMeal}${rest}`;
  }

  // Replace /recipe-book → /{localized_recipe-book}
  if (canonicalPath.startsWith("/recipe-book")) {
    const localizedBase = routes["recipe-book"] || "recipe-book";
    const rest = canonicalPath.slice("/recipe-book".length);
    if (rest === "") return `/${localizedBase}`;

    // /recipe-book/new
    if (rest === "/new") {
      const localizedNew = routes["recipe-book_new"] || "new";
      return `/${localizedBase}/${localizedNew}`;
    }

    // /recipe-book/recipe/:id
    const recipeMatch2 = rest.match(/^\/recipe\/(.+)$/);
    if (recipeMatch2) {
      const localizedRecipe = routes["recipe-book_recipe"] || "recipe";
      return `/${localizedBase}/${localizedRecipe}/${recipeMatch2[1]}`;
    }

    // /recipe-book/edit/:id
    const editMatch = rest.match(/^\/edit\/(.+)$/);
    if (editMatch) {
      const localizedEdit = routes["recipe-book_edit"] || "edit";
      return `/${localizedBase}/${localizedEdit}/${editMatch[1]}`;
    }

    return `/${localizedBase}${rest}`;
  }

  // Replace other top-level routes
  for (const [canonicalKey, localizedVal] of Object.entries(routes)) {
    if (canonicalKey.includes("_")) continue; // skip sub-routes
    if (result === `/${canonicalKey}` || result.startsWith(`/${canonicalKey}/`)) {
      result = result.replace(`/${canonicalKey}`, `/${localizedVal}`);
      break;
    }
  }

  return result;
}

/**
 * Convert a localized URL path back to canonical (English-internal) path.
 * Example: /receta/lunes/desayuno → /recipe/monday/breakfast
 */
export function getCanonicalPath(localizedPath: string, lang: string): string {
  const routes = getRouteDict(lang);
  const daysRev = reverseDict(getDayDict(lang));
  const mealsRev = reverseDict(getMealDict(lang));

  let path = localizedPath;
  const parts = path.split("/").filter(Boolean);

  if (parts.length < 1) return path;

  const first = parts[0];
  const second = parts[1];
  const third = parts[2];

  // Detect /{localized_recipe}/{day}/{meal}
  const localizedRecipe = routes["recipe"] || "recipe";
  if (first === localizedRecipe && second && third) {
    const canonicalDay = daysRev[second] || second;
    const canonicalMeal = mealsRev[third] || third;
    const rest = parts.slice(3).length > 0 ? "/" + parts.slice(3).join("/") : "";
    return `/recipe/${canonicalDay}/${canonicalMeal}${rest}`;
  }

  // Detect /{localized_recipe-book}/...
  const localizedRecipeBook = routes["recipe-book"] || "recipe-book";
  if (first === localizedRecipeBook) {
    if (!second) return "/recipe-book";

    // /{recipe-book}/{new}
    const localizedNew = routes["recipe-book_new"] || "new";
    if (second === localizedNew) return "/recipe-book/new";

    // /{recipe-book}/{recipe}/:id
    const localizedRecipeSub = routes["recipe-book_recipe"] || "recipe";
    if (second === localizedRecipeSub && third) {
      return `/recipe-book/recipe/${third}`;
    }

    // /{recipe-book}/{edit}/:id
    const localizedEdit = routes["recipe-book_edit"] || "edit";
    if (second === localizedEdit && third) {
      return `/recipe-book/edit/${third}`;
    }

    return `/recipe-book/${second}`;
  }

  // Try matching top-level routes
  const revRoutes = reverseDict(routes);
  for (const key of SUPPORTED_LANGS) {
    const langRoutes = getRouteDict(key);
    for (const [canonicalKey, localizedVal] of Object.entries(langRoutes)) {
      if (canonicalKey.includes("_")) continue;
      if (first === localizedVal) {
        path = path.replace(new RegExp(`^/${localizedVal}`), `/${canonicalKey}`);
        return path;
      }
    }
  }

  return path;
}

/**
 * Build a navigation path in the current language.
 * Takes a canonical path and returns a localized path.
 */
export function navigateTo(canonicalPath: string): string {
  const lang = i18n.language;
  return getLocalizedPath(canonicalPath, lang);
}
