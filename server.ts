import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Agent, setGlobalDispatcher } from "undici";

import { createApi } from "unsplash-js";

import { DEFAULT_MEAL_PLAN, DEFAULT_PLAN_METADATA } from "./src/defaultData.js";
import { MealPlan, PlanMetadata } from "./src/types.js";
import { getPlan, savePlan, resetPlan, updateRecipe, getHistory, restorePlanFromHistory, deleteHistoryItem, getGroceryListState, saveGroceryListState, getCompletedRecipes, saveCompletedRecipes, getSearchHistory, addSearchHistoryItem, deleteSearchHistoryItem, clearSearchHistory, getBatchCooking, saveBatchCooking, resetBatchCooking, findPlanByHash, exportBackupData, importBackupData, getRecipes, getRecipeById, insertRecipe, updateRecipeInBook, deleteRecipeInBook, getIngredients, updatePlanJson, updateRecipeImageInBook, updateRecipeImageInPlan, getRecipeIdByName, getRecipeBookIdsByNames, saveRecipeIngredients } from "./src/db.js";

dotenv.config();

// Globally increase Node fetch timeouts (built-in undici client) to 5 minutes to prevent random AbortError
// setGlobalDispatcher(new Agent({
//   headersTimeout: 300000,
//   bodyTimeout: 300000,
//   connectTimeout: 300000,
// }));

const app = express();
app.disable("x-powered-by");
const PORT = 5027;

// Support large payloads for PDF file uploads (base64)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

import { rateLimit } from "express-rate-limit";

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Demasiadas subidas de plan desde esta IP, por favor inténtalo de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const batchCookingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Demasiadas solicitudes de batch cooking desde esta IP, por favor inténtalo de nuevo en 5 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const deleteHistoryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { error: "Demasiadas peticiones de eliminación del historial." },
  standardHeaders: true,
  legacyHeaders: false,
});

const pageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Demasiadas peticiones.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Initialize the server-side Gemini client with a 5-minute timeout configuration to prevent undici HeadersTimeoutError
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      timeout: 300000, // 5 minutes timeout
    }
  })
  : null;

// Initialize Unsplash client
const unsplash = process.env.UNSPLASH_ACCESS_KEY && process.env.UNSPLASH_ACCESS_KEY.trim() !== ""
  ? createApi({ accessKey: process.env.UNSPLASH_ACCESS_KEY })
  : null;

/**
 * Helper to build the optimized prompt with extreme speed & conciseness instructions.
 */
async function getOptimizedPrompt(): Promise<string> {
  const promptText = await fs.promises.readFile(path.join(process.cwd(), "promt.md"), "utf-8");
  return promptText + `

---
# INSTRUCCIONES ULTRA-VELOCIDAD Y CONCISIÓN EXTREMA (CRÍTICO)
Para acelerar el tiempo de procesamiento y no exceder los límites de tiempo de espera, debes generar un JSON de longitud mínima:
1. **Minifica el JSON**: Genera el JSON en formato compacto/minificado, sin espacios en blanco innecesarios, tabulaciones ni saltos de línea adicionales.
2. **Nombres de recetas (\`recipeName\`):** Máximo 2-3 palabras simples y descriptivas.
3. **Nombres de ingredientes (\`name\`):** Nombre directo y ultra-corto de 1-2 palabras (ej: "Zanahoria" en vez de "Zanahoria fresca mediana", "Huevo" en vez de "Huevo cocido o duro").
4. **Pasos de preparación (\`steps\`):**
   - Sigue estrictamente las reglas de pasos detallados (mínimo de 3-4 pasos específicos para platos sencillos y entre 5 y 8 pasos secuenciales detallados para recetas elaboradas).
   - No resumas los pasos ni uses una brevedad extrema que omita los tiempos o instrucciones críticas.
5. **Consejos (\`tips\`):** Máximo 5 palabras simples (ej: "Usar aceite crudo.").
6. Evita palabras innecesarias, descripciones o conectores largos en los otros campos.
`;
}

/**
 * Helper to fill default values (images, calories, time, tags, tips) for recipes if missing.
 */
/**
 * Helper to get a verified Unsplash food image URL based on recipe name keywords.
 */
interface FoodCategoryMapping {
  keywords: string[];
  fallbackUrl: string;
  searchQuery: string;
}

const foodCategories: FoodCategoryMapping[] = [
  {
    // 1. Oats & Cereals (Breakfast porridge)
    keywords: ["avena", "porridge", "gachas", "oatmeal", "muesli", "granola", "cereal", "cereales"],
    fallbackUrl: "https://images.unsplash.com/photo-1517881917430-e70dfb3610aa?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "oatmeal bowl"
  },
  {
    // 2. Pasta plates (checked before general meats/proteins)
    keywords: ["pasta", "espagueti", "espaguetis", "macarrones", "tallarines", "lasana", "lasagna", "ravioles", "fideos", "noodles"],
    fallbackUrl: "https://images.unsplash.com/photo-1546549032-9571cd6b27df?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "pasta spaghetti"
  },
  {
    // 3. Rice & Quinoa plates
    keywords: ["arroz", "paella", "risotto", "quinoa", "cuscus", "cuscus"],
    fallbackUrl: "https://images.unsplash.com/photo-1534080564583-6be75777b70a?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "risotto rice"
  },
  {
    // 4. Pizza & Focaccia
    keywords: ["pizza", "focaccia"],
    fallbackUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "pizza"
  },
  {
    // 5. Salads
    keywords: ["ensalada", "salad", "cesar", "cesar"],
    fallbackUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "salad bowl"
  },
  {
    // 6. Avocado dishes (specifically avocado toast / fillings)
    keywords: ["aguacate", "avocado", "guacamole"],
    fallbackUrl: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "avocado toast"
  },
  {
    // 7. Toast, Sandwiches, Pitufos & Bread (checked before generic proteins so pitufo with chicken/tuna displays as a sandwich)
    keywords: ["pitufo", "tostada", "tosta", "sandwich", "sandich", "bocadillo", "pulguita", "mollete", "panecillo", "pan"],
    fallbackUrl: "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "healthy sandwich"
  },
  {
    // 8. Pancakes & Crepes
    keywords: ["tortitas", "pancakes", "crepes", "gofres", "waffles"],
    fallbackUrl: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "pancakes"
  },
  {
    // 9. Eggs & Tortillas
    keywords: ["huevo", "huevos", "tortilla", "revuelto", "poche", "pocha", "escalfado", "frito", "fritos"],
    fallbackUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "eggs breakfast"
  },
  {
    // 10. Salmon
    keywords: ["salmon"],
    fallbackUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "cooked salmon"
  },
  {
    // 11. Other Fish & Seafood
    keywords: ["pescado", "merluza", "bacalao", "lenguado", "lubina", "atun", "bonito", "emperador", "dorada", "trucha", "marisco", "pulpo", "gambas", "langostinos"],
    fallbackUrl: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "fish meal"
  },
  {
    // 12. Chicken & Poultry
    keywords: ["pollo", "pavo", "pechuga", "alitas", "muslo", "ave"],
    fallbackUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "grilled chicken"
  },
  {
    // 13. Meat (Beef, pork, etc.) - Uses a beautiful healthy grilled steak/salad image instead of heavy BBQ ribs
    keywords: ["carne", "ternera", "cerdo", "bistec", "filete", "lomo", "entrecot", "solomillo", "hamburguesa", "albondigas", "jamon"],
    fallbackUrl: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "steak beef"
  },
  {
    // 14. Soups, Caldos & Creams
    keywords: ["sopa", "crema", "caldo", "gazpacho", "salmorejo", "pure"],
    fallbackUrl: "https://images.unsplash.com/photo-1547592165-e1d17fed6005?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "vegetable soup"
  },
  {
    // 15. Yogurt & Dairy
    keywords: ["yogur", "yogurt", "kefir", "cuajada"],
    fallbackUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "yogurt bowl"
  },
  {
    // 16. Smoothies & Shakes
    keywords: ["batido", "smoothie", "licuado", "shake"],
    fallbackUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "smoothie"
  },
  {
    // 17. Fruits
    keywords: ["fruta", "fresas", "fresa", "platano", "manzana", "pera", "naranja", "kiwi", "uvas", "melocoton", "bayas", "arandanos", "frutas"],
    fallbackUrl: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "fruit platter"
  },
  {
    // 18. Nuts & Seeds
    keywords: ["frutos secos", "nueces", "almendras", "avellanas", "cacahuetes", "pistachos", "semillas", "chia", "pipas"],
    fallbackUrl: "https://images.unsplash.com/photo-1596701062351-df5f8a42f3c5?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "mixed nuts"
  },
  {
    // 19. Hummus & Dips
    keywords: ["hummus", "dip", "pate"],
    fallbackUrl: "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "hummus"
  },
  {
    // 20. Wraps & Tacos
    keywords: ["wrap", "taco", "tacos", "burrito", "fajita", "fajitas", "quesadilla"],
    fallbackUrl: "https://images.unsplash.com/photo-1626700051175-6518c4793f73?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "tacos wrap"
  },
  {
    // 21. Coffee & Tea
    keywords: ["cafe", "te", "infusion", "manzanilla", "poleo"],
    fallbackUrl: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "tea coffee cup"
  },
  {
    // 22. Cheese
    keywords: ["queso", "cottage", "requeson", "burgos", "mozzarella", "feta"],
    fallbackUrl: "https://images.unsplash.com/photo-1486887396153-fa416525c108?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "cheese plate"
  },
  {
    // 23. General Veggies & Greens
    keywords: ["verduras", "verdura", "vegetales", "espinacas", "espinaca", "brocoli", "calabacin", "berenjena", "pimiento", "zanahoria", "champinones", "champinon", "setas", "puerro", "apio", "esparragos"],
    fallbackUrl: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop",
    searchQuery: "cooked vegetables"
  }
];

