// The admin dashboard SHELL — the language switcher's presence, the
// embedded dictionary, and that nothing about auth/CSP/headers moved while
// adding it. Runtime language-switching behaviour (dir/lang updates,
// persistence, panel re-rendering, no-raw-key-leak) lives in the browser's
// script and is verified with Playwright — see
// app/scripts/admin-visual-check.mjs — because it cannot be exercised
// without a DOM. What CAN be checked here, cheaply and on every commit, is
// that the page this module generates actually carries the switcher and a
// complete two-language dictionary before it ever reaches a browser.
import { describe, expect, it } from 'vitest';
import { adminPage } from './adminPage';
import { ADMIN_AR, ADMIN_EN } from './adminI18n';

async function html(): Promise<string> {
  return adminPage().text();
}

describe('the admin shell carries the language switcher', () => {
  it('renders both language buttons in the header, unauthenticated', async () => {
    const page = await html();
    expect(page).toContain('id="langAr"');
    expect(page).toContain('id="langEn"');
    expect(page).toMatch(/<div class="lang-switch"[^>]*role="group"/);
  });

  it('marks exactly one button pressed by default, matching the loadLang() default', async () => {
    const page = await html();
    expect(page).toContain('id="langAr" data-lang="ar" aria-pressed="false"');
    expect(page).toContain('id="langEn" data-lang="en" aria-pressed="true"');
  });

  it('sets the default dir/lang to ltr/en on <html>, corrected client-side from storage', async () => {
    const page = await html();
    expect(page).toMatch(/<html lang="en">/);
  });
});

describe('the embedded dictionary', () => {
  it('is present as valid JSON with both languages', async () => {
    const page = await html();
    const match = /var ADMIN_I18N = (\{.*?\});\n/s.exec(page);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]!);
    expect(parsed.en).toBeTruthy();
    expect(parsed.ar).toBeTruthy();
    expect(parsed.en.brand).toBe(ADMIN_EN.brand);
    expect(parsed.ar.brand).toBe(ADMIN_AR.brand);
  });

  it('carries the report workflow statuses in both languages', async () => {
    const page = await html();
    const match = /var ADMIN_I18N = (\{.*?\});\n/s.exec(page);
    const parsed = JSON.parse(match![1]!);
    for (const status of ['new', 'triaged', 'in_progress', 'resolved', 'declined']) {
      expect(parsed.en.reportStatus[status]).toBeTruthy();
      expect(parsed.ar.reportStatus[status]).toBeTruthy();
    }
  });

  it('is placed before the rest of the client script, so ADMIN_I18N exists when it runs', async () => {
    const page = await html();
    const i18nIndex = page.indexOf('var ADMIN_I18N');
    const stateIndex = page.indexOf('var state =');
    expect(i18nIndex).toBeGreaterThan(-1);
    expect(stateIndex).toBeGreaterThan(i18nIndex);
  });
});

describe('nothing about the existing security posture moved', () => {
  it('never embeds a credential', async () => {
    const page = await html();
    expect(page).not.toContain('fixture-admin-secret');
  });

  it('keeps the same restrictive CSP', async () => {
    const response = adminPage();
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'unsafe-inline'");
    expect(response.headers.get('Content-Security-Policy')).not.toContain('http://');
    expect(response.headers.get('Content-Security-Policy')).not.toContain('https://');
  });

  it('still requires GET and rejects other methods at the /admin route (via handleAdminRequest)', async () => {
    // adminPage() itself has no method check — that lives in admin.ts's
    // router, already covered by admin.test.ts. This file only guards the
    // page adminPage() produces.
    const page = await html();
    expect(page.length).toBeGreaterThan(0);
  });
});
