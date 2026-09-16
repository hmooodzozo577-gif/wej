// The private developer dashboard served at /admin.
//
// It is one self-contained HTML document with no external requests: no CDN,
// no font, no analytics on the analytics tool. That keeps it usable behind
// Cloudflare Access, keeps its CSP tight, and means it cannot leak the
// operator's browsing to anyone.
//
// It renders nothing until it has data, and it holds no secret: the token
// the operator types is kept in memory for the page's lifetime and sent as a
// bearer header. Under Cloudflare Access there is no token at all — the
// browser already carries the Access cookie, so the page just loads.
//
// Design intent: a decision tool, not a showcase. Numbers first, one chart
// per question that a chart genuinely answers better than a number, tables
// for everything else, and a report queue an operator can actually work.
//
// LANGUAGE — Arabic / English, independent of the public site's language.
// The dictionary lives in adminI18n.ts (see its own header comment for why
// this cannot literally import the public app's i18n module: different
// runtime, no build step). This module's only job is to serialize that
// dictionary into the page once, as `ADMIN_I18N`, so the client-side script
// below has a single source of truth and never hand-duplicates a string.
// The public site does not persist a language choice to localStorage at
// all (it defaults to Arabic every session — see PROJECT_STATE.md); the
// admin's own choice is stored under its own key, `wejhaty.admin.lang`, so
// there is nothing to conflict with and nothing shared to accidentally
// break by adding this.
import { ADMIN_I18N } from './adminI18n';

const STYLES = `
:root{
  color-scheme:dark;
  --bg:#0d131c; --panel:#141d29; --panel-2:#1b2635; --line:#2a3849; --line-2:#3a4c63;
  --ink:#eef3f9; --muted:#9aa9bb; --gold:#d9a85c; --teal:#48b3a5; --danger:#f08a7a; --ok:#6fcf97;
  --radius:14px;
  font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-size:15px;line-height:1.5}
a{color:var(--gold)}
.wrap{max-width:1360px;margin:0 auto;padding:26px 20px 80px}
header.top{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px}
h1{margin:0;font-size:1.5rem;letter-spacing:-0.01em}
.sub{color:var(--muted);font-size:0.86rem;margin:0 0 20px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;margin:0 0 18px}
.panel h2{margin:0 0 4px;font-size:1.02rem}
.panel .hint{margin:0 0 14px;color:var(--muted);font-size:0.8rem}
label{display:block;font-size:0.74rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-bottom:5px}
input,select,textarea,button{font:inherit;color:var(--ink);background:var(--panel-2);border:1px solid var(--line-2);border-radius:9px;padding:8px 11px}
input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
button{cursor:pointer}
button.primary{background:var(--gold);color:#1a1205;border-color:var(--gold);font-weight:700}
button.ghost{background:transparent}
button.small{padding:5px 9px;font-size:0.82rem}
.filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;align-items:end}
/* A date input carries a wide intrinsic size in Chrome and pushes the grid
   past the viewport at 390px unless both the track and the control are told
   they may shrink. Found by measuring, not by guessing. */
.filters>div{min-width:0}
.filters input,.filters select{width:100%;min-width:0}
.filters .actions{display:flex;gap:8px;flex-wrap:wrap}
nav.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 18px}
nav.tabs button{background:transparent;border-color:transparent;color:var(--muted);border-radius:100px;padding:7px 14px}
nav.tabs button[aria-current="true"]{background:var(--panel-2);border-color:var(--line-2);color:var(--ink);font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}
.kpi{background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.kpi .label{font-size:0.74rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted)}
.kpi .value{font-size:1.85rem;font-weight:800;margin-top:6px;font-variant-numeric:tabular-nums}
.kpi .note{font-size:0.76rem;color:var(--muted);margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:0.88rem}
th,td{text-align:start;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);font-weight:700}
td.num,th.num{text-align:end;font-variant-numeric:tabular-nums}
.scroll{max-height:420px;overflow:auto}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:18px}
.bar{height:8px;border-radius:100px;background:var(--line);overflow:hidden;min-width:60px}
.bar span{display:block;height:100%;background:var(--teal);border-radius:100px}
.empty{color:var(--muted);font-size:0.86rem;padding:10px 0}
.chip{display:inline-block;padding:2px 9px;border-radius:100px;font-size:0.74rem;font-weight:700;border:1px solid var(--line-2);background:var(--panel-2)}
.chip.new{border-color:var(--gold);color:var(--gold)}
.chip.resolved{border-color:var(--ok);color:var(--ok)}
.chip.declined{border-color:var(--muted);color:var(--muted)}
.chip.in_progress,.chip.triaged{border-color:var(--teal);color:var(--teal)}
.error{color:var(--danger);font-size:0.86rem}
.notice{color:var(--muted);font-size:0.82rem}
dialog{background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:var(--radius);max-width:640px;width:92vw;padding:20px}
dialog::backdrop{background:rgba(5,9,14,0.72)}
dialog .row{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-top:14px}
dialog textarea{width:100%;min-height:80px}
.detail-line{margin:6px 0;font-size:0.88rem}
.detail-line b{color:var(--muted);font-weight:700;font-size:0.76rem;text-transform:uppercase;letter-spacing:0.04em;display:block}
.message{white-space:pre-wrap;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:4px}
.login{max-width:420px}
.top-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
/* The language switcher. A pill of two buttons matching the same shape the
   public site's own .lang-switch uses (border-radius:100px, filled active
   state) — this file cannot literally share that CSS (separate stylesheet,
   separate runtime), so the pattern is re-expressed with the admin's own
   dark-panel tokens instead of duplicating it verbatim. */
.lang-switch{display:flex;align-items:center;gap:0;border:1.5px solid var(--line-2);border-radius:100px;overflow:hidden;flex-shrink:0}
.lang-switch button{border:none;background:transparent;padding:6px 13px;font-weight:700;font-size:0.78rem;letter-spacing:0.02em;color:var(--muted);border-radius:0}
.lang-switch button[aria-pressed="true"]{background:var(--gold);color:#1a1205}
.lang-switch button:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
/* The trend chart draws its own pixel geometry via JS (axis lines, day
   labels at index 0/last). Time still flows left-to-right in both
   languages — a deliberate, documented choice (see lineChart()) rather than
   mirroring the axis — so the SVG is pinned to LTR regardless of the page's
   own direction. Without this, text-anchor start/end on the axis labels
   would flip relative to bidi context and the day labels would swap ends. */
.chart-svg{direction:ltr}
/* Arabic is a cursive, joined script: extra letter-spacing (used above for
   Latin small-caps-style labels) visibly disconnects joined letterforms,
   and text-transform:uppercase is a no-op for Arabic that only changes the
   box the browser reserves for it. Both are reset for RTL. Matches the
   html[dir=rtl] convention already used by the public site's own
   stylesheet (see app/src/styles/wejhaty.generated.css). */
html[dir="rtl"] label,html[dir="rtl"] th,html[dir="rtl"] .kpi .label{letter-spacing:normal;text-transform:none}
@media (max-width:640px){
  .wrap{padding:16px 14px 60px}
  .kpi .value{font-size:1.5rem}
  .lang-switch button{padding:6px 10px;font-size:0.74rem}
}
`;

