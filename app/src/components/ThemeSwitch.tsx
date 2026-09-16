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
  // Tracks the OS's live prefers-color-scheme, independently of `preference`.
  // Needed so the control's icon can reflect the effective appearance while
  // System is selected — `preference` itself stays 'auto' either way, there
  // is no second theme state, just this one extra read of the same media
  // query the effect below already subscribes to.
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      setSystemDark(media.matches);
      applyTheme(preference, media.matches);
    };
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

  // The effective appearance for a given preference value: System resolves
  // through the live OS query, Light/Dark are explicit. The icon always
  // shows what the page actually looks like right now — on System it used
  // to be pinned to a sun even when the device was dark, which is the bug
  // this fixes.
  const iconFor = (value: ThemePreference) => ((value === 'auto' ? systemDark : value === 'dark') ? 'moon' : 'sun');

  const options = [
    // The hint communicates the effective appearance next to the "System"
    // label itself, so it reads e.g. "System — Dark" while the preference
    // stays System.
    { value: 'auto', label: labels.auto, hint: systemDark ? labels.dark : labels.light, icon: <Icon name={iconFor('auto')} size={15} stroke={2.2} /> },
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
