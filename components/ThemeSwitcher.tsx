'use client';

import React, { useEffect } from 'react';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';

export function ThemeSwitcher() {
  const { mode, toggleMode, initTheme } = useThemeStore();
  const { t } = useLanguageStore();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  const isDark = mode === 'dark';

  return (
    <div className="relative flex items-center">
      <input
        id="checkboxInput"
        type="checkbox"
        checked={isDark}
        onChange={toggleMode}
        aria-label={t.theme.selectorAria}
      />
      <label
        className="toggleSwitch"
        htmlFor="checkboxInput"
        title={isDark ? t.theme.lightTitle : t.theme.darkTitle}
      >
        <div className="icon icon--moon">
          <svg
            className="moon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="20"
            height="20"
          >
            <path
              fillRule="evenodd"
              d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
              clipRule="evenodd"
            ></path>
          </svg>
        </div>

        <div className="icon icon--sun">
          <svg
            className="sun"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="20"
            height="20"
          >
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"></path>
          </svg>
        </div>
      </label>
    </div>
  );
}

