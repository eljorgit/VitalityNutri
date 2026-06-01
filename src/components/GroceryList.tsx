import React, { useState, useMemo } from "react";
import { MealPlan, Ingredient } from "../types";

interface GroceryListProps {
  plan: MealPlan | null;
}

export default function GroceryList({ plan }: GroceryListProps) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [listType, setListType] = useState<"semanal" | "3dias" | "diario">("semanal");

  const getDefaultDay = (): string => {
    const days = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    const date = new Date();
    let dayOfWeekIndex = date.getDay();
    // If local hour is 19:00 (7 PM) or later, default to the next day
    if (date.getHours() >= 19) {
      dayOfWeekIndex = (dayOfWeekIndex + 1) % 7;
    }
    return days[dayOfWeekIndex];
  };

  const [selectedSingleDay, setSelectedSingleDay] = useState<string>(() => getDefaultDay());
  const [selected3DaysStart, setSelected3DaysStart] = useState<string>(() => getDefaultDay());

  const getTodayDayType = (): string => {
    const dayOfWeek = new Date().getDay(); // 0 (Sunday) to 6 (Saturday)
    const daysMap = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    return daysMap[dayOfWeek];
  };

  const getDayNameSpanish = (dayKeyStr: string): string => {
    const names: Record<string, string> = {
      lunes: "Lunes",
      martes: "Martes",
      miercoles: "Miércoles",
      jueves: "Jueves",
      viernes: "Viernes",
      sabado: "Sábado",
      domingo: "Domingo"
    };
    return names[dayKeyStr] || dayKeyStr;
  };

  // Helper to standardize common ingredient names like "huevo duro" or "huevos" into "Huevo"
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

  // Compile and aggregate list of ingredients based on listType
  const aggregatedIngredients = useMemo(() => {
    if (!plan) return [];

    const map: Record<string, { 
      name: string; 
      total: number; 
      unit: string; 
      secondaryTotal?: number; 
      secondaryUnit?: string; 
    }> = {};

    let daysToAggregate: string[] = [];
    if (listType === "semanal") {
      daysToAggregate = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    } else if (listType === "3dias") {
      const weekdays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
      const startIndex = weekdays.indexOf(selected3DaysStart);
      daysToAggregate = [
        weekdays[startIndex],
        weekdays[(startIndex + 1) % 7],
        weekdays[(startIndex + 2) % 7]
      ];
    } else {
      daysToAggregate = [selectedSingleDay];
    }

    daysToAggregate.forEach((dayKey) => {
      const dayMeals = plan.days[dayKey as keyof typeof plan.days];
      if (dayMeals) {
        Object.values(dayMeals).forEach((recipe) => {
          if (recipe && recipe.ingredients) {
            recipe.ingredients.forEach((ing) => {
              const stdName = getStandardIngredientName(ing.name);
              const key = stdName.toLowerCase();
              if (map[key]) {
                map[key].total += ing.originalAmount;
                if (ing.secondaryAmount) {
                  map[key].secondaryTotal = (map[key].secondaryTotal || 0) + ing.secondaryAmount;
                }
              } else {
                map[key] = {
                  name: stdName,
                  total: ing.originalAmount,
                  unit: ing.unit,
                  secondaryTotal: ing.secondaryAmount,
                  secondaryUnit: ing.secondaryUnit
                };
              }
            });
          }
        });
      }
    });

    return Object.values(map);
  }, [plan, listType, selected3DaysStart, selectedSingleDay]);

  // Categorize ingredient by matching names with basic keywords
  const categorizeIngredient = (name: string): string => {
    const nameLow = name.toLowerCase();
    
    if (nameLow.includes("pollo") || nameLow.includes("pavo") || nameLow.includes("ternera") || nameLow.includes("jamón") || nameLow.includes("tofu") || nameLow.includes("huevo")) {
      return "Carnes, Huevos y Tofu";
    }
    if (nameLow.includes("salmón") || nameLow.includes("merluza") || nameLow.includes("pescado") || nameLow.includes("atún")) {
      return "Pescados y Mariscos";
    }
    if (nameLow.includes("espinaca") || nameLow.includes("aguacate") || nameLow.includes("lechuga") || nameLow.includes("romana") || nameLow.includes("tomate") || nameLow.includes("zanahoria") || nameLow.includes("cebóla") || nameLow.includes("cebolla") || nameLow.includes("brócoli") || nameLow.includes("pimiento") || nameLow.includes("apio") || nameLow.includes("alcachofa") || nameLow.includes("puerro")) {
      return "Verduras, Hortalizas y Frutas";
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

  // Group items together
  const categorizedGroups = useMemo(() => {
    const groups: Record<string, typeof aggregatedIngredients> = {};
    
    aggregatedIngredients.forEach((item) => {
      const category = categorizeIngredient(item.name);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });

    return groups;
  }, [aggregatedIngredients]);

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
      
      {/* Header with stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800 pb-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-gray-950 dark:text-white tracking-tight">Lista del Supermercado Inteligente</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Consolida y planifica tus compras. Filtra la duración de tu suministro de alimentos.</p>
        </div>

        {totalGroceryItemsCount > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-extrabold text-xs py-2 px-4 rounded-xl border border-emerald-100 dark:border-emerald-900/40 shrink-0 self-start lg:self-center">
            Completados: {checkedGroceryItemsCount} de {totalGroceryItemsCount} ({totalGroceryItemsCount > 0 ? Math.round((checkedGroceryItemsCount / totalGroceryItemsCount) * 100) : 0}%)
          </div>
        )}
      </div>

      {plan && (
        <div className="space-y-3 no-print select-none">
          {/* Main selection tabs */}
          <div className="flex flex-wrap gap-2 items-center bg-slate-100 dark:bg-zinc-800 p-1.5 rounded-2xl w-max border border-slate-250/50 dark:border-zinc-800/60 text-xs">
            {(["semanal", "3dias", "diario"] as const).map((type) => {
              const labels = {
                semanal: "Lista Semanal (L-D)",
                "3dias": "Plan de 3 días",
                diario: "Pauta Diaria"
              };
              const active = listType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setListType(type)}
                  className={`px-4 py-2 text-xs font-black rounded-xl transition duration-200 cursor-pointer ${
                    active 
                      ? "bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 shadow-sm border border-slate-100 dark:border-zinc-700/60" 
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {labels[type]}
                </button>
              );
            })}
          </div>

          {/* Sub-selector for 3-day starts */}
          {listType === "3dias" && (
            <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 w-full md:w-max animate-fade-in text-xs">
              <span className="font-extrabold text-slate-500 dark:text-zinc-400">Seleccionar rango de 3 días:</span>
              <div className="flex flex-wrap gap-1.5">
                {["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].map((startDay) => {
                  const weekdays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
                  const idx = weekdays.indexOf(startDay);
                  const day1 = getDayNameSpanish(weekdays[idx]);
                  const day2 = getDayNameSpanish(weekdays[(idx + 1) % 7]);
                  const day3 = getDayNameSpanish(weekdays[(idx + 2) % 7]);
                  
                  const isSelected = selected3DaysStart === startDay;
                  return (
                    <button
                      key={startDay}
                      type="button"
                      onClick={() => setSelected3DaysStart(startDay)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex flex-col items-center ${
                        isSelected 
                          ? "bg-emerald-600 text-white font-extrabold shadow-sm" 
                          : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-750 border border-slate-100 dark:border-zinc-800"
                      }`}
                    >
                      <span className="uppercase text-[9px] tracking-wide opacity-80">Empieza {day1}</span>
                      <span className="text-[10px] mt-0.5">{day1.slice(0,3)} • {day2.slice(0,3)} • {day3.slice(0,3)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sub-selector for single daily selection */}
          {listType === "diario" && (
            <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200/60 dark:border-zinc-800/80 w-full md:w-max animate-fade-in text-xs">
              <span className="font-extrabold text-slate-500 dark:text-zinc-400">Seleccionar día de la pauta:</span>
              <div className="flex flex-wrap gap-1.5">
                {["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].map((dayName) => {
                  const label = getDayNameSpanish(dayName);
                  const isSelected = selectedSingleDay === dayName;
                  return (
                    <button
                      key={dayName}
                      type="button"
                      onClick={() => setSelectedSingleDay(dayName)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isSelected 
                          ? "bg-emerald-600 text-white font-extrabold shadow-sm" 
                          : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-750 border border-slate-100 dark:border-zinc-800"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {totalGroceryItemsCount > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
           {/* Left / Middle Group list columns */}
          <div className="lg:col-span-2 space-y-6">
            {Object.keys(categorizedGroups).sort().map((groupName) => (
              <div key={groupName} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800/80 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-4 border-b border-emerald-50 dark:border-zinc-800/55 pb-2 flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-700 dark:bg-emerald-500"></span>
                  {groupName}
                </h3>
                <ul className="space-y-3">
                  {categorizedGroups[groupName].map((item) => {
                    const isChecked = !!checkedItems[item.name];
                    return (
                      <li 
                        key={item.name}
                        onClick={() => toggleChecked(item.name)}
                        className={`flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                          isChecked 
                            ? "bg-gray-50 dark:bg-zinc-950/40 border-gray-100/60 dark:border-zinc-900 opacity-60 text-gray-400 dark:text-zinc-500" 
                            : "bg-[#f6f9ff]/30 dark:bg-zinc-800/25 border-transparent hover:border-emerald-600/15"
                        }`}
                      >
                        <button
                          type="button"
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked 
                              ? "bg-[#0f5238] border-[#0f5238] text-white" 
                              : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 group-hover:border-emerald-600"
                          }`}
                        >
                          {isChecked && (
                            <span className="material-symbols-outlined text-[14px] leading-none select-none font-extrabold">
                              check
                            </span>
                          )}
                        </button>
                        <div className="flex-grow select-text">
                          <span className={`text-sm md:text-md font-semibold ${isChecked ? "line-through text-slate-400 dark:text-zinc-500" : "text-gray-800 dark:text-zinc-200"}`}>
                            {item.name}
                          </span>
                        </div>
                        <span className={`text-xs md:text-sm font-bold px-2.5 py-1 rounded-md shrink-0 transition duration-150 ${
                          isChecked ? "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-350"
                        }`}>
                          {item.secondaryTotal && item.secondaryUnit ? (
                            <span>
                              {Math.round(item.secondaryTotal * 100) / 100} {item.secondaryUnit}
                              <span className="text-[10px] opacity-75 ml-1 font-semibold">
                                ({Math.round(item.total * 100) / 100} {item.unit})
                              </span>
                            </span>
                          ) : (
                            <span>{Math.round(item.total * 100) / 100} {item.unit}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Right sidebar quick helpers */}
          <aside className="space-y-6">
            <div className="bg-slate-50 dark:bg-zinc-900 w-full p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-md font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#0f5238] dark:text-emerald-400">fact_check</span> Consejos de Compra
              </h3>
              <p className="text-xs text-[#404943] dark:text-zinc-300 leading-relaxed mb-4">
                Optimiza tus visitas al supermercado comprando alimentos a granel o congelando carnes y pescados para preservar sus propiedades nutrientes intactas.
              </p>
              <ul className="space-y-2.5 text-xs text-gray-650 dark:text-zinc-400 list-disc list-inside">
                <li>Compra verduras frescas de temporada.</li>
                <li>Verifica las fechas de caducidad.</li>
                <li>Usa bolsas reutilizables ecológicas.</li>
              </ul>
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full mt-6 bg-[#0f5238] hover:bg-[#116c4a] text-white font-bold text-xs py-3 rounded-xl transition duration-200 shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Imprimir Lista de Compras
              </button>
            </div>
          </aside>

        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-gray-150 dark:border-zinc-800 max-w-lg mx-auto shadow-sm">
          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-zinc-600 mb-4 font-light">shopping_bag</span>
          <p className="text-gray-900 dark:text-white font-bold text-lg mb-1">Tu lista está vacía</p>
          <p className="text-sm text-[#404943] dark:text-zinc-400 leading-relaxed">
            Sube tu plan de alimentación en PDF en el Dashboard principal para ver la lista de ingredientes consolidada de forma automática.
          </p>
        </div>
      )}
    </div>
  );
}
