// The icons the site serves are the approved files from the TILQAA logo
// package (brand/tilqaa-v2/favicon), byte for byte, under the paths the
// pages and the manifest already use.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { identityTags, webManifest, type SiteInfo } from '../seo/document';

const APP = resolve(__dirname, '../..');
const PAGES: SiteInfo = { origin: 'https://hmooodzozo577-gif.github.io', basePath: '/wej/', url: 'https://hmooodzozo577-gif.github.io/wej/' };
const ROOT: SiteInfo = { origin: 'https://tilqaa.pages.dev', basePath: '/', url: 'https://tilqaa.pages.dev/' };

const SERVED_FROM_MASTER: Record<string, string> = {
  'public/favicon.ico': 'favicon/favicon.ico',
  'public/icons/icon.svg': 'favicon/favicon.svg',
  'public/icons/apple-touch-icon.png': 'favicon/apple-touch-icon.png',
  'public/icons/icon-192.png': 'favicon/favicon-192.png',
  'public/icons/icon-512.png': 'favicon/app-icon-512.png',
  'public/icons/icon-maskable-512.png': 'favicon/app-icon-maskable-512.png',
};

describe('brand icons', () => {
  it.each(Object.entries(SERVED_FROM_MASTER))('%s is the approved %s', (served, source) => {
    expect(readFileSync(resolve(APP, served)).equals(readFileSync(resolve(APP, 'brand/tilqaa-v2', source)))).toBe(true);
  });

  it.each([PAGES, ROOT])('links the icons under the deployment base ($basePath)', (site) => {
    const tags = identityTags(site);
    expect(tags).toContain(`<link rel="icon" href="${site.basePath}favicon.ico" sizes="16x16 32x32 48x48" />`);
    expect(tags).toContain(`<link rel="icon" href="${site.basePath}icons/icon.svg" type="image/svg+xml" />`);
    expect(tags).toContain(`<link rel="apple-touch-icon" href="${site.basePath}icons/apple-touch-icon.png" />`);
    const manifest = JSON.parse(webManifest(site)) as { icons: { src: string }[]; start_url: string };
    expect(manifest.start_url).toBe(site.basePath);
    expect(manifest.icons.every((icon) => icon.src.startsWith(`${site.basePath}icons/`))).toBe(true);
  });
});
