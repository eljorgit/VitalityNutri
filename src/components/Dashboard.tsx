import React, { useState, useRef } from "react";
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

  // Reassuring messages during compilation/analysis by Gemini
  const loadingSteps = [
    "Leyendo archivo PDF...",
    "Conectando de forma segura con la IA de Gemini 3.5...",
    "Analizando estructura de días, raciones y comidas...",
    "Calculando macros e ingredientes para cada receta...",
    "Sincronizando el plan globalmente...",
    "¡Todo listo! Recetas optimizadas generadas con éxito."
  ];

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
    setLoadingStep(0);
    setErrorMsg(null);

    // Rotate loading text every 2.5 seconds
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 2800);

    try {
      const reader = new FileReader();
      
      // Promisify file read
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 part
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
        })
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

      clearInterval(interval);
      onPlanProcessed(data.plan, data.metadata);
      setActiveTab("calendar");
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setErrorMsg(err.message || "No se pudo conectar con el servidor o procesar el archivo.");
    } finally {
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
        {/* Decorative Absolutes */}
        <div className="absolute top-0 right-0 w-1/4 h-full opacity-10 pointer-events-none hidden md:block">
          <span className="material-symbols-outlined text-[160px] text-emerald-800 dark:text-emerald-500" style={{ fontVariationSettings: "'FILL' 0" }}>
            nutrition
          </span>
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
              <div className="bg-emerald-100 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 p-2.5 rounded-xl">
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
              className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group ${
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

            {/* Modal loading overlay during AI compile process */}
            {isProcessing && (
              <div className="absolute inset-0 bg-white/95 dark:bg-zinc-900/95 rounded-2xl flex flex-col items-center justify-center p-6 text-center z-20">
                <div className="relative mb-6">
                  {/* Glowing spinner */}
                  <div className="w-16 h-16 rounded-full border-4 border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <span className="material-symbols-outlined animate-pulse">auto_awesome</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[#0f5238] dark:text-emerald-400 mb-2 animate-pulse">Analizando tu Plan Nutricional</h3>
                <p className="text-sm text-[#404943] dark:text-zinc-300 max-w-sm mb-4">
                  Nuestra red neuronal de Gemini 3.5 Flash está procesando el PDF para extraer macronutrientes, crear el calendario de comidas y calcular la lista de ingredientes...
                </p>
                <div className="bg-emerald-50 dark:bg-zinc-800 px-4 py-2.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-ping"></span>
                  {loadingSteps[loadingStep]}
                </div>
              </div>
            )}
          </div>

          {/* Right column sidebar */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-[#0f5238] text-white p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-300">query_stats</span> Análisis Automático
                </h3>
                <p className="text-sm text-emerald-100/90 leading-relaxed mb-6">
                  Nuestra tecnología de inteligencia artificial estructura los planes más complejos en cuestion de segundos de forma comprensible:
                </p>
                <ul className="space-y-3.5 text-sm">
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-medium">Extracción de macronutrientes</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-medium">Pesos e ingredientes precisos</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-medium">Lista automática de la compra</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-6 border-t border-emerald-700/50 flex items-center justify-between">
                <span className="text-xs text-emerald-200">Impulsado por Gemini 3.5</span>
                <span className="text-xs font-bold bg-emerald-800 text-emerald-100 px-2.5 py-1 rounded-md">VITALITY AI</span>
              </div>
            </div>

            {/* Active Plan / Reset widget */}
            {metadata && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-150 dark:border-zinc-800/80 shadow-sm relative">
                <div className="flex items-center justify-between mb-3 text-xs tracking-wider text-gray-400 dark:text-zinc-500 font-bold uppercase">
                  <span>Plan de Alimentación Activo</span>
                  <span className="text-[#0f5238] dark:text-emerald-400 flex items-center gap-0.5 font-bold">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> COMPARTIDO
                  </span>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#f8f9fa] dark:bg-zinc-950/40 rounded-xl border border-gray-50 dark:border-zinc-800 mb-4">
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
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setActiveTab("calendar")}
                    className="py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/30 text-[#0f5238] dark:text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                  >
                    Ver Calendario
                  </button>
                  <button 
                    type="button"
                    onClick={onResetPlan}
                    className="py-2.5 px-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-bold text-xs rounded-xl hover:bg-red-100 dark:hover:bg-red-950 transition-colors cursor-pointer"
                  >
                    Eliminar Plan
                  </button>
                </div>
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
    </div>
  );
}
