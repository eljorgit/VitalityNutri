import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Trash2, RefreshCw, Cloud, KeySquare, Sparkles } from "lucide-react";
import { apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProviderKeyDto {
  id: number;
  providerType: string;
  alias: string;
  maskedKey: string;
  baseUrl: string | null;
  isValidated: boolean;
  validatedAtUtc: string | null;
  createdAtUtc: string;
}

interface AiSettingsDto {
  mode: "Platform" | "Byok";
  providerKeys: ProviderKeyDto[];
  chainOverrides: { chainName: string; tokens: string[] }[];
  availableChains: string[];
  weeklyPlatformLimit: number;
  creditsUsedThisWeek: number;
  currentWeekStartUtc: string;
}

const PROVIDER_TYPES = ["gemini", "openai", "groq", "openrouter", "openai-compatible", "anthropic"];

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || data.title || data.message || fallback;
  } catch {
    return fallback;
  }
}

export default function AiSettingsModal({ isOpen, onClose }: AiSettingsModalProps) {
  const { t } = useTranslation();
  const { isOssMode } = useAuth();
  const [settings, setSettings] = useState<AiSettingsDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newAlias, setNewAlias] = useState("");
  const [newProvider, setNewProvider] = useState(PROVIDER_TYPES[0]);
  const [newApiKey, setNewApiKey] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [chainDrafts, setChainDrafts] = useState<Record<string, string>>({});

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
      setError(err instanceof Error ? err.message : t("account.generic_error"));
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.generic_error"));
    } finally {
      setBusy(false);
    }
  };

  const setMode = (mode: "Platform" | "Byok") =>
    run(async () => {
      const res = await apiFetch("/api/account/ai-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(await readError(res, t("account.generic_error")));
      setSettings(await res.json());
    });

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

  if (!isOpen) return null;

  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
  const btnCls =
    "px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer";

  const usedPct =
    settings && settings.weeklyPlatformLimit > 0
      ? Math.min(100, Math.round((settings.creditsUsedThisWeek / settings.weeklyPlatformLimit) * 100))
      : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            {t("account.ai_title")}
          </h2>
          <button type="button" onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto">
          {isOssMode && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-xl px-4 py-3">
              {t("account.ai_oss_note")}
            </p>
          )}
          {error && <div className="px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">{error}</div>}
          {notice && <div className="px-4 py-3 rounded-xl text-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">{notice}</div>}
          {!settings && !error && <p className="text-sm text-zinc-500">{t("common.loading", "Loading...")}</p>}

          {settings && (
            <>
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">{t("account.ai_mode_label")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setMode("Platform")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      settings.mode === "Platform"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-slate-200 dark:border-zinc-700 hover:border-emerald-300"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
                      <Cloud className="w-4 h-4 text-emerald-600" /> {t("account.mode_platform")}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t("account.mode_platform_desc")}</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setMode("Byok")}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      settings.mode === "Byok"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-slate-200 dark:border-zinc-700 hover:border-emerald-300"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
                      <KeySquare className="w-4 h-4 text-emerald-600" /> {t("account.mode_byok")}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t("account.mode_byok_desc")}</span>
                  </button>
                </div>
                {settings.weeklyPlatformLimit > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                      <span>{t("account.credits_used")}</span>
                      <span>
                        {settings.creditsUsedThisWeek} / {settings.weeklyPlatformLimit}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${usedPct}%` }} />
                    </div>
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">{t("account.keys_title")}</h3>
                <div className="space-y-2">
                  {settings.providerKeys.map((k) => (
                    <div key={k.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200 truncate">{k.alias}</span>
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold uppercase">{k.providerType}</span>
                          {k.isValidated ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">{t("account.key_validated")}</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">{t("account.key_unvalidated")}</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">{k.maskedKey}{k.baseUrl ? ` · ${k.baseUrl}` : ""}</p>
                      </div>
                      <button type="button" disabled={busy} onClick={() => validateKey(k.id)} className="p-2 text-zinc-400 hover:text-emerald-600 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition cursor-pointer disabled:opacity-50" title={t("account.key_validate")}>
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button type="button" disabled={busy} onClick={() => deleteKey(k.id)} className="p-2 text-zinc-400 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer disabled:opacity-50" title={t("account.key_delete")}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={inputCls} placeholder={t("account.key_alias_ph")} value={newAlias} onChange={(e) => setNewAlias(e.target.value)} />
                  <select className={inputCls} value={newProvider} onChange={(e) => setNewProvider(e.target.value)}>
                    {PROVIDER_TYPES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input className={inputCls} type="password" placeholder={t("account.key_secret_ph")} value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
                  <input className={inputCls} placeholder={t("account.key_baseurl_ph")} value={newBaseUrl} onChange={(e) => setNewBaseUrl(e.target.value)} />
                </div>
                <button type="button" className={`${btnCls} mt-2`} disabled={busy || !newAlias.trim() || !newApiKey.trim()} onClick={addKey}>
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
                        placeholder={t("account.overrides_ph")}
                        value={chainDrafts[chain] ?? ""}
                        onChange={(e) => setChainDrafts((d) => ({ ...d, [chain]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <button type="button" className={`${btnCls} mt-3`} disabled={busy} onClick={saveOverrides}>
                  {t("account.overrides_save")}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
