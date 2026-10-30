'use client';

import { create } from 'zustand';
import {
  DARK_PALETTE,
  getPaletteForMode,
  ThemeMode,
  ThemePalette,
} from '@/lib/theme';

const STORAGE_MODE_KEY = 'tabflow_theme_mode';

export function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.removeAttribute('data-palette');

  if (mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

interface ThemeState {
  mode: ThemeMode;
  activePalette: ThemePalette;
  hydrated: boolean;
  initTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  activePalette: DARK_PALETTE,
  hydrated: false,

  initTheme: () => {
    if (typeof window === 'undefined') return;
    const savedMode =
      (localStorage.getItem(STORAGE_MODE_KEY) as ThemeMode | null) || 'dark';
    const validMode: ThemeMode = savedMode === 'light' ? 'light' : 'dark';
    const palette = getPaletteForMode(validMode);

    applyThemeToDocument(validMode);
    set({
      mode: validMode,
      activePalette: palette,
      hydrated: true,
    });
  },

  setMode: (mode) => {
    const palette = getPaletteForMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
    }
    applyThemeToDocument(mode);
    set({ mode, activePalette: palette });
  },

  toggleMode: () => {
    const nextMode: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    get().setMode(nextMode);
  },
}));
