import React, { useState, useEffect, useRef, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import CalendarGrid from "./components/CalendarGrid";
import RecipeDetail from "./components/RecipeDetail";
import GroceryList from "./components/GroceryList";
import BatchCooking from "./components/BatchCooking";
import Recetario from "./components/Recetario";
import RecipeForm from "./components/RecipeForm";
import ConfirmationModal, { ConfirmationVariant } from "./components/ConfirmationModal";
import SettingsModal, { ThemeMode } from "./components/SettingsModal";
import SystemDiagnosticsModal from "./components/SystemDiagnosticsModal";
import AuthModal from "./components/AuthModal";
import BrandLogo from "./components/BrandLogo";
import { LandingPage } from "./components/LandingPage";
import { useAuth } from "./context/AuthContext";
import { useTranslation } from "react-i18next";
import { getCanonicalPath, navigateTo } from "./utils/routes";
import type { SupportedLang } from "./i18n/config";
import { MealPlan, PlanMetadata, DayType, MealType, Recipe } from "./types";
import {
  normalizeSearchText,
  compactSearchText,
  matchesSearchText,
  getRecipeNameSearchScore,
  highlightText,
} from "./utils/searchHelpers";
import { translateTag } from "./utils/tags";
import { Github, ExternalLink, WifiOff, Sparkles, LogOut } from "lucide-react";
import AccountArea from "./components/account/AccountArea";
import VerifyEmailScreen from "./components/account/VerifyEmailScreen";
import { useOfflineStatus } from "./utils/useOfflineStatus";
import { version } from "@/package.json";

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
  isRecetario?: boolean;
  recetarioId?: number;
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
  isRecetario?: boolean;
  recetarioId?: number;
}


