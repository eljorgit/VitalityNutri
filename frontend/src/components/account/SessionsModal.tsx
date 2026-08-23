import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Monitor, Smartphone, Trash2 } from "lucide-react";
import { apiFetch } from "../../utils/api";

interface SessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SessionDto {
  id: number;
  userAgent: string | null;
  ipAddress: string | null;
  createdAtUtc: string;
  lastUsedAtUtc: string;
  expiresAtUtc: string;
  isCurrent: boolean;
}

export default function SessionsModal({ isOpen, onClose }: SessionsModalProps) {
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
    if (isOpen) load();
  }, [isOpen, load]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">{t("account.sessions_title")}</h2>
          <button type="button" onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          {error && <div className="px-4 py-3 rounded-xl text-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">{error}</div>}
          {sessions.length === 0 && !error && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("account.sessions_empty")}</p>
          )}
          {sessions.map((s) => {
            const isMobile = /mobile|android|iphone|ipad/i.test(s.userAgent ?? "");
            return (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-800/40">
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-300 shrink-0">
                  {isMobile ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200 truncate">
                      {s.userAgent || t("account.session_unknown_device")}
                    </span>
                    {s.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
                        {t("account.session_current")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {s.ipAddress || "?"} · {t("account.session_last_used")} {new Date(s.lastUsedAtUtc).toLocaleString()}
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
    </div>
  );
}
