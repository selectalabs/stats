/* Selecta Labs site snippet: counts visits and shows ads managed from the admin dashboard.
   Usage: <script src="https://selectalabs.github.io/stats/selecta.js" data-site="selectaai" defer></script>
   Optional spots: <div data-selecta-ad="top"></div>, "inline", "bottom". Add data-ads="off" to the script tag to count visits only. */
(function () {
  var URL_ = '__SUPABASE_URL__';
  var KEY = '__SUPABASE_ANON_KEY__';
  if (URL_.indexOf('__') === 0) return; // not configured yet
  if (window.__selectaLoaded) return;
  window.__selectaLoaded = true;

  var me = document.currentScript || document.querySelector('script[data-site][src*="selecta.js"]');
  var site = me && me.getAttribute('data-site');
  if (!site) return;
  var adsOn = (me.getAttribute('data-ads') || 'on') !== 'off';
  var headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (KEY.indexOf('eyJ') === 0) headers.Authorization = 'Bearer ' + KEY; // legacy JWT keys only

  function visitor() {
    try {
      var v = localStorage.getItem('sl_vid');
      if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('sl_vid', v); }
      return v.slice(0, 40);
    } catch (e) { return null; }
  }
  var vid = visitor();

  function send(type, adId) {
    if (navigator.webdriver) return;
    var body = JSON.stringify({
      site_id: site, type: type, ad_id: adId || null,
      path: (location.pathname || '/').slice(0, 300),
      referrer: (document.referrer || '').slice(0, 300) || null,
      visitor: vid,
    });
    try {
      fetch(URL_ + '/rest/v1/events', { method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, headers), body: body, keepalive: true });
    } catch (e) { /* ignore */ }
  }

  send('view');
  if (!adsOn) return;

  function spot(slot) {
    var holder = document.querySelector('[data-selecta-ad="' + slot + '"]');
    if (holder) return holder;
    holder = document.createElement('div');
    holder.className = 'sl-slot sl-slot-' + slot;
    holder.style.cssText = 'max-width:1100px;margin:0 auto;padding:0 16px';
    var main = document.querySelector('main') || document.body;
    if (slot === 'top') {
      var header = document.querySelector('header');
      if (header && header.parentNode) header.parentNode.insertBefore(holder, header.nextSibling);
      else main.insertBefore(holder, main.firstChild);
    } else if (slot === 'bottom') {
      var footer = document.querySelector('footer');
      if (footer && footer.parentNode) footer.parentNode.insertBefore(holder, footer);
      else main.appendChild(holder);
    } else {
      var blocks = [].filter.call(main.children, function (el) {
        return /^(SECTION|ARTICLE|P|DIV)$/.test(el.tagName) && el.offsetHeight > 80 && !el.classList.contains('sl-slot');
      });
      var mid = blocks[Math.floor(blocks.length / 2)];
      if (mid && mid.parentNode) mid.parentNode.insertBefore(holder, mid.nextSibling);
      else main.appendChild(holder);
    }
    return holder;
  }

  function watch(el, ad) {
    if (!('IntersectionObserver' in window)) { send('ad_view', ad.id); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) { send('ad_view', ad.id); io.disconnect(); }
      });
    }, { threshold: [0.5] });
    io.observe(el);
  }

  function show(ads) {
    var bySlot = {};
    ads.forEach(function (a) { if (!bySlot[a.slot]) bySlot[a.slot] = a; }); // already sorted by priority
    Object.keys(bySlot).forEach(function (slot) {
      var ad = bySlot[slot];
      var el = window.SelectaAdRender.render(ad, { htmlMode: 'run', onClick: function () { send('ad_click', ad.id); } });
      spot(slot).appendChild(el);
      watch(el, ad);
    });
  }

  var q = '/rest/v1/ads?select=id,name,site_id,slot,kind,title,body,button_text,image_url,link_url,html,priority' +
    '&or=(site_id.is.null,site_id.eq.' + encodeURIComponent(site) + ')&order=priority.desc,created_at.desc';
  function go() {
    fetch(URL_ + q, { headers: headers })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { if (list && list.length) show(list); })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
