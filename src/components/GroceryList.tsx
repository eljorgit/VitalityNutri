import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MealPlan, Ingredient, DayType, MealType } from "../types";
import ConfirmationModal, { ConfirmationVariant } from "./ConfirmationModal";
import { getSiteVisibility } from "../utils/siteVisibility";

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

interface GroceryListProps {
  plan: MealPlan | null;
  completedRecipes?: Record<string, boolean>;
}
export default function GroceryList({ plan, completedRecipes }: GroceryListProps) {
  const { t } = useTranslation();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [excludeCompletedRecipes, setExcludeCompletedRecipes] = useState<boolean>(false);

  const getSearchParams = () => {
    return new URLSearchParams(window.location.search);
  };

  const getDefaultDay = (): string => {
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const date = new Date();
    let dayOfWeekIndex = date.getDay();
    if (date.getHours() >= 19) {
      dayOfWeekIndex = (dayOfWeekIndex + 1) % 7;
    }
    return days[dayOfWeekIndex];
  };

  const [listType, setListType] = useState<"semanal" | "3dias" | "diario">(() => {
    const params = getSearchParams();
    const t = params.get("type");
    if (t === "semanal" || t === "3dias" || t === "diario") return t;
    return "semanal";
  });

  const [selectedSingleDay, setSelectedSingleDay] = useState<string>(() => {
    const params = getSearchParams();
    const d = params.get("day");
    if (d) return d;
    return getDefaultDay();
  });

  const [selected3DaysStart, setSelected3DaysStart] = useState<string>(() => {
    const params = getSearchParams();
    const s = params.get("start");
    if (s) return s;
    return getDefaultDay();
  });

  const [copied, setCopied] = useState(false);
  const [copiedKeep, setCopiedKeep] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [showShareWarning, setShowShareWarning] = useState(false);
  const pendingShareRef = useRef<(() => void) | null>(null);

  const warnBeforeShare = (shareFn: () => void) => {
    if (getSiteVisibility() === "local") {
      pendingShareRef.current = shareFn;
      setShowShareWarning(true);
    } else {
      shareFn();
    }
  };

  const handleDismissShareWarning = () => {
    setShowShareWarning(false);
    pendingShareRef.current?.();
    pendingShareRef.current = null;
  };

  const [expandedRecipes, setExpandedRecipes] = useState<Record<string, boolean>>({});
  const [configPanelExpanded, setConfigPanelExpanded] = useState(false);
  const [notification, setNotification] = useState<{
    title: string;
    description: string;
    icon: string;
    variant: ConfirmationVariant;
  } | null>(null);

  const showNotification = (title: string, description: string, icon: string, variant: ConfirmationVariant) => {
    setNotification({ title, description, icon, variant });
  };

  const [shareIncludeCheckboxes, setShareIncludeCheckboxes] = useState(false);
  const [shareGroupByCategories, setShareGroupByCategories] = useState(true);
  const [shareExcludeCompleted, setShareExcludeCompleted] = useState(false);
  const [shareIncludeQuantities, setShareIncludeQuantities] = useState(true);

  const [globalMultiplier, setGlobalMultiplier] = useState<number>(1);
  const [dayMultipliers, setDayMultipliers] = useState<Record<string, number>>({});
  const [mealMultipliers, setMealMultipliers] = useState<Record<string, number>>({});
  const [excludedMeals, setExcludedMeals] = useState<string[]>([]);

  const handleSaveListToDB = async () => {
    try {
      const response = await fetch("/api/grocery-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkedItems,
          listType,
          selectedSingleDay,
          selected3DaysStart,
          excludedMeals,
          multipliers: {
            global: globalMultiplier,
            days: dayMultipliers,
            meals: mealMultipliers
          }
        })
      });
      if (response.ok) {
        showNotification(
          t("grocery.save_success_title"),
          t("grocery.save_success_desc"),
          "check_circle",
          "success"
        );
      } else {
        throw new Error();
      }
    } catch (err) {
      console.error(err);
      showNotification(
        t("grocery.save_error_title"),
        t("grocery.save_error_desc"),
        "error",
        "danger"
      );
    }
  };

  const handleLoadListFromDB = async () => {
    try {
      const response = await fetch("/api/grocery-list");
      if (!response.ok) throw new Error();
      const state = await response.json();
      if (state) {
        if (state.checkedItems) setCheckedItems(state.checkedItems);
        if (state.listType) setListType(state.listType);
        if (state.selectedSingleDay) setSelectedSingleDay(state.selectedSingleDay);
        if (state.selected3DaysStart) setSelected3DaysStart(state.selected3DaysStart);
        if (state.excludedMeals) setExcludedMeals(state.excludedMeals);
        if (state.multipliers) {
          if (state.multipliers.global !== undefined) setGlobalMultiplier(state.multipliers.global);
          if (state.multipliers.days) setDayMultipliers(state.multipliers.days);
          if (state.multipliers.meals) setMealMultipliers(state.multipliers.meals);
        }
        showNotification(
          t("grocery.restore_success_title"),
          t("grocery.restore_success_desc"),
          "check_circle",
          "success"
        );
      }
    } catch (err) {
      console.error(err);
      showNotification(
        t("grocery.restore_error_title"),
        t("grocery.restore_error_desc"),
        "error",
        "danger"
      );
    }
  };

  useEffect(() => {
    const autoRestore = async () => {
      try {
        const response = await fetch("/api/grocery-list");
        if (response.ok) {
          const state = await response.json();
          if (state && (
            Object.keys(state.checkedItems || {}).length > 0 ||
            state.excludedMeals?.length > 0 ||
            (state.multipliers?.global && state.multipliers.global !== 1) ||
            Object.keys(state.multipliers?.days || {}).length > 0 ||
            Object.keys(state.multipliers?.meals || {}).length > 0
          )) {
            if (state.checkedItems) setCheckedItems(state.checkedItems);
            if (state.listType) setListType(state.listType);
            if (state.selectedSingleDay) setSelectedSingleDay(state.selectedSingleDay);
            if (state.selected3DaysStart) setSelected3DaysStart(state.selected3DaysStart);
            if (state.excludedMeals) setExcludedMeals(state.excludedMeals);
            if (state.multipliers) {
              if (state.multipliers.global !== undefined) setGlobalMultiplier(state.multipliers.global);
              if (state.multipliers.days) setDayMultipliers(state.multipliers.days);
              if (state.multipliers.meals) setMealMultipliers(state.multipliers.meals);
            }
          }
        }
      } catch (err) {
        console.error("Auto-restore of grocery list failed:", err);
      }
    };
    autoRestore();
  }, []);

  const handleToggleAllMealTypeShortcut = (mealType: "breakfast" | "snack") => {
    const activeDays = listType === "semanal"
      ? ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
      : listType === "3dias"
        ? [
            selected3DaysStart,
            ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(selected3DaysStart) + 1) % 7],
            ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].indexOf(selected3DaysStart) + 2) % 7]
          ]
        : [selectedSingleDay];

    const mealIds = activeDays.map(d => `${d}-${mealType}`);
    const someAreIncluded = mealIds.some(id => !excludedMeals.includes(id));

    if (someAreIncluded) {
      setExcludedMeals(prev => {
        const next = [...prev];
        mealIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    } else {
      setExcludedMeals(prev => prev.filter(id => !mealIds.includes(id)));
    }
  };

  const handleResetMultipliers = () => {
    setGlobalMultiplier(1);
    setDayMultipliers({});
    setMealMultipliers({});
  };

  useEffect(() => {
    if (typeof navigator !== "undefined" && !!navigator.share) {
      setCanShare(true);
    }
  }, []);

  useEffect(() => {
    if (window.location.pathname.startsWith("/grocery")) {
      let search = `?type=${listType}`;
      if (listType === "3dias") {
        search += `&start=${selected3DaysStart}`;
      } else if (listType === "diario") {
        search += `&day=${selectedSingleDay}`;
      }
      if (window.location.search !== search) {
        window.history.replaceState(null, "", window.location.pathname + search);
      }
    }
  }, [listType, selected3DaysStart, selectedSingleDay]);

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith("/grocery")) {
        const params = getSearchParams();
        const t = params.get("type");
        if (t === "semanal" || t === "3dias" || t === "diario") {
          setListType(t);
        }
        const s = params.get("start");
        if (s) setSelected3DaysStart(s);
        const d = params.get("day");
        if (d) setSelectedSingleDay(d);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const toggleRecipesExpanded = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setExpandedRecipes(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const mealNames: Record<string, string> = {
    breakfast: t("meals.breakfast"),
    lunch: t("meals.lunch"),
    snack: t("meals.snack"),
    dinner: t("meals.dinner")
  };

  const generateListText = (): string => {
    let text = `🛒 *${t("grocery.share_title")}*\n`;

    if (listType === "semanal") {
      text += `📅 *${t("grocery.share_type_weekly")}*\n\n`;
    } else if (listType === "3dias") {
      const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const startIndex = weekdays.indexOf(selected3DaysStart);
      const day1 = getDayNameTranslated(weekdays[startIndex]);
      const day2 = getDayNameTranslated(weekdays[(startIndex + 1) % 7]);
      const day3 = getDayNameTranslated(weekdays[(startIndex + 2) % 7]);
      text += `📅 *${t("grocery.share_type_3day", { days: `${day1}, ${day2}, ${day3}` })}*\n\n`;
    } else {
      text += `📅 *${t("grocery.share_type_daily", { day: getDayNameTranslated(selectedSingleDay) })}*\n\n`;
    }

    const itemsToExport = aggregatedIngredients.filter((item) => {
      if (shareExcludeCompleted && checkedItems[item.name]) {
        return false;
      }
      return true;
    });

    if (itemsToExport.length === 0) {
      text += `_(${t("grocery.share_no_items")})_\n\n`;
      text += `${t("grocery.share_generated_by")}`;
      return text;
    }

    if (shareGroupByCategories) {
      const groups: Record<string, typeof aggregatedIngredients> = {};
      itemsToExport.forEach((item) => {
        const category = categorizeIngredient(item.name, item.category);
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(item);
      });

      const categoryOrder = [
        "Verduras y Hortalizas",
        "Frutas",
        "Carnes, Huevos y Tofu",
        "Pescados y Mariscos",
        "Lácteos y Bebidas",
        "Granos, Harinas y Semillas",
        "Despensa y Condimentos",
        "Otros Ingredientes"
      ];

      const sortedKeys = Object.keys(groups).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a);
        const indexB = categoryOrder.indexOf(b);
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;
        return posA - posB;
      });

      sortedKeys.forEach((groupName) => {
        text += `📂 *${groupName.toUpperCase()}*\n`;
        groups[groupName].forEach((item) => {
          const isChecked = !!checkedItems[item.name];
          const prefix = shareIncludeCheckboxes ? (isChecked ? "✅ " : "⬜ ") : "• ";

          let amountText = "";
          if (item.secondaryTotal && item.secondaryUnit) {
            const sec = formatAmountAndUnit(item.secondaryTotal, item.secondaryUnit);
            const pri = formatAmountAndUnit(item.total, item.unit);
            amountText = `${sec.amount} ${sec.unit} (${pri.amount} ${pri.unit})`;
          } else {
            const pri = formatAmountAndUnit(item.total, item.unit);
            amountText = `${pri.amount} ${pri.unit}`;
          }

          text += `${prefix}${item.name}${shareIncludeQuantities ? ` (${amountText})` : ""}\n`;
        });
        text += `\n`;
      });
    } else {
      const sortedItems = [...itemsToExport].sort((a, b) => a.name.localeCompare(b.name));
      sortedItems.forEach((item) => {
        const isChecked = !!checkedItems[item.name];
        const prefix = shareIncludeCheckboxes ? (isChecked ? "✅ " : "⬜ ") : "• ";

        let amountText = "";
        if (item.secondaryTotal && item.secondaryUnit) {
          const sec = formatAmountAndUnit(item.secondaryTotal, item.secondaryUnit);
          const pri = formatAmountAndUnit(item.total, item.unit);
          amountText = `${sec.amount} ${sec.unit} (${pri.amount} ${pri.unit})`;
        } else {
          const pri = formatAmountAndUnit(item.total, item.unit);
          amountText = `${pri.amount} ${pri.unit}`;
        }

        text += `${prefix}${item.name}${shareIncludeQuantities ? ` (${amountText})` : ""}\n`;
      });
      text += `\n`;
    }

    text += `${t("grocery.share_generated_by")}`;
    return text;
  };

  const handleCopyToClipboard = async () => {
    warnBeforeShare(async () => {
      const text = generateListText();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Error copying to clipboard: ", err);
      }
    });
  };

  const handleShareWhatsApp = () => {
    warnBeforeShare(() => {
      const text = generateListText();
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    });
  };

  const handleShareTelegram = () => {
    warnBeforeShare(() => {
      const text = generateListText();
      const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    });
  };

  const handleShareInstagram = async () => {
    warnBeforeShare(async () => {
      const text = generateListText();
      try {
        await navigator.clipboard.writeText(text);
        window.open("https://www.instagram.com/", "_blank");
      } catch (err) {
        console.error("Error copying for Instagram: ", err);
      }
    });
  };

  const handleExportToKeep = async () => {
    warnBeforeShare(() => {
      const text = generateListText();
      navigator.clipboard.writeText(text).then(() => {
        setCopiedKeep(true);
        setTimeout(() => setCopiedKeep(false), 3000);
        window.open("https://keep.new", "_blank");
      }).catch((err) => {
        console.error("Error copying for Google Keep: ", err);
      });
    });
  };

  const handleNativeShare = async () => {
    warnBeforeShare(() => {
      const text = generateListText();
      if (navigator.share) {
        navigator.share({
          title: `${t("grocery.share_native_title")}`,
          text: text
        }).catch((err) => {
          console.error("Error using Web Share: ", err);
        });
      }
    });
  };

  const getTodayDayType = (): string => {
    const dayOfWeek = new Date().getDay();
    const daysMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return daysMap[dayOfWeek];
  };

  const getDayNameTranslated = (dayKeyStr: string): string => {
    return t("weekdays." + dayKeyStr, dayKeyStr);
  };

  const getStandardIngredientName = (rawName: string): string => {
    const nameLow = rawName.trim().toLowerCase();

    if (/^huevo( entero| duro| cocido| frito)?s?$/.test(nameLow) ||
      nameLow === "huevo duro" ||
      nameLow === "huevo cocido" ||
      nameLow === "huevo entero" ||
      nameLow === "huevos duros" ||
      nameLow === "huevos cocidos" ||
      nameLow === "huevos enteros" ||
      nameLow === "huevos" ||
      nameLow === "huevo") {
      return "Huevo";
    }

    if (nameLow.includes("aceite de oliva")) {
      return "Aceite de oliva virgen extra";
    }

    if (nameLow.includes("tomate") && !nameLow.includes("salsa")) {
      return "Tomate";
    }

    if (nameLow === "cebóla" || nameLow.includes("cebolla")) {
      return "Cebolla";
    }

    if (nameLow.includes("zanahoria")) {
      return "Zanahoria";
    }

    if (nameLow === "salmón" || nameLow === "filete de salmón" || nameLow === "salmon") {
      return "Salmón";
    }
    if (nameLow.includes("pechuga de pollo") || nameLow === "pechuga pollo" || nameLow === "pollo") {
      return "Pechuga de pollo";
    }

    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
  };

  const daysToAggregate = useMemo((): string[] => {
    if (listType === "semanal") {
      return ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    } else if (listType === "3dias") {
      const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      const startIndex = weekdays.indexOf(selected3DaysStart);
      return [
        weekdays[startIndex],
        weekdays[(startIndex + 1) % 7],
        weekdays[(startIndex + 2) % 7]
      ];
    } else {
      return [selectedSingleDay];
    }
  }, [listType, selected3DaysStart, selectedSingleDay]);

  const aggregatedIngredients = useMemo(() => {
    if (!plan) return [];

    const map: Record<string, {
      name: string;
      total: number;
      unit: string;
      secondaryTotal?: number;
      secondaryUnit?: string;
      category?: string;
      recipes: {
        day: DayType;
        meal: MealType;
        recipeName: string;
        amount: number;
        unit: string;
        secondaryAmount?: number;
        secondaryUnit?: string;
      }[];
    }> = {};

    daysToAggregate.forEach((dayKey) => {
      const dayMeals = plan.days[dayKey as keyof typeof plan.days];
      if (dayMeals) {
        Object.entries(dayMeals).forEach(([mealKey, recipe]) => {
          const mealId = `${dayKey}-${mealKey}`;
          if (excludedMeals.includes(mealId)) {
            return;
          }

          if (excludeCompletedRecipes && completedRecipes && completedRecipes[mealId]) {
            return;
          }

          if (recipe && recipe.ingredients) {
            let totalMult = globalMultiplier;
            const mealId = `${dayKey}-${mealKey}`;
            const dayMult = dayMultipliers[dayKey];
            const mealMult = mealMultipliers[mealId];

            if (mealMult !== undefined && mealMult !== 1) {
              totalMult = mealMult;
            } else if (dayMult !== undefined && dayMult !== 1) {
              totalMult = dayMult;
            }

            const list = Array.isArray(recipe.ingredients)
              ? recipe.ingredients
              : (Object.values(recipe.ingredients).flat().filter(Boolean) as Ingredient[]);
            list.forEach((ing) => {
              const stdName = getStandardIngredientName(ing.name);
              const key = stdName.toLowerCase();
              const recipeRef = {
                day: dayKey as DayType,
                meal: mealKey as MealType,
                recipeName: recipe.recipeName,
                amount: ing.originalAmount * totalMult,
                unit: ing.unit,
                secondaryAmount: ing.secondaryAmount ? ing.secondaryAmount * totalMult : undefined,
                secondaryUnit: ing.secondaryUnit
              };

              if (map[key]) {
                map[key].total += ing.originalAmount * totalMult;
                if (ing.secondaryAmount) {
                  map[key].secondaryTotal = (map[key].secondaryTotal || 0) + (ing.secondaryAmount * totalMult);
                }
                if (!map[key].category && ing.category) {
                  map[key].category = ing.category;
                }
                if (!map[key].recipes.some(r => r.day === recipeRef.day && r.meal === recipeRef.meal)) {
                  map[key].recipes.push(recipeRef);
                  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
                  const mealOrder = ["breakfast", "lunch", "snack", "dinner"];
                  map[key].recipes.sort((a, b) => {
                    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
                    if (dayDiff !== 0) return dayDiff;
                    return mealOrder.indexOf(a.meal) - mealOrder.indexOf(b.meal);
                  });
                }
              } else {
                map[key] = {
                  name: stdName,
                  total: ing.originalAmount * totalMult,
                  unit: ing.unit,
                  secondaryTotal: ing.secondaryAmount ? ing.secondaryAmount * totalMult : undefined,
                  secondaryUnit: ing.secondaryUnit,
                  category: ing.category,
                  recipes: [recipeRef]
                };
              }
            });
          }
        });
      }
    });

    return Object.values(map);
  }, [plan, daysToAggregate, excludedMeals, globalMultiplier, dayMultipliers, mealMultipliers, excludeCompletedRecipes, completedRecipes]);

  const categorizeIngredient = (name: string, itemCategory?: string): string => {
    if (itemCategory) {
      const catLow = itemCategory.toLowerCase();
      switch (catLow) {
        case "verduras y hortalizas":
          return "Verduras y Hortalizas";
        case "frutas":
          return "Frutas";
        case "carnes, huevos y tofu":
          return "Carnes, Huevos y Tofu";
        case "pescados y mariscos":
          return "Pescados y Mariscos";
        case "lácteos y bebidas":
          return "Lácteos y Bebidas";
        case "granos, harinas y semillas":
          return "Granos, Harinas y Semillas";
        case "despensa y condimentos":
          return "Despensa y Condimentos";
        case "otros":
          return "Otros Ingredientes";
        default:
          break;
      }
    }

    const nameLow = name.toLowerCase();

    if (nameLow.includes("pollo") || nameLow.includes("pavo") || nameLow.includes("ternera") || nameLow.includes("jamón") || nameLow.includes("tofu") || nameLow.includes("huevo")) {
      return "Carnes, Huevos y Tofu";
    }
    if (nameLow.includes("salmón") || nameLow.includes("merluza") || nameLow.includes("pescado") || nameLow.includes("atún")) {
      return "Pescados y Mariscos";
    }
    if (nameLow.includes("limón") || nameLow.includes("manzana") || nameLow.includes("plátano") || nameLow.includes("fresa") || nameLow.includes("baya") || nameLow.includes("naranja") || nameLow.includes("arándano") || nameLow.includes("kiwi") || nameLow.includes("pera") || nameLow.includes("piña") || nameLow.includes("fruta")) {
      return "Frutas";
    }
    if (nameLow.includes("pepino") || nameLow.includes("espinaca") || nameLow.includes("aguacate") || nameLow.includes("lechuga") || nameLow.includes("romana") || nameLow.includes("tomate") || nameLow.includes("zanahoria") || nameLow.includes("cebóla") || nameLow.includes("cebolla") || nameLow.includes("brócoli") || nameLow.includes("pimiento") || nameLow.includes("apio") || nameLow.includes("alcachofa") || nameLow.includes("puerro") || nameLow.includes("calabacín") || nameLow.includes("ajo") || nameLow.includes("setas") || nameLow.includes("champiñón")) {
      return "Verduras y Hortalizas";
    }
    if (nameLow.includes("quinoa") || nameLow.includes("avena") || nameLow.includes("arroz") || nameLow.includes("pasta") || nameLow.includes("espagueti") || nameLow.includes("pan") || nameLow.includes("tortilla") || nameLow.includes("harina") || nameLow.includes("semilla")) {
      return "Granos, Harinas y Semillas";
    }
    if (nameLow.includes("aceite") || nameLow.includes("sal") || nameLow.includes("pimienta") || nameLow.includes("vinagre") || nameLow.includes("miel") || nameLow.includes("orégano") || nameLow.includes("caldo")) {
      return "Despensa y Condimentos";
    }
    if (nameLow.includes("yogur") || nameLow.includes("queso") || nameLow.includes("leche") || nameLow.includes("bebida")) {
      return "Lácteos y Bebidas";
    }
    return "Otros Ingredientes";
  };

  const categoryOrder = [
    "Verduras y Hortalizas",
    "Frutas",
    "Carnes, Huevos y Tofu",
    "Pescados y Mariscos",
    "Lácteos y Bebidas",
    "Granos, Harinas y Semillas",
    "Despensa y Condimentos",
    "Otros Ingredientes"
  ];

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case "Verduras y Hortalizas":
        return "spa";
      case "Frutas":
        return "nutrition";
      case "Carnes, Huevos y Tofu":
        return "dinner_dining";
      case "Pescados y Mariscos":
        return "set_meal";
      case "Lácteos y Bebidas":
        return "local_cafe";
      case "Granos, Harinas y Semillas":
        return "wheat";
      case "Despensa y Condimentos":
        return "kitchen";
      default:
        return "shopping_bag";
    }
  };

  const getCategoryColorClass = (category: string): string => {
    switch (category) {
      case "Verduras y Hortalizas":
        return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/30";
      case "Frutas":
        return "text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/30";
      case "Carnes, Huevos y Tofu":
        return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/30";
      case "Pescados y Mariscos":
        return "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30 border-cyan-100 dark:border-cyan-900/30";
      case "Lácteos y Bebidas":
        return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/30";
      case "Granos, Harinas y Semillas":
        return "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-100 dark:border-yellow-900/30";
      case "Despensa y Condimentos":
        return "text-orange-650 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/30";
      default:
        return "text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-800";
    }
  };

  const categorizedGroups = useMemo(() => {
    const groups: Record<string, typeof aggregatedIngredients> = {};

    aggregatedIngredients.forEach((item) => {
      const category = categorizeIngredient(item.name, item.category);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
    });

    return groups;
  }, [aggregatedIngredients]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(categorizedGroups).sort((a, b) => {
      const indexA = categoryOrder.indexOf(a);
      const indexB = categoryOrder.indexOf(b);
      const posA = indexA === -1 ? 999 : indexA;
      const posB = indexB === -1 ? 999 : indexB;
      return posA - posB;
    });
  }, [categorizedGroups]);

  const toggleChecked = (name: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const totalGroceryItemsCount = aggregatedIngredients.length;
  const checkedGroceryItemsCount = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="space-y-6 text-left select-text">

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 dark:border-zinc-800 pb-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-950 dark:text-white tracking-tight">{t("grocery.title")}</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">{t("grocery.description")}</p>
        </div>

        {totalGroceryItemsCount > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-extrabold text-xs py-2 px-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shrink-0 self-start lg:self-center">
            {t("grocery.completed_count", {
              checked: checkedGroceryItemsCount,
              total: totalGroceryItemsCount,
              percent: totalGroceryItemsCount > 0 ? Math.round((checkedGroceryItemsCount / totalGroceryItemsCount) * 100) : 0
            })}
          </div>
        )}
      </div>

      {plan && (
        <div className="space-y-3 no-print select-none">
          <div className="flex flex-wrap gap-2 items-center bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl w-max border border-slate-200/50 dark:border-zinc-800/60 text-xs">
            {(["semanal", "3dias", "diario"] as const).map((type) => {
              const labels: Record<string, string> = {
                semanal: t("grocery.weekly"),
                "3dias": t("grocery.three_days"),
                diario: t("grocery.daily")
              };
              const active = listType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setListType(type)}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition duration-200 cursor-pointer ${active
                    ? "bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 shadow-sm border border-slate-100 dark:border-zinc-700/60"
                    : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>

          {listType === "3dias" && (
            <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 w-full md:w-max animate-fade-in text-xs">
              <span className="font-extrabold text-slate-500 dark:text-zinc-400">{t("grocery.select_range")}</span>
              <div className="flex flex-wrap gap-1.5">
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((startDay) => {
                  const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
                  const idx = weekdays.indexOf(startDay);
                  const day1 = t("weekdays." + weekdays[idx]);
                  const day2 = t("weekdays." + weekdays[(idx + 1) % 7]);
                  const day3 = t("weekdays." + weekdays[(idx + 2) % 7]);

                  const isSelected = selected3DaysStart === startDay;
                  return (
                    <button
                      key={startDay}
                      type="button"
                      onClick={() => setSelected3DaysStart(startDay)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex flex-col items-center ${isSelected
                        ? "bg-emerald-600 text-white font-extrabold shadow-sm"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-800"
                        }`}
                    >
                      <span className="uppercase text-[9px] tracking-wide opacity-80">{t("grocery.starts_on", { day: day1 })}</span>
                      <span className="text-[10px] mt-0.5">{day1.slice(0, 3)} • {day2.slice(0, 3)} • {day3.slice(0, 3)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {listType === "diario" && (
            <div className="flex flex-col gap-1.5 p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 w-full md:w-max animate-fade-in text-xs">
              <span className="font-extrabold text-zinc-500 dark:text-zinc-400">{t("grocery.select_day")}</span>
              <div className="flex flex-wrap gap-1.5">
                {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((dayName) => {
                  const label = t("weekdays." + dayName);
                  const isSelected = selectedSingleDay === dayName;
                  return (
                    <button
                      key={dayName}
                      type="button"
                      onClick={() => setSelectedSingleDay(dayName)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${isSelected
                        ? "bg-emerald-600 text-white font-extrabold shadow-sm"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/80 dark:border-zinc-800"
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800/80 shadow-sm overflow-hidden no-print animate-fade-in text-left">
            <div
              onClick={() => setConfigPanelExpanded(!configPanelExpanded)}
              className="flex items-center justify-between p-5 bg-slate-50/50 dark:bg-zinc-950/20 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-zinc-950/40 transition duration-150 select-none border-b border-slate-100 dark:border-zinc-800/60"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400" style={{ fontSize: "20px" }}>filter_alt</span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    {t("grocery.config_title")}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {listType === "semanal"
                      ? t("grocery.config_desc_weekly")
                      : t("grocery.config_desc_other")
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 transition-transform duration-200" style={{ transform: configPanelExpanded ? "rotate(180deg)" : "rotate(0deg)", fontSize: "20px" }}>
                  expand_more
                </span>
              </div>
            </div>

            {configPanelExpanded && (
              <div className="p-6 space-y-5 border-t-0 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
                  <div className="flex flex-wrap gap-2 select-none">
                    <button
                      type="button"
                      onClick={() => handleToggleAllMealTypeShortcut("breakfast")}
                      className="px-3 py-1.5 text-[11px] font-black rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition duration-150 cursor-pointer"
                    >
                      {t("grocery.toggle_breakfast")}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAllMealTypeShortcut("snack")}
                      className="px-3 py-1.5 text-[11px] font-black rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition duration-150 cursor-pointer"
                    >
                      {t("grocery.toggle_snack")}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetMultipliers}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-lg border border-red-100 dark:border-red-950/30 bg-red-50/50 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30 text-red-650 dark:text-red-400 transition duration-150 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ fontSize: "14px" }}>restart_alt</span>
                    {t("grocery.reset_rations")}
                  </button>
                </div>

                <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/40 w-max max-w-full">
                  <span className="text-xs font-bold text-zinc-550 dark:text-zinc-400">{t("grocery.global_multiplier")}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const newMult = Math.max(0.5, Math.round((globalMultiplier - 0.5) * 10) / 10);
                        setGlobalMultiplier(newMult);
                        setDayMultipliers({});
                        setMealMultipliers({});
                      }}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs hover:bg-zinc-50 cursor-pointer text-slate-700 dark:text-zinc-300 select-none"
                    >
                      -
                    </button>
                    <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5 w-14">
                      <span className="text-xs font-bold text-zinc-400 select-none">x</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        className="w-full text-xs font-extrabold text-emerald-600 dark:text-emerald-400 text-center bg-transparent focus:outline-none focus:ring-0 border-none p-0"
                        value={globalMultiplier}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0.5) {
                            setGlobalMultiplier(val);
                            setDayMultipliers({});
                            setMealMultipliers({});
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newMult = Math.round((globalMultiplier + 0.5) * 10) / 10;
                        setGlobalMultiplier(newMult);
                        setDayMultipliers({});
                        setMealMultipliers({});
                      }}
                      className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs hover:bg-zinc-50 cursor-pointer text-slate-700 dark:text-zinc-300 select-none"
                    >
                      +
                    </button>
                  </div>
                </div>

                {listType !== "semanal" && (
                  <div className="space-y-3 pt-1">
                    {daysToAggregate.map((dayKey) => {
                      const dayMeals = plan.days[dayKey as keyof typeof plan.days] || {};
                      const dayLabel = t("weekdays." + dayKey);
                      const dayMult = dayMultipliers[dayKey] ?? 1;

                      return (
                        <div
                          key={dayKey}
                          className="grid grid-cols-2 sm:grid-cols-[165px_1fr_1fr_1fr_1fr] gap-3 items-center p-3.5 bg-slate-50/50 dark:bg-zinc-950/20 rounded-2xl border border-slate-100 dark:border-zinc-800/40"
                        >
                          <div className="col-span-2 sm:col-span-1 flex flex-row sm:flex-col justify-between items-center sm:items-start gap-1.5 p-1">
                            <span className="text-xs font-black text-slate-800 dark:text-zinc-200">{dayLabel}</span>
                            <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                              <span className="mb-0.5">{t("grocery.day_multiplier")}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = Math.max(0.5, dayMult - 0.5);
                                    setDayMultipliers(prev => ({ ...prev, [dayKey]: val }));
                                  }}
                                  className="w-5 h-5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-[10px] hover:bg-slate-50 cursor-pointer text-slate-700 dark:text-zinc-300"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center text-emerald-600 dark:text-emerald-400 font-extrabold">
                                  x{dayMult.toFixed(1)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = dayMult + 0.5;
                                    setDayMultipliers(prev => ({ ...prev, [dayKey]: val }));
                                  }}
                                  className="w-5 h-5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-[10px] hover:bg-slate-50 cursor-pointer text-slate-700 dark:text-zinc-300"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          {(["breakfast", "lunch", "snack", "dinner"] as const).map((mealKey) => {
                            const recipe = dayMeals[mealKey];
                            const exists = !!recipe;
                            const mealId = `${dayKey}-${mealKey}`;
                            const isExcluded = excludedMeals.includes(mealId);
                            const isIncluded = exists && !isExcluded;
                            const mealMult = mealMultipliers[mealId] ?? 1;

                            if (!exists) {
                              return (
                                <div
                                  key={mealKey}
                                  className="col-span-1 min-h-[64px] flex items-center justify-center p-2 rounded-xl bg-slate-100/30 dark:bg-zinc-900/20 border border-dashed border-slate-200/50 dark:border-zinc-800/60 text-[9px] text-slate-350 dark:text-zinc-650 font-extrabold uppercase select-none"
                                >
                                  {t("grocery.na")}
                                </div>
                              );
                            }

                            return (
                              <div
                                key={mealKey}
                                className={`col-span-1 min-h-[64px] flex flex-col items-center justify-center p-2 rounded-xl border transition duration-150 ${
                                  isIncluded
                                    ? "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800/80 shadow-sm"
                                    : "bg-slate-100/40 dark:bg-zinc-900/10 border-transparent opacity-50"
                                }`}
                              >
                                <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-750 dark:text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={isIncluded}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setExcludedMeals(prev => prev.filter(k => k !== mealId));
                                      } else {
                                        setExcludedMeals(prev => [...prev, mealId]);
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer dark:bg-zinc-900"
                                  />
                                  <span>{mealNames[mealKey]}</span>
                                </label>
                                {isIncluded && (
                                  <div className="flex items-center gap-1 mt-1.5 text-[9px] font-semibold text-slate-400">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = Math.max(0.5, mealMult - 0.5);
                                        setMealMultipliers(prev => ({ ...prev, [mealId]: val }));
                                      }}
                                      className="w-4 h-4 rounded bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-[9px] hover:bg-slate-100 cursor-pointer text-slate-650 dark:text-zinc-350"
                                    >
                                      -
                                    </button>
                                    <span className="w-7 text-center font-extrabold text-emerald-600 dark:text-emerald-400">
                                      x{mealMult.toFixed(1)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const val = mealMult + 0.5;
                                        setMealMultipliers(prev => ({ ...prev, [mealId]: val }));
                                      }}
                                      className="w-4 h-4 rounded bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-[9px] hover:bg-slate-100 cursor-pointer text-slate-650 dark:text-zinc-350"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {totalGroceryItemsCount > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            {sortedGroupKeys.map((groupName) => (
              <div key={groupName} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800/80 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-4 border-b border-emerald-50 dark:border-zinc-800/55 pb-2.5 flex items-center gap-2">
                  <span className={`material-symbols-outlined p-1 rounded-md border flex items-center justify-center shrink-0 ${getCategoryColorClass(groupName)}`} style={{ fontSize: "14px" }}>
                    {getCategoryIcon(groupName)}
                  </span>
                  {groupName}
                </h3>
                <ul className="space-y-3">
                  {categorizedGroups[groupName]
                    .map((item) => {
                      const isChecked = !!checkedItems[item.name];
                      return (
                      <div key={item.name} className={`space-y-1.5 ${isChecked && shareExcludeCompleted ? "print:hidden" : ""}`}>
                        <li
                          onClick={() => toggleChecked(item.name)}
                          className={`flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-150 cursor-pointer ${isChecked
                            ? "bg-gray-50 dark:bg-zinc-950/40 border-gray-100/60 dark:border-zinc-900 opacity-60 text-gray-400 dark:text-zinc-500"
                            : "bg-[#f6f9ff]/30 dark:bg-zinc-800/25 border-transparent hover:border-emerald-600/15"
                            }`}
                        >
                          <button
                            type="button"
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isChecked
                              ? "bg-[#0f5238] border-[#0f5238] text-white"
                              : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 group-hover:border-emerald-600"
                              }`}
                          >
                            {isChecked && (
                              <span className="material-symbols-outlined leading-none select-none font-extrabold" style={{ fontSize: "14px" }}>
                                check
                              </span>
                            )}
                          </button>
                          <div className="flex-grow select-text flex items-center gap-2 flex-wrap">
                            <span className={`text-sm md:text-md font-semibold ${isChecked ? "line-through text-slate-400 dark:text-zinc-500" : "text-gray-800 dark:text-zinc-200"}`}>
                              {item.name}
                            </span>
                            {item.recipes && item.recipes.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => toggleRecipesExpanded(e, item.name)}
                                className="text-[9px] font-extrabold text-slate-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 bg-slate-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-zinc-700/50 cursor-pointer transition active:scale-95 no-print"
                                title={t("grocery.see_recipes_title")}
                              >
                                {item.recipes.length === 1 ? t("grocery.recipe_count_singular") : t("grocery.recipe_count_plural", { count: item.recipes.length })}
                              </button>
                            )}
                          </div>
                          <span className={`text-xs md:text-sm font-bold px-2.5 py-1 rounded-md shrink-0 transition duration-150 ${isChecked ? "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                            }`}>
                            {(() => {
                              if (item.secondaryTotal && item.secondaryUnit) {
                                const sec = formatAmountAndUnit(item.secondaryTotal, item.secondaryUnit);
                                const pri = formatAmountAndUnit(item.total, item.unit);
                                return (
                                  <span>
                                    {sec.amount} {sec.unit}
                                    <span className="text-[10px] opacity-75 ml-1 font-semibold">
                                      ({pri.amount} {pri.unit})
                                    </span>
                                  </span>
                                );
                              } else {
                                const pri = formatAmountAndUnit(item.total, item.unit);
                                return <span>{pri.amount} {pri.unit}</span>;
                              }
                            })()}
                          </span>
                        </li>
                        {expandedRecipes[item.name] && item.recipes && (
                          <div 
                            className="ml-9 p-3 bg-slate-50/40 dark:bg-zinc-900/20 rounded-2xl border border-slate-200/70 dark:border-zinc-800/40 space-y-2 animate-fade-in text-xs no-print max-w-xl"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[10px] font-extrabold uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
                              {t("grocery.used_in")}
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {item.recipes.map((recRef) => {
                                const mealStyleMap: Record<string, string> = {
                                  breakfast: "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 border-orange-100/50 dark:border-orange-900/30",
                                  lunch: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30",
                                  snack: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100/50 dark:border-amber-900/30",
                                  dinner: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/30"
                                };
                                return (
                                  <a
                                    key={`${recRef.day}-${recRef.meal}`}
                                    href={`/recipe/${recRef.day}/${recRef.meal}`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      window.history.pushState(null, "", `/recipe/${recRef.day}/${recRef.meal}`);
                                      window.dispatchEvent(new PopStateEvent("popstate"));
                                    }}
                                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3.5 px-3.5 py-2.5 bg-white dark:bg-zinc-900 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/15 border border-slate-200/70 dark:border-zinc-800 rounded-xl transition duration-150 group"
                                  >
                                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                                      <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-350 w-16 text-center">
                                        {t("weekdays." + recRef.day).slice(0, 3)}
                                      </span>
                                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md border w-20 text-center ${mealStyleMap[recRef.meal] || "bg-slate-50 text-slate-500"}`}>
                                        {mealNames[recRef.meal] || recRef.meal}
                                      </span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-zinc-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate text-left">
                                      {recRef.recipeName}
                                    </span>
                                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded border border-emerald-100/50 dark:border-emerald-900/30 shrink-0 text-right">
                                      {(() => {
                                        if (recRef.secondaryAmount && recRef.secondaryUnit) {
                                          const sec = formatAmountAndUnit(recRef.secondaryAmount, recRef.secondaryUnit);
                                          return <span>{sec.amount} {sec.unit}</span>;
                                        } else {
                                          const pri = formatAmountAndUnit(recRef.amount, recRef.unit);
                                          return <span>{pri.amount} {pri.unit}</span>;
                                        }
                                      })()}
                                    </span>
                                    <span className="material-symbols-outlined text-slate-400 group-hover:text-emerald-600 transition shrink-0 select-none opacity-60 group-hover:opacity-100" style={{ fontSize: "10px" }}>
                                      arrow_forward
                                    </span>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <aside className="space-y-6">
            <div id="share-section" className="bg-white dark:bg-zinc-900 w-full p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 no-print animate-fade-in">
              <h3 className="text-md font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400" style={{ fontSize: "20px" }}>content_paste_search</span>
                {t("grocery.manage_share_title")}
              </h3>
              <p className="text-xs text-[#404943] dark:text-zinc-400 leading-relaxed">
                {t("grocery.manage_share_desc")}
              </p>

              <div className="bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 space-y-2.5">
                <span className="text-[10px] font-extrabold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider block mb-1">
                  {t("grocery.filter_options")}
                </span>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-zinc-200 select-none relative group/tooltip">
                  <input
                    type="checkbox"
                    checked={excludeCompletedRecipes}
                    onChange={(e) => setExcludeCompletedRecipes(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer dark:bg-zinc-900"
                  />
                  <span className="flex items-center gap-1">
                    {t("grocery.exclude_completed")}
                    <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-550 cursor-help" style={{ fontSize: "14px" }}>info</span>
                  </span>
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 shadow-md z-30 leading-normal font-medium text-center">
                    {t("grocery.exclude_completed_tooltip")}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-zinc-200 select-none relative group/tooltip">
                  <input
                    type="checkbox"
                    checked={shareExcludeCompleted}
                    onChange={(e) => setShareExcludeCompleted(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer dark:bg-zinc-900"
                  />
                  <span className="flex items-center gap-1">
                    {t("grocery.omit_checked")}
                    <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-550 cursor-help" style={{ fontSize: "14px" }}>info</span>
                  </span>
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 shadow-md z-30 leading-normal font-medium text-center">
                    {t("grocery.omit_checked_tooltip")}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-zinc-200 select-none relative group/tooltip">
                  <input
                    type="checkbox"
                    checked={shareIncludeCheckboxes}
                    onChange={(e) => setShareIncludeCheckboxes(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer dark:bg-zinc-900"
                  />
                  <span className="flex items-center gap-1">
                    {t("grocery.include_checkboxes")}
                    <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-500 cursor-help" style={{ fontSize: "14px" }}>info</span>
                  </span>
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 shadow-md z-30 leading-normal font-medium text-center">
                    {t("grocery.include_checkboxes_tooltip")}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-zinc-200 select-none relative group/tooltip">
                  <input
                    type="checkbox"
                    checked={shareGroupByCategories}
                    onChange={(e) => setShareGroupByCategories(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer dark:bg-zinc-900"
                  />
                  <span className="flex items-center gap-1">
                    {t("grocery.group_by_categories")}
                    <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-500 cursor-help" style={{ fontSize: "14px" }}>info</span>
                  </span>
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 shadow-md z-30 leading-normal font-medium text-center">
                    {t("grocery.group_by_categories_tooltip")}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-700 dark:text-zinc-200 select-none relative group/tooltip">
                  <input
                    type="checkbox"
                    checked={shareIncludeQuantities}
                    onChange={(e) => setShareIncludeQuantities(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer dark:bg-zinc-900"
                  />
                  <span className="flex items-center gap-1">
                    {t("grocery.include_quantities")}
                    <span className="material-symbols-outlined text-zinc-400 dark:text-zinc-500 cursor-help" style={{ fontSize: "14px" }}>info</span>
                  </span>
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-150 shadow-md z-30 leading-normal font-medium text-center">
                    {t("grocery.include_quantities_tooltip")}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSaveListToDB}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition duration-200 font-bold text-xs cursor-pointer active:scale-[0.98] shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1", fontSize: "16px" }}>save</span>
                  {t("grocery.save_list")}
                </button>
                <button
                  type="button"
                  onClick={handleLoadListFromDB}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl transition duration-200 font-bold text-xs cursor-pointer active:scale-[0.98] border border-zinc-200 dark:border-zinc-700"
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontSize: "16px" }}>folder_open</span>
                  {t("grocery.restore")}
                </button>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full bg-[#0f5238] hover:bg-[#116c4a] text-white font-bold text-xs py-3 rounded-xl transition duration-200 shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontSize: "16px" }}>print</span>
                  {t("grocery.print_list")}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyToClipboard}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl transition duration-200 font-bold text-xs border border-zinc-200/80 dark:border-zinc-800 cursor-pointer active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-zinc-500 dark:text-zinc-400 text-[16px]" style={{ fontSize: "16px" }}>
                      {copied ? "check_circle" : "content_copy"}
                    </span>
                    <span>{copied ? t("grocery.copied") : t("grocery.copy")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 dark:bg-[#25D366]/15 dark:hover:bg-[#25D366]/25 text-[#075e54] dark:text-[#4fce5d] rounded-xl transition duration-200 font-bold text-xs border border-[#25D366]/20 cursor-pointer active:scale-[0.98]"
                  >
                    <svg className="w-[15px] h-[15px] fill-current text-[#25D366] dark:text-[#4fce5d]" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.437.002 9.861-4.416 9.863-9.864.001-2.639-1.02-5.12-2.874-6.978-1.855-1.857-4.327-2.88-6.967-2.881-5.439 0-9.865 4.42-9.867 9.867-.001 1.867.501 3.585 1.45 5.161l-.952 3.479 3.565-.936zm11.597-5.495c-.32-.16-1.89-.93-2.185-1.04-.294-.11-.51-.16-.723.16-.214.32-.827 1.04-1.013 1.252-.186.213-.372.24-.692.08-.32-.16-1.353-.5-2.577-1.6-.952-.85-1.594-1.9-1.782-2.22-.186-.32-.02-.492.14-.65.143-.142.32-.37.48-.557.16-.188.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.723-1.74-.99-2.39-.26-.63-.526-.54-.723-.55-.187-.01-.4-.01-.613-.01-.213 0-.56.08-.853.4-.293.32-1.118 1.1-1.118 2.68 0 1.58 1.15 3.11 1.31 3.32.16.21 2.263 3.456 5.482 4.848.765.33 1.362.528 1.826.674.77.244 1.47.21 2.02.128.618-.092 1.89-.77 2.157-1.48.266-.71.266-1.32.186-1.45-.08-.13-.294-.21-.614-.37z" />
                    </svg>
                    <span>WhatsApp</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-[#229ED9]/10 hover:bg-[#229ED9]/20 dark:bg-[#229ED9]/15 dark:hover:bg-[#229ED9]/25 text-[#0e7ab8] dark:text-[#5bbfef] rounded-xl transition duration-200 font-bold text-xs border border-[#229ED9]/20 cursor-pointer active:scale-[0.98]"
                  >
                    <svg className="w-[15px] h-[15px] fill-current" viewBox="0 0 24 24">
                      <path d="M11.994 0C5.369 0 0 5.369 0 11.994S5.369 24 11.994 24 24 18.631 24 12.006C24 5.369 18.631 0 11.994 0zm5.935 8.17l-2.006 9.457c-.145.658-.537.818-1.086.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.06 14.549l-2.95-.924c-.641-.203-.654-.641.136-.95l11.533-4.448c.536-.194 1.004.131.16 4.194-.84 3.944z"/>
                    </svg>
                    <span>Telegram</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareInstagram}
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-[#E1306C]/10 hover:bg-[#E1306C]/20 dark:bg-[#E1306C]/15 dark:hover:bg-[#E1306C]/25 text-[#b5185a] dark:text-[#f06292] rounded-xl transition duration-200 font-bold text-xs border border-[#E1306C]/20 cursor-pointer active:scale-[0.98]"
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
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-[#FBBC05]/10 hover:bg-[#FBBC05]/20 dark:bg-[#FBBC05]/15 dark:hover:bg-[#FBBC05]/25 text-[#c29202] dark:text-[#fcd34d] rounded-xl transition duration-200 font-bold text-xs border border-[#FBBC05]/20 cursor-pointer active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#FBBC05]" style={{ fontSize: "16px" }}>lightbulb</span>
                    <span>{copiedKeep ? t("grocery.keep_ellipsis") : t("grocery.google_keep")}</span>
                  </button>

                  {canShare && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 rounded-xl transition duration-200 font-bold text-xs border border-emerald-100/80 dark:border-emerald-900/30 cursor-pointer active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-[16px]" style={{ fontSize: "16px" }}>share</span>
                      {t("grocery.share")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-zinc-900 w-full p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm text-left">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400" style={{ fontSize: "18px" }}>fact_check</span>
                {t("grocery.shopping_tips_title")}
              </h3>
              <p className="text-xs text-[#404943] dark:text-zinc-300 leading-relaxed mb-4">
                {t("grocery.shopping_tips_desc")}
              </p>
              <ul className="space-y-2.5 text-xs text-gray-650 dark:text-zinc-400 list-disc list-inside">
                <li>{t("grocery.tip_fresh_veggies")}</li>
                <li>{t("grocery.tip_expiration")}</li>
                <li>{t("grocery.tip_reusable_bags")}</li>
              </ul>
            </div>
          </aside>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-gray-200 dark:border-zinc-800 max-w-lg mx-auto shadow-sm">
          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-zinc-600 mb-4 font-light">shopping_bag</span>
          <p className="text-gray-900 dark:text-white font-bold text-lg mb-1">{t("grocery.empty_title")}</p>
          <p className="text-sm text-[#404943] dark:text-zinc-400 leading-relaxed">
            {t("grocery.empty_desc")}
          </p>
        </div>
      )}

      <ConfirmationModal
        isOpen={showShareWarning}
        title={t("general.share_local_warning_title")}
        description={t("general.share_local_warning")}
        confirmLabel={t("general.understood")}
        icon="info"
        variant="info"
        showCancel={false}
        onCancel={() => {
          setShowShareWarning(false);
          pendingShareRef.current = null;
        }}
        onConfirm={handleDismissShareWarning}
      />

      <ConfirmationModal
        isOpen={!!notification}
        title={notification?.title || ""}
        description={notification?.description || ""}
        confirmLabel={t("grocery.got_it")}
        icon={notification?.icon}
        variant={notification?.variant}
        showCancel={false}
        onCancel={() => setNotification(null)}
        onConfirm={() => setNotification(null)}
      />
    </div>
  );
}
