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
import { ADMIN_METRICS } from './adminMetrics';
import adminCatalog from './generated/adminCatalog.json';

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
/* position:relative makes the scroller the containing block of the
   visually-hidden <caption>; without it the 1px caption escapes the clip and
   widens the page in RTL (found by the Phase 21 narrow-width QA). */
.scroll{max-height:420px;overflow:auto;position:relative}
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
.kpi{display:flex;flex-direction:column}
.kpi-foot{display:flex;gap:8px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-top:auto;padding-top:10px}
/* Phase 21 — every figure carries its dictionary definition in a native
   <details>: keyboard- and screen-reader-operable with no script. */
details.def{font-size:0.8rem;color:var(--muted);flex:1 1 100%;min-width:0}
.panel>details.def{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
details.def summary{cursor:pointer;color:var(--gold);font-weight:700;width:fit-content;border-radius:6px}
details.def summary:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
details.def h3{margin:12px 0 2px;font-size:0.84rem;color:var(--ink)}
details.def dl{margin:6px 0 0;display:grid;grid-template-columns:minmax(0,max-content) minmax(0,1fr);gap:4px 14px}
details.def dt{color:var(--muted);font-weight:700}
details.def dd{margin:0;color:var(--ink)}
.kpi details.def dl{grid-template-columns:minmax(0,1fr)}
.kpi details.def dd{margin-bottom:6px}
.kpi-foot .drill{flex:0 0 auto}
.code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:0.8rem;unicode-bidi:isolate;overflow-wrap:anywhere}
.iso{color:var(--muted);font-size:0.74rem;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;unicode-bidi:isolate}
.qtext{display:block;min-width:220px;max-width:460px}
.qid{display:block;color:var(--muted);font-size:0.72rem;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;margin-top:2px;unicode-bidi:isolate}
.visually-hidden{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;padding:0;margin:-1px}
.panel-head{display:flex;justify-content:space-between;gap:12px 20px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px}
.panel-head .hint{margin:0}
.inline-field{min-width:200px}
.inline-field select{width:100%}
.scroll.tall{max-height:none}
.ltr{unicode-bidi:isolate}
.scroll:focus-visible{outline:2px solid var(--gold);outline-offset:2px;border-radius:6px}
table.wide{min-width:780px}
ul.legend{list-style:none;display:flex;flex-wrap:wrap;gap:6px 18px;margin:8px 0 0;padding:0;color:var(--muted);font-size:0.82rem}
ul.legend li{display:flex;align-items:center;gap:7px}
ul.legend .swatch{width:14px;height:3px;border-radius:2px;display:inline-block}
button:disabled{opacity:0.6;cursor:progress}
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
/* Latin identifiers isolated as LTR keep the column's own alignment. */
html[dir="rtl"] .qid,html[dir="rtl"] details.def dd.code{text-align:right}
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

var state = {
  token: '', data: null, tab: 'overview', lang: loadLang(), errors: {},
  feedback: null, feedbackQuery: { q: '', status: '', type: '', screenshot: '' },
  comments: null, commentKind: '', funnelPurpose: null, reportOpener: null, focusReference: null,
};
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

// ------------------------------------------------------------ vocabulary
// Phase 21 — the metric dictionary (adminMetrics.ts) and the public site's
// Explore vocabulary (generated/adminCatalog.json) arrive as ADMIN_METRICS
// and ADMIN_VOCAB, embedded ahead of this script like ADMIN_I18N.
var METRICS = {};
ADMIN_METRICS.forEach(function (metric) { METRICS[metric.id] = metric; });

/** One {ar, en} pair in the dashboard's language. */
function tr(pair) {
  if (!pair) return '';
  return pair[state.lang] || pair.en || '';
}

function metricLabel(id) {
  var metric = Object.prototype.hasOwnProperty.call(METRICS, id) ? METRICS[id] : null;
  return metric ? tr(metric.label) : '';
}

/** A data value that has a label: the label in the dashboard's language.
 *  A value with no known label is real data, shown as it is — never a
 *  translation key. */
function enumLabel(group, value) {
  if (value === null || value === undefined || value === '') return t('common.dash');
  return t('enums.' + group + '.' + value) || String(value);
}

function purposeLabel(value) {
  if (value === null || value === undefined || value === '') return t('quality.unknownPurpose');
  return t('purposes.' + value) || String(value);
}

/** Explore's own labels, as the traveller saw them. */
function exploreLabel(filter, value) {
  if (filter === 'purpose') return value === 'all' ? t('enums.exploreFilterAll') : purposeLabel(value);
  var table = filter === 'sort' ? ADMIN_VOCAB.exploreSorts : filter === 'region' ? ADMIN_VOCAB.exploreRegions : filter === 'cost' ? ADMIN_VOCAB.exploreCosts : null;
  if (table && Object.prototype.hasOwnProperty.call(table, value)) return tr(table[value]);
  if (value === 'all') return t('enums.exploreFilterAll');
  return value === null || value === undefined ? t('common.dash') : String(value);
}

function exploreFilterLabel(filter) {
  var labels = ADMIN_VOCAB.exploreFilters;
  return Object.prototype.hasOwnProperty.call(labels, filter) ? tr(labels[filter]) : String(filter);
}

var regionNames = {};
/** The country's name in the dashboard's language (the browser's own
 *  Intl data — nothing fetched). The ISO code stays beside it. */
function countryName(code) {
  if (!code) return t('common.dash');
  try {
    if (!regionNames[state.lang]) regionNames[state.lang] = new Intl.DisplayNames([state.lang], { type: 'region' });
    var name = regionNames[state.lang].of(code);
    return name && name !== code ? name : code;
  } catch (error) {
    return code;
  }
}

function countryContent(code) {
  var wrap = node('span');
  if (!code) { wrap.textContent = t('common.dash'); return wrap; }
  wrap.append(document.createTextNode(countryName(code) + ' '));
  var iso = node('span', 'iso', code);
  iso.setAttribute('dir', 'ltr');
  wrap.append(iso);
  return wrap;
}

function when(value) {
  return (value || '').slice(0, 16).replace('T', ' ');
}

/** Numbers, ratios and ranges ("130 ÷ 182", "3.7 (2–5)", "3.51 / 5") read
 *  left to right in both languages. Inside Arabic text the bidi algorithm
 *  would otherwise reverse their parts, so text with no Arabic letter is
 *  isolated as LTR. Alignment stays with the cell or card. */
function numericText(text) {
  var value = text === null || text === undefined ? '' : String(text);
  if (/[\u0600-\u06FF]/.test(value)) return document.createTextNode(value);
  var span = node('span', 'ltr', value);
  span.setAttribute('dir', 'ltr');
  return span;
}

// ------------------------------------------------------------- building blocks

