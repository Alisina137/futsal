import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultLanguage, isRtlLanguage, translate, type LanguageCode, type TranslationKey } from "@leaguekick/localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "leaguekick.language.v1";

type LocaleContextValue = {
  language: LanguageCode;
  isRTL: boolean;
  ready: boolean;
  setLanguage: (language: LanguageCode) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<LanguageCode>(defaultLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "fa-AF" || stored === "ps-AF" || stored === "en") setCurrentLanguage(stored);
      })
      .finally(() => setReady(true));
  }, []);

  const setLanguage = useCallback(async (next: LanguageCode) => {
    setCurrentLanguage(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({
    language,
    isRTL: isRtlLanguage(language),
    ready,
    setLanguage,
    t: (key, params) => translate(language, key, params),
  }), [language, ready, setLanguage]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
