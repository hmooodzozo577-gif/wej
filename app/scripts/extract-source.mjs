// ONE-TIME extraction utility (not shipped, not imported by the app).
// Pulls the exact data structures out of ../wejhaty.html by evaluating the
// relevant slice of its own <script> in a Node vm sandbox, then writes them
// out as JSON so the TypeScript data modules can import them verbatim —
// this guarantees byte-for-byte fidelity for the 30x47 destination table
// and the 119KB embedded flag SVG blob, instead of risking a manual
// transcription error.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const htmlPath = path.join(repoRoot, 'wejhaty.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.indexOf('</script>', scriptStart);
const fullScript = html.slice(scriptStart, scriptEnd);

// Safe cut point: everything up through the recommendation engine
// (buildWhyText) is pure data/function *definitions* with zero top-level
// DOM access, so it can run headless in plain Node. Everything after
// "STATE + ROUTER" touches document.getElementById at module scope.
const cutMarker = '/* =========================================================================\n   STATE + ROUTER';
const cutIndex = fullScript.indexOf(cutMarker);
if (cutIndex === -1) throw new Error('cut marker not found — wejhaty.html structure changed');
const dataScript = fullScript.slice(0, cutIndex);

// vm sandbox objects only pick up `var`-declared top-level bindings (const/let
// create a separate lexical environment not reflected on the sandbox object),
// so rewrite top-level const/let to var purely for this extraction run.
const varScript = dataScript.replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(varScript, sandbox, { filename: 'wejhaty-data-slice.js' });

const {
  I18N, ICON, DESTINATIONS, FLAG_SVG_RAW, ISO_CODES,
  QUESTION_BANKS, PURPOSES, CLIMATE_COMPAT, REASON_LABELS,
} = sandbox;

const counts = {
  destinations: DESTINATIONS.length,
  flags: Object.keys(FLAG_SVG_RAW).length,
  purposes: PURPOSES.length,
  questionBankKeys: Object.keys(QUESTION_BANKS).length,
  i18nLangs: Object.keys(I18N).length,
};
console.log('Extracted counts:', JSON.stringify(counts, null, 2));

const outDir = path.join(__dirname, '../src/data/generated');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, data) =>
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data, null, 2) + '\n', 'utf8');

write('destinations.json', DESTINATIONS);
write('flags.json', FLAG_SVG_RAW);
write('isoCodes.json', ISO_CODES);
write('questionBanks.json', QUESTION_BANKS);
write('purposes.json', PURPOSES);
write('climateCompat.json', CLIMATE_COMPAT);
write('reasonLabels.json', REASON_LABELS);
write('icons.json', ICON);
write('i18n.ar.json', I18N.ar);
write('i18n.en.json', I18N.en);

// Also extract the exact <style> block verbatim, for Phase 7.
const styleStart = html.indexOf('<style>') + '<style>'.length;
const styleEnd = html.indexOf('</style>', styleStart);
const css = html.slice(styleStart, styleEnd);
fs.mkdirSync(path.join(__dirname, '../src/styles'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../src/styles/wejhaty.generated.css'), css, 'utf8');

console.log('Wrote generated data to', outDir);
console.log('Wrote generated CSS, length:', css.length);