/** "How is this counted?" — the metric's full dictionary entry, native
 *  <details>, so it is keyboard- and screen-reader-operable with no script. */
function definitionBlock(ids) {
  var list = (Array.isArray(ids) ? ids : [ids]).filter(function (id) { return METRICS[id]; });
  if (!list.length) return null;
  var details = node('details', 'def');
  details.append(node('summary', '', t('common.howCounted')));
  list.forEach(function (id) {
    var metric = METRICS[id];
    if (list.length > 1) details.append(node('h3', '', tr(metric.label)));
    var dl = node('dl');
    var add = function (key, value, code) {
      dl.append(node('dt', '', t('metricMeta.' + key)));
      var dd = node('dd', code ? 'code' : '', value);
      if (code) dd.setAttribute('dir', 'ltr');
      dl.append(dd);
    };
    add('definition', tr(metric.definition));
    add('numerator', tr(metric.numerator));
    add('denominator', metric.denominator ? tr(metric.denominator) : t('metricMeta.noDenominator'));
    add('unit', t('units.' + metric.unit));
    add('aggregation', t('aggregations.' + metric.aggregation));
    add('window', t('windows.' + metric.window));
    add('source', metric.source, true);
    add('interpretation', tr(metric.interpretation));
    add('limitation', tr(metric.limitation));
    details.append(dl);
  });
  return details;
}

/** A headline number with its dictionary label, its definition, and an
 *  optional drill-down to the tab that breaks it down. */
function kpi(container, id, value, note, drillTab) {
  var card = node('div', 'kpi');
  var valueBox = node('div', 'value');
  valueBox.append(numericText(value));
  card.append(node('div', 'label', metricLabel(id)), valueBox);
  if (note) {
    var noteBox = node('div', 'note');
    noteBox.append(numericText(note));
    card.append(noteBox);
  }
  var foot = node('div', 'kpi-foot');
  var definition = definitionBlock(id);
  if (definition) foot.append(definition);
  if (drillTab) {
    var drill = node('button', 'small ghost drill', t('common.openDetails'));
    drill.type = 'button';
    drill.setAttribute('aria-label', t('common.openDetails') + ': ' + metricLabel(id));
    drill.addEventListener('click', function () { goTab(drillTab); });
    foot.append(drill);
  }
  card.append(foot);
  container.append(card);
}

/** A plain labelled count with no dictionary entry of its own (a status or
 *  type breakdown of a metric that is defined on the same panel). */
function stat(container, label, value) {
  var card = node('div', 'kpi');
  var valueBox = node('div', 'value');
  valueBox.append(numericText(value));
  card.append(node('div', 'label', label), valueBox);
  container.append(card);
}

/** A table in a keyboard-scrollable region. Columns: {key, label, numeric,
 *  format(row) -> string|Node}. barKey draws an inline proportion bar;
 *  options.rowAction(row) -> Node adds a trailing action cell. */
function rankTable(rowsData, columns, barKey, options) {
  options = options || {};
  if (!rowsData || !rowsData.length) return node('p', 'empty', options.empty || t('common.noData'));
  var max = barKey ? rowsData.reduce(function (best, row) { return Math.max(best, Number(row[barKey]) || 0); }, 0) || 1 : 1;
  var table = node('table', options.wide ? 'wide' : '');
  if (options.caption) {
    var caption = node('caption', 'visually-hidden', options.caption);
    table.append(caption);
  }
  var head = node('tr');
  columns.forEach(function (column) {
    var th = node('th', column.numeric ? 'num' : '', column.label);
    th.setAttribute('scope', 'col');
    head.append(th);
  });
  if (barKey) {
    var barHead = node('th');
    barHead.setAttribute('scope', 'col');
    barHead.append(node('span', 'visually-hidden', t('common.share')));
    head.append(barHead);
  }
  if (options.rowAction) {
    var actionHead = node('th');
    actionHead.setAttribute('scope', 'col');
    actionHead.append(node('span', 'visually-hidden', t('common.filterToCountry')));
    head.append(actionHead);
  }
  var thead = node('thead');
  thead.append(head);
  table.append(thead);
  var body = node('tbody');
  rowsData.forEach(function (row) {
    var tr = node('tr');
    columns.forEach(function (column) {
      var cell = node('td', column.numeric ? 'num' : '');
      var shown = column.format ? column.format(row) : column.numeric ? num(row[column.key]) : row[column.key];
      if (shown && typeof shown === 'object' && shown.nodeType) cell.append(shown);
      else if (shown === null || shown === undefined || shown === '') cell.textContent = t('common.dash');
      else if (column.numeric) cell.append(numericText(shown));
      else cell.textContent = String(shown);
      tr.append(cell);
    });
    if (barKey) {
      var barCell = node('td');
      var bar = node('div', 'bar');
      bar.setAttribute('aria-hidden', 'true');
      var fill = node('span');
      fill.style.width = Math.round(((Number(row[barKey]) || 0) / max) * 100) + '%';
      bar.append(fill);
      barCell.append(bar);
      tr.append(barCell);
    }
    if (options.rowAction) {
      var actionCell = node('td');
      var action = options.rowAction(row);
      if (action) actionCell.append(action);
      tr.append(actionCell);
    }
    body.append(tr);
  });
  table.append(body);
  return scrollRegion(table, options.caption, options.tall);
}

function scrollRegion(content, label, tall) {
  var wrap = node('div', tall ? 'scroll tall' : 'scroll');
  wrap.setAttribute('tabindex', '0');
  wrap.setAttribute('role', 'region');
  if (label) wrap.setAttribute('aria-label', formatMessage('common.tableRegion', { title: label }));
  wrap.append(content);
  return wrap;
}

/** The "Filter" action on a country row: narrows the whole dashboard to
 *  that country through the same filter bar the operator uses. */
function countryFilterAction(code) {
  if (!code) return null;
  var button = node('button', 'small ghost', t('common.filterToCountry'));
  button.type = 'button';
  button.setAttribute('aria-label', formatMessage('common.filteredTo', { country: countryName(code) }));
  button.addEventListener('click', function () {
    el('f_country').value = code;
    load();
    if (state.tab === 'reports') loadFeedback();
  });
  return button;
}

/** A small multi-series line chart. Inline SVG, no library. */
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
  svg.setAttribute('aria-label', formatMessage('overview.trendAria', { series: series.map(function (entry) { return entry.label; }).join(', ') }));
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
  var legend = node('ul', 'legend');
  series.forEach(function (entry) {
    var item = node('li');
    var swatch = node('span', 'swatch');
    swatch.style.background = entry.color;
    swatch.setAttribute('aria-hidden', 'true');
    item.append(swatch, document.createTextNode(entry.label));
    legend.append(item);
  });
  box.append(legend);
  return box;
}

