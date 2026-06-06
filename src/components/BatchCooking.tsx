import React, { useState, useEffect, useRef } from "react";
import { PlanMetadata, MealPlan, Recipe, DayType, MealType } from "../types";

interface BatchCookingProps {
  plan: MealPlan | null;
  metadata: PlanMetadata | null;
  onSelectRecipe?: (day: DayType, meal: MealType, recipe: Recipe) => void;
}

interface StorageTip {
  preparation: string;
  container: string;
  duration: string;
  freezable: boolean;
  reheatingAndTips: string;
}

interface BatchCookingStep {
  stepNumber: number;
  title: string;
  description: string;
  duration: string;
  utensils: string[];
  recipesAffected: string[];
  ingredients?: string[];
}

interface BatchCookingGuide {
  introduction: string;
  prepTime: string;
  steps: BatchCookingStep[];
  storageTips: StorageTip[] | string;
}

interface KitchenParams {
  burnersCount: number;
  hasOven: boolean;
  hasMicrowave: boolean;
  hasAirfryer: boolean;
  hasRobot: boolean;
  customTools: string;
}

export default function BatchCooking({ plan, metadata, onSelectRecipe }: BatchCookingProps) {
  // Find recipe day and meal from name
  const findRecipeDayMeal = (recipeName: string): { day: DayType; meal: MealType; recipe: Recipe } | null => {
    if (!plan) return null;
    const daysKeys = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
    const mealsKeys = ["almuerzo", "cena"] as const;
    
    // Exact match
    for (const day of daysKeys) {
      for (const meal of mealsKeys) {
        const rec = plan.days[day]?.[meal];
        if (rec && rec.recipeName.trim().toLowerCase() === recipeName.trim().toLowerCase()) {
          return { day, meal, recipe: rec };
        }
      }
    }
    // Sub-string/Fuzzy match
    for (const day of daysKeys) {
      for (const meal of mealsKeys) {
        const rec = plan.days[day]?.[meal];
        if (rec && (
          rec.recipeName.toLowerCase().includes(recipeName.toLowerCase()) || 
          recipeName.toLowerCase().includes(rec.recipeName.toLowerCase())
        )) {
          return { day, meal, recipe: rec };
        }
      }
    }
    return null;
  };
  // Kitchen setup parameters state
  const [params, setParams] = useState<KitchenParams>({
    burnersCount: 4,
    hasOven: true,
    hasMicrowave: true,
    hasAirfryer: false,
    hasRobot: false,
    customTools: ""
  });

  // UI state
  const [guide, setGuide] = useState<BatchCookingGuide | null>(null);
  const [generatedParams, setGeneratedParams] = useState<KitchenParams | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Custom checklist state
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  // Confirmation modales states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReprocessConfirm, setShowReprocessConfirm] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const progressIntervalRef = useRef<any>(null);

  const loadingSteps = [
    "Preparando menú y analizando ingredientes de almuerzos y cenas...",
    "Conectando de forma segura con la IA de Gemini...",
    "Agrupando cortes de verduras y pre-preparaciones (Mise en Place)...",
    "Distribuyendo cocciones de forma óptima en fuegos y electrodomésticos...",
    "Estructurando la secuencia temporal y estimando tiempos de descanso...",
    "Sincronizando la guía con la base de datos de tu planificación...",
    "¡Todo listo! Guía de Batch Cooking optimizada con éxito."
  ];

  // Fetch cached batch cooking guide on mount
  useEffect(() => {
    const fetchCachedGuide = async () => {
      if (!metadata?.id) {
        setIsFetching(false);
        return;
      }
      setIsFetching(true);
      try {
        const response = await fetch("/api/plan/batch-cooking");
        if (response.ok) {
          const data = await response.json();
          if (data.guide) {
            setGuide(data.guide);
            if (data.params) {
              setParams(data.params);
              setGeneratedParams(data.params);
            }
            // Load checked steps from localStorage
            const savedChecks = localStorage.getItem(`batch-cooking-checked-${metadata.id}`);
            if (savedChecks) {
              try {
                setCheckedSteps(JSON.parse(savedChecks));
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.error("Error reading cached batch cooking:", err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchCachedGuide();
  }, [metadata]);

  // Track elapsed time during generation
  useEffect(() => {
    let intervalId: any;
    if (isGenerating) {
      const startTime = Date.now();
      setElapsedTime(0);
      intervalId = setInterval(() => {
        setElapsedTime((Date.now() - startTime) / 1000);
      }, 100);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isGenerating]);

  // Handle generation call to backend
  const handleGenerate = async (force = false) => {
    setIsGenerating(true);
    setProgress(0);
    setLoadingStep(0);
    setErrorMsg(null);

    // Smooth progress bar emulation
    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += (99 - currentProgress) * 0.02;
      const rounded = Math.min(currentProgress, 99);
      setProgress(rounded);

      if (rounded < 15) {
        setLoadingStep(0);
      } else if (rounded < 32) {
        setLoadingStep(1);
      } else if (rounded < 50) {
        setLoadingStep(2);
      } else if (rounded < 68) {
        setLoadingStep(3);
      } else if (rounded < 82) {
        setLoadingStep(4);
      } else {
        setLoadingStep(5);
      }
    }, 250);

    try {
      const response = await fetch("/api/plan/batch-cooking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          params: params,
          forceRegenerate: force
        })
      });

      if (!response.ok) {
        let errMsg = "No se pudo conectar con el servidor para procesar con IA.";
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      clearInterval(progressIntervalRef.current);
      setProgress(100);
      setLoadingStep(6);

      setTimeout(() => {
        setGuide(data.guide);
        setGeneratedParams(data.params);
        setCheckedSteps({});
        localStorage.removeItem(`batch-cooking-checked-${metadata?.id}`);
        setIsGenerating(false);
        setShowSettingsPanel(false);
      }, 600);

    } catch (err: any) {
      clearInterval(progressIntervalRef.current);
      console.error(err);
      setErrorMsg(err.message || "Error inesperado al generar la guía de Batch Cooking.");
      setIsGenerating(false);
    }
  };

  // Check off individual steps
  const toggleStep = (stepNum: number) => {
    const newChecks = {
      ...checkedSteps,
      [stepNum]: !checkedSteps[stepNum]
    };
    setCheckedSteps(newChecks);
    if (metadata?.id) {
      localStorage.setItem(`batch-cooking-checked-${metadata.id}`, JSON.stringify(newChecks));
    }
  };

  // Reset current timeline checked steps
  const handleResetChecklist = () => {
    setCheckedSteps({});
    if (metadata?.id) {
      localStorage.removeItem(`batch-cooking-checked-${metadata.id}`);
    }
  };

  // Delete batch cooking guide from server
  const handleDeleteGuide = async () => {
    try {
      const response = await fetch("/api/plan/batch-cooking/reset", {
        method: "POST"
      });
      if (response.ok) {
        setGuide(null);
        setGeneratedParams(null);
        setCheckedSteps({});
        if (metadata?.id) {
          localStorage.removeItem(`batch-cooking-checked-${metadata.id}`);
        }
      } else {
        throw new Error();
      }
    } catch (err) {
      alert("No se pudo eliminar la guía de la base de datos.");
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  // Check if current form params match the generated parameters
  const paramsMatch = generatedParams 
    ? params.burnersCount === generatedParams.burnersCount &&
      params.hasOven === generatedParams.hasOven &&
      params.hasMicrowave === generatedParams.hasMicrowave &&
      params.hasAirfryer === generatedParams.hasAirfryer &&
      params.hasRobot === generatedParams.hasRobot &&
      params.customTools.trim() === generatedParams.customTools.trim()
    : true;

  const totalSteps = guide?.steps.length || 0;
  const completedSteps = Object.values(checkedSteps).filter(Boolean).length;
  const completionPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  if (isFetching) {
    return (
      <div className="py-24 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin mx-auto mb-4"></div>
        <p className="text-sm font-semibold text-gray-550 dark:text-zinc-400">Cargando guía de Batch Cooking guardada...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 select-text">
      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 dark:border-zinc-800/80 pb-4 no-print select-none">
        <div>
          <h1 className="text-3xl font-bold text-gray-950 dark:text-white tracking-tight font-sans">Guía de Batch Cooking</h1>
          <p className="text-sm text-gray-550 dark:text-zinc-400">Prepara la comida de toda la semana en una sola sesión organizada de forma lógica.</p>
        </div>

        {guide && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition duration-200 border cursor-pointer flex items-center gap-1.5 shadow-sm ${
                showSettingsPanel 
                  ? "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700"
                  : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-350 border-slate-200/60 dark:border-zinc-850 hover:bg-slate-50 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">settings_accessibility</span>
              Ajustes de Cocina
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="py-2 px-4 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-350 border border-slate-200/60 dark:border-zinc-850 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold transition duration-250 cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Imprimir Guía
            </button>
          </div>
        )}
      </div>

      {!plan ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-zinc-800 max-w-lg mx-auto">
          <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-zinc-650 mb-4 font-light">outdoor_grill</span>
          <p className="text-slate-955 dark:text-white font-bold text-lg mb-1">No hay ningún plan cargado</p>
          <p className="text-sm text-[#404943] dark:text-zinc-400 leading-relaxed mb-6">
            Por favor, vuelve al Dashboard principal y sube un plan semanal de alimentación en formato PDF de forma instantánea.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Form parameters or Guide steps */}
          <div className={`lg:col-span-8 space-y-6 ${guide && !showSettingsPanel ? "block" : "block bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 border border-slate-200/60 dark:border-zinc-800/80 shadow-sm"}`}>
            
            {/* CONFIGURATION PANEL (Settings form) */}
            {(showSettingsPanel || !guide) && (
              <div className="space-y-6 select-none no-print">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-50 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 p-2.5 rounded-xl">
                    <span className="material-symbols-outlined block">kitchen</span>
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Configura tu Cocina</h2>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">Adapta el cocinado de la IA a las hornallas y herramientas de las que dispones</p>
                  </div>
                </div>

                {/* Blue Info Banner explaining lunches and dinners */}
                <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 p-4.5 rounded-2xl text-sky-850 dark:text-sky-300 text-xs flex gap-3 items-start shadow-xs">
                  <span className="material-symbols-outlined text-[20px] shrink-0 text-sky-600 dark:text-sky-400">info</span>
                  <div className="text-left">
                    <p className="font-extrabold mb-0.5 tracking-tight text-sky-950 dark:text-sky-200">Alcance de la Guía de Batch Cooking</p>
                    <p className="opacity-90 leading-relaxed">
                      Esta secuencia se optimizará <strong className="font-bold text-sky-950 dark:text-sky-100">exclusivamente para los almuerzos y cenas</strong> de toda la semana. Los desayunos y meriendas se excluyen, ya que consisten en preparaciones simples y rápidas que no requieren un cocinado previo.
                    </p>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Stove Burners count */}
                  <div className="space-y-2 text-left">
                    <label htmlFor="burners-count" className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                      Fuegos disponibles simultáneamente
                    </label>
                    <div className="flex items-center gap-3 bg-[#f8f9fa] dark:bg-zinc-950/40 p-2 rounded-2xl border border-slate-200/50 dark:border-zinc-800/60 max-w-[200px]">
                      <button
                        type="button"
                        onClick={() => setParams(p => ({ ...p, burnersCount: Math.max(1, p.burnersCount - 1) }))}
                        className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 flex items-center justify-center font-black text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer shadow-sm active:scale-95 transition-all text-slate-700 dark:text-zinc-300"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-black text-sm text-emerald-600 dark:text-emerald-400" id="burners-count">
                        {params.burnersCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setParams(p => ({ ...p, burnersCount: Math.min(8, p.burnersCount + 1) }))}
                        className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 flex items-center justify-center font-black text-sm hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer shadow-sm active:scale-95 transition-all text-slate-700 dark:text-zinc-300"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Appliances Grid Checkboxes */}
                  <div className="space-y-2 text-left">
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                      Electrodomésticos disponibles
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: "hasOven", label: "Horno" },
                        { key: "hasMicrowave", label: "Microondas" },
                        { key: "hasAirfryer", label: "Airfryer" },
                        { key: "hasRobot", label: "Robot Cocina" }
                      ].map(item => {
                        const checked = (params as any)[item.key];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setParams(p => ({ ...p, [item.key]: !checked }))}
                            className={`flex items-center gap-2 p-3 rounded-2xl border text-left font-semibold text-xs cursor-pointer transition-all ${
                              checked
                                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                : "bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800/80 hover:border-slate-350 dark:hover:border-zinc-750 text-slate-700 dark:text-zinc-350"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-zinc-500 shrink-0">
                              {checked ? "check_box" : "check_box_outline_blank"}
                            </span>
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Custom tools text */}
                <div className="space-y-2 text-left">
                  <label htmlFor="custom-tools" className="text-[10px] font-black text-zinc-400 dark:text-zinc-550 uppercase tracking-widest block font-bold">
                    Utensilios o herramientas adicionales (Ej: Vaporera, Mandolina...)
                  </label>
                  <input
                    id="custom-tools"
                    type="text"
                    placeholder="Escribe herramientas adicionales separadas por comas"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 bg-[#f8f9fa] dark:bg-zinc-955 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 dark:text-zinc-300"
                    value={params.customTools}
                    onChange={(e) => setParams(p => ({ ...p, customTools: e.target.value }))}
                  />
                </div>

                {/* Form Action triggers */}
                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      if (guide) {
                        setShowSettingsPanel(false);
                      } else {
                        handleGenerate(false);
                      }
                    }}
                    className="flex-1 py-3 bg-[#0f5238] hover:bg-[#116c4a] text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow cursor-pointer transition duration-150 active:scale-98"
                  >
                    {guide ? "Guardar Ajustes" : "Generar Guía de Batch Cooking"}
                  </button>
                  {guide && (
                    <button
                      type="button"
                      onClick={() => setShowSettingsPanel(false)}
                      className="py-3 px-6 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-sm rounded-2xl cursor-pointer transition duration-150 active:scale-98"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* BATCH COOKING TIMELINE CHECKLIST */}
            {guide && !showSettingsPanel && (
              <div className="space-y-6">
                
                {/* Visual warning if settings changed and do not match guide params */}
                {!paramsMatch && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-4.5 rounded-2xl text-amber-850 dark:text-amber-300 text-xs flex gap-3 items-start animate-fade-in no-print">
                    <span className="material-symbols-outlined text-[20px] shrink-0 text-amber-600 dark:text-amber-400">warning</span>
                    <div className="text-left flex-1">
                      <p className="font-extrabold mb-0.5 tracking-tight text-amber-950 dark:text-amber-200">Ajustes modificados</p>
                      <p className="opacity-90 leading-relaxed">
                        Los ajustes actuales de fuegos o electrodomésticos difieren de los utilizados para compilar esta guía. Pulsa el botón de abajo si deseas regenerar la guía optimizada para tu nueva configuración.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowReprocessConfirm(true)}
                        className="mt-2.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition duration-150 cursor-pointer border-none shadow-xs"
                      >
                        Reprocesar con nuevos ajustes
                      </button>
                    </div>
                  </div>
                )}

                {/* Progress checklist banner */}
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-100 dark:border-zinc-850 shadow-xs flex flex-col gap-4 text-left select-none">
                  <div className="flex justify-between items-center text-xs tracking-wider text-slate-400 dark:text-zinc-500 font-black uppercase">
                    <span>Progreso de Cocinado por Lotes</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/45 px-2.5 py-0.5 rounded-md">
                      {completedSteps} de {totalSteps} pasos ({completionPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-300 ease-out rounded-full" 
                      style={{ width: `${completionPercent}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100/50 dark:border-zinc-800/40">
                    <span className="text-slate-450 dark:text-zinc-500 font-medium">Estimación de cocina: <strong className="text-slate-800 dark:text-zinc-200">{guide.prepTime}</strong></span>
                    {completedSteps > 0 && (
                      <button
                        type="button"
                        onClick={handleResetChecklist}
                        className="text-red-650 hover:text-red-750 dark:text-red-400 dark:hover:text-red-350 font-bold hover:underline cursor-pointer border-none bg-transparent"
                      >
                        Reiniciar progreso
                      </button>
                    )}
                  </div>
                </div>

                {/* Timeline step list */}
                <div className="relative border-l-2 border-slate-150 dark:border-zinc-800/70 ml-4 pl-6 md:pl-8 space-y-8 select-text">
                  {guide.steps.map((step) => {
                    const isCompleted = !!checkedSteps[step.stepNumber];
                    return (
                      <div 
                        key={step.stepNumber} 
                        className={`relative transition-all duration-200 text-left ${
                          isCompleted ? "opacity-65" : ""
                        }`}
                      >
                        {/* Timeline Node Checkbox Marker */}
                        <div className="absolute -left-[45px] md:-left-[53px] top-1 z-10 select-none">
                          <button
                            type="button"
                            onClick={() => toggleStep(step.stepNumber)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition shadow-md border ${
                              isCompleted
                                ? "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 hover:border-emerald-500 text-slate-555 dark:text-zinc-455"
                            }`}
                            title={isCompleted ? "Marcar paso como pendiente" : "Marcar paso como completado"}
                          >
                            {isCompleted ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="4.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-xs font-black">{step.stepNumber}</span>
                            )}
                          </button>
                        </div>

                        {/* Step Card */}
                        <div className={`p-5 rounded-2xl border transition-all duration-200 bg-white dark:bg-zinc-900 ${
                          isCompleted 
                            ? "border-emerald-500/25 dark:border-emerald-500/10 shadow-sm" 
                            : "border-slate-200/75 dark:border-zinc-850 shadow-sm hover:border-slate-350 dark:hover:border-zinc-700 hover:shadow-md"
                        }`}>
                          <div className="mb-3.5 select-none text-left space-y-2">
                            <h3 className={`font-black text-base md:text-lg ${
                              isCompleted 
                                ? "line-through text-slate-400 dark:text-zinc-550" 
                                : "text-slate-900 dark:text-white"
                            }`}>
                              Paso {step.stepNumber}: {step.title}
                            </h3>
                            
                            <div className="flex flex-wrap gap-1.5">
                              {/* Duration Badge */}
                              <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">timer</span>
                                {step.duration}
                              </span>
                              {/* Utensils Badges */}
                              {step.utensils.map(u => (
                                <span key={u} className="bg-slate-100/60 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-455 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg">
                                  {u}
                                </span>
                              ))}
                            </div>
                          </div>

                          <p className={`text-xs md:text-sm text-[#404943] dark:text-zinc-300 leading-relaxed mb-4 text-left ${
                            isCompleted ? "line-through text-slate-400 dark:text-zinc-550" : ""
                          }`}>
                            {step.description}
                          </p>

                          {/* Step Ingredients Panel */}
                          {step.ingredients && step.ingredients.length > 0 && (
                            <div className={`mb-4 bg-slate-55/40 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-800/40 rounded-2xl p-3 text-left transition-all duration-150 ${isCompleted ? "opacity-60" : ""}`}>
                              <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-2.5 flex items-center gap-1.5 select-none">
                                <span className="material-symbols-outlined text-[14px]">shopping_basket</span>
                                Ingredientes necesarios para este paso
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                                {step.ingredients.map((ing, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0"></span>
                                    <span>{ing}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Affected Recipes Badges */}
                          {step.recipesAffected && step.recipesAffected.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center select-none pt-3.5 border-t border-slate-100/50 dark:border-zinc-800/40 text-left">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider">Comidas pautadas:</span>
                              {step.recipesAffected.map(r => {
                                const found = findRecipeDayMeal(r);
                                if (found) {
                                  return (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => onSelectRecipe?.(found.day, found.meal, found.recipe)}
                                      className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/10 hover:border-emerald-500/35 transition cursor-pointer active:scale-95 duration-150 shadow-2xs"
                                      title={`Ver receta de ${r}`}
                                    >
                                      {r}
                                    </button>
                                  );
                                }
                                return (
                                  <span
                                    key={r}
                                    className="bg-slate-50 dark:bg-zinc-850 text-slate-500 dark:text-zinc-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-slate-200/50 dark:border-zinc-800/60"
                                  >
                                    {r}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Storage and Preservation guidelines card */}
                {guide.storageTips && (
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 border border-slate-200/60 dark:border-zinc-800/80 shadow-sm text-left select-text">
                    <h3 className="text-sm md:text-base font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2.5 select-none border-b border-slate-100 dark:border-zinc-800 pb-3">
                      <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[22px]">shelves</span>
                      Recomendaciones de Envasado y Conservación
                    </h3>
                    
                    {Array.isArray(guide.storageTips) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {guide.storageTips.map((tip, idx) => (
                          <div key={idx} className="bg-slate-50/50 dark:bg-zinc-950/20 border border-slate-100/70 dark:border-zinc-800/60 rounded-3xl p-5 md:p-6 flex flex-col justify-between hover:shadow-xs transition duration-200">
                            <div>
                              <div className="flex items-start justify-between gap-3 mb-3.5">
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm md:text-base leading-tight">
                                  {tip.preparation}
                                </h4>
                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1 tracking-wider shrink-0 select-none ${
                                  tip.freezable 
                                    ? "bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-400 border border-sky-200/40 dark:border-sky-900/30" 
                                    : "bg-slate-100 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 border border-slate-200/40 dark:border-zinc-700/30"
                                }`}>
                                  <span className="material-symbols-outlined text-[12px] font-bold">
                                    {tip.freezable ? "ac_unit" : "block"}
                                  </span>
                                  {tip.freezable ? "Congelable" : "No Congelar"}
                                </span>
                              </div>

                              {/* Container Type */}
                              <div className="flex items-center gap-2 text-xs text-[#0f5238] dark:text-emerald-400 font-bold mb-4 bg-emerald-50/40 dark:bg-emerald-950/10 px-3 py-1.5 rounded-xl border border-emerald-500/10 select-none w-fit">
                                <span className="material-symbols-outlined text-[16px]">kitchen</span>
                                <span className="tracking-tight">{tip.container}</span>
                              </div>

                              {/* Reheating and details */}
                              <p className="text-xs md:text-sm text-[#404943] dark:text-zinc-300 leading-relaxed mb-4">
                                {tip.reheatingAndTips}
                              </p>
                            </div>

                            {/* Duration Footer */}
                            <div className="pt-3 border-t border-slate-200/40 dark:border-zinc-800/40 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 select-none mt-auto">
                              <span className="material-symbols-outlined text-[16px] text-emerald-500">schedule</span>
                              <span>Conservación: <strong className="text-slate-800 dark:text-zinc-200 font-bold">{tip.duration}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Legacy Fallback */
                      <div className="text-xs md:text-sm text-[#404943] dark:text-zinc-300 leading-relaxed whitespace-pre-line text-left">
                        {guide.storageTips}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Right sidebar: AI Info Widget & Actions */}
          <div className="lg:col-span-4 flex flex-col gap-6 select-none no-print">
            
            {/* AI analysis banner info */}
            <div className="bg-[#0f5238] dark:bg-[#073322] text-white p-6 rounded-3xl shadow-md flex flex-col justify-between border border-emerald-800 dark:border-emerald-900/40 text-left">
              <div>
                <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2 text-white">
                  <span className="material-symbols-outlined text-emerald-300">auto_awesome</span> Cocinado Inteligente
                </h3>
                <p className="text-sm text-emerald-100 leading-relaxed mb-6 font-medium">
                  El Batch Cooking agrupa procesos de cocinado para optimizar tu tiempo. La IA de VitalityNutri analiza el plan de comidas activo para:
                </p>
                <ul className="space-y-3.5 text-sm">
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-semibold text-white">Unificar cortes de ingredientes</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-semibold text-white">Organizar cocciones paralelas</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-semibold text-white">Garantizar platos frescos</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-6 border-t border-emerald-800/60 dark:border-emerald-900/50 flex items-center justify-between">
                <span className="text-xs text-emerald-200">Impulsado por Gemini 3.5</span>
                <span className="text-xs font-bold bg-emerald-900/80 dark:bg-emerald-900/60 text-emerald-100 px-2.5 py-1 rounded-md">VITALITY AI</span>
              </div>
            </div>

            {/* Actions panel when guide exists */}
            {guide && (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-slate-200/60 dark:border-zinc-800/80 shadow-sm flex flex-col gap-3 text-left">
                <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                  Acciones de la Guía
                </span>
                
                <button
                  type="button"
                  onClick={() => setShowReprocessConfirm(true)}
                  className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 dark:bg-amber-955 dark:hover:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold text-xs rounded-xl border border-amber-200/50 dark:border-amber-900/35 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  Reprocesar Guía con IA
                </button>

                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-955 dark:hover:bg-red-950 text-red-700 dark:text-red-400 font-extrabold text-xs rounded-xl border border-red-200/40 dark:border-red-900/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Eliminar Guía
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* FULL-SCREEN GENERATION LOADING OVERLAY */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-[9999] animate-fade-in no-print select-none">
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined text-2xl animate-pulse">auto_awesome</span>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-[#0f5238] dark:text-emerald-400 mb-2 animate-pulse">Compilando Guía de Cocinado</h3>
              <p className="text-xs text-gray-555 dark:text-zinc-400 leading-relaxed">
                Nuestra red neuronal está consolidando las recetas del plan, organizando la Mise en Place y estructurando la línea de tiempo.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-emerald-700 dark:text-emerald-400 truncate max-w-[280px]">
                  {loadingSteps[loadingStep]}
                </span>
                <span className="text-gray-400 dark:text-zinc-500">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-300 ease-out rounded-full" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            <div className="w-full text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-2.5 flex items-center justify-center gap-1.5 animate-pulse">
              <span className="material-symbols-outlined text-[16px]">timer</span>
              Tiempo transcurrido: {elapsedTime.toFixed(1)}s
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: DELETE GUIDE */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print select-none">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
            <span className="material-symbols-outlined text-red-650 text-4xl animate-bounce">warning</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">¿Eliminar Guía de Batch Cooking?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                Esta acción borrará permanentemente la guía actual de la base de datos y perderás el progreso de los pasos completados.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-2">
              <button
                type="button"
                onClick={handleDeleteGuide}
                className="flex-1 py-2.5 bg-red-650 hover:bg-red-750 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition active:scale-95 border-none"
              >
                Sí, Eliminar
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-205 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-350 font-extrabold text-xs rounded-xl cursor-pointer transition active:scale-95 border-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG: REPROCESS GUIDE */}
      {showReprocessConfirm && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print select-none">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center gap-4 text-center">
            <span className="material-symbols-outlined text-amber-500 text-4xl animate-pulse">auto_awesome</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">¿Reprocesar Guía con IA?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                Se realizará una nueva consulta a Gemini para generar una guía adaptada a tu equipamiento actual de cocina. Se perderá el progreso de pasos completados de la guía anterior.
              </p>
            </div>
            <div className="flex gap-3 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowReprocessConfirm(false);
                  handleGenerate(true);
                }}
                className="flex-1 py-2.5 bg-[#0f5238] hover:bg-[#116c4a] text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition active:scale-95 border-none"
              >
                Sí, Reprocesar
              </button>
              <button
                type="button"
                onClick={() => setShowReprocessConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-205 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-355 font-extrabold text-xs rounded-xl cursor-pointer transition active:scale-95 border-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
