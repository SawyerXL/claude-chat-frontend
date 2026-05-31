export type Theme = 'dark' | 'light' | 'system';

const THEME_KEY = 'claude_theme';
const AUTO_THEME_KEY = 'claude_auto_theme';

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system'; // Default to system preference
}

export function getAutoThemeEnabled(): boolean {
  return localStorage.getItem(AUTO_THEME_KEY) === 'true';
}

export function setAutoThemeEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_THEME_KEY, enabled ? 'true' : 'false');
}

// Detect system preference
export function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

// Get resolved theme (considering system preference)
export function getResolvedTheme(): Theme {
  const theme = getTheme();
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(getResolvedTheme());
}

export function applyTheme(theme: Theme): void {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  const root = document.documentElement;

  // Add transition for smooth theme change
  root.style.transition = 'background-color 0.3s ease, color 0.3s ease';

  if (resolved === 'light') {
    root.setAttribute('data-theme', 'light');
    root.style.setProperty('--bg-primary', '#fafafa');
    root.style.setProperty('--bg-secondary', '#ffffff');
    root.style.setProperty('--bg-tertiary', '#f5f5f5');
    root.style.setProperty('--bg-hover', '#ebebeb');
    root.style.setProperty('--bg-input', '#f0f0f0');
    root.style.setProperty('--text-primary', '#1a1a1a');
    root.style.setProperty('--text-secondary', '#666666');
    root.style.setProperty('--text-tertiary', '#999999');
    root.style.setProperty('--border-color', '#e5e5e5');
    root.style.setProperty('--accent', '#d97757');
    root.style.setProperty('--accent-hover', '#c96a4a');
  } else {
    root.setAttribute('data-theme', 'dark');
    root.style.setProperty('--bg-primary', '#262624');
    root.style.setProperty('--bg-secondary', '#1f1e1d');
    root.style.setProperty('--bg-tertiary', '#2d2c2a');
    root.style.setProperty('--bg-hover', '#343330');
    root.style.setProperty('--bg-input', '#30302e');
    root.style.setProperty('--text-primary', '#f5f4ee');
    root.style.setProperty('--text-secondary', '#b8b6b0');
    root.style.setProperty('--text-tertiary', '#8a8780');
    root.style.setProperty('--border-color', '#3a3836');
    root.style.setProperty('--accent', '#d97757');
    root.style.setProperty('--accent-hover', '#c96a4a');
  }
}

export function initTheme(): Theme {
  const theme = getTheme();
  applyTheme(theme);

  // Listen for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (getTheme() === 'system') {
        applyTheme('system');
      }
    });
  }

  return getResolvedTheme();
}

export function toggleTheme(): Theme {
  const current = getResolvedTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}