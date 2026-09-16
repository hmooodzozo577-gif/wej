import { act, fireEvent, render, screen } from '@testing-library/react';
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

    // Item #1: this is a real listbox now, not a native <select> — open it
    // and click the option, exactly as a user would.
    fireEvent.click(screen.getByRole('combobox', { name: 'المظهر' }));
    fireEvent.click(screen.getByRole('option', { name: 'داكن' }));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    changeSystemTheme(false);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('restores a saved preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeSwitch lang="en" />);

    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('Light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  // The reported bug: the icon on the System preference stayed a sun even
  // when the OS was dark. sun/moon are told apart by their actual path
  // data (icons.json) since the SVG itself is aria-hidden.
  function triggerIconHtml() {
    return screen.getByRole('combobox').querySelector('.wj-select-icon svg')?.innerHTML ?? '';
  }
  const isMoon = (html: string) => html.includes('M21 12.8A9');
  const isSun = (html: string) => html.includes('cx="12" cy="12" r="4.5"');

  it('shows the sun icon for explicit Light', () => {
    installMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeSwitch lang="en" />);
    expect(isSun(triggerIconHtml())).toBe(true);
  });

  it('shows the moon icon for explicit Dark', () => {
    installMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeSwitch lang="en" />);
    expect(isMoon(triggerIconHtml())).toBe(true);
  });

  it('shows the sun icon for System when the OS is light', () => {
    installMatchMedia(false);
    render(<ThemeSwitch lang="en" />);
    expect(isSun(triggerIconHtml())).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('shows the moon icon for System when the OS is dark — the reported bug', () => {
    installMatchMedia(true);
    render(<ThemeSwitch lang="en" />);
    expect(isMoon(triggerIconHtml())).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('updates the System icon live when the OS switches light -> dark, without leaving System', () => {
    const changeSystemTheme = installMatchMedia(false);
    render(<ThemeSwitch lang="en" />);
    expect(isSun(triggerIconHtml())).toBe(true);

    act(() => changeSystemTheme(true));

    expect(isMoon(triggerIconHtml())).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    // The preference itself must still read System, never converted.
    expect(screen.getByRole('combobox')).toHaveTextContent('System');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('updates the System icon live when the OS switches dark -> light', () => {
    const changeSystemTheme = installMatchMedia(true);
    render(<ThemeSwitch lang="en" />);
    expect(isMoon(triggerIconHtml())).toBe(true);

    act(() => changeSystemTheme(false));

    expect(isSun(triggerIconHtml())).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getByRole('combobox')).toHaveTextContent('System');
  });

  it('explicit Light and Dark do not react to a live OS change', () => {
    const changeSystemTheme = installMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeSwitch lang="en" />);
    expect(isSun(triggerIconHtml())).toBe(true);

    act(() => changeSystemTheme(true));

    expect(isSun(triggerIconHtml())).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('shows an effective-appearance hint on the System option in both languages', () => {
    installMatchMedia(true);
    render(<ThemeSwitch lang="ar" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'المظهر' }));
    const systemOption = screen.getByRole('option', { name: /حسب النظام/ });
    expect(systemOption.querySelector('.wj-select-option-hint')).toHaveTextContent('داكن');
  });
});
