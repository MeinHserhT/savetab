'use client';

import { create } from 'zustand';
import { LanguageCode, TRANSLATIONS, Translations } from '@/lib/i18n';

const STORAGE_LANG_KEY = 'tabflow_language';

function applyLangToDocument(lang: LanguageCode) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
}

interface LanguageState {
  lang: LanguageCode;
  t: Translations;
  hydrated: boolean;
  initLanguage: () => void;
  setLanguage: (lang: LanguageCode) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  lang: 'vi',
  t: TRANSLATIONS.vi,
  hydrated: false,

  initLanguage: () => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_LANG_KEY) as LanguageCode | null;
    const validLang: LanguageCode = saved === 'en' ? 'en' : 'vi';
    applyLangToDocument(validLang);
    set({
      lang: validLang,
      t: TRANSLATIONS[validLang],
      hydrated: true,
    });
  },

  setLanguage: (lang) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    }
    applyLangToDocument(lang);
    set({
      lang,
      t: TRANSLATIONS[lang],
    });
  },

  toggleLanguage: () => {
    const next: LanguageCode = get().lang === 'vi' ? 'en' : 'vi';
    get().setLanguage(next);
  },
}));
