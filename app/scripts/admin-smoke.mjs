// Phase 21 — production check of the private admin surface after a Worker
// deploy. Read-only and credential-free: it confirms the new dashboard is
// live and that every data path still refuses a caller without valid
// credentials. It never sends a token and never writes anything.
//
// Usage: node scripts/admin-smoke.mjs [workerUrl]
const WORKER = (process.argv[2] || 'https://wejhaty-travel-worker.hmooodzozo577.workers.dev').replace(/\/$/, '');
let checks = 0;
let failures = 0;
const check = (ok, label, detail = '') => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};
const call = (path, init = {}) => fetch(`${WORKER}${path}`, { ...init, headers: { 'User-Agent': 'WejhatyAdminSmoke/1.0', ...(init.headers ?? {}) } });

{
  const response = await call('/admin');
  const html = await response.text();
  const csp = response.headers.get('content-security-policy') ?? '';
  check(response.status === 200, '/admin serves the dashboard shell', String(response.status));
  check(csp.includes("frame-ancestors 'none'") && csp.includes("default-src 'none'") && csp.includes("connect-src 'self'"), 'the shell keeps its restrictive CSP', csp);
  check(response.headers.get('x-frame-options') === 'DENY', 'the shell cannot be framed');
  check(/no-store/.test(response.headers.get('cache-control') ?? ''), 'the shell is never cached');
  check(html.includes('var ADMIN_METRICS = [') && html.includes('var ADMIN_VOCAB = {'), 'the Phase 21 dashboard (metric dictionary and vocabulary) is live');
  check(!/Bearer [A-Za-z0-9]/.test(html), 'the shell carries no credential');
}

for (const path of ['/api/admin/analytics', '/api/admin/summary', '/api/admin/feedback', '/api/admin/ratings?comments=1']) {
  const anonymous = await call(path);
  check(anonymous.status === 401, `${path} refuses an anonymous caller`, String(anonymous.status));
  const forged = await call(path, { headers: { Authorization: 'Bearer not-the-admin-token' } });
  check(forged.status === 401, `${path} refuses a wrong token`, String(forged.status));
}

{
  const response = await call('/api/admin/feedback/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referenceId: 'WJ-SMOKE', status: 'resolved' }),
  });
  check(response.status === 401, 'a status change without credentials is refused', String(response.status));
}

console.log(`Admin smoke: ${checks} checks, ${failures} failed.`);
process.exit(failures ? 1 : 0);
