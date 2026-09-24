// Phase 21 — a LOCAL, synthetic dataset for Admin QA. Nothing here touches
// production: it writes a throwaway wrangler config whose D1 binding points
// at a local SQLite file (wrangler --local), a .dev.vars with a random admin
// token, and seed.sql with deterministic synthetic sessions, events, ratings,
// reports and city-description rows shaped exactly like the app sends them.
//
//   cd worker
//   node scripts/admin-qa-seed.mjs /tmp/wejhaty-admin-qa         # prints the token
//   Q=/tmp/wejhaty-admin-qa
//   npx wrangler d1 migrations apply PRODUCT_DB --local --config $Q/wrangler.qa.toml --persist-to $Q/state
//   npx wrangler d1 execute PRODUCT_DB --local --file $Q/seed.sql --config $Q/wrangler.qa.toml --persist-to $Q/state -y
//   npx wrangler dev --local --config $Q/wrangler.qa.toml --persist-to $Q/state --port 8799 --ip 127.0.0.1
// then, from app/:
//   ADMIN_QA_URL=http://127.0.0.1:8799 ADMIN_QA_TOKEN=<token> node scripts/admin-visual-check.mjs
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(process.argv[2] ?? '/tmp/wejhaty-admin-qa');
const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(out, { recursive: true });