function getVerifiedImageForRecipe(recipeName: string, mealType: string): string {
  const nameLower = recipeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const category of foodCategories) {
    if (category.keywords.some(kw => nameLower.includes(kw))) {
      return category.fallbackUrl;
    }
  }

  // Fallbacks based on meal type if no keyword matches (using more varied, premium fallback images)
  switch (mealType.toLowerCase()) {
    case "desayuno":
      return "https://images.unsplash.com/photo-1496042399014-dc73c4f2bde1?q=80&w=1000&auto=format&fit=crop"; // breakfast table
    case "almuerzo":
      return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop"; // salad/bowl
    case "merienda":
      return "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?q=80&w=1000&auto=format&fit=crop"; // premium snack table (tea, bread, fruit) - avoids repeating yogurt too much
    case "cena":
      return "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000&auto=format&fit=crop"; // dinner plate
    default:
      return "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop";
  }
}

function getSearchQueryForRecipe(recipeName: string, mealType: string): string {
  const nameLower = recipeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const category of foodCategories) {
    if (category.keywords.some(kw => nameLower.includes(kw))) {
      return category.searchQuery;
    }
  }

  // Fallbacks based on meal type if no keyword matches
  switch (mealType.toLowerCase()) {
    case "desayuno":
      return "healthy breakfast";
    case "almuerzo":
      return "healthy lunch";
    case "merienda":
      return "healthy snack";
    case "cena":
      return "healthy dinner";
    default:
      return "healthy food";
  }
}

/**
 * Helper to check if image URLs are valid (not 404 and not unreachable).
 * Checks all URLs concurrently using HEAD/GET requests with a short timeout.
 */
async function checkImageUrls(urls: string[]): Promise<boolean[]> {
  return Promise.all(
    urls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
        const res = await fetch(url, {
          method: "HEAD",
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (res.ok && res.status !== 404) {
          return true;
        }

        // If HEAD request is not allowed (e.g. 405 Method Not Allowed), retry with GET (Range)
        if (res.status === 405) {
          const controller2 = new AbortController();
          const timeoutId2 = setTimeout(() => controller2.abort(), 2000);
          const res2 = await fetch(url, {
            method: "GET",
            headers: { "Range": "bytes=0-0" },
            signal: controller2.signal
          });
          clearTimeout(timeoutId2);
          return res2.ok && res2.status !== 404;
        }
        
        return false;
      } catch (error) {
        // Fallback to GET just in case HEAD fails or is blocked
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(url, {
            method: "GET",
            headers: { "Range": "bytes=0-0" },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return res.ok && res.status !== 404;
        } catch (e) {
          return false;
        }
      }
    })
  );
}

async function fetchStaticImageForRecipe(recipeName: string, mealType: string, excludedUrls: string[] = []): Promise<string> {
  const fallbackUrl = getVerifiedImageForRecipe(recipeName, mealType);

  if (!unsplash) {
    console.log(`[Unsplash] Client not initialized. Using static fallback for "${recipeName}"`);
    // Verify fallbackUrl even if unsplash is not configured
    const fallbackValid = await checkImageUrls([fallbackUrl]);
    const isExcluded = excludedUrls.includes(fallbackUrl);
    return (fallbackValid[0] && !isExcluded) ? fallbackUrl : "";
  }

  const query = getSearchQueryForRecipe(recipeName, mealType);
  try {
    console.log(`[Unsplash] Searching for "${recipeName}" with query "${query}"...`);
    const result = await unsplash.search.getPhotos({
      query: query,
      page: 1,
      perPage: 5,
      orientation: "landscape"
    });

    if (result.type === "success" && result.response.results.length > 0) {
      const photos = result.response.results;
      const urls = photos.map((photo: any) => photo.urls.regular);
      
      console.log(`[Unsplash] Verifying ${urls.length} images for "${recipeName}"...`);
      const validityResults = await checkImageUrls(urls);
      const validPhotos = photos.filter((photo: any, idx) => validityResults[idx] && !excludedUrls.includes(photo.urls.regular));

      if (validPhotos.length > 0) {
        // Pick a random image from the top valid results (up to 3)
        const selectedPhoto = validPhotos[Math.floor(Math.random() * Math.min(validPhotos.length, 3))];
        const imageUrl = selectedPhoto.urls.regular;
        console.log(`[Unsplash] Found valid image for "${recipeName}": ${imageUrl}`);
        return imageUrl;
      } else {
        console.warn(`[Unsplash] All ${photos.length} photos returned 404, failed or were excluded. Using fallback for "${recipeName}"`);
      }
    } else {
      if (result.type === "error") {
        console.error(`[Unsplash] API Error searching for "${query}":`, result.errors[0]);
      } else {
        console.warn(`[Unsplash] No results found for "${query}"`);
      }
    }
  } catch (error) {
    console.error(`[Unsplash] Exception searching for "${query}":`, error);
  }

  // Verify fallbackUrl before returning
  console.log(`[Unsplash] Verifying fallback URL for "${recipeName}": ${fallbackUrl}`);
  const fallbackValid = await checkImageUrls([fallbackUrl]);
  const isExcluded = excludedUrls.includes(fallbackUrl);
  if (fallbackValid[0] && !isExcluded) {
    return fallbackUrl;
  }

  console.warn(`[Unsplash] Fallback URL also failed validation or was excluded. Returning empty string to trigger frontend placeholder.`);
  return "";
}

/**
 * Helper to resolve and assign static images (via Unsplash API or local fallback) and other default values.
 */
async function fillStaticRecipeImages(mealPlan: MealPlan): Promise<void> {
  const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
  const mealsKeys = ["desayuno", "almuerzo", "merienda", "cena"] as const;

  for (const d of daysKeys) {
    for (const m of mealsKeys) {
      const recipe = mealPlan.days[d][m];
      if (recipe) {
        // Overwrite or fill the image based on our Unsplash search or verified fallback
        recipe.image = await fetchStaticImageForRecipe(recipe.recipeName, m);

        if (!recipe.calories) recipe.calories = 380;
        if (!recipe.time) recipe.time = "20 min";
        if (!recipe.tag) recipe.tag = "Nutritivo";
        if (!recipe.tips) recipe.tips = "Sigue este plan nutricional diario pautado con esmero.";
      }
    }
  }
}

/**
 * Helper to upload a PDF file and run Gemini AI to extract the structured meal plan.
 */
async function processPDFWithGemini(filePath: string): Promise<MealPlan> {
  if (!ai) {
    throw new Error("La API de Gemini no está configurada.");
  }

  try {
    await fs.promises.access(filePath);
  } catch (_) {
    throw new Error(`El archivo no existe en la ruta del servidor: ${filePath}`);
  }

  // Read local file as base64 and send it inline to avoid File API upload issues
  const fileBuffer = await fs.promises.readFile(filePath);
  const base64Data = fileBuffer.toString("base64");

  const optimizedPrompt = await getOptimizedPrompt();

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: base64Data
        }
      },
      optimizedPrompt
    ],
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    }
  });

  const textResponse = response.text;
  if (!textResponse) {
    throw new Error("No se pudo obtener una respuesta legible de Gemini.");
  }

  const parsedData = JSON.parse(textResponse.trim());
  if (parsedData && parsedData.days) {
    const mealPlan = parsedData as MealPlan;
    await fillStaticRecipeImages(mealPlan);
    return mealPlan;
  } else {
    throw new Error("El plan devuelto no tiene una estructura con la clave 'days'.");
  }
}

