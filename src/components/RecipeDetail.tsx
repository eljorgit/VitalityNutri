import React, { useState } from "react";
import { DayType, MealType, Recipe, MealPlan, PlanMetadata } from "../types";
import ConfirmationModal from "./ConfirmationModal";
import ImagePlaceholder from "./ImagePlaceholder";

const formatAmountAndUnit = (amount: number, unit: string) => {
  let normalizedUnit = unit.trim().toLowerCase();
  let val = amount;
  
  if (normalizedUnit === "mg" || normalizedUnit === "mgs" || normalizedUnit === "miligramo" || normalizedUnit === "miligramos") {
    val = val / 1000;
    normalizedUnit = "g";
  }
  
  if ((normalizedUnit === "g" || normalizedUnit === "gr" || normalizedUnit === "grs" || normalizedUnit === "gramo" || normalizedUnit === "gramos") && val >= 1000) {
    val = val / 1000;
    normalizedUnit = "kg";
  }
  
  let displayUnit = unit;
  if (normalizedUnit === "g") {
    displayUnit = "g";
  } else if (normalizedUnit === "kg") {
    displayUnit = "kg";
  }
  
  return {
    amount: Math.round(val * 100) / 100,
    unit: displayUnit
  };
};

interface RecipeDetailProps {
  day?: DayType;
  meal?: MealType;
  recipe: Recipe;
  onGoBack: () => void;
  onUpdateRecipeOnServer?: (day: DayType, meal: MealType, updatedRecipe: Recipe) => void;
  plan?: MealPlan | null;
  metadata?: PlanMetadata | null;
  onNavigate?: (day: DayType, meal: MealType, recipe: Recipe) => void;
  completedRecipes?: Record<string, boolean>;
  onToggleComplete?: (day: DayType, meal: MealType) => void;
  onToggleDayComplete?: (day: DayType, meals: MealType[], targetState: boolean) => void;
  isPlanActive?: boolean;
  onRestorePlan?: () => void;
  activePlan?: MealPlan | null;
  onNavigateActive?: (day: DayType, meal: MealType, recipe: Recipe) => void;
  mode?: "standard" | "recetario";
  onEdit?: (recipe: Recipe) => void;
  onDelete?: (recipe: Recipe) => void;
}

