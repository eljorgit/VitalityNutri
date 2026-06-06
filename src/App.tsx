import React, { useState, useEffect, useRef, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import CalendarGrid from "./components/CalendarGrid";
import RecipeDetail from "./components/RecipeDetail";
import GroceryList from "./components/GroceryList";
import ConfirmationModal, { ConfirmationVariant } from "./components/ConfirmationModal";
import { MealPlan, PlanMetadata, DayType, MealType, Recipe } from "./types";

// --- Search Types ---
interface SearchRecipeItem {
  planId: number;
  planName: string;
  isActive: boolean;
  day: string;
  meal: string;
  recipeName: string;
  calories: number;
  time: string;
  tag: string;
  image: string;
  ingredientNames: string[];
}

interface SearchHistoryItem {
  id: number;
  planId: number;
  planName: string;
  day: string;
  meal: string;
  recipeName: string;
  image: string;
  isActive: boolean;
  clickedAt: string;
}

// Helper: normalize search text so comparisons ignore case, accents and punctuation.
function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(text: string): string {
  return normalizeSearchText(text).replace(/\s+/g, "");
}

function buildCompactIndex(text: string): { value: string; sourceIndexes: number[] } {
  const valueParts: string[] = [];
  const sourceIndexes: number[] = [];

  let sourceIndex = 0;
  for (const char of text) {
    const normalizedChar = char
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, "");

    for (const normalizedPart of Array.from(normalizedChar)) {
      valueParts.push(normalizedPart);
      sourceIndexes.push(sourceIndex);
    }
    sourceIndex += char.length;
  }

  return { value: valueParts.join(""), sourceIndexes };
}

function matchesSearchText(text: string, normalizedQuery: string, compactQuery: string): boolean {
  const normalizedText = normalizeSearchText(text);
  return normalizedText.includes(normalizedQuery) || compactSearchText(text).includes(compactQuery);
}

function getRecipeNameSearchScore(recipeName: string, normalizedQuery: string, compactQuery: string): number {
  const normalizedName = normalizeSearchText(recipeName);
  const compactName = compactSearchText(recipeName);

  if (normalizedName === normalizedQuery || compactName === compactQuery) return 100;
  if (normalizedName.startsWith(normalizedQuery) || compactName.startsWith(compactQuery)) return 80;
  if (normalizedName.includes(normalizedQuery) || compactName.includes(compactQuery)) return 50;
  return 0;
}

// Helper: split text and wrap matching parts in emerald span
function highlightText(text: string, query: string): React.ReactNode {
  const compactQuery = compactSearchText(query);
  if (!compactQuery) return text;

  const compactText = buildCompactIndex(text);
  const matchStart = compactText.value.indexOf(compactQuery);
  if (matchStart === -1) return text;

  const matchEnd = matchStart + compactQuery.length - 1;
  const sourceStart = compactText.sourceIndexes[matchStart];
  const sourceEnd = compactText.sourceIndexes[matchEnd] + 1;

  return (
    <>
      <span>{text.slice(0, sourceStart)}</span>
      <mark className="bg-transparent text-emerald-600 dark:text-emerald-400 font-extrabold not-italic">{text.slice(sourceStart, sourceEnd)}</mark>
      <span>{text.slice(sourceEnd)}</span>
    </>
  );
}

const MEAL_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
};
const DAY_LABELS: Record<string, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};