function panel(title, hint, content, metricIds) {
  var section = node('section', 'panel');
  section.append(node('h2', '', title));
  if (hint) section.append(node('p', 'hint', hint));
  if (content) section.append(content);
  if (metricIds) {
    var definition = definitionBlock(metricIds);
    if (definition) section.append(definition);
  }
  return section;
}

function goTab(tab) {
  state.tab = tab;
  renderTabs();
  renderBody();
  if (tab === 'reports' && !state.feedback) loadFeedback();
  var heading = document.querySelector('#body h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus();
  }
}

// ------------------------------------------------------------------ panels

function renderOverview(root, data) {
  var overview = data.overview;
  var cards = node('div', 'kpis');
  kpi(cards, 'overview.sessions', num(overview.sessions), null, 'technical');
  kpi(cards, 'overview.pageViews', num(overview.pageViews), null, 'technical');
  kpi(cards, 'overview.questionnaireSessions', num(overview.questionnaireSessions), null, 'funnel');
  kpi(cards, 'overview.completions', num(overview.questionnaireCompletions), null, 'funnel');
  kpi(cards, 'overview.completionRate', pct(overview.completionRate), num(overview.questionnaireCompletions) + ' ÷ ' + num(overview.questionnaireSessions), 'funnel');
  kpi(cards, 'overview.resultsViewed', num(overview.resultsViewed), null, 'countries');
  kpi(cards, 'overview.ratings', num(overview.ratingCount), null, 'quality');
  kpi(cards, 'overview.averageRating', overview.averageRating === null ? t('common.dash') : overview.averageRating + ' / 5', null, 'quality');
  kpi(cards, 'overview.reports', num(overview.feedbackCount), null, 'reports');
  root.append(panel(t('overview.title'), t('overview.hint'), cards));

  root.append(panel(t('overview.trendTitle'), t('overview.trendHint'), lineChart([
    { label: t('overview.seriesSessions'), rows: data.trend.sessionsPerDay, color: '#d9a85c' },
    { label: t('overview.seriesCompletions'), rows: data.trend.completionsPerDay, color: '#48b3a5' },
    { label: t('overview.seriesRatings'), rows: data.trend.ratingsPerDay, color: '#9aa9bb' },
  ])));
}

function renderFunnel(root, data) {
  var funnel = data.funnel;
  var outcomes = funnel.outcomes;
  var cards = node('div', 'kpis');
  var completion = outcomes.entered ? Math.round((outcomes.completed / outcomes.entered) * 1000) / 10 : null;
  kpi(cards, 'overview.questionnaireSessions', num(outcomes.entered));
  kpi(cards, 'overview.completionRate', pct(completion), num(outcomes.completed) + ' ÷ ' + num(outcomes.entered));
  kpi(cards, 'funnel.averageDistinctQuestions', funnel.averageQuestionsAnswered === null ? t('common.dash') : funnel.averageQuestionsAnswered);
  kpi(cards, 'funnel.completedMoreThanOnce', num(outcomes.completedMoreThanOnce));
  kpi(cards, 'funnel.restarted', num(outcomes.restarted));
  kpi(cards, 'funnel.changedPurpose', num(outcomes.changedPurpose));
  root.append(panel(t('funnel.title'), t('funnel.hint'), cards));

  var outcomeRows = ['finished', 'stopped', 'inProgress', 'neverAnswered'].map(function (key) {
    return { key: key, sessions: outcomes[key], share: outcomes.entered ? Math.round((outcomes[key] / outcomes.entered) * 1000) / 10 : null };
  });
  root.append(panel(t('funnel.outcomesTitle'), formatMessage('funnel.outcomesHint', { minutes: funnel.idleMinutes }),
    rankTable(outcomeRows, [
      { key: 'key', label: t('funnel.outcome'), format: function (row) { return enumLabel('outcome', row.key); } },
      { key: 'sessions', label: t('funnel.sessions'), numeric: true },
      { key: 'share', label: t('common.share'), numeric: true, format: function (row) { return pct(row.share); } },
    ], 'sessions', { caption: t('funnel.outcomesTitle') }),
    ['funnel.outcome.finished', 'funnel.outcome.stopped', 'funnel.outcome.inProgress', 'funnel.outcome.neverAnswered']));

  root.append(questionPanel(funnel));

  root.append(panel(t('funnel.positionTitle'), t('funnel.positionHint'),
    rankTable(funnel.byPosition, [
      { key: 'position', label: t('funnel.position') },
      { key: 'sessions', label: t('funnel.sessions'), numeric: true },
      { key: 'stoppedAfter', label: t('funnel.stoppedAfter'), numeric: true },
    ], 'sessions', { caption: t('funnel.positionTitle') }), ['funnel.position.sessions']));

  root.append(panel(t('funnel.purposeTitle'), t('funnel.purposeHint'),
    rankTable(funnel.byPurpose, [
      { key: 'purpose', label: t('funnel.purpose'), format: function (row) { return purposeLabel(row.purpose); } },
      { key: 'picked', label: t('funnel.picked'), numeric: true },
      { key: 'reached', label: t('funnel.reached'), numeric: true },
      { key: 'completed', label: t('funnel.completed'), numeric: true },
      { key: 'completionRate', label: t('funnel.completionRate'), numeric: true, format: function (row) { return pct(row.completionRate); } },
    ], 'completionRate', { caption: t('funnel.purposeTitle') }), ['funnel.purpose.completionRate']));

  root.append(panel(t('funnel.checkpointTitle'), t('funnel.checkpointHint'),
    rankTable(funnel.checkpointChoice, [
      { key: 'choice', label: t('funnel.choice'), format: function (row) { return enumLabel('checkpoint', row.choice); } },
      { key: 'sessions', label: t('funnel.sessions'), numeric: true },
      { key: 'events', label: t('funnel.events'), numeric: true },
    ], 'sessions', { caption: t('funnel.checkpointTitle') }), ['funnel.checkpoint']));
}

/** The adaptive-questionnaire table: one purpose at a time, every question
 *  in catalog order, by its real wording and its ID. */
