import { useEffect, useState } from 'react';
import type { Lang } from '../data/types';
import { Icon } from './Icon';
import { Select } from './Select';

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
    ? { label: 'المظهر', auto: 'حسب النظام', light: 'فاتح', dark: 'داكن' }
    : { label: 'Theme', auto: 'System', light: 'Light', dark: 'Dark' };

  const changePreference = (next: ThemePreference) => {
    setPreference(next);
    if (next === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  // Item #3: a bare native select gave no visual cue of its current state
  // beyond the text itself. The leading icon now mirrors the live
  // selection — device/monitor for System, sun for Light, moon for Dark —
  // and the chevron (from Select) makes the control read as a dropdown.
  const currentIcon = preference === 'dark' ? 'moon' : preference === 'light' ? 'sun' : 'monitor';

  return (
    <label className="theme-switch">
      <Select
        aria-label={labels.label}
        value={preference}
        icon={<Icon name={currentIcon} size={15} stroke={2.2} />}
        onChange={(event) => changePreference(event.target.value as ThemePreference)}
      >
        <option value="auto">{labels.auto}</option>
        <option value="light">{labels.light}</option>
        <option value="dark">{labels.dark}</option>
      </Select>
    </label>
  );
}
