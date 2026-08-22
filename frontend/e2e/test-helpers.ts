import { Page } from "@playwright/test";

export const sampleRecipe = {
  id: 101,
  recipeName: "Ensalada Mediterránea con Quinoa",
  calories: 420,
  time: "20 min",
  tag: "fresco",
  image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600",
  servings: 2,
  isFavorite: true,
  ingredients: {
    primerPlato: [
      { name: "Quinoa cocida", originalAmount: 150, unit: "g", category: "produce" },
      { name: "Tomate cherry", originalAmount: 100, unit: "g", category: "produce" },
      { name: "Queso feta", originalAmount: 50, unit: "g", category: "dairy" },
      { name: "Aceite de oliva virgen extra", originalAmount: 15, unit: "ml", category: "oil" },
    ],
  },
  tips: "Lava bien la quinoa antes de cocerla para eliminar la saponina.",
  steps: {
    primerPlato: [
      "Cocer la quinoa en abundante agua con sal durante 12 minutos.",
      "Cortar los tomates cherry por la mitad y desmenuzar el queso feta.",
      "Mezclar todos los ingredientes y aliñar con aceite de oliva.",
    ],
  },
  nutrition: {
    calories: 420,
    protein: 14,
    carbs: 48,
    fat: 18,
  },
  source: "manual",
};

const singleDayMeals = {
  breakfast: {
    recipeName: "Tostadas con Aguacate y Huevo",
    calories: 350,
    time: "10 min",
    tag: "rápido",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600",
    servings: 1,
    ingredients: {
      primerPlato: [
        { name: "Pan integral", originalAmount: 60, unit: "g", category: "bakery" },
        { name: "Aguacate", originalAmount: 50, unit: "g", category: "produce" },
        { name: "Huevo", originalAmount: 1, unit: "ud", category: "protein" },
      ],
    },
    tips: "Tostar el pan justo antes de servir.",
    steps: {
      primerPlato: ["Tostar el pan.", "Untar el aguacate.", "Cocinar el huevo a la plancha."],
    },
  },
  lunch: sampleRecipe,
  snack: {
    recipeName: "Yogur Griego con Nueces",
    calories: 200,
    time: "5 min",
    tag: "ligero",
    servings: 1,
    ingredients: {
      primerPlato: [
        { name: "Yogur griego", originalAmount: 125, unit: "g", category: "dairy" },
        { name: "Nueces", originalAmount: 20, unit: "g", category: "nuts" },
      ],
    },
    tips: "Añadir una pizca de canela si se desea.",
  },
  dinner: {
    recipeName: "Salmón al Horno con Espárragos",
    calories: 480,
    time: "25 min",
    tag: "proteico",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600",
    servings: 2,
    ingredients: {
      primerPlato: [
        { name: "Lomo de salmón", originalAmount: 200, unit: "g", category: "fish" },
        { name: "Espárragos trigueros", originalAmount: 150, unit: "g", category: "produce" },
      ],
    },
    tips: "Hornear a 180°C durante 15 minutos.",
  },
};

export const samplePlan = {
  days: {
    monday: singleDayMeals,
    tuesday: singleDayMeals,
    wednesday: singleDayMeals,
    thursday: singleDayMeals,
    friday: singleDayMeals,
    saturday: singleDayMeals,
    sunday: singleDayMeals,
  },
};

export const sampleGroceryItems = [
  { id: 1, name: "Tomate cherry", category: "produce", quantity: 100, unit: "g", isChecked: false, sourceWeekPlanId: 1 },
  { id: 2, name: "Quinoa cocida", category: "produce", quantity: 150, unit: "g", isChecked: true, sourceWeekPlanId: 1 },
  { id: 3, name: "Lomo de salmón", category: "fish", quantity: 200, unit: "g", isChecked: false, sourceWeekPlanId: 1 },
  { id: 4, name: "Queso feta", category: "dairy", quantity: 50, unit: "g", isChecked: false, sourceWeekPlanId: 1 },
];

export const sampleBatchCookingGuide = {
  introduction: "Preparación anticipada de bases de verduras, cocción de quinoa y horneado de proteínas.",
  prepTime: "1h 30min",
  steps: [
    {
      stepNumber: 1,
      title: "Cocer Quinoa",
      description: "Cocer quinoa en lote doble para usar durante la semana.",
      duration: "15 min",
      utensils: ["Olla", "Colador"],
      recipesAffected: [{ id: 101, name: "Ensalada Mediterránea con Quinoa" }],
    },
    {
      stepNumber: 2,
      title: "Cortar verduras",
      description: "Lavar y cortar verduras para ensaladas.",
      duration: "20 min",
      utensils: ["Cuchillo", "Tabla"],
      recipesAffected: [{ id: 101, name: "Ensalada Mediterránea con Quinoa" }],
    },
  ],
  storageTips: [
    {
      preparation: "Quinoa cocida",
      container: "Taper hermético de cristal",
      duration: "4 días",
      freezable: true,
      reheatingAndTips: "Consumir fría o templada con un chorrito de aceite de oliva.",
    },
  ],
};

export async function setupApiMocks(page: Page) {
  await page.route("**/api/plan**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/plan/batch-cooking")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guide: sampleBatchCookingGuide,
          params: {
            burnersCount: 4,
            hasOven: true,
            hasMicrowave: true,
            hasAirfryer: false,
            hasRobot: false,
            customTools: "",
          },
        }),
      });
    } else if (url.pathname === "/api/plan" && route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: samplePlan,
          metadata: {
            id: 1,
            fileName: "plan-semanal-ejemplo.pdf",
            processedAt: new Date().toISOString(),
          },
        }),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/plans", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          fileName: "plan-semanal-ejemplo.pdf",
          processedAt: new Date().toISOString(),
          isActive: true,
        },
      ]),
    });
  });

  await page.route("**/api/all-recipes", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          planId: 1,
          planName: "Plan Semanal",
          isActive: true,
          day: "monday",
          meal: "lunch",
          recipeName: sampleRecipe.recipeName,
          calories: sampleRecipe.calories,
          time: sampleRecipe.time,
          tag: sampleRecipe.tag,
          image: sampleRecipe.image,
          ingredientNames: ["Quinoa cocida", "Tomate cherry", "Queso feta"],
          isRecetario: true,
          recetarioId: 101,
        },
      ]),
    });
  });

  await page.route("**/api/recipes**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([sampleRecipe]),
      });
    } else if (method === "POST") {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ ...payload, id: 999 }),
      });
    } else if (method === "PUT") {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });

  await page.route("**/api/grocery-items**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sampleGroceryItems),
    });
  });

  await page.route("**/api/completed-recipes**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.route("**/api/search-history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
}