function questionPanel(funnel) {
  var purposes = [];
  (funnel.byPurpose || []).forEach(function (row) { if (row.purpose && purposes.indexOf(row.purpose) === -1) purposes.push(row.purpose); });
  (funnel.questions || []).forEach(function (row) { if (purposes.indexOf(row.purpose) === -1) purposes.push(row.purpose); });
  if (purposes.indexOf(state.funnelPurpose) === -1) state.funnelPurpose = purposes[0] || null;

  var section = node('section', 'panel');
  section.id = 'questionsPanel';
  var head = node('div', 'panel-head');
  var titles = node('div');
  titles.append(node('h2', '', t('funnel.questionsTitle')), node('p', 'hint', t('funnel.questionsHint')));
  head.append(titles);
  if (purposes.length) {
    var field = node('div', 'inline-field');
    var label = node('label', '', t('funnel.showPurpose'));
    label.setAttribute('for', 'funnelPurpose');
    var select = node('select');
    select.id = 'funnelPurpose';
    purposes.forEach(function (purpose) {
      var option = node('option', '', purposeLabel(purpose));
      option.value = purpose;
      if (purpose === state.funnelPurpose) option.selected = true;
      select.append(option);
    });
    select.addEventListener('change', function () {
      state.funnelPurpose = select.value;
      var fresh = questionPanel(funnel);
      section.replaceWith(fresh);
      var again = el('funnelPurpose');
      if (again) again.focus();
    });
    field.append(label, select);
    head.append(field);
  }
  section.append(head);

  var rowsData = (funnel.questions || []).filter(function (row) { return row.purpose === state.funnelPurpose; });
  section.append(rankTable(rowsData, [
    { key: 'catalogOrder', label: t('funnel.colOrder'), format: function (row) { return row.catalogOrder === null ? t('common.dash') : String(row.catalogOrder); } },
    { key: 'text', label: t('funnel.colQuestion'), format: function (row) {
      var wrap = node('span', 'qtext');
      wrap.append(document.createTextNode(row.text ? tr(row.text) : t('funnel.notInCatalog')));
      var id = node('span', 'qid', row.questionId);
      id.setAttribute('dir', 'ltr');
      id.setAttribute('title', t('funnel.questionId'));
      wrap.append(id);
      return wrap;
    } },
    { key: 'averagePosition', label: t('funnel.colPosition'), numeric: true, format: function (row) {
      if (row.averagePosition === null) return t('common.dash');
      return row.firstPosition === row.lastPosition ? String(row.averagePosition) : row.averagePosition + ' (' + row.firstPosition + '–' + row.lastPosition + ')';
    } },
    { key: 'sessions', label: t('funnel.colSessions'), numeric: true },
    { key: 'answers', label: t('funnel.colAnswers'), numeric: true },
    { key: 'completedAfter', label: t('funnel.colCompletedAfter'), numeric: true },
    { key: 'stoppedHere', label: t('funnel.colStopped'), numeric: true },
    { key: 'stillAnswering', label: t('funnel.colStillAnswering'), numeric: true },
    { key: 'dropOffRate', label: t('funnel.colDropOff'), numeric: true, format: function (row) { return pct(row.dropOffRate); } },
  ], 'dropOffRate', { caption: t('funnel.questionsTitle') + ' — ' + purposeLabel(state.funnelPurpose), wide: true, tall: true }));
  var definition = definitionBlock(['funnel.question.sessions', 'funnel.question.answers', 'funnel.question.averagePosition', 'funnel.question.completedAfter', 'funnel.question.stoppedHere', 'funnel.question.dropOff']);
  if (definition) section.append(definition);
  return section;
}

function renderQuality(root, data) {
  var quality = data.quality;
  root.append(panel(t('quality.distributionTitle'), t('quality.distributionHint'),
    rankTable(quality.distribution, [{ key: 'score', label: t('quality.score') }, { key: 'count', label: t('quality.count'), numeric: true }], 'count', { caption: t('quality.distributionTitle') }),
    ['quality.distribution']));
  root.append(panel(t('quality.byKindTitle'), t('quality.byKindHint'),
    rankTable(quality.byKind, [
      { key: 'kind', label: t('quality.kind'), format: function (row) { return enumLabel('ratingKind', row.kind); } },
      { key: 'count', label: t('quality.count'), numeric: true },
      { key: 'average', label: t('quality.average'), numeric: true, format: function (row) { return row.average; } },
    ], 'count', { caption: t('quality.byKindTitle') }), ['overview.averageRating']));
  root.append(panel(t('quality.countryTitle'), t('quality.countryHint'),
    rankTable(quality.countryRatings, [
      { key: 'country_code', label: t('quality.country'), format: function (row) { return countryContent(row.country_code); } },
      { key: 'count', label: t('quality.ratingsCount'), numeric: true },
      { key: 'average', label: t('quality.average'), numeric: true, format: function (row) { return row.average; } },
    ], 'count', { caption: t('quality.countryTitle'), rowAction: function (row) { return countryFilterAction(row.country_code); } }),
    ['quality.countryAverage']));

  root.append(panel(t('quality.negativeTitle'), t('quality.negativeHint'),
    rankTable(quality.negativeComments, [
      { key: 'created_at', label: t('quality.colWhen'), format: function (row) { return when(row.created_at); } },
      { key: 'kind', label: t('quality.colKind'), format: function (row) { return enumLabel('ratingKind', row.kind); } },
      { key: 'score', label: t('quality.colScore'), numeric: true },
      { key: 'country_code', label: t('quality.colCountry'), format: function (row) { return countryContent(row.country_code); } },
      { key: 'origin', label: t('quality.colArrivedVia'), format: function (row) { return enumLabel('arrival', row.origin); } },
      { key: 'comment', label: t('quality.colComment'), format: function (row) { return freeTextNode('span', '', row.comment || ''); } },
    ], null, { caption: t('quality.negativeTitle'), empty: t('quality.negativeEmpty'), wide: true })));

  root.append(panel(t('quality.setsTitle'), t('quality.setsHint'),
    rankTable(quality.poorResultSets, [
      { key: 'created_at', label: t('quality.colWhen'), format: function (row) { return when(row.created_at); } },
      { key: 'score', label: t('quality.colScore'), numeric: true },
      { key: 'result_context_json', label: t('quality.colRecommendedSet'), format: function (row) {
        var parsed = [];
        try { parsed = JSON.parse(row.result_context_json || '[]'); } catch (error) { parsed = []; }
        return parsed.map(function (item) { return countryName(item.countryCode) + ' ' + item.score; }).join(state.lang === 'ar' ? '، ' : ', ');
      } },
    ], null, { caption: t('quality.setsTitle'), empty: t('quality.setsEmpty') })));

  var byPath = {};
  (quality.pathContext || []).forEach(function (row) {
    var key = (row.purpose || '') + '|' + (row.answers || 0);
    byPath[key] = byPath[key] || { purpose: row.purpose, answers: row.answers || 0, ratings: 0, total: 0 };
    byPath[key].ratings += 1;
    byPath[key].total += Number(row.score) || 0;
  });
  var paths = Object.keys(byPath).map(function (key) {
    var entry = byPath[key];
    return { purpose: entry.purpose, answers: entry.answers, ratings: entry.ratings, average: Math.round((entry.total / entry.ratings) * 100) / 100 };
  }).sort(function (a, b) { return a.average - b.average; });
  root.append(panel(t('quality.pathTitle'), t('quality.pathHint'),
    rankTable(paths, [
      { key: 'purpose', label: t('quality.path'), format: function (row) { return purposeLabel(row.purpose) + ' · ' + row.answers + ' ' + t('quality.answersWord'); } },
      { key: 'ratings', label: t('quality.ratingsLabel'), numeric: true },
      { key: 'average', label: t('quality.average'), numeric: true, format: function (row) { return row.average; } },
    ], 'ratings', { caption: t('quality.pathTitle') }), ['quality.pathAverage']));
}

