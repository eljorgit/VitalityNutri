import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { setStoredLang, type SupportedLang } from "../i18n/config";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Sliders,
  Trash2,
  Check,
  Scale,
  Sparkles
} from "lucide-react";
import { SpainFlag, UKFlag } from "./Flags";

export type ThemeMode = "light" | "dark" | "system";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
}: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<"language" | "defaults" | "appearance">("language");

  // Advanced settings state
  const [defaultServings, setDefaultServings] = useState<number>(() => {
    const saved = localStorage.getItem("vitalitynutri_default_servings");
    return saved ? parseInt(saved, 10) : 1;
  });
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">(() => {
    return (localStorage.getItem("vitalitynutri_unit_system") as "metric" | "imperial") || "metric";
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

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

  const handleLanguageChange = (lang: SupportedLang) => {
    i18n.changeLanguage(lang);
    setStoredLang(lang);
    showToast(t("settings.saved_toast", "Settings updated"));
  };

  const handleThemeSelect = (theme: ThemeMode) => {
    onThemeChange(theme);
    showToast(t("settings.saved_toast", "Settings updated"));
  };

  const handleServingsChange = (servings: number) => {
    const clamped = Math.max(1, Math.min(8, servings));
    setDefaultServings(clamped);
    localStorage.setItem("vitalitynutri_default_servings", clamped.toString());
    showToast(t("settings.saved_toast", "Settings updated"));
  };

  const handleUnitSystemChange = (unit: "metric" | "imperial") => {
    setUnitSystem(unit);
    localStorage.setItem("vitalitynutri_unit_system", unit);
    showToast(t("settings.saved_toast", "Settings updated"));
  };

  const handleClearCache = () => {
    if (window.confirm(t("settings.clear_cache_confirm", "Are you sure you want to clear local settings and cached data?"))) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const currentFlag = i18n.language.startsWith("es") ? "🇪🇸" : "🇬🇧";

  return (
    <>
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 bg-slate-900/90 dark:bg-zinc-100/90 backdrop-blur-md text-white dark:text-zinc-900 rounded-full shadow-2xl border border-white/10 dark:border-zinc-800/10 flex items-center gap-2 text-xs font-bold animate-bounce-short pointer-events-none select-none">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 -z-10" onClick={onClose} />

        {/* Modal Container */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden transition-all duration-300">
          
          {/* Modal Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-zinc-850/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h2 id="settings-modal-title" className="text-base font-extrabold text-slate-800 dark:text-zinc-100">
                  {t("settings.title", "Preferences & Configuration")}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {t("settings.subtitle", "Customize language, servings, and appearance")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label={t("general.close", "Close")}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* 3-Tab Navigation with Flag on Language Tab */}
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 select-none overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("language")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "language"
                  ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              {i18n.language.startsWith("es") ? (
                <SpainFlag className="w-5 h-3.5 shadow-xs" />
              ) : (
                <UKFlag className="w-5 h-3.5 shadow-xs" />
              )}
              {t("settings.tabs.language", "Language")}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("defaults")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "defaults"
                  ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              <Sliders className="w-4 h-4" />
              {t("settings.tabs.defaults", "Servings & Units")}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "appearance"
                  ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              }`}
            >
              <Sun className="w-4 h-4" />
              {t("settings.tabs.appearance", "Appearance")}
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">

            {/* TAB 1: LANGUAGE */}
            {activeTab === "language" && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {i18n.language.startsWith("es") ? (
                      <SpainFlag className="w-4.5 h-3 shadow-xs" />
                    ) : (
                      <UKFlag className="w-4.5 h-3 shadow-xs" />
                    )}
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      {t("settings.language_label", "Application Language")}
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleLanguageChange("es")}
                      className={`p-4 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer group ${
                        i18n.language.startsWith("es")
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                          : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <SpainFlag className="w-9 h-6 shadow-sm rounded-sm" />
                        <div>
                          <div className="text-sm font-black">Español</div>
                          <div className="text-[11px] opacity-70">Spanish</div>
                        </div>
                      </div>
                      {i18n.language.startsWith("es") && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLanguageChange("en")}
                      className={`p-4 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer group ${
                        i18n.language.startsWith("en")
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                          : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <UKFlag className="w-9 h-6 shadow-sm rounded-sm" />
                        <div>
                          <div className="text-sm font-black">English</div>
                          <div className="text-[11px] opacity-70">Inglés</div>
                        </div>
                      </div>
                      {i18n.language.startsWith("en") && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DEFAULTS & MEASUREMENTS */}
            {activeTab === "defaults" && (
              <div className="space-y-6">
                {/* Servings Multiplier Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      {t("settings.default_servings_label", "Default Servings Multiplier")}
                    </label>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                      {defaultServings}x {defaultServings === 1 ? t("settings.serving_single", "Serving") : t("settings.serving_plural", "Servings")}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-850/60 border border-slate-200/80 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">1x</span>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        value={defaultServings}
                        onChange={e => handleServingsChange(parseInt(e.target.value, 10))}
                        className="flex-1 h-2 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">8x</span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-2">
                        {[1, 2, 4, 6].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleServingsChange(num)}
                            className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              defaultServings === num
                                ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                                : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-600"
                            }`}
                          >
                            {num}x
                          </button>
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {defaultServings === 1 ? t("settings.serving_single", "Serving") : t("settings.serving_plural", "Servings")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Measurement Units */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                    {t("settings.unit_system_label", "Measurement Units")}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleUnitSystemChange("metric")}
                      className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        unitSystem === "metric"
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30 font-bold"
                          : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-xs font-black">{t("settings.units_metric", "Metric System")}</div>
                          <div className="text-[11px] opacity-70">{t("settings.units_metric_desc")}</div>
                        </div>
                      </div>
                      {unitSystem === "metric" && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUnitSystemChange("imperial")}
                      className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        unitSystem === "imperial"
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30 font-bold"
                          : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-xs font-black">{t("settings.units_imperial", "Imperial System")}</div>
                          <div className="text-[11px] opacity-70">{t("settings.units_imperial_desc")}</div>
                        </div>
                      </div>
                      {unitSystem === "imperial" && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: APPEARANCE */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                
                {/* Theme Mode Selection */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
                    {t("settings.theme_mode_label", "Color Theme")}
                  </label>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => handleThemeSelect("light")}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all cursor-pointer ${
                        currentTheme === "light"
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                          : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                      }`}
                    >
                      <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black">{t("settings.theme_light", "Light")}</div>
                        <div className="text-[10px] opacity-70">{t("settings.theme_light_desc", "Clean")}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeSelect("dark")}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all cursor-pointer ${
                        currentTheme === "dark"
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                          : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                      }`}
                    >
                      <div className="p-3 rounded-full bg-zinc-800 text-zinc-100">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black">{t("settings.theme_dark", "Dark")}</div>
                        <div className="text-[10px] opacity-70">{t("settings.theme_dark_desc", "Contrast")}</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeSelect("system")}
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all cursor-pointer ${
                        currentTheme === "system"
                          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                          : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                      }`}
                    >
                      <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black">{t("settings.theme_system", "System")}</div>
                        <div className="text-[10px] opacity-70">{t("settings.theme_system_desc", "Auto OS")}</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Clear Cache */}
                <div>
                  <button
                    type="button"
                    onClick={handleClearCache}
                    className="w-full p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("settings.clear_cache_button", "Reset Local Storage & Settings")}
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end shrink-0 bg-slate-50/60 dark:bg-zinc-850/50">
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
    </>
  );
}
