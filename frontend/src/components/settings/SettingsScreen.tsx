import React from "react";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone, Settings, SlidersHorizontal, User as UserIcon } from "lucide-react";
import {
  AiSettingsSection,
  GeneralSettingsSection,
  ProfileSettingsSection,
  SessionsSettingsSection,
} from "./SettingsSections";
import type { ThemeMode } from "./SettingsSections";

export type { ThemeMode } from "./SettingsSections";

export type SettingsSection = "general" | "profile" | "ai" | "sessions";

interface SettingsScreenProps {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export default function SettingsScreen({
  section,
  onSectionChange,
  currentTheme,
  onThemeChange,
}: SettingsScreenProps) {
  const { t } = useTranslation();

  const menu: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: t("settings.title", "Settings"), icon: <Settings className="w-4 h-4" /> },
    { id: "profile", label: t("account.menu_profile"), icon: <UserIcon className="w-4 h-4" /> },
    { id: "ai", label: t("account.menu_ai"), icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: "sessions", label: t("account.menu_sessions"), icon: <MonitorSmartphone className="w-4 h-4" /> },
  ];

  return (
    <section className="w-full max-w-container-max mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3">
          <div className="sticky top-24 rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-zinc-800 mb-2">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">{t("settings.title", "Preferences")}</p>
            </div>
            <nav className="space-y-1.5">
              {menu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 transition cursor-pointer text-sm ${
                    section === item.id
                      ? "bg-emerald-600 text-white font-semibold"
                      : "text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="lg:col-span-9">
          <div className="rounded-3xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-sm min-h-[420px]">
            {section === "general" && <GeneralSettingsSection currentTheme={currentTheme} onThemeChange={onThemeChange} />}
            {section === "profile" && <ProfileSettingsSection />}
            {section === "ai" && <AiSettingsSection />}
            {section === "sessions" && <SessionsSettingsSection />}
          </div>
        </div>
      </div>
    </section>
  );
}
