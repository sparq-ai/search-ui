/*!
 * sparq-widget.js — ONE self-contained file that renders a full themed search
 * storefront (facet sidebar, results grid, sort, pagination, favorites) on top
 * of the Sparq Search UI Web Components. No build step, no other files: it
 * self-loads the Sparq library from CDN at runtime.
 *
 * NOTE: a .js file shows nothing on its own — it must be included on an HTML
 * page. When included, it auto-creates its mount point, so this is enough:
 *
 * ── See it instantly (demo data, no backend) ────────────────────────────────
 *   <script src="sparq-widget.js" data-demo defer></script>
 *   (Renders the full storefront UI with built-in sample products.)
 *
 * ── Plain HTML (live search) ────────────────────────────────────────────────
 *   <div id="sparq-widget"
 *        data-app-id="atlantic"
 *        data-api-key="pk_search_xxx"
 *        data-collection="ammunition"></div>
 *   <script src="sparq-widget.js" defer></script>
 *   (No <div>? It auto-creates one on <body>. Use data-target="#some-container"
 *    or window.SparqWidget.target to place it precisely.)
 *
 * ── PrestaShop module ───────────────────────────────────────────────────────
 *   1) Copy this file into your module, e.g. modules/yourmodule/views/js/sparq-widget.js
 *   2) Enqueue it from your module PHP (footer hook):
 *        public function hookDisplayFooter($params) {
 *          $this->context->controller->addJS(
 *            $this->_path.'views/js/sparq-widget.js'
 *          );
 *        }
 *   3) Put the mount point in a template (.tpl) on the page you want search on:
 *        <div id="sparq-widget"
 *             data-app-id="{$sparq_app_id}"
 *             data-api-key="{$sparq_api_key}"
 *             data-collection="{$sparq_collection}"></div>
 *      (Or output a <script>window.SparqWidget = {...}</script> from PHP for the
 *      full config below — richer than data-* attributes.)
 *
 * ── Configuration (window.SparqWidget = {...}  OR  data-* on the mount) ──────
 *   Precedence: window.SparqWidget object > data-* attributes > defaults.
 *   Keys: mount, libUrl, appId, apiKey, collection, apiHost, itemsPerPage,
 *         routing, title, breadcrumb[], description, sortOptions, facets[],
 *         fields{name,image,url,price,salePrice,financingUrl}, currency, locale,
 *         financingThreshold, financingLabel, theme{primary,accent,...}.
 *   data-* supported: data-app-id, data-api-key, data-collection, data-api-host,
 *         data-lib-url, data-title, data-items-per-page.
 *   See the DEFAULTS object below for every option and its shape.
 *
 * Pin libUrl to a version tag in production (e.g. search-ui@1) or self-host the
 * library and point libUrl at it — the default is jsDelivr @main.
 */