function countryTable(rowsData, valueLabel, captionText) {
  return rankTable(rowsData, [
    { key: 'country_code', label: t('countries.countryCol'), format: function (row) { return countryContent(row.country_code); } },
    { key: 'count', label: valueLabel, numeric: true },
  ], 'count', { caption: captionText, rowAction: function (row) { return countryFilterAction(row.country_code); } });
}

function renderCountries(root, data) {
  var countries = data.countries;
  var cards = node('div', 'kpis');
  kpi(cards, 'countries.everRecommended', num(countries.recommendedCountryCount), '/ 194');
  kpi(cards, 'countries.surpriseOpened', num(countries.surpriseOpened), null, 'discovery');
  root.append(panel(t('countries.sectionTitle'), '', cards));
  root.append(panel(t('countries.mostTitle'), t('countries.mostHint'), countryTable(countries.mostRecommended, t('countries.appearances'), t('countries.mostTitle')), ['countries.appearances']));
  root.append(panel(t('countries.leastTitle'), t('countries.leastHint'), countryTable(countries.leastRecommended, t('countries.appearances'), t('countries.leastTitle'))));
  root.append(panel(t('countries.openedTitle'), t('countries.openedHint'), countryTable(countries.mostOpened, t('countries.opens'), t('countries.openedTitle')), ['countries.opens']));
  root.append(panel(t('countries.surpriseTitle'), t('countries.surpriseHint'), countryTable(countries.surpriseShown, t('countries.landings'), t('countries.surpriseTitle')), ['countries.surpriseLandings']));
  root.append(panel(t('countries.feedbackTitle'), t('countries.feedbackHint'), countryTable(countries.countryFeedback, t('countries.feedbackCount'), t('countries.feedbackTitle')), ['countries.reports']));
}

function exploreTable(rowsData, filter, valueLabel, captionText) {
  return rankTable(rowsData, [
    { key: 'value', label: valueLabel, format: function (row) { return exploreLabel(filter, row.value); } },
    { key: 'count', label: t('discovery.uses'), numeric: true },
  ], 'count', { caption: captionText });
}

function renderDiscovery(root, data) {
  var discovery = data.discovery;
  var cards = node('div', 'kpis');
  kpi(cards, 'discovery.searchInteractions', num(discovery.searchEvents));
  var searchShare = discovery.searchEvents ? Math.round((discovery.searchWithText / discovery.searchEvents) * 1000) / 10 : null;
  kpi(cards, 'discovery.searchWithText', num(discovery.searchWithText), pct(searchShare));
  kpi(cards, 'discovery.filterResets', num(discovery.filterResets));
  kpi(cards, 'discovery.surpriseSpins', num(discovery.surpriseSpins));
  kpi(cards, 'discovery.surpriseSessions', num(discovery.surpriseSessions));
  root.append(panel(t('discovery.sectionTitle'), t('discovery.sectionHint'), cards));
  root.append(panel(t('discovery.openedTitle'), t('discovery.openedHint'),
    rankTable(discovery.openedBySource, [
      { key: 'source', label: t('discovery.source'), format: function (row) { return enumLabel('arrival', row.source); } },
      { key: 'count', label: t('discovery.opens'), numeric: true },
      { key: 'sessions', label: t('discovery.sessions'), numeric: true },
    ], 'count', { caption: t('discovery.openedTitle') }), ['countries.opens']));
  root.append(panel(t('discovery.filtersTitle'), t('discovery.filtersHint'),
    rankTable(discovery.filtersUsed, [
      { key: 'filter', label: t('discovery.filter'), format: function (row) { return exploreFilterLabel(row.filter); } },
      { key: 'count', label: t('discovery.changes'), numeric: true },
    ], 'count', { caption: t('discovery.filtersTitle') }), ['discovery.filterChanges']));
  var grid = node('div', 'grid2');
  grid.append(panel(t('discovery.sortTitle'), '', exploreTable(discovery.sortUsed, 'sort', t('discovery.sort'), t('discovery.sortTitle'))));
  grid.append(panel(t('discovery.distanceTitle'), t('discovery.distanceHint'), exploreTable(discovery.distanceSortUsed, 'sort', t('discovery.sort'), t('discovery.distanceTitle'))));
  grid.append(panel(t('discovery.regionTitle'), '', exploreTable(discovery.regionUsed, 'region', t('discovery.region'), t('discovery.regionTitle'))));
  grid.append(panel(t('discovery.costTitle'), '', exploreTable(discovery.costUsed, 'cost', t('discovery.cost'), t('discovery.costTitle'))));
  grid.append(panel(t('discovery.purposeTitle'), '', exploreTable(discovery.purposeUsed, 'purpose', t('discovery.purpose'), t('discovery.purposeTitle'))));
  root.append(grid);
}

function renderLocation(root, data) {
  var location = data.location;
  var cards = node('div', 'kpis');
  kpi(cards, 'location.asked', num(location.sessionsThatAsked));
  kpi(cards, 'location.granted', num(location.sessionsThatGranted));
  kpi(cards, 'location.grantRate', pct(location.grantRate), num(location.sessionsThatGranted) + ' ÷ ' + num(location.sessionsThatAsked));
  root.append(panel(t('location.sectionTitle'), t('location.sectionHint'), cards));
  root.append(panel(t('location.permissionTitle'), t('location.permissionHint'),
    rankTable(location.permission, [
      { key: 'outcome', label: t('location.outcome'), format: function (row) { return enumLabel('locationOutcome', row.outcome); } },
      { key: 'events', label: t('location.events'), numeric: true },
      { key: 'sessions', label: t('location.sessionsCount'), numeric: true },
    ], 'events', { caption: t('location.permissionTitle') }), ['location.statusChanges']));
  root.append(panel(t('location.requestTitle'), t('location.requestHint'),
    rankTable(location.requestOutcomes, [
      { key: 'outcome', label: t('location.outcome'), format: function (row) { return enumLabel('locationOutcome', row.outcome); } },
      { key: 'events', label: t('location.events'), numeric: true },
      { key: 'sessions', label: t('location.sessionsCount'), numeric: true },
      { key: 'averageMs', label: t('location.avgMs'), numeric: true },
    ], 'events', { caption: t('location.requestTitle') }), ['location.requests']));
  root.append(panel(t('location.stageTitle'), t('location.stageHint'),
    rankTable(location.stageOutcomes, [
      { key: 'stage', label: t('location.stage') },
      { key: 'highAccuracy', label: t('location.accuracy'), format: function (row) { return enumLabel('accuracy', row.highAccuracy ? 'high' : 'standard'); } },
      { key: 'outcome', label: t('location.outcome'), format: function (row) { return enumLabel('locationOutcome', row.outcome); } },
      { key: 'attempts', label: t('location.attempts'), numeric: true },
    ], 'attempts', { caption: t('location.stageTitle') }), ['location.stageAttempts']));
  root.append(panel(t('location.edgeTitle'), t('location.edgeHint'),
    rankTable(location.edgeCountries, [
      { key: 'country', label: t('countries.countryCol'), format: function (row) { return countryContent(row.country); } },
      { key: 'count', label: t('location.sessionsCount'), numeric: true },
    ], 'count', { caption: t('location.edgeTitle') }), ['location.edgeSessions']));
}

