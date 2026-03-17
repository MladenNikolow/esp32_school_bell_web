import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import en from '../i18n/en.js';
import bg from '../i18n/bg.js';

const dictionaries = { en, bg };

function getInitialLocale() {
  const stored = localStorage.getItem('locale');
  if (stored === 'en' || stored === 'bg') return stored;
  return navigator.language.startsWith('bg') ? 'bg' : 'en';
}

const LocaleContext = createContext();

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
    localStorage.setItem('locale', locale);
  }, [locale]);

  const setLocale = useCallback((l) => {
    if (l === 'en' || l === 'bg') setLocaleState(l);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === 'en' ? 'bg' : 'en'));
  }, []);

  const t = useCallback((key, params) => {
    const dict = dictionaries[locale] || en;
    let str = dict[key] ?? en[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      });
    }
    return str;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, toggleLocale, t }), [locale, setLocale, toggleLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export default function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
