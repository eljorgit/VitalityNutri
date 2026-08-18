import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PlanMetadata, MealPlan } from "@src/types";
import ConfirmationModal from "./ConfirmationModal";
import DuplicatePlanModal from "./DuplicatePlanModal";
import { logger } from "@utils/logger";

interface DashboardProps {
  metadata: PlanMetadata | null;
  onPlanProcessed: (newPlan: MealPlan, newMetadata: PlanMetadata) => void;
  setActiveTab: (tab: string) => void;
  onResetPlan: (options?: { skipConfirmation?: boolean }) => void;
}

export default function Dashboard({ 
  metadata, 
  onPlanProcessed, 
  setActiveTab,
  onResetPlan 
}: DashboardProps) {
  const { t, i18n } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDev = (import.meta as any).env?.DEV || (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"));

  const loadingSteps = [
    t("dashboard.loading_step_1"),
    t("dashboard.loading_step_2"),
    t("dashboard.loading_step_3"),
    t("dashboard.loading_step_4"),
    t("dashboard.loading_step_5"),
    t("dashboard.loading_step_6"),
    t("dashboard.loading_step_7"),
  ];

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    icon: string;
    variant: "danger" | "warning" | "success" | "info";
    showCancel?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [duplicatePlan, setDuplicatePlan] = useState<{ id: number; fileName: string; isActive: boolean } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
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

  useEffect(() => {
    if (showHistoryModal || isProcessing) {
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
  }, [showHistoryModal, isProcessing]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProgress(0);
  };

  const requestReprocessConfirmation = () => {
    if (!metadata || !metadata.savedFileName) return;
    setConfirmation({
      title: t("dashboard.reprocess_title"),
      description: t("dashboard.reprocess_desc"),
      confirmLabel: t("dashboard.reprocess_btn"),
      icon: "refresh",
      variant: "warning",
      onConfirm: handleReprocess
    });
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
        headers: { "Content-Type": "application/json" },
        signal: controller.signal
      });
      if (!response.ok) {
        let errMsg = t("dashboard.reprocess_error");
        try {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } catch {
          // response body may be empty
        }
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
        logger.info("Reprocesamiento cancelado por el usuario.");
        return;
      }
      console.error(err);
      setErrorMsg(err.message || t("dashboard.connection_error"));
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
        throw new Error(t("dashboard.restore_error"));
      }
      const data = await response.json();
      onPlanProcessed(data.plan, data.metadata);
      fetchHistory();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || t("dashboard.network_restore_error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const response = await fetch("/api/backup/export");
      if (!response.ok) throw new Error(t("dashboard.export_error"));
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", url);
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute("download", `vitalitynutri_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || t("dashboard.export_error"));
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.plans)) {
          throw new Error(t("dashboard.import_invalid_format"));
        }
        setConfirmation({
          title: t("dashboard.import_confirm_title"),
          description: t("dashboard.import_confirm_desc"),
          confirmLabel: t("dashboard.import_confirm_btn"),
          icon: "cloud_upload",
          variant: "warning",
          onConfirm: async () => {
            setIsProcessing(true);
            setProgress(50);
            setLoadingStep(5);
            setErrorMsg(null);
            try {
              const response = await fetch("/api/backup/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed)
              });
              if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || t("dashboard.import_error"));
              }
              setProgress(100);
              setConfirmation({
                title: t("dashboard.import_success_title"),
                description: t("dashboard.import_success_desc"),
                confirmLabel: t("dashboard.import_success_btn"),
                icon: "check_circle",
                variant: "success",
                showCancel: false,
                onConfirm: () => {
                  window.location.reload();
                }
              });
            } catch (err: any) {
              console.error(err);
              setErrorMsg(err.message || t("dashboard.import_error"));
            } finally {
              setIsProcessing(false);
            }
          }
        });
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || t("dashboard.import_parse_error"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error(t("dashboard.history_delete_error"));
      }
      if (metadata && metadata.id === id) {
        onResetPlan({ skipConfirmation: true });
      } else {
        fetchHistory();
      }
    } catch (err: any) {
      console.error(err);
      setConfirmation({
        title: t("dashboard.history_delete_error_title"),
        description: err.message || t("dashboard.history_delete_error"),
        confirmLabel: t("dashboard.history_confirm_understood"),
        icon: "error",
        variant: "danger",
        showCancel: false,
        onConfirm: () => undefined
      });
    }
  };

  const requestDeleteHistoryConfirmation = (id: number, name: string) => {
    setConfirmation({
      title: t("dashboard.history_delete_confirm_title"),
      description: t("dashboard.history_delete_confirm_desc", { name }),
      confirmLabel: t("dashboard.history_delete_confirm_btn"),
      icon: "delete",
      variant: "danger",
      onConfirm: () => handleDeleteHistory(id)
    });
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

  const maxUploadSizeMb = (typeof window !== "undefined" && window.__VITALITYNUTRI_CONFIG__?.maxUploadSizeMb) || 15;
  const maxFileSizeBytes = maxUploadSizeMb * 1024 * 1024;

  const processFile = (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg(t("dashboard.pdf_format_error"));
      return;
    }
    if (file.size > maxFileSizeBytes) {
      setErrorMsg(t("dashboard.file_size_error", { maxMb: maxUploadSizeMb }));
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

  const handleUploadAndProcess = async (forceParam: any = false) => {
    if (!selectedFile) return;
    const force = forceParam === true;
    setIsProcessing(true);
    setProgress(0);
    setLoadingStep(0);
    setErrorMsg(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileData: fileData,
          force: force
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        let errMsg = t("dashboard.upload_error");
        try {
          const errorData = await response.json();
          errMsg = errorData.error || errMsg;
        } catch (e) {
          try {
            const textText = await response.text();
            if (textText) {
              errMsg = `${t("dashboard.server_network_error")}: ${textText.substring(0, 160)}`;
            }
          } catch {
            // response body may be empty
          }
        }
        throw new Error(errMsg);
      }
      const data = await response.json();
      if (data.duplicateDetected) {
        clearInterval(progressInterval);
        setIsProcessing(false);
        setDuplicatePlan(data.existingPlan);
        setShowDuplicateModal(true);
        return;
      }
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
        logger.info("Upload canceled by user.");
        return;
      }
      console.error(err);
      setErrorMsg(err.message || t("dashboard.connection_error"));
    } finally {
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Header Card */}
      <section className="relative overflow-hidden rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-8 md:p-12 shadow-sm animate-fade-in">
        <div className="absolute inset-0 z-0 pointer-events-none select-none">
          <img 
            src="/hero_background.png" 
            alt={t("dashboard.hero_title")}
            className="w-full h-full object-cover object-right opacity-30 dark:opacity-20 transition-all duration-300" 
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/90 via-emerald-50/40 to-transparent dark:from-emerald-950/90 dark:via-emerald-950/40 dark:to-transparent" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 mb-4">
            <span className="material-symbols-outlined text-[14px]">explore</span> {t("dashboard.badge_conscious")}
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0f5238] dark:text-emerald-400 tracking-tight leading-tight mb-4">
            {t("dashboard.hero_greeting")}
          </h1>
          <p className="text-base md:text-lg text-[#404943] dark:text-zinc-300 leading-relaxed max-w-2xl">
            {t("dashboard.hero_description")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10">
          <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl p-6 md:p-8 border border-[#bfc9c1]/40 dark:border-zinc-800 shadow-sm relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-emerald-100 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 p-2.5 rounded-xl">
                <span className="material-symbols-outlined block">description</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{t("dashboard.upload_card_title")}</h2>
                <p className="text-xs text-gray-400 dark:text-zinc-500">{t("dashboard.upload_card_desc")}</p>
              </div>
            </div>

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
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mt-1">{t("dashboard.file_ready")}</p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t("dashboard.drag_drop_text")}</p>
                  <p className="text-sm text-gray-400 dark:text-zinc-500 font-medium">{t("dashboard.click_to_browse")}</p>
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
                {t("dashboard.select_file_btn")}
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 rounded-xl text-sm text-red-700 dark:text-red-400 flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                  <div>
                    <p className="font-semibold">{t("dashboard.error_title")}</p>
                    <p className="opacity-90">{errorMsg}</p>
                  </div>
                </div>
                {(errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("prepago") || errorMsg.includes("credits are depleted")) && (
                  <div className="mt-2.5 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-red-200 dark:border-red-950/50 text-xs text-slate-700 dark:text-zinc-300">
                    <p className="font-bold flex items-center gap-1 text-red-700 dark:text-red-400 mb-1">
                      <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                      {t("dashboard.error_solution_title")}
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li dangerouslySetInnerHTML={{ __html: t("dashboard.error_solution_1") }} />
                      <li dangerouslySetInnerHTML={{ __html: t("dashboard.error_solution_2") }} />
                      <li>{t("dashboard.error_solution_3")}</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#f8f9fa] dark:bg-zinc-950/40 rounded-xl border border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="text-emerald-600 bg-white dark:bg-zinc-800 p-2 rounded-lg border border-emerald-50 dark:border-zinc-700/50">
                  <span className="material-symbols-outlined block">draft</span>
                </div>
                <div className="text-left">
                  {selectedFile ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[220px]">{selectedFile.name}</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">{t("dashboard.file_loaded")}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">{t("dashboard.no_file")}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">{t("dashboard.supported_formats", { maxMb: maxUploadSizeMb })}</p>
                    </>
                  )}
                </div>
              </div>

              {isProcessing ? (
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-100 text-emerald-800 font-semibold rounded-full text-sm">
                  <span className="animate-spin material-symbols-outlined text-[16px]">sync</span>
                  {t("dashboard.processing_btn")}
                </div>
              ) : selectedFile ? (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold tracking-tight border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all duration-200 cursor-pointer active:scale-95 dark:border-red-950/40 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    {t("dashboard.remove_btn")}
                  </button>
                  <button
                    type="button"
                    onClick={handleUploadAndProcess}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#0f5238] hover:bg-[#116c4a] text-white font-semibold rounded-full text-sm tracking-tight transition-all duration-200 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    {t("dashboard.process_btn")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold tracking-tight transition-all duration-200 bg-gray-100 dark:bg-[#27272a] text-gray-300 dark:text-zinc-600 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  {t("dashboard.process_btn")}
                </button>
              )}
            </div>

            {isProcessing && (
              <div 
                className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-[9999] animate-fade-in no-print !mt-0"
                style={{ marginTop: 0 }}
              >
                <div 
                  className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center gap-6"
                  style={{ marginTop: 0 }}
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-emerald-100 dark:border-zinc-800 border-t-emerald-600 dark:border-t-emerald-400 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <span className="material-symbols-outlined text-2xl animate-pulse">auto_awesome</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-[#0f5238] dark:text-emerald-400 mb-2 animate-pulse">{t("dashboard.processing_title")}</h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                      {t("dashboard.processing_desc")}
                    </p>
                  </div>

                  <div className="w-full flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-emerald-700 dark:text-emerald-400">
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

                  {isDev && (
                    <div className="w-full text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-2.5 flex items-center justify-center gap-1.5 animate-pulse select-none">
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      {t("dashboard.dev_timer", { time: elapsedTime.toFixed(1) })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCancel}
                    className="mt-2 px-6 py-2.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-red-100 dark:border-red-900/30 font-bold text-xs rounded-xl"
                  >
                    <span className="material-symbols-outlined text-[15px]">cancel</span>
                    {t("dashboard.cancel_process_btn")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6 relative z-10">
            <div className="bg-[#0f5238] dark:bg-[#073322] text-white p-6 rounded-2xl shadow-md h-full flex flex-col justify-between border border-emerald-800 dark:border-emerald-900/40">
              <div>
                <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2 text-white">
                  <span className="material-symbols-outlined text-emerald-300">query_stats</span> {t("dashboard.sidebar_analysis_title")}
                </h3>
                <p className="text-sm text-emerald-100 leading-relaxed mb-6 font-medium">
                  {t("dashboard.sidebar_analysis_desc")}
                </p>
                <ul className="space-y-3.5 text-sm">
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="font-semibold text-white">{t("dashboard.sidebar_feature_1")}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="font-semibold text-white">{t("dashboard.sidebar_feature_2")}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-emerald-300 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="font-semibold text-white">{t("dashboard.sidebar_feature_3")}</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-6 border-t border-emerald-800/60 dark:border-emerald-900/50 flex items-center justify-between">
                <span className="text-xs text-emerald-200">{t("dashboard.sidebar_ai_label")}</span>
                <span className="text-xs font-bold bg-emerald-900/80 dark:bg-emerald-900/60 text-emerald-100 px-2.5 py-1 rounded-md">{t("dashboard.sidebar_badge")}</span>
              </div>
            </div>

            {metadata && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800/80 shadow-sm relative flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs tracking-wider text-gray-400 dark:text-zinc-500 font-bold uppercase">
                  <span>{t("dashboard.active_plan_label")}</span>
                  <span className="text-[#0f5238] dark:text-emerald-400 flex items-center gap-0.5 font-bold">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> {t("dashboard.active_plan_status")}
                  </span>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#f8f9fa] dark:bg-zinc-950/40 rounded-xl border border-gray-50 dark:border-zinc-800">
                  <span className="material-symbols-outlined text-emerald-700 dark:text-emerald-400 text-3xl font-light">task</span>
                  <div className="text-left select-text">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px]" title={metadata.fileName}>
                      {metadata.fileName}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                      {t("dashboard.active_plan_sync", {
                        date: new Date(metadata.processedAt).toLocaleDateString(i18n.language),
                        time: new Date(metadata.processedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      type="button"
                      onClick={() => setActiveTab("calendar")}
                      className="py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/30 text-[#0f5238] dark:text-emerald-400 font-bold text-xs rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">calendar_month</span> {t("dashboard.view_calendar_btn")}
                    </button>
                    <button 
                      type="button"
                      onClick={onResetPlan}
                      className="py-2.5 px-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-bold text-xs rounded-xl hover:bg-red-100 dark:hover:bg-red-950 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span> {t("dashboard.delete_plan_title")}
                    </button>
                  </div>
                  {metadata.savedFileName && (
                    <button 
                      type="button"
                      onClick={requestReprocessConfirmation}
                      className="w-full py-2.5 px-4 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-200 dark:border-amber-900/50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      {t("dashboard.reprocess_btn")}
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="w-full py-2.5 px-4 bg-[#f1f5f9] dark:bg-zinc-800 hover:bg-[#e2e8f0] dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-[#e2e8f0] dark:border-zinc-700/60"
                  >
                    <span className="material-symbols-outlined text-[16px]">history</span>
                    {t("dashboard.history_title_btn")}
                  </button>
                </div>
              </div>
            )}

            {!metadata && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800/80 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs tracking-wider text-gray-400 dark:text-zinc-500 font-bold uppercase">
                  <span>{t("dashboard.previous_plans_title")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-[#0f5238] dark:text-emerald-400 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-900/40"
                >
                  <span className="material-symbols-outlined text-[16px]">history</span>
                  {t("dashboard.history_title_btn")}
                </button>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800/80 shadow-sm flex flex-col gap-3">
              <div className="text-xs tracking-wider text-gray-400 dark:text-zinc-500 font-bold uppercase flex items-center justify-between">
                <span>{t("dashboard.backup_section_title")}</span>
                <span className="material-symbols-outlined text-[16px] text-gray-400 dark:text-zinc-500">settings_backup_restore</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                {t("dashboard.backup_section_desc")}
              </p>
              <div className="flex flex-col gap-2">
                {history.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="w-full py-2.5 px-4 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-[#0f5238] dark:text-emerald-400 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-100 dark:border-emerald-900/40"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    {t("dashboard.export_btn")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-4 bg-gray-50 dark:bg-zinc-800/20 text-gray-400 dark:text-zinc-500 font-bold text-xs rounded-xl border border-gray-200 dark:border-zinc-800/50 flex items-center justify-center gap-1.5 cursor-not-allowed select-none"
                    title={t("dashboard.export_disabled_tooltip")}
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    {t("dashboard.export_disabled")}
                  </button>
                )}
                <label className="w-full py-2.5 px-4 bg-[#f1f5f9] dark:bg-zinc-800 hover:bg-[#e2e8f0] dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-[#e2e8f0] dark:border-zinc-700/60 text-center">
                  <span className="material-symbols-outlined text-[16px]">upload</span>
                  {t("dashboard.import_btn")}
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportBackup}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-transform duration-200 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">calendar_month</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 font-sans tracking-tight">{t("dashboard.feature_dynamic_calendar")}</h3>
          <p className="text-sm text-[#404943] dark:text-zinc-300 leading-relaxed">
            {t("dashboard.feature_dynamic_calendar_desc")}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-transform duration-200 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">shopping_basket</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 font-sans tracking-tight">{t("dashboard.feature_weekly_food")}</h3>
          <p className="text-sm text-[#404943] dark:text-zinc-300 leading-relaxed">
            {t("dashboard.feature_weekly_food_desc")}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-transform duration-200 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-zinc-800 text-[#0f5238] dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-2xl">insights</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 font-sans tracking-tight">{t("dashboard.feature_metrics")}</h3>
          <p className="text-sm text-[#404943] dark:text-zinc-300 leading-relaxed">
            {t("dashboard.feature_metrics_desc")}
          </p>
        </div>
      </section>

      {showHistoryModal && (
        <div 
          className="modal-overlay fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in no-print !mt-0"
          style={{ marginTop: 0 }}
        >
          <div 
            className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg border border-gray-100 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden relative z-10 select-none !mt-0"
            style={{ marginTop: 0 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800/85 bg-gray-50/50 dark:bg-zinc-950/20">
              <h3 className="text-lg font-bold text-[#0f5238] dark:text-emerald-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">history</span> {t("dashboard.history_modal_title")}
              </h3>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-650 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow flex flex-col gap-4">
              {loadingHistory ? (
                <div className="py-12 text-center text-sm text-gray-400 dark:text-zinc-500">
                  <span className="animate-spin inline-block material-symbols-outlined text-[20px] mr-2 align-middle font-bold">sync</span>
                  {t("dashboard.history_loading")}
                </div>
              ) : history.length === 0 ? (
                <div className="py-16 text-center text-sm text-gray-400 dark:text-zinc-500 flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-4xl font-light text-gray-300 dark:text-zinc-700">folder_open</span>
                  <p className="font-semibold text-gray-700 dark:text-zinc-300">{t("dashboard.history_modal_empty")}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs leading-relaxed">{t("dashboard.history_modal_empty_hint")}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 pr-1">
                  {history.map((item: any) => (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3.5 ${
                        item.isActive 
                          ? "bg-emerald-50/45 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40" 
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
                            {t("dashboard.history_modal_date", {
                              date: new Date(item.createdAt).toLocaleDateString(i18n.language),
                              time: new Date(item.createdAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
                            })}
                          </p>
                        </div>
                        {item.isActive && (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full select-none shrink-0 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {t("dashboard.history_modal_active")}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 border-t border-gray-100/60 dark:border-zinc-800/50 pt-3 mt-0.5">
                        {!item.isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              handleRestoreHistory(item.id);
                              setShowHistoryModal(false);
                            }}
                            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                            title={t("dashboard.history_modal_restore_tooltip")}
                          >
                            <span className="material-symbols-outlined text-[14px]">restore</span> {t("dashboard.history_modal_restore")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => requestDeleteHistoryConfirmation(item.id, item.fileName)}
                          className="py-1.5 px-3 bg-red-50 dark:bg-red-950/30 text-red-750 dark:text-red-400 font-bold text-xs rounded-xl hover:bg-red-100 dark:hover:bg-red-950 transition-colors cursor-pointer flex items-center gap-1"
                          title={t("dashboard.history_modal_delete_tooltip")}
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span> {t("dashboard.history_modal_delete")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800/80 flex justify-end bg-gray-50/20 dark:bg-zinc-950/10">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-350 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {t("dashboard.history_modal_close")}
              </button>
            </div>
          </div>
        </div>
      )}

      <DuplicatePlanModal
        isOpen={showDuplicateModal}
        fileName={duplicatePlan?.fileName || ""}
        isActive={!!duplicatePlan?.isActive}
        onUseExisting={() => {
          if (duplicatePlan) {
            handleRestoreHistory(duplicatePlan.id);
            setShowDuplicateModal(false);
            setDuplicatePlan(null);
          }
        }}
        onReprocess={() => {
          setShowDuplicateModal(false);
          handleUploadAndProcess(true);
        }}
        onCancel={() => {
          setShowDuplicateModal(false);
          setDuplicatePlan(null);
        }}
      />

      <ConfirmationModal
        isOpen={!!confirmation}
        title={confirmation?.title || ""}
        description={confirmation?.description || ""}
        confirmLabel={confirmation?.confirmLabel || t("general.confirm")}
        icon={confirmation?.icon}
        variant={confirmation?.variant}
        showCancel={confirmation?.showCancel}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          const action = confirmation?.onConfirm;
          setConfirmation(null);
          action?.();
        }}
      />
    </div>
  );
}
