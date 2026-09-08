// Inline feather-style icon path data, ported verbatim from the ICON map in
// wejhaty.html. Consumed by components/Icon.tsx.
import iconsJson from './generated/icons.json';

export const ICON: Record<string, string> = iconsJson as Record<string, string>;