// 1. Endpoint to get the active global meal plan
app.get("/api/plan", (req, res) => {
  const active = getPlan();

  // Log a warning if any recipe in the plan is missing an ID (sanity check)
  if (active.plan?.days) {
    const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
    const mealsKeys = ["desayuno", "almuerzo", "merienda", "cena"] as const;
    for (const day of daysKeys) {
      for (const meal of mealsKeys) {
        const r = active.plan.days[day]?.[meal];
        if (r?.recipeName && !r.id) {
          console.warn(`[Warning] Recipe "${r.recipeName}" in active plan is missing its database ID.`);
        }
      }
    }
  }

  res.json({
    plan: active.plan,
    metadata: active.metadata,
  });
});

// 2. Endpoint to clear the active meal plan and start fresh
app.post("/api/plan/reset", (req, res) => {
  resetPlan();
  res.json({ success: true, plan: null, metadata: null });
});

// 3. Endpoint to modify/update cell details manually
app.post("/api/plan/update-recipe", (req, res) => {
  const { day, meal, recipe } = req.body;
  if (!day || !meal) {
    return res.status(400).json({ error: "Faltan parámetros 'day' o 'meal'" });
  }

  const active = getPlan();
  if (active.plan && active.plan.days[day as keyof typeof active.plan.days]) {
    updateRecipe(day, meal, recipe);
    const updated = getPlan();
    return res.json({ success: true, plan: updated.plan });
  } else {
    return res.status(400).json({ error: "No hay ningún plan pautado cargado." });
  }
});

// Endpoint to fetch the saved grocery list state
app.get("/api/grocery-list", (req, res) => {
  const state = getGroceryListState();
  res.json(state || {
    checkedItems: {},
    listType: "semanal",
    selectedSingleDay: "",
    selected3DaysStart: "",
    excludedMeals: [],
    multipliers: {}
  });
});

// Endpoint to save the grocery list state
app.post("/api/grocery-list", (req, res) => {
  const { checkedItems, listType, selectedSingleDay, selected3DaysStart, excludedMeals, multipliers } = req.body;
  saveGroceryListState({
    checkedItems,
    listType,
    selectedSingleDay,
    selected3DaysStart,
    excludedMeals,
    multipliers
  });
  res.json({ success: true });
});

// Endpoint to fetch completed recipes for the active plan
app.get("/api/completed-recipes", (req, res) => {
  const active = getPlan();
  const planId = active.metadata?.id || 0;
  const completed = getCompletedRecipes(planId);
  res.json({ completedRecipes: completed });
});

// Endpoint to save completed recipes for the active plan
app.post("/api/completed-recipes", (req, res) => {
  const active = getPlan();
  const planId = active.metadata?.id || 0;
  const { completedRecipes } = req.body;
  saveCompletedRecipes(planId, completedRecipes || {});
  res.json({ success: true });
});

/**
 * Enriches the batch cooking guide JSON by mapping string recipe names in "recipesAffected" to actual database IDs.
 */
function enrichBatchCookingGuide(guide: any, mealPlan: MealPlan): any {
  if (!guide || !guide.steps) return guide;
  
  const nameToIdMap = new Map<string, number>();
  const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
  const mealsKeys = ["desayuno", "almuerzo", "merienda", "cena"] as const;
  for (const d of daysKeys) {
    for (const m of mealsKeys) {
      const r = mealPlan.days[d]?.[m];
      if (r && r.recipeName && r.id) {
        nameToIdMap.set(r.recipeName.trim().toLowerCase(), r.id);
      }
    }
  }

  const enrichedSteps = guide.steps.map((step: any) => {
    const recipesAffected = Array.isArray(step.recipesAffected) ? step.recipesAffected : [];
    const enrichedRecipes = recipesAffected.map((name: string) => {
      const normalized = name.trim().toLowerCase();
      const id = nameToIdMap.get(normalized) || null;
      return { id, name };
    });
    return {
      ...step,
      recipesAffected: enrichedRecipes
    };
  });

  return {
    ...guide,
    steps: enrichedSteps
  };
}

/**
 * Helper to upload meal plan data and get a customized batch cooking timeline using Gemini AI
 */
