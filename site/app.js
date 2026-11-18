/* Selecta Labs Admin dashboard. Plain JS, no build step. */
(() => {
  'use strict';

  const CFG = window.SELECTA_CONFIG || {};
  const PARAMS = new URLSearchParams(location.search);
  const CONFIGURED = CFG.supabaseUrl && !String(CFG.supabaseUrl).startsWith('__');
  const DEMO = PARAMS.has('demo') || !CONFIGURED;
  const SNIPPET_URL = new URL('selecta.js', location.href.split('?')[0].split('#')[0]).href;

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-US'));
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
  const dayStr = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayStr(d); };
  const niceDay = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const niceDateTime = (s) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  const stars = (avg) => '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
  const delta = (now, before) => {
    if (now == null || before == null) return '';
    const d = now - before;
    if (!d) return '<span class="chip gray">no change</span>';
    return `<span class="chip ${d > 0 ? 'good' : 'bad'}">${d > 0 ? '+' : ''}${fmt(d)} in 7 days</span>`;
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  const ICONS = {
    overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
    sites: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    ads: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1Z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>',
    google: '<svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"/></svg>',
  };

  const SLOTS = { top: 'Top banner', inline: 'In content', bottom: 'Before footer' };
  const KINDS = { image: 'Image banner', text: 'Text + button', html: 'Ad code (HTML)' };

  // ---------- data layer ----------
  function realApi() {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
    const unwrap = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
    return {
      async user() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
      async signIn() {
        const redirectTo = location.origin + location.pathname;
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
        if (error) throw error;
      },
      async signOut() { await sb.auth.signOut(); },
      async isAdmin() { return unwrap(await sb.rpc('is_admin')) === true; },
      async snapshots(days = 180) { return unwrap(await sb.from('snapshots').select('day,data').gte('day', daysAgo(days)).order('day')); },
      async siteDaily(days = 60) { return unwrap(await sb.from('site_daily').select('*').gte('day', daysAgo(days))); },
      async sites() { return unwrap(await sb.from('sites').select('*').order('name')); },
      async addSite(site) { return unwrap(await sb.from('sites').insert(site).select().single()); },
      async removeSite(id) { unwrap(await sb.from('sites').delete().eq('id', id)); },
      async ads() { return unwrap(await sb.from('ads').select('*').order('created_at', { ascending: false })); },
      async adTotals() { return unwrap(await sb.from('ad_totals').select('*')); },
      async saveAd(ad) {
        const row = { ...ad }; delete row.id; delete row.created_at; delete row.updated_at;
        if (ad.id) return unwrap(await sb.from('ads').update(row).eq('id', ad.id).select().single());
        return unwrap(await sb.from('ads').insert(row).select().single());
      },
      async setAdActive(id, active) { unwrap(await sb.from('ads').update({ active }).eq('id', id)); },
      async deleteAd(id) { unwrap(await sb.from('ads').delete().eq('id', id)); },
      async uploadImage(file) {
        const clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60);
        const path = `${Date.now()}-${clean}`;
        unwrap(await sb.storage.from('ad-images').upload(path, file, { contentType: file.type, upsert: false }));
        return sb.storage.from('ad-images').getPublicUrl(path).data.publicUrl;
      },
      async admins() { return unwrap(await sb.from('admins').select('*').order('added_at')); },
      async addAdmin(email) { unwrap(await sb.from('admins').insert({ email: email.toLowerCase().trim() })); },
      async removeAdmin(email) { unwrap(await sb.from('admins').delete().eq('email', email)); },
    };
  }

  function demoApi() {
    const rnd = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const r = rnd(42);
    const sites = [
      { id: 'selectaai', name: 'Selecta AI', url: 'https://selectalabs.github.io/selectaai/' },
      { id: 'askadb', name: 'AskaDB', url: 'https://selectalabs.github.io/askadb/' },
      { id: 'toolecta', name: 'Toolecta', url: 'https://selectalabs.github.io/toolecta/' },
      { id: 'home', name: 'Selecta Labs', url: 'https://selectalabs.github.io/' },
    ];
    const snaps = [];
    let gh = 18, store = 1, askStore = 0;
    for (let i = 45; i >= 0; i--) {
      if (r() > 0.55) gh += Math.round(r() * 2);
      if (r() > 0.75) store += 1;
      if (r() > 0.93) askStore += 1;
      const apps = [
        { name: 'Selecta AI', storeId: '9MXVRN1VZSC5', storeUrl: 'https://apps.microsoft.com/detail/9MXVRN1VZSC5', repo: 'selectalabs/selectaai', site: sites[0].url, rating: 4.6, ratingCount: 5,
          store: { installs: store, pageViews: store * 6 + 3, source: 'manual', date: '2026-11-17' },
          github: { downloads: gh, stars: 6, forks: 1, versions: [{ tag: 'v1.5.0', downloads: Math.round(gh * 0.75) }, { tag: 'v1.4.1', downloads: Math.round(gh * 0.15) }, { tag: 'v1.4.0', downloads: gh - Math.round(gh * 0.75) - Math.round(gh * 0.15) }] } },
        { name: 'AskaDB', storeId: '9N9RGB8ZRK8N', storeUrl: 'https://apps.microsoft.com/detail/9N9RGB8ZRK8N', repo: 'selectalabs/askadb', site: sites[1].url, rating: 0, ratingCount: 0,
          store: { installs: askStore, pageViews: askStore * 4 + 2, source: 'manual', date: '2026-11-17' }, github: { downloads: 0, stars: 1, forks: 0, versions: [] } },
        { name: 'Toolecta', repo: 'selectalabs/toolecta', site: sites[2].url, github: { downloads: 0, stars: 2, forks: 0, versions: [] } },
      ];
      apps.forEach((a) => { a.downloads = (a.store?.installs || 0) + (a.github?.downloads || 0); });
      snaps.push({ day: daysAgo(i), data: {
        updated: new Date().toISOString(), apps,
        sites: sites.map((s) => ({ url: s.url, up: s.id !== 'toolecta', status: s.id !== 'toolecta' ? 200 : 404, ms: 80 + Math.round(r() * 200) })),
        totals: { downloads: apps.reduce((t, a) => t + a.downloads, 0), storeInstalls: store + askStore, githubDownloads: gh, ratingCount: 5 },
      } });
    }
    const daily = [];
    for (let i = 59; i >= 0; i--) for (const s of sites) {
      const base = { selectaai: 40, askadb: 14, toolecta: 22, home: 9 }[s.id];
      const views = Math.round(base * (0.6 + r() * 0.9) * (1 + (59 - i) / 80));
      const adViews = Math.round(views * 0.7);
      daily.push({ site_id: s.id, day: daysAgo(i), views, visitors: Math.round(views * 0.62), ad_views: adViews, ad_clicks: Math.round(adViews * (0.01 + r() * 0.03)) });
    }
    let ads = [
      { id: 'a1', name: 'Selecta Pro launch', site_id: null, slot: 'top', kind: 'text', title: 'Selecta AI Pro is here', body: 'Find any chat by describing it. Free for 14 days.', button_text: 'Try Pro', link_url: 'https://mellaithy.gumroad.com/l/selecta-pro', active: true, priority: 5, starts_at: null, ends_at: null, created_at: daysAgo(12) + 'T10:00:00Z' },
      { id: 'a2', name: 'AskaDB on the Store', site_id: 'toolecta', slot: 'bottom', kind: 'image', title: 'AskaDB', image_url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#3563ff"/><stop offset="1" stop-color="#7a5cff"/></linearGradient></defs><rect width="1200" height="240" fill="url(#g)"/><text x="60" y="110" font-family="Arial" font-size="54" font-weight="700" fill="#fff">AskaDB</text><text x="60" y="165" font-family="Arial" font-size="28" fill="#e6ebff">Ask your database in plain English. Free on the Microsoft Store.</text></svg>'), link_url: 'https://apps.microsoft.com/detail/9N9RGB8ZRK8N', active: true, priority: 0, starts_at: null, ends_at: null, created_at: daysAgo(6) + 'T10:00:00Z' },
      { id: 'a3', name: 'Black Friday banner', site_id: 'selectaai', slot: 'inline', kind: 'html', html: '<div style="padding:18px;background:#111;color:#fff;border-radius:10px;font-family:Arial">Black Friday: 50% off Pro</div>', active: false, priority: 0, starts_at: '2026-11-27T00:00:00Z', ends_at: '2026-11-30T23:00:00Z', created_at: daysAgo(2) + 'T10:00:00Z' },
    ];
    let admins = [{ email: 'mohamed547754@gmail.com', added_at: daysAgo(30) }, { email: 'mymhelmy80@gmail.com', added_at: daysAgo(30) }];
    const totals = [{ ad_id: 'a1', views: 1840, clicks: 41 }, { ad_id: 'a2', views: 620, clicks: 9 }, { ad_id: 'a3', views: 0, clicks: 0 }];
    let sitesList = sites.slice();
    let n = 10;
    return {
      async user() { return { email: 'mohamed547754@gmail.com', user_metadata: { full_name: 'Demo admin' } }; },
      async signIn() {}, async signOut() { location.search = ''; },
      async isAdmin() { return true; },
      async snapshots() { return snaps; },
      async siteDaily() { return daily; },
      async sites() { return sitesList; },
      async addSite(s) { sitesList.push(s); return s; },
      async removeSite(id) { sitesList = sitesList.filter((s) => s.id !== id); },
      async ads() { return ads; },
      async adTotals() { return totals; },
      async saveAd(ad) {
        if (ad.id) { ads = ads.map((a) => (a.id === ad.id ? { ...a, ...ad } : a)); return ad; }
        const row = { ...ad, id: 'n' + n++, created_at: new Date().toISOString() }; ads.unshift(row); return row;
      },
      async setAdActive(id, active) { ads = ads.map((a) => (a.id === id ? { ...a, active } : a)); },
      async deleteAd(id) { ads = ads.filter((a) => a.id !== id); },
      async uploadImage(file) { return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file); }); },
      async admins() { return admins; },
      async addAdmin(email) { admins.push({ email, added_at: new Date().toISOString() }); },
      async removeAdmin(email) { admins = admins.filter((a) => a.email !== email); },
    };
  }

  const api = DEMO ? demoApi() : realApi();
  const state = { user: null, view: (location.hash || '#overview').slice(1), cache: {}, charts: [] };
  const root = $('#root');

  // ---------- theme ----------
  const savedTheme = (() => { try { return localStorage.getItem('sl-theme'); } catch { return null; } })();
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  function setTheme(t) {
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    try { t === 'auto' ? localStorage.removeItem('sl-theme') : localStorage.setItem('sl-theme', t); } catch {}
    render();
  }

  // ---------- login ----------
  function showLogin(error) {
    root.innerHTML = `
      <div class="login"><div class="login-card">
        <div class="brand-mark">S</div>
        <h1>Selecta Labs Admin</h1>
        <p>Sign in to see your numbers and manage ads.</p>
        <button class="google-btn" id="google">${ICONS.google} Continue with Google</button>
        <div class="login-note">Only approved admin accounts can sign in.</div>
        ${error ? `<div class="login-error">${esc(error)}</div>` : ''}
      </div></div>`;
    $('#google').onclick = async () => {
      try { await api.signIn(); } catch (e) { showLogin(e.message); }
    };
  }

  // ---------- data loading ----------
  async function load(force = false) {
    if (state.cache.loaded && !force) return state.cache;
    const [snaps, daily, sites, ads, adTotals] = await Promise.all([api.snapshots(), api.siteDaily(), api.sites(), api.ads(), api.adTotals()]);
    state.cache = { loaded: true, snaps, daily, sites, ads, adTotals };
    return state.cache;
  }
  const latest = () => state.cache.snaps?.[state.cache.snaps.length - 1]?.data || null;
  const snapAgo = (n) => {
    const target = daysAgo(n);
    const s = state.cache.snaps || [];
    for (let i = s.length - 1; i >= 0; i--) if (s[i].day <= target) return s[i].data;
    return null;
  };
  function siteSum(siteId, days) {
    const since = daysAgo(days - 1);
    return (state.cache.daily || []).filter((r) => (!siteId || r.site_id === siteId) && r.day >= since)
      .reduce((t, r) => ({ views: t.views + Number(r.views), visitors: t.visitors + Number(r.visitors), ad_views: t.ad_views + Number(r.ad_views), ad_clicks: t.ad_clicks + Number(r.ad_clicks) }), { views: 0, visitors: 0, ad_views: 0, ad_clicks: 0 });
  }

  // ---------- shell ----------
  const NAV = [
    ['overview', 'Overview'], ['apps', 'Apps'], ['sites', 'Sites & visits'], ['ads', 'Ads'], ['settings', 'Settings'],
  ];
  const TITLES = {
    overview: ['Overview', 'Downloads, ratings, visits and ads at a glance'],
    apps: ['Apps', 'Downloads and ratings for every app'],
    sites: ['Sites & visits', 'Visitors, status and the embed code for each site'],
    ads: ['Ads', 'Create and schedule the ads that show on your sites'],
    settings: ['Settings', 'Admins, ad placement and appearance'],
  };

  function shell() {
    const u = state.user || {};
    const name = u.user_metadata?.full_name || u.email || '';
    const pic = u.user_metadata?.avatar_url;
    const activeAds = (state.cache.ads || []).filter((a) => a.active).length;
    root.innerHTML = `
      <div class="app">
        <aside class="side" id="side">
          <div class="brand"><div class="brand-mark">S</div>Selecta Labs</div>
          <nav class="nav">${NAV.map(([id, label]) => `<button data-view="${id}" class="${state.view === id ? 'active' : ''}">${ICONS[id]}${label}${id === 'ads' && activeAds ? `<span class="badge">${activeAds}</span>` : ''}</button>`).join('')}</nav>
          <div class="side-foot">
            <div class="avatar">${pic ? `<img src="${esc(pic)}" alt="">` : esc((name[0] || '?').toUpperCase())}</div>
            <div class="who"><div class="name">${esc(u.user_metadata?.full_name || 'Admin')}</div><div>${esc(u.email || '')}</div></div>
            <button class="icon-btn" id="logout" title="Sign out">${ICONS.logout}</button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" id="menu" aria-label="Menu">${ICONS.menu}</button>
            <div><h2>${TITLES[state.view][0]}</h2><div class="sub">${TITLES[state.view][1]}</div></div>
            <div class="spacer"></div>
            <span class="sub" id="updated"></span>
            <button class="btn sm" id="refresh" title="Reload data">${ICONS.refresh}<span>Refresh</span></button>
          </header>
          <div class="content" id="content">${DEMO ? `<div class="demo-banner">${CONFIGURED ? 'Demo mode: sample numbers only.' : 'Demo mode: sample numbers. Connect Supabase to see your real data.'}</div>` : ''}<div id="view"></div></div>
        </div>
      </div>`;
    $$('.nav button').forEach((b) => (b.onclick = () => go(b.dataset.view)));
    $('#logout').onclick = async () => { await api.signOut(); location.reload(); };
    $('#menu').onclick = () => $('#side').classList.toggle('open');
    $('#refresh').onclick = async () => { await load(true); render(); toast('Data refreshed'); };
    const l = latest();
    if (l?.updated) $('#updated').textContent = `Stats updated ${niceDateTime(l.updated)}`;
  }

  function go(view) {
    state.view = view;
    history.replaceState(null, '', '#' + view);
    render();
  }

  function render() {
    state.charts.forEach((c) => c.destroy());
    state.charts = [];
    if (!TITLES[state.view]) state.view = 'overview';
    if (location.hash !== '#' + state.view) history.replaceState(null, '', location.pathname + location.search + '#' + state.view);
    shell();
    const v = $('#view');
    ({ overview, apps, sites, ads, settings })[state.view](v);
  }

  function chart(canvas, config) {
    if (!window.Chart) return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = cssVar('--muted');
    Chart.defaults.borderColor = cssVar('--line');
    state.charts.push(new Chart(canvas, config));
  }
  const PALETTE = () => [cssVar('--accent'), '#12a3a3', '#f59e0b', '#a855f7', '#ef4444', '#10b981'];

  // ---------- views ----------
  function overview(v) {
    const L = latest();
    if (!L) { v.innerHTML = '<div class="panel empty">No stats yet. They appear after the first daily run of GitHub Actions.</div>'; return; }
    const P = snapAgo(7);
    const t = L.totals;
    const rated = L.apps.filter((a) => a.ratingCount);
    const avg = rated.length ? rated.reduce((s, a) => s + a.rating * a.ratingCount, 0) / rated.reduce((s, a) => s + a.ratingCount, 0) : null;
    const s30 = siteSum(null, 30);
    const s30prev = (() => {
      const from = daysAgo(59), to = daysAgo(30);
      return (state.cache.daily || []).filter((r) => r.day >= from && r.day <= to).reduce((n, r) => n + Number(r.views), 0);
    })();
    const manual = L.apps.some((a) => a.store?.source === 'manual');
    v.innerHTML = `
      <div class="grid kpis">
        ${kpi('Total downloads', fmt(t.downloads), delta(t.downloads, P?.totals.downloads))}
        ${kpi('Microsoft Store installs', fmt(t.storeInstalls), manual ? '<span class="chip warn">read by hand</span>' : '<span class="chip good">live</span>')}
        ${kpi('GitHub downloads', fmt(t.githubDownloads), delta(t.githubDownloads, P?.totals.githubDownloads))}
        ${kpi('Store rating', avg ? `${avg.toFixed(1)} <span class="stars" style="font-size:16px">★</span>` : '—', `${fmt(t.ratingCount)} ratings`)}
        ${kpi('Site visits (30 days)', fmt(s30.views), s30prev ? `<span class="chip ${s30.views >= s30prev ? 'good' : 'bad'}">${s30.views >= s30prev ? '+' : ''}${pct(s30.views - s30prev, s30prev)} vs previous 30</span>` : `${fmt(s30.visitors)} visitors`)}
        ${kpi('Ad clicks (30 days)', fmt(s30.ad_clicks), `CTR ${pct(s30.ad_clicks, s30.ad_views)}`)}
      </div>
      <div class="grid two" style="margin-top:16px">
        <div class="panel"><div class="panel-head"><h3>Downloads over time</h3><span class="muted" style="font-size:12px">Store + GitHub</span></div><div class="panel-body"><div class="chart-box"><canvas id="c1"></canvas></div></div></div>
        <div class="panel"><div class="panel-head"><h3>Downloads by app</h3></div><div class="panel-body"><div class="chart-box"><canvas id="c2"></canvas></div></div></div>
      </div>
      <div class="grid two" style="margin-top:16px">
        <div class="panel"><div class="panel-head"><h3>Site visits, last 30 days</h3></div><div class="panel-body"><div class="chart-box"><canvas id="c3"></canvas></div></div></div>
        <div class="panel"><div class="panel-head"><h3>Top sites (30 days)</h3></div><div class="table-wrap">${topSitesTable()}</div></div>
      </div>`;

    const snaps = state.cache.snaps;
    const pal = PALETTE();
    chart($('#c1'), {
      type: 'line',
      data: { labels: snaps.map((s) => niceDay(s.day)), datasets: [
        { label: 'Total', data: snaps.map((s) => s.data.totals.downloads), borderColor: pal[0], backgroundColor: pal[0] + '22', fill: true, tension: .3, pointRadius: 0, borderWidth: 2.5 },
        { label: 'GitHub', data: snaps.map((s) => s.data.totals.githubDownloads), borderColor: pal[1], tension: .3, pointRadius: 0, borderWidth: 2 },
        { label: 'Store', data: snaps.map((s) => s.data.totals.storeInstalls), borderColor: pal[2], tension: .3, pointRadius: 0, borderWidth: 2 },
      ] },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
    });
    chart($('#c2'), {
      type: 'doughnut',
      data: { labels: L.apps.map((a) => a.name), datasets: [{ data: L.apps.map((a) => a.downloads), backgroundColor: pal, borderWidth: 0 }] },
      options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } } },
    });
    const days = [...Array(30)].map((_, i) => daysAgo(29 - i));
    const siteIds = state.cache.sites.map((s) => s.id);
    chart($('#c3'), {
      type: 'bar',
      data: { labels: days.map(niceDay), datasets: siteIds.map((id, i) => ({
        label: state.cache.sites[i].name, backgroundColor: pal[i % pal.length], borderRadius: 3,
        data: days.map((d) => Number((state.cache.daily.find((r) => r.site_id === id && r.day === d) || {}).views || 0)),
      })) },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } }, scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } },
    });
  }

  function kpi(label, value, foot) {
    return `<div class="panel kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="foot">${foot || '&nbsp;'}</div></div>`;
  }

  function topSitesTable() {
    const rows = state.cache.sites.map((s) => ({ s, t: siteSum(s.id, 30) })).sort((a, b) => b.t.views - a.t.views);
    if (!rows.some((r) => r.t.views)) return '<div class="empty">No visits yet. Add the embed code to your sites (Sites & visits page).</div>';
    return `<table><tr><th>Site</th><th class="r">Visits</th><th class="r">Visitors</th></tr>${rows.map(({ s, t }) => `<tr><td>${esc(s.name)}</td><td class="r num">${fmt(t.views)}</td><td class="r num">${fmt(t.visitors)}</td></tr>`).join('')}</table>`;
  }

  function apps(v) {
    const L = latest();
    if (!L) { v.innerHTML = '<div class="panel empty">No stats yet.</div>'; return; }
    const P = snapAgo(7);
    v.innerHTML = `<div class="grid apps-grid">${L.apps.map((a) => {
      const prev = P?.apps?.find((x) => x.name === a.name);
      const rows = [];
      if (a.store) {
        rows.push(['Microsoft Store installs', `${fmt(a.store.installs)} ${a.store.source === 'manual' ? `<span class="chip warn">${niceDay(a.store.date)}</span>` : '<span class="chip good">live</span>'}`]);
        rows.push(['Store page views', fmt(a.store.pageViews)]);
        rows.push(['Store conversion', pct(a.store.installs, a.store.pageViews)]);
      }
      if (a.storeId) rows.push(['Store rating', a.ratingCount ? `<span class="stars">${stars(a.rating)}</span> ${a.rating.toFixed(1)} (${fmt(a.ratingCount)})` : '<span class="muted">No ratings yet</span>']);
      if (a.github) {
        rows.push(['GitHub downloads', fmt(a.github.downloads)]);
        rows.push(['GitHub stars', fmt(a.github.stars)]);
      }
      const versions = (a.github?.versions || []).filter((x) => x.downloads);
      return `<div class="panel app-card">
        <div class="head"><h3>${esc(a.name)}</h3>${delta(a.downloads, prev?.downloads)}</div>
        <div class="big">${fmt(a.downloads)}<span class="muted" style="font-size:13px;font-weight:500"> downloads</span></div>
        ${rows.map(([k, val]) => `<div class="kv"><span class="muted">${k}</span><span>${val}</span></div>`).join('')}
        ${versions.length ? `<div class="kv"><span class="muted">By version</span><span style="font-weight:500">${versions.slice(0, 4).map((x) => `${esc(x.tag)}: ${fmt(x.downloads)}`).join(' · ')}</span></div>` : ''}
        <div class="links">${[a.storeUrl && `<a href="${esc(a.storeUrl)}" target="_blank" rel="noopener">Store page</a>`, a.repo && `<a href="https://github.com/${esc(a.repo)}" target="_blank" rel="noopener">GitHub</a>`, a.site && `<a href="${esc(a.site)}" target="_blank" rel="noopener">Website</a>`].filter(Boolean).join('')}</div>
      </div>`;
    }).join('')}</div>
    <p class="muted" style="font-size:12px;margin-top:14px">Ratings come from the public Microsoft Store page. Store installs become live once the Partner Center key is added to GitHub.</p>`;
  }

  function snippet(id) { return `<script src="${SNIPPET_URL}" data-site="${id}" defer><\/script>`; }

  function sites(v) {
    const L = latest();
    const status = (url) => L?.sites?.find((s) => s.url.replace(/\/$/, '') === url.replace(/\/$/, ''));
    v.innerHTML = `
      <div class="panel"><div class="table-wrap"><table>
        <tr><th>Site</th><th>Status</th><th class="r">Visits 7d</th><th class="r">Visits 30d</th><th class="r">Visitors 30d</th><th class="r">Ad clicks 30d</th><th class="r">Embed</th></tr>
        ${state.cache.sites.map((s) => {
          const st = status(s.url); const w = siteSum(s.id, 7); const m = siteSum(s.id, 30);
          return `<tr>
            <td><div style="font-weight:600">${esc(s.name)}</div><a href="${esc(s.url)}" target="_blank" rel="noopener" style="font-size:12px">${esc(s.url.replace(/^https?:\/\//, ''))}</a></td>
            <td>${st ? `<span class="dot ${st.up ? 'up' : 'down'}"></span>${st.up ? 'Up' : `Down (${esc(st.status)})`}` : '<span class="muted">—</span>'}</td>
            <td class="r num">${fmt(w.views)}</td><td class="r num">${fmt(m.views)}</td><td class="r num">${fmt(m.visitors)}</td><td class="r num">${fmt(m.ad_clicks)}</td>
            <td class="r"><button class="btn sm" data-copy="${esc(s.id)}">Copy code</button></td></tr>`;
        }).join('')}
      </table></div></div>

      <div class="grid halves" style="margin-top:16px">
        <div class="panel"><div class="panel-head"><h3>Add the code to a site</h3></div><div class="panel-body">
          <p style="margin-top:0">Paste one line before <code>&lt;/body&gt;</code> on every page of the site. It counts visits and shows the ads you set on the Ads page.</p>
          <code class="snippet" id="snip">${esc(snippet(state.cache.sites[0]?.id || 'your-site'))}</code>
          <p class="muted" style="font-size:12px;margin-bottom:0">Change <b>data-site</b> to the site ID. Ads go to the top, the middle and the bottom of the page by themselves. To choose the exact spot, add <code>&lt;div data-selecta-ad="top"&gt;&lt;/div&gt;</code> (or inline, bottom) where you want it.</p>
        </div></div>
        <div class="panel"><div class="panel-head"><h3>Add a site</h3></div><div class="panel-body">
          <form id="siteForm" class="grid" style="gap:12px">
            <div class="row2">
              <div class="field"><label>Site ID</label><input type="text" name="id" placeholder="my-site" pattern="[a-z0-9-]{2,40}" required><span class="hint">Small letters, numbers and dashes.</span></div>
              <div class="field"><label>Name</label><input type="text" name="name" placeholder="My site" required></div>
            </div>
            <div class="field"><label>URL</label><input type="url" name="url" placeholder="https://…" required></div>
            <div><button class="btn primary" type="submit">${ICONS.plus}Add site</button></div>
          </form>
        </div></div>
      </div>`;
    $$('[data-copy]', v).forEach((b) => (b.onclick = async () => {
      const code = snippet(b.dataset.copy);
      $('#snip').textContent = code;
      try { await navigator.clipboard.writeText(code); toast('Embed code copied'); } catch { toast('Select the code and copy it'); }
    }));
    $('#siteForm').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try {
        await api.addSite({ id: f.get('id').trim(), name: f.get('name').trim(), url: f.get('url').trim() });
        await load(true); render(); toast('Site added');
      } catch (err) { toast(err.message); }
    };
  }

  function adStatus(a) {
    const now = Date.now();
    if (!a.active) return '<span class="chip gray">Off</span>';
    if (a.starts_at && new Date(a.starts_at) > now) return '<span class="chip warn">Scheduled</span>';
    if (a.ends_at && new Date(a.ends_at) <= now) return '<span class="chip gray">Ended</span>';
    return '<span class="chip good">Live</span>';
  }

  function ads(v) {
    const list = state.cache.ads;
    const tot = Object.fromEntries((state.cache.adTotals || []).map((t) => [t.ad_id, t]));
    const siteName = (id) => (id ? state.cache.sites.find((s) => s.id === id)?.name || id : 'All sites');
    v.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div class="muted">${list.length} ads · ${list.filter((a) => a.active).length} on</div>
        <button class="btn primary" id="newAd">${ICONS.plus}New ad</button>
      </div>
      <div class="panel"><div class="table-wrap">${list.length ? `<table>
        <tr><th>Ad</th><th>Site</th><th>Placement</th><th>Status</th><th class="r">Views</th><th class="r">Clicks</th><th class="r">CTR</th><th>On</th><th class="r"></th></tr>
        ${list.map((a) => { const t = tot[a.id] || { views: 0, clicks: 0 }; return `<tr>
          <td><div style="font-weight:600">${esc(a.name)}</div><div class="muted" style="font-size:12px">${KINDS[a.kind]}${a.starts_at || a.ends_at ? ` · ${a.starts_at ? niceDateTime(a.starts_at) : 'now'} → ${a.ends_at ? niceDateTime(a.ends_at) : 'no end'}` : ''}</div></td>
          <td>${esc(siteName(a.site_id))}</td><td>${SLOTS[a.slot]}</td><td>${adStatus(a)}</td>
          <td class="r num">${fmt(t.views)}</td><td class="r num">${fmt(t.clicks)}</td><td class="r num">${pct(Number(t.clicks), Number(t.views))}</td>
          <td><label class="switch"><input type="checkbox" data-toggle="${esc(a.id)}" ${a.active ? 'checked' : ''}><span></span></label></td>
          <td class="r" style="white-space:nowrap"><button class="btn sm" data-edit="${esc(a.id)}">Edit</button> <button class="btn sm danger" data-del="${esc(a.id)}">Delete</button></td>
        </tr>`; }).join('')}</table>` : '<div class="empty">No ads yet. Click "New ad" to create your first one.</div>'}</div></div>`;
    $('#newAd').onclick = () => adForm();
    $$('[data-edit]', v).forEach((b) => (b.onclick = () => adForm(list.find((a) => a.id === b.dataset.edit))));
    $$('[data-del]', v).forEach((b) => (b.onclick = async () => {
      const a = list.find((x) => x.id === b.dataset.del);
      if (!confirm(`Delete the ad "${a.name}"? This can't be undone.`)) return;
      try { await api.deleteAd(a.id); await load(true); render(); toast('Ad deleted'); } catch (e) { toast(e.message); }
    }));
    $$('[data-toggle]', v).forEach((c) => (c.onchange = async () => {
      try { await api.setAdActive(c.dataset.toggle, c.checked); await load(true); render(); toast(c.checked ? 'Ad is on' : 'Ad is off'); } catch (e) { toast(e.message); c.checked = !c.checked; }
    }));
  }

  const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  function adForm(ad) {
    const a = ad ? { ...ad } : { kind: 'image', slot: 'top', site_id: null, active: true, priority: 0 };
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-head"><h3>${ad ? 'Edit ad' : 'New ad'}</h3><button class="icon-btn" id="x" aria-label="Close">${ICONS.close}</button></div>
      <div class="drawer-body">
        <form class="drawer-form" id="f">
          <div class="field"><label>Ad name (only you see this)</label><input type="text" name="name" required maxlength="120" value="${esc(a.name || '')}" placeholder="e.g. Selecta Pro launch"></div>
          <div class="field"><label>Type</label><div class="seg">${Object.entries(KINDS).map(([k, l]) => `<label><input type="radio" name="kind" value="${k}" ${a.kind === k ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
          <div class="row2">
            <div class="field"><label>Show on</label><select name="site_id"><option value="">All sites</option>${state.cache.sites.map((s) => `<option value="${esc(s.id)}" ${a.site_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Placement</label><select name="slot">${Object.entries(SLOTS).map(([k, l]) => `<option value="${k}" ${a.slot === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          </div>
          <div class="k-image k-text field"><label>Link (where the ad opens)</label><input type="url" name="link_url" value="${esc(a.link_url || '')}" placeholder="https://…"></div>
          <div class="k-image field"><label>Banner image</label>
            <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif">
            <input type="url" name="image_url" value="${esc(a.image_url && !a.image_url.startsWith('data:') ? a.image_url : '')}" placeholder="…or paste an image URL">
            <span class="hint">Best size: 1200 × 240 px (wide banner).</span></div>
          <div class="k-image k-text field"><label>Title</label><input type="text" name="title" maxlength="120" value="${esc(a.title || '')}" placeholder="Short headline"></div>
          <div class="k-text field"><label>Text</label><input type="text" name="body" maxlength="400" value="${esc(a.body || '')}" placeholder="One short sentence"></div>
          <div class="k-text field"><label>Button text</label><input type="text" name="button_text" maxlength="40" value="${esc(a.button_text || '')}" placeholder="Learn more"></div>
          <div class="k-html field"><label>Ad code</label><textarea name="html" placeholder="Paste the code from AdSense or another ad network">${esc(a.html || '')}</textarea><span class="hint">This code runs on your sites. Only paste code you trust.</span></div>
          <div class="row2">
            <div class="field"><label>Start (optional)</label><input type="datetime-local" name="starts_at" value="${toLocalInput(a.starts_at)}"></div>
            <div class="field"><label>End (optional)</label><input type="datetime-local" name="ends_at" value="${toLocalInput(a.ends_at)}"></div>
          </div>
          <div class="row2">
            <div class="field"><label>Priority</label><input type="number" name="priority" value="${Number(a.priority || 0)}" min="0" max="100"><span class="hint">Higher shows first when two ads share a spot.</span></div>
            <div class="field"><label>Status</label><label style="display:flex;align-items:center;gap:10px;padding-top:6px"><span class="switch"><input type="checkbox" name="active" ${a.active ? 'checked' : ''}><span></span></span> Show this ad</label></div>
          </div>
        </form>
        <div class="drawer-preview"><div class="section-title" style="margin-top:0">Preview</div><div class="preview-frame" id="pv"></div></div>
      </div>
      <div class="drawer-foot"><button class="btn" id="cancel">Cancel</button><button class="btn primary" id="save">${ad ? 'Save changes' : 'Create ad'}</button></div>
    </div>`;
    document.body.appendChild(o);
    const f = $('#f', o);
    let uploaded = a.image_url && a.image_url.startsWith('data:') ? a.image_url : null;
    const close = () => o.remove();
    $('#x', o).onclick = close; $('#cancel', o).onclick = close;
    o.addEventListener('click', (e) => { if (e.target === o) close(); });

    const read = () => {
      const d = Object.fromEntries(new FormData(f));
      return {
        id: a.id, name: d.name.trim(), kind: d.kind, slot: d.slot, site_id: d.site_id || null,
        link_url: d.link_url?.trim() || null, image_url: uploaded || d.image_url?.trim() || null,
        title: d.title?.trim() || null, body: d.body?.trim() || null, button_text: d.button_text?.trim() || null,
        html: d.html || null, priority: Number(d.priority || 0), active: f.active.checked,
        starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
        ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
      };
    };
    const sync = () => {
      const kind = f.kind.value;
      $$('.k-image, .k-text, .k-html', f).forEach((el) => el.classList.toggle('hidden', !el.classList.contains('k-' + kind)));
      const pv = $('#pv', o);
      pv.innerHTML = '';
      const cur = read();
      const ready = cur.kind === 'image' ? cur.image_url : cur.kind === 'text' ? cur.title : cur.html;
      if (!ready) { pv.innerHTML = '<div class="muted" style="font-size:13px;text-align:center;padding:30px 0">Fill in the ad to see it here.</div>'; return; }
      pv.appendChild(window.SelectaAdRender.render(cur, { htmlMode: 'sandbox' }));
    };
    f.addEventListener('input', sync);
    f.addEventListener('change', sync);
    f.file.onchange = async () => {
      const file = f.file.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast('Image is too big. Use one under 2 MB.'); f.file.value = ''; return; }
      $('#save', o).disabled = true; $('#save', o).textContent = 'Uploading…';
      try { uploaded = await api.uploadImage(file); f.image_url.value = DEMO ? '' : uploaded; toast('Image uploaded'); }
      catch (e) { toast(e.message); }
      finally { $('#save', o).disabled = false; $('#save', o).textContent = ad ? 'Save changes' : 'Create ad'; sync(); }
    };
    f.image_url.oninput = () => { uploaded = null; };
    sync();

    $('#save', o).onclick = async () => {
      if (!f.reportValidity()) return;
      const row = read();
      if (row.kind === 'image' && !row.image_url) return toast('Add a banner image.');
      if (row.kind === 'text' && !row.title) return toast('Add a title.');
      if (row.kind === 'html' && !row.html) return toast('Paste the ad code.');
      if (row.starts_at && row.ends_at && row.ends_at <= row.starts_at) return toast('The end must be after the start.');
      if (row.kind !== 'html') row.html = null;
      if (row.kind !== 'image') row.image_url = null;
      if (row.kind !== 'text') { row.body = null; row.button_text = null; }
      try { await api.saveAd(row); close(); await load(true); render(); toast(ad ? 'Ad saved' : 'Ad created'); }
      catch (e) { toast(e.message); }
    };
  }

  async function settings(v) {
    v.innerHTML = '<div class="loading">Loading…</div>';
    let admins = [];
    try { admins = await api.admins(); } catch (e) { toast(e.message); }
    const me = (state.user?.email || '').toLowerCase();
    const theme = document.documentElement.dataset.theme || 'auto';
    v.innerHTML = `
      <div class="grid halves">
        <div class="panel"><div class="panel-head"><h3>Admins</h3></div>
          <div class="table-wrap"><table>${admins.map((a) => `<tr><td>${esc(a.email)}${a.email === me ? ' <span class="chip">you</span>' : ''}</td><td class="r">${a.email === me ? '' : `<button class="btn sm danger" data-rm="${esc(a.email)}">Remove</button>`}</td></tr>`).join('')}</table></div>
          <div class="panel-body" style="border-top:1px solid var(--line)">
            <form id="adminForm" style="display:flex;gap:8px;flex-wrap:wrap">
              <div class="field" style="flex:1;min-width:200px"><input type="email" name="email" placeholder="name@gmail.com" required></div>
              <button class="btn primary" type="submit">${ICONS.plus}Add admin</button>
            </form>
            <p class="muted" style="font-size:12px;margin-bottom:0">New admins sign in with the Google account of that email.</p>
          </div>
        </div>
        <div class="grid" style="align-content:start">
          <div class="panel"><div class="panel-head"><h3>Where ads show</h3></div><div class="panel-body">
            <div class="kv" style="padding-left:0;padding-right:0;border-top:0"><span><b>Top banner</b></span><span class="muted" style="font-weight:400">Under the header</span></div>
            <div class="kv" style="padding-left:0;padding-right:0"><span><b>In content</b></span><span class="muted" style="font-weight:400">In the middle of the page</span></div>
            <div class="kv" style="padding-left:0;padding-right:0"><span><b>Before footer</b></span><span class="muted" style="font-weight:400">At the end of the page</span></div>
            <p class="muted" style="font-size:12px;margin-bottom:0">One ad shows per spot: the one with the highest priority. Ads always carry a small "Ad" label.</p>
          </div></div>
          <div class="panel"><div class="panel-head"><h3>Appearance</h3></div><div class="panel-body">
            <div class="seg">${['auto', 'light', 'dark'].map((t) => `<label><input type="radio" name="theme" value="${t}" ${theme === t ? 'checked' : ''}><span>${t[0].toUpperCase() + t.slice(1)}</span></label>`).join('')}</div>
          </div></div>
        </div>
      </div>`;
    $$('input[name=theme]', v).forEach((r) => (r.onchange = () => setTheme(r.value)));
    $$('[data-rm]', v).forEach((b) => (b.onclick = async () => {
      if (!confirm(`Remove ${b.dataset.rm} from admins?`)) return;
      try { await api.removeAdmin(b.dataset.rm); render(); toast('Admin removed'); } catch (e) { toast(e.message); }
    }));
    $('#adminForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await api.addAdmin(new FormData(e.target).get('email')); render(); toast('Admin added'); } catch (err) { toast(err.message); }
    };
  }

  // ---------- start ----------
  async function start() {
    try {
      state.user = await api.user();
      if (!state.user) return showLogin();
      if (!(await api.isAdmin())) {
        await api.signOut();
        return showLogin(`${state.user.email} is not an admin. Ask an admin to add you.`);
      }
      root.innerHTML = '<div class="loading">Loading your numbers…</div>';
      await load();
      render();
    } catch (e) {
      console.error(e);
      showLogin(`Something went wrong: ${e.message}`);
    }
  }
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v !== state.view && TITLES[v]) go(v); });
  start();
})();
