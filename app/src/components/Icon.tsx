// Ports icon() from wejhaty.html: inline feather-style icons built from the
// same path data (data/icons.ts), aria-hidden by default (decorative, always
// paired with visible text in this app, matching the original).
import { ICON } from '../data/icons';

export function Icon({
  name,
  size = 22,
  stroke = 2,
}: {
  name: keyof typeof ICON;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICON[name] }}
    />
  );
}