const SCRIPT = String.raw`
var LANG_STORAGE_KEY = 'wejhaty.admin.lang';

/** Reads the saved admin-dashboard language. Defensive: a blocked or
 *  unavailable localStorage (private browsing, a locked-down embed) must
 *  never break the page — it just means the choice does not persist. */
function loadLang() {
  try {
    var stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch (e) { /* storage unavailable — fall through to the default */ }
  return 'en';
}

function saveLang(lang) {
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* same */ }
}

var state = { token: '', data: null, tab: 'overview', feedback: null, feedbackQuery: { q: '', status: '', type: '' }, lang: loadLang(), errors: {} };
var el = function (id) { return document.getElementById(id); };
var num = function (value) { return value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US'); };
var pct = function (value) { return value === null || value === undefined ? '—' : value + '%'; };

/** Resolves one dot-path (e.g. "overview.sessions") against the current
 *  language, falling back to English, and — the one invariant this whole
 *  feature rests on — NEVER returning the raw key itself. A genuinely
 *  missing translation renders as an empty string, which is a rendering
 *  gap an operator would notice and report; a leaked "overview.sessions"
 *  string would look like a bug in the product to whoever reads it. */
function t(path) {
  var parts = path.split('.');
  var resolve = function (source) {
    var node = source;
    for (var i = 0; i < parts.length; i += 1) {
      if (node && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, parts[i])) node = node[parts[i]];
      else return undefined;
    }
    return typeof node === 'string' ? node : undefined;
  };
  var value = resolve(ADMIN_I18N[state.lang]);
  if (value === undefined) value = resolve(ADMIN_I18N.en);
  return value === undefined ? '' : value;
}

function applyDirLang() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
}

/** Every static-chrome text/placeholder/aria-label the HTML shell marks with
 *  a data-i18n* attribute. Dynamically-built panels (renderOverview and
 *  friends) are NOT covered here — they call t() directly at render time
 *  and simply get re-run by renderBody() on a language change, which is
 *  simpler than tagging generated nodes after the fact. */
function applyStaticTranslations() {
  document.title = t('brand');
  var texts = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < texts.length; i += 1) texts[i].textContent = t(texts[i].getAttribute('data-i18n'));
  var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
  for (var j = 0; j < placeholders.length; j += 1) placeholders[j].setAttribute('placeholder', t(placeholders[j].getAttribute('data-i18n-placeholder')));
  var ariaLabels = document.querySelectorAll('[data-i18n-aria-label]');
  for (var k = 0; k < ariaLabels.length; k += 1) ariaLabels[k].setAttribute('aria-label', t(ariaLabels[k].getAttribute('data-i18n-aria-label')));
}

function updateLangSwitchUI() {
  var arButton = el('langAr'), enButton = el('langEn');
  if (arButton) arButton.setAttribute('aria-pressed', state.lang === 'ar' ? 'true' : 'false');
  if (enButton) enButton.setAttribute('aria-pressed', state.lang === 'en' ? 'true' : 'false');
}

/** Formats one translated error message, substituting any {name} tokens
 *  from params (currently only errors.requestFailed's {status}). */
function formatMessage(key, params) {
  var text = t(key);
  if (params) {
    for (var name in params) {
      if (Object.prototype.hasOwnProperty.call(params, name)) text = text.split('{' + name + '}').join(params[name]);
    }
  }
  return text;
}

/** Paints (or clears) one error slot, and remembers WHICH translation key is
 *  showing there — not just the rendered text — so a language switch can
 *  repaint it correctly instead of leaving yesterday's language on screen
 *  or, worse, clearing a real error the operator still needs to see. */
function showError(id, key, params) {
  state.errors[id] = key ? { key: key, params: params } : null;
  el(id).textContent = key ? formatMessage(key, params) : '';
}

function repaintErrors() {
  for (var id in state.errors) {
    if (Object.prototype.hasOwnProperty.call(state.errors, id) && state.errors[id]) {
      el(id).textContent = formatMessage(state.errors[id].key, state.errors[id].params);
    }
  }
}

/** A fetch()/JSON error carrying the i18n key to show for it, rather than a
 *  fixed English sentence baked in at throw time — so the SAME thrown error
 *  still renders correctly if the language changes before it is caught, and
 *  so it can be repainted on a later language switch via repaintErrors(). */
function apiError(key, params) {
  var error = new Error(formatMessage(key, params));
  error.i18nKey = key;
  error.i18nParams = params;
  return error;
}

/** Switches the dashboard language: persists it, updates dir/lang, and
 *  re-renders every currently-visible piece of text from the SAME cached
 *  data already on screen — no re-fetch, no re-authentication. Switching
 *  language is a presentation change only. */
function setLang(lang) {
  if (lang !== 'ar' && lang !== 'en') return;
  state.lang = lang;
  saveLang(lang);
  applyDirLang();
  updateLangSwitchUI();
  applyStaticTranslations();
  repaintErrors();
  if (state.data && state.data.authenticatedVia) {
    el('authVia').textContent = state.data.authenticatedVia === 'access' ? t('authVia.access') : t('authVia.token');
  }
  renderTabs();
  renderBody();
}

function node(tag, className, text) {
  var element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

/** Same as node(), but for a value this dashboard did not write: a
 *  traveller's free-text message/comment. Found in RTL visual QA — without
 *  this, an English report inherits dir="rtl" from the page and the whole
 *  paragraph right-aligns even though its own text runs left-to-right.
 *  dir="auto" asks the browser to pick per its own first strong character,
 *  which is correct for content whose language is not known in advance
 *  (unlike this dashboard's own UI chrome, which always matches state.lang). */
function freeTextNode(tag, className, text) {
  var element = node(tag, className, text);
  element.setAttribute('dir', 'auto');
  return element;
}

function filters() {
  var params = new URLSearchParams();
  ['from', 'to', 'locale', 'device', 'purpose', 'country', 'minRating', 'maxRating'].forEach(function (key) {
    var field = el('f_' + key);
    if (field && field.value) params.set(key, field.value.trim());
  });
  return params;
}

function api(path, params, options) {
  var url = path + (params && params.toString() ? '?' + params.toString() : '');
  var init = options || {};
  init.headers = init.headers || {};
  if (state.token) init.headers['Authorization'] = 'Bearer ' + state.token;
  return fetch(url, init).then(function (response) {
    if (response.status === 401) throw apiError('errors.unauthorized');
    if (response.status === 503) throw apiError('errors.notConfigured');
    if (!response.ok) throw apiError('errors.requestFailed', { status: response.status });
    return response.json();
  }, function () {
    // fetch() itself rejected — offline, DNS failure, CORS block. Not a
    // response at all, so there is no status to branch on.
    throw apiError('errors.network');
  });
}

function kpi(container, label, value, note) {
  var card = node('div', 'kpi');
  card.append(node('div', 'label', label), node('div', 'value', value));
  if (note) card.append(node('div', 'note', note));
  container.append(card);
}

/** A ranked table with an inline proportion bar — the shape most of this
 *  data actually wants. */
function rankTable(rowsData, columns, valueKey) {
  if (!rowsData || !rowsData.length) return node('p', 'empty', t('common.noData'));
  var max = rowsData.reduce(function (best, row) { return Math.max(best, Number(row[valueKey]) || 0); }, 0) || 1;
  var table = node('table');
  var head = node('tr');
  columns.forEach(function (column) {
    var th = node('th', column.numeric ? 'num' : '', column.label);
    head.append(th);
  });
  head.append(node('th', '', ''));
  var thead = node('thead');
  thead.append(head);
  table.append(thead);
  var body = node('tbody');
  rowsData.forEach(function (row) {
    var tr = node('tr');
    columns.forEach(function (column) {
      var raw = row[column.key];
      var display = column.numeric ? num(raw) : (raw === null || raw === undefined || raw === '' ? '—' : String(raw));
      tr.append(node('td', column.numeric ? 'num' : '', display));
    });
    var cell = node('td');
    var bar = node('div', 'bar');
    var fill = node('span');
    fill.style.width = Math.round(((Number(row[valueKey]) || 0) / max) * 100) + '%';
    bar.append(fill);
    cell.append(bar);
    tr.append(cell);
    body.append(tr);
  });
  table.append(body);
  var wrap = node('div', 'scroll');
  wrap.append(table);
  return wrap;
}

/** A small multi-series line chart. Inline SVG, no library, currentColor so
 *  it inherits the theme. */
function lineChart(series, height) {
  var days = {};
  series.forEach(function (entry) {
    (entry.rows || []).forEach(function (row) { days[row.day] = true; });
  });
  var labels = Object.keys(days).sort();
  if (labels.length < 2) return node('p', 'empty', t('common.notEnoughTrend'));
  var width = 640;
  var h = height || 180;
  var pad = { top: 12, right: 10, bottom: 22, left: 34 };
  var max = 1;
  series.forEach(function (entry) {
    (entry.rows || []).forEach(function (row) { max = Math.max(max, Number(row.value) || 0); });
  });
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chart-svg');
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + h);
  svg.setAttribute('role', 'img');
  svg.setAttribute('width', '100%');
  svg.setAttribute('aria-label', series.map(function (entry) { return entry.label; }).join(', ') + ' by day');
  var x = function (index) { return pad.left + (index / (labels.length - 1)) * (width - pad.left - pad.right); };
  var y = function (value) { return h - pad.bottom - (value / max) * (h - pad.top - pad.bottom); };

  [0, max / 2, max].forEach(function (value) {
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(pad.left)); line.setAttribute('x2', String(width - pad.right));
    line.setAttribute('y1', String(y(value))); line.setAttribute('y2', String(y(value)));
    line.setAttribute('stroke', '#2a3849');
    svg.append(line);
    var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '4'); text.setAttribute('y', String(y(value) + 4));
    text.setAttribute('fill', '#9aa9bb'); text.setAttribute('font-size', '10');
    text.textContent = String(Math.round(value));
    svg.append(text);
  });

  series.forEach(function (entry) {
    var lookup = {};
    (entry.rows || []).forEach(function (row) { lookup[row.day] = Number(row.value) || 0; });
    var path = labels.map(function (day, index) {
      return (index ? 'L' : 'M') + x(index) + ' ' + y(lookup[day] || 0);
    }).join(' ');
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', path);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', entry.color);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linejoin', 'round');
    svg.append(line);
  });

  [0, labels.length - 1].forEach(function (index) {
    var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(x(index)));
    text.setAttribute('y', String(h - 6));
    text.setAttribute('fill', '#9aa9bb');
    text.setAttribute('font-size', '10');
    text.setAttribute('text-anchor', index === 0 ? 'start' : 'end');
    text.textContent = labels[index];
    svg.append(text);
  });

  var box = node('div');
  box.append(svg);
  var legend = node('p', 'notice');
  legend.textContent = series.map(function (entry) { return entry.label; }).join('  ·  ');
  box.append(legend);
  return box;
}

function panel(title, hint, content) {
  var section = node('section', 'panel');
  section.append(node('h2', '', title));
  if (hint) section.append(node('p', 'hint', hint));
  section.append(content);
  return section;
}

function renderOverview(root, data) {
  var overview = data.overview;
  var cards = node('div', 'kpis');
  kpi(cards, t('overview.sessions'), num(overview.sessions));
  kpi(cards, t('overview.pageViews'), num(overview.visits));
  kpi(cards, t('overview.questionnaireStarts'), num(overview.questionnaireStarts));
  kpi(cards, t('overview.completions'), num(overview.questionnaireCompletions));
  kpi(cards, t('overview.completionRate'), pct(overview.completionRate), t('overview.completionRateNote'));
  kpi(cards, t('overview.resultsViewed'), num(overview.resultsViewed));
  kpi(cards, t('overview.ratings'), num(overview.ratingCount));
  kpi(cards, t('overview.averageRating'), overview.averageRating === null ? t('common.dash') : overview.averageRating, t('overview.averageRatingNote'));
  kpi(cards, t('overview.reports'), num(overview.feedbackCount));
  root.append(panel(t('overview.title'), t('overview.hint'), cards));

  root.append(panel(t('overview.trendTitle'), t('overview.trendHint'), lineChart([
    { label: t('overview.seriesSessions'), rows: data.trend.sessionsPerDay, color: '#d9a85c' },
    { label: t('overview.seriesCompletions'), rows: data.trend.completionsPerDay, color: '#48b3a5' },
    { label: t('overview.seriesRatings'), rows: data.trend.ratingsPerDay, color: '#9aa9bb' },
  ])));
}

function renderFunnel(root, data) {
  var funnel = data.funnel;
  var cards = node('div', 'kpis');
  kpi(cards, t('funnel.avgAnswered'), funnel.averageQuestionsAnswered === null ? t('common.dash') : funnel.averageQuestionsAnswered);
  (funnel.checkpointChoice || []).forEach(function (row) {
    var choiceLabel = row.choice === 'results' ? t('checkpointChoice.results') : row.choice === 'continue' ? t('checkpointChoice.continueChoice') : row.choice;
    kpi(cards, t('funnel.checkpointPrefix') + ': ' + choiceLabel, num(row.count), row.choice === 'results' ? t('funnel.checkpointTookEarly') : t('funnel.checkpointKeptAnswering'));
  });
  root.append(panel(t('funnel.title'), t('funnel.hint'), cards));
  root.append(panel(t('funnel.progressionTitle'), t('funnel.progressionHint'),
    rankTable(funnel.byQuestion, [{ key: 'questionNumber', label: t('funnel.question') }, { key: 'sessions', label: t('funnel.sessions'), numeric: true }], 'sessions')));
  root.append(panel(t('funnel.abandonmentTitle'), t('funnel.abandonmentHint'),
    rankTable(funnel.abandonedAtQuestion, [{ key: 'lastQuestion', label: t('funnel.stoppedAfter') }, { key: 'sessions', label: t('funnel.sessions'), numeric: true }], 'sessions')));
  root.append(panel(t('funnel.purposeDistTitle'), t('funnel.purposeDistHint'),
    rankTable(funnel.purposeDistribution, [{ key: 'purpose', label: t('funnel.purpose') }, { key: 'count', label: t('funnel.starts'), numeric: true }], 'count')));
}

function renderQuality(root, data) {
  var quality = data.quality;
  root.append(panel(t('quality.distributionTitle'), t('quality.distributionHint'),
    rankTable(quality.distribution, [{ key: 'score', label: t('quality.score') }, { key: 'count', label: t('quality.count'), numeric: true }], 'count')));
  root.append(panel(t('quality.byKindTitle'), t('quality.byKindHint'),
    rankTable(quality.byKind, [{ key: 'kind', label: t('quality.kind') }, { key: 'count', label: t('quality.count'), numeric: true }, { key: 'average', label: t('quality.average'), numeric: true }], 'count')));
  root.append(panel(t('quality.countryTitle'), t('quality.countryHint'),
    rankTable(quality.countryRatings, [{ key: 'country_code', label: t('quality.country') }, { key: 'count', label: t('quality.ratingsCount'), numeric: true }, { key: 'average', label: t('quality.average'), numeric: true }], 'count')));

  var negatives = node('div', 'scroll');
  if (!quality.negativeComments || !quality.negativeComments.length) {
    negatives.append(node('p', 'empty', t('quality.negativeEmpty')));
  } else {
    var table = node('table');
    var head = node('tr');
    [t('quality.colWhen'), t('quality.colKind'), t('quality.colScore'), t('quality.colCountry'), t('quality.colArrivedVia'), t('quality.colComment')].forEach(function (label) { head.append(node('th', '', label)); });
    var thead = node('thead');
    thead.append(head);
    table.append(thead);
    var body = node('tbody');
    quality.negativeComments.forEach(function (row) {
      var tr = node('tr');
      tr.append(node('td', '', (row.created_at || '').slice(0, 16).replace('T', ' ')));
      tr.append(node('td', '', row.kind));
      tr.append(node('td', 'num', row.score));
      tr.append(node('td', '', row.country_code || t('common.dash')));
      tr.append(node('td', '', row.origin || t('common.dash')));
      tr.append(freeTextNode('td', '', row.comment || ''));
      body.append(tr);
    });
    table.append(body);
    negatives.append(table);
  }
  root.append(panel(t('quality.negativeTitle'), t('quality.negativeHint'), negatives));

  var sets = node('div', 'scroll');
  if (!quality.poorResultSets || !quality.poorResultSets.length) {
    sets.append(node('p', 'empty', t('quality.setsEmpty')));
  } else {
    var setTable = node('table');
    var setHead = node('tr');
    [t('quality.colWhen'), t('quality.colScore'), t('quality.colRecommendedSet')].forEach(function (label) { setHead.append(node('th', '', label)); });
    var setThead = node('thead');
    setThead.append(setHead);
    setTable.append(setThead);
    var setBody = node('tbody');
    quality.poorResultSets.forEach(function (row) {
      var tr = node('tr');
      tr.append(node('td', '', (row.created_at || '').slice(0, 16).replace('T', ' ')));
      tr.append(node('td', 'num', row.score));
      var parsed = [];
      try { parsed = JSON.parse(row.result_context_json || '[]'); } catch (error) { parsed = []; }
      tr.append(node('td', '', parsed.map(function (item) { return item.countryCode + ' (' + item.score + ')'; }).join(', ')));
      setBody.append(tr);
    });
    setTable.append(setBody);
    sets.append(setTable);
  }
  root.append(panel(t('quality.setsTitle'), t('quality.setsHint'), sets));

  var byPurpose = {};
  (quality.pathContext || []).forEach(function (row) {
    var key = (row.purpose || t('quality.unknownPurpose')) + ' · ' + (row.answers || 0) + ' ' + t('quality.answersWord');
    byPurpose[key] = byPurpose[key] || { path: key, ratings: 0, total: 0 };
    byPurpose[key].ratings += 1;
    byPurpose[key].total += Number(row.score) || 0;
  });
  var paths = Object.keys(byPurpose).map(function (key) {
    var entry = byPurpose[key];
    return { path: entry.path, ratings: entry.ratings, average: Math.round((entry.total / entry.ratings) * 100) / 100 };
  }).sort(function (a, b) { return a.average - b.average; });
  root.append(panel(t('quality.pathTitle'), t('quality.pathHint'),
    rankTable(paths, [{ key: 'path', label: t('quality.path') }, { key: 'ratings', label: t('quality.ratingsLabel'), numeric: true }, { key: 'average', label: t('quality.average'), numeric: true }], 'ratings')));
}

function renderCountries(root, data) {
  var countries = data.countries;
  var cards = node('div', 'kpis');
  kpi(cards, t('countries.everRecommended'), num(countries.recommendedCountryCount), t('countries.everRecommendedNote'));
  kpi(cards, t('countries.surpriseOpened'), num(countries.surpriseOpened));
  root.append(panel(t('countries.sectionTitle'), '', cards));
  root.append(panel(t('countries.mostTitle'), t('countries.mostHint'),
    rankTable(countries.mostRecommended, [{ key: 'country_code', label: t('countries.countryCol') }, { key: 'count', label: t('countries.appearances'), numeric: true }], 'count')));
  root.append(panel(t('countries.leastTitle'), t('countries.leastHint'),
    rankTable(countries.leastRecommended, [{ key: 'country_code', label: t('countries.countryCol') }, { key: 'count', label: t('countries.appearances'), numeric: true }], 'count')));
  root.append(panel(t('countries.openedTitle'), t('countries.openedHint'),
    rankTable(countries.mostOpened, [{ key: 'country_code', label: t('countries.countryCol') }, { key: 'count', label: t('countries.opens'), numeric: true }], 'count')));
  root.append(panel(t('countries.sourceTitle'), '',
    rankTable(countries.openedBySource, [{ key: 'source', label: t('countries.source') }, { key: 'count', label: t('countries.opens'), numeric: true }], 'count')));
  root.append(panel(t('countries.surpriseTitle'), t('countries.surpriseHint'),
    rankTable(countries.surpriseShown, [{ key: 'country_code', label: t('countries.countryCol') }, { key: 'count', label: t('countries.landings'), numeric: true }], 'count')));
  root.append(panel(t('countries.feedbackTitle'), t('countries.feedbackHint'),
    rankTable(countries.countryFeedback, [{ key: 'country_code', label: t('countries.countryCol') }, { key: 'count', label: t('countries.feedbackCount'), numeric: true }], 'count')));
}

function renderDiscovery(root, data) {
  var discovery = data.discovery;
  var cards = node('div', 'kpis');
  kpi(cards, t('discovery.searchInteractions'), num(discovery.searchEvents));
  kpi(cards, t('discovery.searchWithText'), num(discovery.searchWithText));
  kpi(cards, t('discovery.filterResets'), num(discovery.filterResets));
  kpi(cards, t('discovery.surpriseSpins'), num(discovery.surpriseSpins));
  kpi(cards, t('discovery.surpriseSessions'), num(discovery.surpriseSessions));
  root.append(panel(t('discovery.sectionTitle'), t('discovery.sectionHint'), cards));
  root.append(panel(t('discovery.filtersTitle'), '',
    rankTable(discovery.filtersUsed, [{ key: 'filter', label: t('discovery.filter') }, { key: 'count', label: t('discovery.changes'), numeric: true }], 'count')));
  root.append(panel(t('discovery.sortTitle'), '',
    rankTable(discovery.sortUsed, [{ key: 'value', label: t('discovery.sort') }, { key: 'count', label: t('discovery.uses'), numeric: true }], 'count')));
  root.append(panel(t('discovery.distanceTitle'), t('discovery.distanceHint'),
    rankTable(discovery.distanceSortUsed, [{ key: 'value', label: t('discovery.sort') }, { key: 'count', label: t('discovery.uses'), numeric: true }], 'count')));
  root.append(panel(t('discovery.regionTitle'), '',
    rankTable(discovery.regionUsed, [{ key: 'value', label: t('discovery.region') }, { key: 'count', label: t('discovery.uses'), numeric: true }], 'count')));
}

function renderLocation(root, data) {
  var location = data.location;
  var cards = node('div', 'kpis');
  kpi(cards, t('location.asked'), num(location.sessionsThatAsked));
  kpi(cards, t('location.granted'), num(location.sessionsThatGranted));
  var rate = location.sessionsThatAsked ? Math.round((location.sessionsThatGranted / location.sessionsThatAsked) * 1000) / 10 : null;
  kpi(cards, t('location.grantRate'), pct(rate));
  root.append(panel(t('location.sectionTitle'), t('location.sectionHint'), cards));
  root.append(panel(t('location.permissionTitle'), '',
    rankTable(location.permission, [{ key: 'outcome', label: t('location.outcome') }, { key: 'count', label: t('location.sessionsCount'), numeric: true }], 'count')));
  root.append(panel(t('location.requestTitle'), t('location.requestHint'),
    rankTable(location.requestOutcomes, [{ key: 'outcome', label: t('location.outcome') }, { key: 'count', label: t('location.requests'), numeric: true }, { key: 'averageMs', label: t('location.avgMs'), numeric: true }], 'count')));
  root.append(panel(t('location.stageTitle'), t('location.stageHint'),
    rankTable(location.stageOutcomes, [{ key: 'outcome', label: t('location.outcome') }, { key: 'highAccuracy', label: t('location.highAccuracy') }, { key: 'count', label: t('location.attempts'), numeric: true }], 'count')));
  root.append(panel(t('location.edgeTitle'), t('location.edgeHint'),
    rankTable(location.edgeCountries, [{ key: 'country', label: t('countries.countryCol') }, { key: 'count', label: t('location.sessionsCount'), numeric: true }], 'count')));
}

function renderTechnical(root, data) {
  var technical = data.technical;
  var performance = technical.performance || {};
  var cards = node('div', 'kpis');
  kpi(cards, t('technical.samples'), num(performance.samples));
  kpi(cards, t('technical.avgTtfb'), performance.ttfbMs === null || performance.ttfbMs === undefined ? t('common.dash') : performance.ttfbMs + ' ms');
  kpi(cards, t('technical.avgDomReady'), performance.domReadyMs === null || performance.domReadyMs === undefined ? t('common.dash') : performance.domReadyMs + ' ms');
  kpi(cards, t('technical.avgLoad'), performance.loadMs === null || performance.loadMs === undefined ? t('common.dash') : performance.loadMs + ' ms');
  root.append(panel(t('technical.sectionTitle'), '', cards));
  root.append(panel(t('technical.errorsTitle'), t('technical.errorsHint'),
    rankTable(technical.errors, [{ key: 'kind', label: t('technical.errorKind') }, { key: 'script', label: t('technical.errorScript') }, { key: 'count', label: t('technical.count'), numeric: true }], 'count')));
  var grid = node('div', 'grid2');
  [[t('technical.browserFamily'), technical.browsers, 'browser'], [t('technical.deviceClass'), technical.devices, 'device'],
   [t('technical.language'), technical.locales, 'locale'], [t('technical.theme'), technical.themes, 'theme'],
   [t('technical.referrer'), technical.referrers, 'referrer']].forEach(function (entry) {
    grid.append(panel(entry[0], '', rankTable(entry[1], [{ key: entry[2], label: entry[0] }, { key: 'count', label: t('technical.count'), numeric: true }], 'count')));
  });
  root.append(grid);
}

function renderContent(root, data) {
  var content = data.content;
  if (!content.available) {
    root.append(panel(t('content.unavailableTitle'), t('content.unavailableHint'), node('p', 'empty', t('common.noData'))));
    return;
  }
  var verified = 0; var total = 0;
  (content.byStatus || []).forEach(function (row) {
    total += Number(row.count) || 0;
    if (row.status === 'ok') verified += Number(row.count) || 0;
  });
  var cards = node('div', 'kpis');
  kpi(cards, t('content.lookedUp'), num(total));
  kpi(cards, t('content.verified'), num(verified), total ? Math.round((verified / total) * 100) + t('content.verifiedNote') : '');
  kpi(cards, t('content.countriesSeen'), num(content.countriesSeen));
  root.append(panel(t('content.coverageTitle'), t('content.coverageHint'), cards));
  root.append(panel(t('content.statusTitle'), t('content.statusHint'),
    rankTable(content.byStatus, [{ key: 'status', label: t('content.status') }, { key: 'count', label: t('content.cities'), numeric: true }], 'count')));
  root.append(panel(t('content.langTitle'), '',
    rankTable(content.byLang, [{ key: 'lang', label: t('content.lang') }, { key: 'verified', label: t('content.verifiedCol'), numeric: true }, { key: 'count', label: t('content.lookedUpCol'), numeric: true }], 'count')));
}

/** The report workflow status vocabulary, and the report TYPE vocabulary,
 *  translated for display while the underlying value sent to the API (and
 *  used as the option's value attribute) stays the fixed English enum code
 *  — the same pattern the rest of the dashboard uses for device/purpose
 *  filters. An unrecognised value (should not happen; defensive only) falls
 *  back to the raw value itself, which is real data, not a translation key. */
function statusLabel(status) {
  var label = t('reportStatus.' + status);
  return label || status;
}
function typeLabel(type) {
  var label = t('reportType.' + type);
  return label || type;
}

function statusChip(status) {
  var chip = node('span', 'chip ' + status, statusLabel(status));
  return chip;
}

var STATUS_VALUES = ['new', 'triaged', 'in_progress', 'resolved', 'declined'];
var TYPE_VALUES = ['wrong_info', 'image', 'bug', 'suggestion', 'results', 'translation', 'other'];

function renderReports(root) {
  var controls = node('div', 'filters');
  var search = node('div');
  search.append(node('label', '', t('reports.search')));
  var input = node('input');
  input.id = 'r_q'; input.type = 'search'; input.placeholder = t('reports.searchPlaceholder');
  input.value = state.feedbackQuery.q;
  search.append(input);
  controls.append(search);

  var statusWrap = node('div');
  statusWrap.append(node('label', '', t('reports.status')));
  var statusSelect = node('select');
  statusSelect.id = 'r_status';
  [''].concat(STATUS_VALUES).forEach(function (value) {
    var option = node('option', '', value === '' ? t('filters.any') : statusLabel(value));
    option.value = value;
    if (state.feedbackQuery.status === value) option.selected = true;
    statusSelect.append(option);
  });
  statusWrap.append(statusSelect);
  controls.append(statusWrap);

  var typeWrap = node('div');
  typeWrap.append(node('label', '', t('reports.type')));
  var typeSelect = node('select');
  typeSelect.id = 'r_type';
  [''].concat(TYPE_VALUES).forEach(function (value) {
    var option = node('option', '', value === '' ? t('filters.any') : typeLabel(value));
    option.value = value;
    if (state.feedbackQuery.type === value) option.selected = true;
    typeSelect.append(option);
  });
  typeWrap.append(typeSelect);
  controls.append(typeWrap);

  var actions = node('div', 'actions');
  var apply = node('button', 'primary', t('reports.searchAction'));
  apply.addEventListener('click', function () {
    state.feedbackQuery = { q: input.value, status: statusSelect.value, type: typeSelect.value };
    loadFeedback();
  });
  actions.append(apply);
  controls.append(actions);
  root.append(panel(t('reports.title'), t('reports.hint'), controls));

  var listRoot = node('div');
  listRoot.id = 'reportList';
  root.append(listRoot);
  renderFeedbackList();
}

function renderFeedbackList() {
  var listRoot = el('reportList');
  if (!listRoot) return;
  listRoot.replaceChildren();
  if (!state.feedback) { listRoot.append(node('p', 'empty', t('common.loading'))); return; }
  var summary = node('div', 'kpis');
  kpi(summary, t('reports.matching'), num(state.feedback.total));
  (state.feedback.byStatus || []).forEach(function (row) { kpi(summary, statusLabel(row.status), num(row.count)); });
  listRoot.append(panel(t('reports.queueTitle'), '', summary));

  if (!state.feedback.items || !state.feedback.items.length) {
    listRoot.append(panel(t('reports.resultsTitle'), '', node('p', 'empty', t('reports.resultsEmpty'))));
    return;
  }
  var table = node('table');
  var head = node('tr');
  [t('reports.colReference'), t('reports.colWhen'), t('reports.colType'), t('reports.colCountry'), t('reports.colMessage'), t('reports.colStatus'), ''].forEach(function (label) { head.append(node('th', '', label)); });
  var thead = node('thead');
  thead.append(head);
  table.append(thead);
  var body = node('tbody');
  state.feedback.items.forEach(function (row) {
    var tr = node('tr');
    tr.append(node('td', '', row.reference_id));
    tr.append(node('td', '', (row.created_at || '').slice(0, 16).replace('T', ' ')));
    tr.append(node('td', '', typeLabel(row.type || '')));
    tr.append(node('td', '', row.country_code || t('common.dash')));
    tr.append(freeTextNode('td', '', (row.message || '').slice(0, 90)));
    var statusCell = node('td');
    statusCell.append(statusChip(row.status || 'new'));
    tr.append(statusCell);
    var actionCell = node('td');
    var open = node('button', 'small ghost', t('reports.open'));
    open.addEventListener('click', function () { openReport(row); });
    actionCell.append(open);
    tr.append(actionCell);
    body.append(tr);
  });
  table.append(body);
  var wrap = node('div', 'scroll');
  wrap.append(table);
  listRoot.append(panel(t('reports.resultsTitle'), t('reports.resultsHint'), wrap));
}

function openReport(row) {
  var dialog = el('reportDialog');
  var content = el('reportBody');
  content.replaceChildren();
  var line = function (label, value) {
    var block = node('div', 'detail-line');
    block.append(node('b', '', label));
    block.append(document.createTextNode(value === null || value === undefined || value === '' ? t('common.dash') : String(value)));
    return block;
  };
  content.append(node('h3', '', row.reference_id));
  content.append(line(t('reportDetail.received'), row.created_at));
  content.append(line(t('reportDetail.type'), typeLabel(row.type || '')));
  content.append(line(t('reportDetail.page'), row.path));
  content.append(line(t('reportDetail.country'), row.country_code));
  content.append(line(t('reportDetail.language'), row.locale));
  content.append(line(t('reportDetail.contactEmail'), row.email));
  content.append(line(t('reportDetail.screenshot'), row.screenshot_key));
  content.append(line(t('reportDetail.statusChanged'), row.status_changed_at));
  var messageBlock = node('div', 'detail-line');
  messageBlock.append(node('b', '', t('reportDetail.message')));
  messageBlock.append(freeTextNode('div', 'message', row.message || ''));
  content.append(messageBlock);

  el('reportReference').value = row.reference_id;
  el('reportStatus').value = row.status || 'new';
  el('reportNote').value = row.admin_note || '';
  showError('reportError', null);
  dialog.showModal();
}

function loadFeedback() {
  var params = filters();
  if (state.feedbackQuery.q) params.set('q', state.feedbackQuery.q);
  if (state.feedbackQuery.status) params.set('status', state.feedbackQuery.status);
  if (state.feedbackQuery.type) params.set('type', state.feedbackQuery.type);
  state.feedback = null;
  renderFeedbackList();
  api('/api/admin/feedback', params).then(function (data) {
    state.feedback = data;
    renderFeedbackList();
  }).catch(function (error) {
    state.feedback = { items: [], total: 0, byStatus: [] };
    renderFeedbackList();
    showError('error', error.i18nKey || 'errors.network', error.i18nParams);
  });
}

/** Tab labels are resolved through t() at render time (renderTabs() re-runs
 *  on every language switch), not stored as fixed strings here. */
var TAB_IDS = [
  { id: 'overview', key: 'tabs.overview', render: renderOverview },
  { id: 'funnel', key: 'tabs.funnel', render: renderFunnel },
  { id: 'quality', key: 'tabs.quality', render: renderQuality },
  { id: 'countries', key: 'tabs.countries', render: renderCountries },
  { id: 'discovery', key: 'tabs.discovery', render: renderDiscovery },
  { id: 'location', key: 'tabs.location', render: renderLocation },
  { id: 'reports', key: 'tabs.reports', render: null },
  { id: 'technical', key: 'tabs.technical', render: renderTechnical },
  { id: 'content', key: 'tabs.content', render: renderContent },
];

function renderTabs() {
  var nav = el('tabs');
  if (!nav) return;
  nav.setAttribute('aria-label', t('tabs.ariaLabel'));
  nav.replaceChildren();
  TAB_IDS.forEach(function (tab) {
    var button = node('button', '', t(tab.key));
    button.setAttribute('aria-current', state.tab === tab.id ? 'true' : 'false');
    button.addEventListener('click', function () {
      state.tab = tab.id;
      renderTabs();
      renderBody();
      if (tab.id === 'reports' && !state.feedback) loadFeedback();
    });
    nav.append(button);
  });
}

function renderBody() {
  var root = el('body');
  root.replaceChildren();
  var tab = TAB_IDS.filter(function (entry) { return entry.id === state.tab; })[0];
  if (!tab) return;
  if (tab.id === 'reports') { renderReports(root); return; }
  if (!state.data) { root.append(node('p', 'empty', t('common.loading'))); return; }
  tab.render(root, state.data);
}

function load() {
  showError('error', null);
  state.data = null;
  renderBody();
  return api('/api/admin/analytics', filters()).then(function (data) {
    state.data = data;
    el('loginForm').hidden = true;
    el('dashboard').hidden = false;
    el('authVia').textContent = data.authenticatedVia === 'access' ? t('authVia.access') : t('authVia.token');
    renderTabs();
    renderBody();
    if (state.tab === 'reports') loadFeedback();
  }).catch(function (error) {
    showError('error', error.i18nKey || 'errors.network', error.i18nParams);
    el('dashboard').hidden = true;
    el('loginForm').hidden = false;
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // Applied before anything else: dir/lang correct from the first frame,
  // and every data-i18n-tagged static label carries the persisted language
  // rather than the server-rendered English default.
  applyDirLang();
  updateLangSwitchUI();
  applyStaticTranslations();

  el('langAr').addEventListener('click', function () { setLang('ar'); });
  el('langEn').addEventListener('click', function () { setLang('en'); });

  el('loginForm').addEventListener('submit', function (event) {
    event.preventDefault();
    state.token = el('token').value;
    load();
  });
  el('applyFilters').addEventListener('click', function () {
    load();
    if (state.tab === 'reports') loadFeedback();
  });
  el('clearFilters').addEventListener('click', function () {
    ['from', 'to', 'locale', 'device', 'purpose', 'country', 'minRating', 'maxRating'].forEach(function (key) {
      var field = el('f_' + key);
      if (field) field.value = '';
    });
    load();
  });
  el('reportSave').addEventListener('click', function (event) {
    event.preventDefault();
    var payload = {
      referenceId: el('reportReference').value,
      status: el('reportStatus').value,
      note: el('reportNote').value,
    };
    api('/api/admin/feedback/status', null, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function () {
      el('reportDialog').close();
      loadFeedback();
    }).catch(function (error) { showError('reportError', error.i18nKey || 'errors.network', error.i18nParams); });
  });
  el('reportClose').addEventListener('click', function (event) { event.preventDefault(); el('reportDialog').close(); });

  // Under Cloudflare Access the browser already carries the Access cookie,
  // so there is nothing to type: try straight away and only fall back to the
  // token form if that fails.
  load();
});
`;