function msValue(value) {
  return value === null || value === undefined ? t('common.dash') : num(value) + ' ' + t('technical.ms');
}

function renderTechnical(root, data) {
  var technical = data.technical;
  var performance = technical.performance || {};
  var cards = node('div', 'kpis');
  kpi(cards, 'technical.samples', num(performance.samples));
  kpi(cards, 'technical.ttfb', msValue(performance.ttfbMs));
  kpi(cards, 'technical.domReady', msValue(performance.domReadyMs));
  kpi(cards, 'technical.load', msValue(performance.loadMs));
  root.append(panel(t('technical.sectionTitle'), t('technical.sectionHint'), cards));
  root.append(panel(t('technical.errorsTitle'), t('technical.errorsHint'),
    rankTable(technical.errors, [
      { key: 'kind', label: t('technical.errorKind'), format: function (row) { var code = node('span', 'code', row.kind || t('common.dash')); code.setAttribute('dir', 'ltr'); return code; } },
      { key: 'script', label: t('technical.errorScript'), format: function (row) { var code = node('span', 'code', row.script || t('common.dash')); code.setAttribute('dir', 'ltr'); return code; } },
      { key: 'count', label: t('technical.count'), numeric: true },
    ], 'count', { caption: t('technical.errorsTitle') }), ['technical.errors']));
  var grid = node('div', 'grid2');
  var groups = [
    [t('technical.browserFamily'), technical.browsers, 'browser', function (value) { return enumLabel('browser', value); }, t('technical.sessions')],
    [t('technical.deviceClass'), technical.devices, 'device', function (value) { return value ? (t('devices.' + value) || value) : t('common.dash'); }, t('technical.sessions')],
    [t('technical.language'), technical.locales, 'locale', function (value) { return enumLabel('locale', value); }, t('technical.sessions')],
    [t('technical.theme'), technical.themes, 'theme', function (value) { return enumLabel('theme', value); }, t('technical.pageViews')],
    [t('technical.referrer'), technical.referrers, 'referrer', function (value) { var code = node('span', 'code', value || t('common.dash')); code.setAttribute('dir', 'ltr'); return code; }, t('technical.sessions')],
  ];
  groups.forEach(function (entry) {
    grid.append(panel(entry[0], '', rankTable(entry[1], [
      { key: entry[2], label: entry[0], format: function (row) { return entry[3](row[entry[2]]); } },
      { key: 'count', label: entry[4], numeric: true },
    ], 'count', { caption: entry[0] })));
  });
  root.append(grid);
  root.append(panel(t('technical.sectionTitle'), '', null, ['technical.sessionsBy', 'technical.themeViews']));
}

function renderIntelligenceHealth(root, data) {
  var intelligence = data.intelligence;
  var cards = node('div', 'kpis');
  kpi(cards, 'intelligence.countriesCovered', num(intelligence.totalCountries), '/ 194');
  var generated = (intelligence.generatedAt || '').slice(0, 10);
  var age = intelligence.generatedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(intelligence.generatedAt)) / 86400000)) : null;
  kpi(cards, 'intelligence.generatedAt', generated || t('common.dash'), age === null ? null : formatMessage('common.daysAgo', { days: age }));
  var intelligencePanel = panel(t('intelligence.title'), t('intelligence.hint'), cards);
  var sourceLine = node('p', 'hint');
  sourceLine.append(document.createTextNode(t('intelligence.sourceFiles') + ' '));
  var files = node('span', 'code', 'worker/src/generated/countryIntelligenceDetail.json · COUNTRY_INTELLIGENCE.md');
  files.setAttribute('dir', 'ltr');
  sourceLine.append(files);
  intelligencePanel.insertBefore(sourceLine, intelligencePanel.querySelector('.kpis'));
  root.append(intelligencePanel);
  var rows = intelligence.purposes.map(function (p) {
    return {
      purpose: p.purpose,
      modelVersion: p.modelVersion,
      sufficient: p.sufficientDataCount,
      total: p.totalCountries,
      averageCoverage: p.averageCoverage,
      highConfidence: p.confidenceHighCount,
    };
  });
  root.append(panel(t('intelligence.tableTitle'), '', rankTable(rows, [
    { key: 'purpose', label: t('intelligence.purpose'), format: function (row) { return purposeLabel(row.purpose); } },
    { key: 'modelVersion', label: t('intelligence.modelVersion'), format: function (row) { var code = node('span', 'code', row.modelVersion); code.setAttribute('dir', 'ltr'); return code; } },
    { key: 'sufficient', label: t('intelligence.sufficientCount'), numeric: true, format: function (row) { return num(row.sufficient) + ' / ' + num(row.total); } },
    { key: 'averageCoverage', label: t('intelligence.averageCoverage'), numeric: true, format: function (row) { return pct(row.averageCoverage); } },
    { key: 'highConfidence', label: t('intelligence.highConfidenceCount'), numeric: true },
  ], 'highConfidence', { caption: t('intelligence.tableTitle') }), ['intelligence.sufficient', 'intelligence.averageCoverage', 'intelligence.highConfidence']));
}

function renderContent(root, data) {
  renderIntelligenceHealth(root, data);
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
  kpi(cards, 'content.lookedUp', num(total));
  kpi(cards, 'content.verified', num(verified), total ? pct(Math.round((verified / total) * 1000) / 10) : null);
  kpi(cards, 'content.countriesSeen', num(content.countriesSeen), '/ 194');
  root.append(panel(t('content.coverageTitle'), t('content.coverageHint'), cards));
  root.append(panel(t('content.statusTitle'), t('content.statusHint'),
    rankTable(content.byStatus, [
      { key: 'status', label: t('content.status'), format: function (row) { return enumLabel('contentStatus', row.status); } },
      { key: 'count', label: t('content.cities'), numeric: true },
    ], 'count', { caption: t('content.statusTitle') })));
  root.append(panel(t('content.langTitle'), '',
    rankTable(content.byLang, [
      { key: 'lang', label: t('content.lang'), format: function (row) { return enumLabel('locale', row.lang); } },
      { key: 'verified', label: t('content.verifiedCol'), numeric: true },
      { key: 'count', label: t('content.lookedUpCol'), numeric: true },
    ], 'count', { caption: t('content.langTitle') })));
}

