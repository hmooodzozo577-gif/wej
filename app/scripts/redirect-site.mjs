// Runs after every `npm run build` (npm's postbuild). Does nothing unless
// WEJHATY_REDIRECT_TO is set; then it replaces dist/ with a build that only
// redirects to that origin (see lib/redirectSite.mjs). Set it for the hosts
// that are not the primary site: the GitHub Pages deploy and the old
// Cloudflare Pages project (wej). Never for the primary project (tilqaa):
// redirecting a build to its own origin fails the build.
//
//   WEJHATY_REDIRECT_TO=https://tilqaa.pages.dev npm run build
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { basePathFromManifest, redirectSiteFiles } from './lib/redirectSite.mjs';

const target = (process.env.WEJHATY_REDIRECT_TO ?? '').trim();
if (!target) process.exit(0);

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', process.argv[2] ?? 'dist');

function htmlDocuments(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlDocuments(path);
    return entry.name.endsWith('.html') ? [relative(dist, path).split('\\').join('/')] : [];
  });
}

const basePath = basePathFromManifest(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
const deployUrl = (process.env.CF_PAGES_URL ?? '').trim() || undefined;
const documents = htmlDocuments(dist);
const files = redirectSiteFiles({ target, basePath, deployUrl, documents });

rmSync(dist, { recursive: true, force: true });
for (const [path, content] of files) {
  const file = join(dist, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
console.log(`Redirect build: ${files.size} files in ${relative(process.cwd(), dist) || dist}, every page -> ${target}`);