/** Serialized once per request and embedded ahead of SCRIPT as one global,
 *  so the browser-side script (which cannot `import`) has a single source
 *  of truth instead of a hand-duplicated copy. `</script` inside a dictionary
 *  string would otherwise terminate the tag early — defensive escaping even
 *  though no current string contains it. */
function embeddedI18n(): string {
  return `var ADMIN_I18N = ${JSON.stringify(ADMIN_I18N).replace(/<\/script/gi, '<\\/script')};\n`;
}

export function adminPage(): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Wejhaty — product data</title>
<style>${STYLES}</style>
</head>
<body>
<main class="wrap">
  <header class="top">
    <h1 data-i18n="brand">Wejhaty — product data</h1>
    <div class="top-actions">
      <div class="lang-switch" id="langSwitch" role="group" data-i18n-aria-label="langSwitch.label">
        <button type="button" id="langAr" data-lang="ar" aria-pressed="false">AR</button>
        <button type="button" id="langEn" data-lang="en" aria-pressed="true">EN</button>
      </div>
      <span class="notice" id="authVia"></span>
    </div>
  </header>
  <p class="sub" data-i18n="subtitle">Anonymous product analytics, ratings and reports. No coordinates, no IP addresses, no device fingerprints, no passport data — by schema, not by policy.</p>

  <form class="panel login" id="loginForm" hidden>
    <h2 data-i18n="signIn.title">Sign in</h2>
    <p class="hint" data-i18n="signIn.hint">Cloudflare Access signs you in automatically when it is configured. Otherwise, use the admin token.</p>
    <label for="token" data-i18n="signIn.tokenLabel">Admin token</label>
    <input id="token" type="password" autocomplete="current-password">
    <p></p>
    <button class="primary" type="submit" data-i18n="signIn.submit">Open dashboard</button>
  </form>
  <p class="error" id="error"></p>

  <div id="dashboard" hidden>
    <section class="panel">
      <h2 data-i18n="filters.title">Filters</h2>
      <p class="hint" data-i18n="filters.hint">Every panel below respects these.</p>
      <div class="filters">
        <div><label for="f_from" data-i18n="filters.from">From</label><input id="f_from" type="date"></div>
        <div><label for="f_to" data-i18n="filters.to">To</label><input id="f_to" type="date"></div>
        <div><label for="f_locale" data-i18n="filters.language">Language</label><select id="f_locale"><option value="" data-i18n="filters.any">Any</option><option value="ar" data-i18n="filters.localeAr">Arabic</option><option value="en" data-i18n="filters.localeEn">English</option></select></div>
        <div><label for="f_device" data-i18n="filters.device">Device</label><select id="f_device"><option value="" data-i18n="filters.any">Any</option><option value="mobile" data-i18n="devices.mobile">Mobile</option><option value="tablet" data-i18n="devices.tablet">Tablet</option><option value="desktop" data-i18n="devices.desktop">Desktop</option></select></div>
        <div><label for="f_purpose" data-i18n="filters.purpose">Purpose</label><select id="f_purpose"><option value="" data-i18n="filters.any">Any</option><option value="tourism" data-i18n="purposes.tourism">Tourism</option><option value="work" data-i18n="purposes.work">Work</option><option value="education" data-i18n="purposes.education">Education</option><option value="medical" data-i18n="purposes.medical">Medical</option><option value="immigration" data-i18n="purposes.immigration">Immigration</option><option value="investment" data-i18n="purposes.investment">Investment</option><option value="wellness" data-i18n="purposes.wellness">Wellness</option><option value="other" data-i18n="purposes.other">Other</option></select></div>
        <div><label for="f_country" data-i18n="filters.country">Country (ISO)</label><input id="f_country" maxlength="2" data-i18n-placeholder="filters.countryPlaceholder" placeholder="JP"></div>
        <div><label for="f_minRating" data-i18n="filters.minRating">Min rating</label><select id="f_minRating"><option value="" data-i18n="filters.any">Any</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div><label for="f_maxRating" data-i18n="filters.maxRating">Max rating</label><select id="f_maxRating"><option value="" data-i18n="filters.any">Any</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div class="actions"><button class="primary" id="applyFilters" type="button" data-i18n="filters.apply">Apply</button><button class="ghost" id="clearFilters" type="button" data-i18n="filters.clear">Clear</button></div>
      </div>
    </section>

    <nav class="tabs" id="tabs" aria-label="Dashboard sections"></nav>
    <div id="body"></div>
  </div>
