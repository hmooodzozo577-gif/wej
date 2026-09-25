// v1.1 — a local static server that answers like GitHub Pages, for QA of
// a build without deploying it:
//   - /wej/destination/japan/   -> destination/japan/index.html (200)
//   - /wej/destination/japan    -> 301 to the trailing-slash form
//   - anything missing          -> 404.html with status 404
//
//   node scripts/serve-pages.mjs [dist] [port] [base]   (defaults: dist 4175 /wej/)
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const dist = process.argv[2] ?? 'dist';
const port = Number(process.argv[3] ?? 4175);
const base = process.argv[4] ?? '/wej/';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

function send(res, status, file) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const notFound = () => send(res, 404, join(dist, '404.html'));
  if (!url.pathname.startsWith(base)) return notFound();
  const relativePath = normalize(decodeURIComponent(url.pathname.slice(base.length))).replace(/^([/\\])+/, '');
  if (relativePath.startsWith('..')) return notFound();
  const target = join(dist, relativePath);
  if (existsSync(target) && statSync(target).isDirectory()) {
    if (!url.pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    const index = join(target, 'index.html');
    return existsSync(index) ? send(res, 200, index) : notFound();
  }
  return existsSync(target) ? send(res, 200, target) : notFound();
}).listen(port, () => console.log(`serving ${dist} at http://localhost:${port}${base}`));
