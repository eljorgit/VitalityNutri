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
setGlobalDispatcher(new Agent({
  headersTimeout: 300000,
  bodyTimeout: 300000,
  connectTimeout: 300000,
}));

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
   - Concéntrate en la brevedad absoluta. Máximo 2 pasos por plato/receta.
   - Cada paso debe tener como máximo 5-7 palabras (ej: "Hervir patata." o "Cocinar pollo plancha.").
5. **Consejos (\`tips\`):** Máximo 5 palabras simples (ej: "Usar aceite crudo.").
6. Evita palabras innecesarias, descripciones o conectores largos.
`;
}

/**
 * Helper to fill default values (images, calories, time, tags, tips) for recipes if missing.
 */
function fillDefaultRecipeValues(mealPlan: MealPlan): void {
  const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
  const mealsKeys = ["desayuno", "almuerzo", "merienda", "cena"] as const;

  const defaultImages = [
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1484723091739-30a097e8f929?q=80&w=1000&auto=format&fit=crop"
  ];

  let imageIdx = 0;
  for (const d of daysKeys) {
    for (const m of mealsKeys) {
      const recipe = mealPlan.days[d][m];
      if (recipe) {
        if (!recipe.image) {
          recipe.image = defaultImages[imageIdx % defaultImages.length];
          imageIdx++;
        }
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

  // Read file as Buffer and construct a Blob to avoid path resolution bugs in the SDK
  const fileBuffer = fs.readFileSync(filePath);
  const fileBlob = new Blob([fileBuffer], { type: "application/pdf" });

  // Upload file to Google Gemini File API
  const fileRef = await ai.files.upload({
    file: fileBlob,
    config: {
      mimeType: "application/pdf"
    }
  });

  const optimizedPrompt = getOptimizedPrompt();

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [
      {
        fileData: {
          fileUri: fileRef.uri,
          mimeType: fileRef.mimeType
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

// Integrate Vite middleware in development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
