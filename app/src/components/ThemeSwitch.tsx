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

  // Item #2 — the System option shows a SUN, not the monitor/device glyph,
  // as the user asked for directly. Light and dark keep their own sun/moon
  // treatment, so the sun appears twice by design: on System it means
  // "whatever your device is doing", on Light it means the light theme.
  const iconFor = (value: ThemePreference) => (value === 'dark' ? 'moon' : 'sun');

  const options = [
    { value: 'auto', label: labels.auto, icon: <Icon name={iconFor('auto')} size={15} stroke={2.2} /> },
    { value: 'light', label: labels.light, icon: <Icon name={iconFor('light')} size={15} stroke={2.2} /> },
    { value: 'dark', label: labels.dark, icon: <Icon name={iconFor('dark')} size={15} stroke={2.2} /> },
  ];

  return (
    <div className="theme-switch">
      <Select
        aria-label={labels.label}
        value={preference}
        options={options}
        icon={<Icon name={iconFor(preference)} size={15} stroke={2.2} />}
        onChange={(value) => changePreference(value as ThemePreference)}
      />
    </div>
  );
}