export default function RecipeDetail({
  day,
  meal,
  recipe,
  onGoBack,
  onUpdateRecipeOnServer,
  plan,
  metadata,
  onNavigate,
  completedRecipes = {},
  onToggleComplete,
  onToggleDayComplete,
  isPlanActive = true,
  onRestorePlan,
  activePlan,
  onNavigateActive,
  mode = "standard",
  onEdit,
  onDelete,
}: RecipeDetailProps) {
  const searchParams = new URLSearchParams(window.location.search);
  const isFromBatchCooking = searchParams.get("from") === "batch-cooking";
  const backLabel = mode === "recetario"
    ? "Volver al Recetario"
    : isFromBatchCooking
      ? "Volver a Batch Cooking"
      : "Volver al Calendario";

  // Ratio defaults to 1 ración (base)
  const [multiplier, setMultiplier] = useState<number>(1);
  const [customInput, setCustomInput] = useState<string>("1");
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [showDayMealsDropdown, setShowDayMealsDropdown] = useState<boolean>(false);
  const [showAllRecipesDropdown, setShowAllRecipesDropdown] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>(recipe.image || "");
  const [imageError, setImageError] = useState<boolean>(false);

  const handleImageError = async () => {
    if (imageError) return;
    setImageError(true);
    try {
      console.log(`[RecipeDetail] Image failed to load: ${imageUrl}. Reporting to server...`);
      const res = await fetch("/api/recipes/report-broken-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.recipeName,
          day,
          meal,
          planId: metadata?.id,
          recipeId: recipe.id,
          brokenUrl: imageUrl
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.newImageUrl) {
          console.log(`[RecipeDetail] Hot-swapping broken image with: ${data.newImageUrl}`);
          setImageUrl(data.newImageUrl);
          setImageError(false);
          if (day && meal && onUpdateRecipeOnServer) {
            onUpdateRecipeOnServer(day, meal, { ...recipe, image: data.newImageUrl });
          }
        }
      }
    } catch (error) {
      console.error("Error reporting broken image:", error);
    }
  };

  const [isFav, setIsFav] = useState<boolean>(!!recipe.isFavorite);
  // Always work by ID. Recipes that arrive without an id (e.g. from weekly plan)
  // resolve their DB id once via the favorite-status endpoint and cache it here.
  const resolvedFavId = React.useRef<number | null>(recipe.id ?? null);

  React.useEffect(() => {
    resolvedFavId.current = recipe.id ?? null;
    setIsFav(!!recipe.isFavorite);

    const fetchFavoriteStatus = async () => {
      try {
        if (!resolvedFavId.current) return;
        const res = await fetch(`/api/recipes/favorite-status?id=${resolvedFavId.current}`);
        if (res.ok) {
          const data = await res.json();
          setIsFav(!!data.isFavorite);
          // Cache the resolved id so all future requests use it
          if (data.id) {
            resolvedFavId.current = data.id;
          }
        }
      } catch (err) {
        console.error("Error fetching favorite status:", err);
      }
    };

    fetchFavoriteStatus();
  }, [recipe]);

  const handleFavoriteToggle = async () => {
    const previous = isFav;
    setIsFav(!previous);
    try {
      const favId = resolvedFavId.current;
      if (!favId) {
        // Recipe not in the recipe book yet — nothing to toggle
        setIsFav(previous);
        return;
      }
      const res = await fetch(`/api/recipes/${favId}/toggle-favorite`, {
        method: "PUT"
      });
      if (res.ok) {
        const data = await res.json();
        setIsFav(!!data.isFavorite);
      } else {
        throw new Error();
      }
    } catch (e) {
      console.error("Error toggling favorite inside RecipeDetail:", e);
      setIsFav(previous);
    }
  };

  // Mobile Drawer settings state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [drawerContent, setDrawerContent] = useState<'adjust' | 'share'>('adjust');

  // Swipe gesture detection state
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState<boolean>(false);

  const topDayMealsDropdownRef = React.useRef<HTMLDivElement>(null);
  const topAllRecipesDropdownRef = React.useRef<HTMLDivElement>(null);
  const bottomDayMealsDropdownRef = React.useRef<HTMLDivElement>(null);
  const bottomAllRecipesDropdownRef = React.useRef<HTMLDivElement>(null);
  const servingsPanelRef = React.useRef<HTMLDivElement>(null);
  const [highlightServings, setHighlightServings] = useState<boolean>(false);

  const getPlanMatches = () => {
    const targetPlan = activePlan || plan;
    if (!targetPlan || !targetPlan.days) return [];
    const matches: { day: DayType; meal: MealType; label: string }[] = [];
    const orderedDays: DayType[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const orderedMeals: MealType[] = ["desayuno", "almuerzo", "merienda", "cena"];

    orderedDays.forEach(d => {
      orderedMeals.forEach(m => {
        const r = targetPlan.days[d]?.[m];
        if (
          r &&
          ((r.id !== undefined && r.id !== null && recipe.id !== undefined && recipe.id !== null && r.id === recipe.id) ||
           ((r.id === undefined || r.id === null || recipe.id === undefined || recipe.id === null) &&
            r.recipeName &&
            recipe.recipeName &&
            r.recipeName.trim().toLowerCase() === recipe.recipeName.trim().toLowerCase()))
        ) {
          matches.push({
            day: d,
            meal: m,
            label: `${dayNames[d] || d} (${mealNames[m] || m})`
          });
        }
      });
    });
    return matches;
  };

  const renderPlanMatches = () => {
    const matches = getPlanMatches();
    return (
      <div className="bg-white/40 dark:bg-zinc-900/40 p-5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs text-left space-y-3">
        <h2 className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider select-none">
          <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[18px]">calendar_today</span>
          Coincidencias del Menú
        </h2>
        {matches.length > 0 ? (
          <>
            <p className="text-[11px] text-slate-550 dark:text-zinc-400 leading-relaxed">
              Esta receta está asignada en tu planificación de esta semana. Haz clic para ver el seguimiento:
            </p>
            <div className="flex flex-col gap-2 pt-1 select-none">
              {matches.map((match, idx) => {
                const isCompleted = completedRecipes ? !!completedRecipes[`${match.day}-${match.meal}`] : false;
                return (
                  <div
                    key={idx}
                    className="w-full flex items-center justify-between gap-2.5 py-2 px-3 rounded-xl bg-indigo-50/55 hover:bg-indigo-100/40 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20 border border-indigo-100/35 dark:border-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition duration-150"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateActive) {
                          onNavigateActive(match.day, match.meal, recipe);
                        } else if (onNavigate) {
                          onNavigate(match.day, match.meal, recipe);
                        }
                      }}
                      className="flex-grow text-left cursor-pointer flex items-center justify-between group"
                    >
                      <span>{match.label}</span>
                      <span className="material-symbols-outlined text-[15px] transform group-hover:translate-x-0.5 transition-transform mr-2">arrow_forward</span>
                    </button>
                    {onToggleComplete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(match.day, match.meal);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer flex items-center gap-1 transition ${
                          isCompleted
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-white hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-750 text-slate-650 dark:text-zinc-305"
                        }`}
                        title={isCompleted ? "Marcar como pendiente" : "Completar para este día"}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isCompleted ? "task_alt" : "circle"}
                        </span>
                        <span>{isCompleted ? "Realizada" : "Completar"}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400 dark:text-zinc-550 leading-relaxed italic">
            Esta receta no está planificada en el menú semanal actual.
          </p>
        )}
      </div>
    );
  };

  const daysKeys: DayType[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const mealsKeys: MealType[] = ["desayuno", "almuerzo", "merienda", "cena"];

  const mealLabels: Record<MealType, string> = {
    desayuno: "Desayuno",
    almuerzo: "Almuerzo",
    merienda: "Merienda",
    cena: "Cena",
  };

  const getCurrentWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayVal = new Date(today);
    mondayVal.setDate(today.getDate() + distanceToMonday);

    const datesMap: Record<DayType, { short: string; long: string; num: number; isToday: boolean; dateString: string }> = {} as any;
    const dayKeys: DayType[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const labels = {
      lunes: { short: "LUN", long: "Lunes" },
      martes: { short: "MAR", long: "Martes" },
      miercoles: { short: "MIÉ", long: "Miércoles" },
      jueves: { short: "JUE", long: "Jueves" },
      viernes: { short: "VIE", long: "Viernes" },
      sabado: { short: "SÁB", long: "Sábado" },
      domingo: { short: "DOM", long: "Domingo" }
    };

    const monthNames = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    dayKeys.forEach((key, idx) => {
      const current = new Date(mondayVal);
      current.setDate(mondayVal.getDate() + idx);
      
      const num = current.getDate();
      const month = monthNames[current.getMonth()];
      
      const isToday =
        current.getDate() === today.getDate() &&
        current.getMonth() === today.getMonth() &&
        current.getFullYear() === today.getFullYear();

      datesMap[key] = {
        short: labels[key].short,
        long: labels[key].long,
        num: num,
        dateString: `${num} de ${month}`,
        isToday
      };
    });

    return { datesMap };
  };

  const { datesMap } = getCurrentWeekDates();

  const getUpcomingMeal = (): { day: DayType; meal: MealType } => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const hour = today.getHours();

    const daysMap: DayType[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const currentDay = daysMap[dayOfWeek];

    let meal: MealType = "desayuno";
    let targetDay = currentDay;

    if (hour < 11) {
      meal = "desayuno";
    } else if (hour < 15) {
      meal = "almuerzo";
    } else if (hour < 19) {
      meal = "merienda";
    } else if (hour < 22) {
      meal = "cena";
    } else {
      meal = "desayuno";
      const tomorrowIndex = (dayOfWeek + 1) % 7;
      targetDay = daysMap[tomorrowIndex];
    }

    const safeDay = (targetDay === "domingo" ? "domingo" : targetDay) as DayType;
    return { day: safeDay, meal };
  };

  const upcomingMeal = getUpcomingMeal();

  // Scroll lock effect when drawer or progress modal is open
  React.useEffect(() => {
    if (isDrawerOpen || showProgressModal) {
      document.body.classList.add("modal-open");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen, showProgressModal]);

  // Close navigation panels when clicking outside of them
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const clickedOutsideDayMeals = 
        (!topDayMealsDropdownRef.current || !topDayMealsDropdownRef.current.contains(event.target as Node)) &&
        (!bottomDayMealsDropdownRef.current || !bottomDayMealsDropdownRef.current.contains(event.target as Node));

      if (clickedOutsideDayMeals) {
        setShowDayMealsDropdown(false);
      }

      const clickedOutsideAllRecipes = 
        (!topAllRecipesDropdownRef.current || !topAllRecipesDropdownRef.current.contains(event.target as Node)) &&
        (!bottomAllRecipesDropdownRef.current || !bottomAllRecipesDropdownRef.current.contains(event.target as Node));

      if (clickedOutsideAllRecipes) {
        setShowAllRecipesDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
    setTouchEndX(null);
    setTouchEndY(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null || touchStartY === null || touchEndY === null) return;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    // Horizontal swipe must exceed vertical movement and threshold (60px)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      if (diffX > 0) {
        // Swiped Left -> Next Recipe
        if (activeRecipes.length > 1 && onNavigate) {
          const nextIdx = (currentIndex + 1) % activeRecipes.length;
          onNavigate(activeRecipes[nextIdx].day, activeRecipes[nextIdx].meal, activeRecipes[nextIdx].recipe);
        }
      } else {
        // Swiped Right -> Previous Recipe
        if (activeRecipes.length > 1 && onNavigate) {
          const prevIdx = (currentIndex - 1 + activeRecipes.length) % activeRecipes.length;
          onNavigate(activeRecipes[prevIdx].day, activeRecipes[prevIdx].meal, activeRecipes[prevIdx].recipe);
        }
      }
    }
  };

  // Sharing states
  const [shareFullRecipe, setShareFullRecipe] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedKeep, setCopiedKeep] = useState<boolean>(false);
  const [canShare, setCanShare] = useState<boolean>(false);

  React.useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.share) {
      setCanShare(true);
    }
  }, []);

  const getRecipeUrl = (): string => {
    if (mode === "recetario") {
      return `${window.location.protocol}//${window.location.host}/recipe-book/recipe/${recipe.id}`;
    }
    const meta = metadata || (plan as any)?.metadata;
    const getVersionBuster = () => {
      if (meta?.id) return meta.id;
      if (meta?.processedAt) {
        return new Date(meta.processedAt).getTime();
      }
      return "1";
    };
    return `${window.location.protocol}//${window.location.host}/recipe/${day}/${meal}?v=${getVersionBuster()}`;
  };

  const generateRecipeShareText = (): string => {
    const capitalizedDay = day ? day.charAt(0).toUpperCase() + day.slice(1) : "";
    const capitalizedMeal = meal ? meal.charAt(0).toUpperCase() + meal.slice(1) : "";
    const recipeUrl = getRecipeUrl();

    if (!shareFullRecipe) {
      if (mode === "recetario") {
        return `🍳 *${recipe.recipeName}*\n\nDescubre esta deliciosa receta saludable en el Recetario de VitalityNutri:\n🔗 ${recipeUrl}\n\n¡Buen provecho! 🌱`;
      }
      return `🍳 *${recipe.recipeName}* (${capitalizedMeal} - ${capitalizedDay})\n\nDescubre esta deliciosa receta saludable planificada en VitalityNutri:\n🔗 ${recipeUrl}\n\n¡Buen provecho! 🌱`;
    }

    let text = `🍳 *RECETA: ${recipe.recipeName.toUpperCase()}*\n`;
    if (mode === "recetario") {
      text += `📅 *Planificación:* Recetario\n`;
    } else {
      text += `📅 *Planificación:* ${capitalizedMeal} de ${capitalizedDay}\n`;
    }
    text += `⏱️ *Tiempo:* ${recipe.time || "20 min"}\n`;
    text += `🔥 *Calorías:* ${Math.round(recipe.calories * multiplier)} kcal (${multiplier} ración/es)\n`;
    text += `🏷️ *Categoría:* ${recipe.tag || "Nutritivo"}\n\n`;

    // Add ingredients
    text += `🛒 *INGREDIENTES:* \n`;
    const flatIngs = Array.isArray(recipe.ingredients)
      ? (recipe.ingredients as any[])
      : (Object.values(recipe.ingredients || {}).flat().filter(Boolean) as any[]);

    if (flatIngs.length > 0) {
      flatIngs.forEach((ing: any) => {
        const baseAmt = ing.originalAmount;
        const scaledAmt = baseAmt * multiplier;
        
        let amountText = "";
        if (ing.secondaryAmount && ing.secondaryUnit) {
          const secFormatted = formatAmountAndUnit(ing.secondaryAmount * multiplier, ing.secondaryUnit);
          const priFormatted = formatAmountAndUnit(scaledAmt, ing.unit);
          amountText = `${secFormatted.amount} ${secFormatted.unit} (${priFormatted.amount} ${priFormatted.unit})`;
        } else {
          const priFormatted = formatAmountAndUnit(scaledAmt, ing.unit);
          amountText = `${priFormatted.amount} ${priFormatted.unit}`;
        }
        
        text += `- ⬜ ${ing.name.charAt(0).toUpperCase() + ing.name.slice(1)} (${amountText})${ing.preparation ? ` - _${ing.preparation}_` : ""}\n`;
      });
    } else {
      text += `(Sin ingredientes especificados)\n`;
    }
    text += `\n`;

    // Add steps
    text += `👨‍🍳 *PREPARACIÓN:* \n`;
    const stepsList = normalizedSteps.length > 0 ? normalizedSteps : [];
    if (stepsList.length > 0) {
      stepsList.forEach((ns, index) => {
        text += `${index + 1}. ${ns.text}\n\n`;
      });
    } else {
      text += `Sigue las instrucciones estándar para esta preparación.\n\n`;
    }

    if (recipe.tips) {
      text += `💡 *Consejo:* ${recipe.tips}\n\n`;
    }

    text += `🔗 *Ver en la web:* ${recipeUrl}\n\n`;
    text += `Generado por VitalityNutri 🌱`;
    
    return text;
  };

  const handleCopyToClipboard = async () => {
    const text = shareFullRecipe ? generateRecipeShareText() : getRecipeUrl();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Error al copiar al portapapeles: ", err);
    }
  };

  const handleShareWhatsApp = () => {
    const text = generateRecipeShareText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleShareTelegram = () => {
    const text = generateRecipeShareText();
    const url = `https://t.me/share/url?url=${encodeURIComponent(getRecipeUrl())}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleShareInstagram = async () => {
    const text = generateRecipeShareText();
    try {
      await navigator.clipboard.writeText(text);
      window.open("https://www.instagram.com/", "_blank");
    } catch (err) {
      console.error("Error al copiar para Instagram: ", err);
    }
  };

  const handleExportToKeep = async () => {
    const text = generateRecipeShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeep(true);
      setTimeout(() => setCopiedKeep(false), 3000);
      window.open("https://keep.new", "_blank");
    } catch (err) {
      console.error("Error al copiar para Google Keep: ", err);
    }
  };

  const handleNativeShare = async () => {
    const text = generateRecipeShareText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receta: ${recipe.recipeName}`,
          text: text
        });
      } catch (err) {
        console.error("Error al usar Web Share: ", err);
      }
    }
  };

  const handleSetPreset = (factor: number) => {
    setMultiplier(factor);
    setCustomInput(factor.toString());
  };

  const handleApplyCustom = () => {
    const val = parseFloat(customInput);
    if (!isNaN(val) && val > 0) {
      setMultiplier(val);
    }
  };

  const handleReset = () => {
    setMultiplier(1);
    setCustomInput("1");
  };

  const handleHighlightServings = () => {
    if (window.innerWidth < 1024) {
      setDrawerContent('adjust');
      setIsDrawerOpen(true);
    } else {
      setHighlightServings(true);
      if (servingsPanelRef.current) {
        servingsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => {
        setHighlightServings(false);
      }, 2000);
    }
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

  const activePlanRecipes: { day: DayType; meal: MealType; recipe: Recipe }[] = [];
  const planForNextMeal = isPlanActive ? plan : activePlan;
  if (planForNextMeal) {
    orderedDays.forEach((d) => {
      orderedMeals.forEach((m) => {
        const r = planForNextMeal.days[d]?.[m];
        if (r) {
          activePlanRecipes.push({ day: d, meal: m, recipe: r });
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
    if (activePlanRecipes.length === 0) return null;

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

    let bestMatch = activePlanRecipes.find(item => getSequenceValue(item.day, item.meal) >= targetWeight);
    if (!bestMatch) {
      bestMatch = activePlanRecipes[0];
    }
    return bestMatch;
  };

  const nextMeal = mode === "recetario" ? null : getNextMealRecipe();
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

  const syncCategory = (cat: string) => {
    setSelectedIngCategory(cat);
    setSelectedStepCategory(cat);
  };

  React.useEffect(() => {
    setSelectedIngCategory("Todo");
    setSelectedStepCategory("Todo");
    setCheckedIngredients({});
    setCheckedSteps({});
    setImageUrl(recipe.image || "");
    setImageError(false);
  }, [recipe, day, meal]);

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
        return "bg-amber-50 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/40";
      case "pescados y mariscos":
        return "bg-cyan-50 dark:bg-cyan-950/35 text-cyan-700 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/40";
      case "lácteos y bebidas":
        return "bg-blue-50 dark:bg-blue-950/35 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/40";
      case "granos, harinas y semillas":
        return "bg-yellow-50/50 dark:bg-yellow-950/35 text-yellow-700 dark:text-yellow-400 border-yellow-100/70 dark:border-yellow-900/40";
      case "despensa y condimentos":
        return "bg-orange-50 dark:bg-orange-950/35 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/40";
      default:
        return "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700";
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

  const isRecipeCompleted = day && meal && completedRecipes ? !!completedRecipes[`${day}-${meal}`] : false;
  const weeklyStats = (() => {
    if (!plan || !completedRecipes || mode === "recetario") return { completed: 0, total: 0, percentage: 0 };
    let completed = 0;
    let total = 0;
    const daysKeys: DayType[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    const mealsKeys: MealType[] = ["desayuno", "almuerzo", "merienda", "cena"];
    daysKeys.forEach((d) => {
      mealsKeys.forEach((m) => {
        if (plan.days[d]?.[m]) {
          total++;
          if (completedRecipes[`${d}-${m}`]) {
            completed++;
          }
        }
      });
    });
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  })();

  const renderCompletionPanel = () => {
    const matches = getPlanMatches();
    const singleMatch = matches.length === 1 ? matches[0] : null;
    
    const targetDay = day || (singleMatch ? singleMatch.day : null);
    const targetMeal = meal || (singleMatch ? singleMatch.meal : null);

    if (!targetDay || !targetMeal || !onToggleComplete) return null;
    if (mode === "recetario" && matches.length !== 1) return null;

    const isCompleted = completedRecipes ? !!completedRecipes[`${targetDay}-${targetMeal}`] : false;

    return (
      <div className="bg-white/40 dark:bg-zinc-900/40 p-5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs text-left space-y-4">
        <h2 className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider select-none">
          <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">
            {isCompleted ? "check_circle" : "radio_button_unchecked"}
          </span>
          {mode === "recetario" ? `Estado para ${dayNames[targetDay]} (${mealNames[targetMeal]})` : "Estado de la Receta"}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
          {mode === "recetario" 
            ? `Marca esta receta como completada para el día ${dayNames[targetDay]} en tu planificación activa.`
            : "Marca esta receta como realizada para registrar tu constancia dietética semanal."}
        </p>

        <button
          type="button"
          onClick={() => onToggleComplete(targetDay, targetMeal)}
          className={`w-full py-3 font-extrabold text-sm rounded-xl transition duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] ${
            isCompleted
              ? "bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 hover:border-emerald-700"
              : "bg-white hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-700/50"
          }`}
        >
          <span className="w-5 h-5 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">
              {isCompleted ? "task_alt" : "circle"}
            </span>
          </span>
          <span>{isCompleted ? "Completada" : "Marcar como completada"}</span>
        </button>

        {/* Weekly progress summary bar */}
        <div 
          onClick={() => setShowProgressModal(true)}
          className="pt-2 border-t border-zinc-200/40 dark:border-zinc-800/60 cursor-pointer hover:opacity-80 transition duration-200 group/weekly"
          title="Haz clic para ver el progreso semanal de recetas y marcarlas"
        >
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5 select-none">
            <span className="group-hover/weekly:text-emerald-700 dark:group-hover/weekly:text-emerald-400 transition-colors">Completadas esta Semana</span>
            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">{weeklyStats.completed} de {weeklyStats.total} ({weeklyStats.percentage}%)</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${weeklyStats.percentage}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  const renderHistoricalWarning = () => {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/40 rounded-2xl p-5 text-left">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 text-[22px] shrink-0 mt-0.5">history</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">Plan Histórico</h3>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Esta receta pertenece a un plan anterior. Puedes consultar todos los detalles, ajustar raciones y compartirla, pero no podrás marcarla como completada.
            </p>
            {onRestorePlan && (
              <button
                type="button"
                onClick={() => setShowRestoreConfirmation(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-800/50 border border-amber-300/60 dark:border-amber-700/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">restore</span>
                Restaurar plan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSidebarContent = (showOnly?: 'adjust' | 'share') => {
    const showAdjust = !showOnly || showOnly === 'adjust';
    const showShare = !showOnly || showOnly === 'share';
    return (
      <div className="space-y-6">
        {/* Progreso Semanal / Completar Receta Panel */}
        {showAdjust && !showOnly && (
          mode === "recetario" ? (
            <div className="space-y-6">
              {renderPlanMatches()}
              {renderCompletionPanel()}
            </div>
          ) : (
            isPlanActive ? renderCompletionPanel() : renderHistoricalWarning()
          )
        )}

        {/* Raciones Ajustables */}
        <div 
          ref={showOnly ? undefined : servingsPanelRef}
          className={`transition-all duration-500 p-5 rounded-2xl border text-left ${showAdjust ? "" : "hidden"} ${
            highlightServings 
              ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-500 ring-4 ring-emerald-500/25 dark:ring-emerald-500/30 scale-[1.03] shadow-md shadow-emerald-500/10" 
              : "bg-white/40 dark:bg-zinc-900/40 border-zinc-200/50 dark:border-zinc-800/50 shadow-xs"
          }`}
        >
          <h2 className="text-xs font-black text-slate-800 dark:text-zinc-200 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">calculate</span>
            Raciones Ajustables
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">
            Ajusta las raciones para toda la familia. Las cantidades de los ingredientes se recalcularán al instante.
          </p>

          <div className="space-y-4">
            {/* Presets Grid */}
            <div className="bg-zinc-100/85 dark:bg-zinc-950/45 p-1 rounded-xl border border-zinc-200/30 dark:border-zinc-800/40 grid grid-cols-4 gap-1 select-none">
              {[1, 2, 3, 4].map((factor) => {
                const isActive = multiplier === factor;
                return (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => handleSetPreset(factor)}
                    className={`py-1.5 rounded-lg text-xs font-black transition duration-200 cursor-pointer ${isActive
                      ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/10"
                      : "bg-white/90 hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/40"
                      }`}
                  >
                    x{factor}
                  </button>
                );
              })}
            </div>

            {/* Custom factor control */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between select-none">
                <label htmlFor="custom-factor" className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
                  Personalizar
                </label>
                {multiplier !== 1 && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-bold text-[10px] hover:underline cursor-pointer transition-all duration-150"
                  >
                    Resetear
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between gap-2.5 bg-zinc-100/60 dark:bg-zinc-950/40 p-2 rounded-xl border border-zinc-200/40 dark:border-zinc-800/50 w-full shadow-inner-sm">
                <button
                  type="button"
                  onClick={() => {
                    const newMult = Math.max(0.5, Math.round((multiplier - 0.5) * 10) / 10);
                    setMultiplier(newMult);
                    setCustomInput(newMult.toString());
                  }}
                  className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-800/60 flex items-center justify-center font-black text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-slate-700 dark:text-zinc-300 shadow-sm active:scale-95 transition-all"
                >
                  -
                </button>
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200/40 dark:border-zinc-800 rounded-lg px-3 py-1.5 flex-1 shadow-sm justify-center">
                  <span className="text-[11px] font-bold text-zinc-400 select-none">x</span>
                  <input
                    id="custom-factor"
                    type="number"
                    step="0.5"
                    min="0.5"
                    className="w-full text-xs font-black text-emerald-600 dark:text-emerald-400 text-center bg-transparent focus:outline-none focus:ring-0 border-none p-0"
                    value={customInput}
                    onChange={(e) => {
                      setCustomInput(e.target.value);
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0.5) {
                        setMultiplier(val);
                      }
                    }}
                  />
                  <span className="text-[10px] font-bold text-zinc-400 select-none">
                    {multiplier === 1 ? "ración" : "raciones"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newMult = Math.round((multiplier + 0.5) * 10) / 10;
                    setMultiplier(newMult);
                    setCustomInput(newMult.toString());
                  }}
                  className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200/55 dark:border-zinc-800/60 flex items-center justify-center font-black text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-slate-700 dark:text-zinc-300 shadow-sm active:scale-95 transition-all"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Caloric balance scaled display box */}
        <div className={`bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-md border border-emerald-400/10 shadow-emerald-500/5 ${showAdjust ? "" : "hidden"}`}>
          <div className="flex justify-between items-center text-left">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-emerald-100/90 leading-none mb-1.5">
                Valor Calórico Ajustado
              </p>
              <h3 className="text-3xl font-extrabold leading-none">
                {Math.round(recipe.calories * multiplier)} <span className="text-sm font-semibold">kcal</span>
              </h3>
              {multiplier !== 1 && (
                <p className="text-[10px] text-emerald-100/80 mt-1.5">
                  Base: {recipe.calories} kcal × {multiplier} ración(es).
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
              <span className="material-symbols-outlined text-emerald-100 text-2xl select-none">
                nutrition
              </span>
            </div>
          </div>
        </div>

        {/* Compartir Receta Panel */}
        <div className={`bg-white/40 dark:bg-zinc-900/40 p-5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs space-y-4 no-print text-left ${showShare ? "" : "hidden"}`}>
          <h2 className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px]">share</span>
            Compartir Receta
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            Comparte esta prescripción nutricional o envíala a tus aplicaciones de notas preferidas.
          </p>

          {/* Checkbox selector */}
          <div className="bg-zinc-50/70 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-200/30 dark:border-zinc-800/40 select-none">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700 dark:text-zinc-300 relative group/tooltip flex-wrap">
              <input
                type="checkbox"
                checked={shareFullRecipe}
                onChange={(e) => setShareFullRecipe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer dark:bg-zinc-900 shrink-0"
              />
              <span className="flex items-center gap-1 font-semibold">
                Compartir receta completa
                <span className="material-symbols-outlined text-slate-400 dark:text-zinc-600 cursor-help" style={{ fontSize: "14px" }}>info</span>
              </span>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 shadow-md z-30 leading-normal font-medium text-center">
                Al activarlo se copiarán todos los ingredientes y preparación detallados. Si está inactivo, solo se compartirá el enlace.
              </span>
            </label>
          </div>

          {/* Export action triggers */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl transition duration-200 font-bold text-xs border border-slate-200/60 dark:border-zinc-700/50 shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-slate-500 dark:text-zinc-400 text-[16px]">
                {copied ? "check_circle" : "content_copy"}
              </span>
              <span>
                {copied 
                  ? (shareFullRecipe ? "Copiada" : "Copiado") 
                  : (shareFullRecipe ? "Copiar receta" : "Copiar enlace")}
              </span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 rounded-xl transition duration-200 font-bold text-xs border border-emerald-500/20 shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.437.002 9.861-4.416 9.863-9.864.001-2.639-1.02-5.12-2.874-6.978-1.855-1.857-4.327-2.88-6.967-2.881-5.439 0-9.865 4.42-9.867 9.867-.001 1.867.501 3.585 1.45 5.161l-.952 3.479 3.565-.936zm11.597-5.495c-.32-.16-1.89-.93-2.185-1.04-.294-.11-.51-.16-.723.16-.214.32-.827 1.04-1.013 1.252-.186.213-.372.24-.692.08-.32-.16-1.353-.5-2.577-1.6-.952-.85-1.594-1.9-1.782-2.22-.186-.32-.02-.492.14-.65.143-.142.32-.37.48-.557.16-.188.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.723-1.74-.99-2.39-.26-.63-.526-.54-.723-.55-.187-.01-.4-.01-.613-.01-.213 0-.56.08-.853.4-.293.32-1.118 1.1-1.118 2.68 0 1.58 1.15 3.11 1.31 3.32.16.21 2.263 3.456 5.482 4.848.765.33 1.362.528 1.826.674.77.244 1.47.21 2.02.128.618-.092 1.89-.77 2.157-1.48.266-.71.266-1.32.186-1.45-.08-.13-.294-.21-.614-.37z" />
              </svg>
              <span>WhatsApp</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareTelegram}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 dark:bg-[#229ED9]/15 dark:hover:bg-[#229ED9]/25 text-[#0e7ab8] dark:text-[#5bbfef] rounded-xl transition duration-200 font-bold text-xs border border-[#229ED9]/20 shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                <path d="M11.994 0C5.369 0 0 5.369 0 11.994S5.369 24 11.994 24 24 18.631 24 12.006C24 5.369 18.631 0 11.994 0zm5.935 8.17l-2.006 9.457c-.145.658-.537.818-1.086.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.06 14.549l-2.95-.924c-.641-.203-.654-.641.136-.95l11.533-4.448c.536-.194 1.004.131.16 4.194-.84 3.944z"/>
              </svg>
              <span>Telegram</span>
            </button>

            <button
              type="button"
              onClick={handleShareInstagram}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-[#E1306C]/10 hover:bg-[#E1306C]/20 dark:bg-[#E1306C]/15 dark:hover:bg-[#E1306C]/25 text-[#b5185a] dark:text-[#f06292] rounded-xl transition duration-200 font-bold text-xs border border-[#E1306C]/20 shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
              <span>Instagram</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportToKeep}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 rounded-xl transition duration-200 font-bold text-xs border border-amber-500/20 shadow-sm cursor-pointer active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-600 dark:text-amber-400">lightbulb</span>
              <span>{copiedKeep ? "Keep..." : "Google Keep"}</span>
            </button>

            {canShare && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-400 rounded-xl transition duration-200 font-bold text-xs border border-blue-500/20 shadow-sm cursor-pointer active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>Compartir</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMealNavigator = (isMobileSticky = false) => {
    if (mode === "recetario" || !isPlanActive || activeRecipes.length === 0) return null;

    const dayMealsRef = isMobileSticky ? bottomDayMealsDropdownRef : topDayMealsDropdownRef;
    const allRecipesRef = isMobileSticky ? bottomAllRecipesDropdownRef : topAllRecipesDropdownRef;

    return (
      <div className={`flex items-center gap-1.5 p-1.5 rounded-2xl relative shrink-0 transition-all duration-300 ${
        isMobileSticky
          ? "bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-lg scale-95"
          : "bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm"
      }`}>

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

        {/* 2. Texto del día actual y tipo de comida */}
        <div ref={dayMealsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setShowDayMealsDropdown(!showDayMealsDropdown);
              setShowAllRecipesDropdown(false);
            }}
            className="px-3 py-2 text-xs md:text-sm font-black text-slate-800 dark:text-zinc-100 uppercase tracking-tight hover:text-emerald-700 dark:hover:text-emerald-400 rounded-xl cursor-pointer transition flex items-center gap-1"
            title="Ver otras comidas de este día"
          >
            <span className="w-40 md:w-56 text-center truncate inline-block">
              {dayNames[day]} • <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{mealNames[meal]}</span>
            </span>
            <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-zinc-500">arrow_drop_down</span>
          </button>

          {showDayMealsDropdown && (
            <div className={`absolute left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl py-2.5 w-60 z-50 text-left ${
              isMobileSticky ? "bottom-full mb-2" : "top-full mt-2"
            }`}>
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
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-extrabold"
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
        <div ref={allRecipesRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setShowAllRecipesDropdown(!showAllRecipesDropdown);
              setShowDayMealsDropdown(false);
            }}
            className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center font-bold ${
              showAllRecipesDropdown
                ? "bg-slate-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400"
                : "text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
            }`}
            title="Mostrar todas las recetas"
          >
            <span className="material-symbols-outlined block text-[18px]">calendar_today</span>
          </button>

          {showAllRecipesDropdown && (
            <div className={`absolute right-[-45px] md:right-auto md:left-1/2 md:-translate-x-1/2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2.5xl shadow-xl p-3 sm:p-4 w-[300px] sm:w-[365px] z-50 text-left max-h-[85vh] overflow-y-auto ${
              isMobileSticky ? "bottom-full mb-2" : "top-full mt-2"
            }`}>
              <h4 className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-3.5 tracking-widest select-none text-center border-b border-slate-100 dark:border-zinc-800/60 pb-2">
                Prescripción Semanal
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {orderedDays.map((d) => {
                  const dayLabel = dayNames[d];
                  const isLast = d === "domingo";
                  const isCurrentDay = d === day;
                  const isToday = d === dayKeysInOrder[new Date().getDay()];
                  return (
                    <div 
                      key={d} 
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-between transition-all duration-200 ${
                        isToday 
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/30 dark:border-emerald-800/80 shadow-xs ring-1 ring-emerald-500/10 scale-[1.02]" 
                          : "bg-slate-50/50 dark:bg-zinc-800/25 border-slate-100 dark:border-zinc-800/40 hover:border-slate-200 dark:hover:border-zinc-700/50"
                      } ${
                        isLast ? "col-span-2" : "col-span-1"
                      }`}
                    >
                      <span className={`text-[10px] font-black mb-1.5 uppercase tracking-wider flex items-center gap-1 ${
                        isToday 
                          ? "text-emerald-700 dark:text-emerald-400" 
                          : "text-slate-700 dark:text-zinc-300"
                      }`}>
                        {dayLabel}
                        {isToday && (
                          <span className="text-[8px] font-black lowercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/20 px-1 py-0.5 rounded-sm select-none">
                            hoy
                          </span>
                        )}
                      </span>
                      <div className="flex gap-1 sm:gap-1.5 select-none justify-center">
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
                              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center ${isCurrent
                                ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-250 dark:ring-emerald-900 scale-105"
                                : hasRecipe
                                  ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:scale-105 dark:bg-emerald-950/45 dark:text-emerald-300 dark:hover:bg-emerald-950"
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
    );
  };

  return (
    <div 
      className="space-y-6 select-text text-left relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      {/* Recipe Navigation Bar - sticky header on desktop */}
      <div className="flex flex-row items-center justify-between gap-4 md:grid md:grid-cols-2 md:gap-y-3.5 md:items-center lg:flex lg:flex-row lg:items-center lg:justify-between lg:gap-4 md:sticky md:top-16 z-30 bg-slate-50/95 dark:bg-zinc-950/95 backdrop-blur-md pt-4 pb-4 -mt-4 border-b border-slate-200/50 dark:border-zinc-800 no-print select-none">

        {/* Go back trigger and Next Meal helper */}
        <div className="flex items-center gap-2 order-1">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center justify-center p-2.5 md:px-3.5 md:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-400 transition duration-200 cursor-pointer font-bold text-xs shadow-sm"
            title={backLabel}
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span className="hidden md:inline ml-1.5">{backLabel}</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 select-none">
            {/* Add to Favorites Heart Button (Shown in all modes) */}
            <button
              type="button"
              disabled={resolvedFavId.current === null}
              onClick={handleFavoriteToggle}
              className={`inline-flex items-center justify-center px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl border text-[11px] font-extrabold transition duration-250 shadow-xs gap-1.5 ${
                resolvedFavId.current === null
                  ? "bg-slate-100 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed opacity-60"
                  : isFav
                  ? "bg-rose-600 border-rose-600 text-white cursor-pointer"
                  : "bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/40 hover:border-slate-350 dark:hover:border-zinc-700 text-slate-500 hover:text-slate-700 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 cursor-pointer"
              }`}
              title={resolvedFavId.current === null ? "Esta receta no está en el Recetario" : isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
            >
              <span className={`material-symbols-outlined text-[16px] ${resolvedFavId.current === null ? "text-slate-300 dark:text-zinc-650" : isFav ? "text-white fill-white font-variation-fill-1" : "text-slate-400"}`}>
                favorite
              </span>
              <span className="hidden sm:inline">{isFav ? "Favorito" : "Añadir a Favoritos"}</span>
            </button>

            {/* Edit Button (Only recetario mode, muted icon-only style) */}
            {mode === "recetario" && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(recipe)}
                className="inline-flex items-center justify-center p-2 rounded-xl text-slate-400 hover:text-indigo-650 dark:text-zinc-500 dark:hover:text-indigo-400 bg-slate-50/50 hover:bg-slate-100 dark:bg-zinc-800/30 dark:hover:bg-zinc-805/80 border border-slate-200/50 dark:border-zinc-800/50 transition duration-200 cursor-pointer shadow-xs"
                title="Editar receta"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </button>
            )}

            {/* Delete Button (Only recetario mode, muted icon-only style, disabled for plan recipes) */}
            {mode === "recetario" && (
              <button
                type="button"
                disabled={recipe.source === "plan"}
                onClick={() => onDelete && onDelete(recipe)}
                className={`inline-flex items-center justify-center p-2 rounded-xl border transition duration-200 ${
                  recipe.source === "plan"
                    ? "bg-slate-100/30 text-slate-300 dark:bg-zinc-850/10 dark:text-zinc-750 border-slate-200/30 dark:border-zinc-850/30 cursor-not-allowed"
                    : "bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 border-slate-200 dark:border-zinc-800 hover:border-red-200/50 dark:hover:border-red-900/35 cursor-pointer shadow-xs"
                }`}
                title={recipe.source === "plan" ? "No se puede borrar porque proviene de un plan semanal" : "Eliminar receta"}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </button>
            )}
          </div>

          {nextMeal && (
            <button
              type="button"
              onClick={() => {
                if (onNavigateActive) {
                  onNavigateActive(nextMeal.day, nextMeal.meal, nextMeal.recipe);
                } else if (onNavigate) {
                  onNavigate(nextMeal.day, nextMeal.meal, nextMeal.recipe);
                }
              }}
              className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-extrabold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-100 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 px-3 py-2 md:px-3.5 md:py-2.5 rounded-xl transition duration-200 cursor-pointer border border-emerald-100/55 dark:border-emerald-900/40 shadow-sm"
              title={`Ir a la próxima comida: ${mealNames[nextMeal.meal]}`}
            >
              <span className="material-symbols-outlined text-[14px] md:text-[15px]">fastfood</span>
              <span>
                Próxima comida: <span className="hidden sm:inline">{mealNames[nextMeal.meal]} ({nextMeal.day === dayKeysInOrder[new Date().getDay()] ? "hoy" : nextMeal.day === dayKeysInOrder[(new Date().getDay() + 1) % 7] ? "mañana" : dayNames[nextMeal.day]})</span>
                <span className="sm:hidden">{mealNames[nextMeal.meal]}</span>
              </span>
            </button>
          )}
        </div>

        {/* Meal Selector - visible on desktop, hidden on mobile in the header */}
        <div className="hidden md:block order-2 md:order-3 lg:order-2 md:col-span-2 md:justify-self-center lg:col-span-1">
          {renderMealNavigator(false)}
        </div>

        {isPlanActive && mode !== "recetario" && (
          <div className="text-xs text-slate-400 order-3 md:order-2 lg:order-3 md:justify-self-end md:w-[150px] text-right">
            Pauta {currentIndex + 1} de {activeRecipes.length}
          </div>
        )}
      </div>

      {/* Hero Header Presentation */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800 min-h-[250px] flex flex-col md:flex-row items-stretch shadow-sm">
        <div className="w-full md:w-5/12 min-h-[200px] relative shrink-0 overflow-hidden flex items-center justify-center bg-emerald-50/40 dark:bg-zinc-950 text-slate-400 dark:text-zinc-500">
          {imageUrl && !imageError ? (
            <img
              src={imageUrl}
              alt={recipe.recipeName}
              onError={handleImageError}
              className="absolute inset-0 w-full h-full object-cover animate-fade-in"
            />
          ) : (
            <ImagePlaceholder text="Sin Imagen" iconSizeClass="text-5xl" />
          )}
        </div>
        <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col justify-center bg-white dark:bg-zinc-900">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 px-3 py-1 rounded-full w-max mb-3 uppercase">
            {recipe.tag || "Saludable"}
          </span>
          <h1 className="text-2xl md:text-3.5xl font-extrabold text-slate-900 dark:text-white leading-tight mb-4 select-all">
            {recipe.recipeName}
          </h1>
          <div className="flex flex-wrap gap-4 select-none">
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400">
              <span className="material-symbols-outlined text-emerald-600">schedule</span>
              <span className="font-semibold">{recipe.time || "25 min"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 font-bold">
              <span className="material-symbols-outlined text-emerald-600">fitness_center</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Alta densidad nutricional</span>
            </div>
          </div>

          {/* Mobile adjustments & sharing shortcut triggers */}
          <div className="flex flex-wrap gap-2.5 mt-5 lg:hidden no-print select-none">
            <button
              type="button"
              onClick={() => {
                setDrawerContent('adjust');
                setIsDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 px-3.5 py-2 rounded-xl transition duration-200 border border-emerald-100/50 dark:border-emerald-900/40 cursor-pointer shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[15px]">calculate</span>
              Raciones (x{multiplier}) • {Math.round(recipe.calories * multiplier)} kcal
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawerContent('share');
                setIsDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3.5 py-2 rounded-xl transition duration-200 border border-slate-200/65 dark:border-zinc-700/50 cursor-pointer shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[15px]">share</span>
              Compartir
            </button>
          </div>
        </div>
      </section>

      {/* Main interactive grid content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Sidebar calculations - hidden on mobile, visible on desktop (lg breakpoint) */}
        <aside className="hidden lg:block lg:col-span-4 space-y-6">
          {renderSidebarContent()}
        </aside>

        {/* Main Ingredients detail presentation card layout */}
        <section className="lg:col-span-8 space-y-6">
          {/* Botón de completar para móvil o warning si es histórico */}
          <div className="lg:hidden no-print">
            {isPlanActive ? (
              <button
                type="button"
                onClick={() => onToggleComplete(day, meal)}
                className={`w-full py-4 px-5 font-black text-sm rounded-2xl transition duration-200 cursor-pointer shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] ${
                  isRecipeCompleted
                    ? "bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-750 hover:border-emerald-750"
                    : "bg-white hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800"
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px] font-black">
                    {isRecipeCompleted ? "check_circle" : "circle"}
                  </span>
                </span>
                <span>Marcar como completado</span>
              </button>
            ) : (
              renderHistoricalWarning()
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl border border-slate-200/50 dark:border-zinc-800 shadow-sm text-left">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800 select-text flex-wrap gap-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Ingredientes Pautados</h2>
              <button
                type="button"
                onClick={handleHighlightServings}
                className="text-xs text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400 bg-slate-50 hover:bg-emerald-50/50 dark:bg-zinc-800 dark:hover:bg-zinc-850 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1 border border-slate-200/30 dark:border-zinc-700/30 hover:border-emerald-500/20 active:scale-95 select-none font-medium"
                title="Ajustar cantidad de raciones"
              >
                <span>Mostrando</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{multiplier}</span>
                <span>ración(es)</span>
                <span className="material-symbols-outlined text-[15px] ml-0.5 text-slate-400 dark:text-zinc-500 group-hover:text-emerald-600">tune</span>
              </button>
            </div>

            {/* Selector de categorías de ingredientes (si hay más de una) */}
            {activeIngCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-5 select-none bg-slate-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-slate-100 dark:border-zinc-800/60 w-max max-w-full">
                <button
                  type="button"
                  onClick={() => syncCategory("Todo")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedIngCategory === "Todo"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-zinc-900"
                    }`}
                >
                  Todo
                </button>
                {activeIngCategories.map((catKey) => (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => syncCategory(catKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedIngCategory === catKey
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-zinc-900"
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

                const formattedPrimary = formatAmountAndUnit(scaledAmt, ing.unit);
                const formattedSecondary = ing.secondaryAmount && ing.secondaryUnit
                  ? formatAmountAndUnit(ing.secondaryAmount * multiplier, ing.secondaryUnit)
                  : null;

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
                        {formattedSecondary ? (
                          <>
                            {formattedSecondary.amount} {formattedSecondary.unit}
                            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 ml-1.5 font-sans">
                              ({formattedPrimary.amount} {formattedPrimary.unit})
                            </span>
                          </>
                        ) : (
                          <>{formattedPrimary.amount} {formattedPrimary.unit}</>
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
                  <p className="text-xs md:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {recipe.tips}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Meticulous Culinary Step-by-Step Instructions */}
          <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-3xl border border-slate-200/50 dark:border-zinc-800 shadow-sm text-left">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2 select-none">
              <span className="material-symbols-outlined text-emerald-600">restaurant_menu</span>
              Preparación Meticulosa Paso a Paso
            </h3>

            {/* Selector de categorías de preparación (si hay más de una) */}
            {activeStepCategories.length > 1 && (
              <div className="flex flex-wrap gap-1.5 mb-5 select-none bg-slate-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-slate-100 dark:border-zinc-800/60 w-max max-w-full">
                <button
                  type="button"
                  onClick={() => syncCategory("Todo")}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedStepCategory === "Todo"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-zinc-900"
                    }`}
                >
                  Todo
                </button>
                {activeStepCategories.map((catKey) => (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => syncCategory(catKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${selectedStepCategory === catKey
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-zinc-900"
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
                          <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded-md">
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

          {/* Mobile-only inline adjustments panel below preparation steps */}
          <div className="lg:hidden mt-6 no-print" style={{ marginTop: "1.5rem" }}>
            {renderSidebarContent('adjust')}
          </div>

          {/* Mobile-only inline completion panel at the very bottom */}
          {isPlanActive && mode !== "recetario" && (
            <div className="lg:hidden mt-6 no-print">
              {renderCompletionPanel()}
            </div>
          )}

          {/* Mobile-only matches and completion panel for recetario mode */}
          {mode === "recetario" && (
            <div className="lg:hidden mt-6 no-print space-y-4">
              {renderPlanMatches()}
              {renderCompletionPanel()}
            </div>
          )}

          {/* Subtle Audit Footer */}
          {mode === "recetario" && (recipe.createdAt || recipe.updatedAt) && (
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-450 dark:text-zinc-500 select-none gap-2">
              {recipe.createdAt && (
                <div className="flex items-center gap-1 select-none">
                  <span className="material-symbols-outlined text-[13px] opacity-70">calendar_month</span>
                  <span>
                    Creada: {new Date(recipe.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
              {recipe.updatedAt && recipe.updatedAt !== recipe.createdAt && (
                <div className="flex items-center gap-1 select-none">
                  <span className="material-symbols-outlined text-[13px] opacity-70">edit_note</span>
                  <span>
                    Modificada: {new Date(recipe.updatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          )}

        </section>

      </div>

      {/* Mobile Settings/Share Modal */}
      {isDrawerOpen && (
        <div 
          className="modal-overlay recipe-modal-overlay fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in no-print"
          style={{ marginTop: 0 }}
        >
          <div 
            className="recipe-modal-backdrop fixed inset-0" 
            onClick={() => setIsDrawerOpen(false)} 
          />
          <div 
            className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden relative z-10 select-none animate-scale-up"
            style={{ marginTop: 0 }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800/85 bg-gray-50/50 dark:bg-zinc-950/20 shrink-0 select-none">
              <h3 className="text-lg font-bold text-[#0f5238] dark:text-emerald-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">
                  {drawerContent === 'adjust' ? "tune" : "share"}
                </span>
                <span>
                  {drawerContent === 'adjust' ? "Ajustes de Receta" : "Compartir Receta"}
                </span>
              </h3>
              <button 
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-650 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-4 text-left">
              {renderSidebarContent(drawerContent)}
            </div>
          </div>
        </div>
      )}



      {/* Mobile Sticky Bottom Recipe Switcher - positioned exactly above the mobile appbar (bottom-16) */}
      {isPlanActive && mode !== "recetario" && activeRecipes.length > 0 && (
        <div className="recipe-bottom-switcher fixed bottom-16 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200/50 dark:border-zinc-800 p-2.5 md:hidden shadow-lg flex justify-center no-print">
          {renderMealNavigator(true)}
        </div>
      )}

      {/* Progress recipes list modal overlay */}
      {showProgressModal && plan && (
        <div 
          className="modal-overlay recipe-modal-overlay fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print !mt-0"
          style={{ marginTop: 0 }}
        >
          <div 
            className="recipe-modal-backdrop fixed inset-0" 
            onClick={() => setShowProgressModal(false)} 
            style={{ marginTop: 0 }}
          />
          <div 
            className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-150 dark:border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative z-10 select-none !mt-0"
            style={{ marginTop: 0 }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/20 shrink-0">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-emerald-600 dark:text-emerald-400">task_alt</span>
                  Progreso Semanal de Recetas
                </h3>
                <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-extrabold mt-0.5">
                  Haz clic sobre una receta para completarla o desmarcarla
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-850 text-slate-450 hover:text-slate-700 dark:hover:text-zinc-200 transition duration-200 cursor-pointer flex items-center justify-center border border-slate-200/50 dark:border-zinc-700/50 shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow space-y-6">
              {daysKeys.map((dKey) => {
                const dayRecipes = mealsKeys.map(mKey => ({ meal: mKey, recipe: plan.days[dKey]?.[mKey] })).filter(item => !!item.recipe);
                if (dayRecipes.length === 0) return null;
                
                const label = datesMap[dKey];
                const dayMeals = dayRecipes.map(item => item.meal);
                const allCompleted = dayRecipes.every(({ meal }) => !!completedRecipes[`${dKey}-${meal}`]);

                return (
                  <div key={dKey} className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/60 pb-1.5 select-none">
                      <div className="flex items-center gap-2">
                        <span>{label.long}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleDayComplete(dKey, dayMeals, !allCompleted)}
                        className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors uppercase tracking-wider cursor-pointer bg-transparent border-0 outline-none"
                      >
                        {allCompleted ? "Desmarcar todo" : "Marcar todo"}
                      </button>
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {dayRecipes.map(({ meal: mKey, recipe: rObj }) => {
                        const isCompleted = !!completedRecipes[`${dKey}-${mKey}`];
                        const isFocused = dKey === upcomingMeal.day && mKey === upcomingMeal.meal;
                        return (
                          <button
                            key={mKey}
                            type="button"
                            onClick={() => onToggleComplete(dKey, mKey)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition duration-150 cursor-pointer w-full group/item ${
                              isFocused
                                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                                : isCompleted
                                  ? "bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500/20 text-slate-855 dark:text-zinc-250"
                                  : "bg-slate-50/50 hover:bg-slate-100/50 dark:bg-zinc-950/20 dark:hover:bg-zinc-800/40 border-transparent hover:border-emerald-600/10 text-slate-700 dark:text-zinc-350"
                            }`}
                          >
                            {/* Circle toggle checkmark button */}
                            {isCompleted ? (
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-sm transition duration-150">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full border border-slate-350 dark:border-zinc-700 shrink-0 group-hover/item:border-emerald-500 transition duration-150 flex items-center justify-center bg-white dark:bg-zinc-900">
                                <svg className="w-2.5 h-2.5 text-transparent group-hover/item:text-emerald-500/30" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1 select-none">
                                <span className={`block text-[8px] font-black uppercase tracking-widest leading-none ${
                                  isCompleted ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-slate-400 dark:text-zinc-555"
                                }`}>
                                  {mealLabels[mKey]}
                                </span>
                                {isFocused && !isCompleted && (
                                  <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-[7px] px-1.5 py-0.5 rounded-full select-none animate-pulse shadow-sm leading-none">
                                    PRÓXIMA
                                  </span>
                                )}
                              </div>
                              <span className={`block text-[11px] font-bold truncate ${
                                isCompleted ? "line-through text-slate-400 dark:text-zinc-500 opacity-70" : "text-slate-800 dark:text-zinc-200"
                              }`} title={rObj!.recipeName}>
                                {rObj!.recipeName}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4.5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/20 shrink-0 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest">
                Completadas: {weeklyStats.completed} de {weeklyStats.total} ({weeklyStats.percentage}%)
              </span>
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showRestoreConfirmation}
        title="Restaurar plan"
        description="Este plan pasará a ser el plan activo actual y el plan anterior dejará de estar activo."
        confirmLabel="Restaurar plan"
        icon="restore"
        variant="warning"
        onCancel={() => setShowRestoreConfirmation(false)}
        onConfirm={() => {
          setShowRestoreConfirmation(false);
          onRestorePlan?.();
        }}
      />

    </div>
  );
}
