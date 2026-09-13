import { useEffect, useState } from 'react';
import type { Lang } from '../data/types';

export type ThemePreference = 'auto' | 'light' | 'dark';
export const THEME_STORAGE_KEY = 'wejhaty.theme';

function savedPreference(): ThemePreference {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : 'auto';
}

function applyTheme(preference: ThemePreference, systemDark: boolean) {
  const theme = preference === 'auto' ? (systemDark ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#101722' : '#EBE7DC');
}

export function ThemeSwitch({ lang }: { lang: Lang }) {
  const [preference, setPreference] = useState<ThemePreference>(savedPreference);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(preference, media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);

  const labels = lang === 'ar'
    ? { label: 'المظهر', auto: 'تلقائي', light: 'فاتح', dark: 'داكن' }
    : { label: 'Theme', auto: 'Auto', light: 'Light', dark: 'Dark' };

  const changePreference = (next: ThemePreference) => {
    setPreference(next);
    if (next === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return (
    <label className="theme-switch">
      <select
        aria-label={labels.label}
        value={preference}
        onChange={(event) => changePreference(event.target.value as ThemePreference)}
      >
        <option value="auto">{labels.auto}</option>
        <option value="light">{labels.light}</option>
        <option value="dark">{labels.dark}</option>
      </select>
    </label>
  );
}