// Deterministic: the same seed gives the same dataset, so two QA runs compare.
let state = 21;
const random = () => {
  state = (state + 0x6d2b79f5) | 0;
  let value = Math.imul(state ^ (state >>> 15), 1 | state);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[Math.floor(random() * list.length)];
const sample = (list, n) => [...list].sort(() => random() - 0.5).slice(0, n);
const weighted = (values, weights) => {
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < values.length; i += 1) { roll -= weights[i]; if (roll <= 0) return values[i]; }
  return values[values.length - 1];
};
const sql = (value) => (value === null || value === undefined ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`);
const iso = (ms) => new Date(ms).toISOString();

const catalog = JSON.parse(readFileSync(join(workerDir, 'src/generated/adminCatalog.json'), 'utf8'));
const COUNTRIES = ['JP', 'FR', 'IT', 'ES', 'TR', 'AE', 'GB', 'CH', 'PT', 'MY', 'ID', 'TH', 'EG', 'MA', 'GE', 'KR', 'SG', 'CA', 'US', 'DE', 'NO', 'MV', 'GR', 'AT', 'BT', 'LV'];
const PURPOSES = ['tourism', 'tourism', 'tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];
const now = Date.now();
const lines = [];

for (let i = 0; i < 260; i += 1) {
  const session = randomUUID();
  // Three sessions active minutes ago, so "still answering" has rows.
  const start = i < 3 ? now - int(3, 12) * 60_000 : now - int(0, 13) * 86_400_000 - int(0, 1439) * 60_000;
  let clock = start;
  const events = [];
  const event = (name, properties, path = '/', country = null) => {
    clock += int(3, 40) * 1000;
    events.push([randomUUID(), session, iso(clock), name, path, country, JSON.stringify(properties)]);
  };
  const theme = pick(['light', 'light', 'dark']);
  event('page_view', { theme });
  event('page_performance', { ttfbMs: int(80, 900), domReadyMs: int(600, 3200), loadMs: int(900, 5200) });
  if (random() < 0.35) {
    event('location_permission', { outcome: 'requesting' });
    const outcome = pick(['ok', 'ok', 'ok', 'denied', 'timeout', 'unavailable']);
    const stages = [{ stage: 1, highAccuracy: false, timeoutMs: 8000, durationMs: int(40, 8000), outcome }];
    if (outcome === 'timeout' || (outcome === 'ok' && random() < 0.3)) {
      stages.push({ stage: 2, highAccuracy: true, timeoutMs: 15000, durationMs: int(900, 15000), outcome: outcome === 'ok' ? 'ok' : 'timeout' });
    }
    event('location_request_outcome', { outcome, totalMs: stages.reduce((sum, stage) => sum + stage.durationMs, 0), stages });
    event('location_permission', { outcome: outcome === 'ok' ? 'granted' : outcome });
  }
  if (random() < 0.7) {
    const purpose = pick(PURPOSES);
    event('page_view', { theme }, '/purpose');
    event('quiz_started', { purpose }, '/purpose');
    const ids = catalog.questions[purpose].filter((question) => !['proximity', 'landBorder'].includes(question.kind)).map((question) => question.id);
    const order = [...ids.slice(0, 3), ...sample(ids.slice(3), ids.length - 3)];
    if (random() < 0.4) order.splice(int(1, 4), 0, `${purpose}-proximity`);
    const stopAt = i < 3 ? 2 : weighted([0, 1, 2, 3, 4, 5, 6, 8, order.length], [4, 3, 6, 5, 4, 9, 3, 2, 40]);
    order.slice(0, stopAt).forEach((questionId, index) => {
      event('quiz_answer', { purpose, questionId, value: int(1, 3), questionNumber: index + 1 }, `/quiz/${purpose}`);
      if (index === 4 && stopAt > 5) event('quiz_checkpoint_choice', { choice: 'continue', answerCount: 5 }, `/quiz/${purpose}`);
      if (index === 4 && stopAt === 5 && random() < 0.8) event('quiz_checkpoint_choice', { choice: 'results', answerCount: 5 }, `/quiz/${purpose}`);
    });
    if (stopAt >= 5 && i >= 3) {
      const top = sample(COUNTRIES, 5);
      event('quiz_results_generated', { purpose, answerCount: stopAt, results: top.map((countryCode) => ({ countryCode, score: int(55, 95) })) }, `/quiz/${purpose}`);
      event('page_view', { theme }, '/results');
      if (random() < 0.5) event('destination_opened', { source: 'results' }, '/results', top[0]);
      if (random() < 0.15) {
        // "Edit my preferences": answers again, completes again, no new quiz_started.
        order.slice(0, 5).forEach((questionId, index) => event('quiz_answer', { purpose, questionId, value: int(1, 3), questionNumber: index + 1 }, `/quiz/${purpose}`));
        event('quiz_results_generated', { purpose, answerCount: 5, results: sample(COUNTRIES, 5).map((countryCode) => ({ countryCode, score: int(55, 95) })) }, `/quiz/${purpose}`);
      }
    }
    if (random() < 0.08) event('quiz_started', { purpose: pick(['work', 'education']) }, '/purpose');
  }
  if (random() < 0.45) {
    event('page_view', { theme }, '/explore');
    for (let changes = int(0, 3); changes > 0; changes -= 1) {
      const filter = pick(['sort', 'region', 'cost', 'purpose']);
      const value = {
        sort: pick(['default', 'name-asc', 'cost-asc', 'nearest', 'farthest', 'personal-desc', 'area-desc']),
        region: pick(['Asia', 'Europe', 'MiddleEast', 'Africa', 'all']),
        cost: pick(['1', '2', '3', '4', 'all']),
        purpose: pick(['tourism', 'work', 'all']),
      }[filter];
      event('explore_filter_changed', { filter, value }, '/explore');
    }
    if (random() < 0.4) event('explore_search', { used: random() < 0.6, length: int(0, 9) }, '/explore');
    if (random() < 0.1) event('explore_filters_reset', {}, '/explore');
    if (random() < 0.25) {
      event('surprise_spin', { candidateCount: 194 }, '/explore');
      const landed = pick(COUNTRIES);
      event('surprise_result', { countryCode: landed }, '/explore', landed);
      if (random() < 0.6) event('destination_opened', { source: 'surprise' }, '/explore', landed);
    }
    if (random() < 0.5) event('destination_opened', { source: 'explore' }, '/explore', pick(COUNTRIES));
  }
  if (random() < 0.04) event('client_error', { kind: pick(['TypeError', 'UnhandledRejection', 'ReferenceError']), script: pick(['index.js', 'Explore.js', null]), line: int(1, 900) });

  const locale = pick(['ar', 'ar', 'ar', 'en']);
  const last = events[events.length - 1][2];
  lines.push(`INSERT INTO sessions VALUES (${[session, iso(start), last, locale, pick(['mobile', 'mobile', 'mobile', 'tablet', 'desktop', 'desktop']), pick(['Chrome', 'Chrome', 'Safari', 'Safari', 'Edge', 'Firefox', 'Other']), pick([null, null, 'https://www.google.com', 'https://t.co']), pick(['SA', 'SA', 'SA', 'AE', 'KW', 'EG', 'US', 'GB', 'JO', 'QA'])].map(sql).join(',')});`);
  for (const row of events) lines.push(`INSERT INTO events (id,session_id,occurred_at,name,path,country_code,properties_json) VALUES (${row.map(sql).join(',')});`);
  if (random() < 0.22) {
    const kind = pick(['results', 'destination']);
    const comment = pick([null, null, locale === 'ar' ? pick(['النتائج مناسبة جدًا لميزانيتي', 'الصور لا تطابق المدينة', 'أحببت فكرة الاستبيان']) : pick(['Great picks for a family trip', 'Too expensive for my budget'])]);
    const context = kind === 'results' ? JSON.stringify(sample(COUNTRIES, 5).map((countryCode) => ({ countryCode, score: int(55, 95) }))) : '[]';
    lines.push(`INSERT INTO ratings (id,session_id,created_at,overall_score,reasons_json,country_votes_json,result_context_json,kind,comment,country_code,origin) VALUES (${[randomUUID(), session, last, weighted([1, 2, 3, 4, 5], [1, 2, 3, 5, 6]), '[]', '[]', context, kind, comment, kind === 'destination' ? pick(COUNTRIES) : null, kind === 'destination' ? pick(['results', 'explore', 'surprise', 'direct']) : null].map(sql).join(',')});`);
  }
  if (random() < 0.08) {
    lines.push(`INSERT INTO feedback (id,reference_id,session_id,created_at,type,message,email,country_code,path,locale,device_json,screenshot_key,status) VALUES (${[randomUUID(), `WJ-QA${String(i).padStart(3, '0')}`, session, last, pick(['wrong_info', 'image', 'bug', 'suggestion', 'results', 'translation', 'other']), pick(['صورة المدينة خاطئة في صفحة اليابان', 'The currency shown for Georgia looks wrong', 'Button overlaps the text on my phone']), null, pick([null, ...COUNTRIES]), '/', locale, '{}', pick([null, `screenshots/qa-${i}.png`]), pick(['new', 'new', 'triaged', 'in_progress', 'resolved', 'declined'])].map(sql).join(',')});`);
  }
}
for (const country of COUNTRIES) {
  for (const lang of ['ar', 'en']) {
    lines.push(`INSERT INTO city_descriptions VALUES (${[`${country}:capital:${lang}`, country, 'Capital', lang, weighted(['ok', 'no_article', 'ambiguous', 'wrong_place', 'too_short', 'unavailable'], [12, 3, 2, 2, 1, 1]), null, null, null, null, iso(now)].map(sql).join(',')});`);
  }
}

const token = randomBytes(18).toString('hex');
writeFileSync(join(out, 'seed.sql'), `${lines.join('\n')}\n`);
writeFileSync(join(out, '.dev.vars'), `ADMIN_TOKEN=${token}\n`);
writeFileSync(join(out, 'wrangler.qa.toml'), `# Local Admin QA only — a local D1 file, never a Cloudflare database.
name = "wejhaty-admin-qa"
main = "${join(workerDir, 'src/index.ts')}"
compatibility_date = "2026-09-01"
[[d1_databases]]
binding = "PRODUCT_DB"
database_name = "wejhaty-admin-qa"
database_id = "00000000-0000-0000-0000-000000000000"
migrations_dir = "${join(workerDir, 'migrations')}"
`);
console.log(`${lines.length} rows written to ${out}/seed.sql`);
console.log(`ADMIN_QA_TOKEN=${token}`);
