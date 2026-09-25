// Inline feather-style icon path data, ported verbatim from the ICON map in
// wejhaty.html. Consumed by components/Icon.tsx.
import iconsJson from './generated/icons.json';

// v1.1 — Favorites, Share and Compare glyphs, in the same 24-unit
// stroke style. Build-time constants, never user input.
const V11_ICONS: Record<string, string> = {
  heart: '<path d="M12 20s-7.5-4.6-7.5-10a4.3 4.3 0 0 1 7.5-2.9A4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
  heartFilled: '<path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10a4.3 4.3 0 0 1 7.5-2.9A4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>',
  columns: '<rect x="3.5" y="4" width="7" height="16" rx="1.5"/><rect x="13.5" y="4" width="7" height="16" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
};

export const ICON: Record<string, string> = { ...(iconsJson as Record<string, string>), ...V11_ICONS };