export default function App() {
  const { t, i18n } = useTranslation();
  const isOffline = useOfflineStatus();
  const { user, isDemo, isAuthenticated, isOssMode, isLoading: isAuthLoading, logout } = useAuth();
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [verifyEmailToken, setVerifyEmailToken] = useState<string | null>(null);
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

  // --- Recetario States ---
  const [recetarioRecipeDetail, setRecetarioRecipeDetail] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recetarioRecipeToDelete, setRecetarioRecipeToDelete] = useState<Recipe | null>(null);

  // --- Search Engine State ---
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchPool, setSearchPool] = useState<SearchRecipeItem[]>([]);
  const [searchPoolLoaded, setSearchPoolLoaded] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);


  // Theme mode state (light | dark | system)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark" || saved === "system") {
        return saved;
      }
    }
    return "system";
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);

  // Email-change verification deep link: /verify-email?token=...
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/verify-email" || path.startsWith("/verify-email/")) {
      const token = new URLSearchParams(window.location.search).get("token") ?? "";
      setVerifyEmailToken(token);
    }
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      let isDark = false;
      if (themeMode === "dark") {
        isDark = true;
      } else if (themeMode === "system") {
        isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", themeMode);
    };

    applyTheme();

    if (themeMode === "system" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [themeMode]);

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
    plan?: MealPlan | null;
    metadata?: PlanMetadata | null;
  } | null>(null);
  const [isViewingActivePlan, setIsViewingActivePlan] = useState<boolean>(true);

  const inactiveRecipeDetailRef = useRef(inactiveRecipeDetail);
  useEffect(() => {
    inactiveRecipeDetailRef.current = inactiveRecipeDetail;
  }, [inactiveRecipeDetail]);

  // Sync state from URL pathname
  const syncStateFromUrl = (urlPath: string) => {
    const qIndex = urlPath.indexOf("?");
    const rawPathname = qIndex === -1 ? urlPath : urlPath.slice(0, qIndex);
    const searchParams = new URLSearchParams(urlPath.slice(qIndex));
    const pathname = getCanonicalPath(rawPathname, i18n.language);
    const vParam = searchParams.get("v");
    
    if (!pathname || pathname === "/" || pathname.startsWith("/dashboard")) {
      setActiveTab("dashboard");
      setSelectedRecipeDetail(null);
      setInactiveRecipeDetail(null);
      setIsViewingActivePlan(true);
    } else if (pathname.startsWith("/calendar")) {
      setActiveTab("calendar");
      setSelectedRecipeDetail(null);
      setInactiveRecipeDetail(null);
      setIsViewingActivePlan(true);
    } else if (pathname.startsWith("/grocery")) {
      setActiveTab("grocery");
      setSelectedRecipeDetail(null);
      setInactiveRecipeDetail(null);
      setIsViewingActivePlan(true);
    } else if (pathname.startsWith("/batch-cooking")) {
      setActiveTab("batch-cooking");
      setSelectedRecipeDetail(null);
      setInactiveRecipeDetail(null);
      setIsViewingActivePlan(true);
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
            setIsViewingActivePlan(true);
            setInactiveRecipeDetail(null);
          } else {
            setActiveTab("calendar");
            setSelectedRecipeDetail(null);
          }
        } else if (vParam) {
          // Visiting a recipe from a different (inactive) plan — load it via dedicated endpoint
          const planId = parseInt(vParam, 10);
          setActiveTab("recipe-detail");

          // Avoid re-fetching if this historical plan is already loaded
          const currentInactive = inactiveRecipeDetailRef.current;
          if (currentInactive && currentInactive.planId === planId && currentInactive.plan) {
            const recipe = currentInactive.plan.days[day]?.[meal];
            if (recipe) {
              setInactiveRecipeDetail({
                day,
                meal,
                recipe,
                planId,
                plan: currentInactive.plan,
                metadata: currentInactive.metadata
              });
              setIsViewingActivePlan(false);
              setSelectedRecipeDetail(null);
              return;
            }
          }

          // Reset previous inactive state while loading the new one
          setInactiveRecipeDetail(null);
          setSelectedRecipeDetail(null);
          fetch(`/api/plan/${planId}`)
            .then(r => r.json())
            .then((data: any) => {
              const recipe = data?.plan?.days?.[day]?.[meal];
              if (recipe) {
                setInactiveRecipeDetail({
                  day,
                  meal,
                  recipe,
                  planId,
                  plan: data.plan,
                  metadata: data.metadata,
                });
                setIsViewingActivePlan(false);
                setSelectedRecipeDetail(null);
              }
            })
            .catch(err => console.error('Error loading historical plan recipe:', err));

        } else {
          setPendingRecipe({ day, meal });
        }
      }
    } else if (pathname.startsWith("/recipe-book/recipe/")) {
      const parts = pathname.split("/");
      if (parts.length >= 4) {
        const id = parseInt(parts[3], 10);
        setActiveTab("recipe-detail");
        setSelectedRecipeDetail(null);
        setInactiveRecipeDetail(null);
        setRecetarioRecipeDetail(null);
        
        fetch(`/api/recipes/${id}`)
          .then(r => r.json())
          .then(data => {
            if (data && data.recipeName) {
              setRecetarioRecipeDetail(data);
            }
          })
          .catch(err => console.error("Error loading recetario recipe:", err));
      }
    } else if (pathname.startsWith("/recipe-book/new")) {
      setActiveTab("recipe-form");
      setEditingRecipe(null);
      setSelectedRecipeDetail(null);
      setInactiveRecipeDetail(null);
      setRecetarioRecipeDetail(null);
    } else if (pathname.startsWith("/recipe-book/edit/")) {
      const parts = pathname.split("/");
      if (parts.length >= 4) {
        const id = parseInt(parts[3], 10);
        setActiveTab("recipe-form");
        setSelectedRecipeDetail(null);
        setInactiveRecipeDetail(null);
        setRecetarioRecipeDetail(null);

        fetch(`/api/recipes/${id}`)
          .then(r => r.json())
          .then(data => {
            if (data && data.recipeName) {
              setEditingRecipe(data);
            }
          })
          .catch(err => console.error("Error loading recipe for editing:", err));
      }
    } else if (pathname.startsWith("/recipe-book")) {
      setActiveTab("recetario");
      setSelectedRecipeDetail(null);
      setInactiveRecipeDetail(null);
      setRecetarioRecipeDetail(null);
      setEditingRecipe(null);
      setIsViewingActivePlan(true);
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
      const mealName = t(`meals.${selectedRecipeDetail.meal}`);
      const dayName = t(`days.${selectedRecipeDetail.day}`);
      const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      const capitalizedMeal = mealName.charAt(0).toUpperCase() + mealName.slice(1);
      document.title = `${selectedRecipeDetail.recipe.recipeName} (${capitalizedMeal} - ${capitalizedDay}) | VitalityNutri`;
    } else if (activeTab === "calendar") {
      document.title = t("titles.calendar");
    } else if (activeTab === "grocery") {
      document.title = t("titles.grocery");
    } else if (activeTab === "batch-cooking") {
      document.title = t("titles.batch-cooking");
    } else if (activeTab === "dashboard") {
      document.title = t("titles.dashboard");
    } else {
      document.title = t("titles.default");
    }
  }, [activeTab, selectedRecipeDetail, t]);

  const navigate = (path: string) => {
    let cleanPath = path;
    if (cleanPath.startsWith("/recipe/") && !cleanPath.includes("v=") && metadata?.id) {
      const separator = cleanPath.includes("?") ? "&" : "?";
      cleanPath = `${cleanPath}${separator}v=${metadata.id}`;
    }
    const localizedPath = navigateTo(cleanPath);
    window.history.pushState(null, "", localizedPath);
    syncStateFromUrl(localizedPath);
  };

  const handleLogout = async () => {
    await logout();
    setPlan(null);
    setMetadata(null);
    setCompletedRecipes({});
    setActiveTab("dashboard");
    navigate("/");
  };

  const handleSetActiveTab = (tab: string) => {
    if (tab === "recetario") {
      navigate("/recipe-book");
    } else {
      navigate(`/${tab}`);
    }
  };

  const handleSelectRecipe = (day: DayType, meal: MealType, recipe: Recipe) => {
    const searchParams = new URLSearchParams(window.location.search);
    const fromVal = searchParams.get("from");
    const query = fromVal ? `?from=${fromVal}` : "";
    navigate(`/recipe/${day}/${meal}${query}`);
  };

  // Fetch the current globally stored plan from the backend on mount
  const fetchGlobalPlan = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch("/api/plan");
        if (!res.ok) {
          if ((res.status === 502 || res.status === 503 || res.status === 504) && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            continue;
          }
          throw new Error(t("error.download_plan_error"));
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
        if (isDemo) {
          const cached = sessionStorage.getItem("demo_completed_recipes");
          if (cached) {
            try {
              setCompletedRecipes(JSON.parse(cached));
            } catch {}
          }
        } else {
          try {
            const completedRes = await fetch("/api/completed-recipes");
            if (completedRes.ok) {
              const completedData = await completedRes.json();
              setCompletedRecipes(completedData.completedRecipes || {});
            }
          } catch (err) {
            console.error("Error al descargar recetas completadas:", err);
          }
        }

        setIsLoading(false);
        return;
      } catch (err: any) {
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        console.error(err);
        setErrorMsg(t("error.no_db_access_msg"));
        setIsLoading(false);
        return;
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchGlobalPlan();
    }
  }, [isAuthenticated]);

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

  useEffect(() => {
    if (isAuthenticated) {
      fetchSearchPool();
    }
  }, [isAuthenticated, fetchSearchPool]);

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

  useEffect(() => {
    if (isAuthenticated) {
      fetchSearchHistory();
    }
  }, [isAuthenticated, fetchSearchHistory]);

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
      if (matchesSearchText(translateTag(item.tag, t), q, compactQuery)) score += 10;
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
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{t("search.results")}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md">{searchResults.length} {t("search.recipes")}</span>
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
                      {item.isRecetario ? (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-55 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/30 uppercase tracking-wider">
                          {t("search.recetario_badge")}
                        </span>
                      ) : (
                        item.occurrences.map((occ, oi) => (
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
                            {t(`meals.${occ.meal}`) || occ.meal} · {t(`days.${occ.day}`) || occ.day}
                            {!occ.isActive && <span className="ml-0.5 opacity-70">({t("search.previous")})</span>}
                          </span>
                        ))
                      )}
                    </div>
                    {item.matchedIngredient && (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                        {t("search.ingredient")}: {highlightText(item.matchedIngredient, searchQuery)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {item.calories && <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">{item.calories} kcal</span>}
                    {item.tag && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                        {highlightText(translateTag(item.tag, t), searchQuery)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-slate-300 dark:text-zinc-600 text-3xl mb-2">search_off</span>
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">{t("search.no_results")} &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )
        ) : (
          /* History panel when input is focused and empty */
          !searchPoolLoaded ? (
            <div className="px-4 py-7 text-center">
              <div className="w-5 h-5 rounded-full border-2 border-emerald-200 dark:border-zinc-700 border-t-emerald-600 dark:border-t-emerald-400 animate-spin mx-auto mb-2"></div>
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">{t("search.loading")}</p>
            </div>
          ) : searchPool.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-emerald-300 dark:text-emerald-800 text-3xl mb-2">restaurant_menu</span>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{t("search.empty_pool")}</p>
            </div>
          ) : searchHistory.length === 0 ? (
            <div className="px-4 py-7 text-center">
              <span className="material-symbols-outlined text-slate-200 dark:text-zinc-700 text-3xl mb-2">history</span>
              <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">{t("search.no_history")}</p>
              <p className="text-[10px] text-slate-300 dark:text-zinc-600 mt-1">{t("search.no_history_hint")}</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">{t("search.recent")}</span>
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-[10px] font-bold text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                >{t("search.clear_all")}</button>
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
                        {t(`meals.${item.meal}`) || item.meal} · {t(`days.${item.day}`) || item.day}
                        {!item.isActive && (
                          <span className="ml-1 text-amber-500 dark:text-amber-400">({t("search.previous")})</span>
                        )}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteHistoryEntry(item.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 dark:text-zinc-600 dark:hover:text-red-400 transition-all duration-150 cursor-pointer"
                    title={t("search.clear_all")}
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
    setSearchQuery("");
    setSearchFocused(false);
    setMobileSearchOpen(false);
    searchInputRef.current?.blur();

    if (item.isRecetario) {
      setInactiveRecipeDetail(null);
      setSelectedRecipeDetail(null);
      setRecetarioRecipeDetail(null);
      const path = `/recipe-book/recipe/${item.recetarioId}`;
      window.history.pushState(null, "", path);
      syncStateFromUrl(path);
      return;
    }

    const vParam = `?v=${item.planId}`;
    const path = `/recipe/${item.day}/${item.meal}${vParam}`;

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

    if (isDemo) {
      sessionStorage.setItem("demo_completed_recipes", JSON.stringify(newCompleted));
      return;
    }

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

    if (isDemo) {
      sessionStorage.setItem("demo_completed_recipes", JSON.stringify(newCompleted));
      return;
    }

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
        title: t("confirm.delete_plan_title"),
        description: t("error.delete_recipe_msg"),
        icon: "error",
        variant: "danger"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <BrandLogo className="w-9 h-9 animate-bounce" />
        <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          <span>Iniciando VitalityNutri...</span>
        </div>
      </div>
    );
  }

  if (verifyEmailToken !== null) {
    return (
      <VerifyEmailScreen
        token={verifyEmailToken}
        onDone={() => {
          setVerifyEmailToken(null);
          window.history.pushState(null, "", "/");
        }}
      />
    );
  }

  if (!isOssMode && !isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 antialiased font-sans transition-all duration-300">
      {isOffline && (
        <div data-testid="offline-banner" className="bg-amber-500 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-inner select-none z-50">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>{t("general.offline_mode")}</span>
        </div>
      )}
      
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
              <BrandLogo className="hidden md:inline-block w-7 h-7 filter drop-shadow-sm transform group-hover:scale-110 transition-all duration-300 ease-out" alt={t("general.brand_logo_aria")} />
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
                {t("nav.calendar")}
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate("/recipe-book");
                }}
                className={`text-xs font-black px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer ${
                  activeTab === "recetario" || activeTab === "recipe-detail" || activeTab === "recipe-form"
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold"
                    : "text-slate-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800"
                }`}
              >
                {t("nav.recipe-book")}
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
                {t("nav.grocery")}
              </button>
              <button
                type="button"
                disabled={!plan}
                onClick={() => {
                  navigate("/batch-cooking");
                }}
                className={`text-xs font-black px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer ${
                  activeTab === "batch-cooking"
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold"
                    : "text-slate-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {t("nav.batch-cooking")}
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
                      ? t("search.loading")
                      : searchPool.length === 0
                      ? t("search.no_plan")
                      : t("search.placeholder")
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
                    title={t("search.clear_all")}
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
              title={t("search.placeholder")}
            >
              <span className="material-symbols-outlined text-xl font-bold">search</span>
            </button>



            {/* Settings button */}
            <button 
              type="button" 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 text-slate-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl transition duration-200 material-symbols-outlined select-none text-xl font-bold cursor-pointer flex items-center justify-center shadow-sm border border-transparent dark:border-zinc-800/40 bg-slate-50/40 dark:bg-zinc-900 shrink-0"
              title={t("settings.title", "Preferences & Configuration")}
              aria-label={t("settings.title", "Preferences & Configuration")}
            >
              settings
            </button>

            {/* Dark/Night mode toggle */}
            <button 
              type="button" 
              onClick={() => {
                const next: ThemeMode = themeMode === "light" ? "dark" : themeMode === "dark" ? "system" : "light";
                setThemeMode(next);
              }}
              className="p-2.5 text-gray-500 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-300 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-xl transition duration-200 material-symbols-outlined select-none text-xl font-bold cursor-pointer flex items-center justify-center shadow-sm border border-transparent dark:border-zinc-800/40 bg-slate-50/40 dark:bg-zinc-900 shrink-0"
              title={t("theme.toggle", "Toggle theme")}
            >
              {themeMode === "dark" ? "dark_mode" : themeMode === "light" ? "light_mode" : "routine"}
            </button>

            {/* Auth / Demo Profile (SaaS Mode Only) */}
            {!isOssMode && (
              isDemo ? (
                <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-semibold select-none">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Modo Demo</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition text-xs font-medium"
                    title="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : isAuthenticated && user ? (
                <AccountArea user={user} onLogout={handleLogout} />
              ) : (
                <div className="pl-2 border-l border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAuthOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Iniciar Sesión / Demo</span>
                  </button>
                </div>
              )
            )}
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
                      ? t("search.loading")
                      : searchPool.length === 0
                      ? t("search.no_plan")
                      : t("search.placeholder")
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
                {t("search.close")}
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
            <p className="text-sm font-semibold text-gray-550 dark:text-zinc-400">{t("loading.fetching_plan")}</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 rounded-3xl p-8 text-center max-w-md mx-auto">
            <span className="material-symbols-outlined text-red-650 text-3xl mb-3">cloud_off</span>
            <p className="font-bold text-gray-950 dark:text-red-200 mb-1">{t("error.no_db_access_title")}</p>
            <p className="text-sm text-red-750 dark:text-red-300 opacity-90 mb-6">{errorMsg}</p>
            <button 
              type="button" 
              onClick={fetchGlobalPlan} 
              className="px-6 py-2.5 bg-[#0f5238] hover:bg-[#116c4a] text-white font-semibold text-sm rounded-full transition cursor-pointer"
            >
              {t("error.retry")}
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
                metadata={metadata}
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
                  const searchParams = new URLSearchParams(window.location.search);
                  if (searchParams.get("from") === "batch-cooking") {
                    navigate("/batch-cooking");
                  } else {
                    navigate("/calendar");
                  }
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
                plan={inactiveRecipeDetail.plan || null}
                metadata={inactiveRecipeDetail.metadata || null}
                activePlan={plan}
                onNavigate={(day, meal, recipe) => {
                  const searchParams = new URLSearchParams(window.location.search);
                  const fromVal = searchParams.get("from");
                  const fromQuery = fromVal ? `&from=${fromVal}` : "";
                  navigate(`/recipe/${day}/${meal}?v=${inactiveRecipeDetail.planId}${fromQuery}`);
                }}
                onNavigateActive={handleSelectRecipe}
                onGoBack={() => {
                  const searchParams = new URLSearchParams(window.location.search);
                  setInactiveRecipeDetail(null);
                  setIsViewingActivePlan(true);
                  if (searchParams.get("from") === "batch-cooking") {
                    navigate("/batch-cooking");
                  } else {
                    navigate("/calendar");
                  }
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

            {activeTab === "recipe-detail" && recetarioRecipeDetail && (
              <RecipeDetail
                recipe={recetarioRecipeDetail}
                mode="recetario"
                onGoBack={() => {
                  setRecetarioRecipeDetail(null);
                  navigate("/recipe-book");
                }}
                onEdit={(recipe) => {
                  setEditingRecipe(recipe);
                  setActiveTab("recipe-form");
                  window.history.pushState(null, "", `/recipe-book/edit/${recipe.id}`);
                }}
                onDelete={(recipe) => {
                  setRecetarioRecipeToDelete(recipe);
                }}
                activePlan={plan}
                onNavigateActive={(day, meal, recipe) => {
                  setRecetarioRecipeDetail(null);
                  setIsViewingActivePlan(true);
                  setSelectedRecipeDetail({ day, meal, recipe });
                  setActiveTab("recipe-detail");
                  window.history.pushState(null, "", `/recipe/${day}/${meal}`);
                }}
                completedRecipes={completedRecipes}
                onToggleComplete={handleToggleCompleteRecipe}
                onToggleDayComplete={handleToggleDayComplete}
              />
            )}

            {activeTab === "recetario" && (
              <Recetario
                plan={plan}
                searchQuery={searchQuery}
                onSelectRecipe={(r) => {
                  setRecetarioRecipeDetail(r);
                  setActiveTab("recipe-detail");
                  window.history.pushState(null, "", `/recipe-book/recipe/${r.id}`);
                }}
                onAddNewRecipe={() => {
                  setEditingRecipe(null);
                  setActiveTab("recipe-form");
                  window.history.pushState(null, "", "/recipe-book/new");
                }}
                onEditRecipe={(r) => {
                  setEditingRecipe(r);
                  setActiveTab("recipe-form");
                  window.history.pushState(null, "", `/recipe-book/edit/${r.id}`);
                }}
              />
            )}

            {activeTab === "recipe-form" && (
              <RecipeForm
                recipe={editingRecipe}
                onGoBack={() => {
                  setEditingRecipe(null);
                  navigate("/recipe-book");
                }}
                onSave={() => {
                  setEditingRecipe(null);
                  fetchSearchPool(); // Refresh global search pool
                  navigate("/recipe-book");
                }}
              />
            )}

            {/* Loading state: recipe-detail active but fetch still in flight */}
            {activeTab === "recipe-detail" && !selectedRecipeDetail && !inactiveRecipeDetail && !recetarioRecipeDetail && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="w-8 h-8 rounded-full border-[3px] border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin"></div>
                <p className="text-sm font-semibold text-slate-400 dark:text-zinc-500">{t("loading.loading_recipe")}</p>
              </div>
            )}

            {activeTab === "grocery" && (
              <GroceryList plan={plan} completedRecipes={completedRecipes} />
            )}

            {activeTab === "batch-cooking" && (
              <BatchCooking 
                plan={plan} 
                metadata={metadata} 
                onSelectRecipe={(day, meal, rec) => navigate(`/recipe/${day}/${meal}?from=batch-cooking`)} 
              />
            )}

          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="w-full mt-auto bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 select-none no-print transition-colors">
        <div className="flex flex-col md:flex-row items-center w-full pl-6 pr-16 pt-8 pb-2 md:py-6 md:pr-24 max-w-container-max mx-auto gap-4 md:gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-extrabold text-emerald-600 text-lg">VitalityNutri</span>
            <p className="text-xs text-gray-450 dark:text-zinc-550">{t("footer.tagline")}</p>
          </div>
          <div className="flex items-center gap-5 md:ml-auto">
            <a
              href="https://github.com/eljorgit/VitalityNutri"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-450 dark:text-zinc-550 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <Github size={16} />
              <span>{t("footer.github")}</span>
            </a>
            <span className="text-gray-300 dark:text-zinc-700">|</span>
            <a
              href="https://malvioapps.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-450 dark:text-zinc-550 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <ExternalLink size={14} />
              <span>MalvioApps</span>
            </a>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center w-full px-6 pb-8 md:pb-6 gap-1 sm:gap-3 max-w-container-max mx-auto">
          <span className="text-[11px] text-gray-400 dark:text-zinc-600 font-medium flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsDiagnosticsOpen(true)}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 font-mono"
              title={t("diagnostics.title", "System Diagnostics")}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {t("footer.version", { version })}
            </button>
            <span className="opacity-40">|</span>
            <a
              href="https://github.com/eljorgit/VitalityNutri/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {t("footer.license")}
            </a>
          </span>
          <span className="text-[11px] text-gray-400 dark:text-zinc-600 font-medium">
            {i18n.language?.startsWith("es") ? (
              <>
                Diseñado con IA por{" "}
                <a
                  href="https://www.linkedin.com/in/jorgerc02/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-zinc-400/40 dark:decoration-zinc-600 underline-offset-2 transition-colors font-semibold"
                >
                  Jorge
                </a>{" "}
                de{" "}
                <a
                  href="https://malvioapps.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-zinc-400/40 dark:decoration-zinc-600 underline-offset-2 transition-colors font-semibold"
                >
                  MalvioApps
                </a>
              </>
            ) : (
              <>
                Crafted with AI by{" "}
                <a
                  href="https://www.linkedin.com/in/jorgerc02/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-zinc-400/40 dark:decoration-zinc-600 underline-offset-2 transition-colors font-semibold"
                >
                  Jorge
                </a>{" "}
                from{" "}
                <a
                  href="https://malvioapps.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline decoration-zinc-400/40 dark:decoration-zinc-600 underline-offset-2 transition-colors font-semibold"
                >
                  MalvioApps
                </a>
              </>
            )}
          </span>
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
          <BrandLogo className="w-5 h-5 filter drop-shadow-sm" />
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">{t("mobile_nav.home")}</span>
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
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">{t("mobile_nav.calendar")}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            handleSetActiveTab("recetario");
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer ${
            activeTab === "recetario" || activeTab === "recipe-detail" || activeTab === "recipe-form"
              ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
              : "text-slate-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">restaurant_menu</span>
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">{t("mobile_nav.recipe-book")}</span>
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
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">{t("mobile_nav.grocery")}</span>
        </button>
        <button
          type="button"
          disabled={!plan}
          onClick={() => handleSetActiveTab("batch-cooking")}
          className={`flex flex-col items-center justify-center flex-1 h-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === "batch-cooking"
              ? "text-emerald-600 dark:text-emerald-400 font-extrabold"
              : "text-slate-400 hover:text-emerald-600 dark:text-zinc-500 dark:hover:text-emerald-400"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">outdoor_grill</span>
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">{t("mobile_nav.batch-cooking")}</span>
        </button>
      </nav>

      {/* Scroll Navigation Floating Buttons */}
      <div className={`scroll-nav-buttons fixed right-4 ${activeTab === "recipe-detail" ? "bottom-36" : "bottom-20"} md:right-8 md:bottom-8 z-50 flex flex-col gap-2.5 no-print select-none`}>
        {showScrollTop && (
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-11 h-11 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-350 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 shadow-lg hover:shadow-emerald-500/10 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center font-bold"
            title={t("scroll.top")}
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
            title={t("scroll.bottom")}
          >
            <span className="material-symbols-outlined text-xl">arrow_downward</span>
          </button>
        )}
      </div>

      <ConfirmationModal
        isOpen={showResetPlanConfirmation}
        title={t("confirm.delete_plan_title")}
        description={t("confirm.delete_plan_desc")}
        confirmLabel={t("confirm.delete_plan_confirm")}
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
        confirmLabel={t("confirm.understood")}
        icon={appNotification?.icon}
        variant={appNotification?.variant}
        showCancel={false}
        onCancel={() => setAppNotification(null)}
        onConfirm={() => setAppNotification(null)}
      />

      <ConfirmationModal
        isOpen={!!recetarioRecipeToDelete}
        title={t("confirm.delete_recipe_title")}
        description={t("confirm.delete_recipe_desc", { name: recetarioRecipeToDelete?.recipeName })}
        confirmLabel={t("confirm.delete_recipe_confirm")}
        icon="delete"
        variant="danger"
        onCancel={() => setRecetarioRecipeToDelete(null)}
        onConfirm={async () => {
          const recipe = recetarioRecipeToDelete;
          setRecetarioRecipeToDelete(null);
          if (!recipe?.id) return;
          try {
            const res = await fetch(`/api/recipes/${recipe.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(t("general.error_delete"));
            setRecetarioRecipeDetail(null);
            navigate("/recipe-book");
          } catch {
            setAppNotification({
              title: t("error.delete_recipe_title"),
              description: t("error.delete_recipe_msg"),
              icon: "error",
              variant: "danger"
            });
          }
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={themeMode}
        onThemeChange={setThemeMode}
      />

      <SystemDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

    </div>
  );
}
