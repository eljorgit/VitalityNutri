import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Cloud,
  Info,
  KeyRound,
  KeySquare,
  Mail,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Scale,
  Sliders,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { setStoredLang, type SupportedLang } from "../../i18n/config";
import { SpainFlag, UKFlag } from "../Flags";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../utils/api";

export type ThemeMode = "light" | "dark" | "system";

type ProfileTab = "profile" | "email" | "password";

interface ProviderKeyDto {
  id: number;
  providerType: string;
  alias: string;
  maskedKey: string;
  baseUrl: string | null;
  isValidated: boolean;
}

interface AiSettingsDto {
  mode: "Platform" | "Byok";
  providerKeys: ProviderKeyDto[];
  chainOverrides: { chainName: string; tokens: string[] }[];
  availableChains: string[];
  weeklyPlatformLimit: number;
  creditsUsedThisWeek: number;
  usageMetrics?: {
    key: string;
    description: string;
    minCredits: number;
    maxCredits: number;
  }[];
  usageInteractions?: {
    timestampUtc: string;
    operation: string;
    creditsUsed: number;
    model?: string | null;
    status?: string | null;
  }[];
}

interface SessionDto {
  id: number;
  userAgent: string | null;
  ipAddress: string | null;
  lastUsedAtUtc: string;
  isCurrent: boolean;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || data.title || data.message || fallback;
  } catch {
    return fallback;
  }
}

