/// <reference types="vite/client" />
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./es.json";
import en from "./en.json";

export const SUPPORTED_LANGS = ["es", "en"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: SupportedLang = "en";

declare global {
  interface Window {
    __VITALITYNUTRI_CONFIG__?: {
      language?: string;
      siteVisibility?: "public" | "local";
      apiUrl?: string;
      maxUploadSizeMb?: number;
      appMode?: string;
    };
  }
}

export function isValidLang(lang: string | null): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

export function getStoredLang(): SupportedLang {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("vitalitynutri_language");
    if (saved && isValidLang(saved)) return saved;
  }

  const runtimeLang = typeof window !== "undefined"
    ? window.__VITALITYNUTRI_CONFIG__?.language
    : undefined;
  if (runtimeLang && isValidLang(runtimeLang)) return runtimeLang;

  return DEFAULT_LANG;
}

export function setStoredLang(lang: SupportedLang): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("vitalitynutri_language", lang);
  }
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: getStoredLang(),
  fallbackLng: DEFAULT_LANG,
  interpolation: {
    escapeValue: false,
  },
  returnObjects: true,
});

export default i18n;
