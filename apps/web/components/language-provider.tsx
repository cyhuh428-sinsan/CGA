"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { UI_CATALOGS, type TranslationKey } from "@/lib/i18n/catalogs";
import { DEFAULT_LANGUAGE, normalizeSupportedLanguage, UI_LANGUAGE_STORAGE_KEY, type SupportedLanguage } from "@/lib/language";

type LanguageContextValue = {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      setLanguageState(normalizeSupportedLanguage(window.localStorage?.getItem(UI_LANGUAGE_STORAGE_KEY)));
    } catch {
      setLanguageState(DEFAULT_LANGUAGE);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: SupportedLanguage) => {
    setLanguageState(nextLanguage);
    try {
      window.localStorage?.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // 보안 정책으로 저장소가 차단되어도 현재 화면의 언어 전환은 유지한다.
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => UI_CATALOGS[language][key] ?? UI_CATALOGS.ko[key],
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return context;
}
