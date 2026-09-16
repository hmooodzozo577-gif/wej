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
.filters .actions{display:flex;gap:8px}
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
@media (max-width:640px){
  .wrap{padding:16px 14px 60px}
  .kpi .value{font-size:1.5rem}
}
`;

const SCRIPT = String.raw`
var state = { token: '', data: null, tab: 'overview', feedback: null, feedbackQuery: { q: '', status: '', type: '' } };
var el = function (id) { return document.getElementById(id); };
var num = function (value) { return value === null || value === undefined ? '—' : Number(value).toLocaleString('en-US'); };
var pct = function (value) { return value === null || value === undefined ? '—' : value + '%'; };

function node(tag, className, text) {
  var element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
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
    if (response.status === 401) throw new Error('Not authorised. Check the admin token, or sign in through Cloudflare Access.');
    if (response.status === 503) throw new Error('The admin surface is not configured, or the product database is unavailable.');
    if (!response.ok) throw new Error('Request failed (' + response.status + ')');
    return response.json();
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
  if (!rowsData || !rowsData.length) return node('p', 'empty', 'No data in this range.');
  var max = rowsData.reduce(function (best, row) { return Math.max(best, Number(row[valueKey]) || 0); }, 0) || 1;
  var table = node('table');
  var head = node('tr');
  columns.forEach(function (column) {
    var th = node('th', column.numeric ? 'num' : '', column.label);
    head.append(th);
  });
  head.append(node('th', '', ''));
  table.append(node('thead')).firstChild.append(head);
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
  if (labels.length < 2) return node('p', 'empty', 'Not enough days in this range to plot a trend.');
  var width = 640;
  var h = height || 180;
  var pad = { top: 12, right: 10, bottom: 22, left: 34 };
  var max = 1;
  series.forEach(function (entry) {
    (entry.rows || []).forEach(function (row) { max = Math.max(max, Number(row.value) || 0); });
  });
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
  kpi(cards, 'Sessions', num(overview.sessions));
  kpi(cards, 'Page views', num(overview.visits));
  kpi(cards, 'Questionnaire starts', num(overview.questionnaireStarts));
  kpi(cards, 'Completions', num(overview.questionnaireCompletions));
  kpi(cards, 'Completion rate', pct(overview.completionRate), 'completions ÷ starts');
  kpi(cards, 'Results viewed', num(overview.resultsViewed));
  kpi(cards, 'Ratings', num(overview.ratingCount));
  kpi(cards, 'Average rating', overview.averageRating === null ? '—' : overview.averageRating, 'out of 5');
  kpi(cards, 'Reports', num(overview.feedbackCount));
  root.append(panel('Overview', 'Everything below respects the filter bar above.', cards));

  root.append(panel('Daily trend', 'Sessions, completed questionnaires and ratings.', lineChart([
    { label: 'Sessions', rows: data.trend.sessionsPerDay, color: '#d9a85c' },
    { label: 'Completions', rows: data.trend.completionsPerDay, color: '#48b3a5' },
    { label: 'Ratings', rows: data.trend.ratingsPerDay, color: '#9aa9bb' },
  ])));
}

function renderFunnel(root, data) {
  var funnel = data.funnel;
  var cards = node('div', 'kpis');
  kpi(cards, 'Average questions answered', funnel.averageQuestionsAnswered === null ? '—' : funnel.averageQuestionsAnswered);
  (funnel.checkpointChoice || []).forEach(function (row) {
    kpi(cards, 'Checkpoint: ' + row.choice, num(row.count), row.choice === 'results' ? 'took early results' : 'kept answering');
  });
  root.append(panel('Questionnaire funnel', 'How far people get, and where they stop.', cards));
  root.append(panel('Progression by question', 'Distinct sessions that answered each question number.',
    rankTable(funnel.byQuestion, [{ key: 'questionNumber', label: 'Question' }, { key: 'sessions', label: 'Sessions', numeric: true }], 'sessions')));
  root.append(panel('Abandonment point', 'Last question answered by sessions that never reached results.',
    rankTable(funnel.abandonedAtQuestion, [{ key: 'lastQuestion', label: 'Stopped after question' }, { key: 'sessions', label: 'Sessions', numeric: true }], 'sessions')));
  root.append(panel('Purpose distribution', 'Which purpose people chose to start with.',
    rankTable(funnel.purposeDistribution, [{ key: 'purpose', label: 'Purpose' }, { key: 'count', label: 'Starts', numeric: true }], 'count')));
}

