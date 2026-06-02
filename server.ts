import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Agent, setGlobalDispatcher } from "undici";

import { DEFAULT_MEAL_PLAN, DEFAULT_PLAN_METADATA } from "./src/defaultData.js";
import { MealPlan, PlanMetadata } from "./src/types.js";
import { getPlan, savePlan, resetPlan, updateRecipe, getHistory, restorePlanFromHistory, deleteHistoryItem, getGroceryListState, saveGroceryListState } from "./src/db.js";

dotenv.config();

// Globally increase Node fetch timeouts (built-in undici client) to 5 minutes to prevent random AbortError
// setGlobalDispatcher(new Agent({
//   headersTimeout: 300000,
//   bodyTimeout: 300000,
//   connectTimeout: 300000,
// }));

const app = express();
const PORT = 5027;

// Support large payloads for PDF file uploads (base64)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Initialize the server-side Gemini client with a 5-minute timeout configuration to prevent undici HeadersTimeoutError
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      timeout: 300000, // 5 minutes timeout
    }
  })
  : null;

/**
 * Helper to build the optimized prompt with extreme speed & conciseness instructions.
 */
function getOptimizedPrompt(): string {
  const promptText = fs.readFileSync(path.join(process.cwd(), "promt.md"), "utf-8");
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
function getVerifiedImageForRecipe(recipeName: string, mealType: string): string {
  const nameLower = recipeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const mapping = [
    {
      // 1. Oats & Cereals (Breakfast porridge)
      keywords: ["avena", "porridge", "gachas", "oatmeal", "muesli", "granola", "cereal", "cereales"],
      url: "https://images.unsplash.com/photo-1517881917430-e70dfb3610aa?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 2. Pasta plates (checked before general meats/proteins)
      keywords: ["pasta", "espagueti", "espaguetis", "macarrones", "tallarines", "lasana", "lasagna", "ravioles", "fideos", "noodles"],
      url: "https://images.unsplash.com/photo-1546549032-9571cd6b27df?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 3. Rice & Quinoa plates
      keywords: ["arroz", "paella", "risotto", "quinoa", "cuscus", "cuscus"],
      url: "https://images.unsplash.com/photo-1534080564583-6be75777b70a?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 4. Pizza & Focaccia
      keywords: ["pizza", "focaccia"],
      url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 5. Salads
      keywords: ["ensalada", "salad", "cesar", "cesar"],
      url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 6. Avocado dishes (specifically avocado toast / fillings)
      keywords: ["aguacate", "avocado", "guacamole"],
      url: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 7. Toast, Sandwiches, Pitufos & Bread (checked before generic proteins so pitufo with chicken/tuna displays as a sandwich)
      keywords: ["pitufo", "tostada", "tosta", "sandwich", "sandich", "bocadillo", "pulguita", "mollete", "panecillo", "pan"],
      url: "https://images.unsplash.com/photo-1539252554453-80ab65ce3586?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 8. Pancakes & Crepes
      keywords: ["tortitas", "pancakes", "crepes", "gofres", "waffles"],
      url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 9. Eggs & Tortillas
      keywords: ["huevo", "huevos", "tortilla", "revuelto", "poche", "pocha", "escalfado", "frito", "fritos"],
      url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 10. Salmon
      keywords: ["salmon"],
      url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 11. Other Fish & Seafood
      keywords: ["pescado", "merluza", "bacalao", "lenguado", "lubina", "atun", "bonito", "emperador", "dorada", "trucha", "marisco", "pulpo", "gambas", "langostinos"],
      url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 12. Chicken & Poultry
      keywords: ["pollo", "pavo", "pechuga", "alitas", "muslo", "ave"],
      url: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 13. Meat (Beef, pork, etc.) - Uses a beautiful healthy grilled steak/salad image instead of heavy BBQ ribs
      keywords: ["carne", "ternera", "cerdo", "bistec", "filete", "lomo", "entrecot", "solomillo", "hamburguesa", "albondigas", "jamon"],
      url: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 14. Soups, Caldos & Creams
      keywords: ["sopa", "crema", "caldo", "gazpacho", "salmorejo", "pure"],
      url: "https://images.unsplash.com/photo-1547592165-e1d17fed6005?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 15. Yogurt & Dairy
      keywords: ["yogur", "yogurt", "kefir", "cuajada"],
      url: "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 16. Smoothies & Shakes
      keywords: ["batido", "smoothie", "licuado", "shake"],
      url: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 17. Fruits
      keywords: ["fruta", "fresas", "fresa", "platano", "manzana", "pera", "naranja", "kiwi", "uvas", "melocoton", "bayas", "arandanos", "frutas"],
      url: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 18. Nuts & Seeds
      keywords: ["frutos secos", "nueces", "almendras", "avellanas", "cacahuetes", "pistachos", "semillas", "chia", "pipas"],
      url: "https://images.unsplash.com/photo-1596701062351-df5f8a42f3c5?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 19. Hummus & Dips
      keywords: ["hummus", "dip", "pate"],
      url: "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 20. Wraps & Tacos
      keywords: ["wrap", "taco", "tacos", "burrito", "fajita", "fajitas", "quesadilla"],
      url: "https://images.unsplash.com/photo-1626700051175-6518c4793f73?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 21. Coffee & Tea
      keywords: ["cafe", "te", "infusion", "manzanilla", "poleo"],
      url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 22. Cheese
      keywords: ["queso", "cottage", "requeson", "burgos", "mozzarella", "feta"],
      url: "https://images.unsplash.com/photo-1486887396153-fa416525c108?q=80&w=1000&auto=format&fit=crop"
    },
    {
      // 23. General Veggies & Greens
      keywords: ["verduras", "verdura", "vegetales", "espinacas", "espinaca", "brocoli", "calabacin", "berenjena", "pimiento", "zanahoria", "champinones", "champinon", "setas", "puerro", "apio", "esparragos"],
      url: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop"
    }
  ];

  for (const entry of mapping) {
    if (entry.keywords.some(kw => nameLower.includes(kw))) {
      return entry.url;
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

/**
 * Helper to fill default values (images, calories, time, tags, tips) for recipes.
 */
function fillDefaultRecipeValues(mealPlan: MealPlan): void {
  const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
  const mealsKeys = ["desayuno", "almuerzo", "merienda", "cena"] as const;

  for (const d of daysKeys) {
    for (const m of mealsKeys) {
      const recipe = mealPlan.days[d][m];
      if (recipe) {
        // Always overwrite or fill the image based on our verified Unsplash mapping
        recipe.image = getVerifiedImageForRecipe(recipe.recipeName, m);

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

  if (!fs.existsSync(filePath)) {
    throw new Error(`El archivo no existe en la ruta del servidor: ${filePath}`);
  }

  // Read local file as base64 and send it inline to avoid File API upload issues
  const base64Data = fs.readFileSync(filePath).toString("base64");

  const optimizedPrompt = getOptimizedPrompt();

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
    fillDefaultRecipeValues(mealPlan);
    return mealPlan;
  } else {
    throw new Error("El plan devuelto no tiene una estructura con la clave 'days'.");
  }
}

// 1. Endpoint to get the active global meal plan
app.get("/api/plan", (req, res) => {
  const active = getPlan();
  if (active.plan) {
    fillDefaultRecipeValues(active.plan);
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
    if (updated.plan) {
      fillDefaultRecipeValues(updated.plan);
    }
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

// 4. Endpoint to upload & process nutrition plan PDF with Gemini AI
app.post("/api/upload", async (req, res) => {
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

  req.on("close", () => {
    if (!responseSent && savedFileName) {
      console.log(`[Cancel] Client disconnected/aborted. Cleaning up file: ${savedFileName}`);
      const filePath = path.join(process.cwd(), "data", "uploads", savedFileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Error unlinking cancelled file:", e);
        }
      }
    }
  });

  try {
    // Save the PDF file physically
    const uploadsDir = path.join(process.cwd(), "data", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // Sanitize filename to remove spaces, accents, and special characters
    const sanitizedName = fileName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_");
    savedFileName = `${Date.now()}_${sanitizedName}`;
    const savedFilePath = path.join(uploadsDir, savedFileName);
    fs.writeFileSync(savedFilePath, Buffer.from(fileData, "base64"));

    // Process using helper
    const mealPlan = await processPDFWithGemini(savedFilePath);

    const planMetadata = {
      fileName,
      savedFileName,
      processedAt: new Date().toISOString()
    };

    // Persist the plan and metadata to the SQLite database
    savePlan(mealPlan, planMetadata, savedFileName);

    responseSent = true;
    res.json({
      success: true,
      plan: mealPlan,
      metadata: planMetadata,
    });

  } catch (error: any) {
    responseSent = true;
    console.error("Error al procesar PDF con Gemini:", error);

    // Clean up file if parsing failed
    if (savedFileName) {
      const filePath = path.join(process.cwd(), "data", "uploads", savedFileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
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

// 6. Endpoint to restore a plan from history as the active plan
app.post("/api/history/restore/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de historial no válido." });
  }
  try {
    const restored = restorePlanFromHistory(id);
    if (restored) {
      fillDefaultRecipeValues(restored.plan);
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
app.delete("/api/history/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "ID de historial no válido." });
  }
  try {
    const savedFileName = deleteHistoryItem(id);
    if (savedFileName) {
      const filePath = path.join(process.cwd(), "data", "uploads", savedFileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting history item:", error);
    res.status(500).json({ error: "Error al eliminar el elemento del historial." });
  }
});

// 8. Endpoint to reprocess the active plan
app.post("/api/reprocess", async (req, res) => {
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

    const savedFileName = active.metadata.savedFileName;
    const fileName = active.metadata.fileName;
    const filePath = path.join(process.cwd(), "data", "uploads", savedFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `No se encontró el archivo original ${fileName} en el servidor.` });
    }

    // Process using helper
    const mealPlan = await processPDFWithGemini(filePath);

    const planMetadata = {
      id: active.metadata.id,
      fileName: active.metadata.fileName,
      savedFileName: active.metadata.savedFileName,
      processedAt: new Date().toISOString()
    };

    // Save back
    savePlan(mealPlan, planMetadata, savedFileName);

    res.json({
      success: true,
      plan: mealPlan,
      metadata: planMetadata,
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

// Auxiliary helpers to escape HTML attribute values and replace/inject meta tags dynamically

/**
 * Helper to escape HTML special characters in attributes to prevent breakage.
 */
function escapeHtmlAttr(val: string): string {
  return String(val || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Helper to replace or inject a meta tag by name/property.
 */
function replaceMetaTag(html: string, nameOrProperty: string, value: string, isProperty: boolean = false): string {
  const attribute = isProperty ? "property" : "name";
  const escapedVal = escapeHtmlAttr(value);
  const regex = new RegExp(`<meta\\s+${attribute}="${nameOrProperty.replace(/:/g, "\\:")}"\\s+content="[^"]*"\\s*\\/?>`, "i");
  if (regex.test(html)) {
    return html.replace(regex, `<meta ${attribute}="${nameOrProperty}" content="${escapedVal}" />`);
  }
  // If tag doesn't exist, we append it right before </head>
  return html.replace("</head>", `<meta ${attribute}="${nameOrProperty}" content="${escapedVal}" />\n</head>`);
}

/**
 * Inject the dynamic page metadata (Title, OpenGraph, Twitter Cards) into the HTML template.
 */
function injectMetaTags(html: string, data: { title: string; description: string; image: string; url: string }): string {
  let result = html;
  
  // Replace <title> tag
  if (/<title>.*?<\/title>/i.test(result)) {
    result = result.replace(/<title>.*?<\/title>/i, `<title>${escapeHtmlAttr(data.title)}</title>`);
  } else {
    result = result.replace("</head>", `<title>${escapeHtmlAttr(data.title)}</title>\n</head>`);
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
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.get("host") || "vitalitynutri.com";
  const absoluteUrl = `${protocol}://${host}${req.originalUrl}`;

  // Default website-wide metadata
  let title = "VitalityNutri - Planificador de Alimentación Consciente y Saludable";
  let description = "Organiza tus comidas, genera listas de compra inteligentes y descubre recetas saludables pautadas a tu medida.";
  let image = "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop";

  // Check if we are requesting a recipe page: /recipe/:day/:meal
  const match = req.path.match(/\/recipe\/([^/]+)\/([^/]+)/i);
  if (match) {
    const rawDay = match[1];
    const rawMeal = match[2];
    
    const active = getPlan();
    if (active.plan && active.plan.days) {
      const dayName = rawDay.toLowerCase();
      const mealName = rawMeal.toLowerCase();
      
      const dayRecipes = active.plan.days[dayName as keyof typeof active.plan.days];
      if (dayRecipes) {
        const recipe = dayRecipes[mealName as keyof typeof dayRecipes];
        if (recipe) {
          const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
          const capitalizedMeal = mealName.charAt(0).toUpperCase() + mealName.slice(1);
          
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

  return { title, description, image, url: absoluteUrl };
}

// Integrate Vite middleware in development
async function setupVite() {
  let vite: any = null;

  const handlePageRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip API and files/assets containing dots
    if (req.path.startsWith("/api") || req.path.includes(".")) {
      return next();
    }

    try {
      let templatePath = "";
      if (process.env.NODE_ENV !== "production") {
        templatePath = path.join(process.cwd(), "index.html");
      } else {
        templatePath = path.join(process.cwd(), "dist", "index.html");
      }

      if (!fs.existsSync(templatePath)) {
        return next();
      }

      let html = fs.readFileSync(templatePath, "utf-8");

      // 1. Resolve dynamic metadata
      const metaData = getMetaDataForRequest(req);

      // 2. Transform index.html via Vite in development to support HMR
      if (process.env.NODE_ENV !== "production" && vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
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

  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom", // Dynamic routing handled by handlePageRequest
    });
    
    // Serve page requests with dynamic metadata in development
    app.get(["/", "/dashboard", "/calendar", "/grocery", "/recipe/:day/:meal"], handlePageRequest);
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve page requests with dynamic metadata in production
    app.get(["/", "/dashboard", "/calendar", "/grocery", "/recipe/:day/:meal"], handlePageRequest);
    app.use(express.static(distPath));
    app.get("*", handlePageRequest);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
