// v1.1 — hourly uptime check (see lib/uptime.mjs). Exits non-zero when any
// check fails, so the scheduled workflow run turns red and GitHub notifies.
//   node scripts/uptime-check.mjs [site] [worker]
import { DEFAULT_SITE, DEFAULT_WORKER, runUptime } from './lib/uptime.mjs';

const results = await runUptime({ site: process.argv[2] || DEFAULT_SITE, worker: process.argv[3] || DEFAULT_WORKER });
for (const result of results) console.log(`${result.ok ? 'UP  ' : 'DOWN'} ${result.name} — ${result.detail}`);
const down = results.filter((result) => !result.ok);
console.log(down.length ? `${down.length} of ${results.length} checks failed.` : `All ${results.length} checks passed.`);
process.exit(down.length ? 1 : 0);
