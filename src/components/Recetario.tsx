import React, { useState, useEffect } from "react";
import { Recipe, MealPlan, MealType } from "../types";
import ConfirmationModal from "./ConfirmationModal";
import ImagePlaceholder from "./ImagePlaceholder";

interface RecetarioProps {
  onSelectRecipe: (recipe: Recipe) => void;
  onAddNewRecipe: () => void;
  onEditRecipe: (recipe: Recipe) => void;
  plan?: MealPlan | null;
  searchQuery?: string;
}

export default function Recetario({
  onSelectRecipe,
  onAddNewRecipe,
  onEditRecipe,
  plan,
  searchQuery = ""
}: RecetarioProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [failedImages, setFailedImages] = useState<Record<number | string, boolean>>({});
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);

  const handleImageError = async (r: Recipe) => {
    const key = r.id || r.recipeName;
    setFailedImages((prev) => ({ ...prev, [key]: true }));

    try {
      console.log(`[Recetario] Image failed for "${r.recipeName}". Reporting to server...`);
      const res = await fetch("/api/recipes/report-broken-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: r.recipeName,
          recipeId: r.id,
          brokenUrl: r.image,
          day: null,
          meal: null
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.newImageUrl) {
          console.log(`[Recetario] Hot-swapping card image with: ${data.newImageUrl}`);
          setRecipes((prev) =>
            prev.map((item) => {
              if (item.id === r.id) {
                return { ...item, image: data.newImageUrl };
              }
              return item;
            })
          );
          setFailedImages((prev) => {
            const copy = { ...prev };
            delete copy[key];
            return copy;
          });
        }
      }
    } catch (err) {
      console.error("Error reporting broken image in Recetario:", err);
    }
  };

  // Filters State
  const [selectedMealType, setSelectedMealType] = useState<string>("Todos"); // Todos, Desayuno, Almuerzo, Merienda, Cena
  const [selectedSource, setSelectedSource] = useState<string>("Todos"); // Todos, manual, plan, ai
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("Todos"); // Todos, rapido (<20m), medio (20-45m), elaborado (>45m)
  const [selectedCaloriesRange, setSelectedCaloriesRange] = useState<string>("Todos"); // Todos, ligero (<350), equilibrado (350-600), calorico (>600)
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const activeFiltersCount = [
    selectedSource !== "Todos",
    selectedTimeRange !== "Todos",
    selectedCaloriesRange !== "Todos",
    showOnlyFavorites
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSelectedSource("Todos");
    setSelectedTimeRange("Todos");
    setSelectedCaloriesRange("Todos");
    setShowOnlyFavorites(false);
  };

  // Deletion State
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch all recipes from Recetario database
  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/recipes");
      if (res.ok) {
        const data = await res.json();
        setRecipes(Array.isArray(data) ? data : []);
      } else {
        throw new Error("No se pudo obtener el listado de recetas.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  // Favorite toggle handler
  const handleToggleFavorite = async (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation(); // Avoid triggering card click (select recipe)
    if (!recipe.id) return;

    // Optimistic UI update
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipe.id ? { ...r, isFavorite: !r.isFavorite } : r
      )
    );

    try {
      const res = await fetch(`/api/recipes/${recipe.id}/toggle-favorite`, {
        method: "PUT"
      });
      if (!res.ok) {
        throw new Error();
      }
      const data = await res.json();
      // Ensure sync with server state
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipe.id ? { ...r, isFavorite: !!data.isFavorite } : r
        )
      );
    } catch (err) {
      console.error("Error toggling favorite on server, reverting state:", err);
      // Revert on failure
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipe.id ? { ...r, isFavorite: !!recipe.isFavorite } : r
        )
      );
    }
  };

  // Delete recipe handlers
  const handleStartDelete = (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    setRecipeToDelete(recipe);
  };

  const handleConfirmDelete = async () => {
    if (!recipeToDelete || !recipeToDelete.id) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/recipes/${recipeToDelete.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setRecipes((prev) => prev.filter((r) => r.id !== recipeToDelete.id));
        setRecipeToDelete(null);
      } else {
        alert("No se pudo eliminar la receta del recetario.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error de red al intentar eliminar la receta.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Render matching source badges
  const renderCardSourceBadge = (recipe: Recipe) => {
    let label = "Manual";
    let bgClass = "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-350";

    if (recipe.source === "plan") {
      label = "Plan";
      bgClass = "bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-400 border border-blue-100/40 dark:border-blue-900/30";
    } else if (recipe.source === "ocr") {
      label = "OCR";
      bgClass = "bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-400 border border-teal-100/40 dark:border-teal-900/30";
    } else if (recipe.source === "document") {
      label = "Documento";
      bgClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-300 border border-amber-100/40 dark:border-amber-900/30";
    } else if (recipe.source === "text") {
      label = "Texto";
      bgClass = "bg-purple-50 text-purple-700 dark:bg-purple-950/45 dark:text-purple-400 border border-purple-100/40 dark:border-purple-900/30";
    }

    return (
      <span className={`inline-flex items-center text-[8px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase ${bgClass}`}>
        {label}
        {recipe.isAiGenerated && " • IA 🤖"}
      </span>
    );
  };

  // Filter Recipes Logic
  const filteredRecipes = recipes.filter((r) => {
    // 1. Text Search query (recipe name, tag, and ingredients name)
    const matchesQuery =
      !searchQuery ||
      r.recipeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.tag && r.tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (() => {
        // Flatten ingredients to search them
        const ingredientsList: any[] = [];
        if (Array.isArray(r.ingredients)) {
          ingredientsList.push(...r.ingredients);
        } else if (r.ingredients && typeof r.ingredients === "object") {
          for (const key of ["primerPlato", "segundoPlato", "postre", "general"]) {
            const arr = (r.ingredients as any)[key];
            if (Array.isArray(arr)) ingredientsList.push(...arr);
          }
        }
        return ingredientsList.some((ing) =>
          ing?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      })();

    // 2. Meal Type filter
    const matchesMealType = (() => {
      if (selectedMealType === "Todos") return true;
      
      // Check if tag mentions the meal type
      if (r.tag && r.tag.toLowerCase().includes(selectedMealType.toLowerCase())) {
        return true;
      }
      
      // Check if assigned in active plan
      if (plan && plan.days) {
        const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
        const targetMeal = selectedMealType.toLowerCase() as MealType;
        for (const day of daysKeys) {
          const mealRecipe = plan.days[day]?.[targetMeal];
          if (
            mealRecipe &&
            (mealRecipe.id === r.id ||
              mealRecipe.recipeName.trim().toLowerCase() === r.recipeName.trim().toLowerCase())
          ) {
            return true;
          }
        }
      }
      return false;
    })();

    // 3. Source filter
    const matchesSource = (() => {
      if (selectedSource === "Todos") return true;
      if (selectedSource === "ai") {
        return !!r.isAiGenerated || r.source === "ocr" || r.source === "document" || r.source === "text";
      }
      return r.source === selectedSource;
    })();

    // 4. Time range filter
    const matchesTime = (() => {
      if (selectedTimeRange === "Todos") return true;
      // Extract numbers from time string (e.g. "20 min" -> 20)
      const minutes = parseInt(r.time, 10);
      if (isNaN(minutes)) return true;
      if (selectedTimeRange === "rapido") return minutes < 20;
      if (selectedTimeRange === "medio") return minutes >= 20 && minutes <= 45;
      if (selectedTimeRange === "elaborado") return minutes > 45;
      return true;
    })();

    // 5. Calories range filter
    const matchesCalories = (() => {
      if (selectedCaloriesRange === "Todos") return true;
      const cals = r.calories || 0;
      if (selectedCaloriesRange === "ligero") return cals < 350;
      if (selectedCaloriesRange === "equilibrado") return cals >= 350 && cals <= 600;
      if (selectedCaloriesRange === "calorico") return cals > 600;
      return true;
    })();

    // 6. Favorites filter
    const matchesFavorite = !showOnlyFavorites || !!r.isFavorite;

    return matchesQuery && matchesMealType && matchesSource && matchesTime && matchesCalories && matchesFavorite;
  });

  return (
    <div className="space-y-6 text-left max-w-container-max mx-auto select-none">
      
      {/* Title & Add Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/50 dark:border-zinc-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-455 text-[26px]">menu_book</span>
            Recetario Personal
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Tu biblioteca única de recetas recopiladas de planes alimentarios y creaciones personalizadas
          </p>
        </div>

        {/* Split Button / Menu */}
        <div className="relative inline-flex items-stretch rounded-xl shadow-sm z-30 self-start sm:self-auto bg-emerald-600">
          <button
            type="button"
            onClick={onAddNewRecipe}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-l-xl hover:bg-emerald-700 text-white transition font-black text-xs cursor-pointer active:scale-95 bg-transparent"
          >
            <span className="material-symbols-outlined text-[16px] mr-1.5 font-bold">add</span>
            Nueva Receta
          </button>
          
          <div className="relative flex items-stretch">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="inline-flex items-center justify-center px-2 py-2.5 rounded-r-xl hover:bg-emerald-700 text-white transition font-black text-xs border-l border-emerald-500/30 cursor-pointer bg-transparent"
            >
              <span className="material-symbols-outlined text-[16px] font-bold">keyboard_arrow_down</span>
            </button>
            
            {showAddMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 shadow-xl z-50 py-1.5 overflow-hidden animate-scale-up">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(false);
                      onAddNewRecipe();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-zinc-250 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] text-slate-400">edit_note</span>
                    Crear Manualmente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(false);
                      onAddNewRecipe(); // Opens form, AI column is available right there
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-zinc-250 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center gap-2 cursor-pointer border-t border-slate-100 dark:border-zinc-800/40"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">auto_awesome</span>
                    Importar con IA
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex select-none bg-slate-50 dark:bg-zinc-950 p-1 rounded-2xl border border-slate-200/50 dark:border-zinc-800/60 w-full sm:w-max max-w-full gap-0.5 sm:gap-1">
        {["Todos", "Desayuno", "Almuerzo", "Merienda", "Cena"].map((type) => {
          const icons: Record<string, string> = {
            Todos: "restaurant_menu",
            Desayuno: "coffee",
            Almuerzo: "local_dining",
            Merienda: "cookie",
            Cena: "soup_kitchen",
          };
          const isSelected = selectedMealType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedMealType(type)}
              className={`flex-1 sm:flex-initial flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-zinc-900"
              }`}
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[17px]">{icons[type]}</span>
              <span>{type === "Todos" ? "Todos" : type + "s"}</span>
            </button>
          );
        })}
      </div>

      {/* Collapsible Filter Bar & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/60 dark:bg-zinc-900/20 px-4 py-3 rounded-2xl border border-slate-100 dark:border-zinc-800/40 shadow-xs select-none">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-2 text-xs font-black text-slate-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 cursor-pointer transition select-none"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showFilters ? "filter_list_off" : "filter_list"}
          </span>
          <span>{showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}</span>
          {activeFiltersCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-[10px] font-black bg-emerald-600 text-white rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 cursor-pointer transition select-none"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            <span>Limpiar filtros</span>
          </button>
        )}
      </div>

      {/* Filter Controls Panel */}
      {showFilters && (
        <div className="bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md p-5 rounded-3xl border border-slate-100 dark:border-zinc-800/80 shadow-xs flex flex-col gap-4 select-none animate-scale-up">
          
          {/* Origen Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b border-slate-100 dark:border-zinc-800/30 pb-3">
            <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest min-w-[70px]">
              Origen
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "Todos", label: "Todos" },
                { value: "manual", label: "Manual" },
                { value: "plan", label: "Del Plan" },
                { value: "ai", label: "Creado con IA 🤖" }
              ].map((opt) => {
                const isActive = selectedSource === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedSource(opt.value)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 hover:bg-slate-200/85 text-slate-600 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tiempo Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border-b border-slate-100 dark:border-zinc-800/30 pb-3">
            <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest min-w-[70px]">
              Tiempo
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "Todos", label: "Cualquier tiempo" },
                { value: "rapido", label: "Rápido (< 20 min) ⚡" },
                { value: "medio", label: "Medio (20 - 45 min)" },
                { value: "elaborado", label: "Elaborado (> 45 min)" }
              ].map((opt) => {
                const isActive = selectedTimeRange === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedTimeRange(opt.value)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 hover:bg-slate-200/85 text-slate-600 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calorías & Favoritos Filter */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest min-w-[70px]">
                Calorías
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "Todos", label: "Cualquier caloría" },
                  { value: "ligero", label: "Ligeras (< 350 kcal) 🥗" },
                  { value: "equilibrado", label: "Equilibradas (350 - 600)" },
                  { value: "calorico", label: "Calóricas (> 600)" }
                ].map((opt) => {
                  const isActive = selectedCaloriesRange === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedCaloriesRange(opt.value)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-100 hover:bg-slate-200/85 text-slate-600 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold border transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 sm:self-start lg:self-auto mt-2 lg:mt-0 ${
                showOnlyFavorites
                  ? "bg-rose-600 border-rose-500 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 border-transparent text-slate-600 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              <span className={`material-symbols-outlined text-[15px] ${showOnlyFavorites ? "text-white fill-white font-variation-fill-1" : "text-slate-400"}`}>
                favorite
              </span>
              Solo Favoritos
            </button>
          </div>

        </div>
      )}

      {/* Main Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <div className="w-8 h-8 rounded-full border-[3px] border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 dark:text-zinc-500">Cargando recetario...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/15 border border-red-200/50 dark:border-red-900/40 p-6 rounded-2xl text-center space-y-2">
          <span className="material-symbols-outlined text-red-500 dark:text-red-400 text-3xl">error</span>
          <p className="text-xs font-bold text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={fetchRecipes}
            className="text-xs font-extrabold text-red-800 dark:text-red-300 underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-16 text-center shadow-xs flex flex-col items-center gap-3">
          <span className="text-5xl">🥑</span>
          <h3 className="text-sm font-black text-slate-700 dark:text-zinc-300">No se encontraron recetas</h3>
          <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm">
            {searchQuery || selectedMealType !== "Todos" || selectedSource !== "Todos" || selectedTimeRange !== "Todos" || selectedCaloriesRange !== "Todos" || showOnlyFavorites
              ? "Prueba a cambiar tus filtros de búsqueda o categoría en los paneles superiores."
              : "Comienza importando tus pautas alimentarias o crea una receta de forma manual o asistida por la IA."}
          </p>
          {(searchQuery || selectedMealType !== "Todos" || selectedSource !== "Todos" || selectedTimeRange !== "Todos" || selectedCaloriesRange !== "Todos" || showOnlyFavorites) && (
            <button
              onClick={() => {
                setSelectedMealType("Todos");
                setSelectedSource("Todos");
                setSelectedTimeRange("Todos");
                setSelectedCaloriesRange("Todos");
                setShowOnlyFavorites(false);
              }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold transition cursor-pointer"
            >
              Restablecer Filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredRecipes.map((r) => (
            <div
              key={r.id}
              onClick={() => onSelectRecipe(r)}
              className="group flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer transform hover:-translate-y-0.5 border border-transparent hover:border-slate-100 dark:hover:border-zinc-800"
            >
              {/* Recipe Image Card Header */}
              <div className="h-40 w-full bg-slate-100 dark:bg-zinc-950 border-b border-slate-100 dark:border-zinc-800/40 relative flex items-center justify-center text-slate-400 dark:text-zinc-500 select-none">
                {r.image && !failedImages[r.id || r.recipeName] ? (
                  <img
                    src={r.image}
                    alt={r.recipeName}
                    onError={() => handleImageError(r)}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-emerald-50/40 dark:bg-emerald-950/10 flex items-center justify-center transition-colors group-hover:bg-emerald-50/60 dark:group-hover:bg-emerald-950/20">
                    <ImagePlaceholder text="Sin Imagen" animate={true} />
                  </div>
                )}

                {/* Top Corner Overlay controls */}
                <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                  {renderCardSourceBadge(r)}
                </div>

                {/* Favorites Heart Icon Button */}
                <button
                  type="button"
                  onClick={(e) => handleToggleFavorite(e, r)}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-xl bg-white/95 dark:bg-zinc-900/95 border border-slate-100 dark:border-zinc-800 flex items-center justify-center shadow-sm text-slate-400 hover:text-rose-500 cursor-pointer active:scale-90 transition-all select-none hover:bg-white dark:hover:bg-zinc-900"
                  title={r.isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                >
                  <span
                    className={`material-symbols-outlined text-[17px] transition-all duration-300 transform ${
                      r.isFavorite
                        ? "text-rose-500 fill-rose-500 font-variation-fill-1 font-black scale-110 animate-pulse"
                        : "text-slate-400 group-hover:scale-105"
                    }`}
                  >
                    favorite
                  </span>
                </button>
              </div>

              {/* Recipe Info details */}
              <div className="p-5 flex-1 flex flex-col text-left justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-extrabold text-sm text-slate-800 dark:text-zinc-200 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {r.recipeName}
                    </h2>
                    {r.tag && (
                      <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-450 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md shrink-0 uppercase tracking-wide">
                        {r.tag.split(",")[0].trim()}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3 text-[10px] text-slate-500 dark:text-zinc-400 font-bold select-none">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-slate-400 dark:text-zinc-500">schedule</span>
                      {r.time || "20 min"}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="material-symbols-outlined text-[13px]">fitness_center</span>
                      {r.calories || 350} kcal
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-slate-400 dark:text-zinc-500">restaurant</span>
                      {r.servings || 1} {r.servings === 1 ? "ración" : "raciones"}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {r.tips || "Una receta saludable y equilibrada, perfecta para integrar en tu rutina semanal."}
                  </p>
                </div>

                {/* Card Controls Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-3.5 mt-2.5">
                  {/* View Details Shortcut */}
                  <span className="inline-flex items-center text-[10px] font-black text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform duration-200 gap-0.5 select-none">
                    Ver receta
                    <span className="material-symbols-outlined text-[12px] font-bold">arrow_forward_ios</span>
                  </span>

                  {/* Actions buttons */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditRecipe(r);
                      }}
                      className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center cursor-pointer transition"
                      title="Editar receta"
                    >
                      <span className="material-symbols-outlined text-[17px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleStartDelete(e, r)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-500 hover:text-red-500 flex items-center justify-center cursor-pointer transition"
                      title="Eliminar receta"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Deleting */}
      <ConfirmationModal
        isOpen={!!recipeToDelete}
        title="¿Eliminar receta?"
        description={`¿Estás seguro de que deseas eliminar "${recipeToDelete?.recipeName}" del recetario? Esta acción no se puede deshacer.`}
        confirmLabel={isDeleting ? "Eliminando..." : "Eliminar Receta"}
        onConfirm={handleConfirmDelete}
        onCancel={() => setRecipeToDelete(null)}
        icon="delete_forever"
        variant="danger"
      />

    </div>
  );
}
