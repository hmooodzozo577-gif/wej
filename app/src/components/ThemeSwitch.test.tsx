import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, ThemeSwitch } from './ThemeSwitch';

function installMatchMedia(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      get matches() { return dark; },
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  return (nextDark: boolean) => {
    dark = nextDark;
    listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent));
  };
}

describe('ThemeSwitch', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    installMatchMedia(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to the device theme and follows live system changes', () => {
    const changeSystemTheme = installMatchMedia(true);
    render(<ThemeSwitch lang="en" />);

    expect(document.documentElement.dataset.theme).toBe('dark');
    changeSystemTheme(false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists a manual choice and no longer follows system changes', () => {
    const changeSystemTheme = installMatchMedia(false);
    render(<ThemeSwitch lang="ar" />);

    fireEvent.change(screen.getByRole('combobox', { name: 'المظهر' }), { target: { value: 'dark' } });

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    changeSystemTheme(false);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('restores a saved preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeSwitch lang="en" />);

    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