</main>

<dialog id="reportDialog" aria-labelledby="reportDialogTitle">
  <form method="dialog">
    <h2 id="reportDialogTitle" data-i18n="reportDetail.title">Report</h2>
    <div id="reportBody"></div>
    <input type="hidden" id="reportReference">
    <div class="row">
      <div>
        <label for="reportStatus" data-i18n="reportDetail.statusLabel">Status</label>
        <select id="reportStatus">
          <option value="new" data-i18n="reportStatus.new">new</option>
          <option value="triaged" data-i18n="reportStatus.triaged">triaged</option>
          <option value="in_progress" data-i18n="reportStatus.in_progress">in progress</option>
          <option value="resolved" data-i18n="reportStatus.resolved">resolved</option>
          <option value="declined" data-i18n="reportStatus.declined">declined</option>
        </select>
      </div>
    </div>
    <div class="row" style="display:block">
      <label for="reportNote" data-i18n="reportDetail.noteLabel">Internal note</label>
      <textarea id="reportNote" maxlength="2000"></textarea>
    </div>
    <p class="error" id="reportError"></p>
    <div class="row">
      <button class="primary" id="reportSave" data-i18n="reportDetail.save">Save</button>
      <button class="ghost" id="reportClose" data-i18n="reportDetail.close">Close</button>
    </div>
  </form>
</dialog>

<script>${embeddedI18n()}${SCRIPT}</script>
</body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}
