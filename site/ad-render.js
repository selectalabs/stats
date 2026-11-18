/* Shared ad renderer: used by the dashboard preview and by selecta.js on the sites. */
(function (global) {
  var CSS = [
    '.sl-ad{position:relative;box-sizing:border-box;max-width:100%;margin:16px auto;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.45}',
    '.sl-ad *{box-sizing:border-box}',
    '.sl-ad-tag{position:absolute;top:6px;right:8px;font-size:10px;font-weight:600;letter-spacing:.04em;color:#6b7280;background:rgba(255,255,255,.85);padding:1px 6px;border-radius:4px;z-index:1}',
    '.sl-ad-image{display:block;border-radius:12px;overflow:hidden;line-height:0}',
    '.sl-ad-image img{display:block;width:100%;height:auto;max-height:320px;object-fit:cover}',
    '.sl-ad-text{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 18px;border:1px solid rgba(127,127,127,.25);border-radius:12px;background:rgba(127,127,127,.06);color:inherit}',
    '.sl-ad-copy{flex:1 1 240px;min-width:0}',
    '.sl-ad-copy strong{display:block;font-size:16px;margin-bottom:2px}',
    '.sl-ad-copy span{display:block;font-size:14px;opacity:.8}',
    '.sl-ad-btn{flex:none;display:inline-block;padding:9px 16px;border-radius:9px;background:#3563ff;color:#fff !important;font-weight:600;font-size:14px;text-decoration:none !important}',
    '.sl-ad-btn:hover{filter:brightness(1.07)}',
    '.sl-ad-html{min-height:20px}',
    '.sl-slot-top .sl-ad{margin-top:12px}',
    '@media (max-width:560px){.sl-ad-text{padding:14px}.sl-ad-btn{width:100%;text-align:center}}'
  ].join('\n');

  function injectCss(doc) {
    doc = doc || document;
    if (doc.getElementById('sl-ad-css')) return;
    var s = doc.createElement('style');
    s.id = 'sl-ad-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function el(doc, tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function safeUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null;
  }

  // Runs <script> tags inside ad HTML (needed for ad networks like AdSense).
  function runHtml(container, html, doc) {
    var range = doc.createRange();
    range.selectNodeContents(doc.body || doc.documentElement);
    container.appendChild(range.createContextualFragment(html));
  }

  /**
   * render(ad, opts) -> HTMLElement
   * opts.doc: document to build in. opts.onClick(ad): called on clicks.
   * opts.htmlMode: 'run' (sites) or 'sandbox' (dashboard preview).
   */
  function render(ad, opts) {
    opts = opts || {};
    var doc = opts.doc || document;
    injectCss(doc);
    var wrap;
    var link = safeUrl(ad.link_url);
    var click = function () { if (opts.onClick) opts.onClick(ad); };

    if (ad.kind === 'image') {
      wrap = el(doc, link ? 'a' : 'div', 'sl-ad sl-ad-image');
      if (link) { wrap.href = link; wrap.target = '_blank'; wrap.rel = 'sponsored noopener'; wrap.addEventListener('click', click); }
      var img = el(doc, 'img');
      img.src = safeUrl(ad.image_url) || (/^data:image\//.test(ad.image_url || '') ? ad.image_url : '');
      img.alt = ad.title || ad.name || 'Advertisement';
      img.loading = 'lazy';
      wrap.appendChild(img);
    } else if (ad.kind === 'text') {
      wrap = el(doc, 'div', 'sl-ad sl-ad-text');
      var copy = el(doc, 'div', 'sl-ad-copy');
      copy.appendChild(el(doc, 'strong', null, ad.title || ''));
      if (ad.body) copy.appendChild(el(doc, 'span', null, ad.body));
      wrap.appendChild(copy);
      if (link) {
        var b = el(doc, 'a', 'sl-ad-btn', ad.button_text || 'Learn more');
        b.href = link; b.target = '_blank'; b.rel = 'sponsored noopener';
        b.addEventListener('click', click);
        wrap.appendChild(b);
      }
    } else {
      wrap = el(doc, 'div', 'sl-ad sl-ad-html');
      if (opts.htmlMode === 'sandbox') {
        var f = el(doc, 'iframe');
        f.setAttribute('sandbox', 'allow-scripts allow-popups');
        f.style.cssText = 'width:100%;border:0;min-height:120px;background:#fff;border-radius:8px';
        f.srcdoc = '<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:system-ui">' + (ad.html || '') + '</body>';
        wrap.appendChild(f);
      } else {
        runHtml(wrap, ad.html || '', doc);
        wrap.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) click(); });
      }
    }
    if (ad.kind !== 'html') wrap.appendChild(el(doc, 'span', 'sl-ad-tag', 'Ad'));
    wrap.setAttribute('data-ad-id', ad.id || '');
    return wrap;
  }

  global.SelectaAdRender = { render: render, injectCss: injectCss };
})(window);
