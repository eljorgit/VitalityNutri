import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Agent, setGlobalDispatcher } from "undici";

import { DEFAULT_MEAL_PLAN, DEFAULT_PLAN_METADATA } from "./src/defaultData.js";
import { MealPlan, PlanMetadata } from "./src/types.js";
import { getPlan, savePlan, resetPlan, updateRecipe } from "./src/db.js";

dotenv.config();

// Globally increase Node fetch timeouts (built-in undici client) to 5 minutes to prevent random AbortError
setGlobalDispatcher(new Agent({
  headersTimeout: 300000,
  bodyTimeout: 300000,
  connectTimeout: 300000,
}));

const app = express();
const PORT = 3000;

// Support large payloads for PDF file uploads (base64)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Initialize the server-side Gemini client with a 5-minute timeout configuration to prevent undici HeadersTimeoutError
const ai = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 300000, // 5 minutes timeout
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    })
  : null;

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

  try {
    // We send the PDF base64 file directly to Gemini 3.5 Flash!
    const pdfPart = {
      inlineData: {
        data: fileData,
        mimeType: "application/pdf"
      }
    };

    const promptText = `
Analiza este PDF de plan semanal de alimentación/nutrición y extrae un plan de comidas detallado estructurado en formato JSON.
El resultado debe ser un JSON que represente exactamente el plan semanal de Lunes a Domingo, con las cuatro comidas principales: desayuno, almuerzo, merienda y cena.

Por cada comida disponible, asocia una receta saludable coherente con los ingredientes indicados en el PDF. Si una comida no está indicada o especificada en el PDF, intenta sugerir una opción saludable adecuada o ponla como null.

Devuelve estrictamente el JSON estructurado acorde al siguiente formato TypeScript:

interface Ingredient {
  name: string;
  originalAmount: number; // cantidad numérica base
  unit: string; // ej: "unidad(es)", "rebanada(s)", "porcion(es)"
  secondaryAmount?: number; // opcional: si el plan incluye un peso estimado o cantidad alternativa, ej: si aparece "1 huevo (50g)" o "1 rebanada (30g)", extrae aquí la cantidad alternativa (ejemp: 50 o 30)
  secondaryUnit?: string; // opcional: si tiene cantidad secundaria, extrae aquí la unidad (ejemp: "g", "ml")
}

interface Recipe {
  recipeName: string;
  calories: number; // estimado de calorías, ej: 450
  time: string; // tiempo aproximado de preparación, ej: "25 min"
  tag: string; // tag corto nutricional, ej: "Alto en Proteína", "Bajo en Grasas", "Fibra"
  ingredients: Ingredient[];
  tips: string; // Un tip de nutricionista o consejo de preparación para esta receta
  steps: string[]; // Lista de preparación paso a paso. Sé práctico y conciso (entre 3 y 5 pasos claros por receta) para optimizar la preparación del menú diario.
}

interface MealPlan {
  days: {
    lunes: { desayuno: Recipe|null, almuerzo: Recipe|null, merienda: Recipe|null, cena: Recipe|null },
    martes: { desayuno: Recipe|null, almuerzo: Recipe|null, merienda: Recipe|null, cena: Recipe|null },
    miercoles: { desayuno: Recipe|null, almuerzo: Recipe|null, merienda: Recipe|null, cena: Recipe|null },
    jueves: { desayuno: Recipe|null, almuerzo: Recipe|null, merienda: Recipe|null, cena: Recipe|null },
    viernes: { desayuno: Recipe|null, almuerzo: Recipe|null, merienda: Recipe|null, cena: Recipe|null },
    sabado: { desayuno: Recipe|null, almuerzo: Recipe|null, merienda: Recipe|null, cena: Recipe|null },
    domingo: { desayuno: Recipe|null, almuerzo: Recipe|null, merienda: Recipe|null, cena: Recipe|null }
  }
}

¡Asegúrate de que la propiedad base de JSON sea "days" que contenga cada uno de los días en minúsculas y sin acentos ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")!
Por favor, asegúrate de que todas las cantidades de ingredientes sean números puros (sin letras dentro de originalAmount o secondaryAmount) y coloca la unidad por separado en "unit" o "secondaryUnit".

=== REQUISITOS DE RENDIMIENTO Y VELOCIDAD EXTREMA ===
Para evitar Gateway Timeout (límite de 60 segundos), es obligatorio que la generación sea sumamente compacta y ultrarrápida. Por favor, sigue estas pautas estrictas en cada receta:
1. 'recipeName': Máximo 3 o 4 palabras explicativas claras.
2. 'ingredients': Máximo 3 ingredientes principales por receta (los más relevantes).
3. 'tips': Una única frase extremadamente corta de no más de 10 palabras libres de preámbulos.
4. 'steps': Máximo 2 pasos explicativos súper directos de no más de 8 palabras cada uno.
Reducir sustancialmente la longitud del texto es vital para acelerar la velocidad a menos de 15 segundos totales.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [pdfPart, promptText],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      }
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("No se pudo obtener una respuesta legible de Gemini.");
    }

    // Parse extracted JSON
    const parsedData = JSON.parse(textResponse.trim());

    // Validate structure slightly and set as active global plan
    if (parsedData && parsedData.days) {
      const mealPlan = parsedData as MealPlan;
      const planMetadata = {
        fileName,
        processedAt: new Date().toISOString()
      };

      // Ensure each recipe has an image, if none exists add a default or search query or nice placeholder
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

      // Persist the plan and metadata to the SQLite database
      savePlan(mealPlan, planMetadata);

      res.json({
        success: true,
        plan: mealPlan,
        metadata: planMetadata,
      });
    } else {
      throw new Error("El plan devuelto no tiene una estructura con la clave 'days'.");
    }

  } catch (error: any) {
    console.error("Error al procesar PDF con Gemini:", error);
    
    let rawError = "";
    if (error && typeof error === "object") {
      rawError = error.message || JSON.stringify(error);
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
