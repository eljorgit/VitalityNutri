import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./es.json";
import en from "./en.json";

export const SUPPORTED_LANGS = ["es", "en"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: SupportedLang = "es";

export function isValidLang(lang: string | null): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

export function getStoredLang(): SupportedLang {
  try {
    const stored = localStorage.getItem("i18nextLng");
    if (stored && isValidLang(stored)) return stored;
  } catch {}
  const browserLang = navigator.language?.slice(0, 2);
  if (browserLang && isValidLang(browserLang)) return browserLang;
  return DEFAULT_LANG;
}

export function storeLang(lang: SupportedLang) {
  try {
    localStorage.setItem("i18nextLng", lang);
  } catch {}
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
