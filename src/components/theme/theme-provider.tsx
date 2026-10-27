'use client';

import * as React from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'erp_sinar_abadi_theme';

const themeListeners = new Set<() => void>();

function notifyThemeChange() {
  for (const listener of themeListeners) {
    listener();
  }
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getThemeSnapshot(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // fallback
  }
  return 'system';
}

function getServerThemeSnapshot(): Theme {
  return 'system';
}

function subscribeMedia(listener: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

function getMediaSnapshot(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerMediaSnapshot(): boolean {
  return false;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const prefersDark = React.useSyncExternalStore(
    subscribeMedia,
    getMediaSnapshot,
    getServerMediaSnapshot
  );

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  // Sinkronisasi class ke <html> (DOM external mutation)
  React.useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }, [resolvedTheme]);

  const setTheme = React.useCallback((newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      notifyThemeChange();
    } catch {
      // Abaikan jika localStorage tidak dapat diakses
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    const current = getThemeSnapshot();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
      notifyThemeChange();
    } catch {
      // Abaikan
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
