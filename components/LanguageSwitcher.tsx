'use client';

import React, { useEffect } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';

export function LanguageSwitcher() {
  const { lang, t, setLanguage, initLanguage } = useLanguageStore();

  useEffect(() => {
    initLanguage();
  }, [initLanguage]);

  return (
    <div
      role="group"
      aria-label={t.header.languageSelectorAria}
      className="inline-flex items-center p-0.5 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)]"
    >

      <button
        type="button"
        onClick={() => setLanguage('vi')}
        aria-pressed={lang === 'vi'}
        title={t.header.langViTitle}
        className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
          lang === 'vi'
            ? 'bg-[var(--tf-elevated)] text-[var(--tf-text)] shadow-xs border border-[var(--tf-border-strong)]'
            : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] border border-transparent'
        }`}
      >
        <span>{t.header.langViLabel}</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={lang === 'en'}
        title={t.header.langEnTitle}
        className={`inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
          lang === 'en'
            ? 'bg-[var(--tf-elevated)] text-[var(--tf-text)] shadow-xs border border-[var(--tf-border-strong)]'
            : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] border border-transparent'
        }`}
      >
        <span>{t.header.langEnLabel}</span>
      </button>
    </div>
  );
}