// ----------------------------------------------------- reports and feedback

/** Report status and type values render as labels; the value sent to the
 *  API stays the fixed English code. An unknown value is shown as it is. */
function statusLabel(status) {
  return t('reportStatus.' + status) || status;
}
function typeLabel(type) {
  return t('reportType.' + type) || type;
}

function statusChip(status) {
  return node('span', 'chip ' + status, statusLabel(status));
}

var STATUS_VALUES = ['new', 'triaged', 'in_progress', 'resolved', 'declined'];
var TYPE_VALUES = ['wrong_info', 'image', 'bug', 'suggestion', 'results', 'translation', 'other'];

function selectField(id, labelText, values, current, labelFor) {
  var wrap = node('div');
  var label = node('label', '', labelText);
  label.setAttribute('for', id);
  wrap.append(label);
  var select = node('select');
  select.id = id;
  [''].concat(values).forEach(function (value) {
    var option = node('option', '', value === '' ? t('filters.any') : labelFor(value));
    option.value = value;
    if (current === value) option.selected = true;
    select.append(option);
  });
  wrap.append(select);
  return { wrap: wrap, select: select };
}

function renderReports(root) {
  var controls = node('div', 'filters');
  var search = node('div');
  var searchLabel = node('label', '', t('reports.search'));
  searchLabel.setAttribute('for', 'r_q');
  search.append(searchLabel);
  var input = node('input');
  input.id = 'r_q'; input.type = 'search'; input.placeholder = t('reports.searchPlaceholder');
  input.value = state.feedbackQuery.q;
  search.append(input);
  controls.append(search);

  var status = selectField('r_status', t('reports.status'), STATUS_VALUES, state.feedbackQuery.status, statusLabel);
  var type = selectField('r_type', t('reports.type'), TYPE_VALUES, state.feedbackQuery.type, typeLabel);
  var screenshot = selectField('r_screenshot', t('reports.screenshot'), ['yes', 'no'], state.feedbackQuery.screenshot, function (value) {
    return value === 'yes' ? t('reports.screenshotYes') : t('reports.screenshotNo');
  });
  controls.append(status.wrap, type.wrap, screenshot.wrap);

  var actions = node('div', 'actions');
  var apply = node('button', 'primary', t('reports.searchAction'));
  apply.type = 'button';
  apply.addEventListener('click', function () {
    state.feedbackQuery = { q: input.value, status: status.select.value, type: type.select.value, screenshot: screenshot.select.value };
    loadFeedback();
  });
  input.addEventListener('keydown', function (event) { if (event.key === 'Enter') apply.click(); });
  actions.append(apply);
  controls.append(actions);
  root.append(panel(t('reports.title'), t('reports.hint'), controls));

  var listRoot = node('div');
  listRoot.id = 'reportList';
  root.append(listRoot);
  renderFeedbackList();

  var commentsRoot = node('div');
  commentsRoot.id = 'commentList';
  root.append(commentsRoot);
  renderRatingComments();
}

function renderFeedbackList() {
  var listRoot = el('reportList');
  if (!listRoot) return;
  listRoot.replaceChildren();
  if (!state.feedback) { listRoot.append(node('p', 'empty', t('common.loading'))); return; }
  var summary = node('div', 'kpis');
  kpi(summary, 'reports.matching', num(state.feedback.total));
  kpi(summary, 'reports.withScreenshot', num(state.feedback.withScreenshot));
  (state.feedback.byStatus || []).forEach(function (row) { stat(summary, statusLabel(row.status), num(row.count)); });
  listRoot.append(panel(t('reports.queueTitle'), '', summary));
  if (state.feedback.byType && state.feedback.byType.length) {
    listRoot.append(panel(t('reports.byType'), '', rankTable(state.feedback.byType, [
      { key: 'type', label: t('reports.colType'), format: function (row) { return typeLabel(row.type); } },
      { key: 'count', label: t('technical.count'), numeric: true },
    ], 'count', { caption: t('reports.byType') })));
  }

  listRoot.append(panel(t('reports.resultsTitle'), t('reports.resultsHint'), rankTable(state.feedback.items, [
    { key: 'reference_id', label: t('reports.colReference'), format: function (row) { var code = node('span', 'code', row.reference_id); code.setAttribute('dir', 'ltr'); return code; } },
    { key: 'created_at', label: t('reports.colWhen'), format: function (row) { return when(row.created_at); } },
    { key: 'type', label: t('reports.colType'), format: function (row) { return typeLabel(row.type || ''); } },
    { key: 'country_code', label: t('reports.colCountry'), format: function (row) { return countryContent(row.country_code); } },
    { key: 'message', label: t('reports.colMessage'), format: function (row) { return freeTextNode('span', '', (row.message || '').slice(0, 90)); } },
    { key: 'has_screenshot', label: t('reports.colScreenshot'), format: function (row) { return row.has_screenshot ? t('common.yes') : t('common.no'); } },
    { key: 'status', label: t('reports.colStatus'), format: function (row) { return statusChip(row.status || 'new'); } },
  ], null, {
    caption: t('reports.resultsTitle'), empty: t('reports.resultsEmpty'), wide: true,
    rowAction: function (row) {
      var open = node('button', 'small ghost', t('reports.open'));
      open.type = 'button';
      open.setAttribute('aria-label', t('reports.open') + ' ' + row.reference_id);
      open.setAttribute('data-reference', row.reference_id);
      open.addEventListener('click', function () { openReport(row, open); });
      return open;
    },
  })));
  // After a save the list is rebuilt; focus returns to the same report's
  // Open button instead of falling back to the top of the document.
  if (state.focusReference) {
    // Compared as data, never built into a selector.
    var wanted = state.focusReference;
    state.focusReference = null;
    var buttons = listRoot.querySelectorAll('button[data-reference]');
    for (var i = 0; i < buttons.length; i += 1) {
      if (buttons[i].getAttribute('data-reference') === wanted) { buttons[i].focus(); break; }
    }
  }
}