(function () {
  'use strict';

  // The <script> element that loaded this file (valid only during sync exec) —
  // lets you configure via data-* on the tag itself, e.g. <script data-demo>.
  var SCRIPT_EL = document.currentScript;

  // ── Configuration ─────────────────────────────────────────────────────────
  // Precedence: window.SparqWidget(Config) object  >  data-* on the mount node
  //             >  the defaults below.
  var DEFAULTS = {
    mount: '#sparq-widget',
    // Where to auto-create the mount if it doesn't exist (CSS selector).
    // Empty = append to <body>. Point this at your PrestaShop content region.
    target: '',
    // Demo mode: render with built-in sample data so you can SEE the UI with
    // zero backend/credentials. Turn OFF (or set real appId/apiKey) for production.
    demo: false,
    // Sparq library bundle. Pin to a tag in production, e.g. search-ui@1.
    libUrl: 'https://cdn.jsdelivr.net/gh/sparq-ai/search-ui@main/lib/sparq.js',

    // Backend — supply appId + apiKey from your PrestaShop page (NOT committed
    // here, to keep the key out of this public repo). On your page:
    //   <div id="sparq-widget"
    //        data-app-id="YOUR_APP_ID"
    //        data-api-key="YOUR_SEARCH_KEY"></div>
    // or  <script>window.SparqWidget = { appId:'…', apiKey:'…' }</script>
    appId: '',   // → https://{appId}.fast.sparq.ai
    apiKey: '',  // Search API key
    collection: 'WDYA3L618EVR5V3ZXE8HGYAR',   // Atlantic "Products" (2599 items)
    apiHost: '', // optional custom host; 'mock:' uses window.__SPARQ_MOCK__

    itemsPerPage: 12,
    routing: true, // sync filters/page to the URL (back/forward works)

    // Page chrome.
    title: 'Products',
    breadcrumb: [{ label: 'Home', url: 'https://atlanticfirearms.com/' }, { label: 'Products' }],
    description:
      'Search the full Atlantic Firearms catalog — firearms, ammunition, parts and accessories.',

    // Sort options (value|Label, comma separated). Sort fields must exist in the
    // collection; price/name are present on every record.
    sortOptions:
      'relevance|Featured, price:asc|Price, low to high, price:desc|Price, high to low, name:asc|Name A–Z',

    // Sidebar facets. type: 'filters' | 'range' | 'toggle'.
    // IMPORTANT: only attributes CONFIGURED AS FACETS on the collection may be
    // used here — requesting a NON-configured attribute breaks the whole search.
    // Configured on "Products": brand, availability, categoryIds, Caliber,
    // BarrelLength, FirearmFit, feature_5. Empty facets auto-hide (see
    // data-facet-attr), so Caliber/BarrelLength/FirearmFit will appear the moment
    // their data is populated on the records. (categoryIds is faceted as numeric
    // IDs — facet `categories` instead for readable names, then add it here.)
    facets: [
      { type: 'filters', attribute: 'Caliber', title: 'Caliber / Gauge', searchable: true, limit: 5, showMore: true },
      { type: 'filters', attribute: 'BarrelLength', title: 'Barrel Length', mode: 'single', links: true },
      // STOPGAP: categoryIds shows numeric IDs. Facet `categories` for names, then
      // switch attribute to 'categories' below.
      { type: 'filters', attribute: 'categoryIds', title: 'Category', searchable: true, limit: 8, showMore: true, links: true },
      { type: 'range', attribute: 'price', title: 'Price', prefix: '$', min: 0, max: 18000, step: 10 },
      { type: 'filters', attribute: 'brand', title: 'Brand', searchable: true, limit: 6, showMore: true, links: true },
      { type: 'filters', attribute: 'FirearmFit', title: 'Firearm Fit', collapsible: true, links: true },
      { type: 'toggle', attribute: 'availability', value: 'In stock', label: 'Show In Stock Items Only' }
    ],

    // Field mapping onto the result card + price logic (real "Products" schema).
    // Sale shows when price < regularPrice: regularPrice is the "was", price the
    // "now". (Atlantic currently has no active discounts, so no badge shows.)
    fields: {
      name: 'name',
      image: 'image',
      url: 'url',
      price: 'regularPrice',   // original price ("PRICE:" line when on sale)
      salePrice: 'price',      // current price (the "Sale price" when lower)
      financingUrl: 'financingUrl'
    },

    currency: 'USD',
    locale: undefined, // undefined = browser default
    // Rewrite broken image hosts client-side. Atlantic's synced image URLs point
    // at sparq.atlanticfirearms.com (404) — the images actually live on
    // atlanticfirearms.com. { from, to } does a plain substring replace; set to
    // null to disable.
    imageRewrite: { from: 'sparq.atlanticfirearms.com', to: 'atlanticfirearms.com' },
    // Financing line: OFF by default (Infinity). Set a number (e.g. 200) to show
    // it on items whose price is at/above that amount.
    financingThreshold: Infinity,
    financingLabel: 'Pay over time with Credova',

    // Brand palette (all overridable).
    theme: {
      primary: '#16367d', // deep blue — active states, checkboxes, pagination
      primaryContrast: '#ffffff',
      accent: '#cf1f2b', // red — card title bar, sale badge
      cardFoot: '#111111', // black — card footer
      text: '#1f2937',
      border: '#d8dbe0',
      font: 'system-ui, Arial, Helvetica, sans-serif'
    }
  };

  function deepMerge(base, over) {
    if (!over) return base;
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(over).forEach(function (k) {
      var bv = base ? base[k] : undefined;
      var ov = over[k];
      out[k] = ov && typeof ov === 'object' && !Array.isArray(ov) && bv && typeof bv === 'object'
        ? deepMerge(bv, ov)
        : ov;
    });
    return out;
  }

  function readDataConfig(el) {
    if (!el) return {};
    var d = el.dataset || {};
    var cfg = {};
    if (d.appId) cfg.appId = d.appId;
    if (d.apiKey) cfg.apiKey = d.apiKey;
    if (d.collection) cfg.collection = d.collection;
    if (d.apiHost) cfg.apiHost = d.apiHost;
    if (d.libUrl) cfg.libUrl = d.libUrl;
    if (d.title) cfg.title = d.title;
    if (d.itemsPerPage) cfg.itemsPerPage = Number(d.itemsPerPage);
    if (d.target) cfg.target = d.target;
    if (d.demo != null) cfg.demo = d.demo !== 'false' && d.demo !== '0';
    return cfg;
  }

  // Built-in sample catalog so demo mode renders a real UI with no backend.
  function demoDataset() {
    var brands = ['Federal', 'Winchester', 'PMC', 'Wolf', 'Remington', 'Fiocchi'];
    var cals = ['.223 Remington', '9mm', '5.56 NATO', '12 Gauge', '7.62x39', '.308 Win'];
    var barrels = ['Under 16"', '16"-20"', '20"-24"', '24" and above'];
    var fits = ['Rifle', 'Pistol', 'Shotgun'];
    function img(label, color) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">' +
        '<rect width="400" height="300" fill="#f3f4f6"/>' +
        '<rect x="20" y="90" width="360" height="120" rx="8" fill="' + color + '"/>' +
        '<text x="200" y="162" font-family="Arial" font-size="24" fill="#fff" text-anchor="middle">' + label + '</text></svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    var colors = ['#334155', '#7f1d1d', '#1e3a8a', '#166534', '#92400e', '#4c1d95'];
    var data = [];
    for (var i = 0; i < 28; i++) {
      var brand = brands[i % brands.length];
      var caliber = cals[i % cals.length];
      var price = 40 + ((i * 37) % 480);
      var onSale = i % 3 === 0;
      data.push({
        id: i + 1,
        name: brand + ' ' + caliber + ' ' + (100 + ((i * 13) % 900)) + ' Rounds',
        brand: brand, caliber: caliber,
        barrelLength: barrels[i % barrels.length],
        firearmFit: fits[i % fits.length],
        availability: i % 5 === 0 ? 'out of stock' : 'in stock',
        inStock: i % 5 === 0 ? 'false' : 'true',
        price: price,
        salePrice: onSale ? Math.round(price * 0.88) : '',
        image: img(brand, colors[i % colors.length]),
        url: '#product-' + (i + 1)
      });
    }
    return data;
  }

  // ── Small helpers ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ── Theme CSS ─────────────────────────────────────────────────────────────
  function themeCss(cfg, rootSel) {
    var t = cfg.theme;
    return [
      // Design tokens pierce the Shadow DOM of every Sparq component.
      rootSel + ' {',
      '  --sparq-color-primary: ' + t.primary + ';',
      '  --sparq-color-primary-contrast: ' + t.primaryContrast + ';',
      '  --sparq-color-text: ' + t.text + ';',
      '  --sparq-color-border: ' + t.border + ';',
      '  --sparq-color-focus: ' + t.primary + ';',
      '  --sparq-radius: 4px;',
      '  --sparq-radius-sm: 3px;',
      '  --sparq-spacing: 8px;',
      '  --sparq-font-family: ' + t.font + ';',
      '  color: ' + t.text + '; font-family: ' + t.font + ';',
      '}',

      // Page shell / layout.
      rootSel + ' .sqw-breadcrumb { font-size: .85rem; color: #6b7280; margin: 4px 0 12px; }',
      rootSel + ' .sqw-breadcrumb a { color: #374151; text-decoration: none; }',
      rootSel + ' .sqw-breadcrumb a:hover { text-decoration: underline; }',
      rootSel + ' .sqw-title { font-size: 2rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; margin: 0 0 10px; }',
      rootSel + ' .sqw-desc { color: #4b5563; max-width: 70ch; margin: 0 0 20px; line-height: 1.5; }',
      rootSel + ' .sqw-layout { display: grid; grid-template-columns: 250px 1fr; gap: 32px; align-items: start; }',
      '@media (max-width: 760px) { ' + rootSel + ' .sqw-layout { grid-template-columns: 1fr; } }',

      // Sidebar facets.
      rootSel + ' .sqw-facet { padding: 14px 0; border-bottom: 1px solid #e5e7eb; }',
      rootSel + ' .sqw-facet-title { font-size: .8rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #111827; margin: 0 0 10px; list-style: none; cursor: default; }',
      rootSel + ' details.sqw-facet > summary.sqw-facet-title { cursor: pointer; display: flex; justify-content: space-between; align-items: center; }',
      rootSel + ' details.sqw-facet > summary.sqw-facet-title::-webkit-details-marker { display: none; }',
      rootSel + ' details.sqw-facet > summary.sqw-facet-title::after { content: "\\25BE"; color: #9ca3af; font-size: .8em; transition: transform .15s ease; }',
      rootSel + ' details.sqw-facet[open] > summary.sqw-facet-title::after { transform: rotate(180deg); }',

      // Bracketed counts on facet rows: [27].
      rootSel + ' sparq-filters::part(count) { color: #6b7280; font-variant-numeric: tabular-nums; }',
      rootSel + ' sparq-filters::part(count)::before { content: "["; }',
      rootSel + ' sparq-filters::part(count)::after { content: "]"; }',
      // Selected rows highlight in the brand blue.
      rootSel + ' sparq-filters::part(label-selected) { color: var(--sparq-color-primary); font-weight: 600; }',
      // Link-style facets: hide the checkbox/radio, show plain clickable rows.
      rootSel + ' .sqw-facet--links sparq-filters::part(checkbox) { display: none; }',
      rootSel + ' .sqw-facet--links sparq-filters::part(label) { gap: 4px; }',
      rootSel + ' sparq-range { display: block; }',
      rootSel + ' sparq-toggle::part(label) { font-size: .85rem; color: #374151; }',
      rootSel + ' .sqw-instock { padding-top: 14px; }',

      // Main column toolbar.
      rootSel + ' .sqw-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }',
      rootSel + ' .sqw-toolbar .sqw-sortwrap { display: flex; align-items: center; gap: 8px; }',
      rootSel + ' sparq-stats::part(root) { font-size: .95rem; color: #374151; }',
      rootSel + ' sparq-sort::part(select) { padding: 8px 30px 8px 12px; border: 1px solid ' + t.border + '; border-radius: 4px; min-width: 190px; }',

      // Result grid + cards (light DOM — ordinary page CSS).
      // The result cards are slotted into the component's shadow ::part(list),
      // so the grid must live there — NOT on the <sparq-items> host element.
      rootSel + ' sparq-items::part(list) { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: start; }',
      '@media (max-width: 1100px) { ' + rootSel + ' sparq-items::part(list) { grid-template-columns: repeat(2, 1fr); } }',
      '@media (max-width: 560px) { ' + rootSel + ' sparq-items::part(list) { grid-template-columns: 1fr; } }',
      rootSel + ' .sqw-card { position: relative; display: flex; flex-direction: column; height: 100%; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; background: #fff; }',
      rootSel + ' .sqw-card-title { background: linear-gradient(180deg, ' + t.accent + ', #b41822); color: #fff; font-size: .82rem; font-weight: 600; line-height: 1.25; padding: 8px 12px; min-height: 2.6em; }',
      rootSel + ' .sqw-card-title a { color: inherit; text-decoration: none; }',
      rootSel + ' .sqw-fav { position: absolute; top: 40px; right: 10px; z-index: 2; width: 30px; height: 30px; border-radius: 50%; border: none; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); color: ' + t.accent + '; font-size: 16px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }',
      rootSel + ' .sqw-fav[data-faved="1"] { background: ' + t.accent + '; color: #fff; }',
      rootSel + ' .sqw-card-img { display: block; aspect-ratio: 4 / 3; background-color: #f3f4f6; background-position: center; background-repeat: no-repeat; background-size: contain; }',
      rootSel + ' .sqw-card-foot { margin-top: auto; background: ' + t.cardFoot + '; color: #fff; padding: 10px 12px; font-size: .9rem; }',
      rootSel + ' .sqw-price { display: flex; justify-content: space-between; align-items: center; gap: 8px; }',
      rootSel + ' .sqw-price-main { font-weight: 700; }',
      rootSel + ' .sqw-price-sale { background: ' + t.accent + '; color: #fff; font-weight: 700; padding: 2px 8px; border-radius: 3px; font-size: .82rem; }',
      rootSel + ' .sqw-price-sale:empty { display: none; }',
      rootSel + ' .sqw-credova { margin-top: 8px; font-size: .78rem; color: #d1d5db; display: flex; align-items: center; gap: 6px; }',
      rootSel + ' .sqw-credova[data-on=""] { display: none; }',
      rootSel + ' .sqw-credova a { color: #fff; text-decoration: underline; }',

      // Pagination centered under the grid.
      rootSel + ' sparq-pagination { display: flex; justify-content: center; margin-top: 24px; }',
      rootSel + ' sparq-pagination::part(link) { min-width: 40px; height: 40px; }',
      rootSel + ' sparq-pagination::part(link-active) { background: var(--sparq-color-primary); border-color: var(--sparq-color-primary); color: #fff; }'
    ].join('\n');
  }

  // ── Markup ────────────────────────────────────────────────────────────────
  function facetMarkup(f) {
    var titleTag, open;
    if (f.type === 'toggle') {
      return '<div class="sqw-instock"><sparq-toggle attribute="' + esc(f.attribute) +
        '" value="' + esc(f.value) + '" label="' + esc(f.label || '') + '"></sparq-toggle></div>';
    }

    var inner = '';
    if (f.type === 'range') {
      inner = '<sparq-range attribute="' + esc(f.attribute) + '"' +
        (f.prefix ? ' prefix="' + esc(f.prefix) + '"' : '') +
        (f.min != null ? ' min="' + Number(f.min) + '"' : '') +
        (f.max != null ? ' max="' + Number(f.max) + '"' : '') +
        (f.step != null ? ' step="' + Number(f.step) + '"' : '') +
        '></sparq-range>';
    } else {
      // filters
      inner = '<sparq-filters attribute="' + esc(f.attribute) + '"' +
        (f.mode ? ' mode="' + esc(f.mode) + '"' : '') +
        (f.searchable ? ' searchable' : '') +
        (f.showMore ? ' show-more' : '') +
        (f.limit != null ? ' limit="' + Number(f.limit) + '"' : '') +
        '></sparq-filters>';
    }

    var wrapClass = 'sqw-facet' + (f.links ? ' sqw-facet--links' : '');
    // Tag filter groups with their attribute so empty ones can auto-hide (a facet
    // that's configured server-side but has no values yet renders an empty block).
    var hideAttr = f.type === 'filters' ? ' data-facet-attr="' + esc(f.attribute) + '"' : '';
    if (f.collapsible) {
      open = f.open === false ? '' : ''; // collapsed by default, matching the design
      return '<details class="' + wrapClass + ' sqw-facet--collapsible"' + hideAttr + open + '>' +
        '<summary class="sqw-facet-title">' + esc(f.title) + '</summary>' + inner + '</details>';
    }
    titleTag = '<div class="sqw-facet-title">' + esc(f.title) + '</div>';
    return '<div class="' + wrapClass + '"' + hideAttr + '>' + titleTag + inner + '</div>';
  }

  function breadcrumbMarkup(items) {
    return items.map(function (b, i) {
      var sep = i > 0 ? ' <span class="sqw-sep">/</span> ' : '';
      var body = b.url ? '<a href="' + esc(b.url) + '">' + esc(b.label) + '</a>' : esc(b.label);
      return sep + body;
    }).join('');
  }

  function providerAttrs(cfg) {
    var attrs = [];
    if (cfg.apiHost) attrs.push('api-host="' + esc(cfg.apiHost) + '"');
    if (cfg.appId) attrs.push('app-id="' + esc(cfg.appId) + '"');
    if (cfg.apiKey) attrs.push('api-key="' + esc(cfg.apiKey) + '"');
    attrs.push('collection="' + esc(cfg.collection) + '"');
    attrs.push('items-per-page="' + Number(cfg.itemsPerPage) + '"');
    if (cfg.routing) attrs.push('routing');
    return attrs.join(' ');
  }

  function widgetMarkup(cfg) {
    var F = cfg.fields;
    var sidebar = cfg.facets.map(facetMarkup).join('\n');
    // Result card template (light DOM, {{field}} interpolation, XSS-safe).
    var cardTemplate =
      '<template>' +
      '<article class="sqw-card">' +
      '<button class="sqw-fav" type="button" data-id="{{' + F.url + '}}" data-faved="{{_faved}}" aria-label="Save to favorites">&#9829;</button>' +
      '<div class="sqw-card-title"><a href="{{' + F.url + '}}">{{' + F.name + '}}</a></div>' +
      // Image as a CSS background: works for real https images AND demo data:
      // URIs (the <img> src sanitizer blocks data:), and never shows a broken
      // image icon. role/aria-label keep it accessible.
      '<a class="sqw-card-img" href="{{' + F.url + '}}" style="background-image:url(&quot;{{_img}}&quot;)" role="img" aria-label="{{' + F.name + '}}"></a>' +
      '<div class="sqw-card-foot">' +
      '<div class="sqw-price"><span class="sqw-price-main">{{_priceMain}}</span><span class="sqw-price-sale">{{_saleBadge}}</span></div>' +
      '<div class="sqw-credova" data-on="{{_financeOn}}">Pay over time with <strong>Credova</strong> <a href="{{_financeUrl}}">Learn More</a></div>' +
      '</div>' +
      '</article>' +
      '</template>';

    return '' +
      '<nav class="sqw-breadcrumb">' + breadcrumbMarkup(cfg.breadcrumb) + '</nav>' +
      '<h1 class="sqw-title">' + esc(cfg.title) + '</h1>' +
      (cfg.description ? '<p class="sqw-desc">' + esc(cfg.description) + '</p>' : '') +
      '<sparq-search ' + providerAttrs(cfg) + '>' +
      '<div class="sqw-layout">' +
      '<aside class="sqw-sidebar">' + sidebar + '</aside>' +
      '<main class="sqw-main">' +
      '<div class="sqw-toolbar">' +
      '<sparq-stats template="Showing {totalItems} results"></sparq-stats>' +
      '<div class="sqw-sortwrap"><span class="sqw-sortlabel">Sort by:</span>' +
      '<sparq-sort options="' + esc(cfg.sortOptions) + '"></sparq-sort></div>' +
      '</div>' +
      '<sparq-items empty-text="No products match your filters." class="sqw-grid">' +
      cardTemplate +
      '</sparq-items>' +
      '<sparq-pagination padding="2"></sparq-pagination>' +
      '</main>' +
      '</div>' +
      '</sparq-search>';
  }

  // ── Display hooks ─────────────────────────────────────────────────────────
  function makeHooks(cfg) {
    var F = cfg.fields;
    var money = function (n) {
      try {
        return new Intl.NumberFormat(cfg.locale, { style: 'currency', currency: cfg.currency }).format(n);
      } catch (e) {
        return '$' + Number(n).toFixed(2);
      }
    };
    var faves = loadFaves();
    var rw = cfg.imageRewrite;
    var fixImg = function (u) {
      u = u == null ? '' : String(u);
      return rw && rw.from ? u.split(rw.from).join(rw.to || '') : u;
    };

    return {
      transformItems: function (items) {
        return items.map(function (it) {
          var price = Number(it[F.price]);
          var saleRaw = it[F.salePrice];
          var sale = saleRaw != null && saleRaw !== '' ? Number(saleRaw) : null;
          var hasSale = sale != null && isFinite(sale) && sale < price;
          var finalPrice = hasSale ? sale : price;
          var showFinance = isFinite(finalPrice) && finalPrice >= cfg.financingThreshold;
          var out = {};
          for (var k in it) out[k] = it[k];
          out._img = fixImg(it[F.image]);
          out._priceMain = !isFinite(price) ? '' : (hasSale ? 'PRICE: ' + money(price) : money(price));
          out._saleBadge = hasSale ? 'Sale price: ' + money(sale) : '';
          out._financeOn = showFinance ? '1' : '';
          out._financeUrl = it[F.financingUrl] || '#';
          out._faved = faves[String(it[F.url])] ? '1' : '';
          return out;
        });
      }
    };
  }

  // ── Favorites (client-side, localStorage; delegated so it survives re-render) ─
  var FAV_KEY = 'sparq-widget:faves';
  function loadFaves() {
    try {
      return JSON.parse(localStorage.getItem(FAV_KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  }
  function saveFaves(f) {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(f));
    } catch (e) {
      /* storage disabled — favorites are session-only */
    }
  }
  // Hide facet groups that have no values (configured server-side but no data
  // yet), so empty section headers never show. Runs on every search result.
  function updateFacetVisibility(root, state) {
    var results = state && state.results;
    var groups = root.querySelectorAll('[data-facet-attr]');
    for (var i = 0; i < groups.length; i++) {
      var w = groups[i];
      if (!results) { w.style.display = ''; continue; } // pre-results: leave visible
      var vals = results.facets && results.facets[w.getAttribute('data-facet-attr')];
      w.style.display = (vals && vals.length) ? '' : 'none';
    }
  }
  function wireFacetVisibility(root) {
    var provider = root.querySelector('sparq-search');
    var tries = 0;
    (function attach() {
      if (provider && provider.controller && typeof provider.controller.subscribe === 'function') {
        provider.controller.subscribe(function (state) { updateFacetVisibility(root, state); });
        return;
      }
      if (tries++ < 60) setTimeout(attach, 50);
    })();
  }

  function wireFavorites(root) {
    root.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('.sqw-fav') : null;
      if (!btn || !root.contains(btn)) return;
      e.preventDefault();
      var id = btn.getAttribute('data-id');
      if (!id) return;
      var faves = loadFaves();
      if (faves[id]) delete faves[id];
      else faves[id] = 1;
      saveFaves(faves);
      btn.setAttribute('data-faved', faves[id] ? '1' : '');
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function loadLibrary(url) {
    return new Promise(function (resolve, reject) {
      if (window.SparqSearchUI && window.customElements && customElements.get('sparq-search')) {
        return resolve();
      }
      var existing = document.querySelector('script[data-sparq-lib]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('Failed to load Sparq library')); });
        return;
      }
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.setAttribute('data-sparq-lib', '');
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load Sparq library from ' + url)); };
      document.head.appendChild(s);
    });
  }

  function mount() {
    var override = window.SparqWidgetConfig || window.SparqWidget || {};
    var mountSel = override.mount || DEFAULTS.mount;
    var el = document.querySelector(mountSel);
    // Precedence: window override > mount-div data-* > <script> data-* > defaults.
    var cfg = deepMerge(deepMerge(deepMerge(DEFAULTS, readDataConfig(SCRIPT_EL)), readDataConfig(el)), override);

    // Auto-create the mount if the page doesn't already have one, so simply
    // including this script (with config) is enough — no markup required.
    if (!el) {
      el = document.createElement('div');
      el.id = mountSel.charAt(0) === '#' ? mountSel.slice(1) : 'sparq-widget';
      mountSel = '#' + el.id;
      var host = (cfg.target && document.querySelector(cfg.target)) || document.body;
      host.appendChild(el);
    }

    // Demo mode (or a total lack of backend config) → render sample data so the
    // UI is visible immediately. Flip demo off + set appId/apiKey for production.
    var hasBackend = cfg.appId || cfg.apiHost;
    if (cfg.demo || !hasBackend) {
      if (!cfg.demo && !hasBackend) {
        console.warn('[sparq-widget] no appId/apiKey configured — falling back to DEMO data. Set credentials for live search.');
      }
      if (!window.__SPARQ_MOCK__) window.__SPARQ_MOCK__ = { data: demoDataset() };
      cfg.apiHost = 'mock:';
      cfg.collection = cfg.collection || 'demo';
      cfg.routing = false; // don't rewrite the host page's URL in demo mode
    }

    // 1) Inject theme once.
    if (!document.getElementById('sparq-widget-style')) {
      var style = document.createElement('style');
      style.id = 'sparq-widget-style';
      style.textContent = themeCss(cfg, mountSel);
      document.head.appendChild(style);
    }

    // 2) Register display hooks BEFORE the provider upgrades (it reads global
    //    hooks at construction). configure() merges into the global layer.
    loadLibrary(cfg.libUrl).then(function () {
      if (window.SparqSearchUI && typeof window.SparqSearchUI.configure === 'function') {
        window.SparqSearchUI.configure({ hooks: makeHooks(cfg) });
      }
      // 3) Inject markup — sparq-search upgrades synchronously and starts.
      el.innerHTML = widgetMarkup(cfg);
      // 4) Delegated favorites (items render in the light DOM under sparq-items).
      wireFavorites(el);
      // 5) Auto-hide facet groups that have no values (e.g. Caliber before its
      //    data is populated), so empty section headers never appear.
      wireFacetVisibility(el);
    }).catch(function (err) {
      console.error('[sparq-widget]', err);
      el.innerHTML = '<p style="color:#b91c1c">Search failed to load. Check the Sparq library URL / network.</p>';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