function renderQuality(root, data) {
  var quality = data.quality;
  root.append(panel('Rating distribution', 'All ratings in range, by score.',
    rankTable(quality.distribution, [{ key: 'score', label: 'Score' }, { key: 'count', label: 'Count', numeric: true }], 'count')));
  root.append(panel('By rating kind', 'A results rating covers a whole recommendation set; a destination rating covers one country.',
    rankTable(quality.byKind, [{ key: 'kind', label: 'Kind' }, { key: 'count', label: 'Count', numeric: true }, { key: 'average', label: 'Average', numeric: true }], 'count')));
  root.append(panel('Country ratings', 'Lowest average first — the countries whose pages disappoint.',
    rankTable(quality.countryRatings, [{ key: 'country_code', label: 'Country' }, { key: 'count', label: 'Ratings', numeric: true }, { key: 'average', label: 'Average', numeric: true }], 'count')));

  var negatives = node('div', 'scroll');
  if (!quality.negativeComments || !quality.negativeComments.length) {
    negatives.append(node('p', 'empty', 'No low ratings with a written comment in this range.'));
  } else {
    var table = node('table');
    var head = node('tr');
    ['When', 'Kind', 'Score', 'Country', 'Arrived via', 'Comment'].forEach(function (label) { head.append(node('th', '', label)); });
    table.append(node('thead')).firstChild.append(head);
    var body = node('tbody');
    quality.negativeComments.forEach(function (row) {
      var tr = node('tr');
      tr.append(node('td', '', (row.created_at || '').slice(0, 16).replace('T', ' ')));
      tr.append(node('td', '', row.kind));
      tr.append(node('td', 'num', row.score));
      tr.append(node('td', '', row.country_code || '—'));
      tr.append(node('td', '', row.origin || '—'));
      tr.append(node('td', '', row.comment || ''));
      body.append(tr);
    });
    table.append(body);
    negatives.append(table);
  }
  root.append(panel('What people said when they rated low', 'Scores of 1 or 2 that came with a written comment. This is the closest thing to a reason the product collects.', negatives));

  var sets = node('div', 'scroll');
  if (!quality.poorResultSets || !quality.poorResultSets.length) {
    sets.append(node('p', 'empty', 'No poorly-rated recommendation sets in this range.'));
  } else {
    var setTable = node('table');
    var setHead = node('tr');
    ['When', 'Score', 'Recommended set'].forEach(function (label) { setHead.append(node('th', '', label)); });
    setTable.append(node('thead')).firstChild.append(setHead);
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
  root.append(panel('Recommendation sets behind a poor rating', 'Which countries were on screen when someone rated the results 1 or 2.', sets));

  var byPurpose = {};
  (quality.pathContext || []).forEach(function (row) {
    var key = (row.purpose || 'unknown') + ' · ' + (row.answers || 0) + ' answers';
    byPurpose[key] = byPurpose[key] || { path: key, ratings: 0, total: 0 };
    byPurpose[key].ratings += 1;
    byPurpose[key].total += Number(row.score) || 0;
  });
  var paths = Object.keys(byPurpose).map(function (key) {
    var entry = byPurpose[key];
    return { path: entry.path, ratings: entry.ratings, average: Math.round((entry.total / entry.ratings) * 100) / 100 };
  }).sort(function (a, b) { return a.average - b.average; });
  root.append(panel('Questionnaire path behind a rating', 'Purpose and how many questions were answered — no identity, and nothing narrower.',
    rankTable(paths, [{ key: 'path', label: 'Path' }, { key: 'ratings', label: 'Ratings', numeric: true }, { key: 'average', label: 'Average', numeric: true }], 'ratings')));
}

function renderCountries(root, data) {
  var countries = data.countries;
  var cards = node('div', 'kpis');
  kpi(cards, 'Countries ever recommended', num(countries.recommendedCountryCount), 'out of 194 in the catalog');
  kpi(cards, 'Surprise Me results opened', num(countries.surpriseOpened));
  root.append(panel('Country performance', '', cards));
  root.append(panel('Most recommended', 'Appearances in a generated top-5.',
    rankTable(countries.mostRecommended, [{ key: 'country_code', label: 'Country' }, { key: 'count', label: 'Appearances', numeric: true }], 'count')));
  root.append(panel('Least recommended', 'Countries that DID appear, ranked from the rarest up. A country missing from both tables was never recommended at all in this range.',
    rankTable(countries.leastRecommended, [{ key: 'country_code', label: 'Country' }, { key: 'count', label: 'Appearances', numeric: true }], 'count')));
  root.append(panel('Most opened', 'Destination pages actually opened.',
    rankTable(countries.mostOpened, [{ key: 'country_code', label: 'Country' }, { key: 'count', label: 'Opens', numeric: true }], 'count')));
  root.append(panel('How people arrive at a destination page', '',
    rankTable(countries.openedBySource, [{ key: 'source', label: 'Source' }, { key: 'count', label: 'Opens', numeric: true }], 'count')));
  root.append(panel('Surprise Me appearances', 'Countries the wheel actually landed on.',
    rankTable(countries.surpriseShown, [{ key: 'country_code', label: 'Country' }, { key: 'count', label: 'Landings', numeric: true }], 'count')));
  root.append(panel('Country reports', 'Reports filed against a specific country page.',
    rankTable(countries.countryFeedback, [{ key: 'country_code', label: 'Country' }, { key: 'count', label: 'Reports', numeric: true }], 'count')));
}

function renderDiscovery(root, data) {
  var discovery = data.discovery;
  var cards = node('div', 'kpis');
  kpi(cards, 'Search interactions', num(discovery.searchEvents));
  kpi(cards, 'Searches with text', num(discovery.searchWithText));
  kpi(cards, 'Filter resets', num(discovery.filterResets));
  kpi(cards, 'Surprise spins', num(discovery.surpriseSpins));
  kpi(cards, 'Sessions that span', num(discovery.surpriseSessions));
  root.append(panel('Discovery', 'How people move through Explore.', cards));
  root.append(panel('Which filters get used', '',
    rankTable(discovery.filtersUsed, [{ key: 'filter', label: 'Filter' }, { key: 'count', label: 'Changes', numeric: true }], 'count')));
  root.append(panel('Sort usage', '',
    rankTable(discovery.sortUsed, [{ key: 'value', label: 'Sort' }, { key: 'count', label: 'Uses', numeric: true }], 'count')));
  root.append(panel('Nearest / farthest usage', 'The two sorts that need a shared location to work.',
    rankTable(discovery.distanceSortUsed, [{ key: 'value', label: 'Sort' }, { key: 'count', label: 'Uses', numeric: true }], 'count')));
  root.append(panel('Region filter usage', '',
    rankTable(discovery.regionUsed, [{ key: 'value', label: 'Region' }, { key: 'count', label: 'Uses', numeric: true }], 'count')));
}

function renderLocation(root, data) {
  var location = data.location;
  var cards = node('div', 'kpis');
  kpi(cards, 'Sessions that asked', num(location.sessionsThatAsked));
  kpi(cards, 'Sessions that granted', num(location.sessionsThatGranted));
  var rate = location.sessionsThatAsked ? Math.round((location.sessionsThatGranted / location.sessionsThatAsked) * 1000) / 10 : null;
  kpi(cards, 'Grant rate', pct(rate));
  root.append(panel('Location', 'Whether the feature works — never where anyone is. No coordinate is stored, sent or shown anywhere in this dashboard.', cards));
  root.append(panel('Permission outcome', '',
    rankTable(location.permission, [{ key: 'outcome', label: 'Outcome' }, { key: 'count', label: 'Sessions', numeric: true }], 'count')));
  root.append(panel('Request outcome and duration', 'Error category and how long the request took.',
    rankTable(location.requestOutcomes, [{ key: 'outcome', label: 'Outcome' }, { key: 'count', label: 'Requests', numeric: true }, { key: 'averageMs', label: 'Average ms', numeric: true }], 'count')));
  root.append(panel('Two-stage request', 'Stage one is coarse and cached; stage two escalates to GPS only after a timeout or an unavailable position.',
    rankTable(location.stageOutcomes, [{ key: 'outcome', label: 'Outcome' }, { key: 'highAccuracy', label: 'High accuracy' }, { key: 'count', label: 'Attempts', numeric: true }], 'count')));
  root.append(panel('Coarse country', 'The country Cloudflare attaches at the edge. Country-level only, and the only geography in this dashboard.',
    rankTable(location.edgeCountries, [{ key: 'country', label: 'Country' }, { key: 'count', label: 'Sessions', numeric: true }], 'count')));
}

function renderTechnical(root, data) {
  var technical = data.technical;
  var performance = technical.performance || {};
  var cards = node('div', 'kpis');
  kpi(cards, 'Performance samples', num(performance.samples));
  kpi(cards, 'Avg TTFB', performance.ttfbMs === null || performance.ttfbMs === undefined ? '—' : performance.ttfbMs + ' ms');
  kpi(cards, 'Avg DOM ready', performance.domReadyMs === null || performance.domReadyMs === undefined ? '—' : performance.domReadyMs + ' ms');
  kpi(cards, 'Avg load', performance.loadMs === null || performance.loadMs === undefined ? '—' : performance.loadMs + ' ms');
  root.append(panel('Technical quality', '', cards));
  root.append(panel('Frontend error categories', 'Error name and the script it came from. No message text and no stack — those can carry user content.',
    rankTable(technical.errors, [{ key: 'kind', label: 'Kind' }, { key: 'script', label: 'Script' }, { key: 'count', label: 'Count', numeric: true }], 'count')));
  var grid = node('div', 'grid2');
  [['Browser family', technical.browsers, 'browser'], ['Device / viewport class', technical.devices, 'device'],
   ['Language', technical.locales, 'locale'], ['Theme', technical.themes, 'theme'],
   ['Referrer origin', technical.referrers, 'referrer']].forEach(function (entry) {
    grid.append(panel(entry[0], '', rankTable(entry[1], [{ key: entry[2], label: entry[0] }, { key: 'count', label: 'Count', numeric: true }], 'count')));
  });
  root.append(grid);
}

function renderContent(root, data) {
  var content = data.content;
  if (!content.available) {
    root.append(panel('City descriptions', 'The description cache table is not present yet — apply migration 0003.', node('p', 'empty', 'No coverage to report.')));
    return;
  }
  var verified = 0; var total = 0;
  (content.byStatus || []).forEach(function (row) {
    total += Number(row.count) || 0;
    if (row.status === 'ok') verified += Number(row.count) || 0;
  });
  var cards = node('div', 'kpis');
  kpi(cards, 'Cities looked up', num(total));
  kpi(cards, 'With a verified description', num(verified), total ? Math.round((verified / total) * 100) + '% of those looked up' : '');
  kpi(cards, 'Countries seen', num(content.countriesSeen));
  root.append(panel('City description coverage', 'Real coverage from the cache — not an estimate. A city is only counted as covered when an article was found AND its own coordinates matched the city.', cards));
  root.append(panel('Why a city has no description', 'wrong_place means an article existed but was about somewhere else; ambiguous means a disambiguation page.',
    rankTable(content.byStatus, [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Cities', numeric: true }], 'count')));
  root.append(panel('By language', '',
    rankTable(content.byLang, [{ key: 'lang', label: 'Language' }, { key: 'verified', label: 'Verified', numeric: true }, { key: 'count', label: 'Looked up', numeric: true }], 'count')));
}

function statusChip(status) {
  var chip = node('span', 'chip ' + status, String(status).replace('_', ' '));
  return chip;
}

function renderReports(root) {
  var controls = node('div', 'filters');
  var search = node('div');
  search.append(node('label', '', 'Search'));
  var input = node('input');
  input.id = 'r_q'; input.type = 'search'; input.placeholder = 'message, reference, country';
  input.value = state.feedbackQuery.q;
  search.append(input);
  controls.append(search);

  var statusWrap = node('div');
  statusWrap.append(node('label', '', 'Status'));
  var statusSelect = node('select');
  statusSelect.id = 'r_status';
  ['', 'new', 'triaged', 'in_progress', 'resolved', 'declined'].forEach(function (value) {
    var option = node('option', '', value === '' ? 'Any' : value.replace('_', ' '));
    option.value = value;
    if (state.feedbackQuery.status === value) option.selected = true;
    statusSelect.append(option);
  });
  statusWrap.append(statusSelect);
  controls.append(statusWrap);

  var typeWrap = node('div');
  typeWrap.append(node('label', '', 'Type'));
  var typeSelect = node('select');
  typeSelect.id = 'r_type';
  ['', 'wrong_info', 'image', 'bug', 'suggestion', 'results', 'translation', 'other'].forEach(function (value) {
    var option = node('option', '', value === '' ? 'Any' : value.replace('_', ' '));
    option.value = value;
    if (state.feedbackQuery.type === value) option.selected = true;
    typeSelect.append(option);
  });
  typeWrap.append(typeSelect);
  controls.append(typeWrap);

  var actions = node('div', 'actions');
  var apply = node('button', 'primary', 'Search');
  apply.addEventListener('click', function () {
    state.feedbackQuery = { q: input.value, status: statusSelect.value, type: typeSelect.value };
    loadFeedback();
  });
  actions.append(apply);
  controls.append(actions);
  root.append(panel('Reports and feedback', 'Everything a traveller sent, with a status you can move.', controls));

  var listRoot = node('div');
  listRoot.id = 'reportList';
  root.append(listRoot);
  renderFeedbackList();
}

function renderFeedbackList() {
  var listRoot = el('reportList');
  if (!listRoot) return;
  listRoot.replaceChildren();
  if (!state.feedback) { listRoot.append(node('p', 'empty', 'Loading…')); return; }
  var summary = node('div', 'kpis');
  kpi(summary, 'Matching reports', num(state.feedback.total));
  (state.feedback.byStatus || []).forEach(function (row) { kpi(summary, String(row.status).replace('_', ' '), num(row.count)); });
  listRoot.append(panel('Queue', '', summary));

  if (!state.feedback.items || !state.feedback.items.length) {
    listRoot.append(panel('Results', '', node('p', 'empty', 'No reports match.')));
    return;
  }
  var table = node('table');
  var head = node('tr');
  ['Reference', 'When', 'Type', 'Country', 'Message', 'Status', ''].forEach(function (label) { head.append(node('th', '', label)); });
  table.append(node('thead')).firstChild.append(head);
  var body = node('tbody');
  state.feedback.items.forEach(function (row) {
    var tr = node('tr');
    tr.append(node('td', '', row.reference_id));
    tr.append(node('td', '', (row.created_at || '').slice(0, 16).replace('T', ' ')));
    tr.append(node('td', '', String(row.type || '').replace('_', ' ')));
    tr.append(node('td', '', row.country_code || '—'));
    tr.append(node('td', '', (row.message || '').slice(0, 90)));
    var statusCell = node('td');
    statusCell.append(statusChip(row.status || 'new'));
    tr.append(statusCell);
    var actionCell = node('td');
    var open = node('button', 'small ghost', 'Open');
    open.addEventListener('click', function () { openReport(row); });
    actionCell.append(open);
    tr.append(actionCell);
    body.append(tr);
  });
  table.append(body);
  var wrap = node('div', 'scroll');
  wrap.append(table);
  listRoot.append(panel('Results', 'Newest first.', wrap));
}

function openReport(row) {
  var dialog = el('reportDialog');
  var content = el('reportBody');
  content.replaceChildren();
  var line = function (label, value) {
    var block = node('div', 'detail-line');
    block.append(node('b', '', label));
    block.append(document.createTextNode(value === null || value === undefined || value === '' ? '—' : String(value)));
    return block;
  };
  content.append(node('h3', '', row.reference_id));
  content.append(line('Received', row.created_at));
  content.append(line('Type', String(row.type || '').replace('_', ' ')));
  content.append(line('Page', row.path));
  content.append(line('Country', row.country_code));
  content.append(line('Language', row.locale));
  content.append(line('Contact e-mail (only if they volunteered one)', row.email));
  content.append(line('Screenshot object', row.screenshot_key));
  content.append(line('Status changed', row.status_changed_at));
  var messageBlock = node('div', 'detail-line');
  messageBlock.append(node('b', '', 'Message'));
  messageBlock.append(node('div', 'message', row.message || ''));
  content.append(messageBlock);

  el('reportReference').value = row.reference_id;
  el('reportStatus').value = row.status || 'new';
  el('reportNote').value = row.admin_note || '';
  el('reportError').textContent = '';
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
    el('error').textContent = error.message;
  });
}

var TABS = [
  { id: 'overview', label: 'Overview', render: renderOverview },
  { id: 'funnel', label: 'Funnel', render: renderFunnel },
  { id: 'quality', label: 'Recommendation quality', render: renderQuality },
  { id: 'countries', label: 'Countries', render: renderCountries },
  { id: 'discovery', label: 'Discovery', render: renderDiscovery },
  { id: 'location', label: 'Location', render: renderLocation },
  { id: 'reports', label: 'Reports', render: null },
  { id: 'technical', label: 'Technical', render: renderTechnical },
  { id: 'content', label: 'Content', render: renderContent },
];

function renderTabs() {
  var nav = el('tabs');
  nav.replaceChildren();
  TABS.forEach(function (tab) {
    var button = node('button', '', tab.label);
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
  var tab = TABS.filter(function (entry) { return entry.id === state.tab; })[0];
  if (!tab) return;
  if (tab.id === 'reports') { renderReports(root); return; }
  if (!state.data) { root.append(node('p', 'empty', 'Loading…')); return; }
  tab.render(root, state.data);
}

function load() {
  el('error').textContent = '';
  state.data = null;
  renderBody();
  return api('/api/admin/analytics', filters()).then(function (data) {
    state.data = data;
    el('login').hidden = true;
    el('dashboard').hidden = false;
    el('authVia').textContent = data.authenticatedVia === 'access' ? 'Signed in through Cloudflare Access' : 'Signed in with an admin token';
    renderTabs();
    renderBody();
    if (state.tab === 'reports') loadFeedback();
  }).catch(function (error) {
    el('error').textContent = error.message;
    el('dashboard').hidden = true;
    el('login').hidden = false;
  });
}

document.addEventListener('DOMContentLoaded', function () {
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
    }).catch(function (error) { el('reportError').textContent = error.message; });
  });
  el('reportClose').addEventListener('click', function (event) { event.preventDefault(); el('reportDialog').close(); });

  // Under Cloudflare Access the browser already carries the Access cookie,
  // so there is nothing to type: try straight away and only fall back to the
  // token form if that fails.
  load();
});
`;

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
    <h1>Wejhaty — product data</h1>
    <span class="notice" id="authVia"></span>
  </header>
  <p class="sub">Anonymous product analytics, ratings and reports. No coordinates, no IP addresses, no device fingerprints, no passport data — by schema, not by policy.</p>

  <form class="panel login" id="loginForm" hidden>
    <h2>Sign in</h2>
    <p class="hint">Cloudflare Access signs you in automatically when it is configured. Otherwise, use the admin token.</p>
    <label for="token">Admin token</label>
    <input id="token" type="password" autocomplete="current-password">
    <p></p>
    <button class="primary" type="submit">Open dashboard</button>
  </form>
  <p class="error" id="error"></p>

  <div id="dashboard" hidden>
    <section class="panel">
      <h2>Filters</h2>
      <p class="hint">Every panel below respects these.</p>
      <div class="filters">
        <div><label for="f_from">From</label><input id="f_from" type="date"></div>
        <div><label for="f_to">To</label><input id="f_to" type="date"></div>
        <div><label for="f_locale">Language</label><select id="f_locale"><option value="">Any</option><option value="ar">Arabic</option><option value="en">English</option></select></div>
        <div><label for="f_device">Device</label><select id="f_device"><option value="">Any</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option><option value="desktop">Desktop</option></select></div>
        <div><label for="f_purpose">Purpose</label><select id="f_purpose"><option value="">Any</option><option value="tourism">Tourism</option><option value="work">Work</option><option value="education">Education</option><option value="medical">Medical</option><option value="immigration">Immigration</option><option value="investment">Investment</option><option value="wellness">Wellness</option><option value="other">Other</option></select></div>
        <div><label for="f_country">Country (ISO)</label><input id="f_country" maxlength="2" placeholder="JP"></div>
        <div><label for="f_minRating">Min rating</label><select id="f_minRating"><option value="">Any</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div><label for="f_maxRating">Max rating</label><select id="f_maxRating"><option value="">Any</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>
        <div class="actions"><button class="primary" id="applyFilters" type="button">Apply</button><button class="ghost" id="clearFilters" type="button">Clear</button></div>
      </div>
    </section>

    <nav class="tabs" id="tabs" aria-label="Dashboard sections"></nav>
    <div id="body"></div>
  </div>
</main>

<dialog id="reportDialog" aria-labelledby="reportDialogTitle">
  <form method="dialog">
    <h2 id="reportDialogTitle">Report</h2>
    <div id="reportBody"></div>
    <input type="hidden" id="reportReference">
    <div class="row">
      <div>
        <label for="reportStatus">Status</label>
        <select id="reportStatus">
          <option value="new">new</option>
          <option value="triaged">triaged</option>
          <option value="in_progress">in progress</option>
          <option value="resolved">resolved</option>
          <option value="declined">declined</option>
        </select>
      </div>
    </div>
    <div class="row" style="display:block">
      <label for="reportNote">Internal note</label>
      <textarea id="reportNote" maxlength="2000"></textarea>
    </div>
    <p class="error" id="reportError"></p>
    <div class="row">
      <button class="primary" id="reportSave">Save</button>
      <button class="ghost" id="reportClose">Close</button>
    </div>
  </form>
</dialog>

<script>${SCRIPT}</script>
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
