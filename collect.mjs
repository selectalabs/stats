// Collects public stats for Selecta Labs apps and writes site/data.json for the dashboard.
// Works with no secrets. Optional secrets add Store installs (Partner Center API).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const HISTORY_FILE = path.join(ROOT, 'data', 'history.json');
const OUT_FILE = path.join(ROOT, 'site', 'data.json');
const env = process.env;
const TODAY = new Date().toISOString().slice(0, 10);
const INSTALLER = /\.(exe|msi|msix|dmg|appimage|deb|rpm)$/i;

async function getJSON(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}
const g = (o, ...names) => {
  if (!o) return undefined;
  for (const n of names) {
    const k = Object.keys(o).find((x) => x.toLowerCase() === n.toLowerCase());
    if (k !== undefined) return o[k];
  }
};
const warn = [];
const tryIt = async (label, fn, fallback = null) => {
  try { return await fn(); } catch (e) { warn.push(`${label}: ${e.message}`); console.error(label, e.message); return fallback; }
};

// ---- Microsoft Store: public rating (no key needed) ----
async function storePublic(id) {
  const r = await getJSON(`https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${id}?market=US&locale=en-us&deviceFamily=Windows.Desktop`);
  const p = r.Payload || {};
  return { rating: Number(p.AverageRating || 0), ratingCount: Number(p.RatingCount || 0), website: p.AppWebsiteUrl || null, updated: p.LastUpdateDateUtc || null };
}

// ---- Microsoft Store: installs (needs Partner Center API keys) ----
let storeTokenPromise;
function storeToken() {
  const { STORE_TENANT_ID: t, STORE_CLIENT_ID: id, STORE_CLIENT_SECRET: s } = env;
  if (!t || !id || !s) return null;
  storeTokenPromise ??= getJSON(`https://login.microsoftonline.com/${t}/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: s, resource: 'https://manage.devcenter.microsoft.com' }),
  }).then((r) => r.access_token);
  return storeTokenPromise;
}
async function storeFunnel(id) {
  const tokenP = storeToken();
  if (!tokenP) return null;
  const token = await tokenP;
  const qs = new URLSearchParams({ applicationId: id, startDate: '2025-01-01', endDate: TODAY });
  const r = await getJSON(`https://manage.devcenter.microsoft.com/v1.0/my/analytics/funnel?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  const out = { installs: 0, pageViews: 0 };
  for (const row of g(r, 'Value') || []) {
    const type = String(g(row, 'MetricType') || '').toLowerCase();
    const n = Number(g(row, 'UserCount') || 0);
    if (type === 'install') out.installs += n;
    if (type === 'pageview') out.pageViews += n;
  }
  return out;
}

// ---- GitHub releases ----
async function gh(p) {
  return getJSON(`https://api.github.com${p}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'selecta-stats', ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}) },
  });
}
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

// ---- Sites: up/down + visits (GoatCounter, optional) ----
async function siteStatus(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0 selecta-stats' } });
    return { up: r.ok, status: r.status, ms: Date.now() - t0 };
  } catch (e) {
    return { up: false, status: e.name === 'TimeoutError' ? 'timeout' : 'error', ms: Date.now() - t0 };
  }
}
async function visits(pagePath) {
  const code = env.GOATCOUNTER_CODE || CONFIG.goatcounter;
  if (!code) return null;
  const r = await getJSON(`https://${code}.goatcounter.com/counter/${encodeURIComponent(pagePath)}.json`);
  return Number(String(r.count ?? '0').replace(/[^\d]/g, '')) || 0;
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

  const siteUrls = [...new Set([...CONFIG.apps.map((a) => a.site).filter(Boolean), ...(CONFIG.extraSites || [])])];
  const sites = [];
  for (const url of siteUrls) {
    const s = { url, ...(await siteStatus(url)) };
    s.visits = await tryIt(`visits ${url}`, () => visits(new URL(url).pathname));
    sites.push(s);
  }
  const totalVisits = await tryIt('visits total', () => visits('TOTAL'));

  const totals = {
    downloads: apps.reduce((s, a) => s + a.downloads, 0),
    storeInstalls: apps.reduce((s, a) => s + (a.store?.installs || 0), 0),
    githubDownloads: apps.reduce((s, a) => s + (a.github?.downloads || 0), 0),
    ratingCount: apps.reduce((s, a) => s + (a.ratingCount || 0), 0),
    visits: totalVisits,
  };

  const history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')) : [];
  const next = history.filter((h) => h.date !== TODAY);
  next.push({ date: TODAY, ...totals, apps: Object.fromEntries(apps.map((a) => [a.name, a.downloads])) });
  next.sort((x, y) => x.date.localeCompare(y.date));
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(next, null, 2) + '\n');

  const data = {
    title: CONFIG.title,
    updated: new Date().toISOString(),
    storeLive: Boolean(storeToken()),
    visitsOn: Boolean(env.GOATCOUNTER_CODE || CONFIG.goatcounter),
    totals,
    apps,
    sites,
    history: next,
    warnings: warn,
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(data, null, 2) + '\n');
  console.log(`Total downloads ${totals.downloads} (Store ${totals.storeInstalls}, GitHub ${totals.githubDownloads}). Ratings ${totals.ratingCount}.`);
  if (warn.length) console.log('Warnings:\n- ' + warn.join('\n- '));
}

main().catch((e) => { console.error(e); process.exit(1); });
