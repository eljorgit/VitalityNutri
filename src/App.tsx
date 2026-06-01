import React, { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard";
import CalendarGrid from "./components/CalendarGrid";
import RecipeDetail from "./components/RecipeDetail";
import GroceryList from "./components/GroceryList";
import { MealPlan, PlanMetadata, DayType, MealType, Recipe } from "./types";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [metadata, setMetadata] = useState<PlanMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Detail view parameters
  const [selectedRecipeDetail, setSelectedRecipeDetail] = useState<{
    day: DayType;
    meal: MealType;
    recipe: Recipe;
  } | null>(null);

  const [pendingRecipe, setPendingRecipe] = useState<{ day: DayType; meal: MealType } | null>(null);

  // Sync state from URL pathname
  const syncStateFromUrl = (urlPath: string) => {
    const qIndex = urlPath.indexOf("?");
    const pathname = qIndex === -1 ? urlPath : urlPath.slice(0, qIndex);
    
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
        
        if (plan) {
          const recipe = plan.days[day]?.[meal];
          if (recipe) {
            setSelectedRecipeDetail({ day, meal, recipe });
            setActiveTab("recipe-detail");
          } else {
            setActiveTab("calendar");
            setSelectedRecipeDetail(null);
          }
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

  const navigate = (path: string) => {
    window.history.pushState(null, "", path);
    syncStateFromUrl(path);
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

  const handlePlanProcessed = (newPlan: MealPlan, newMetadata: PlanMetadata) => {
    setPlan(newPlan);
    setMetadata(newMetadata);
    navigate("/calendar");
  };

  const handleResetPlan = async () => {
    if (!window.confirm("¿Seguro que deseas eliminar el plan de alimentación activo de la base de datos? Se requerirá subir un nuevo archivo PDF para poder acceder a las planificaciones.")) {
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch("/api/plan/reset", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlan(data.plan);
      setMetadata(data.metadata);
      setSelectedRecipeDetail(null);
      navigate("/dashboard");
    } catch {
      alert("No se pudo eliminar el plan.");
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
          <div className="flex items-center gap-10">
            <button 
              type="button" 
              onClick={() => {
                navigate("/dashboard");
              }}
              className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-450 tracking-tight hover:opacity-85 select-none text-left cursor-pointer transition-opacity"
            >
              VitalityNutri
            </button>

            <nav className="hidden md:flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  navigate("/dashboard");
                }}
                className={`text-xs font-black px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer ${
                  activeTab === "dashboard"
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold"
                    : "text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-slate-800"
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate("/calendar");
                }}
                className={`text-xs font-black px-3.5 py-2 rounded-xl transition duration-150 cursor-pointer ${
                  activeTab === "calendar"
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-bold"
                    : "text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-slate-800"
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
                    : "text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
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
                    : "text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 hover:bg-gray-50/50 dark:hover:bg-slate-800"
                }`}
              >
                Lista Compra
              </button>
            </nav>
          </div>

          {/* Clean Right Actions Toolbar - Dark/Night mode button only */}
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 text-gray-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition duration-200 material-symbols-outlined select-none text-xl font-bold cursor-pointer flex items-center justify-center shadow-sm border border-transparent dark:border-slate-800/40 bg-slate-50/40 dark:bg-slate-900"
              title="Alternar Modo Oscuro"
            >
              {darkMode ? "light_mode" : "dark_mode"}
            </button>
          </div>

        </div>
      </header>

      {/* 2. Main Content Frame */}
      <main className="flex-grow w-full max-w-container-max mx-auto px-6 py-8 md:py-12">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-12 h-12 rounded-full border-4 border-emerald-100 dark:border-zinc-850 border-t-emerald-600 dark:border-t-emerald-450 animate-spin mx-auto mb-4"></div>
            <p className="text-sm font-semibold text-gray-500 dark:text-zinc-400">Descargando base de pautas compartidas...</p>
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
                onResetPlan={handleResetPlan}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarGrid 
                plan={plan} 
                onSelectRecipe={handleSelectRecipe} 
                setActiveTab={handleSetActiveTab}
              />
            )}

            {activeTab === "recipe-detail" && selectedRecipeDetail && (
              <RecipeDetail
                day={selectedRecipeDetail.day}
                meal={selectedRecipeDetail.meal}
                recipe={selectedRecipeDetail.recipe}
                plan={plan}
                onNavigate={handleSelectRecipe}
                onGoBack={() => {
                  navigate("/calendar");
                }}
              />
            )}

            {activeTab === "grocery" && (
              <GroceryList plan={plan} />
            )}
          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="w-full mt-auto bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 select-none no-print transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-6 py-8 max-w-container-max mx-auto gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-extrabold text-emerald-600 text-lg">VitalityNutri</span>
            <p className="text-xs text-gray-400 dark:text-zinc-500">© 2026 VitalityNutri. Alimentación consciente, viva y pautada.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-xs font-semibold text-gray-500 dark:text-zinc-400">
            <button type="button" onClick={() => alert("Políticas de Privacidad:")} className="hover:text-emerald-800 dark:hover:text-emerald-400 transition duration-150 cursor-pointer">Política de Privacidad</button>
            <button type="button" onClick={() => alert("Términos del Servicio:")} className="hover:text-emerald-800 dark:hover:text-emerald-400 transition duration-150 cursor-pointer">Términos de Servicio</button>
            <button type="button" onClick={() => alert("Centro de Soporte:")} className="hover:text-emerald-800 dark:hover:text-emerald-400 transition duration-150 cursor-pointer">Centro de Ayuda</button>
            <button type="button" onClick={() => alert("Vías de contacto abiertas en jorgi200.12@gmail.com")} className="hover:text-emerald-800 dark:hover:text-emerald-400 transition duration-150 cursor-pointer">Contacto</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
