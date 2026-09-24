// Phase 21 — the metric dictionary is the single definition of every admin
// number. These tests keep it complete in both languages, keep the page from
// referencing a metric or a label that does not exist, and keep the
// human-readable reference (ADMIN_METRICS.md at the repository root) generated
// from it rather than written by hand:
//   UPDATE_ADMIN_METRICS_DOC=1 npx vitest run src/adminMetrics.test.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADMIN_AR, ADMIN_EN, type AdminDictionary } from './adminI18n';
import { ADMIN_METRICS, ADMIN_METRIC_IDS, STOP_IDLE_MINUTES, type Bilingual } from './adminMetrics';
import { adminPage } from './adminPage';

const ARABIC = /[\u0600-\u06FF]/;
const DOC = resolve(process.cwd(), '../ADMIN_METRICS.md');

function lookup(dictionary: AdminDictionary, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dictionary);
}

describe('the metric dictionary', () => {
  it('has unique ids', () => {
    expect(ADMIN_METRIC_IDS.size).toBe(ADMIN_METRICS.length);
  });

  it('fills every field in both languages, with Arabic that is Arabic', () => {
    for (const metric of ADMIN_METRICS) {
      const pairs: [string, Bilingual | null][] = [
        ['label', metric.label], ['definition', metric.definition], ['numerator', metric.numerator],
        ['denominator', metric.denominator], ['interpretation', metric.interpretation], ['limitation', metric.limitation],
      ];
      for (const [field, pair] of pairs) {
        if (pair === null) continue;
        expect(pair.en.trim().length, `${metric.id}.${field}.en`).toBeGreaterThan(0);
        expect(pair.ar.trim().length, `${metric.id}.${field}.ar`).toBeGreaterThan(0);
        expect(ARABIC.test(pair.ar), `${metric.id}.${field}.ar`).toBe(true);
        expect(pair.ar, `${metric.id}.${field}`).not.toBe(pair.en);
      }
      expect(metric.source.length, `${metric.id}.source`).toBeGreaterThan(0);
    }
  });

  it('declares a denominator exactly for the ratios and means', () => {
    for (const metric of ADMIN_METRICS) {
      if (metric.aggregation === 'ratio' || metric.aggregation === 'mean') {
        expect(metric.denominator, metric.id).not.toBeNull();
      }
    }
  });

  it('has a label in both dashboard languages for every unit, aggregation and window it uses', () => {
    for (const metric of ADMIN_METRICS) {
      for (const dictionary of [ADMIN_EN, ADMIN_AR]) {
        expect(lookup(dictionary, `units.${metric.unit}`), `${metric.id} unit`).toBeTruthy();
        expect(lookup(dictionary, `aggregations.${metric.aggregation}`), `${metric.id} aggregation`).toBeTruthy();
        expect(lookup(dictionary, `windows.${metric.window}`), `${metric.id} window`).toBeTruthy();
      }
    }
  });

  it('never names a coordinate, an IP or a fingerprint as a source', () => {
    for (const metric of ADMIN_METRICS) {
      expect(metric.source.toLowerCase()).not.toMatch(/\b(lat|lng|latitude|longitude|ip_address|fingerprint)\b/);
    }
  });
});