async function generateBatchCookingWithGemini(mealPlan: MealPlan, params: any): Promise<any> {
  if (!ai) {
    throw new Error("La API de Gemini no está configurada.");
  }

  // Construct parameter description
  const burnersText = `${params.burnersCount} fuegos activos simultáneamente`;
  const appliancesList: string[] = [];
  if (params.hasOven) appliancesList.push("Horno");
  if (params.hasMicrowave) appliancesList.push("Microondas");
  if (params.hasAirfryer) appliancesList.push("Freidora de Aire (Airfryer)");
  if (params.hasRobot) appliancesList.push("Robot de Cocina (Thermomix o similar)");
  const appliancesText = appliancesList.length > 0 
    ? appliancesList.join(", ") 
    : "Ningún electrodoméstico adicional (solo fuegos)";
  
  const customToolsText = typeof params.customTools === "string" && params.customTools.trim() !== "" 
    ? params.customTools.trim() 
    : "Ninguno";

  // Filter only almuerzo and cena (lunches and dinners) for each day
  const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
  const filteredDays: any = {};
  const recipeNamesList: string[] = [];
  
  for (const d of daysKeys) {
    filteredDays[d] = {
      almuerzo: mealPlan.days[d]?.almuerzo,
      cena: mealPlan.days[d]?.cena
    };
    
    for (const m of ["almuerzo", "cena"] as const) {
      const rec = mealPlan.days[d]?.[m];
      if (rec && rec.recipeName) {
        recipeNamesList.push(rec.recipeName.trim());
      }
    }
  }

  // Keep unique non-empty recipe names
  const uniqueRecipeNames = Array.from(new Set(recipeNamesList)).filter(name => name.length > 0);

  const prompt = `
Eres un Chef Profesional y Asesor Experto en "Batch Cooking" (cocinado por lotes).
Tu tarea es analizar el plan de comidas (ALMUERZOS y CENAS) de la semana y diseñar una guía de preparación secuencial y optimizada para cocinar todas las recetas de una sola vez en aproximadamente 2 horas.

INFORMACIÓN DE LA COCINA DEL USUARIO (CRÍTICO: Debes adaptarte estrictamente a estos límites):
1. Fuegos/Hornillas disponibles simultáneamente: ${burnersText}.
   *¡ATENCIÓN! No planifiques pasos que requieran usar más fuegos de los disponibles a la vez.*
2. Electrodomésticos disponibles: ${appliancesText}.
   *Aprovecha estos electrodomésticos para realizar cocciones paralelas (ej. hornear algo mientras se hace un guiso al fuego).*
3. Herramientas adicionales disponibles: ${customToolsText}.

EL PLAN DE COMIDAS A PREPARAR ES:
${JSON.stringify(filteredDays)}

LISTA DE RECETAS EN EL PLAN (ESTRICTAMENTE OBLIGATORIO PARA "recipesAffected"):
Las únicas recetas válidas en este plan con sus nombres exactos son:
${JSON.stringify(uniqueRecipeNames)}

INSTRUCCIONES DE DISEÑO DE LA GUÍA (CRÍTICO Y DETALLADO):
1. Sé extremadamente específico y descriptivo en las instrucciones de cada paso.
   * EVITA terminantemente frases genéricas como "lava todos los vegetales", "corta las verduras de la semana" o "pica las cebollas y ajos necesarios".
   * EVITA expresiones vagas como "en sus respectivos formatos", "según corresponda" o "preparado como se indica". Debes especificar exactamente CÓMO cortar, formatear o porcionar cada ingrediente y a qué receta va destinada cada porción (ej. en lugar de decir "670g de pechuga de pollo en sus respectivos formatos", di "Cortar 670g de pechuga de pollo de la siguiente manera: 200g en tiras para las Fajitas, 300g en dados para el Wok de verduras y 170g en filetes delgados para la Ensalada César").
   * En su lugar, especifica detalladamente los ingredientes exactos y sus cantidades requeridas en ese paso (ej. "Lavar y desinfectar 3 tazas de hojas de espinaca, 2 calabacines medianos y 500g de tomates cherry", o "Picar finamente 2 cebollas moradas, 4 dientes de ajo y 1 pimiento rojo...").
2. Estructura el plan en pasos lógicos secuenciales (Paso 1, Paso 2, etc.). Cada paso debe tener:
   - "stepNumber" (número correlativo).
   - "title" (título descriptivo y conciso, ej. "Mise en place de verduras", "Horneado de salmón").
   - "description" (descripción muy detallada y paso a paso indicando tiempos, temperaturas de cocción, etc.).
   - "duration" (ej. "15 min").
   - "utensils" (utensilios y electrodomésticos usados).
   - "recipesAffected" (nombres de las recetas afectadas). IMPORTANTE: Los strings en esta lista deben pertenecer de forma obligatoria y exacta a la LISTA DE RECETAS EN EL PLAN provista arriba. No inventes nombres, no los acortes, ni los traduzcas. Deben coincidir letra por letra con los nombres indicados en esa lista para que el sistema pueda enlazarlos. Si un paso no corresponde directamente a ninguna receta de la lista, deja la lista "recipesAffected" vacía [].
   - "ingredients" (un array de strings con los ingredientes y cantidades que se manipulan o cocinan específicamente en este paso, ej. ["2 cebollas medianas", "4 dientes de ajo", "500g de calabacín", "1 cda de aceite de oliva"]).
3. Diseña una línea de tiempo fluida y coordinada para optimizar los tiempos de espera (Mise en Place al inicio, luego cocciones lentas/horno, y cocciones rápidas al final).
4. Genera una lista estructurada de consejos de almacenamiento y envasado ("storageTips") detallando cómo conservar cada preparación principal resultante.

Debes responder ÚNICA Y EXCLUSIVAMENTE con un código JSON válido estructurado según el siguiente esquema TypeScript:

interface StorageTip {
  preparation: string;       // Tipo de preparación (ej. "Sofrito base", "Cremas y sopas", "Verduras asadas", "Pollo/Proteínas asadas")
  container: string;         // Tipo de envase recomendado (ej. "Túper de vidrio hermético", "Bolsa de silicona con cierre zip", "Tarro de cristal para vacío")
  duration: string;          // Tiempo de conservación en nevera y congelador (ej. "3-4 días en nevera / No congelar" o "4 días en nevera / 3 meses en congelador")
  freezable: boolean;        // true si se puede congelar, false si no
  reheatingAndTips: string;  // Consejos detallados de recalentado y conservación para conservar textura y sabor (ej. "Recalentar en sartén tapada con una cucharada de agua para devolver humedad.")
}

interface BatchCookingStep {
  stepNumber: number;
  title: string;
  description: string;
  duration: string;
  utensils: string[];
  recipesAffected: string[];
  ingredients: string[]; // Ingredientes específicos de este paso con sus cantidades exactas
}

interface BatchCookingGuide {
  introduction: string;
  prepTime: string; // Tiempo total estimado (ej. "2 horas", "1h 45 min")
  steps: BatchCookingStep[];
  storageTips: StorageTip[]; // Detalle estructurado de conservación
}

Restricciones:
- Genera el JSON en formato compacto/minificado.
- Devuelve únicamente el JSON crudo, sin bloques de código conversacionales ni explicaciones iniciales/finales.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    }
  });

  const textResponse = response.text;
  if (!textResponse) {
    throw new Error("No se pudo obtener una respuesta legible de Gemini.");
  }

  return JSON.parse(textResponse.trim());
}

// Endpoint to fetch cached batch cooking guide for the active plan
app.get("/api/plan/batch-cooking", (req, res) => {
  try {
    const active = getPlan();
    if (!active.plan) {
      return res.status(400).json({ error: "No hay ningún plan activo cargado." });
    }
    const { guide, params } = getBatchCooking();
    res.json({
      guide: guide ? JSON.parse(guide) : null,
      params: params ? JSON.parse(params) : null
    });
  } catch (error: any) {
    console.error("Error fetching batch cooking state:", error);
    res.status(500).json({ error: "No se pudo recuperar la guía de cocinado." });
  }
});

// Endpoint to generate and save batch cooking guide for the active plan
app.post("/api/plan/batch-cooking", batchCookingLimiter, async (req, res) => {
  try {
    const active = getPlan();
    if (!active.plan) {
      return res.status(400).json({ error: "No hay ningún plan activo cargado." });
    }

    const { params: clientParams, forceRegenerate } = req.body;
    if (!clientParams) {
      return res.status(400).json({ error: "Faltan los parámetros de la cocina." });
    }

    const { guide: cachedGuide, params: cachedParamsStr } = getBatchCooking();

    // Check if parameters match exactly and we are not forcing regeneration
    let paramsMatch = false;
    if (cachedParamsStr && !forceRegenerate) {
      try {
        const cachedParams = JSON.parse(cachedParamsStr);
        paramsMatch = 
          cachedParams.burnersCount === clientParams.burnersCount &&
          cachedParams.hasOven === clientParams.hasOven &&
          cachedParams.hasMicrowave === clientParams.hasMicrowave &&
          cachedParams.hasAirfryer === clientParams.hasAirfryer &&
          cachedParams.hasRobot === clientParams.hasRobot &&
          String(cachedParams.customTools || "").trim() === String(clientParams.customTools || "").trim();
      } catch (_) {}
    }

    if (cachedGuide && paramsMatch && !forceRegenerate) {
      console.log("[BatchCooking] Serving cached batch cooking guide.");
      return res.json({
        success: true,
        guide: JSON.parse(cachedGuide),
        params: JSON.parse(cachedParamsStr!)
      });
    }

    console.log("[BatchCooking] Generating new batch cooking guide with Gemini...");
    let guideJson = await generateBatchCookingWithGemini(active.plan, clientParams);
    
    // Enrich guide steps with recipe database IDs
    guideJson = enrichBatchCookingGuide(guideJson, active.plan);
    
    // Save to database
    saveBatchCooking(JSON.stringify(guideJson), JSON.stringify(clientParams));

    res.json({
      success: true,
      guide: guideJson,
      params: clientParams
    });
  } catch (error: any) {
    console.error("Error generating/saving batch cooking:", error);
    res.status(500).json({ error: "No se pudo generar la guía de Batch Cooking. Detalles: " + error.message });
  }
});

// Endpoint to reset batch cooking guide for the active plan
app.post("/api/plan/batch-cooking/reset", (req, res) => {
  try {
    const active = getPlan();
    if (!active.plan) {
      return res.status(400).json({ error: "No hay ningún plan activo cargado." });
    }
    resetBatchCooking();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error resetting batch cooking state:", error);
    res.status(500).json({ error: "No se pudo resetear la guía de cocinado." });
  }
});

// 4. Endpoint to upload & process nutrition plan PDF with Gemini AI
app.post("/api/upload", uploadLimiter, async (req, res) => {
  const { fileName, fileData } = req.body; // fileData is base64 string

  if (!fileName || !fileData) {
    return res.status(400).json({ error: "No se recibió el nombre del archivo o los datos base64." });
  }

  if (!ai) {
    return res.status(500).json({
      error: "La API de Gemini no está configurada. Por favor, añade la variable GEMINI_API_KEY en la configuración del panel lateral."
    });
  }

  let savedFileName = "";
  let responseSent = false;

  req.on("close", async () => {
    if (!responseSent && savedFileName) {
      console.log(`[Cancel] Client disconnected/aborted. Cleaning up file: ${savedFileName}`);
      const safeSavedName = path.basename(savedFileName);
      const filePath = path.resolve(process.cwd(), "data", "uploads", safeSavedName);
      const uploadsDir = path.resolve(process.cwd(), "data", "uploads");
      if (filePath.startsWith(uploadsDir)) {
        try {
          await fs.promises.unlink(filePath);
        } catch (e) {
          console.error("Error unlinking cancelled file:", e);
        }
      }
    }
  });

  try {
    // Compute the hash of the uploaded PDF
    const fileHash = crypto.createHash("sha256").update(Buffer.from(fileData, "base64")).digest("hex");

    // Check for duplicates unless force is requested
    const force = req.body.force === true || req.body.forceReprocess === true;
    if (!force) {
      const existing = findPlanByHash(fileHash);
      if (existing) {
        responseSent = true;
        return res.json({
          duplicateDetected: true,
          existingPlan: {
            id: existing.id,
            fileName: existing.file_name,
            isActive: existing.is_active
          }
        });
      }
    }

    // Save the PDF file physically
    const uploadsDir = path.resolve(process.cwd(), "data", "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });
    // Sanitize filename to remove spaces, accents, and special characters
    const baseName = path.basename(fileName);
    const sanitizedName = baseName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_");
    savedFileName = `${Date.now()}_${sanitizedName}`;
    const savedFilePath = path.resolve(uploadsDir, savedFileName);
    if (!savedFilePath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: "Ruta de archivo no permitida." });
    }
    await fs.promises.writeFile(savedFilePath, Buffer.from(fileData, "base64"));

    // Process using helper
    const mealPlan = await processPDFWithGemini(savedFilePath);

    const planMetadata = {
      fileName,
      savedFileName,
      processedAt: new Date().toISOString()
    };

    // Persist the plan and metadata to the SQLite database
    savePlan(mealPlan, planMetadata, savedFileName, fileHash);

    const savedPlan = getPlan();

    responseSent = true;
    res.json({
      success: true,
      plan: savedPlan.plan || mealPlan,
      metadata: savedPlan.metadata || planMetadata,
    });

  } catch (error: any) {
    responseSent = true;
    console.error("Error al procesar PDF con Gemini:", error);

    // Clean up file if parsing failed
    if (savedFileName) {
      const safeSavedName = path.basename(savedFileName);
      const filePath = path.resolve(process.cwd(), "data", "uploads", safeSavedName);
      const uploadsDir = path.resolve(process.cwd(), "data", "uploads");
      if (filePath.startsWith(uploadsDir)) {
        try {
          await fs.promises.unlink(filePath);
        } catch (_) {}
      }
    }

    let rawError = "";
    if (error && typeof error === "object") {
      rawError = error.message || JSON.stringify(error);
      if (error.cause) {
        let causeMsg = "";
        if (error.cause && typeof error.cause === "object") {
          causeMsg = (error.cause as any).message || (error.cause as any).code || JSON.stringify(error.cause);
        } else {
          causeMsg = String(error.cause);
        }
        rawError += ` (Causa: ${causeMsg})`;
      }
    } else {
      rawError = String(error);
    }

    if (
      rawError.includes("prepayment") ||
      rawError.includes("depleted") ||
      rawError.includes("RESOURCE_EXHAUSTED") ||
      rawError.includes("billing")
    ) {
      return res.status(429).json({
        error: "Los créditos de prepago de Google AI Studio o el límite de uso de la clave de API de Gemini se han agotado (RESOURCE_EXHAUSTED). Por favor, ve a tu panel de control de Google AI Studio (https://aistudio.google.com/) o de Google Cloud Consola para gestionar el saldo de prepago, o revisa las claves de API configuradas en los ajustes."
      });
    }

    res.status(500).json({
      error: "Ocurrió un error al procesar el PDF de alimentos con GenAI. Detalles: " + rawError
    });
  }
});

// 5. Endpoint to get history of analyzed plans
app.get("/api/history", (req, res) => {
  try {
    const historyList = getHistory();
    res.json(historyList.map(h => ({
      id: h.id,
      fileName: h.file_name,
      savedFileName: h.saved_file_name,
      metadata: h.metadata_json ? JSON.parse(h.metadata_json) : null,
      isActive: h.is_active,
      createdAt: h.created_at
    })));
  } catch (error: any) {
    console.error("Error retrieving plan history:", error);
    res.status(500).json({ error: "No se pudo recuperar el historial de planes." });
  }
});

// 5b. Endpoint to get a specific plan by ID (read-only, without changing active plan)
app.get("/api/plan/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de plan no válido." });
  }
  try {
    const historyList = getHistory();
    const entry = historyList.find((h: any) => h.id === id);
    if (!entry) {
      return res.status(404).json({ error: "Plan no encontrado." });
    }
    const plan = entry.plan_json ? JSON.parse(entry.plan_json) : null;
    const metadata = entry.metadata_json ? JSON.parse(entry.metadata_json) : null;
    res.json({ plan, metadata, isActive: !!entry.is_active });
  } catch (error: any) {
    console.error("Error retrieving plan by ID:", error);
    res.status(500).json({ error: "No se pudo obtener el plan." });
  }
});


// 6. Endpoint to restore a plan from history as the active plan
app.post("/api/history/restore/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de historial no válido." });
  }
  try {
    const restored = restorePlanFromHistory(id);
    if (restored) {
      res.json({
        success: true,
        plan: restored.plan,
        metadata: restored.metadata
      });
    } else {
      res.status(404).json({ error: "No se encontró el plan de historial especificado." });
    }
  } catch (error: any) {
    console.error("Error restoring plan from history:", error);
    res.status(500).json({ error: "Error al restaurar el plan desde el historial." });
  }
});

// 7. Endpoint to delete a plan from history
app.delete("/api/history/:id", deleteHistoryLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de historial no válido." });
  }
  try {
    const savedFileName = deleteHistoryItem(id);
    if (savedFileName) {
      const safeSavedName = path.basename(savedFileName);
      const filePath = path.resolve(process.cwd(), "data", "uploads", safeSavedName);
      const uploadsDir = path.resolve(process.cwd(), "data", "uploads");
      if (filePath.startsWith(uploadsDir)) {
        try {
          await fs.promises.unlink(filePath);
        } catch (_) {}
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting history item:", error);
    res.status(500).json({ error: "Error al eliminar el elemento del historial." });
  }
});

// 8b. Endpoint to get all recipes from all plans (lightweight, for search)
app.get("/api/all-recipes", (req, res) => {
  try {
    const history = getHistory();
    const results: any[] = [];
    for (const h of history) {
      if (!h.plan_json) continue;
      let plan: MealPlan;
      try { plan = JSON.parse(h.plan_json); } catch { continue; }
      const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
      const mealsKeys = ["desayuno", "almuerzo", "merienda", "cena"] as const;
      for (const day of daysKeys) {
        for (const meal of mealsKeys) {
          const recipe = plan.days[day]?.[meal];
          if (!recipe) continue;
          // Flatten ingredient names into a lightweight array
          let ingredientNames: string[] = [];
          if (Array.isArray(recipe.ingredients)) {
            ingredientNames = (recipe.ingredients as any[]).map((i: any) => (i.name || "").toLowerCase());
          } else if (recipe.ingredients && typeof recipe.ingredients === "object") {
            for (const cat of Object.values(recipe.ingredients as any)) {
              if (Array.isArray(cat)) {
                ingredientNames.push(...(cat as any[]).map((i: any) => (i.name || "").toLowerCase()));
              }
            }
          }
          results.push({
            planId: h.id,
            planName: h.file_name || "",
            isActive: !!h.is_active,
            day,
            meal,
            recipeName: recipe.recipeName,
            calories: recipe.calories,
            time: recipe.time,
            tag: recipe.tag || "",
            image: recipe.image || "",
            ingredientNames
          });
        }
      }
    }

    // Add standalone recipes from Recetario
    try {
      const recetarioList = getRecipes();
      for (const r of recetarioList) {
        let ingredientNames: string[] = [];
        if (Array.isArray(r.ingredients)) {
          ingredientNames = (r.ingredients as any[]).map((i: any) => (i.name || "").toLowerCase());
        } else if (r.ingredients && typeof r.ingredients === "object") {
          for (const cat of Object.values(r.ingredients as any)) {
            if (Array.isArray(cat)) {
              ingredientNames.push(...(cat as any[]).map((i: any) => (i.name || "").toLowerCase()));
            }
          }
        }
        results.push({
          planId: -1,
          planName: "Recetario",
          isActive: false,
          day: "",
          meal: "",
          isRecetario: true,
          recetarioId: r.id,
          recipeName: r.recipeName,
          calories: r.calories,
          time: r.time,
          tag: r.tag || "",
          image: r.image || "",
          ingredientNames
        });
      }
    } catch (dbErr) {
      console.error("Error reading recetario recipes for search pool:", dbErr);
    }

    res.json(results);
  } catch (error: any) {
    console.error("Error building all-recipes pool:", error);
    res.status(500).json({ error: "No se pudo obtener el pool de recetas." });
  }
});

// Search history endpoints
// GET  /api/search-history       – Retrieve recent click history
// POST /api/search-history       – Add a click to history
// DELETE /api/search-history     – Clear all history
// DELETE /api/search-history/:id – Remove a single history item

app.get("/api/search-history", (req, res) => {
  try {
    res.json(getSearchHistory());
  } catch (error: any) {
    console.error("Error retrieving search history:", error);
    res.status(500).json({ error: "No se pudo recuperar el historial de búsqueda." });
  }
});

app.post("/api/search-history", (req, res) => {
  const { planId, planName, day, meal, recipeName, image, isActive } = req.body;
  if (!planId || !day || !meal || !recipeName) {
    return res.status(400).json({ error: "Faltan campos obligatorios." });
  }
  try {
    addSearchHistoryItem({ planId, planName: planName || "", day, meal, recipeName, image: image || "", isActive: !!isActive });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving search history item:", error);
    res.status(500).json({ error: "No se pudo guardar el historial de búsqueda." });
  }
});

app.delete("/api/search-history", (req, res) => {
  try {
    clearSearchHistory();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error clearing search history:", error);
    res.status(500).json({ error: "No se pudo borrar el historial de búsqueda." });
  }
});

app.delete("/api/search-history/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "ID no válido." });
  try {
    deleteSearchHistoryItem(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting search history item:", error);
    res.status(500).json({ error: "No se pudo eliminar el elemento del historial." });
  }
});


// 8. Endpoint to reprocess the active plan
app.post("/api/reprocess", uploadLimiter, async (req, res) => {
  if (!ai) {
    return res.status(500).json({
      error: "La API de Gemini no está configurada. Por favor, añade la variable GEMINI_API_KEY en la configuración."
    });
  }

  try {
    const active = getPlan();
    if (!active.metadata || !active.metadata.savedFileName) {
      return res.status(400).json({ error: "No hay ningún archivo guardado para reprocesar en el plan activo." });
    }

    const savedFileName = path.basename(active.metadata.savedFileName);
    const fileName = path.basename(active.metadata.fileName);
    const filePath = path.resolve(process.cwd(), "data", "uploads", savedFileName);
    const uploadsDir = path.resolve(process.cwd(), "data", "uploads");
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: "Ruta de archivo no permitida." });
    }

    try {
      await fs.promises.access(filePath);
    } catch (_) {
      return res.status(404).json({ error: `No se encontró el archivo original ${fileName} en el servidor.` });
    }

    // Read the physical file buffer and compute hash
    const fileBuffer = await fs.promises.readFile(filePath);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // Process using helper
    const mealPlan = await processPDFWithGemini(filePath);

    const planMetadata = {
      id: active.metadata.id,
      fileName: active.metadata.fileName,
      savedFileName: active.metadata.savedFileName,
      processedAt: new Date().toISOString()
    };

    // Save back with hash
    savePlan(mealPlan, planMetadata, savedFileName, fileHash);

    const savedPlan = getPlan();

    res.json({
      success: true,
      plan: savedPlan.plan || mealPlan,
      metadata: savedPlan.metadata || planMetadata,
    });
  } catch (error: any) {
    console.error("Error al reprocesar PDF con Gemini:", error);
    let rawError = "";
    if (error && typeof error === "object") {
      rawError = error.message || String(error);
      if (error.cause) {
        let causeMsg = "";
        if (error.cause && typeof error.cause === "object") {
          causeMsg = (error.cause as any).message || (error.cause as any).code || JSON.stringify(error.cause);
        } else {
          causeMsg = String(error.cause);
        }
        rawError += ` (Causa: ${causeMsg})`;
      }
    } else {
      rawError = String(error);
    }
    res.status(500).json({
      error: "Ocurrió un error al reprocesar el PDF. Detalles: " + rawError
    });
  }
});

// 9. Endpoint to export all database backup data
app.get("/api/backup/export", (req, res) => {
  try {
    const backup = exportBackupData();
    res.json(backup);
  } catch (error: any) {
    console.error("Error exporting backup:", error);
    res.status(500).json({ error: "No se pudo exportar la copia de seguridad." });
  }
});

// 10. Endpoint to import database backup data
app.post("/api/backup/import", (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || typeof backupData !== "object" || !Array.isArray(backupData.plans)) {
      return res.status(400).json({ error: "El formato de la copia de seguridad no es válido." });
    }
    importBackupData(backupData);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error importing backup:", error);
    res.status(500).json({ error: "No se pudo importar la copia de seguridad. Detalles: " + error.message });
  }
});

// CRUD endpoints for Recetario
app.get("/api/recipes", (req, res) => {
  try {
    const list = getRecipes();
    res.json(list);
  } catch (error: any) {
    console.error("Error fetching recipes:", error);
    res.status(500).json({ error: "No se pudieron obtener las recetas." });
  }
});

app.get("/api/recipes/tags", (req, res) => {
  try {
    const list = getRecipes();
    const tags = Array.from(new Set(list.map(r => r.tag).filter(Boolean)));
    res.json(tags);
  } catch (error: any) {
    console.error("Error fetching recipe tags:", error);
    res.status(500).json({ error: "No se pudieron obtener las etiquetas." });
  }
});

app.get("/api/recipes/favorite-status", (req, res) => {
  const { id } = req.query;
  try {
    if (!id) {
      return res.json({ isFavorite: false });
    }
    const recipeId = parseInt(id as string, 10);
    if (isNaN(recipeId)) {
      return res.json({ isFavorite: false });
    }

    const recipe = getRecipeById(recipeId);
    if (recipe) {
      return res.json({ isFavorite: !!recipe.isFavorite, id: recipe.id });
    }
    res.json({ isFavorite: false });
  } catch (error) {
    console.error("Error getting favorite status:", error);
    res.status(500).json({ error: "Error interno" });
  }
});

// High-quality static fallback food images
const STATIC_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1484723091739-30a097e8f929?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=1000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop"
];

async function scrapeUnsplashImages(query: string): Promise<string[]> {
  try {
    const url = `https://unsplash.com/s/photos/${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
      }
    });
    if (!response.ok) {
      throw new Error(`Unsplash scrape failed with status ${response.status}`);
    }
    const html = await response.text();
    // Match unsplash photo URLs
    const matches = html.match(/https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9\-]+/g);
    if (!matches || matches.length === 0) {
      return [];
    }
    
    // Deduplicate
    const unique = Array.from(new Set(matches));
    
    // Format to regular web quality and return
    return unique.map(imgUrl => `${imgUrl.split('?')[0]}?auto=format&fit=crop&w=1000&q=80`).slice(0, 12);
  } catch (error) {
    console.error("Error scraping Unsplash:", error);
    return [];
  }
}

