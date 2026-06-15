/// <reference types="vite/client" />
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
  const envLang = import.meta.env.VITE_LANGUAGE;
  if (envLang && isValidLang(envLang)) return envLang;
  return DEFAULT_LANG;
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
