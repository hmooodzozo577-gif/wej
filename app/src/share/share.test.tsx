import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { destinationSharePayload, shareOrCopy } from './share';
import { ShareButton } from './ShareButton';

const japan = WORLD_CATALOG.find((entry) => entry.id === 'japan')!;

function fakeNavigator(parts: Partial<Navigator>): Navigator {
  return parts as Navigator;
}

describe('share payload', () => {
  it('links to the public canonical destination page only', () => {
    const payload = destinationSharePayload(japan, 'en');
    expect(payload.url).toMatch(/^https:\/\/hmooodzozo577-gif\.github\.io\/.*destination\/japan\/$/);
    expect(payload.url).not.toContain('?');
    expect(payload.url).not.toContain('#');
    expect(payload.text).toBe('Japan on Wejhaty');
  });

  it('mentions the Personal Match only when the sender shares it, and never in the URL', () => {
    const payload = destinationSharePayload(japan, 'ar', 87);
    expect(payload.text).toBe('اليابان — توافقي معها 87% على وجهتي');
    expect(payload.url).not.toMatch(/87|match|profile|answer|passport|lat|lng|halal|religion|language/i);
  });
});

describe('shareOrCopy', () => {
  const payload = destinationSharePayload(japan, 'en');

  it('uses the native share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareOrCopy(payload, fakeNavigator({ share }))).toBe('shared');
    expect(share).toHaveBeenCalledWith(payload);
  });

  it('treats a dismissed share sheet as cancelled, not as an error', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    expect(await shareOrCopy(payload, fakeNavigator({ share }))).toBe('cancelled');
  });

  it('copies the link when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareOrCopy(payload, fakeNavigator({ clipboard: { writeText } as unknown as Clipboard }))).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(payload.url);
  });

  it('falls back to manual copying when the clipboard is blocked too', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    expect(await shareOrCopy(payload, fakeNavigator({ clipboard: { writeText } as unknown as Clipboard }))).toBe('manual');
    expect(await shareOrCopy(payload, fakeNavigator({}))).toBe('manual');
  });
});

describe('ShareButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the link in a read-only field when nothing else works', async () => {
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: undefined });
    render(<ShareButton destination={japan} lang="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const field = await screen.findByRole('textbox', { name: 'Destination link' });
    expect(field).toHaveAttribute('readonly');
    expect((field as HTMLInputElement).value).toMatch(/destination\/japan\/$/);
  });

  it('announces a copied link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: { writeText } });
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: undefined });
    render(<ShareButton destination={japan} lang="ar" />);
    fireEvent.click(screen.getByRole('button', { name: 'مشاركة' }));
    await waitFor(() => expect(document.getElementById('wj-announcer')?.textContent).toBe('نُسخ الرابط.'));
  });
});
