// Test-only helper: loads the ACTUAL, unmodified scoreDestination /
// rankDestinations / buildWhyText functions live out of ../../../wejhaty.html
// by evaluating that same pre-"STATE + ROUTER" slice used by
// scripts/extract-source.mjs in a Node vm sandbox. This lets the parity
// tests compare the ported TypeScript engine against the real original
// source on every run, rather than against a hand-copied reference.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface OriginalEngine {
  scoreDestination: (dest: unknown, purposeId: string, answers: unknown) => {
    score: number;
    reasons: { id: string; weight: number; fit: number }[];
  };
  rankDestinations: (
    purposeId: string,
    answers: unknown,
  ) => { dest: unknown; score: number; reasons: { id: string; weight: number; fit: number }[] }[];
  buildWhyText: (
    lang: 'ar' | 'en',
    purposeId: string,
    reasons: { id: string; weight: number; fit: number }[],
    dest: unknown,
  ) => string;
  DESTINATIONS: unknown[];
  QUESTION_BANKS: Record<string, unknown[]>;
  PURPOSES: { id: string; pScoreKey: string | null }[];
}

export function loadOriginalEngine(): OriginalEngine {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(dirname, '../../../..');
  const htmlPath = path.join(repoRoot, 'wejhaty.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const scriptStart = html.indexOf('<script>') + '<script>'.length;
  const scriptEnd = html.indexOf('</script>', scriptStart);
  // Git may materialize the historical HTML with CRLF on Windows. Normalize
  // only the test fixture text so the source marker remains platform-neutral.
  const fullScript = html.slice(scriptStart, scriptEnd).replace(/\r\n/g, '\n');

  const cutMarker =
    '/* =========================================================================\n   STATE + ROUTER';
  const cutIndex = fullScript.indexOf(cutMarker);
  if (cutIndex === -1) {
    throw new Error('cut marker not found — wejhaty.html structure changed since migration');
  }
  const dataScript = fullScript.slice(0, cutIndex);
  const varScript = dataScript.replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var');

  const sandbox: Record<string, unknown> = {};
  vm.createContext(sandbox);
  vm.runInContext(varScript, sandbox, { filename: 'wejhaty-original-engine.js' });

  return sandbox as unknown as OriginalEngine;
}
