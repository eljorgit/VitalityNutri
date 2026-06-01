import React, { useState } from "react";
import { DayType, MealType, Recipe, MealPlan } from "../types";

interface RecipeDetailProps {
  day: DayType;
  meal: MealType;
  recipe: Recipe;
  onGoBack: () => void;
  onUpdateRecipeOnServer?: (day: DayType, meal: MealType, updatedRecipe: Recipe) => void;
  plan?: MealPlan | null;
  onNavigate?: (day: DayType, meal: MealType, recipe: Recipe) => void;
}

export default function RecipeDetail({
  day,
  meal,
  recipe,
  onGoBack,
  onUpdateRecipeOnServer,
  plan,
  onNavigate
}: RecipeDetailProps) {
  // Ratio defaults to 1 ración (base)
  const [multiplier, setMultiplier] = useState<number>(1);
  const [customInput, setCustomInput] = useState<string>("");
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [showDayMealsDropdown, setShowDayMealsDropdown] = useState<boolean>(false);
  const [showAllRecipesDropdown, setShowAllRecipesDropdown] = useState<boolean>(false);

  const handleSetPreset = (factor: number) => {
    setMultiplier(factor);
    setCustomInput("");
  };

  const handleApplyCustom = () => {
    const val = parseFloat(customInput);
    if (!isNaN(val) && val > 0) {
      setMultiplier(val);
    }
  };

  const handleReset = () => {
    setMultiplier(1);
    setCustomInput("");
  };

  const formatQuantity = (val: number) => {
    // Avoid trailing decimal zeroes
    return Math.round(val * 100) / 100;
  };

  const mealNames: Record<MealType, string> = {
    desayuno: "Desayuno",
    almuerzo: "Almuerzo",
    merienda: "Merienda",
    cena: "Cena"
  };

  const dayNames: Record<DayType, string> = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes",
    sabado: "Sábado",
    domingo: "Domingo"
  };

  // Compile sequential list of actual meals in the plan for arrow navigation
  const orderedDays: DayType[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const orderedMeals: MealType[] = ["desayuno", "almuerzo", "merienda", "cena"];

  const activeRecipes: { day: DayType; meal: MealType; recipe: Recipe }[] = [];
  if (plan) {
    orderedDays.forEach((d) => {
      orderedMeals.forEach((m) => {
        const r = plan.days[d]?.[m];
        if (r) {
          activeRecipes.push({ day: d, meal: m, recipe: r });
        }
      });
    });
  }

  const currentIndex = activeRecipes.findIndex(
    (item) => item.day === day && item.meal === meal
  );

  const prevIndex = currentIndex > 0 ? currentIndex - 1 : -1;
  const nextIndex = currentIndex !== -1 && currentIndex < activeRecipes.length - 1 ? currentIndex + 1 : -1;

  const getSequenceValue = (d: DayType, m: MealType) => {
    const dayOrder: DayType[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const mealOrder: MealType[] = ["desayuno", "almuerzo", "merienda", "cena"];
    return dayOrder.indexOf(d) * 4 + mealOrder.indexOf(m);
  };

  const getNextMealRecipe = () => {
    if (activeRecipes.length === 0) return null;

    const dayKeysInOrder: DayType[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const localDayNum = new Date().getDay();
    const hour = new Date().getHours();

    let targetDay = dayKeysInOrder[localDayNum];
    let targetMeal: MealType = "desayuno";

    if (hour >= 20) {
      targetDay = dayKeysInOrder[(localDayNum + 1) % 7];
      targetMeal = "desayuno";
    } else if (hour >= 18) {
      targetMeal = "cena";
    } else if (hour >= 15) {
      targetMeal = "merienda";
    } else if (hour >= 10) {
      targetMeal = "almuerzo";
    }

    const targetWeight = getSequenceValue(targetDay, targetMeal);

    let bestMatch = activeRecipes.find(item => getSequenceValue(item.day, item.meal) >= targetWeight);
    if (!bestMatch) {
      bestMatch = activeRecipes[0];
    }
    return bestMatch;
  };

  const nextMeal = getNextMealRecipe();
  const dayKeysInOrder: DayType[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

  // Sophisticated culinary step generator if legacy/default dataset doesn't have "steps"
  const getRecipeStepsFallback = (recipeName: string, ingredients: any[]): string[] => {
    return [
      `Preparación y Mise en Place: Comienza por limpiar meticulosamente tu área de cocina. Lava muy bien todos los ingredientes, especialmente si usas hierbas o vegetales frescos con piel. Reúne las sartenes u ollas necesarias y precalienta el fuego a temperatura media para conseguir una transmisión de calor uniforme.`,
      `Técnicas de Corte y Cocción Inicial: Corta finamente los ingredientes que lo requieran (como cebollas, ajos o proteínas de acompañamiento) usando un cuchillo afilado de chef para cortes limpios y uniformes que faciliten el cocinado. Añade una cucharadita de aceite de oliva en la sartén precalentada y dora la base aromática a fuego medio durante 3 a 5 minutos, vigilando la temperatura para potenciar sus aceites naturales aromáticos.`,
      `Incorporación y Control Térmico: Añade los ingredientes principales de forma lógica según su densidad de masa y resistencia al calor (primero verduras densas como la zanahoria y proteínas duras, dejando las hojas verdes o guarniciones blandas para el final). Mantén una cocción jugosa y uniforme regulando el fuego a intensidad media de forma constante por 8-12 minutos, agitando con suavidad con una espátula de madera.`,
      `Emplatado y Presentación Gourmet: Retira del fuego y deja reposar la preparación por 1 minuto para asentar los jugos aromáticos. Para una presentación visualmente irresistible, sirve en un plato hondo o bowl moderno de cerámica, distribuyendo los alimentos con volumen y altura en el centro. Corona el plato decorando de manera apetitosa con tus condimentos frescos o semillas pautadas para dar contraste crujiente.`
    ];
  };

  // Categorization support
  const [selectedIngCategory, setSelectedIngCategory] = useState<string>("Todo");
  const [selectedStepCategory, setSelectedStepCategory] = useState<string>("Todo");

  const categoryNames: Record<string, string> = {
    primerPlato: "Primer Plato",
    segundoPlato: "Segundo Plato",
    postre: "Postre",
    general: "General"
  };

  const getFriendlyIngredientCategory = (category?: string): string => {
    if (!category) return "";
    const catLow = category.toLowerCase();
    switch (catLow) {
      case "verduras y hortalizas":
        return "Verduras";
      case "frutas":
        return "Frutas";
      case "carnes, huevos y tofu":
        return "Proteínas";
      case "pescados y mariscos":
        return "Pescados";
      case "lácteos y bebidas":
        return "Lácteos/Bebidas";
      case "granos, harinas y semillas":
        return "Granos/Semillas";
      case "despensa y condimentos":
        return "Despensa";
      case "otros":
        return "Otros";
      default:
        return category;
    }
  };

  const getIngredientCategoryIcon = (category?: string): string => {
    if (!category) return "";
    const catLow = category.toLowerCase();
    switch (catLow) {
      case "verduras y hortalizas":
        return "spa";
      case "frutas":
        return "nutrition";
      case "carnes, huevos y tofu":
        return "dinner_dining";
      case "pescados y mariscos":
        return "set_meal";
      case "lácteos y bebidas":
        return "local_cafe";
      case "granos, harinas y semillas":
        return "wheat";
      case "despensa y condimentos":
        return "kitchen";
      default:
        return "shopping_bag";
    }
  };

  const getIngredientCategoryClass = (category?: string): string => {
    if (!category) return "";
    const catLow = category.toLowerCase();
    switch (catLow) {
      case "verduras y hortalizas":
        return "bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40";
      case "frutas":
        return "bg-red-50 dark:bg-red-950/35 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40";
      case "carnes, huevos y tofu":
        return "bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-450 border-amber-100 dark:border-amber-900/40";
      case "pescados y mariscos":
        return "bg-cyan-50 dark:bg-cyan-950/35 text-cyan-750 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/40";
      case "lácteos y bebidas":
        return "bg-blue-50 dark:bg-blue-950/35 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/40";
      case "granos, harinas y semillas":
        return "bg-yellow-50/50 dark:bg-yellow-950/35 text-yellow-750 dark:text-yellow-400 border-yellow-100/70 dark:border-yellow-900/40";
      case "despensa y condimentos":
        return "bg-orange-50 dark:bg-orange-950/35 text-orange-700 dark:text-orange-450 border-orange-100 dark:border-orange-900/40";
      default:
        return "bg-slate-100 dark:bg-zinc-800 text-slate-550 dark:text-zinc-400 border-slate-200 dark:border-zinc-700";
    }
  };

  const isIngredientsArray = Array.isArray(recipe.ingredients);

  // Normalize ingredients to: { item: Ingredient; categoryKey: string }[]
  const normalizedIngredients: { item: any; categoryKey: string }[] = [];
  if (isIngredientsArray) {
    (recipe.ingredients as any[] || []).forEach(ing => {
      normalizedIngredients.push({ item: ing, categoryKey: "general" });
    });
  } else {
    const cats = recipe.ingredients as any;
    ["primerPlato", "segundoPlato", "postre", "general"].forEach(catKey => {
      if (cats && Array.isArray(cats[catKey])) {
        cats[catKey].forEach((ing: any) => {
          normalizedIngredients.push({ item: ing, categoryKey: catKey });
        });
      }
    });
  }

  // Active categories for ingredients (keys that have non-empty arrays)
  const activeIngCategories = isIngredientsArray
    ? []
    : Object.keys(recipe.ingredients || {}).filter(key => {
      const arr = (recipe.ingredients as any)[key];
      return Array.isArray(arr) && arr.length > 0;
    });

  // Filtered ingredients
  const displayedIngredients = selectedIngCategory === "Todo"
    ? normalizedIngredients
    : normalizedIngredients.filter(ing => ing.categoryKey === selectedIngCategory);

  // Normalize steps
  const isStepsArray = Array.isArray(recipe.steps);
  const hasSteps = (() => {
    if (!recipe.steps) return false;
    if (isStepsArray) return (recipe.steps as any[]).length > 0;
    // It's CategorizedSteps
    return Object.values(recipe.steps).some(arr => Array.isArray(arr) && arr.length > 0);
  })();

  const recipeStepsSource = (() => {
    if (recipe.steps) {
      if (isStepsArray) {
        if ((recipe.steps as string[]).length > 0) {
          return { general: recipe.steps as string[] };
        }
      } else {
        return recipe.steps as any;
      }
    }
    const flatIngs = Array.isArray(recipe.ingredients)
      ? (recipe.ingredients as any[])
      : (Object.values(recipe.ingredients || {}).flat().filter(Boolean) as any[]);
    return { general: getRecipeStepsFallback(recipe.recipeName, flatIngs) };
  })();

  // Normalize steps to: { text: string; categoryKey: string }[]
  const normalizedSteps: { text: string; categoryKey: string }[] = [];
  const activeStepCategories: string[] = [];

  ["primerPlato", "segundoPlato", "postre", "general"].forEach(catKey => {
    const stepsArr = recipeStepsSource?.[catKey];
    if (Array.isArray(stepsArr) && stepsArr.length > 0) {
      activeStepCategories.push(catKey);
      stepsArr.forEach((step: string) => {
        normalizedSteps.push({ text: step, categoryKey: catKey });
      });
    }
  });

  // Filtered steps
  const displayedSteps = selectedStepCategory === "Todo"
    ? normalizedSteps
    : normalizedSteps.filter(step => step.categoryKey === selectedStepCategory);

  return (
    <div className="space-y-6 select-text text-left">

      {/* Recipe Navigation Bar - ordered exactly left-to-right as requested */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200/50 dark:border-zinc-800 pb-4 no-print select-none">

        {/* Go back trigger and Next Meal helper */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3.5 py-2.5 rounded-xl transition duration-200 cursor-pointer animate-fade-in"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Volver al Calendario
          </button>

          {nextMeal && (
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate(nextMeal.day, nextMeal.meal, nextMeal.recipe);
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 px-3.5 py-2.5 rounded-xl transition duration-200 cursor-pointer animate-fade-in border border-emerald-100/50 dark:border-emerald-900/40"
              title={`Ir a la próxima comida: ${mealNames[nextMeal.meal]}`}
            >
              <span className="material-symbols-outlined text-[15px]">fastfood</span>
              <span>
                Próxima comida: {mealNames[nextMeal.meal]} ({nextMeal.day === dayKeysInOrder[new Date().getDay()] ? "hoy" : nextMeal.day === dayKeysInOrder[(new Date().getDay() + 1) % 7] ? "mañana" : dayNames[nextMeal.day]})
              </span>
            </button>
          )}
        </div>

        {activeRecipes.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-1.5 rounded-2xl shadow-sm relative shrink-0">

            {/* 1. Flecha tipo chevron hacia la izquierda (comida anterior ciclico) */}
            <button
              type="button"
              onClick={() => {
                if (activeRecipes.length <= 1 || !onNavigate) return;
                const prevIdx = (currentIndex - 1 + activeRecipes.length) % activeRecipes.length;
                onNavigate(activeRecipes[prevIdx].day, activeRecipes[prevIdx].meal, activeRecipes[prevIdx].recipe);
              }}
              className="p-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-slate-600 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400 transition cursor-pointer flex items-center justify-center font-bold"
              title="Receta anterior"
            >
              <span className="material-symbols-outlined block text-[20px] font-black">chevron_left</span>
            </button>

            {/* 2. Texto del día actual y tipo de comida, con tamaño garantizado idéntico */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowDayMealsDropdown(!showDayMealsDropdown);
                  setShowAllRecipesDropdown(false);
                }}
                className="px-3 py-2 text-xs md:text-sm font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight hover:text-emerald-700 dark:hover:text-emerald-400 rounded-xl cursor-pointer transition flex items-center gap-1"
                title="Ver otras comidas de este día"
              >
                <span className="w-40 md:w-56 text-center truncate inline-block">{dayNames[day]} • <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{mealNames[meal]}</span></span>
                <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-zinc-500">arrow_drop_down</span>
              </button>

              {showDayMealsDropdown && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl py-2.5 w-60 z-50 text-left">
                  <div className="px-3.5 py-1 text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider select-none">
                    Comidas del {dayNames[day]}
                  </div>
                  {orderedMeals.map((m) => {
                    const r = plan?.days[day]?.[m];
                    const isCurrent = m === meal;
                    if (!r) return null;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          if (onNavigate) onNavigate(day, m, r);
                          setShowDayMealsDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-xs text-left transition flex flex-col ${isCurrent
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-850 dark:text-emerald-300 font-extrabold"
                          : "text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
                          }`}
                      >
                        <span className="font-extrabold text-[11px] uppercase tracking-wide">{mealNames[m]}</span>
                        <span className="text-slate-400 dark:text-zinc-400 text-[10px] truncate">{r.recipeName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Icono de calendario (pegado justo al texto) con dropdown agrupado por dia de la semana */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowAllRecipesDropdown(!showAllRecipesDropdown);
                  setShowDayMealsDropdown(false);
                }}
                className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center font-bold ${showAllRecipesDropdown
                  ? "bg-slate-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400"
                  : "text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
                  }`}
                title="Mostrar todas las recetas"
              >
                <span className="material-symbols-outlined block text-[18px]">calendar_today</span>
              </button>

              {showAllRecipesDropdown && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2.5xl shadow-xl p-4 w-72 md:w-80 z-50 text-left max-h-[350px] overflow-y-auto">
                  <h4 className="text-[10px] font-black text-slate-405 dark:text-zinc-500 uppercase mb-3.5 tracking-widest select-none">Prescripción Semanal</h4>
                  <div className="space-y-3">
                    {orderedDays.map((d) => {
                      const dayLabel = dayNames[d];
                      return (
                        <div key={d} className="border-b border-slate-100 dark:border-zinc-800/40 pb-2.5 last:border-none last:pb-0">
                          <span className="text-xs font-black text-slate-800 dark:text-zinc-200 block mb-1.5">{dayLabel}</span>
                          <div className="flex gap-1.5 select-none text-center">
                            {orderedMeals.map((m) => {
                              const r = plan?.days[d]?.[m];
                              const initials = { desayuno: "D", almuerzo: "A", merienda: "M", cena: "C" };
                              const initial = initials[m];
                              const isCurrent = d === day && m === meal;
                              const hasRecipe = !!r;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  disabled={!hasRecipe}
                                  onClick={() => {
                                    if (r && onNavigate) {
                                      onNavigate(d, m, r);
                                      setShowAllRecipesDropdown(false);
                                    }
                                  }}
                                  className={`w-7.5 h-7.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${isCurrent
                                    ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200 dark:ring-emerald-900"
                                    : hasRecipe
                                      ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/45 dark:text-emerald-300 dark:hover:bg-emerald-950"
                                      : "bg-slate-50 text-slate-300 dark:bg-zinc-950 dark:text-zinc-700 cursor-not-allowed"
                                    }`}
                                  title={r ? `${mealNames[m]}: ${r.recipeName}` : `${mealNames[m]}: Sin pautar`}
                                >
                                  {initial}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Flecha tipo chevron hacia la derecha (comida siguiente ciclico) */}
            <button
              type="button"
              onClick={() => {
                if (activeRecipes.length <= 1 || !onNavigate) return;
                const nextIdx = (currentIndex + 1) % activeRecipes.length;
                onNavigate(activeRecipes[nextIdx].day, activeRecipes[nextIdx].meal, activeRecipes[nextIdx].recipe);
              }}
              className="p-2 rounded-xl hover:bg-white dark:hover:bg-zinc-800 text-slate-600 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400 transition cursor-pointer flex items-center justify-center font-bold"
              title="Comida siguiente"
            >
              <span className="material-symbols-outlined block text-[20px] font-black">chevron_right</span>
            </button>

          </div>
        )}

        <div className="text-xs text-slate-400 md:w-[150px] text-right">
          Pauta {currentIndex + 1} de {activeRecipes.length}
        </div>
      </div>

      {/* Hero Header Presentation */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-850 border border-slate-200/50 dark:border-slate-800 min-h-[250px] flex flex-col md:flex-row items-stretch shadow-sm">
        <div className="w-full md:w-5/12 min-h-[200px] relative shrink-0">
          <img
            src={recipe.image || "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1000&auto=format&fit=crop"}
            alt={recipe.recipeName}
            className="absolute inset-0 w-full h-full object-cover animate-fade-in"
          />
        </div>
        <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col justify-center bg-white dark:bg-slate-900">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest bg-emerald-50 dark:bg-emerald-900/30 text-emerald-850 dark:text-emerald-400 px-3 py-1 rounded-full w-max mb-3 uppercase">
            {recipe.tag || "Saludable"}
          </span>
          <h1 className="text-2xl md:text-3.5xl font-extrabold text-slate-900 dark:text-white leading-tight mb-4 select-all">
            {recipe.recipeName}
          </h1>
          <div className="flex flex-wrap gap-4 select-none">
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-emerald-600">schedule</span>
              <span className="font-semibold">{recipe.time || "25 min"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 font-bold">
              <span className="material-symbols-outlined text-emerald-600">fitness_center</span>
              <span className="font-semibold text-emerald-750 dark:text-emerald-400">Alta densidad nutricional</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main interactive grid content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Sidebar calculations */}
        <aside className="lg:col-span-4 space-y-6">

          <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-zinc-850 shadow-sm text-left">
            <h2 className="text-md font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">calculate</span>
              Raciones Ajustables
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Ajusta las raciones para toda la familia de forma instantánea. Se actualizarán todas las cantidades y se resaltarán en verde.
            </p>

            {/* Presets and factor selection row */}
            <div className="grid grid-cols-4 gap-2 mb-4 select-none">
              {[1, 2, 3, 4].map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => handleSetPreset(factor)}
                  className={`py-2 rounded-xl text-xs font-black transition duration-200 cursor-pointer ${multiplier === factor
                    ? "bg-emerald-600 text-white border border-emerald-600 dark:bg-emerald-600"
                    : "bg-white hover:bg-emerald-50/50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  x{factor}
                </button>
              ))}
            </div>

            {/* Custom numeric factor input with action triggers */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="custom-factor" className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                Factor Personalizado
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-factor"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Ej: 1.5"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="flex-grow px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition duration-200 cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
            </div>

            {multiplier !== 1 && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full mt-4 text-emerald-600 hover:text-emerald-700 font-bold text-xs py-1 hover:underline text-center cursor-pointer"
              >
                Restablecer original
              </button>
            )}
          </div>

          {/* Caloric balance scaled display box */}
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center text-left">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-100 leading-none mb-1">
                  Calorías Totales Escalas
                </p>
                <h3 className="text-3xl font-extrabold leading-none">
                  {Math.round(recipe.calories * multiplier)} <span className="text-sm font-semibold">kcal</span>
                </h3>
                {multiplier !== 1 && (
                  <p className="text-[10px] text-emerald-100/80 mt-1">
                    Base: {recipe.calories} kcal × {multiplier} ración(es).
                  </p>
                )}
              </div>
              <span className="material-symbols-outlined text-4xl text-emerald-200 opacity-60 select-none">
                nutrition
              </span>
            </div>
          </div>

        </aside>

        {/* Main Ingredients detail presentation card layout */}
        <section className="lg:col-span-8 space-y-6">

          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm text-left">
            <div className="flex justify-between items-baseline mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 select-text">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Ingredientes Pautados</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg">
                Mostrando <span className="font-extrabold text-slate-900 dark:text-white">{multiplier}</span> ración(es)
              </span>
            </div>

            {/* Selector de categorías de ingredientes (si hay más de una) */}
            {activeIngCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-5 select-none bg-slate-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-slate-100 dark:border-zinc-800/60 w-max max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedIngCategory("Todo")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedIngCategory === "Todo"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-450 hover:bg-white dark:hover:bg-zinc-900"
                    }`}
                >
                  Todo
                </button>
                {activeIngCategories.map((catKey) => (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedIngCategory(catKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedIngCategory === catKey
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-450 hover:bg-white dark:hover:bg-zinc-900"
                      }`}
                  >
                    {categoryNames[catKey] || catKey}
                  </button>
                ))}
              </div>
            )}

            <ul className="space-y-3">
              {displayedIngredients.map((ni, i) => {
                const ing = ni.item;
                const catKey = ni.categoryKey;
                const baseAmt = ing.originalAmount;
                const scaledAmt = baseAmt * multiplier;
                const hasChanged = multiplier !== 1;
                const isChecked = !!checkedIngredients[ing.name];

                return (
                  <li
                    key={i}
                    onClick={() => setCheckedIngredients(prev => ({ ...prev, [ing.name]: !prev[ing.name] }))}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all duration-150 border cursor-pointer select-none ${isChecked
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/20 opacity-80"
                      : "bg-slate-50/70 hover:bg-slate-50 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/75 border-transparent hover:border-emerald-600/10"
                      }`}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {isChecked ? (
                        <span className="material-symbols-outlined text-emerald-600 text-[18px] shrink-0 font-black">
                          check_circle
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-[18px] shrink-0 font-bold hover:text-emerald-500">
                          circle
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className={`font-semibold text-sm md:text-base ${isChecked
                          ? "line-through text-slate-400 dark:text-zinc-500"
                          : "text-slate-800 dark:text-zinc-200"
                          }`}>
                          {ing.name.charAt(0).toUpperCase() + ing.name.slice(1)}
                          {ing.preparation && (
                            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-450 italic ml-1.5 font-sans">
                              ({ing.preparation})
                            </span>
                          )}
                        </span>
                        {ing.category && (
                          <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider border px-1.5 py-0.5 rounded-md shrink-0 ${getIngredientCategoryClass(ing.category)}`}>
                            <span className="material-symbols-outlined leading-none shrink-0" style={{ fontSize: '16px' }}>
                              {getIngredientCategoryIcon(ing.category)}
                            </span>
                            {getFriendlyIngredientCategory(ing.category)}
                          </span>
                        )}
                        {selectedIngCategory === "Todo" && activeIngCategories.length > 1 && (
                          <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider bg-slate-200/60 dark:bg-zinc-800/80 text-slate-650 dark:text-zinc-400 px-2 py-0.5 rounded-md shrink-0">
                            {categoryNames[catKey] || catKey}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity parameters with weight displays if available */}
                    <div className="relative flex flex-col items-end group/tooltip">
                      <span className={`text-sm md:text-base font-extrabold transition duration-300 ${isChecked
                        ? "text-slate-400 dark:text-zinc-500 line-through"
                        : hasChanged
                          ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/35 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-900/45"
                          : "text-slate-900 dark:text-zinc-100"
                        }`}>
                        {ing.secondaryAmount && ing.secondaryUnit ? (
                          <>
                            {formatQuantity(ing.secondaryAmount * multiplier)} {ing.secondaryUnit}
                            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 ml-1.5 font-sans">
                              ({formatQuantity(scaledAmt)} {ing.unit})
                            </span>
                          </>
                        ) : (
                          <>{formatQuantity(scaledAmt)} {ing.unit}</>
                        )}
                      </span>

                      {/* Tooltip containing original baseline units */}
                      {hasChanged && (
                        <div className="absolute right-0 bottom-full mb-2 pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 z-30 select-none">
                          <div className="bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-md whitespace-nowrap border dark:border-zinc-800">
                            Base: <span className="font-bold">{baseAmt} {ing.unit}</span>
                          </div>
                          <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 mx-auto -mt-1 block"></div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Nutrition tip card box */}
            {recipe.tips && (
              <div className="mt-8 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100/45 dark:border-emerald-900/40 flex gap-3">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 select-none shrink-0">
                  lightbulb
                </span>
                <div className="text-left select-all">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-0.5 animate-pulse">
                    Consejo del Nutricionista
                  </h4>
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {recipe.tips}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Meticulous Culinary Step-by-Step Instructions */}
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl border border-slate-200/50 dark:border-zinc-800 shadow-sm text-left">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 select-none">
              <span className="material-symbols-outlined text-emerald-600">restaurant_menu</span>
              Preparación Meticulosa Paso a Paso
            </h3>

            {/* Selector de categorías de preparación (si hay más de una) */}
            {activeStepCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-5 select-none bg-slate-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-slate-100 dark:border-zinc-800/60 w-max max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedStepCategory("Todo")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedStepCategory === "Todo"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-450 hover:bg-white dark:hover:bg-zinc-900"
                    }`}
                >
                  Todo
                </button>
                {activeStepCategories.map((catKey) => (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedStepCategory(catKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedStepCategory === catKey
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-450 hover:bg-white dark:hover:bg-zinc-900"
                      }`}
                  >
                    {categoryNames[catKey] || catKey}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {displayedSteps.map((ns, idx) => {
                const stepText = ns.text;
                const catKey = ns.categoryKey;
                const isChecked = !!checkedSteps[stepText];
                return (
                  <div
                    key={idx}
                    onClick={() => setCheckedSteps(prev => ({ ...prev, [stepText]: !prev[stepText] }))}
                    className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-150 cursor-pointer select-none border ${isChecked
                      ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/20 opacity-80"
                      : "bg-slate-50/70 hover:bg-slate-50 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/75 border-transparent hover:border-emerald-600/10"
                      }`}
                  >
                    <div className="flex items-center justify-center shrink-0 select-none">
                      {isChecked ? (
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black material-symbols-outlined">
                          check
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-zinc-700 text-emerald-800 dark:text-zinc-200 flex items-center justify-center text-xs font-extrabold">
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    <div className="text-left flex-1 select-all">
                      {selectedStepCategory === "Todo" && activeStepCategories.length > 1 && (
                        <div className="mb-1">
                          <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-450 px-2 py-0.5 rounded-md">
                            {categoryNames[catKey] || catKey}
                          </span>
                        </div>
                      )}
                      <p className={`text-sm md:text-base leading-relaxed ${isChecked
                        ? "line-through text-slate-400 dark:text-zinc-500"
                        : "text-slate-700 dark:text-zinc-300"
                        }`}>
                        {stepText}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </section>

      </div>
    </div>
  );
}
