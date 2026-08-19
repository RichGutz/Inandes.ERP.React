// src/styles/theme.ts
// Modulo Centralizado de Estilos & Tokens APEFAC / InAndes ERP

export const THEME_CONFIG = {
  fonts: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Consolas', monospace",
  },
  colors: {
    light: {
      bgApp: '#f1f5f9',
      bgSidebar: '#ffffff',
      bgPanel: '#ffffff',
      bgCard: '#ffffff',
      bgCardHover: '#f8fafc',
      bgSurface: '#f8fafc',
      borderSubtle: '#e2e8f0',
      borderFocus: '#0284c7',
      textMain: '#0f172a',
      textMuted: '#475569',
      textDim: '#64748b',
      primary: '#0284c7',
      primaryHover: '#0369a1',
      accent: '#4f46e5',
      success: '#059669',
      warning: '#d97706',
      danger: '#e11d48',
    },
    dark: {
      bgApp: '#0b0f19',
      bgSidebar: '#111827',
      bgPanel: '#1e293b',
      bgCard: '#1e293b',
      bgCardHover: '#243248',
      bgSurface: '#151e2e',
      borderSubtle: '#334155',
      borderFocus: '#38bdf8',
      textMain: '#f8fafc',
      textMuted: '#94a3b8',
      textDim: '#64748b',
      primary: '#38bdf8',
      primaryHover: '#0284c7',
      accent: '#818cf8',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#f43f5e',
    }
  },
  card: {
    borderRadius: '12px',
    border: '1px solid var(--border-subtle)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
  }
} as const;

export type ThemeMode = 'light' | 'dark';

export const getStoredTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('theme') as ThemeMode;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

export const applyTheme = (theme: ThemeMode): void => {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }
};
