export type Theme = 'dark' | 'light';

const THEME_KEY = 'claude_theme';

export function getTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'dark'; // Default to dark
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'light') {
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
  return theme;
}

export function toggleTheme(): Theme {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}