export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showResetPlanConfirmation, setShowResetPlanConfirmation] = useState(false);
  const [appNotification, setAppNotification] = useState<{
    title: string;
    description: string;
    icon: string;
    variant: ConfirmationVariant;
  } | null>(null);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [metadata, setMetadata] = useState<PlanMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedRecipes, setCompletedRecipes] = useState<Record<string, boolean>>({});

  // --- Search Engine State ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchPool, setSearchPool] = useState<SearchRecipeItem[]>([]);
  const [searchPoolLoaded, setSearchPoolLoaded] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);


  // Night/Dark theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" || document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  // Scroll lock effect when mobile search is open
  useEffect(() => {
    if (mobileSearchOpen) {
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
  }, [mobileSearchOpen]);

  // Scroll navigation visibility states
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);

      if (activeTab === "grocery") {
        const threshold = 300;
        const totalHeight = document.documentElement.scrollHeight;
        const viewHeight = window.innerHeight;
        const scrolled = window.scrollY;
        setShowScrollBottom(totalHeight - viewHeight - scrolled > threshold);
      } else {
        setShowScrollBottom(false);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [activeTab]);

  // Detail view parameters
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<{
    day: DayType;
    meal: MealType;
    recipe: Recipe;
  } | null>(null);

  const [pendingRecipe, setPendingRecipe] = useState<{ day: DayType; meal: MealType } | null>(null);

  // State for browsing historical (inactive) plan recipes
  const [inactiveRecipeDetail, setInactiveRecipeDetail] = useState<{
    day: DayType;
    meal: MealType;
    recipe: Recipe;
    planId: number;
  } | null>(null);
  const [isViewingActivePlan, setIsViewingActivePlan] = useState<boolean>(true);

  // Sync state from URL pathname
  const syncStateFromUrl = (urlPath: string) => {
    const qIndex = urlPath.indexOf("?");
    const pathname = qIndex === -1 ? urlPath : urlPath.slice(0, qIndex);
    const searchParams = new URLSearchParams(urlPath.slice(qIndex));
    const vParam = searchParams.get("v");
    
    if (!pathname || pathname === "/" || pathname.startsWith("/dashboard")) {
      setActiveTab("dashboard");
      setSelectedRecipeDetail(null);
    } else if (pathname.startsWith("/calendar")) {
      setActiveTab("calendar");
      setSelectedRecipeDetail(null);
    } else if (pathname.startsWith("/grocery")) {
      setActiveTab("grocery");
      setSelectedRecipeDetail(null);
    } else if (pathname.startsWith("/recipe/")) {
      const parts = pathname.split("/");
      if (parts.length >= 4) {
        const day = parts[2] as DayType;
        const meal = parts[3] as MealType;
        
        // If vParam matches current plan ID, proceed with standard logic
        if (plan && (!vParam || parseInt(vParam) === metadata?.id)) {
          const recipe = plan.days[day]?.[meal];
          if (recipe) {
            setSelectedRecipeDetail({ day, meal, recipe });
            setActiveTab("recipe-detail");
          } else {
            setActiveTab("calendar");
            setSelectedRecipeDetail(null);
          }
        } else if (vParam) {
          // Visiting a recipe from a different (inactive) plan — load it via dedicated endpoint
          const planId = parseInt(vParam, 10);
          setActiveTab("recipe-detail");
          // Reset previous inactive state while loading the new one
          setInactiveRecipeDetail(null);
          setSelectedRecipeDetail(null);
          fetch(`/api/plan/${planId}`)
            .then(r => r.json())
            .then((data: any) => {
              const recipe = data?.plan?.days?.[day]?.[meal];
              if (recipe) {
                setInactiveRecipeDetail({ day, meal, recipe, planId });
                setIsViewingActivePlan(false);
                setSelectedRecipeDetail(null);
              }
            })
            .catch(err => console.error('Error loading historical plan recipe:', err));

        } else {
          setPendingRecipe({ day, meal });
        }
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      if (window.location.hash.startsWith("#/")) {
        const cleanPath = window.location.hash.slice(1);
        window.history.replaceState(null, "", cleanPath);
        syncStateFromUrl(cleanPath);
      } else {
        syncStateFromUrl(window.location.pathname + window.location.search);
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Initial check on mount
    if (window.location.hash.startsWith("#/")) {
      const cleanPath = window.location.hash.slice(1);
      window.history.replaceState(null, "", cleanPath);
      syncStateFromUrl(cleanPath);
    } else {
      syncStateFromUrl(window.location.pathname + window.location.search);
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, [plan]);

  // Handle pending recipe navigation once plan is loaded
  useEffect(() => {
    if (plan && pendingRecipe) {
      const { day, meal } = pendingRecipe;
      const recipe = plan.days[day]?.[meal];
      if (recipe) {
        setSelectedRecipeDetail({ day, meal, recipe });
        setActiveTab("recipe-detail");
      }
      setPendingRecipe(null);
    }
  }, [plan, pendingRecipe]);

  // Sync page title in browser tab
  useEffect(() => {
    if (activeTab === "recipe-detail" && selectedRecipeDetail) {
      const mealName = selectedRecipeDetail.meal;
      const dayName = selectedRecipeDetail.day;
      const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const capitalizedMeal = mealName.charAt(0).toUpperCase() + mealName.slice(1);
      document.title = `${selectedRecipeDetail.recipe.recipeName} (${capitalizedMeal} - ${capitalizedDay}) | VitalityNutri`;
    } else if (activeTab === "calendar") {
      document.title = "Calendario | VitalityNutri";
    } else if (activeTab === "grocery") {
      document.title = "Lista de Compra | VitalityNutri";
    } else if (activeTab === "dashboard") {
      document.title = "Dashboard | VitalityNutri - Planificador de Alimentación Consciente";
    } else {
      document.title = "VitalityNutri - Planificador de Alimentación Consciente y Saludable";
    }
  }, [activeTab, selectedRecipeDetail]);

  const navigate = (path: string) => {
    let cleanPath = path;
    if (cleanPath.startsWith("/recipe/") && !cleanPath.includes("?v=") && metadata?.id) {
      cleanPath = `${cleanPath}?v=${metadata.id}`;
    }
    window.history.pushState(null, "", cleanPath);
    syncStateFromUrl(cleanPath);
  };

  const handleSetActiveTab = (tab: string) => {
    navigate(`/${tab}`);
  };

  const handleSelectRecipe = (day: DayType, meal: MealType, recipe: Recipe) => {
    navigate(`/recipe/${day}/${meal}`);
  };

  // Fetch the current globally stored plan from the Express backend on mount
  const fetchGlobalPlan = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/plan");
      if (!res.ok) {
        throw new Error("No se pudo descargar la planificación activa de la base.");
      }
      const data = await res.json();
      setPlan(data.plan);
      setMetadata(data.metadata);

      // Si hay un plan cargado por defecto al entrar en la web, vamos directamente al calendario
      const currentPath = window.location.pathname;
      if (data.plan && (currentPath === "/" || currentPath.startsWith("/dashboard"))) {
        navigate("/calendar");
      }

      // Descargar estado de recetas completadas
      try {
        const completedRes = await fetch("/api/completed-recipes");
        if (completedRes.ok) {
          const completedData = await completedRes.json();
          setCompletedRecipes(completedData.completedRecipes || {});
        }
      } catch (err) {
        console.error("Error al descargar recetas completadas:", err);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error al conectar con la base de datos de pautas nutricionales compartidas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalPlan();
  }, []);

  // --- Search Pool: fetch lightweight recipe index from all plans ---
  const fetchSearchPool = useCallback(async () => {
    try {
      const res = await fetch("/api/all-recipes");
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          // Server returned HTML (SPA fallback) — endpoint not yet registered
          console.warn("[Search] /api/all-recipes returned non-JSON. Server may need restart.");
          setSearchPool([]);
          setSearchPoolLoaded(true);
          return;
        }
        const data = await res.json();
        setSearchPool(Array.isArray(data) ? data : []);
      } else {
        setSearchPool([]);
      }
    } catch (err) {
      console.error("Error fetching search pool:", err);
      setSearchPool([]);
    } finally {
      setSearchPoolLoaded(true);
    }
  }, []);

  useEffect(() => { fetchSearchPool(); }, [fetchSearchPool]);

  // --- Search History: load from DB on mount ---
  const fetchSearchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/search-history");
      if (res.ok) {
        const data = await res.json();
        setSearchHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching search history:", err);
    }
  }, []);

  useEffect(() => { fetchSearchHistory(); }, [fetchSearchHistory]);

  // Close search panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchFocused(false);
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // --- Register a search click in the database ---
  const registerSearchClick = async (item: SearchRecipeItem) => {
    const existing = searchHistory.find(
      h => h.planId === item.planId && h.day === item.day && h.meal === item.meal
    );
    try {
      if (existing) {
        await fetch(`/api/search-history/${existing.id}`, { method: "DELETE" });
      }
      await fetch("/api/search-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: item.planId,
          planName: item.planName,
          day: item.day,
          meal: item.meal,
          recipeName: item.recipeName,
          image: item.image,
          isActive: item.isActive,
        }),
      });
      fetchSearchHistory();
    } catch (err) {
      console.error("Error registering search click:", err);
    }
  };

  // Register a search click from the history panel (also updates position)
  const registerHistoryClick = async (item: SearchHistoryItem) => {
    const existing = searchHistory.find(
      h => h.planId === item.planId && h.day === item.day && h.meal === item.meal
    );
    try {
      if (existing) {
        await fetch(`/api/search-history/${existing.id}`, { method: "DELETE" });
      }
      await fetch("/api/search-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: item.planId,
          planName: item.planName,
          day: item.day,
          meal: item.meal,
          recipeName: item.recipeName,
          image: item.image,
          isActive: item.isActive,
        }),
      });
      fetchSearchHistory();
    } catch (err) {
      console.error("Error registering history click:", err);
    }
  };

  const deleteHistoryEntry = async (id: number) => {
    try {
      await fetch(`/api/search-history/${id}`, { method: "DELETE" });
      fetchSearchHistory();
    } catch (err) {
      console.error("Error deleting search history item:", err);
    }
  };

  const clearAllHistory = async () => {
    try {
      await fetch("/api/search-history", { method: "DELETE" });
      setSearchHistory([]);
    } catch (err) {
      console.error("Error clearing search history:", err);
    }
  };

  // --- Search Scoring + Grouping Logic ---
  // A grouped result merges entries with identical recipeName + sorted ingredient fingerprint
  type GroupedSearchResult = SearchRecipeItem & {
    score: number;
    matchedIngredient?: string;
    occurrences: { day: string; meal: string; isActive: boolean; planId: number }[];
  };

  const getSearchResults = useCallback((): GroupedSearchResult[] => {
    const q = normalizeSearchText(searchQuery);
    const compactQuery = compactSearchText(searchQuery);
    if (!q || !compactQuery) return [];

    // Score every item
    const scored: (SearchRecipeItem & { score: number; matchedIngredient?: string })[] = [];
    for (const item of searchPool) {
      let score = getRecipeNameSearchScore(item.recipeName, q, compactQuery);
      let matchedIngredient: string | undefined;
      if (matchesSearchText(item.tag || "", q, compactQuery)) score += 10;
      for (const ing of item.ingredientNames) {
        if (matchesSearchText(ing, q, compactQuery)) {
          score += 2;
          if (!matchedIngredient) matchedIngredient = ing;
        }
      }
      if (score > 0) scored.push({ ...item, score, matchedIngredient });
    }

    // Group by recipeName + sorted ingredient fingerprint
    const groupMap = new Map<string, GroupedSearchResult>();
    for (const item of scored) {
      const normalizedIngredients = [...item.ingredientNames].map(normalizeSearchText).sort().join(",");
      const fingerprint = `${normalizeSearchText(item.recipeName)}||${normalizedIngredients}`;
      if (groupMap.has(fingerprint)) {
        const existing = groupMap.get(fingerprint)!;
        existing.occurrences.push({ day: item.day, meal: item.meal, isActive: item.isActive, planId: item.planId });
        if (item.score > existing.score) existing.score = item.score;
        if (!existing.matchedIngredient && item.matchedIngredient) existing.matchedIngredient = item.matchedIngredient;
      } else {
        groupMap.set(fingerprint, {
          ...item,
          occurrences: [{ day: item.day, meal: item.meal, isActive: item.isActive, planId: item.planId }],
        });
      }
    }

    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => b.score - a.score);
    return groups.slice(0, 8);
  }, [searchQuery, searchPool]);

  const searchResults = getSearchResults();
  const showSearchPanel = searchFocused;

  const renderSearchPanelContent = () => {
    return (
      <>
        {/* Results when searching */}
        {searchQuery.trim() !== "" ? (
          searchResults.length > 0 ? (
            <div
              className="overflow-y-auto flex-1"
              onWheel={e => e.stopPropagation()}
            >
              <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Resultados</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">{searchResults.length} {searchResults.length === 1 ? 'receta' : 'recetas'}</span>
              </div>
              {searchResults.map((item, idx) => (
                <button
                  key={`${item.planId}-${item.day}-${item.meal}-${idx}`}
                  type="button"
                  onClick={() => {
                    registerSearchClick(item);
                    navigateToSearchResult(item);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors duration-150 cursor-pointer group text-left"
                >
                  {/* Image thumbnail */}
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-zinc-800">
                    {item.image ? (
                      <img src={item.image} alt={item.recipeName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-300 text-base">restaurant_menu</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 truncate leading-tight">
                      {highlightText(item.recipeName, searchQuery)}
                    </p>
                    {/* Occurrence badges: one per day+meal combo */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.occurrences.map((occ, oi) => (
                        <span
                          key={oi}
                          onClick={e => {
                            e.stopPropagation();
                            registerSearchClick({ ...item, day: occ.day, meal: occ.meal, isActive: occ.isActive, planId: occ.planId });
                            navigateToSearchResult({ ...item, day: occ.day, meal: occ.meal, isActive: occ.isActive, planId: occ.planId });
                          }}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md cursor-pointer transition-colors ${
                            occ.isActive
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                              : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                          }`}
                        >
                          {MEAL_LABELS[occ.meal] || occ.meal} · {DAY_LABELS[occ.day] || occ.day}
                          {!occ.isActive && <span className="ml-0.5 opacity-70">(ant.)</span>}
                        </span>
                      ))}
                    </div>
                    {item.matchedIngredient && (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                        Ingrediente: {highlightText(item.matchedIngredient, searchQuery)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {item.calories && <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">{item.calories} kcal</span>}
                    {item.tag && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                        {highlightText(item.tag, searchQuery)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-3xl mb-2">search_off</span>
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">Sin resultados para &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )
        ) : (
          /* History panel when input is focused and empty */
          !searchPoolLoaded ? (
            <div className="px-4 py-7 text-center">
              <div className="w-5 h-5 rounded-full border-2 border-emerald-200 dark:border-zinc-700 border-t-emerald-600 dark:border-t-emerald-400 animate-spin mx-auto mb-2"></div>
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">Cargando recetas...</p>
            </div>
          ) : searchPool.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-emerald-300 dark:text-emerald-800 text-3xl mb-2">restaurant_menu</span>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Sube un plan nutricional para iniciar la búsqueda de recetas.</p>
            </div>
          ) : searchHistory.length === 0 ? (
            <div className="px-4 py-7 text-center">
              <span className="material-symbols-outlined text-slate-200 dark:text-zinc-700 text-3xl mb-2">history</span>
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">Aún no tienes búsquedas recientes.</p>
              <p className="text-[10px] text-slate-300 dark:text-zinc-600 mt-1">Tus recetas visitadas aparecerán aquí.</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Recientes</span>
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-[10px] font-bold text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                >Limpiar todo</button>
              </div>
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors duration-150 group"
                >
                  <button
                    type="button"
                    onClick={() => {
                      registerHistoryClick(item);
                      navigateToSearchResult(item);
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-zinc-800">
                      {item.image ? (
                        <img src={item.image} alt={item.recipeName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-slate-300 text-sm">history</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{item.recipeName}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {MEAL_LABELS[item.meal] || item.meal} · {DAY_LABELS[item.day] || item.day}
                        {!item.isActive && (
                          <span className="ml-1 text-amber-500 dark:text-amber-400">(anterior)</span>
                        )}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteHistoryEntry(item.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400 transition-all duration-150 cursor-pointer"
                    title="Eliminar del historial"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </>
    );
  };

  // Navigate to a recipe, supporting cross-plan navigation
  const navigateToSearchResult = (item: SearchRecipeItem | SearchHistoryItem) => {
    const vParam = `?v=${item.planId}`;
    const path = `/recipe/${item.day}/${item.meal}${vParam}`;
    setSearchQuery("");
    setSearchFocused(false);
    setMobileSearchOpen(false);
    searchInputRef.current?.blur();

    if (item.isActive) {
      // Active plan recipe – always reset any historical view first
      setInactiveRecipeDetail(null);
      setIsViewingActivePlan(true);
      if (plan) {
        const r = plan.days[item.day as DayType]?.[item.meal as MealType];
        if (r) {
          setSelectedRecipeDetail({ day: item.day as DayType, meal: item.meal as MealType, recipe: r });
          setActiveTab("recipe-detail");
          window.history.pushState(null, "", path);
          return;
        }
      }
    }
    // Inactive plan: load from API
    window.history.pushState(null, "", path);
    syncStateFromUrl(path);
  };


  const handleToggleCompleteRecipe = async (day: DayType, meal: MealType) => {
    const key = `${day}-${meal}`;
    const newCompleted = {
      ...completedRecipes,
      [key]: !completedRecipes[key]
    };
    setCompletedRecipes(newCompleted);

    try {
      await fetch("/api/completed-recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ completedRecipes: newCompleted })
      });
    } catch (err) {
      console.error("Error al guardar el estado de receta completada:", err);
    }
  };

  const handleToggleDayComplete = async (day: DayType, meals: MealType[], targetState: boolean) => {
    const newCompleted = { ...completedRecipes };
    meals.forEach(meal => {
      newCompleted[`${day}-${meal}`] = targetState;
    });
    setCompletedRecipes(newCompleted);

    try {
      await fetch("/api/completed-recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ completedRecipes: newCompleted })
      });
    } catch (err) {
      console.error("Error al guardar el estado de recetas completadas del día:", err);
    }
  };

  const handlePlanProcessed = (newPlan: MealPlan, newMetadata: PlanMetadata) => {
    setPlan(newPlan);
    setMetadata(newMetadata);
    setCompletedRecipes({});
    navigate("/calendar");
    // Refresh search pool after a new plan is processed
    fetchSearchPool();
  };


  const handleResetPlan = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/plan/reset", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlan(data.plan);
      setMetadata(data.metadata);
      setCompletedRecipes({});
      setSelectedRecipeDetail(null);
      navigate("/dashboard");
    } catch {
      setAppNotification({
        title: "No se pudo eliminar el plan",
        description: "Inténtalo de nuevo en unos segundos. Si el problema continúa, revisa la conexión con el servidor.",
        icon: "error",
        variant: "danger"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 antialiased font-sans transition-all duration-300">
      
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 shadow-sm transition-all duration-300 select-none no-print">
        <div className="flex justify-between items-center w-full px-6 max-w-container-max mx-auto h-16">
          
          {/* Logo & Section headers */}
          <div className="flex items-center gap-6">
            <button 
              type="button" 
              onClick={() => {
                navigate("/dashboard");
              }}
              className="flex items-center gap-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight hover:opacity-90 select-none text-left cursor-pointer transition-opacity shrink-0 group"
            >
              <span className="hidden md:inline text-3xl filter drop-shadow-sm transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 ease-out select-none" role="img" aria-label="VitalityNutri Logo">🥑</span>
              <span>VitalityNutri</span>
            </button>

            <nav className="hidden md:flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  navigate("/calendar");
                }}
                className={`text-xs font-black px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer ${
                  activeTab === "calendar"
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold"
                    : "text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800"
                }`}
              >
                Calendario
              </button>
              <button
                type="button"
                disabled={!plan}
                onClick={() => {
                  if (plan) {
                    if (selectedRecipeDetail) {
                      navigate(`/recipe/${selectedRecipeDetail.day}/${selectedRecipeDetail.meal}`);
                    } else {
                      const weekdays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
                      const meals = ["desayuno", "almuerzo", "merienda", "cena"];
                      let found = false;
                      for (const d of weekdays) {
                        for (const m of meals) {
                          const r = plan.days[d as DayType]?.[m as MealType];
                          if (r) {
                            navigate(`/recipe/${d}/${m}`);
                            found = true;
                            break;
                          }
                        }
                        if (found) break;
                      }
                      if (!found) {
                        navigate("/recipe/lunes/almuerzo");
                      }
                    }
                  }
                }}
                className={`text-xs font-black px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer ${
                  activeTab === "recipes" || activeTab === "recipe-detail"
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold"
                    : "text-slate-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                Recetas
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate("/grocery");
                }}
                className={`text-xs font-black px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer ${
                  activeTab === "grocery"
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold"
                    : "text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800"
                }`}
              >
                Lista Compra
              </button>
            </nav>
          </div>

          {/* Right side: Search + Dark mode toggle */}
          <div className="flex items-center gap-2 flex-1 justify-end ml-4">

            {/* --- Search Engine --- */}
            <div ref={searchContainerRef} className="relative flex-1 max-w-[180px] lg:max-w-xs xl:max-w-sm hidden md:block transition-all duration-300">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
                searchFocused
                  ? "border-emerald-500/60 dark:border-emerald-500/40 bg-white dark:bg-zinc-800 shadow-md shadow-emerald-500/5"
                  : "border-transparent bg-slate-100/80 dark:bg-zinc-800/70 hover:border-slate-200 dark:hover:border-zinc-700"
              }`}>
                <span className={`material-symbols-outlined text-[18px] shrink-0 transition-colors ${
                  searchFocused ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"
                }`}>search</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  id="topbar-search"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder={
                    !searchPoolLoaded
                      ? "Cargando recetas..."
                      : searchPool.length === 0
                      ? "Sube un plan para buscar..."
                      : "Buscar receta..."
                  }
                  disabled={searchPoolLoaded && searchPool.length === 0}
                  className="flex-1 bg-transparent text-xs font-semibold text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed w-full min-w-0"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.blur();
                      setSearchFocused(false);
                    }}
                    className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

               {/* Search Dropdown Panel */}
              {showSearchPanel && (
                <div
                  className="absolute top-full right-0 mt-2 w-[340px] md:w-[380px] bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/60 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/30 z-[200] overflow-hidden max-h-[70vh] flex flex-col"
                  onWheel={e => e.stopPropagation()}
                >
                  {renderSearchPanelContent()}
                </div>
              )}
            </div>

             {/* Mobile search button */}
            <button 
              type="button" 
              onClick={() => setMobileSearchOpen(true)}
              className="flex md:hidden p-2.5 text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl transition duration-200 select-none cursor-pointer items-center justify-center shadow-sm border border-transparent dark:border-zinc-800/40 bg-slate-50/40 dark:bg-zinc-900 shrink-0"
              title="Buscar receta"
            >
              <span className="material-symbols-outlined text-xl font-bold">search</span>
            </button>

            {/* Dark/Night mode toggle */}
            <button 
              type="button" 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 text-gray-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl transition duration-200 material-symbols-outlined select-none text-xl font-bold cursor-pointer flex items-center justify-center shadow-sm border border-transparent dark:border-zinc-800/40 bg-slate-50/40 dark:bg-zinc-900 shrink-0"
              title="Alternar Modo Oscuro"
            >
              {darkMode ? "light_mode" : "dark_mode"}
            </button>
          </div>
        </div>
      </header>

      {/* 1.1 Mobile Search Overlay/Modal */}
      {mobileSearchOpen && (
        <div 
          className="modal-overlay fixed inset-0 z-[999] bg-black/60 backdrop-blur-md md:hidden flex flex-col p-4 pt-16 !mt-0 animate-fade-in"
          style={{ marginTop: 0 }}
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0 -z-10 cursor-pointer" onClick={() => { setMobileSearchOpen(false); setSearchQuery(""); }} />
          
          {/* Floating Search Panel */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[70vh] overflow-hidden transition-all duration-300 animate-scale-up">
            {/* Header area with input and Close button */}
            <div className="p-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2.5 shrink-0 transition-colors">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800 focus-within:border-emerald-500/60 dark:focus-within:border-emerald-500/40 focus-within:bg-white dark:focus-within:bg-zinc-850 transition-all duration-200">
                <span className="material-symbols-outlined text-[20px] text-emerald-600 dark:text-emerald-400 shrink-0">search</span>
                <input
                  type="text"
                  id="mobile-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={
                    !searchPoolLoaded
                      ? "Cargando recetas..."
                      : searchPool.length === 0
                      ? "Sube un plan para buscar..."
                      : "Buscar receta..."
                  }
                  autoFocus
                  disabled={searchPoolLoaded && searchPool.length === 0}
                  className="flex-1 bg-transparent text-sm font-semibold text-slate-700 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none disabled:cursor-not-allowed w-full min-w-0"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileSearchOpen(false);
                  setSearchQuery("");
                }}
                className="text-xs font-black text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 transition-colors cursor-pointer px-1 py-1"
              >
                Cerrar
              </button>
            </div>

            {/* Search Content list */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900 pb-4 flex flex-col transition-colors">
              {renderSearchPanelContent()}
            </div>
          </div>
        </div>
      )}
      {/* 2. Main Content Frame */}
      <main className="flex-grow w-full max-w-container-max mx-auto px-6 pt-6 pb-36 md:py-12">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-semibold text-gray-550 dark:text-zinc-400">Descargando base de pautas compartidas...</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 rounded-3xl p-8 text-center max-w-md mx-auto">
            <span className="material-symbols-outlined text-red-650 text-3xl mb-3">cloud_off</span>
            <p className="font-bold text-gray-950 dark:text-red-200 mb-1">Sin acceso a la base global</p>
            <p className="text-sm text-red-750 dark:text-red-300 opacity-90 mb-6">{errorMsg}</p>
            <button 
              type="button" 
              onClick={fetchGlobalPlan} 
              className="px-6 py-2.5 bg-[#0f5238] hover:bg-[#116c4a] text-white font-semibold text-sm rounded-full transition cursor-pointer"
            >
              Reintentar Conexión
            </button>
          </div>
        ) : (
          <div>
            {activeTab === "dashboard" && (
              <Dashboard 
                metadata={metadata} 
                onPlanProcessed={handlePlanProcessed} 
                setActiveTab={handleSetActiveTab}
                onResetPlan={(options) => {
                  if (options?.skipConfirmation) {
                    handleResetPlan();
                  } else {
                    setShowResetPlanConfirmation(true);
                  }
                }}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarGrid 
                plan={plan} 
                onSelectRecipe={handleSelectRecipe} 
                setActiveTab={handleSetActiveTab}
                completedRecipes={completedRecipes}
                onToggleComplete={handleToggleCompleteRecipe}
                onToggleDayComplete={handleToggleDayComplete}
              />
            )}

            {activeTab === "recipe-detail" && selectedRecipeDetail && isViewingActivePlan && (
              <RecipeDetail
                day={selectedRecipeDetail.day}
                meal={selectedRecipeDetail.meal}
                recipe={selectedRecipeDetail.recipe}
                plan={plan}
                metadata={metadata}
                onNavigate={handleSelectRecipe}
                onGoBack={() => {
                  navigate("/calendar");
                }}
                completedRecipes={completedRecipes}
                onToggleComplete={handleToggleCompleteRecipe}
                onToggleDayComplete={handleToggleDayComplete}
                isPlanActive={true}
              />
            )}

            {activeTab === "recipe-detail" && inactiveRecipeDetail && !isViewingActivePlan && (
              <RecipeDetail
                day={inactiveRecipeDetail.day}
                meal={inactiveRecipeDetail.meal}
                recipe={inactiveRecipeDetail.recipe}
                plan={null}
                metadata={null}
                onGoBack={() => {
                  setInactiveRecipeDetail(null);
                  setIsViewingActivePlan(true);
                  navigate("/calendar");
                }}
                completedRecipes={{}}
                onToggleComplete={() => {}}
                onToggleDayComplete={() => {}}
                isPlanActive={false}
                onRestorePlan={async () => {
                  try {
                    const res = await fetch(`/api/history/restore/${inactiveRecipeDetail.planId}`, { method: "POST" });
                    if (res.ok) {
                      const data = await res.json();
                      setPlan(data.plan);
                      setMetadata(data.metadata);
                      setCompletedRecipes({});
                      setInactiveRecipeDetail(null);
                      setIsViewingActivePlan(true);
                      fetchSearchPool();
                      navigate("/calendar");
                    }
                  } catch (err) {
                    console.error("Error restoring plan:", err);
                  }
                }}
              />
            )}

            {/* Loading state: recipe-detail active but fetch still in flight */}
            {activeTab === "recipe-detail" && !selectedRecipeDetail && !inactiveRecipeDetail && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-8 h-8 rounded-full border-[3px] border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin"></div>
                <p className="text-sm font-semibold text-slate-400 dark:text-zinc-500">Cargando receta...</p>
              </div>
            )}

            {activeTab === "grocery" && (
              <GroceryList plan={plan} />
            )}

          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="w-full mt-auto bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 select-none no-print transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-6 pt-8 pb-36 md:py-8 max-w-container-max mx-auto gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-extrabold text-emerald-600 text-lg">VitalityNutri</span>
            <p className="text-xs text-gray-450 dark:text-zinc-550">© 2026 VitalityNutri. Alimentación consciente, viva y pautada.</p>
          </div>
        </div>
      </footer>

      {/* 4. Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-gray-100 dark:border-zinc-800/80 flex justify-around items-center z-50 md:hidden pb-safe shadow-lg no-print transition-colors">
        <button
          type="button"
          onClick={() => handleSetActiveTab("dashboard")}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === "dashboard"
              ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
              : "text-slate-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
          }`}
        >
          <span className="text-xl filter drop-shadow-sm select-none">🥑</span>
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Inicio</span>
        </button>
        <button
          type="button"
          onClick={() => handleSetActiveTab("calendar")}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === "calendar"
              ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
              : "text-slate-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">calendar_month</span>
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Calendario</span>
        </button>
        <button
          type="button"
          disabled={!plan}
          onClick={() => {
            if (plan) {
              if (selectedRecipeDetail) {
                handleSetActiveTab(`recipe/${selectedRecipeDetail.day}/${selectedRecipeDetail.meal}`);
              } else {
                const weekdays = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
                const meals = ["desayuno", "almuerzo", "merienda", "cena"];
                let found = false;
                for (const d of weekdays) {
                  for (const m of meals) {
                    const r = plan.days[d as DayType]?.[m as MealType];
                    if (r) {
                      handleSelectRecipe(d as DayType, m as MealType, r);
                      found = true;
                      break;
                    }
                  }
                  if (found) break;
                }
                if (!found) {
                  handleSetActiveTab("recipe/lunes/almuerzo");
                }
              }
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === "recipes" || activeTab === "recipe-detail"
              ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
              : "text-slate-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">restaurant_menu</span>
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Recetas</span>
        </button>
        <button
          type="button"
          onClick={() => handleSetActiveTab("grocery")}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === "grocery"
              ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
              : "text-slate-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">shopping_basket</span>
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Lista Compra</span>
        </button>
      </nav>

      {/* Scroll Navigation Floating Buttons */}
      <div className={`scroll-nav-buttons fixed right-4 ${activeTab === "recipe-detail" ? "bottom-36" : "bottom-20"} md:right-8 md:bottom-8 z-40 flex flex-col gap-2.5 no-print select-none`}>
        {showScrollTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-11 h-11 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-350 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 shadow-lg hover:shadow-emerald-500/10 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center font-bold"
            title="Volver arriba"
          >
            <span className="material-symbols-outlined text-xl">arrow_upward</span>
          </button>
        )}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => {
              if (activeTab === "grocery") {
                const element = document.getElementById("share-section");
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "start" });
                } else {
                  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
                }
              } else {
                window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
              }
            }}
            className="w-11 h-11 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-350 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 shadow-lg hover:shadow-emerald-500/10 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center font-bold md:hidden"
            title="Bajar al final"
          >
            <span className="material-symbols-outlined text-xl">arrow_downward</span>
          </button>
        )}
      </div>

      <ConfirmationModal
        isOpen={showResetPlanConfirmation}
        title="Eliminar plan activo"
        description="Se eliminará el plan de alimentación activo de la base de datos. Tendrás que subir un nuevo PDF para volver a acceder a las planificaciones."
        confirmLabel="Eliminar plan"
        icon="delete"
        variant="danger"
        onCancel={() => setShowResetPlanConfirmation(false)}
        onConfirm={() => {
          setShowResetPlanConfirmation(false);
          handleResetPlan();
        }}
      />

      <ConfirmationModal
        isOpen={!!appNotification}
        title={appNotification?.title || ""}
        description={appNotification?.description || ""}
        confirmLabel="Entendido"
        icon={appNotification?.icon}
        variant={appNotification?.variant}
        showCancel={false}
        onCancel={() => setAppNotification(null)}
        onConfirm={() => setAppNotification(null)}
      />

    </div>
  );
}