// Agnostic image search endpoint
app.get("/api/recipes/image-search", async (req, res) => {
  const query = req.query.query as string;
  if (!query) {
    return res.status(400).json({ error: "Falta el parámetro 'query'" });
  }
  
  if (unsplash) {
    try {
      const result = await unsplash.search.getPhotos({
        query: query,
        page: 1,
        perPage: 12,
        orientation: "landscape"
      });

      if (result.type === "success" && result.response.results.length > 0) {
        const urls = result.response.results.map((photo: any) => photo.urls.regular);
        return res.json({ success: true, results: urls });
      }
    } catch (error: any) {
      console.error("Error searching images via API, falling back to scraper:", error);
    }
  }

  // Fallback to scraper
  console.log(`[ImageSearch] Running Unsplash scraper fallback for query "${query}".`);
  const scraped = await scrapeUnsplashImages(query);
  if (scraped.length > 0) {
    return res.json({ success: true, results: scraped });
  }

  // Last resort static list
  console.log(`[ImageSearch] Returning static fallback images for query "${query}".`);
  return res.json({
    success: true,
    results: STATIC_FALLBACK_IMAGES
  });
});

app.get("/api/recipes/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de receta no válido." });
  }
  try {
    const recipe = getRecipeById(id);
    if (!recipe) {
      return res.status(404).json({ error: "Receta no encontrada." });
    }
    res.json(recipe);
  } catch (error: any) {
    console.error("Error fetching recipe:", error);
    res.status(500).json({ error: "No se pudo obtener la receta." });
  }
});

