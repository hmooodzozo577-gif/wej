// Decides whether a regenerated data snapshot really changed.
//
// The generators stamp every run with `snapshotUpdatedAt`, so a byte
// comparison always says "changed" and the data workflows opened a pull
// request every month even when not one value moved. This compares the
// committed snapshot with the regenerated one after dropping that stamp.
//
// CLI (from app/): node scripts/lib/snapshotChanged.mjs <path>
// prints `changed=true` or `changed=false` for $GITHUB_OUTPUT.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const VOLATILE_KEYS = ['snapshotUpdatedAt'];

function comparable(text) {
  const value = JSON.parse(text);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of VOLATILE_KEYS) delete value[key];
  }
  return JSON.stringify(value);
}

/** True when the two snapshot texts differ in anything but the run stamp.
 *  A missing or unreadable committed snapshot counts as a change. */
export function snapshotDataChanged(committedText, regeneratedText) {
  if (committedText == null) return true;
  try {
    return comparable(committedText) !== comparable(regeneratedText);
  } catch {
    return true;
  }
}

function committedVersion(path) {
  try {
    return execFileSync('git', ['show', `HEAD:./${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/lib/snapshotChanged.mjs <path>');
    process.exit(2);
  }
  const changed = snapshotDataChanged(committedVersion(path), readFileSync(path, 'utf8'));
  console.log(`changed=${changed}`);
}
