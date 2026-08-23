import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { User as UserIcon, ChevronDown, LogOut, SlidersHorizontal, MonitorSmartphone } from "lucide-react";
import type { User } from "../../types";
import ProfileModal from "./ProfileModal";
import AiSettingsModal from "./AiSettingsModal";
import SessionsModal from "./SessionsModal";

interface AccountAreaProps {
  user: User;
  onLogout: () => void;
}

export default function AccountArea({ user, onLogout }: AccountAreaProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (open && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const itemCls =
    "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer";

  return (
    <>
      <div className="relative flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-200 text-xs font-semibold select-none transition cursor-pointer"
        >
          <UserIcon className="w-3.5 h-3.5 text-zinc-500" />
          <span className="max-w-[100px] truncate">{user.fullName || user.email}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-[200] p-1.5 animate-fade-in">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-zinc-800 mb-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{user.fullName || user.email}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
            </div>
            <button type="button" className={itemCls} onClick={() => { setProfileOpen(true); setOpen(false); }}>
              <UserIcon className="w-4 h-4" /> {t("account.menu_profile")}
            </button>
            <button type="button" className={itemCls} onClick={() => { setAiOpen(true); setOpen(false); }}>
              <SlidersHorizontal className="w-4 h-4" /> {t("account.menu_ai")}
            </button>
            <button type="button" className={itemCls} onClick={() => { setSessionsOpen(true); setOpen(false); }}>
              <MonitorSmartphone className="w-4 h-4" /> {t("account.menu_sessions")}
            </button>
            <div className="border-t border-slate-100 dark:border-zinc-800 mt-1 pt-1">
              <button type="button" className={`${itemCls} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30`} onClick={onLogout}>
                <LogOut className="w-4 h-4" /> {t("account.menu_logout")}
              </button>
            </div>
          </div>
        )}
      </div>

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
      <AiSettingsModal isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      <SessionsModal isOpen={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </>
  );
}