app.post("/api/recipes", (req, res) => {
  try {
    const recipeData = req.body;
    if (!recipeData.recipeName || !recipeData.ingredients) {
      return res.status(400).json({ error: "Faltan campos obligatorios: nombre o ingredientes." });
    }
    const id = insertRecipe(recipeData);
    res.json({ success: true, id });
  } catch (error: any) {
    console.error("Error creating recipe:", error);
    res.status(500).json({ error: "No se pudo crear la receta. Detalles: " + error.message });
  }
});

app.post("/api/recipes/report-broken-image", async (req, res) => {
  const { recipeName, day, meal, planId, recipeId, brokenUrl } = req.body;
  if (!recipeId) {
    return res.status(400).json({ error: "El ID de la receta es obligatorio." });
  }

  try {
    console.log(`[Broken Image] Reporting broken image for ID ${recipeId} ("${recipeName}"). Broken URL: ${brokenUrl}`);

    // Step 1: Clean the broken image in DB
    updateRecipeImageInBook(recipeId, "");
    updateRecipeImageInPlan(planId, day, meal, "", recipeId);

    // Step 2: Fetch new validated image (excluding the broken one)
    const nameToSearch = recipeName || (getRecipeById(recipeId)?.recipeName) || "";
    const mealType = meal || "almuerzo";
    const excludedUrls = brokenUrl ? [brokenUrl] : [];
    let newImageUrl = "";
    if (nameToSearch) {
      newImageUrl = await fetchStaticImageForRecipe(nameToSearch, mealType, excludedUrls);
    }

    // Step 3: Save new image to DB if found
    if (newImageUrl) {
      console.log(`[Broken Image] Found new valid image for ID ${recipeId}: ${newImageUrl}`);
      updateRecipeImageInBook(recipeId, newImageUrl);
      updateRecipeImageInPlan(planId, day, meal, newImageUrl, recipeId);
    } else {
      console.log(`[Broken Image] No alternative valid image found for ID ${recipeId}.`);
    }

    res.json({ success: true, newImageUrl });
  } catch (error: any) {
    console.error("Error reporting broken image:", error);
    res.status(500).json({ error: "No se pudo procesar el reporte de imagen rota." });
  }
});