export function GeneralSettingsSection({
  currentTheme,
  onThemeChange,
}: {
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  const { t, i18n } = useTranslation();
  const { isDemo } = useAuth();
  const [activeTab, setActiveTab] = useState<"language" | "defaults" | "appearance">("language");
  const [defaultServings, setDefaultServings] = useState<number>(() => {
    const saved = localStorage.getItem("vitalitynutri_default_servings");
    return saved ? parseInt(saved, 10) : 1;
  });
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">(() => {
    return (localStorage.getItem("vitalitynutri_unit_system") as "metric" | "imperial") || "metric";
  });
  const [notice, setNotice] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showNotice = (message: string) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setNotice(message);
    timeoutRef.current = window.setTimeout(() => setNotice(null), 2200);
  };

  const handleLanguageChange = (lang: SupportedLang) => {
    i18n.changeLanguage(lang);
    setStoredLang(lang);
    showNotice(t("settings.saved_toast", "Settings updated"));
  };

  const handleThemeSelect = (theme: ThemeMode) => {
    onThemeChange(theme);
    showNotice(t("settings.saved_toast", "Settings updated"));
  };

  const handleServingsChange = (servings: number) => {
    const clamped = Math.max(1, Math.min(8, servings));
    setDefaultServings(clamped);
    localStorage.setItem("vitalitynutri_default_servings", clamped.toString());
    showNotice(t("settings.saved_toast", "Settings updated"));
  };

  const handleUnitSystemChange = (unit: "metric" | "imperial") => {
    setUnitSystem(unit);
    localStorage.setItem("vitalitynutri_unit_system", unit);
    showNotice(t("settings.saved_toast", "Settings updated"));
  };

  const handleClearCache = () => {
    if (window.confirm(t("settings.clear_cache_confirm", "Are you sure you want to clear local settings and cached data?"))) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-zinc-100">{t("settings.title", "Settings")}</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400">{t("settings.subtitle", "Customize language, servings, and appearance")}</p>
      </header>

      {notice && (
        <div className="px-4 py-3 rounded-2xl text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {isDemo && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <span className="font-semibold text-[11px] px-2 py-0.5 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 rounded-lg">
            {t("settings.demo_badge", "Demo Mode")}
          </span>
          <span>{t("settings.demo_banner_desc", "Settings are read-only during this demo session.")}</span>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("language")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "language"
              ? "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
          }`}
        >
          {i18n.language.startsWith("es") ? <SpainFlag className="w-5 h-3.5 shadow-xs" /> : <UKFlag className="w-5 h-3.5 shadow-xs" />}
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

      {activeTab === "language" && (
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            {t("settings.language_label", "Application Language")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleLanguageChange("es")}
              className={`p-4 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                i18n.language.startsWith("es")
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                  : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <SpainFlag className="w-9 h-6 shadow-sm rounded-sm" />
                <div>
                  <div className="text-sm font-black">Espanol</div>
                  <div className="text-[11px] opacity-70">Spanish</div>
                </div>
              </div>
              {i18n.language.startsWith("es") && <Check className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`p-4 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                i18n.language.startsWith("en")
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                  : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <UKFlag className="w-9 h-6 shadow-sm rounded-sm" />
                <div>
                  <div className="text-sm font-black">English</div>
                  <div className="text-[11px] opacity-70">Ingles</div>
                </div>
              </div>
              {i18n.language.startsWith("en") && <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {activeTab === "defaults" && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                {t("settings.default_servings_label", "Default Servings Multiplier")}
              </label>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                {defaultServings}x
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
                  onChange={(e) => handleServingsChange(parseInt(e.target.value, 10))}
                  className="flex-1 h-2 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
                <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">8x</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 4, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleServingsChange(num)}
                    className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      defaultServings === num
                        ? "border-emerald-500 bg-emerald-600 text-white"
                        : "border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
              {t("settings.unit_system_label", "Measurement Units")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleUnitSystemChange("metric")}
                className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  unitSystem === "metric"
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30 font-bold"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black">{t("settings.units_metric", "Metric System")}</span>
                </div>
                {unitSystem === "metric" && <Check className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => handleUnitSystemChange("imperial")}
                className={`p-3.5 text-left rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  unitSystem === "imperial"
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30 font-bold"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-black">{t("settings.units_imperial", "Imperial System")}</span>
                </div>
                {unitSystem === "imperial" && <Check className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "appearance" && (
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-2">
              {t("settings.theme_mode_label", "Color Theme")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleThemeSelect("light")}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all cursor-pointer ${
                  currentTheme === "light"
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                }`}
              >
                <Sun className="w-5 h-5" />
                <span className="text-xs font-black">{t("settings.theme_light", "Light")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeSelect("dark")}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all cursor-pointer ${
                  currentTheme === "dark"
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                }`}
              >
                <Moon className="w-5 h-5" />
                <span className="text-xs font-black">{t("settings.theme_dark", "Dark")}</span>
              </button>
              <button
                type="button"
                onClick={() => handleThemeSelect("system")}
                className={`p-4 rounded-2xl border flex flex-col items-center gap-3 text-center transition-all cursor-pointer ${
                  currentTheme === "system"
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500/30"
                    : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200"
                }`}
              >
                <Monitor className="w-5 h-5" />
                <span className="text-xs font-black">{t("settings.theme_system", "System")}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearCache}
            className="w-full p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {t("settings.clear_cache_button", "Reset Local Storage & Settings")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfileSettingsSection() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<ProfileTab>("profile");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [surname, setSurname] = useState(user?.surname ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setFirstName(user?.firstName ?? "");
    setSurname(user?.surname ?? "");
  }, [user?.firstName, user?.surname]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : t("account.generic_error") });
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = () =>
    run(async () => {
      const res = await apiFetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, surname }),
      });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      await refreshUser();
      setMessage({ kind: "ok", text: t("account.profile_saved") });
    });

  const changeEmail = () =>
    run(async () => {
      const res = await apiFetch("/api/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      setNewEmail("");
      setMessage({ kind: "ok", text: t("account.email_verification_sent") });
    });

  const changePassword = () =>
    run(async () => {
      const res = await apiFetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      setCurrentPassword("");
      setNewPassword("");
      setMessage({ kind: "ok", text: t("account.password_changed") });
    });

  const tabs = useMemo(
    () => [
      { id: "profile" as const, label: t("account.tab_profile"), icon: <UserIcon className="w-4 h-4" /> },
      { id: "email" as const, label: t("account.tab_email"), icon: <Mail className="w-4 h-4" /> },
      { id: "password" as const, label: t("account.tab_password"), icon: <KeyRound className="w-4 h-4" /> },
    ],
    [t],
  );

  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-zinc-100">{t("account.profile_title")}</h2>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => {
              setTab(tb.id);
              setMessage(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              tab === tb.id
                ? "bg-emerald-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {tb.icon}
            {tb.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium ${
            message.kind === "ok"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
              : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {tab === "profile" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">{t("account.first_name")}</label>
              <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">{t("account.surname")}</label>
              <input className={inputCls} value={surname} onChange={(e) => setSurname(e.target.value)} />
            </div>
            <button
              type="button"
              disabled={busy || !firstName.trim()}
              onClick={saveProfile}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer"
            >
              {t("common.save", "Save")}
            </button>
          </>
        )}

        {tab === "email" && (
          <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("account.current_email")}: <span className="font-semibold">{user?.email}</span>
            </p>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">{t("account.new_email")}</label>
              <input className={inputCls} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <button
              type="button"
              disabled={busy || !newEmail.trim()}
              onClick={changeEmail}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer"
            >
              {t("account.send_verification")}
            </button>
          </>
        )}

        {tab === "password" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">{t("account.current_password")}</label>
              <input className={inputCls} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">{t("account.new_password")}</label>
              <input className={inputCls} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <button
              type="button"
              disabled={busy || !currentPassword || newPassword.length < 6}
              onClick={changePassword}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer"
            >
              {t("account.change_password_btn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function AiSettingsSection() {
  const { t } = useTranslation();
  const { isOssMode } = useAuth();
  const aiSettingsUnderWork = true;
  const [settings, setSettings] = useState<AiSettingsDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState("");
  const [newProvider, setNewProvider] = useState("gemini");
  const [newApiKey, setNewApiKey] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [showUsageInfo, setShowUsageInfo] = useState(false);
  const [chainDrafts, setChainDrafts] = useState<Record<string, string>>({});

  const providerTypes = ["gemini", "openai", "groq", "openrouter", "openai-compatible", "anthropic"];

  const toUserMessage = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (/abort|network|failed to fetch|timed out/i.test(raw)) {
      return t("error.no_db_access_msg", "We couldn't load your meal plans. Check your connection and try again.");
    }
    return err instanceof Error ? err.message : t("account.generic_error");
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/account/ai-settings");
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      const data: AiSettingsDto = await res.json();
      setSettings(data);
      const drafts: Record<string, string> = {};
      for (const chain of data.availableChains) {
        const existing = data.chainOverrides.find((o) => o.chainName === chain);
        drafts[chain] = existing ? existing.tokens.join(", ") : "";
      }
      setChainDrafts(drafts);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setMode = (mode: "Platform" | "Byok") => {
    setSettings((prev) => (prev ? { ...prev, mode } : prev));
    if (aiSettingsUnderWork) {
      setNotice(t("account.ai_mode_preview_notice", "Mode changed for this preview. Your current setup hasn't been changed."));
    }
  };

  const addKey = () =>
    run(async () => {
      const res = await apiFetch("/api/account/provider-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType: newProvider,
          alias: newAlias,
          apiKey: newApiKey,
          baseUrl: newBaseUrl.trim() || null,
          validateImmediately: true,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      setNewAlias("");
      setNewApiKey("");
      setNewBaseUrl("");
      setNotice(t("account.key_added"));
      await load();
    });

  const deleteKey = (id: number) =>
    run(async () => {
      const res = await apiFetch(`/api/account/provider-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      await load();
    });

  const validateKey = (id: number) =>
    run(async () => {
      const res = await apiFetch(`/api/account/provider-keys/${id}/validate`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      setNotice(t("account.key_valid"));
      await load();
    });

  const saveOverrides = () =>
    run(async () => {
      const overrides = (Object.entries(chainDrafts) as [string, string][]).map(([chainName, raw]) => ({
        chainName,
        tokens: raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }));
      const res = await apiFetch("/api/account/chain-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      setSettings(await res.json());
      setNotice(t("account.overrides_saved"));
    });

  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";

  const usedPct =
    settings && settings.weeklyPlatformLimit > 0
      ? Math.min(100, Math.round((settings.creditsUsedThisWeek / settings.weeklyPlatformLimit) * 100))
      : 0;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-500" />
          {t("account.ai_title")}
        </h2>
      </header>

      {isOssMode && <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3">{t("account.ai_oss_note")}</p>}
      {aiSettingsUnderWork && (
        <div className="px-4 py-3 rounded-xl text-sm bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
          <p className="font-semibold">{t("account.ai_settings_under_work_title", "A preview of what's coming")}</p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-200">
            {t(
              "account.ai_settings_under_work_message",
              "We're still putting the finishing touches on AI settings. Feel free to explore both modes—your current setup won't change yet."
            )}
          </p>
        </div>
      )}
      {error && <div className="px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">{error}</div>}
      {notice && <div className="px-4 py-3 rounded-xl text-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">{notice}</div>}
      {!settings && !error && <p className="text-sm text-zinc-500">{t("common.loading", "Loading...")}</p>}

      {settings && (
        <>
          <section>
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-4 mb-3">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400 mb-3">
                {t("account.ai_mode_compare_title", "Difference between methods")}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3">
                  <p className="font-bold text-slate-700 dark:text-zinc-200 mb-1">{t("account.mode_platform")}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{t("account.ai_mode_compare_platform", "VitalityNutri manages providers and billing. You consume a weekly platform quota.")}</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3">
                  <p className="font-bold text-slate-700 dark:text-zinc-200 mb-1">{t("account.mode_byok")}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{t("account.ai_mode_compare_byok", "You add your own provider keys and control costs, limits, and model routing directly.")}</p>
                </div>
              </div>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">{t("account.ai_mode_label")}</h3>
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
              <div role="tablist" aria-label={t("account.ai_mode_label")} className="grid grid-cols-2 bg-slate-50 dark:bg-zinc-900">
                <button
                  type="button"
                  role="tab"
                  aria-selected={settings.mode === "Platform"}
                  disabled={busy}
                  onClick={() => setMode("Platform")}
                  className={`px-4 py-3 text-sm font-bold transition cursor-pointer border-b-2 ${
                    settings.mode === "Platform"
                      ? "border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-white dark:bg-zinc-800"
                      : "border-transparent text-slate-600 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-300"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    {t("account.mode_platform")}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={settings.mode === "Byok"}
                  disabled={busy}
                  onClick={() => setMode("Byok")}
                  className={`px-4 py-3 text-sm font-bold transition cursor-pointer border-b-2 ${
                    settings.mode === "Byok"
                      ? "border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-white dark:bg-zinc-800"
                      : "border-transparent text-slate-600 dark:text-zinc-300 hover:text-emerald-700 dark:hover:text-emerald-300"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <KeySquare className="w-4 h-4" />
                    {t("account.mode_byok")}
                  </span>
                </button>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
                {settings.mode === "Platform" ? (
                  <div className="space-y-3" role="tabpanel">
                    <p className="text-sm text-slate-700 dark:text-zinc-200">{t("account.mode_platform_desc")}</p>
                    <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 list-disc pl-4">
                      <li>{t("account.mode_platform_info_quota", "Credits are tracked per week and shared with your account usage.")}</li>
                      <li>{t("account.mode_platform_info_setup", "No API key setup is required to start.")}</li>
                      <li>{t("account.mode_platform_info_best", "Best for quick onboarding and lightweight usage.")}</li>
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-3" role="tabpanel">
                    <p className="text-sm text-slate-700 dark:text-zinc-200">{t("account.mode_byok_desc")}</p>
                    <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 list-disc pl-4">
                      <li>{t("account.mode_byok_info_quota", "Platform weekly quota is not consumed when your own keys are used.")}</li>
                      <li>{t("account.mode_byok_info_control", "You control provider, limits, and billing directly with your AI provider.")}</li>
                      <li>{t("account.mode_byok_info_best", "Best for advanced usage and provider-specific tuning.")}</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {settings.mode === "Platform" && settings.weeklyPlatformLimit > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  <span>{t("account.credits_used")}</span>
                  <span>
                    {settings.creditsUsedThisWeek} / {settings.weeklyPlatformLimit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${usedPct}%` }} />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("account.credits_panel_hint")}</p>
                  <button
                    type="button"
                    onClick={() => setShowUsageInfo((value) => !value)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {t("account.credits_info_button")}
                  </button>
                </div>

                {showUsageInfo && (
                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-900 dark:text-emerald-200 mb-2">
                      {t("account.credits_info_title")}
                    </p>
                    {(settings.usageMetrics?.length ?? 0) > 0 ? (
                      <ul className="text-xs text-emerald-900 dark:text-emerald-200 list-disc pl-4 space-y-1">
                        {settings.usageMetrics!.map((metric) => (
                          <li key={metric.key}>
                            {metric.description}: {metric.minCredits === metric.maxCredits
                              ? `${metric.minCredits}`
                              : `${metric.minCredits} - ${metric.maxCredits}`}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-900 dark:text-emerald-200">{t("account.credits_info_unavailable")}</p>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                    {t("account.ai_usage_interactions_title", "Usage interactions")}
                  </p>
                  {(settings.usageInteractions?.length ?? 0) > 0 ? (
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {settings.usageInteractions!.map((item, idx) => (
                        <div key={`${item.timestampUtc}-${idx}`} className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{item.operation || t("account.ai_usage_operation_unknown", "AI operation")}</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                              {new Date(item.timestampUtc).toLocaleString()} {item.model ? ` . ${item.model}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {(() => {
                              const signedValue = (item.status ?? "").toLowerCase().includes("refund") ? item.creditsUsed : -item.creditsUsed;
                              return (
                                <p className={`text-xs font-bold ${signedValue < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                                  {signedValue > 0 ? "+" : ""}{signedValue.toFixed(2)}
                                </p>
                              );
                            })()}
                            {item.status && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{item.status}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 p-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                          {t("account.ai_usage_interactions_empty_title", "No AI usage yet")}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {t("account.ai_usage_interactions_empty", "Your interactions will appear here after you use the AI platform for the first time.")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {settings.mode === "Byok" && (
            <>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">{t("account.keys_title")}</h3>
                <div className="space-y-2">
                  {settings.providerKeys.map((k) => (
                    <div key={k.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200 truncate">{k.alias}</span>
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold uppercase">{k.providerType}</span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">{k.maskedKey}{k.baseUrl ? ` . ${k.baseUrl}` : ""}</p>
                      </div>
                      <button type="button" disabled={busy || aiSettingsUnderWork} onClick={() => validateKey(k.id)} className="p-2 text-zinc-400 hover:text-emerald-600 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition cursor-pointer disabled:opacity-50">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button type="button" disabled={busy || aiSettingsUnderWork} onClick={() => deleteKey(k.id)} className="p-2 text-zinc-400 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer disabled:opacity-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={inputCls} disabled={aiSettingsUnderWork} placeholder={t("account.key_alias_ph")} value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
                  <select className={inputCls} disabled={aiSettingsUnderWork} value={newProvider} onChange={(e) => setNewProvider(e.target.value)}>
                    {providerTypes.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input className={inputCls} disabled={aiSettingsUnderWork} type="password" placeholder={t("account.key_secret_ph")} value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
                  <input className={inputCls} disabled={aiSettingsUnderWork} placeholder={t("account.key_baseurl_ph")} value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} />
                </div>
                <button
                  type="button"
                  disabled={busy || aiSettingsUnderWork || !newAlias.trim() || !newApiKey.trim()}
                  onClick={addKey}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> {t("account.key_add")}</span>
                </button>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">{t("account.overrides_title")}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{t("account.overrides_hint")}</p>
                <div className="space-y-2">
                  {settings.availableChains.map((chain) => (
                    <div key={chain}>
                      <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">{chain}</label>
                      <input
                        className={inputCls}
                        disabled={aiSettingsUnderWork}
                        placeholder={t("account.overrides_ph")}
                        value={chainDrafts[chain] ?? ""}
                        onChange={(e) => setChainDrafts((d) => ({ ...d, [chain]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={busy || aiSettingsUnderWork}
                  onClick={saveOverrides}
                  className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {t("account.overrides_save")}
                </button>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function SessionsSettingsSection() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/account/sessions");
      if (!res.ok) throw new Error();
      setSessions(await res.json());
    } catch {
      setError(t("account.generic_error"));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: number) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/account/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError(t("account.generic_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-extrabold text-slate-800 dark:text-zinc-100">{t("account.sessions_title")}</h2>
      </header>

      {error && <div className="px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">{error}</div>}
      {sessions.length === 0 && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("account.sessions_empty")}</p>}

      <div className="space-y-3">
        {sessions.map((s) => {
          const isMobile = /mobile|android|iphone|ipad/i.test(s.userAgent ?? "");
          return (
            <div key={s.id} className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 shrink-0">
                {isMobile ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200 truncate">{s.userAgent || t("account.session_unknown_device")}</span>
                  {s.isCurrent && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
                      {t("account.session_current")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {s.ipAddress || "?"} . {t("account.session_last_used")} {new Date(s.lastUsedAtUtc).toLocaleString()}
                </p>
              </div>
              {!s.isCurrent && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revoke(s.id)}
                  className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer disabled:opacity-50"
                  title={t("account.session_revoke")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
