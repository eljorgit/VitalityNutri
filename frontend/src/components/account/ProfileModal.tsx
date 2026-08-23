import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, User as UserIcon, Mail, KeyRound } from "lucide-react";
import { apiFetch } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = "profile" | "email" | "password";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || data.title || data.message || fallback;
  } catch {
    return fallback;
  }
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [surname, setSurname] = useState(user?.surname ?? "");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  if (!isOpen) return null;

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

  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
  const btnCls =
    "px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition cursor-pointer";

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: t("account.tab_profile"), icon: <UserIcon className="w-4 h-4" /> },
    { id: "email", label: t("account.tab_email"), icon: <Mail className="w-4 h-4" /> },
    { id: "password", label: t("account.tab_password"), icon: <KeyRound className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100">{t("account.profile_title")}</h2>
          <button type="button" onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4 shrink-0">
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

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
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
              <button type="button" className={btnCls} disabled={busy || !firstName.trim()} onClick={saveProfile}>
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
              <button type="button" className={btnCls} disabled={busy || !newEmail.trim()} onClick={changeEmail}>
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
              <button type="button" className={btnCls} disabled={busy || !currentPassword || newPassword.length < 6} onClick={changePassword}>
                {t("account.change_password_btn")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
