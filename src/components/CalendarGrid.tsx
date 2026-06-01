import React from "react";
import { MealPlan, DayType, MealType, Recipe } from "../types";

interface CalendarGridProps {
  plan: MealPlan | null;
  onSelectRecipe: (day: DayType, meal: MealType, recipe: Recipe) => void;
  setActiveTab: (tab: string) => void;
}

export default function CalendarGrid({ plan, onSelectRecipe, setActiveTab }: CalendarGridProps) {
  const daysKeys: DayType[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const mealsKeys: MealType[] = ["desayuno", "almuerzo", "merienda", "cena"];

  // Dynamic calculation of current week dates
  const getCurrentWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    // Find Monday of the current week
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

    let startDayNum = 0;
    let endDayNum = 0;
    let startMonthLabel = "";
    let endMonthLabel = "";

    dayKeys.forEach((key, idx) => {
      const current = new Date(mondayVal);
      current.setDate(mondayVal.getDate() + idx);
      
      const num = current.getDate();
      const month = monthNames[current.getMonth()];
      
      if (idx === 0) {
        startDayNum = num;
        startMonthLabel = month;
      }
      if (idx === 6) {
        endDayNum = num;
        endMonthLabel = month;
      }

      // Check if this date matches today
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

    const weekRangeLabel = startMonthLabel === endMonthLabel
      ? `${startDayNum} - ${endDayNum} de ${startMonthLabel}`
      : `${startDayNum} de ${startMonthLabel} a ${endDayNum} de ${endMonthLabel}`;

    return { datesMap, weekRangeLabel };
  };

  const { datesMap, weekRangeLabel } = getCurrentWeekDates();

  const getNextMeal = (): { day: DayType; meal: MealType } => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
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

    // In case targetDay is "domingo", map Sunday to domingo
    const safeDay = (targetDay === "domingo" ? "domingo" : targetDay) as DayType;
    return { day: safeDay, meal };
  };

  const nextMeal = getNextMeal();

  const mealLabels: Record<MealType, string> = {
    desayuno: "Desayuno",
    almuerzo: "Almuerzo",
    merienda: "Merienda",
    cena: "Cena",
  };

  // Helper to count planned meals out of 28 total possible slots
  const getPlannedStats = () => {
    if (!plan) return { planned: 0, total: 28, percentage: 0 };
    let planned = 0;
    daysKeys.forEach((day) => {
      mealsKeys.forEach((meal) => {
        if (plan.days[day] && plan.days[day][meal]) {
          planned++;
        }
      });
    });
    return {
      planned,
      total: 28,
      percentage: Math.round((planned / 28) * 100),
    };
  };

  const stats = getPlannedStats();

  return (
    <div className="space-y-8 select-text">
      {/* Header without Date Filter (removed per request) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-950 dark:text-white tracking-tight font-sans animate-fade-in">Planificador Semanal de Comidas</h1>
          <p className="text-sm text-gray-550 dark:text-zinc-400">Visualiza, edita y organiza tu pauta nutricional compartida para todos.</p>
        </div>
      </div>

      {plan ? (
        <>
          {/* Main Desktop Grid Scrollable with deeper zinc/near-black theme */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-100 dark:border-zinc-800 shadow-sm overflow-x-auto print-area-container">
            <div className="min-w-[1000px] grid grid-cols-[135px_repeat(7,1fr)] gap-4">
              
              {/* Desktop Row Title Headers */}
              <div className="flex flex-col gap-4 text-right pr-4 font-semibold text-gray-400 dark:text-zinc-500 text-xs uppercase tracking-wider pt-10 select-none">
                <div className="h-28 flex items-center justify-end font-semibold text-gray-600 dark:text-zinc-300">Desayuno</div>
                <div className="h-28 flex items-center justify-end font-semibold text-gray-600 dark:text-zinc-300">Almuerzo</div>
                <div className="h-28 flex items-center justify-end font-semibold text-gray-600 dark:text-zinc-300">Merienda</div>
                <div className="h-28 flex items-center justify-end font-semibold text-gray-600 dark:text-zinc-300">Cena</div>
              </div>

              {/* Days Columns without Day numbers - showing weekday names Spanish directly */}
              {daysKeys.map((day) => {
                const label = datesMap[day];
                const isToday = label.isToday;

                return (
                  <div key={day} className={`flex flex-col gap-4 rounded-2xl p-1 transition-colors ${
                    isToday ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-500/10" : ""
                  }`}>
                    {/* Column Day Info Header - Only showing name list */}
                    <div className="text-center pb-2 select-none h-10 flex items-center justify-center">
                      <span className={`block text-xs font-black uppercase tracking-wider ${
                        isToday 
                          ? "text-emerald-700 dark:text-emerald-400 font-black animate-pulse" 
                          : "text-slate-600 dark:text-zinc-400 font-extrabold"
                      }`}>
                        {label.long}
                      </span>
                    </div>

                    {/* Meal slots for the active day */}
                    {mealsKeys.map((meal) => {
                      const recipe = plan.days[day]?.[meal];

                      const mealBorders: Record<MealType, string> = {
                        desayuno: "border-l-4 border-l-amber-450 dark:border-l-amber-500 border-slate-100 dark:border-zinc-800",
                        almuerzo: "border-l-4 border-l-emerald-450 dark:border-l-emerald-500 border-slate-100 dark:border-zinc-800",
                        merienda: "border-l-4 border-l-blue-450 dark:border-l-blue-500 border-slate-100 dark:border-zinc-800",
                        cena: "border-l-4 border-l-indigo-450 dark:border-l-indigo-500 border-slate-100 dark:border-zinc-800",
                      };

                      const mealLabelColors: Record<MealType, string> = {
                        desayuno: "text-amber-600 dark:text-amber-450",
                        almuerzo: "text-emerald-600 dark:text-emerald-450",
                        merienda: "text-blue-600 dark:text-blue-450",
                        cena: "text-indigo-600 dark:text-indigo-450",
                      };

                      if (recipe) {
                        const isFocused = day === nextMeal.day && meal === nextMeal.meal;
                        return (
                          <div
                            key={meal}
                            onClick={() => onSelectRecipe(day, meal, recipe)}
                            className={`group h-28 p-3 rounded-xl transition-all duration-300 cursor-pointer flex flex-col justify-between text-left relative ${
                              isFocused
                                ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-200 dark:ring-emerald-900/60 ring-offset-2 dark:ring-offset-zinc-950 scale-[1.03] z-10"
                                : "bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 shadow-sm hover:shadow-md hover:border-slate-350 dark:hover:border-zinc-700 text-slate-800 dark:text-zinc-100"
                            } ${mealBorders[meal]}`}
                          >
                            <div>
                              <div className="flex justify-between items-start gap-1">
                                <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 select-none ${
                                  isFocused ? "text-emerald-800 dark:text-emerald-300 font-extrabold" : mealLabelColors[meal]
                                }`}>
                                  {mealLabels[meal]}
                                </span>
                                {isFocused && (
                                  <span className="bg-red-520 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full select-none animate-bounce shadow">
                                    PRÓXIMA
                                  </span>
                                )}
                              </div>
                              <h3 className={`font-bold text-[11px] md:text-xs group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2 ${
                                isFocused ? "text-emerald-950 dark:text-emerald-100 font-black" : "text-slate-700 dark:text-slate-200"
                              }`} title={recipe.recipeName}>
                                {recipe.recipeName}
                              </h3>
                            </div>
                            
                            <div className="flex items-center justify-between mt-auto">
                              <div className="flex gap-1 select-none">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" title="Rico en nutrientes"></span>
                                {recipe.calories > 350 && <span className="w-2 h-2 rounded-full bg-orange-400" title="Alto aporte energético"></span>}
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded select-all ${
                                isFocused ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-350" : "bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-405"
                              }`}>
                                {recipe.calories} kcal
                              </span>
                            </div>
                            
                            {/* Hover indicators */}
                            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                              <span className="material-symbols-outlined text-[13px] text-emerald-700 bg-emerald-150 p-0.5 rounded select-none">
                                arrow_forward
                              </span>
                            </div>
                          </div>
                        );
                      } else {
                        // Empty Slot
                        return (
                          <div
                            key={meal}
                            className="bg-slate-50/50 dark:bg-zinc-900/30 hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 border-2 border-dashed border-slate-200 dark:border-zinc-800 hover:border-emerald-500/30 rounded-xl h-28 flex flex-col items-center justify-center p-3 text-center transition-all duration-200 cursor-help"
                            title="Haz clic o utiliza un PDF para añadir una comida pautada en este slot."
                          >
                            <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 group-hover:text-emerald-500 text-lg select-none">
                              add_circle
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold mt-1 select-none">Sin Pautar</span>
                          </div>
                        );
                      }
                    })}

                  </div>
                );
              })}

            </div>
          </div>

          {/* Bottom stats/insights summary section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
            
            {/* Weekly progress card details */}
            <div className="bg-white/80 dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between select-text">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-gray-700 dark:text-slate-200">Porcentaje de Completitud</h4>
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                  {stats.percentage}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentage}%` }}
                ></div>
              </div>
              <p className="mt-4 text-xs text-[#404943] dark:text-slate-400 leading-relaxed text-left">
                ¡Excelente progreso! Tienes <span className="font-bold text-gray-900 dark:text-white">{stats.planned} de 28 comidas</span> pautadas y vinculadas con las métricas nutricionales en tu calendario.
              </p>
            </div>

            {/* Top calorie macro card */}
            <div className="bg-white/80 dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between select-text text-left">
              <h4 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-4">Aporte Proteico Estimado</h4>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-[#0f5238] dark:text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40 select-none">
                  <span className="material-symbols-outlined">restaurant</span>
                </div>
                <div>
                  <span className="block font-bold text-md text-gray-950 dark:text-white">Proteína Balanceada</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                    Provee un aporte de alta biodisponibilidad para preservar la masa muscular activa.
                  </span>
                </div>
              </div>
            </div>

            {/* Shopping quick link card helper */}
            <div className="bg-white/80 dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 select-text text-left">
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-1">Lista de la Compra Inteligente</h4>
                <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed">
                  Calculada en base a los ingredientes del plan actual, organizada y optimizada de forma inmediata.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTab("grocery")}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition duration-200 active:scale-95 shadow-sm shrink-0 cursor-pointer"
              >
                Ver Lista
              </button>
            </div>

          </section>
        </>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-800 max-w-lg mx-auto">
          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-slate-600 mb-4 font-light">soup_kitchen</span>
          <p className="text-slate-950 dark:text-white font-bold text-lg mb-1">No hay ningún plan cargado</p>
          <p className="text-sm text-[#404943] dark:text-slate-400 leading-relaxed mb-6">
            Por favor, vuelve al Dashboard principal y sube un plan semanal de alimentación en formato PDF de forma instantánea.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-full cursor-pointer transition-all active:scale-95 duration-150"
          >
            Volver al Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