describe('the dashboard only references what exists', () => {
  it('resolves every literal translation key and metric id in the page script', async () => {
    const page = await adminPage().text();
    const script = page.slice(page.indexOf('var METRICS'));
    const keys = new Set<string>();
    for (const match of script.matchAll(/\b(?:t|formatMessage|showError\([^,]+,)\s*\(?\s*'([a-zA-Z]+(?:\.[a-zA-Z_]+)+)'/g)) keys.add(match[1]!);
    expect(keys.size).toBeGreaterThan(100);
    const missingKeys = [...keys].filter((key) => typeof lookup(ADMIN_EN, key) !== 'string' || typeof lookup(ADMIN_AR, key) !== 'string');
    expect(missingKeys).toEqual([]);

    const metricIds = new Set<string>();
    for (const match of script.matchAll(/kpi\(\w+, '([a-z][\w.]+)'/g)) metricIds.add(match[1]!);
    for (const match of script.matchAll(/(?:definitionBlock\(|, )\[((?:'[\w.]+'(?:, )?)+)\]/g)) {
      for (const id of match[1]!.matchAll(/'(\w+\.[\w.]+)'/g)) metricIds.add(id[1]!);
    }
    expect(metricIds.size).toBeGreaterThan(40);
    expect([...metricIds].filter((id) => !ADMIN_METRIC_IDS.has(id))).toEqual([]);
  });

  it('has a label for every enum group the page renders', async () => {
    const page = await adminPage().text();
    const groups = new Set([...page.matchAll(/enumLabel\('(\w+)'/g)].map((match) => match[1]!));
    expect(groups.size).toBeGreaterThan(5);
    for (const group of groups) {
      expect(lookup(ADMIN_EN, `enums.${group}`), group).toBeTruthy();
      expect(lookup(ADMIN_AR, `enums.${group}`), group).toBeTruthy();
    }
  });

  it('defines every metric the dashboard shows as a headline number', () => {
    // The reverse direction: a dictionary entry nobody renders is dead text.
    // Every id must be used by the page script.
    return adminPage().text().then((page) => {
      const script = page.slice(page.indexOf('var METRICS'));
      const unused = ADMIN_METRICS.map((metric) => metric.id).filter((id) => !script.includes(`'${id}'`));
      expect(unused).toEqual([]);
    });
  });
});

function markdown(): string {
  const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('\n', ' ');
  const lines: string[] = [
    '# Admin metrics reference',
    '',
    '<!-- Generated from worker/src/adminMetrics.ts by worker/src/adminMetrics.test.ts. Do not edit by hand:',
    '     UPDATE_ADMIN_METRICS_DOC=1 npx vitest run src/adminMetrics.test.ts  (from worker/) -->',
    '',
    'Every number on the private `/admin` dashboard is defined once, in `worker/src/adminMetrics.ts`. The dashboard shows',
    'the same definition under “How is this counted?” next to each figure, in Arabic or English. This file is generated',
    'from that dictionary so the page, the SQL (`worker/src/analytics.ts`) and this reference cannot drift apart.',
    '',
    '## Vocabulary',
    '',
    '- **Session** — one anonymous random id kept in the browser’s `sessionStorage`. It lives as long as one tab. A new',
    '  tab, another device or cleared site data is a new session. A session is never a person.',
    '- **Questionnaire action** — a `quiz_started`, `quiz_answer` or `quiz_results_generated` event.',
    `- **Idle** — no event of any kind from the session for ${STOP_IDLE_MINUTES} minutes. A questionnaire session whose`,
    '  latest action is an answer with no results after it is “stopped” once idle and “still answering” before that.',
    '- **Time windows** — event metrics use the event time; session metrics use sessions active at any point in the',
    '  range; ratings and reports use their creation time; the Country Intelligence snapshot and the city-description',
    '  cache ignore the date filter.',
    '- **Retention** — events, ratings and sessions older than 90 days are deleted; reports older than 90 days are',
    '  detached from their session (see `runProductRetention` in `worker/src/product.ts`).',
    '- **Privacy** — no metric reads a coordinate, an IP address or a fingerprint; the only geography is the coarse',
    '  country Cloudflare attaches at the edge.',
    '',
  ];
  const tabs = [...new Set(ADMIN_METRICS.map((metric) => metric.tab))];
  for (const tab of tabs) {
    lines.push(`## ${lookup(ADMIN_EN, `tabs.${tab}`) as string} — ${lookup(ADMIN_AR, `tabs.${tab}`) as string}`, '');
    for (const metric of ADMIN_METRICS.filter((item) => item.tab === tab)) {
      lines.push(`### ${metric.label.en} — ${metric.label.ar}`, '', `\`${metric.id}\``, '');
      lines.push('| Field | English | العربية |', '| --- | --- | --- |');
      const row = (field: string, pair: Bilingual) => lines.push(`| ${field} | ${cell(pair.en)} | ${cell(pair.ar)} |`);
      row('Definition', metric.definition);
      row('Counts', metric.numerator);
      row('Divided by', metric.denominator ?? { en: ADMIN_EN.metricMeta.noDenominator, ar: ADMIN_AR.metricMeta.noDenominator });
      row('Unit', { en: ADMIN_EN.units[metric.unit], ar: ADMIN_AR.units[metric.unit] });
      row('Aggregation', { en: ADMIN_EN.aggregations[metric.aggregation], ar: ADMIN_AR.aggregations[metric.aggregation] });
      row('Time window', { en: ADMIN_EN.windows[metric.window], ar: ADMIN_AR.windows[metric.window] });
      lines.push(`| Source | \`${cell(metric.source)}\` | \`${cell(metric.source)}\` |`);
      row('How to read it', metric.interpretation);
      row('Limitation', metric.limitation);
      lines.push('');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

describe('ADMIN_METRICS.md', () => {
  it('is generated from the dictionary and up to date', () => {
    const expected = markdown();
    if (process.env.UPDATE_ADMIN_METRICS_DOC === '1') writeFileSync(DOC, expected);
    expect(existsSync(DOC)).toBe(true);
    expect(readFileSync(DOC, 'utf8')).toBe(expected);
  });
});
