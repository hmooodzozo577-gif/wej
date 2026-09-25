// v1.1 — one polite live region for short confirmations ("Saved to
// favorites", "Link copied"), so a page with many toggles does not carry
// one live region per control.
const REGION_ID = 'wj-announcer';

export function announce(message: string): void {
  if (typeof document === 'undefined') return;
  let region = document.getElementById(REGION_ID);
  if (!region) {
    region = document.createElement('div');
    region.id = REGION_ID;
    region.className = 'visually-hidden';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  // Clearing first makes a repeated message be announced again.
  region.textContent = '';
  const target = region;
  window.setTimeout(() => { target.textContent = message; }, 30);
}
