import React from "react";
import { useTranslation } from "react-i18next";
import { MealPlan, DayType, MealType, Recipe } from "@src/types";

interface CalendarGridProps {
  plan: MealPlan | null;
  onSelectRecipe: (day: DayType, meal: MealType, recipe: Recipe) => void;
  setActiveTab: (tab: string) => void;
  completedRecipes: Record<string, boolean>;
  onToggleComplete: (day: DayType, meal: MealType) => void;
  onToggleDayComplete: (day: DayType, meals: MealType[], targetState: boolean) => void;
}

export default function CalendarGrid({ plan, onSelectRecipe, setActiveTab, completedRecipes, onToggleComplete, onToggleDayComplete }: CalendarGridProps) {
  const { t, i18n } = useTranslation();
  const daysKeys: DayType[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const mealsKeys: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

  const todayNameMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const currentDayOfWeekName = todayNameMap[new Date().getDay()];
  const initialMobileDay = daysKeys.includes(currentDayOfWeekName as DayType) ? (currentDayOfWeekName as DayType) : "monday";
  const [activeMobileDay, setActiveMobileDay] = React.useState<DayType>(initialMobileDay);
  const [showProgressModal, setShowProgressModal] = React.useState<boolean>(false);

  const gridScrollContainerRef = React.useRef<HTMLDivElement>(null);
  const todayColumnRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (showProgressModal) {
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
  }, [showProgressModal]);

  React.useEffect(() => {
    const container = gridScrollContainerRef.current;
    const todayCol = todayColumnRef.current;
    if (!container || !todayCol) return;
    const containerRect = container.getBoundingClientRect();
    const colRect = todayCol.getBoundingClientRect();
    const isFullyVisible =
      colRect.left >= containerRect.left &&
      colRect.right <= containerRect.right;
    if (!isFullyVisible) {
      const colOffsetLeft = todayCol.offsetLeft;
      const colWidth = todayCol.offsetWidth;
      const containerWidth = container.clientWidth;
      const targetScrollLeft = colOffsetLeft - containerWidth / 2 + colWidth / 2;
      container.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: "smooth" });
    }
  }, []);

  const [touchStartX, setTouchStartX] = React.useState<number | null>(null);
  const [touchStartY, setTouchStartY] = React.useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;
    const threshold = 60;
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
      const currentIndex = daysKeys.indexOf(activeMobileDay);
      if (diffX > 0) {
        if (currentIndex < daysKeys.length - 1) {
          setActiveMobileDay(daysKeys[currentIndex + 1]);
        }
      } else {
        if (currentIndex > 0) {
          setActiveMobileDay(daysKeys[currentIndex - 1]);
        }
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
  };

  const getCurrentWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayVal = new Date(today);
    mondayVal.setDate(today.getDate() + distanceToMonday);

    const datesMap: Record<DayType, { short: string; long: string; num: number; isToday: boolean; dateString: string }> = {} as any;
    const dayKeys: DayType[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const labels = {
      monday: { short: t("weekdays.monday_short"), long: t("weekdays.monday") },
      tuesday: { short: t("weekdays.tuesday_short"), long: t("weekdays.tuesday") },
      wednesday: { short: t("weekdays.wednesday_short"), long: t("weekdays.wednesday") },
      thursday: { short: t("weekdays.thursday_short"), long: t("weekdays.thursday") },
      friday: { short: t("weekdays.friday_short"), long: t("weekdays.friday") },
      saturday: { short: t("weekdays.saturday_short"), long: t("weekdays.saturday") },
      sunday: { short: t("weekdays.sunday_short"), long: t("weekdays.sunday") }
    };

    let startDayNum = 0;
    let endDayNum = 0;
    let startMonthLabel = "";
    let endMonthLabel = "";

    dayKeys.forEach((key, idx) => {
      const current = new Date(mondayVal);
      current.setDate(mondayVal.getDate() + idx);
      const num = current.getDate();
      const month = new Intl.DateTimeFormat(i18n.language, { month: "long" }).format(current);
      if (idx === 0) {
        startDayNum = num;
        startMonthLabel = month;
      }
      if (idx === 6) {
        endDayNum = num;
        endMonthLabel = month;
      }
      const isToday =
        current.getDate() === today.getDate() &&
        current.getMonth() === today.getMonth() &&
        current.getFullYear() === today.getFullYear();
      datesMap[key] = {
        short: labels[key].short,
        long: labels[key].long,
        num: num,
        dateString: `${num} ${month}`,
        isToday
      };
    });

    const weekRangeLabel = startMonthLabel === endMonthLabel
      ? `${startDayNum} - ${endDayNum} ${startMonthLabel}`
      : `${startDayNum} ${startMonthLabel} - ${endDayNum} ${endMonthLabel}`;

    return { datesMap, weekRangeLabel };
  };

  const { datesMap, weekRangeLabel } = getCurrentWeekDates();

  const getNextMeal = (): { day: DayType; meal: MealType } => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const hour = today.getHours();
    const daysMap: DayType[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDay = daysMap[dayOfWeek];
    let meal: MealType = "breakfast";
    let targetDay = currentDay;
    if (hour < 11) {
      meal = "breakfast";
    } else if (hour < 15) {
      meal = "lunch";
    } else if (hour < 19) {
      meal = "snack";
    } else if (hour < 22) {
      meal = "dinner";
    } else {
      meal = "breakfast";
      const tomorrowIndex = (dayOfWeek + 1) % 7;
      targetDay = daysMap[tomorrowIndex];
    }
    const safeDay = targetDay as DayType;
    return { day: safeDay, meal };
  };

  const nextMeal = getNextMeal();

  const mealLabels: Record<MealType, string> = {
    breakfast: t("meals.breakfast_cap"),
    lunch: t("meals.lunch_cap"),
    snack: t("meals.snack_cap"),
    dinner: t("meals.dinner_cap"),
  };

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
    const today = new Date();
    const dayOfWeek = today.getDay();
    const hour = today.getHours();
    const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek;
    const pastDaysMeals = (dayNum - 1) * 4;
    let todayMeals = 0;
    if (hour >= 22) {
      todayMeals = 4;
    } else if (hour >= 19) {
      todayMeals = 3;
    } else if (hour >= 15) {
      todayMeals = 2;
    } else if (hour >= 11) {
      todayMeals = 1;
    } else {
      todayMeals = 0;
    }
    const elapsedSlots = pastDaysMeals + todayMeals;
    const percentage = Math.round((elapsedSlots / 28) * 100);
    return {
      planned,
      total: 28,
      elapsedSlots,
      percentage,
    };
  };

  const stats = getPlannedStats();

  const getCompletedStats = () => {
    if (!plan) return { completed: 0, totalPlanned: 0, percentage: 0 };
    let completed = 0;
    let totalPlanned = 0;
    daysKeys.forEach((day) => {
      mealsKeys.forEach((meal) => {
        if (plan.days[day] && plan.days[day][meal]) {
          totalPlanned++;
          if (completedRecipes[`${day}-${meal}`]) {
            completed++;
          }
        }
      });
    });
    const percentage = totalPlanned > 0 ? Math.round((completed / totalPlanned) * 100) : 0;
    return { completed, totalPlanned, percentage };
  };

  const completedStats = getCompletedStats();

  return (
    <div className="space-y-8 select-text">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-950 dark:text-white tracking-tight font-sans animate-fade-in">{t("calendar.weekly_planner_title")}</h1>
          <p className="text-sm text-gray-550 dark:text-zinc-400">{t("calendar.weekly_planner_desc")}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 animate-fade-in no-print select-none">
          <button
            type="button"
            onClick={() => setActiveTab("batch-cooking")}
            className="flex items-center gap-2 px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-sm hover:shadow hover:scale-[1.02] active:scale-95 transition-all duration-150 cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-[16px]">outdoor_grill</span>
            {t("calendar.batch_cooking_btn")}
          </button>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs bg-white dark:bg-zinc-900 px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 w-fit">
            <span className="font-bold text-slate-500 dark:text-zinc-400">{t("calendar.legend_title")}:</span>
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/20"></span>
              {t("calendar.legend_nutrient_rich")}
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400/20"></span>
              {t("calendar.legend_high_energy")}
            </span>
          </div>
        </div>
      </div>      {plan ? (
        <>
          <div ref={gridScrollContainerRef} className="hidden md:block print:block bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-100 dark:border-zinc-800 shadow-sm overflow-x-auto print-area-container">
            <div className="min-w-[1076px] w-full grid grid-cols-7 gap-4">

              {daysKeys.map((day) => {
                const label = datesMap[day];
                const isToday = label.isToday;

                return (
                  <div key={day} ref={isToday ? todayColumnRef : undefined} className={`flex flex-col gap-4 rounded-2xl p-1 transition-colors ${
                    isToday ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-emerald-500/10" : ""
                  }`}>
                    <div className="text-center pb-2 select-none h-10 flex items-center justify-center">
                      <span className={`block text-xs font-black uppercase tracking-wider ${
                        isToday 
                          ? "text-emerald-700 dark:text-emerald-400 font-black animate-pulse" 
                          : "text-slate-600 dark:text-zinc-400 font-extrabold"
                      }`}>
                        {label.long}
                      </span>
                    </div>

                    {mealsKeys.map((meal) => {
                      const recipe = plan.days[day]?.[meal];

                      const mealBorders: Record<MealType, string> = {
                        breakfast: "border-l-4 border-l-amber-500 border-slate-100 dark:border-zinc-800",
                        lunch: "border-l-4 border-l-emerald-500 border-slate-100 dark:border-zinc-800",
                        snack: "border-l-4 border-l-blue-500 border-slate-100 dark:border-zinc-800",
                        dinner: "border-l-4 border-l-indigo-500 border-slate-100 dark:border-zinc-800",
                      };

                      const mealLabelColors: Record<MealType, string> = {
                        breakfast: "text-amber-600 dark:text-amber-400",
                        lunch: "text-emerald-600 dark:text-emerald-400",
                        snack: "text-blue-600 dark:text-blue-400",
                        dinner: "text-indigo-600 dark:text-indigo-400",
                      };

                      if (recipe) {
                        const isFocused = day === nextMeal.day && meal === nextMeal.meal;
                        const isCompleted = !!completedRecipes[`${day}-${meal}`];
                        return (
                          <div
                            key={meal}
                            onClick={() => onSelectRecipe(day, meal, recipe)}
                            className={`group h-28 p-3 rounded-xl transition-all duration-300 cursor-pointer flex flex-col justify-between text-left relative ${
                              isFocused
                                ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500 shadow-md ring-2 ring-emerald-500/20 dark:ring-emerald-900/60 ring-offset-2 dark:ring-offset-zinc-950 scale-[1.03] z-10"
                                : isCompleted
                                  ? "bg-emerald-50/30 dark:bg-emerald-950/15 border border-emerald-500/30 dark:border-emerald-500/25 shadow-sm hover:shadow-md hover:border-emerald-500 text-slate-800 dark:text-zinc-100"
                                  : "bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 shadow-sm hover:shadow-md hover:border-slate-350 dark:hover:border-zinc-700 text-slate-800 dark:text-zinc-100"
                            } ${mealBorders[meal]}`}
                          >
                            <div>
                              <div className="flex justify-between items-center gap-1 mb-1">
                                <span className={`block text-[9.5px] font-black uppercase tracking-wider select-none ${
                                  isFocused ? "text-emerald-800 dark:text-emerald-300 font-black" : mealLabelColors[meal]
                                }`}>
                                  {mealLabels[meal]}
                                </span>
                                <div className="flex items-center gap-1">
                                  {isCompleted && (
                                    <span className="bg-emerald-600 text-white rounded-full select-none shadow-sm shrink-0 flex items-center justify-center w-4 h-4 border border-emerald-500/20" title={t("calendar.completed_recipe_tooltip")}>
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                  )}
                                  {isFocused && !isCompleted && (
                                    <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-[7.5px] px-1.5 py-0.5 rounded-full select-none animate-pulse shadow-sm shrink-0">
                                      {t("calendar.next_label")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <h3 className={`font-bold text-[11px] md:text-xs group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors leading-snug line-clamp-2 ${
                                  isFocused ? "text-emerald-950 dark:text-emerald-100 font-black" : "text-slate-700 dark:text-zinc-200"
                              }`} title={recipe.recipeName}>
                                {recipe.recipeName}
                              </h3>
                            </div>
                            
                            <div className="flex items-center justify-between mt-auto">
                              <div className="flex gap-1 select-none">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" title={t("calendar.legend_nutrient_rich")}></span>
                                {recipe.calories > 350 && <span className="w-2 h-2 rounded-full bg-orange-400" title={t("calendar.legend_high_energy")}></span>}
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded select-all ${
                                isFocused ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-405"
                              }`}>
                                {recipe.calories} kcal
                              </span>
                            </div>
                            
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity no-print z-20">
                              <span className="material-symbols-outlined text-[13px] text-emerald-700 bg-emerald-100 dark:bg-zinc-800 dark:text-emerald-300 p-0.5 rounded-lg select-none shadow-sm border border-emerald-500/15">
                                arrow_forward
                              </span>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={meal}
                            className="bg-slate-50/50 dark:bg-zinc-900/30 hover:bg-slate-100/70 dark:hover:bg-zinc-800/50 border-2 border-dashed border-slate-200 dark:border-zinc-800 hover:border-emerald-500/30 rounded-xl h-28 flex flex-col items-center justify-center p-3 text-center transition-all duration-200 cursor-help"
                            title={t("calendar.empty_slot_tooltip", { meal: mealLabels[meal] })}
                          >
                            <span className={`block text-[9px] font-bold uppercase tracking-wider mb-1 select-none ${mealLabelColors[meal]}`}>
                              {mealLabels[meal]}
                            </span>
                            <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 group-hover:text-emerald-500 text-lg select-none">
                              add_circle
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-semibold mt-0.5 select-none">{t("calendar.not_planned")}</span>
                          </div>
                        );
                      }
                    })}

                  </div>
                );
              })}

            </div>
          </div>

          <div className="md:hidden print:hidden space-y-5">
            <div className="flex gap-2 overflow-x-auto pb-2 select-none justify-between border-b border-gray-200 dark:border-zinc-800/60 pr-1">
              {daysKeys.map((day) => {
                const label = datesMap[day];
                const isSelected = activeMobileDay === day;
                const isToday = label.isToday;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setActiveMobileDay(day)}
                    className={`flex flex-col items-center justify-center flex-1 min-w-[42px] py-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "bg-[#0f5238] border-[#0f5238] text-white shadow-sm font-bold scale-[1.02]"
                        : isToday
                           ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold"
                           : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800/80 text-slate-500 dark:text-zinc-400"
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-wider">
                      {label.short}
                    </span>
                  </button>
                );
              })}
            </div>

            <div 
              className="space-y-3.5"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {mealsKeys.map((meal) => {
                const recipe = plan.days[activeMobileDay]?.[meal];
                
                 const mealBorders: Record<MealType, string> = {
                   breakfast: "border-l-4 border-l-amber-500 dark:border-l-amber-500",
                   lunch: "border-l-4 border-l-emerald-500 dark:border-l-emerald-500",
                   snack: "border-l-4 border-l-blue-500 dark:border-l-blue-500",
                   dinner: "border-l-4 border-l-indigo-500 dark:border-l-indigo-500",
                 };

                 const mealLabelColors: Record<MealType, string> = {
                   breakfast: "text-amber-600 dark:text-amber-400",
                   lunch: "text-emerald-600 dark:text-emerald-400",
                   snack: "text-blue-600 dark:text-blue-400",
                   dinner: "text-indigo-600 dark:text-indigo-400",
                 };

                const isFocused = activeMobileDay === nextMeal.day && meal === nextMeal.meal;
                const isCompleted = !!completedRecipes[`${activeMobileDay}-${meal}`];

                if (recipe) {
                  return (
                    <div
                      key={meal}
                      onClick={() => onSelectRecipe(activeMobileDay, meal, recipe)}
                      className={`group p-4 rounded-2xl transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 border text-left ${
                        isFocused
                          ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/20 dark:ring-emerald-900/40"
                          : isCompleted
                            ? "bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-500/30 dark:border-emerald-500/25"
                            : "bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-350 dark:hover:border-zinc-700"
                      } ${mealBorders[meal]}`}
                    >
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            isFocused ? "text-emerald-800 dark:text-emerald-300" : mealLabelColors[meal]
                          }`}>
                            {mealLabels[meal]}
                          </span>
                          {isCompleted && (
                            <span className="bg-emerald-600 text-white rounded-full select-none shadow-sm shrink-0 flex items-center justify-center w-4 h-4 border border-emerald-500/20" title={t("calendar.completed_recipe_tooltip")}>
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                          {isFocused && !isCompleted && (
                            <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-[8px] px-2 py-0.5 rounded-full select-none animate-pulse shadow-sm">
                              {t("calendar.next_label")}
                            </span>
                          )}
                        </div>
                        <h3 className={`font-bold text-sm leading-snug line-clamp-2 ${
                          isFocused ? "text-emerald-950 dark:text-emerald-100 font-black" : "text-slate-700 dark:text-zinc-200"
                        }`}>
                          {recipe.recipeName}
                        </h3>
                        <div className="flex items-center justify-between gap-2 mt-2 select-none">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isFocused ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300" : "bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                          }`}>
                            {recipe.calories} kcal
                          </span>
                          <div className="flex gap-1.5 items-center mr-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" title={t("calendar.legend_nutrient_rich")}></span>
                            {recipe.calories > 350 && <span className="w-2.5 h-2.5 rounded-full bg-orange-400" title={t("calendar.legend_high_energy")}></span>}
                          </div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-slate-450 dark:text-zinc-500 group-hover:text-emerald-600 transition shrink-0 select-none">
                        arrow_forward
                      </span>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={meal}
                      className="bg-slate-50/40 dark:bg-zinc-950/20 border border-dashed border-slate-200 dark:border-zinc-800/60 rounded-2xl p-4 flex items-center justify-between gap-4 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-350 dark:text-zinc-650 select-none">
                          add_circle
                        </span>
                        <div className="text-left">
                          <span className={`text-[10px] font-black uppercase tracking-wider block ${mealLabelColors[meal]}`}>
                            {mealLabels[meal]}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-zinc-500 font-bold">{t("calendar.not_planned")}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 no-print">
            
            <div 
              onClick={() => setShowProgressModal(true)}
              className="bg-white/80 dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between select-text cursor-pointer hover:shadow-md hover:border-emerald-500/25 transition-all duration-200 group/card"
              title={t("calendar.click_for_weekly_list")}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-gray-700 dark:text-zinc-200 group-hover/card:text-emerald-700 dark:group-hover/card:text-emerald-400 transition-colors">{t("calendar.weekly_completion")}</h4>
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  {stats.percentage}%
                  <span className="material-symbols-outlined text-[14px]">list_alt</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentage}%` }}
                ></div>
              </div>
              <p className="mt-4 text-xs text-[#404943] dark:text-zinc-400 leading-relaxed text-left"
                 dangerouslySetInnerHTML={{
                   __html: t("calendar.weekly_completion_desc", {
                     elapsed: stats.elapsedSlots,
                     total: stats.total
                   })
                 }}
              />
            </div>

            <div 
              onClick={() => setShowProgressModal(true)}
              className="bg-white/80 dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between select-text cursor-pointer hover:shadow-md hover:border-emerald-500/25 transition-all duration-200 group/card"
              title={t("calendar.click_for_weekly_list")}
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-gray-700 dark:text-zinc-200 group-hover/card:text-emerald-700 dark:group-hover/card:text-emerald-400 transition-colors">{t("calendar.completed_recipes")}</h4>
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  {completedStats.percentage}%
                  <span className="material-symbols-outlined text-[14px]">list_alt</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${completedStats.percentage}%` }}
                ></div>
              </div>
              <p className="mt-4 text-xs text-[#404943] dark:text-zinc-400 leading-relaxed text-left"
                 dangerouslySetInnerHTML={{
                   __html: t("calendar.completed_recipes_desc", {
                     completed: completedStats.completed,
                     total: completedStats.totalPlanned
                   })
                 }}
              />
            </div>

            <div className="bg-white/80 dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-col justify-between select-text text-left">
              <h4 className="text-sm font-bold text-gray-700 dark:text-zinc-200 mb-4">{t("calendar.estimated_protein")}</h4>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/30 text-[#0f5238] dark:text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40 select-none">
                  <span className="material-symbols-outlined">restaurant</span>
                </div>
                <div>
                  <span className="block font-bold text-md text-gray-950 dark:text-white">{t("calendar.balanced_protein")}</span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed block mt-0.5">
                    {t("calendar.balanced_protein_desc")}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm flex items-center justify-between gap-4 select-text text-left">
              <div className="text-left">
                <h4 className="text-sm font-bold text-gray-700 dark:text-zinc-200 mb-1">{t("calendar.smart_grocery_list")}</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  {t("calendar.smart_grocery_list_desc")}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setActiveTab("grocery")}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition duration-200 active:scale-95 shadow-sm shrink-0 cursor-pointer"
              >
                {t("calendar.view_list_btn")}
              </button>
            </div>

          </section>
        </>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-zinc-800 max-w-lg mx-auto">
          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-zinc-600 mb-4 font-light">soup_kitchen</span>
          <p className="text-slate-950 dark:text-white font-bold text-lg mb-1">{t("calendar.no_plan_loaded")}</p>
          <p className="text-sm text-[#404943] dark:text-zinc-400 leading-relaxed mb-6">
            {t("calendar.no_plan_loaded_desc")}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-full cursor-pointer transition-all active:scale-95 duration-150"
          >
            {t("calendar.back_to_dashboard")}
          </button>
        </div>
      )}

      {showProgressModal && plan && (
        <div 
          className="modal-overlay fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print !mt-0"
          style={{ marginTop: 0 }}
        >
          <div 
            className="fixed inset-0" 
            onClick={() => setShowProgressModal(false)} 
            style={{ marginTop: 0 }}
          />
          <div 
            className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-150 dark:border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative z-10 select-none !mt-0"
            style={{ marginTop: 0 }}
          >
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/20 shrink-0">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[22px] text-emerald-600 dark:text-emerald-400">task_alt</span>
                  {t("calendar.weekly_progress_title")}
                </h3>
                <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-extrabold mt-0.5">
                  {t("calendar.weekly_progress_desc")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition duration-200 cursor-pointer flex items-center justify-center border border-slate-200/50 dark:border-zinc-700/50 shadow-xs"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-6">
              {daysKeys.map((day) => {
                const dayRecipes = mealsKeys.map(meal => ({ meal, recipe: plan.days[day]?.[meal] })).filter(item => !!item.recipe);
                if (dayRecipes.length === 0) return null;
                
                const label = datesMap[day];
                const dayMeals = dayRecipes.map(item => item.meal);
                const allCompleted = dayRecipes.every(({ meal }) => !!completedRecipes[`${day}-${meal}`]);

                return (
                  <div key={day} className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/60 pb-1.5 select-none">
                      <div className="flex items-center gap-2">
                        <span>{label.long}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleDayComplete(day, dayMeals, !allCompleted)}
                        className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors uppercase tracking-wider cursor-pointer bg-transparent border-0 outline-none"
                      >
                        {allCompleted ? t("calendar.uncheck_all") : t("calendar.check_all")}
                      </button>
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {dayRecipes.map(({ meal, recipe }) => {
                        const isCompleted = !!completedRecipes[`${day}-${meal}`];
                        const isFocused = day === nextMeal.day && meal === nextMeal.meal;
                        return (
                          <button
                            key={meal}
                            type="button"
                            onClick={() => onToggleComplete(day, meal)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition duration-150 cursor-pointer w-full group/item ${
                              isFocused
                                ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                                : isCompleted
                                  ? "bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500/20 text-slate-800 dark:text-zinc-250"
                                  : "bg-slate-50/50 hover:bg-slate-100/50 dark:bg-zinc-950/20 dark:hover:bg-zinc-800/40 border-transparent hover:border-emerald-600/10 text-slate-700 dark:text-zinc-350"
                            }`}
                          >
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
                                  isCompleted ? "text-emerald-600/70 dark:text-emerald-400/70" : "text-slate-400 dark:text-zinc-550"
                                }`}>
                                  {mealLabels[meal]}
                                </span>
                                {isFocused && !isCompleted && (
                                  <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-[7px] px-1.5 py-0.5 rounded-full select-none animate-pulse shadow-sm leading-none">
                                    {t("calendar.next_label")}
                                  </span>
                                )}
                              </div>
                              <span className={`block text-[11px] font-bold truncate ${
                                isCompleted ? "line-through text-slate-400 dark:text-zinc-500 opacity-70" : "text-slate-800 dark:text-zinc-200"
                              }`} title={recipe!.recipeName}>
                                {recipe!.recipeName}
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

            <div className="px-6 py-4.5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/20 shrink-0 flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-widest">
                {t("calendar.completed_count", { completed: completedStats.completed, total: completedStats.totalPlanned, percentage: completedStats.percentage })}
              </span>
              <button
                type="button"
                onClick={() => setShowProgressModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer"
              >
                {t("general.close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