function renderRatingComments() {
  var root = el('commentList');
  if (!root) return;
  root.replaceChildren();
  var kind = selectField('c_kind', t('reports.kind'), ['results', 'destination'], state.commentKind, function (value) { return enumLabel('ratingKind', value); });
  kind.select.addEventListener('change', function () {
    state.commentKind = kind.select.value;
    loadComments();
  });
  var head = node('div', 'filters');
  head.append(kind.wrap);
  var content = node('div');
  content.append(head);
  if (!state.comments) content.append(node('p', 'empty', t('common.loading')));
  else content.append(rankTable(state.comments.items, [
    { key: 'created_at', label: t('quality.colWhen'), format: function (row) { return when(row.created_at); } },
    { key: 'kind', label: t('quality.colKind'), format: function (row) { return enumLabel('ratingKind', row.kind); } },
    { key: 'score', label: t('quality.colScore'), numeric: true },
    { key: 'country_code', label: t('quality.colCountry'), format: function (row) { return countryContent(row.country_code); } },
    { key: 'origin', label: t('quality.colArrivedVia'), format: function (row) { return enumLabel('arrival', row.origin); } },
    { key: 'comment', label: t('quality.colComment'), format: function (row) { return freeTextNode('span', '', row.comment || ''); } },
  ], null, { caption: t('reports.commentsTitle'), empty: t('reports.commentsEmpty'), wide: true }));
  root.append(panel(t('reports.commentsTitle'), t('reports.commentsHint'), content, ['reports.ratingComments']));
}

function loadComments() {
  var params = filters();
  params.set('comments', '1');
  if (state.commentKind) params.set('kind', state.commentKind);
  state.comments = null;
  renderRatingComments();
  api('/api/admin/ratings', params).then(function (data) {
    state.comments = data.ratings;
    renderRatingComments();
  }).catch(function (error) {
    state.comments = { items: [], total: 0 };
    renderRatingComments();
    showError('error', error.i18nKey || 'errors.network', error.i18nParams);
  });
}

function openReport(row, opener) {
  var dialog = el('reportDialog');
  var content = el('reportBody');
  content.replaceChildren();
  var line = function (label, value) {
    var block = node('div', 'detail-line');
    block.append(node('b', '', label));
    if (value && typeof value === 'object' && value.nodeType) block.append(value);
    else block.append(document.createTextNode(value === null || value === undefined || value === '' ? t('common.dash') : String(value)));
    return block;
  };
  var reference = node('h3', 'code', row.reference_id);
  reference.setAttribute('dir', 'ltr');
  content.append(reference);
  content.append(line(t('reportDetail.received'), when(row.created_at)));
  content.append(line(t('reportDetail.type'), typeLabel(row.type || '')));
  var page = node('span', 'code', row.path || t('common.dash'));
  page.setAttribute('dir', 'ltr');
  content.append(line(t('reportDetail.page'), page));
  content.append(line(t('reportDetail.country'), countryContent(row.country_code)));
  content.append(line(t('reportDetail.language'), enumLabel('locale', row.locale)));
  content.append(line(t('reportDetail.contactEmail'), row.email));
  content.append(line(t('reportDetail.screenshot'), row.has_screenshot ? t('reportDetail.screenshotAttached') : t('reportDetail.screenshotNone')));
  content.append(line(t('reportDetail.statusChanged'), row.status_changed_at ? when(row.status_changed_at) : null));
  var messageBlock = node('div', 'detail-line');
  messageBlock.append(node('b', '', t('reportDetail.message')));
  messageBlock.append(freeTextNode('div', 'message', row.message || ''));
  content.append(messageBlock);

  el('reportReference').value = row.reference_id;
  el('reportStatus').value = row.status || 'new';
  el('reportNote').value = row.admin_note || '';
  el('reportSave').disabled = false;
  el('reportSave').textContent = t('reportDetail.save');
  showError('reportError', null);
  state.reportOpener = opener || null;
  dialog.showModal();
}

function loadFeedback() {
  var params = filters();
  if (state.feedbackQuery.q) params.set('q', state.feedbackQuery.q);
  if (state.feedbackQuery.status) params.set('status', state.feedbackQuery.status);
  if (state.feedbackQuery.type) params.set('type', state.feedbackQuery.type);
  if (state.feedbackQuery.screenshot) params.set('screenshot', state.feedbackQuery.screenshot);
  state.feedback = null;
  renderFeedbackList();
  if (!state.comments) loadComments();
  api('/api/admin/feedback', params).then(function (data) {
    state.feedback = data;
    renderFeedbackList();
  }).catch(function (error) {
    state.feedback = { items: [], total: 0, withScreenshot: 0, byStatus: [], byType: [] };
    renderFeedbackList();
    showError('error', error.i18nKey || 'errors.network', error.i18nParams);
  });
}

function announce(text) {
  var live = el('liveStatus');
  live.textContent = '';
  // A fresh text node on the next frame, so a repeated message is re-read.
  window.setTimeout(function () { live.textContent = text; }, 50);
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
    button.type = 'button';
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
  state.comments = null;
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
    var save = el('reportSave');
    if (save.disabled) return;
    var payload = {
      referenceId: el('reportReference').value,
      status: el('reportStatus').value,
      note: el('reportNote').value,
    };
    // One request at a time: the button is disabled and says so until the
    // server answers, so a double click cannot send two updates.
    save.disabled = true;
    save.textContent = t('reports.saving');
    showError('reportError', null);
    api('/api/admin/feedback/status', null, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function () {
      state.focusReference = payload.referenceId;
      state.reportOpener = null;
      el('reportDialog').close();
      announce(formatMessage('reports.saved', { reference: payload.referenceId, status: statusLabel(payload.status) }));
      loadFeedback();
    }).catch(function (error) {
      // The dialog stays open with the operator's edits intact.
      save.disabled = false;
      save.textContent = t('reportDetail.save');
      showError('reportError', error.i18nKey || 'errors.network', error.i18nParams);
    });
  });
  el('reportClose').addEventListener('click', function (event) { event.preventDefault(); el('reportDialog').close(); });
  el('reportDialog').addEventListener('close', function () {
    if (state.reportOpener && document.body.contains(state.reportOpener)) state.reportOpener.focus();
    state.reportOpener = null;
  });

  // Under Cloudflare Access the browser already carries the Access cookie,
  // so there is nothing to type: try straight away and only fall back to the
  // token form if that fails.
  load();
});
`;

/** Serialized once per request and embedded ahead of SCRIPT as globals, so
 *  the browser-side script (which cannot `import`) has a single source of
 *  truth instead of a hand-duplicated copy: the dictionary, the metric
 *  dictionary, and the public site's Explore vocabulary. `</script` inside
 *  any string would otherwise terminate the tag early — defensive escaping
 *  even though no current string contains it. */
function embed(name: string, value: unknown): string {
  return `var ${name} = ${JSON.stringify(value).replace(/<\/script/gi, '<\\/script')};\n`;
}

function embeddedData(): string {
  const { questions: _questions, source: _source, ...vocabulary } = adminCatalog;
  return embed('ADMIN_I18N', ADMIN_I18N) + embed('ADMIN_METRICS', ADMIN_METRICS) + embed('ADMIN_VOCAB', vocabulary);
}

export function adminPage(): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="data:,">
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
    <p class="visually-hidden" id="liveStatus" role="status" aria-live="polite"></p>
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

<script>${embeddedData()}${SCRIPT}</script>
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