app.put("/api/recipes/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de receta no válido." });
  }
  try {
    const recipeData = req.body;
    if (!recipeData.recipeName || !recipeData.ingredients) {
      return res.status(400).json({ error: "Faltan campos obligatorios: nombre o ingredientes." });
    }
    updateRecipeInBook(id, recipeData);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating recipe:", error);
    res.status(500).json({ error: "No se pudo actualizar la receta. Detalles: " + error.message });
  }
});

app.put("/api/recipes/:id/toggle-favorite", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de receta no válido." });
  }
  try {
    const recipe = getRecipeById(id);
    if (!recipe) {
      return res.status(404).json({ error: "Receta no encontrada." });
    }
    recipe.isFavorite = !recipe.isFavorite;
    updateRecipeInBook(id, recipe);
    res.json({ success: true, isFavorite: recipe.isFavorite });
  } catch (error: any) {
    console.error("Error toggling favorite status:", error);
    res.status(500).json({ error: "No se pudo cambiar el estado de favorito." });
  }
});




app.delete("/api/recipes/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de receta no válido." });
  }
  try {
    deleteRecipeInBook(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting recipe:", error);
    res.status(500).json({ error: "No se pudo eliminar la receta." });
  }
});

app.get("/api/ingredients", (req, res) => {
  try {
    const list = getIngredients();
    res.json(list);
  } catch (error: any) {
    console.error("Error fetching ingredients:", error);
    res.status(500).json({ error: "No se pudieron obtener los ingredientes." });
  }
});

app.post("/api/ingredients", (req, res) => {
  const { name, category } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: "Nombre y categoría requeridos." });
  }
  try {
    saveRecipeIngredients([{ name, category }]);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving ingredient:", error);
    res.status(500).json({ error: "No se pudo guardar el ingrediente." });
  }
});

// AI processing with Gemini
app.post("/api/recipes/process-ai", async (req, res) => {
  const { sourceType, fileData, textData, optionsCount = 3, extraPrompt } = req.body;

  if (!ai) {
    return res.status(500).json({ error: "La API de Gemini no está configurada." });
  }

  const kOptions = Math.max(1, Math.min(5, parseInt(optionsCount, 10) || 3));

  let contents: any[] = [];
  let systemPrompt = `
Eres una Inteligencia Artificial experta en nutrición y gastronomía, especializada en digitalizar, estructurar y mejorar recetas de cocina.
Analiza la información proporcionada (que puede ser texto, un documento o una imagen de una receta).
Tu objetivo es extraer, estructurar y refinar la receta con el mayor nivel de detalle posible en un objeto JSON.

DEBES GENERAR EXACTAMENTE ${kOptions} OPCIONES O VARIANTES DE LA RECETA, CADA UNA LIGERAMENTE DIFERENTE A LAS OTRAS (por ejemplo, variando ingredientes, aportes calóricos, complejidad o adaptándola para necesidades específicas como baja en carb, alta en proteínas o vegana).
Asegúrate de que no haya opciones idénticas y que cada una tenga su propio enfoque diferenciado.

INSTRUCCIONES EXTRA DEL USUARIO (Síguelas de forma prioritaria):
"${extraPrompt || "Ninguna"}"

ESTRUCTURA DE RESPUESTA REQUERIDA (JSON):
Debes responder única y exclusivamente con un objeto JSON válido que contenga un array "options". No incluyas explicaciones previas ni bloques de código markdown de tipo \`\`\`json. Solo el JSON crudo.

Esquema JSON del objeto de respuesta:
{
  "options": [
    {
      "recipeName": "Nombre descriptivo y atractivo de la receta",
      "calories": 350, // Número de calorías estimadas POR RACIÓN
      "time": "25 min", // Tiempo de preparación estimado
      "tag": "Etiqueta breve de la variante (ej: 'Original', 'Alta en Proteínas', 'Sin Gluten')",
      "image": "", // Deja este campo como string vacío ""
      "ingredients": [
        {
          "name": "Nombre corto y directo del ingrediente (ej: pollo, zanahoria)",
          "originalAmount": 150, // Cantidad original para las raciones de esta receta
          "unit": "g", // Unidad de medida (g, ml, unidad, cda, cdta)
          "secondaryAmount": 150, // Opcional: cantidad secundaria (peso si la unidad principal es unidad)
          "secondaryUnit": "g", // Opcional: unidad secundaria
          "category": "Categoría de compra: 'Verduras', 'Proteínas', 'Pescados', 'Lácteos/Bebidas', 'Granos/Semillas', 'Despensa', 'Otros'",
          "preparation": "Opcional: preparación del ingrediente (ej: picado, en rodajas)"
        }
      ],
      "steps": [
        "Descripción detallada del primer paso...",
        "Descripción detallada del segundo paso..."
      ],
      "tips": "Consejos breves de cocina",
      "nutritionistTips": "Consejo de nutricionista personalizado para esta receta",
      "servings": 4 // Número de personas/raciones para las que se calculan las cantidades anteriores (siempre mínimo 1)
    }
  ]
}

REGLA CRÍTICA PARA LOS PASOS (steps):
No incluyas ningún prefijo numérico ni de texto como "Paso X:" o "Paso X." al inicio de los pasos de preparación. Cada paso debe ser directamente la acción a realizar (ej: "Cortar los tomates en rodajas" en lugar de "Paso 1: Cortar los tomates en rodajas").
`;

  if (sourceType === "image" && fileData) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: fileData
      }
    });
    contents.push(systemPrompt + "\nRealiza el OCR e infiere todos los campos basándote en la imagen provista.");
  } else if (sourceType === "pdf" && fileData) {
    contents.push({
      inlineData: {
        mimeType: "application/pdf",
        data: fileData
      }
    });
    contents.push(systemPrompt + "\nProcesa este documento PDF de receta.");
  } else if (sourceType === "text" && textData) {
    contents.push(systemPrompt + `\nProcesa y refina el siguiente texto de receta:\n\n${textData}`);
  } else if (sourceType === "mejora" && textData) {
    contents.push(systemPrompt + `\nEl usuario tiene una receta manual y desea que la mejores o adaptes. Mejora la siguiente receta en base a las instrucciones:\n\n${textData}`);
  } else {
    return res.status(400).json({ error: "Faltan parámetros o el sourceType/fileData no es válido." });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("No se pudo obtener una respuesta legible de Gemini.");
    }

    const parsedData = JSON.parse(textResponse.trim());
    if (parsedData && Array.isArray(parsedData.options)) {
      const ingredientsToSave: { name: string; category?: string }[] = [];

      for (const option of parsedData.options) {
        // Clean steps prefixes
        if (Array.isArray(option.steps)) {
          option.steps = option.steps.map((step: any) => {
            if (typeof step !== "string") return step;
            return step.replace(/^(?:Paso\s+\d+\s*[:.-]*\s*)/i, "").trim();
          });
        }

        // Collect ingredients to save
        if (Array.isArray(option.ingredients)) {
          for (const ing of option.ingredients) {
            if (ing && ing.name) {
              ingredientsToSave.push({
                name: ing.name.trim(),
                category: ing.category ? ing.category.trim() : undefined
              });
            }
          }
        }
      }

      // Automatically save all new ingredients to the database
      if (ingredientsToSave.length > 0) {
        try {
          saveRecipeIngredients(ingredientsToSave);
          console.log(`[ProcessAI] Auto-saved ${ingredientsToSave.length} ingredients to database.`);
        } catch (dbErr) {
          console.error("Error auto-saving AI ingredients:", dbErr);
        }
      }

      res.json({ success: true, options: parsedData.options });
    } else {
      res.status(500).json({ error: "La respuesta de Gemini no coincide con el formato esperado." });
    }
  } catch (error: any) {
    console.error("Error al procesar receta con IA:", error);
    res.status(500).json({ error: "Error al procesar la receta con IA. Detalles: " + error.message });
  }
});

// Auxiliary helpers to escape HTML attribute values and replace/inject meta tags dynamically

/**
 * Helper to escape HTML special characters in attributes to prevent breakage.
 */
