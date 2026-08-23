import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiFetch, getApiBaseUrl } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import BrandLogo from "../BrandLogo";

interface VerifyEmailScreenProps {
  token: string;
  onDone: () => void;
}

type State = "loading" | "success" | "error";

export default function VerifyEmailScreen({ token, onDone }: VerifyEmailScreenProps) {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [detail, setDetail] = useState<string>("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !token) {
      if (!token) {
        setState("error");
        setDetail(t("account.verify_missing_token"));
      }
      return;
    }
    ranRef.current = true;

    (async () => {
      try {
        const res = await apiFetch("/api/auth/verify-email-change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          let message = t("account.verify_failed");
          try {
            const data = await res.json();
            message = data.detail || data.title || message;
          } catch {
            /* keep default */
          }
          setDetail(message);
          setState("error");
          return;
        }
        const data = await res.json();
        if (data.token) localStorage.setItem("vitality_token", data.token);
        if (data.refreshToken) localStorage.setItem("vitality_refresh_token", data.refreshToken);
        await refreshUser();
        setState("success");
      } catch {
        setDetail(t("account.verify_failed"));
        setState("error");
      }
    })();
  }, [token, refreshUser, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <BrandLogo className="h-10 w-auto" />
        </div>

        {state === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{t("account.verify_in_progress")}</p>
          </div>
        )}

        {state === "success" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <h1 className="text-lg font-bold text-slate-800 dark:text-zinc-100">{t("account.verify_success_title")}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("account.verify_success_body")}</p>
            <button
              type="button"
              onClick={onDone}
              className="mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition cursor-pointer"
            >
              {t("account.verify_continue")}
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="w-10 h-10 text-red-500" />
            <h1 className="text-lg font-bold text-slate-800 dark:text-zinc-100">{t("account.verify_error_title")}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{detail || t("account.verify_failed")}</p>
            <a
              href={getApiBaseUrl() ? "/" : "/"}
              onClick={(e) => {
                e.preventDefault();
                onDone();
              }}
              className="mt-2 px-5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-semibold transition cursor-pointer"
            >
              {t("account.verify_back")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
