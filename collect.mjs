// Daily collector: reads downloads, ratings and site status, then saves one snapshot per day in Supabase.
// Runs in GitHub Actions. Secrets: SUPABASE_URL, SUPABASE_SERVICE_KEY. Optional: STORE_TENANT_ID, STORE_CLIENT_ID, STORE_CLIENT_SECRET.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const env = process.env;
const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); // YYYY-MM-DD in Cairo
const INSTALLER = /\.(exe|msi|msix|dmg|appimage|deb|rpm)$/i;
const warnings = [];

async function getJSON(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const g = (o, ...names) => {
  if (!o) return undefined;
  for (const n of names) {
    const k = Object.keys(o).find((x) => x.toLowerCase() === n.toLowerCase());
    if (k !== undefined) return o[k];
  }
};
async function tryIt(label, fn, fallback = null) {
  try { return await fn(); } catch (e) { warnings.push(`${label}: ${e.message}`); return fallback; }
}

// ---- Supabase (service key, skips row rules) ----
const SB = env.SUPABASE_URL?.replace(/\/$/, '');
const SB_KEY = env.SUPABASE_SERVICE_KEY;
const sbHeaders = SB_KEY
  ? { apikey: SB_KEY, 'Content-Type': 'application/json', ...(SB_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${SB_KEY}` } : {}) }
  : {};

// ---- Microsoft Store ----
async function storePublic(id) {
  const r = await getJSON(`https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${id}?market=US&locale=en-us&deviceFamily=Windows.Desktop`);
  const p = r?.Payload || {};
  return { rating: Number(p.AverageRating || 0), ratingCount: Number(p.RatingCount || 0) };
}
let tokenP;
function storeToken() {
  const { STORE_TENANT_ID: t, STORE_CLIENT_ID: id, STORE_CLIENT_SECRET: s } = env;
  if (!t || !id || !s) return null;
  tokenP ??= getJSON(`https://login.microsoftonline.com/${t}/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: s, resource: 'https://manage.devcenter.microsoft.com' }),
  }).then((r) => r.access_token);
  return tokenP;
}
async function storeFunnel(id) {
  const tp = storeToken();
  if (!tp) return null;
  const qs = new URLSearchParams({ applicationId: id, startDate: '2025-01-01', endDate: TODAY });
  const r = await getJSON(`https://manage.devcenter.microsoft.com/v1.0/my/analytics/funnel?${qs}`, { headers: { Authorization: `Bearer ${await tp}` } });
  const out = { installs: 0, pageViews: 0 };
  for (const row of g(r, 'Value') || []) {
    const type = String(g(row, 'MetricType') || '').toLowerCase();
    const n = Number(g(row, 'UserCount') || 0);
    if (type === 'install') out.installs += n;
    if (type === 'pageview') out.pageViews += n;
  }
  return out;
}

// ---- GitHub ----
const gh = (p) => getJSON(`https://api.github.com${p}`, {
  headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'selecta-stats', ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) },
});
async function github(repo) {
  const info = await gh(`/repos/${repo}`);
  const releases = [];
  for (let page = 1; page <= 5; page++) {
    const b = await gh(`/repos/${repo}/releases?per_page=100&page=${page}`);
    releases.push(...b);
    if (b.length < 100) break;
  }
  const versions = releases.map((r) => ({
    tag: r.tag_name,
    date: (r.published_at || '').slice(0, 10),
    downloads: r.assets.filter((a) => INSTALLER.test(a.name)).reduce((s, a) => s + a.download_count, 0),
  }));
  return { stars: info.stargazers_count, forks: info.forks_count, downloads: versions.reduce((s, v) => s + v.downloads, 0), versions };
}

// ---- Sites ----
async function siteStatus(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 selecta-stats' } });
    return { up: r.ok, status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { up: false, status: e.name === 'TimeoutError' ? 'timeout' : 'error', ms: Date.now() - t0 };
  }
}

async function main() {
  const apps = [];
  for (const a of CONFIG.apps) {
    const app = { name: a.name, storeId: a.storeId || null, repo: a.repo || null, site: a.site || null };
    if (a.storeId) {
      app.storeUrl = `https://apps.microsoft.com/detail/${a.storeId}`;
      Object.assign(app, await tryIt(`${a.name} Store rating`, () => storePublic(a.storeId), {}));
      const live = await tryIt(`${a.name} Store installs`, () => storeFunnel(a.storeId));
      if (live) app.store = { ...live, source: 'live', date: TODAY };
      else if (a.storeManual) app.store = { ...a.storeManual, source: 'manual' };
    }
    if (a.repo) app.github = await tryIt(`${a.name} GitHub`, () => github(a.repo));
    app.downloads = (app.store?.installs || 0) + (app.github?.downloads || 0);
    apps.push(app);
  }

  // Sites: from the dashboard's site list when available, plus config.
  let siteRows = [];
  if (SB && SB_KEY) siteRows = (await tryIt('sites list', () => getJSON(`${SB}/rest/v1/sites?select=id,url`, { headers: sbHeaders }), [])) || [];
  const urls = [...new Set([...siteRows.map((s) => s.url), ...CONFIG.apps.map((a) => a.site).filter(Boolean), ...(CONFIG.extraSites || [])])];
  const sites = [];
  for (const url of urls) sites.push({ url, ...(await siteStatus(url)) });

  const data = {
    updated: new Date().toISOString(),
    storeLive: Boolean(storeToken()),
    apps,
    sites,
    totals: {
      downloads: apps.reduce((s, a) => s + a.downloads, 0),
      storeInstalls: apps.reduce((s, a) => s + (a.store?.installs || 0), 0),
      githubDownloads: apps.reduce((s, a) => s + (a.github?.downloads || 0), 0),
      ratingCount: apps.reduce((s, a) => s + (a.ratingCount || 0), 0),
    },
    warnings,
  };

  console.log(`Total downloads ${data.totals.downloads} (Store ${data.totals.storeInstalls}, GitHub ${data.totals.githubDownloads}). Ratings ${data.totals.ratingCount}.`);
  if (warnings.length) console.log('Warnings:\n- ' + warnings.join('\n- '));

  if (!SB || !SB_KEY) {
    console.log('SUPABASE_URL / SUPABASE_SERVICE_KEY not set: nothing saved.');
    fs.writeFileSync(path.join(ROOT, 'snapshot-preview.json'), JSON.stringify(data, null, 2));
    return;
  }
  const res = await fetch(`${SB}/rest/v1/snapshots?on_conflict=day`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ day: TODAY, data }),
  });
  if (!res.ok) throw new Error(`Saving the snapshot failed: HTTP ${res.status} ${await res.text()}`);
  console.log(`Saved snapshot for ${TODAY}.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