function escapeHtmlAttr(val: string): string {
  return String(val || "")
    .replace(/&/g, () => "&amp;")
    .replace(/"/g, () => "&quot;")
    .replace(/'/g, () => "&#39;")
    .replace(/</g, () => "&lt;")
    .replace(/>/g, () => "&gt;");
}

/**
 * Helper to replace or inject a meta tag by name/property.
 */
function replaceMetaTag(html: string, nameOrProperty: string, value: string, isProperty: boolean = false): string {
  const attribute = isProperty ? "property" : "name";
  const escapedVal = escapeHtmlAttr(value);
  const regex = new RegExp(`<meta\\s+${attribute}="${nameOrProperty.replace(/:/g, () => "\\:")}"\\s+content="[^"]*"\\s*\\/?>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, () => `<meta ${attribute}="${nameOrProperty}" content="${escapedVal}" />`);
  }
  // If tag doesn't exist, we append it right before </head>
  return html.replace("</head>", () => `<meta ${attribute}="${nameOrProperty}" content="${escapedVal}" />\n</head>`);
}

/**
 * Inject the dynamic page metadata (Title, OpenGraph, Twitter Cards) into the HTML template.
 */
function injectMetaTags(html: string, data: { title: string; description: string; image: string; url: string }): string {
  let result = html;
  
  // Replace <title> tag
  if (/<title>.*?<\/title>/i.test(result)) {
    result = result.replace(/<title>.*?<\/title>/i, () => `<title>${escapeHtmlAttr(data.title)}</title>`);
  } else {
    result = result.replace("</head>", () => `<title>${escapeHtmlAttr(data.title)}</title>\n</head>`);
  }

  // Name meta tags
  result = replaceMetaTag(result, "description", data.description, false);
  result = replaceMetaTag(result, "twitter:title", data.title, false);
  result = replaceMetaTag(result, "twitter:description", data.description, false);
  result = replaceMetaTag(result, "twitter:image", data.image, false);

  // Property meta tags
  result = replaceMetaTag(result, "og:title", data.title, true);
  result = replaceMetaTag(result, "og:description", data.description, true);
  result = replaceMetaTag(result, "og:image", data.image, true);
  result = replaceMetaTag(result, "og:url", data.url, true);
  result = replaceMetaTag(result, "og:type", "website", true);
  result = replaceMetaTag(result, "og:site_name", "VitalityNutri", true);

  return result;
}

/**
 * Resolves the dynamic metadata (title, description, image, canonical url) based on request path and database values.
 */
function getMetaDataForRequest(req: express.Request): { title: string; description: string; image: string; url: string } {
  const protocol = req.secure ? "https" : "http";
  const host = process.env.NODE_ENV !== "production" ? "localhost:5027" : "vitalitynutri.com";

  let cleanPath = "/";
  if (/^[a-zA-Z0-9/_-]+$/.test(req.path)) {
    cleanPath = req.path.replace(/[^a-zA-Z0-9/_-]/g, "");
  }
  
  const absoluteUrl = encodeURI(`${protocol}://${host}${cleanPath}`);
  try {
    const parsedUrl = new URL(absoluteUrl);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      // already safe
    }
  } catch (_) {}

  // Default website-wide metadata
  let title = "VitalityNutri - Planificador de Alimentación Consciente y Saludable";
  let description = "Organiza tus comidas, genera listas de compra inteligentes y descubre recetas saludables pautadas a tu medida.";
  let image = "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop";

  // Check if we are requesting a recipe page: /recipe/:day/:meal
  const match = req.path.match(/\/recipe\/([^/]+)\/([^/]+)/i);
  if (match) {
    const rawDay = match[1].toLowerCase();
    const rawMeal = match[2].toLowerCase();
    
    const validDays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const validMeals = ["desayuno", "almuerzo", "merienda", "cena"];
    
    if (validDays.includes(rawDay) && validMeals.includes(rawMeal)) {
      const active = getPlan();
      if (active.plan && active.plan.days) {
        const dayRecipes = active.plan.days[rawDay as keyof typeof active.plan.days];
        if (dayRecipes) {
          const recipe = dayRecipes[rawMeal as keyof typeof dayRecipes];
          if (recipe) {
            const capitalizedDay = rawDay.charAt(0).toUpperCase() + rawDay.slice(1);
            const capitalizedMeal = rawMeal.charAt(0).toUpperCase() + rawMeal.slice(1);
            
            title = `${recipe.recipeName} (${capitalizedMeal} - ${capitalizedDay}) | VitalityNutri`;
            
            const caloriesText = recipe.calories ? `${recipe.calories} kcal` : "";
            const timeText = recipe.time ? `en ${recipe.time}` : "";
            const details = [caloriesText, timeText].filter(Boolean).join(" • ");
            
            description = `Receta para ${recipe.recipeName} (${recipe.tag || "Nutritivo"}). ${details ? details + ". " : ""}${recipe.tips || ""}`;
            if (description.length > 200) {
              description = description.slice(0, 197) + "...";
            }
            
            if (recipe.image) {
              image = recipe.image;
            }
          }
        }
      }
    }
  }

  // Check if we are requesting a recipe-book recipe page: /recipe-book/recipe/:id
  const recipeBookMatch = req.path.match(/\/recipe-book\/recipe\/(\d+)/i);
  if (recipeBookMatch) {
    const recipeId = parseInt(recipeBookMatch[1], 10);
    if (!isNaN(recipeId)) {
      const recipe = getRecipeById(recipeId);
      if (recipe) {
        title = `${recipe.recipeName} | Recetario | VitalityNutri`;
        const caloriesText = recipe.calories ? `${recipe.calories} kcal` : "";
        const timeText = recipe.time ? `en ${recipe.time}` : "";
        const details = [caloriesText, timeText].filter(Boolean).join(" • ");
        description = `Receta para ${recipe.recipeName} (${recipe.tag || "Recetario"}). ${details ? details + ". " : ""}${recipe.tips || ""}`;
        if (description.length > 200) {
          description = description.slice(0, 197) + "...";
        }
        if (recipe.image) {
          image = recipe.image;
        }
      }
    }
  }

  return { title, description, image, url: absoluteUrl };
}

// Integrate Vite middleware in development
async function setupVite() {
  let vite: any = null;
  let prodTemplateCache: string | null = null;

  const handlePageRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip API and files/assets containing dots
    if (req.path.startsWith("/api") || req.path.includes(".")) {
      return next();
    }

    try {
      let html = "";
      if (process.env.NODE_ENV !== "production") {
        const templatePath = path.join(process.cwd(), "index.html");
        try {
          html = await fs.promises.readFile(templatePath, "utf-8");
        } catch (_) {
          return next();
        }
      } else {
        if (!prodTemplateCache) {
          const templatePath = path.join(process.cwd(), "dist", "index.html");
          try {
            prodTemplateCache = await fs.promises.readFile(templatePath, "utf-8");
          } catch (_) {
            return next();
          }
        }
        html = prodTemplateCache;
      }

      // 1. Resolve dynamic metadata
      const metaData = getMetaDataForRequest(req);

      // 2. Transform index.html via Vite in development to support HMR
      if (process.env.NODE_ENV !== "production" && vite) {
        let safeUrl = "/";
        if (req.path.startsWith("/recipe/")) {
          safeUrl = "/recipe/lunes/desayuno";
        } else if (req.path === "/dashboard") {
          safeUrl = "/dashboard";
        } else if (req.path === "/calendar") {
          safeUrl = "/calendar";
        } else if (req.path === "/grocery") {
          safeUrl = "/grocery";
        } else if (req.path === "/batch-cooking") {
          safeUrl = "/batch-cooking";
        } else if (req.path.startsWith("/recipe-book")) {
          safeUrl = req.path;
        }
        html = await vite.transformIndexHtml(safeUrl, html);
      }

      // 3. Inject dynamic tags
      html = injectMetaTags(html, metaData);

      // 4. Return page
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      if (process.env.NODE_ENV !== "production" && vite) {
        vite.ssrFixStacktrace(e as Error);
      }
      next(e);
    }
  };

  const pageRoutes = [
    "/",
    "/dashboard",
    "/calendar",
    "/grocery",
    "/batch-cooking",
    "/recipe/:day/:meal",
    "/recipe-book",
    "/recipe-book/new",
    "/recipe-book/recipe/:id",
    "/recipe-book/edit/:id"
  ];

  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom", // Dynamic routing handled by handlePageRequest
    });
    
    // Serve page requests with dynamic metadata in development
    app.get(pageRoutes, pageLimiter, handlePageRequest);
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve page requests with dynamic metadata in production
    app.get(pageRoutes, pageLimiter, handlePageRequest);
    app.use(express.static(distPath));
    app.get("*", pageLimiter, handlePageRequest);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
