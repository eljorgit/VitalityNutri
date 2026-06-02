import React, { useState, useRef, useEffect } from "react";
import { PlanMetadata, MealPlan } from "../types";

interface DashboardProps {
  metadata: PlanMetadata | null;
  onPlanProcessed: (newPlan: MealPlan, newMetadata: PlanMetadata) => void;
  setActiveTab: (tab: string) => void;
  onResetPlan: () => void;
}

export default function Dashboard({ 
  metadata, 
  onPlanProcessed, 
  setActiveTab,
  onResetPlan 
}: DashboardProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDev = (import.meta as any).env?.DEV || (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"));

  // Reassuring messages during compilation/analysis by Gemini
  const loadingSteps = [
    "Preparando archivo y conectando con el servidor...", // 0% - 15%
    "Conectando de forma segura con la IA de Gemini...",   // 15% - 35%
    "Analizando estructura del plan de alimentación...",   // 35% - 55%
    "Calculando raciones, ingredientes y macronutrientes...", // 55% - 75%
    "Estructurando recetas y pasos de preparación...",     // 75% - 90%
    "Sincronizando y guardando plan en la base de datos...", // 90% - 99%
    "¡Todo listo! Recetas optimizadas generadas con éxito."   // 100%
  ];

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let intervalId: any;
    if (isProcessing) {
      const startTime = Date.now();
      setElapsedTime(0);
      intervalId = setInterval(() => {
        setElapsedTime((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      setElapsedTime(0);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isProcessing]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/history");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [metadata]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProgress(0);
  };

  const handleReprocess = async () => {
    if (!metadata || !metadata.savedFileName) return;

    setIsProcessing(true);
    setProgress(0);
    setLoadingStep(0);
    setErrorMsg(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      // Smooth asymptotic progress towards 99%
      currentProgress += (99 - currentProgress) * 0.015;
      const rounded = Math.min(currentProgress, 99);
      setProgress(rounded);

      if (rounded < 15) {
        setLoadingStep(0);
      } else if (rounded < 35) {
        setLoadingStep(1);
      } else if (rounded < 55) {
        setLoadingStep(2);
      } else if (rounded < 75) {
        setLoadingStep(3);
      } else if (rounded < 90) {
        setLoadingStep(4);
      } else {
        setLoadingStep(5);
      }
    }, 200);

    try {
      const response = await fetch("/api/reprocess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        let errMsg = "Ocurrió un error al reprocesar el plan con IA.";
        try {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      clearInterval(progressInterval);
      setProgress(100);
      setLoadingStep(6);

      setTimeout(() => {
        onPlanProcessed(data.plan, data.metadata);
        fetchHistory();
      }, 600);

    } catch (err: any) {
      clearInterval(progressInterval);
      if (err.name === "AbortError") {
        console.log("Reprocesamiento cancelado por el usuario.");
        return;
      }
      console.error(err);
      setErrorMsg(err.message || "No se pudo conectar con el servidor o reprocesar el archivo.");
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  const handleRestoreHistory = async (id: number) => {
    setIsProcessing(true);
    setLoadingStep(4);
    setErrorMsg(null);
    try {
      const response = await fetch(`/api/history/restore/${id}`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("No se pudo restaurar el plan seleccionado.");
      }

      const data = await response.json();
      onPlanProcessed(data.plan, data.metadata);
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error de red al intentar restaurar el plan.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHistory = async (id: number, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar "${name}" del historial? Esta acción borrará permanentemente el PDF y la planificación de la base de datos.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/history/${id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar el plan.");
      }

      if (metadata && metadata.id === id) {
        onResetPlan();
      } else {
        fetchHistory();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error al intentar eliminar el plan del historial.");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (file.type !== "application/pdf") {
      setErrorMsg("Por el momento, solo se soportan planes de alimentación en formato PDF.");
      return;
    }
    setErrorMsg(null);
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setProgress(0);
    setLoadingStep(0);
    setErrorMsg(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      // Smooth asymptotic progress towards 99%
      currentProgress += (99 - currentProgress) * 0.015;
      const rounded = Math.min(currentProgress, 99);
      setProgress(rounded);

      if (rounded < 15) {
        setLoadingStep(0);
      } else if (rounded < 35) {
        setLoadingStep(1);
      } else if (rounded < 55) {
        setLoadingStep(2);
      } else if (rounded < 75) {
        setLoadingStep(3);
      } else if (rounded < 90) {
        setLoadingStep(4);
      } else {
        setLoadingStep(5);
      }
    }, 200);

    try {
      const reader = new FileReader();
      
      // Promisify file read
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = (err) => reject(err);
      });

      reader.readAsDataURL(selectedFile);
      const fileData = await base64Promise;

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileData: fileData
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        let errMsg = "Ocurrió un error al procesar el plan con IA.";
        try {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } catch (e) {
          try {
            const textText = await response.text();
            if (textText) {
              errMsg = `Error de Red del Servidor: ${textText.substring(0, 160)}`;
            }
          } catch (_) {}
        }
        throw new Error(errMsg);
      }

      const data = await response.json();

      clearInterval(progressInterval);
      setProgress(100);
      setLoadingStep(6);

      setTimeout(() => {
        onPlanProcessed(data.plan, data.metadata);
        setActiveTab("calendar");
      }, 600);

    } catch (err: any) {
      clearInterval(progressInterval);
      if (err.name === "AbortError") {
        console.log("Carga cancelada por el usuario.");
        return;
      }
      console.error(err);
      setErrorMsg(err.message || "No se pudo conectar con el servidor o procesar el archivo.");
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  // Mock plans to download/apply
  const mockRecentPlans = [
    { name: "Verano_Detox_V2.pdf", date: "Procesado hace 2 días", isHealthy: true },
    { name: "Ganancia_Fuerza_Quinoa.pdf", date: "Procesado hace 1 mes", isHealthy: false }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Header Card */}
      <section className="relative overflow-hidden rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-8 md:p-12 shadow-sm animate-fade-in">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none select-none">
          <img 
            src="/hero_background.png" 
            alt="Fondo nutricional" 
            className="w-full h-full object-cover object-right opacity-30 dark:opacity-20 transition-all duration-300" 
          />
          {/* Subtle gradient to ensure left-aligned text is 100% readable and contrast is perfect */}
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-transparent dark:from-emerald-950/90 dark:via-emerald-950/40 dark:to-transparent" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 mb-4">
            <span className="material-symbols-outlined text-[14px]">explore</span> Alimentación Consciente
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0f5238] dark:text-emerald-400 tracking-tight leading-tight mb-4">
            Bienvenido a tu viaje de nutrición consciente.
          </h1>
          <p className="text-base md:text-lg text-[#404943] dark:text-zinc-300 leading-relaxed max-w-2xl">
            Organiza tus comidas con absoluta claridad. Sube tu PDF de alimentación profesional pautado por tu nutricionista y nuestra Inteligencia Artificial construirá un calendario totalmente interactivo con multiplicador de raciones y lista de la compra.
          </p>
        </div>

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
          {/* File Upload card component */}
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl p-6 md:p-8 border border-[#bfc9c1]/40 dark:border-zinc-800 shadow-sm relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-emerald-100 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-450 p-2.5 rounded-xl">
                <span className="material-symbols-outlined block">description</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Sube tu Plan de Alimentación</h2>
                <p className="text-xs text-gray-400 dark:text-zinc-500">Permite procesar archivos .pdf con recetas y raciones</p>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div 
              id="drop-zone"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={handleSelectClick}
              className={`relative border-2 border-dashed rounded-2xl p-8 md:p-16 min-h-[400px] flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group ${
                dragActive 
                  ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20" 
                  : "border-emerald-200 dark:border-zinc-800 bg-[#f6f9ff]/50 dark:bg-zinc-950/20 hover:border-emerald-600 hover:bg-[#f6f9ff] dark:hover:bg-zinc-950/40"
              }`}
            >
              <input 
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="mb-4 p-4 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-emerald-50 dark:border-zinc-700/50 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-4xl text-emerald-600 dark:text-emerald-400" style={{ fontVariationSettings: "'FILL' 0" }}>
                  picture_as_pdf
                </span>
              </div>

              {selectedFile ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedFile.name}</p>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">✓ Archivo listo para ser analizado</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Arrastra y suelta tu PDF aquí</p>
                  <p className="text-sm text-gray-400 dark:text-zinc-500 font-medium">o pulsa para buscar en tu dispositivo</p>
                </div>
              )}

              <button 
                type="button"
                className="mt-6 px-6 py-2.5 bg-[#0f5238] hover:bg-[#116c4a] text-white font-medium text-sm rounded-full transition-all duration-200 shadow-sm hover:shadow active:scale-95 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectClick();
                }}
              >
                Seleccionar Archivo
              </button>
            </div>

            {/* Error Message banner */}
            {errorMsg && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 rounded-xl text-sm text-red-700 dark:text-red-400 flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                  <div>
                    <p className="font-semibold">Ocurrió un contratiempo con la IA</p>
                    <p className="opacity-90">{errorMsg}</p>
                  </div>
                </div>
                {(errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("prepago") || errorMsg.includes("credits are depleted")) && (
                  <div className="mt-2.5 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-red-200 dark:border-red-950/50 text-xs text-slate-700 dark:text-zinc-300">
                    <p className="font-bold flex items-center gap-1 text-red-700 dark:text-red-400 mb-1">
                      <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                      ¿Cómo solucionarlo?
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Tus créditos de prepago o límites diarios en <strong>Google AI Studio</strong> están agotados.</li>
                      <li>Para volver a procesar PDFs, visita tu consola de <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-emerald-600 dark:text-emerald-400 font-extrabold hover:underline">Google AI Studio</a> y añade saldo dentro de la sección <strong>Billing / Prepay</strong>.</li>
                      <li>También puedes revisar o registrar una clave de API diferente en los ajustes si dispones de otra cuenta con saldo.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Bottom bar of Upload Area */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#f8f9fa] dark:bg-zinc-950/40 rounded-xl border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="text-emerald-600 bg-white dark:bg-zinc-800 p-2 rounded-lg border border-emerald-50 dark:border-zinc-700/50">
                  <span className="material-symbols-outlined block">draft</span>
                </div>
                <div className="text-left">
                  {selectedFile ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[220px]">{selectedFile.name}</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">PDF cargado correctamente</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">Ningún archivo subido</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">Soporta formato PDF (Máx 15MB)</p>
                    </>
                  )}
                </div>
              </div>

              {isProcessing ? (
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-100 text-emerald-800 font-semibold rounded-full text-sm">
                  <span className="animate-spin material-symbols-outlined text-[16px]">sync</span>
                  Procesando...
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!selectedFile}
                  onClick={handleUploadAndProcess}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold tracking-tight transition-all duration-200 ${
                    selectedFile
                      ? "bg-[#0f5238] hover:bg-[#116c4a] text-white cursor-pointer active:scale-95"
                      : "bg-gray-100 dark:bg-[#27272a] text-gray-300 dark:text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                  Procesar con IA
                </button>
              )}
            </div>

            {/* Full screen loading overlay during AI compile process */}
            {isProcessing && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-[9999] animate-fade-in no-print">
                <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center gap-6">
                  <div className="relative">
                    {/* Glowing spinner */}
                    <div className="w-20 h-20 rounded-full border-4 border-emerald-100 dark:border-zinc-850 border-t-emerald-600 dark:border-t-emerald-450 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <span className="material-symbols-outlined text-2xl animate-pulse">auto_awesome</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-[#0f5238] dark:text-emerald-450 mb-2 animate-pulse">Procesando Plan Nutricional</h3>
                    <p className="text-xs text-gray-550 dark:text-zinc-400 leading-relaxed">
                      Nuestra red neuronal está extrayendo y estructurando las comidas, ingredientes y pasos secuenciales del plan.
                    </p>
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {loadingSteps[loadingStep]}
                      </span>
                      <span className="text-gray-400 dark:text-zinc-500">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-600 dark:bg-emerald-450 transition-all duration-300 ease-out rounded-full" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {isDev && (
                    <div className="w-full text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-2.5 flex items-center justify-center gap-1.5 animate-pulse select-none">
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      [Entorno de Desarrollo] Tiempo transcurrido: {elapsedTime.toFixed(1)}s
                    </div>
                  )}

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="mt-2 px-6 py-2.5 bg-red-50 dark:bg-red-950/30 text-red-750 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-red-100 dark:border-red-900/30 font-bold text-xs rounded-xl"
                  >
                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                    Cancelar Proceso
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right column sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6 relative z-10">
            <div className="bg-[#0f5238] dark:bg-[#073322] text-white p-6 rounded-2xl shadow-md h-full flex flex-col justify-between border border-emerald-800 dark:border-emerald-900/40">
              <div>
                <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2 text-white">
                  <span className="material-symbols-outlined text-emerald-300">query_stats</span> Análisis Automático
                </h3>
                <p className="text-sm text-emerald-100 leading-relaxed mb-6 font-medium">
                  Nuestra tecnología de inteligencia artificial estructura los planes más complejos en cuestion de segundos de forma comprensible:
                </p>
                <ul className="space-y-3.5 text-sm">
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-semibold text-white">Extracción de macronutrientes</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-semibold text-white">Pesos e ingredientes precisos</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-semibold text-white">Lista automática de la compra</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-6 border-t border-emerald-800/60 dark:border-emerald-900/50 flex items-center justify-between">
                <span className="text-xs text-emerald-250">Impulsado por Gemini 3.5</span>
                <span className="text-xs font-bold bg-emerald-900/80 dark:bg-emerald-900/60 text-emerald-100 px-2.5 py-1 rounded-md">VITALITY AI</span>
              </div>
            </div>

            {/* Active Plan / Reset widget */}
            {metadata && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800/80 shadow-sm relative flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs tracking-wider text-gray-400 dark:text-zinc-500 font-bold uppercase">
                  <span>Plan de Alimentación Activo</span>
                  <span className="text-[#0f5238] dark:text-emerald-450 flex items-center gap-0.5 font-bold">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> COMPARTIDO
                  </span>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#f8f9fa] dark:bg-zinc-950/40 rounded-xl border border-gray-50 dark:border-zinc-800">
                  <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-3xl font-light">task</span>
                  <div className="text-left select-text">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px]" title={metadata.fileName}>
                      {metadata.fileName}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                      Sincronizado: {new Date(metadata.processedAt).toLocaleDateString("es-ES")} {new Date(metadata.processedAt).toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setActiveTab("calendar")}
                      className="py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/30 text-[#0f5238] dark:text-emerald-450 font-bold text-xs rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">calendar_month</span> Ver Calendario
                    </button>
                    <button 
                      type="button"
                      onClick={onResetPlan}
                      className="py-2.5 px-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-bold text-xs rounded-xl hover:bg-red-100 dark:hover:bg-red-950 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span> Eliminar Plan
                    </button>
                  </div>
                  {metadata.savedFileName && (
                    <button 
                      type="button"
                      onClick={handleReprocess}
                      className="w-full py-2.5 px-4 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-900/50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      Reprocesar Plan
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="w-full py-2.5 px-4 bg-[#f1f5f9] dark:bg-zinc-800 hover:bg-[#e2e8f0] dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-[#e2e8f0] dark:border-zinc-700/60"
                  >
                    <span className="material-symbols-outlined text-[16px]">history</span>
                    Ver Historial de Planes
                  </button>
                </div>
              </div>
            )}

            {/* Inactive Plan / History access widget */}
            {!metadata && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800/80 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs tracking-wider text-gray-400 dark:text-zinc-500 font-bold uppercase">
                  <span>Planes Anteriores</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-[#0f5238] dark:text-emerald-450 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-900/40"
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  Ver Historial de Planes
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Feature informational bento blocks */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-transform duration-200 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">calendar_month</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 font-sans tracking-tight">Calendario Dinámico</h3>
          <p className="text-sm text-[#404943] dark:text-zinc-300 leading-relaxed">
            Tu plan se mapea instantáneamente en una rejilla interactiva de Lunes a Domingo de forma limpia, separando las cuatro raciones diarias. No más desorden.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-transform duration-200 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">shopping_basket</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 font-sans tracking-tight">Comida de la Semana</h3>
          <p className="text-sm text-[#404943] dark:text-zinc-300 leading-relaxed">
            Los ingredientes de tus recetas se agregan y ordenan automáticamente por pasillo (Carnes, Verduras, Especias) para facilitar un supermercado eficiente.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-transform duration-200 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">insights</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 font-sans tracking-tight">Métricas Energéticas</h3>
          <p className="text-sm text-[#404943] dark:text-zinc-300 leading-relaxed">
            Ten constancia de cuántas calorías absorbe cada comida y visualiza un resumen macroscópico rápido para mantener la adherencia dietética ideal.
          </p>
        </div>
      </section>

      {/* History Modal overlay */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg border border-gray-100 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800/85 bg-gray-50/50 dark:bg-zinc-950/20">
              <h3 className="text-lg font-bold text-[#0f5238] dark:text-emerald-450 flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">history</span> Historial de Planes
              </h3>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-650 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-4">
              {loadingHistory ? (
                <div className="py-12 text-center text-sm text-gray-400 dark:text-zinc-500">
                  <span className="animate-spin inline-block material-symbols-outlined text-[20px] mr-2 align-middle font-bold">sync</span>
                  Cargando historial...
                </div>
              ) : history.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400 dark:text-zinc-500 flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-4xl font-light text-gray-300 dark:text-zinc-700">folder_open</span>
                  <p className="font-semibold text-gray-700 dark:text-zinc-300">No hay planes en el historial.</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs leading-relaxed">Sube tu primer plan de alimentación en PDF para comenzar a registrar tu historial.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 pr-1">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3.5 ${
                        item.isActive 
                          ? "bg-emerald-50/45 dark:bg-emerald-950/10 border-emerald-250 dark:border-emerald-900/40" 
                          : "bg-[#f8f9fa] dark:bg-zinc-950/20 border-gray-100 dark:border-zinc-800/60 hover:border-gray-200 dark:hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="text-left min-w-0 flex-1">
                          <p 
                            className={`text-sm font-bold truncate ${
                              item.isActive ? "text-emerald-800 dark:text-emerald-400" : "text-gray-800 dark:text-zinc-200"
                            }`} 
                            title={item.fileName}
                          >
                            {item.fileName}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1 flex items-center gap-1 font-medium">
                            <span className="material-symbols-outlined text-[13px]">calendar_month</span>
                            {new Date(item.createdAt).toLocaleDateString("es-ES")} {new Date(item.createdAt).toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {item.isActive && (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-350 font-bold px-2.5 py-0.5 rounded-full select-none shrink-0 flex items-center gap-1 border border-emerald-250 dark:border-emerald-800">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                          </span>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 border-t border-gray-100/60 dark:border-zinc-850/50 pt-3 mt-0.5">
                        {!item.isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              handleRestoreHistory(item.id);
                              setShowHistoryModal(false);
                            }}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                            title="Restaurar este plan como el plan activo"
                          >
                            <span className="material-symbols-outlined text-[14px]">restore</span> Restaurar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(item.id, item.fileName)}
                          className="py-1.5 px-3 bg-red-50 dark:bg-red-950/30 text-red-750 dark:text-red-400 font-bold text-xs rounded-xl hover:bg-red-100 dark:hover:bg-red-950 transition-colors cursor-pointer flex items-center gap-1"
                          title="Eliminar del historial"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span> Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800/80 flex justify-end bg-gray-50/20 dark:bg-zinc-950/10">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-750 text-gray-700 dark:text-zinc-350 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
