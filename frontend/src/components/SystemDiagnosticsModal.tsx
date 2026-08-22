import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../utils/api";
import { version } from "@/package.json";
import {
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Cpu,
  Monitor,
  RefreshCw,
  X
} from "lucide-react";

interface SystemDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SystemDiagnosticsModal({
  isOpen,
  onClose,
}: SystemDiagnosticsModalProps) {
  const { t, i18n } = useTranslation();
  const [healthStatus, setHealthStatus] = useState<"checking" | "healthy" | "unhealthy">("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    setHealthStatus("checking");
    const start = performance.now();
    try {
      const res = await apiFetch("/health");
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      if (res.ok) {
        const data = await res.json().catch(() => ({ status: "Healthy" }));
        setHealthStatus("healthy");
        setHealthData(data);
      } else {
        setHealthStatus("unhealthy");
        setHealthData({ status: "Error", httpCode: res.status });
      }
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setHealthStatus("unhealthy");
      setHealthData({ error: err.message || "Failed to reach backend" });
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkHealth();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Modal Container */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transition-all duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/60 dark:bg-zinc-850/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 id="diagnostics-modal-title" className="text-base font-extrabold text-slate-800 dark:text-zinc-100">
                {t("diagnostics.title", "System Diagnostics")}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {t("diagnostics.subtitle", "Operational status & system telemetry")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={checkHealth}
              disabled={healthStatus === "checking"}
              className="p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={t("general.refresh", "Refresh")}
            >
              <RefreshCw className={`w-4 h-4 ${healthStatus === "checking" ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label={t("general.close", "Close")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-left">
          
          {/* Main Health Status Card */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            healthStatus === "healthy"
              ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
              : healthStatus === "unhealthy"
                ? "bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                : "bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"
          }`}>
            <div className="flex items-center gap-3">
              {healthStatus === "healthy" ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : healthStatus === "unhealthy" ? (
                <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
              ) : (
                <RefreshCw className="w-6 h-6 text-amber-500 animate-spin shrink-0" />
              )}
              <div>
                <div className="text-sm font-black text-slate-800 dark:text-zinc-100">
                  {healthStatus === "healthy" ? t("diagnostics.status_healthy", "Backend Service Operational") :
                   healthStatus === "unhealthy" ? t("diagnostics.status_unhealthy", "Connection Failed") :
                   t("diagnostics.status_checking", "Checking connectivity...")}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">
                  {lastChecked ? `${t("diagnostics.last_checked", "Checked at")} ${lastChecked.toLocaleTimeString()}` : ""}
                </div>
              </div>
            </div>

            {latencyMs !== null && (
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white/80 dark:bg-zinc-800 border border-slate-200/60 dark:border-zinc-700 text-slate-700 dark:text-zinc-300">
                {latencyMs} ms
              </span>
            )}
          </div>

          {/* Diagnostics Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-850/60 border border-slate-200/70 dark:border-zinc-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Server className="w-3.5 h-3.5" />
                {t("diagnostics.app_version", "App Version")}
              </div>
              <div className="font-mono font-black text-slate-800 dark:text-zinc-200">
                v{version}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-850/60 border border-slate-200/70 dark:border-zinc-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider">
                <Monitor className="w-3.5 h-3.5" />
                {t("diagnostics.active_locale", "Locale & Language")}
              </div>
              <div className="font-mono font-black text-slate-800 dark:text-zinc-200">
                {i18n.language.toUpperCase() === "ES" ? "Español (ES)" : "English (EN)"}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end bg-slate-50/60 dark:bg-zinc-850/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {t("general.close", "Close")}
          </button>
        </div>

      </div>
    </div>
  );
}
