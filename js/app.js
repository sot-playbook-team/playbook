/* =====================================================================
   SOT Playbook: app.js
   This script reads the content in /data/*.json and draws the pages.
   You normally never need to edit this file: change the text in /data
   instead (see data/README.md).

   How it works, in short:
   1. Load data/site.json (site name, sections list).
   2. Load each section's data file.
   3. Draw a page based on the address: #/ = Home, #/goals = Goals, etc.
      #/goals/some-card opens that card directly (used by search).
   ===================================================================== */
(function () {
  'use strict';

  // ---------- Small helpers ----------
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  // Make text safe to put inside HTML
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // "Vampire Costume" -> "vampire-costume" (used in links)
  function slug(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  }
  // Accept a single string or a list, always return a list
  function list(v) { return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []); }
  // Only allow real web links (blocks javascript: and similar)
  function safeUrl(u) { return /^https:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''; }

  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // "2026-11-05" -> Date (local time), or null
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function fmtDate(d) { return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; }
  function isNew(item) {
    var d = parseDate(item.date);
    if (!d) return false;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = (today - d) / 86400000;
    return days >= 0 && days < (state.site.newDays || 14);
  }

  // ---------- App state ----------
  var state = {
    site: null,      // data/site.json
    data: {},        // section id -> list of items
    errors: [],      // problems reading data files
    index: [],       // search index
    filter: 'all'    // selected strategy tag
  };
  var main = $('#main');

  // ---------- Loading data ----------
  function loadJSON(file) {
    return fetch('data/' + file, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Could not find data/' + file + ' (error ' + res.status + ').');
      return res.text();
    }).then(function (text) {
      try { return JSON.parse(text); }
      catch (e) { throw new Error('data/' + file + ' has a typo. ' + jsonHint(e, text)); }
    });
  }
  // Turn a JSON error into "check around line 12"
  function jsonHint(e, text) {
    var msg = String(e.message || '');
    var line = /line (\d+)/.exec(msg);
    var pos = /position (\d+)/.exec(msg);
    var n = line ? +line[1] : (pos ? text.slice(0, +pos[1]).split('\n').length : 0);
    return (n ? 'Check around line ' + n + '. ' : '') + 'Usually a missing comma, an extra comma before ] or }, or a missing " quote.';
  }

  // Give every item a stable id (made from its title) so search can link to it
  function prepare(sec, raw) {
    var items = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.items) ? raw.items : []);
    var seen = {};
    return items.filter(function (it) { return it && typeof it === 'object'; }).map(function (it) {
      var base = slug(it.id || it.title || it.term);
      var id = base, n = 2;
      while (seen[id]) id = base + '-' + (n++);
      seen[id] = true;
      var copy = Object.assign({}, it);
      copy._id = id;
      return copy;
    });
  }

  function init() {
    initTheme(); initMenu(); initSearch(); initGlobalClicks();
    $('#skipLink').addEventListener('click', function () { main.focus(); });

    if (location.protocol === 'file:') {
      main.innerHTML = '<div class="wrap"><p class="alert">To preview the site, double-click <b>preview.bat</b> in the project folder (or run <code>node tools/preview.js</code>) and open <b>http://localhost:8080</b>. Browsers block data files when the page is opened straight from a folder.</p></div>';
      return;
    }

    loadJSON('site.json').then(function (site) {
      site.sections = list(site.sections);
      state.site = site;
      applySite();
      return Promise.all(site.sections.map(function (sec) {
        return loadJSON(sec.file).then(function (d) { state.data[sec.id] = prepare(sec, d); })
          .catch(function (e) { state.data[sec.id] = []; state.errors.push({ sec: sec, msg: e.message }); });
      }));
    }).then(function () {
      buildIndex();
      window.addEventListener('hashchange', route);
      route();
    }).catch(function (e) {
      main.innerHTML = '<div class="wrap"><p class="alert">' + esc(e.message) + '</p></div>';
    });
  }

  // Put the site name, nav links and footer text on the page
  function applySite() {
    var s = state.site;
    $('#logoText').textContent = s.name || 'Playbook';
    $('#footerText').textContent = s.footer || '';
    $('#creditsText').textContent = s.credits || '';
    $('#navList').innerHTML = s.sections.map(function (sec) {
      return '<li><a href="#/' + esc(sec.id) + '" data-sec="' + esc(sec.id) + '">' + esc(sec.nav || sec.label) + '</a></li>';
    }).join('');
  }

  // ---------- Router: decide which page to draw ----------
  function route() {
    var hash = location.hash || '#/';
    if (hash.indexOf('#/') !== 0) return;              // ignore other # links
    var parts = hash.slice(2).split('/');
    var sec = state.site.sections.filter(function (s) { return s.id === parts[0]; })[0];
    var itemId = decodeURIComponent(parts[1] || '');

    closeMenu();
    if (sec) renderSection(sec, itemId); else renderHome();

    $$('#navList a').forEach(function (a) {
      if (sec && a.dataset.sec === sec.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = sec ? (sec.label + ' · ' + state.site.name) : state.site.name;
    if (!itemId) window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  function errorsHtml(sec) {
    return state.errors.filter(function (e) { return !sec || e.sec === sec; }).map(function (e) {
      return '<p class="alert" role="alert">⚠️ ' + esc(e.msg) + '</p>';
    }).join('');
  }

  // ---------- Home page ----------
  function renderHome() {
    var s = state.site;
    var stratSec = s.sections.filter(function (x) { return x.type === 'strategies'; })[0];
    var latest = stratSec ? sortByDate(state.data[stratSec.id]).slice(0, s.homeCount || 3) : [];

    var html = '' +
      '<section class="hero">' +
        '<p class="eyebrow">' + esc(s.heroEyebrow || 'I · Strategy & Training') + '</p>' +
        '<h1 class="hero-title">Welcome to <span>' + esc(s.name) + '</span></h1>' +
        '<p class="hero-tag">' + esc(s.tagline || '') + '</p>' +
        '<nav class="quick" aria-label="Quick links">' + s.sections.map(function (sec) {
          return '<a href="#/' + esc(sec.id) + '">' + esc(sec.nav || sec.label) + '</a>';
        }).join('') + '</nav>' +
      '</section>' + errorsHtml();

    if (stratSec) {
      html += '<section class="block" aria-labelledby="newHead">' +
        '<div class="announce"><h2 id="newHead">' + esc(s.newBanner || '📢 New Strategies! 📢') + '</h2>' +
        '<a class="pill-link" href="#/' + esc(stratSec.id) + '">See all →</a></div>' +
        (latest.length ? '<div class="grid">' + latest.map(function (it) { return cardHtml(stratSec, it); }).join('') + '</div>'
          : '<p class="empty">No strategies yet.</p>') +
        '</section>';
    }

    html += '<section class="block" aria-labelledby="secHead">' +
      '<p class="eyebrow">II · The playbook</p><h2 class="block-title" id="secHead">Browse by section</h2>' +
      '<div class="tiles">' + s.sections.map(function (sec, i) {
        var n = (state.data[sec.id] || []).length;
        return '<a class="tile" href="#/' + esc(sec.id) + '">' +
          '<span class="tile-num">' + (ROMAN[i] || i + 1) + '</span>' +
          '<h3>' + esc(sec.label) + '</h3>' +
          '<p>' + esc(sec.intro || '') + '</p>' +
          '<span class="tile-count">' + n + (sec.type === 'glossary' ? ' terms' : (n === 1 ? ' card' : ' cards')) + '</span></a>';
      }).join('') + '</div></section>';

    main.innerHTML = html;
  }

  function sortByDate(items) {
    return (items || []).slice().sort(function (a, b) {
      return (parseDate(b.date) || 0) - (parseDate(a.date) || 0);
    });
  }

  // ---------- Section page ----------
  function renderSection(sec, itemId) {
    var i = state.site.sections.indexOf(sec);
    var items = state.data[sec.id] || [];
    var body;

    if (sec.type === 'glossary') body = glossaryHtml(sec, items);
    else {
      if (sec.type === 'strategies') items = sortByDate(items);
      body = (sec.type === 'strategies' ? filtersHtml(items) : '') +
        (items.length ? '<div class="grid" id="grid">' + items.map(function (it) { return cardHtml(sec, it); }).join('') + '</div>'
          : '<p class="empty">Nothing here yet. Add an entry in data/' + esc(sec.file) + '.</p>') +
        '<p class="empty" id="noMatch" hidden>No strategies with this tag yet.</p>';
    }

    main.innerHTML =
      '<header class="banner">' +
        '<p class="eyebrow">' + (ROMAN[i] || i + 1) + ' · ' + esc(sec.label) + '</p>' +
        '<h1 class="banner-title">' + esc(sec.banner || sec.label) + '</h1>' +
        (sec.intro ? '<p class="banner-intro">' + esc(sec.intro) + '</p>' : '') +
      '</header>' +
      '<div class="wrap">' + errorsHtml(sec) + body + '</div>';

    if (sec.type === 'strategies') applyFilter();
    if (sec.type === 'glossary') initGlossary();
    if (itemId) focusItem(sec, itemId);
  }

  // Open + scroll to a card (or glossary term) by id
  function focusItem(sec, itemId) {
    var el = document.getElementById('c-' + sec.id + '--' + itemId);
    if (!el) return;
    if (el.classList.contains('card')) {
      if (sec.type === 'strategies' && el.hidden) { state.filter = 'all'; applyFilter(); }
      toggleCard(el, true);
    }
    requestAnimationFrame(function () {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    });
  }

  // ---------- Strategy tag filters ----------
  function filtersHtml(items) {
    var tags = {};
    items.forEach(function (it) { list(it.tags).forEach(function (t) { tags[String(t).toLowerCase()] = true; }); });
    var names = Object.keys(tags).sort();
    if (!names.length) return '';
    return '<div class="filters" role="group" aria-label="Filter by tag">' +
      ['all'].concat(names).map(function (t) {
        return '<button type="button" class="chip-btn" data-filter="' + esc(t) + '" aria-pressed="false">' + (t === 'all' ? 'All' : esc(t)) + '</button>';
      }).join('') + '</div>';
  }
  function applyFilter() {
    var shown = 0;
    $$('.chip-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)); });
    $$('#grid .card').forEach(function (c) {
      var tags = (c.dataset.tags || '').split('|');
      var ok = state.filter === 'all' || tags.indexOf(state.filter) !== -1;
      c.hidden = !ok; if (ok) shown++;
    });
    var nm = $('#noMatch'); if (nm) nm.hidden = shown > 0;
  }

  // ---------- Cards ----------
  // Every section (except the glossary) uses the same card. All fields are optional except "title".
  function cardHtml(sec, it) {
    var key = sec.id + '--' + it._id;
    var tags = list(it.tags).map(function (t) { return String(t).toLowerCase(); });
    var meta = '';
    if (sec.type === 'strategies' && isNew(it)) meta += '<span class="badge badge-new">New</span> ';
    if (it.draft) meta += '<span class="badge badge-draft">Draft</span> ';
    if (it.date && parseDate(it.date)) meta += '<span class="card-date">' + fmtDate(parseDate(it.date)) + '</span>';

    return '<article class="card" id="c-' + esc(key) + '" data-tags="' + esc(tags.join('|')) + '">' +
      '<h3 class="card-h"><button type="button" class="card-btn" aria-expanded="false" aria-controls="p-' + esc(key) + '">' +
        '<span class="card-meta">' + meta + '</span> ' +
        '<span class="card-title">' + esc(it.title || 'Untitled') + '</span> ' +
        '<span class="chev" aria-hidden="true"></span>' +
        (it.summary ? '<span class="card-sum">' + esc(it.summary) + '</span>' : '') +
      '</button></h3>' +
      '<div class="card-body" id="p-' + esc(key) + '" hidden>' + cardBody(sec, it, tags) + '</div>' +
    '</article>';
  }

  function cardBody(sec, it, tags) {
    var h = '';
    list(it.details).forEach(function (p) { h += '<p>' + esc(p) + '</p>'; });

    var steps = list(it.steps || it.howTo);
    if (steps.length) {
      h += '<h4>' + esc(it.stepsTitle || (sec.type === 'strategies' ? 'How to run it' : 'How to')) + '</h4>' +
        '<ol class="steps">' + steps.map(stepHtml).join('') + '</ol>';
    }

    var ladder = list(it.goalLadder);
    if (ladder.length) {
      h += '<h4 class="with-copy"><span>' + esc(it.ladderTitle || 'Recommended goal ladder') + '</span>' + copyBtn(ladder.join('\n'), 'Copy all') + '</h4>' +
        '<ol class="ladder">' + ladder.map(function (g, i) {
          return '<li><span class="step">' + (i + 1) + '</span><span>' + esc(g) + '</span></li>';
        }).join('') + '</ol>';
    }

    var prompts = list(it.prompts);
    if (prompts.length) {
      h += '<h4>' + esc(it.promptsTitle || 'Prompt lines') + '</h4><ul class="prompts">' + prompts.map(function (p) {
        return '<li><q>' + esc(p) + '</q>' + copyBtn(p, 'Copy') + '</li>';
      }).join('') + '</ul>';
    }

    var tips = list(it.tips);
    if (tips.length) {
      h += '<h4>' + esc(it.tipsTitle || 'Tips') + '</h4><ul>' + tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    }

    // One image = a big picture; several images = a photo gallery
    var imgs = list(it.image);
    if (imgs.length > 1) h += galleryHtml(imgs, it, false);
    else imgs.forEach(function (img) { h += imageHtml(img, it); });
    list(it.embed).forEach(function (e) { h += embedHtml(e, it); });

    // Screenshots stay hidden until someone taps "Show screenshots"
    var shots = list(it.screenshots);
    if (shots.length === 1 && typeof shots[0] === 'string' && isFolder(shots[0])) h += shotsFolderHtml(shots[0], it);
    else if (shots.length) h += galleryHtml(shots, it, true);

    if (tags.length) {
      h += '<div class="card-tags">' + tags.map(function (t) {
        return sec.type === 'strategies'
          ? '<button type="button" class="chip-btn" data-filter="' + esc(t) + '" data-jump="' + esc(sec.id) + '">' + esc(t) + '</button>'
          : '<span class="tag">' + esc(t) + '</span>';
      }).join('') + '</div>';
    }
    return h;
  }

  // A step can be plain text, or { "step": "Main step", "sub": ["detail", "detail"] }
  function stepHtml(s) {
    if (s && typeof s === 'object') {
      var sub = list(s.sub);
      return '<li>' + esc(s.step || '') + (sub.length ? '<ul>' + sub.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</li>';
    }
    return '<li>' + esc(s) + '</li>';
  }
  function stepText(s) { return s && typeof s === 'object' ? [s.step].concat(list(s.sub)).join(' ') : s; }

  // Google Drive file id from a share link (or a bare id)
  function driveId(src) {
    src = String(src || '').trim();
    var m = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]+)/.exec(src);
    if (m) return m[1];
    return /^[\w-]{25,}$/.test(src) ? src : '';
  }

  // Grid of small photos. Each opens the full photo in Drive.
  // hiddenUntilClicked = true for screenshots (a button reveals them).
  function galleryHtml(items, it, hiddenUntilClicked) {
    var tiles = items.map(function (img, i) {
      var src = typeof img === 'string' ? img : (img && img.src);
      var id = driveId(src);
      if (!id) return '';
      var alt = (img && img.alt) || ((it.title || 'Photo') + ' ' + (i + 1));
      // No src yet: the photo loader fills it in a few at a time when the card opens
      return '<a class="g-item" href="https://drive.google.com/file/d/' + esc(id) + '/view" target="_blank" rel="noopener noreferrer">' +
        '<img data-id="' + esc(id) + '" alt="' + esc(alt) + '"></a>';
    }).join('');
    if (!tiles) return '';
    var note = '<p class="media-note">' + esc(state.site.accessNote || '') + ' Tap a photo to open it full size.</p>';
    if (!hiddenUntilClicked) {
      return '<h4>Photos (' + items.length + ')</h4>' + note + '<div class="gallery">' + tiles + '</div>';
    }
    return '<div class="shots"><button type="button" class="btn shots-btn" aria-expanded="false" data-shots data-count="' + items.length + '">Show screenshots (' + items.length + ')</button>' +
      '<div class="shots-body" hidden>' + note + '<div class="gallery">' + tiles + '</div></div></div>';
  }

  // "Show screenshots" button that reveals a whole Drive folder as a grid
  function shotsFolderHtml(url, it) {
    url = safeUrl(url);
    if (!url) return '';
    return '<div class="shots"><button type="button" class="btn shots-btn" aria-expanded="false" data-shots data-count="">Show screenshots</button>' +
      '<div class="shots-body" hidden><div class="media"><div class="embed embed-folder" data-src="' + esc(toEmbed(url)) + '" data-title="' + esc((it.title || 'Guide') + ' screenshots') + '"></div>' +
      '<div class="media-note"><span>' + esc(state.site.accessNote || '') + '</span>' +
      '<a class="pill-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open in Google Drive ↗</a></div></div></div></div>';
  }

  function copyBtn(text, label) {
    return '<button type="button" class="copy-btn" data-copy="' + esc(text) + '" data-label="' + esc(label) + '">' + esc(label) + '</button>';
  }

  // ---------- Google Drive / Slides embeds ----------
  // People can paste the normal "share" link; we turn it into the embed version.
  function toEmbed(url) {
    var m;
    if ((m = /docs\.google\.com\/presentation\/d\/e\/([\w-]+)/.exec(url))) return 'https://docs.google.com/presentation/d/e/' + m[1] + '/embed?start=false&loop=false&delayms=3000';
    if ((m = /docs\.google\.com\/presentation\/d\/([\w-]+)/.exec(url))) return 'https://docs.google.com/presentation/d/' + m[1] + '/embed?start=false&loop=false&delayms=3000';
    if ((m = /docs\.google\.com\/(document|spreadsheets)\/d\/([\w-]+)/.exec(url))) return 'https://docs.google.com/' + m[1] + '/d/' + m[2] + '/preview';
    if ((m = /drive\.google\.com\/file\/d\/([\w-]+)/.exec(url))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
    // A whole Drive folder shows as a photo grid (add photos by dropping them into the folder)
    if ((m = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/.exec(url))) return 'https://drive.google.com/embeddedfolderview?id=' + m[1] + '#grid';
    if ((m = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(url))) return 'https://www.youtube-nocookie.com/embed/' + m[1];
    return url;
  }
  function isFolder(url) { return /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//.test(url); }
  function kindOf(url) {
    if (isFolder(url)) return 'Google Drive';
    if (/presentation/.test(url)) return 'Google Slides';
    if (/document/.test(url)) return 'Google Docs';
    if (/spreadsheets/.test(url)) return 'Google Sheets';
    if (/youtu/.test(url)) return 'YouTube';
    return 'Google Drive';
  }
  function isPlaceholderLink(url) { return !url || /REPLACE|PASTE|XXXX/i.test(url); }

  function placeholderHtml(icon, title, text, url, kind) {
    return '<div class="placeholder"><span class="ph-icon" aria-hidden="true">' + icon + '</span>' +
      '<strong>' + esc(title) + '</strong><span>' + esc(text) + '</span>' +
      (url ? '<a class="pill-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open in ' + esc(kind) + ' ↗</a>' : '') + '</div>';
  }

  // The iframe is only created when the card is opened (keeps phones fast)
  function embedHtml(e, it) {
    var raw = typeof e === 'string' ? e : (e && e.url);
    var title = (e && e.title) || ((it.title || 'Content') + ' deck');
    var url = safeUrl(raw);
    if (isPlaceholderLink(raw) || !url) {
      return '<div class="media">' + placeholderHtml('🎞️', 'Deck or video coming soon', 'Paste a Google Slides, Drive or YouTube link into "embed" in the data file.', '', '') + '</div>';
    }
    var kind = kindOf(url);
    if (isFolder(url) && !(e && e.title)) title = (it.title || 'Photos') + ' photo folder';
    return '<div class="media"><div class="embed' + (isFolder(url) ? ' embed-folder' : '') + '" data-src="' + esc(toEmbed(url)) + '" data-title="' + esc(title) + '">' +
      placeholderHtml('🔒', 'Loading ' + kind + '…', state.site.accessNote || 'Sign in with your work Google account to view.', '', '') + '</div>' +
      '<div class="media-note"><span>' + esc(state.site.accessNote || "Can't see it? Open it in a new tab and sign in with your work Google account.") + '</span>' +
      '<a class="pill-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open in ' + esc(kind) + ' ↗</a></div></div>';
  }
  function loadEmbeds(card) {
    $$('.embed[data-src]', card).forEach(function (box) {
      if (box.closest('[hidden]')) return;   // hidden screenshots load when their button is pressed
      var f = document.createElement('iframe');
      f.src = box.dataset.src;
      f.title = box.dataset.title;
      f.loading = 'lazy';
      f.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
      f.setAttribute('allowfullscreen', '');
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      box.appendChild(f);                 // iframe covers the "Loading" placeholder once it draws
      box.removeAttribute('data-src');
    });
  }

  // Images: a Google Drive share link, or a file path. If it can't load, a friendly card shows instead.
  function imageHtml(img, it) {
    var src = typeof img === 'string' ? img : (img && img.src);
    var alt = (img && img.alt) || it.imageAlt || it.title || '';
    var caption = img && img.caption;
    if (isPlaceholderLink(src)) {
      return '<div class="media">' + placeholderHtml('🖼️', 'Image coming soon', 'Paste a Google Drive image link into "image" in the data file.', '', '') + '</div>';
    }
    var id = driveId(src);
    var shown = id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600' : src;
    if (id && !/^https:/i.test(src)) src = 'https://drive.google.com/file/d/' + id + '/view';
    var openUrl = safeUrl(src);
    if (/^\s*(javascript|data):/i.test(shown)) return '';
    return '<figure class="media figure"><img src="' + esc(shown) + '" alt="' + esc(alt) + '" loading="lazy" data-open="' + esc(openUrl) + '">' +
      (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') + '</figure>';
  }
  // Images that fail (no access, wrong link) get swapped for a placeholder card
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    if (!img.closest('.figure')) return;   // gallery photos are handled by the photo loader below
    var wrap = document.createElement('div');
    wrap.innerHTML = placeholderHtml('🔒', "Image can't load here", state.site.accessNote || 'Sign in with your work Google account to view.', img.dataset.open, 'Google Drive');
    img.replaceWith(wrap.firstChild);
  }, true);

  // ---------- Photo loader ----------
  // Google Drive refuses thumbnails when too many are asked for at once, so photos load
  // 2 at a time. A failed photo is retried a few times with a pause, switching between
  // Google's two image addresses. After that it shows a small lock (no access, or Drive busy).
  var photoQueue = [], photosActive = 0, PHOTO_LIMIT = 2, PHOTO_TRIES = 5;
  function queuePhotos(container) {
    $$('img[data-id]:not([data-queued])', container).forEach(function (img) {
      img.dataset.queued = '1'; img.dataset.tries = '0'; photoQueue.push(img);
    });
    pumpPhotos();
  }
  function pumpPhotos() {
    while (photosActive < PHOTO_LIMIT && photoQueue.length) loadPhoto(photoQueue.shift());
  }
  function loadPhoto(img) {
    if (!img.isConnected) { pumpPhotos(); return; }      // page changed: skip
    photosActive++;
    var id = img.dataset.id, tries = +img.dataset.tries;
    img.onload = function () { photosActive--; img.removeAttribute('data-id'); pumpPhotos(); };
    img.onerror = function () {
      photosActive--;
      if (tries < PHOTO_TRIES && img.isConnected) {
        img.dataset.tries = String(tries + 1);
        setTimeout(function () { photoQueue.push(img); pumpPhotos(); }, 1500 * (tries + 1) + Math.random() * 1000);
      } else if (img.isConnected) {
        var lock = document.createElement('span');
        lock.className = 'g-lock'; lock.textContent = '🔒'; lock.title = 'Needs access, or Drive is busy. Tap to open in Drive.';
        img.replaceWith(lock);
      }
      pumpPhotos();
    };
    img.src = tries % 2 === 0
      ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w500'
      : 'https://lh3.googleusercontent.com/d/' + id + '=w500';
  }

  // ---------- Accordion ----------
  function toggleCard(card, open) {
    var btn = $('.card-btn', card), body = $('.card-body', card);
    if (open === undefined) open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    body.hidden = !open;
    card.classList.toggle('open', open);
    if (open) {
      loadEmbeds(card);
      $$('.gallery', card).forEach(function (g) { if (!g.closest('[hidden]')) queuePhotos(g); });
    }
  }

  // ---------- Encyclopedia (A-Z glossary) ----------
  function glossaryHtml(sec, items) {
    var sorted = items.slice().sort(function (a, b) { return String(a.term).localeCompare(String(b.term), 'en', { sensitivity: 'base' }); });
    var groups = {};
    sorted.forEach(function (t) {
      var L = String(t.term || '#').trim().charAt(0).toUpperCase();
      if (!/[A-Z]/.test(L)) L = '#';
      (groups[L] = groups[L] || []).push(t);
    });
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return '<div class="gloss-tools">' +
        '<input class="field" type="search" id="glossSearch" placeholder="Search ' + items.length + ' terms…" aria-label="Search the encyclopedia">' +
        '<div class="letters" role="group" aria-label="Jump to letter">' + letters.map(function (L) {
          return '<button type="button" data-letter="' + L + '"' + (groups[L] ? '' : ' disabled') + '>' + L + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      Object.keys(groups).sort().map(function (L) {
        return '<section class="letter-group" id="letter-' + L + '" aria-label="' + L + '"><h2>' + L + '</h2><dl class="terms">' +
          groups[L].map(function (t) {
            var text = [t.term, t.full, t.definition].join(' ').toLowerCase();
            return '<div class="term" id="c-' + esc(sec.id + '--' + t._id) + '" data-text="' + esc(text) + '">' +
              '<dt>' + esc(t.term) + (t.full ? '<span class="full">' + esc(t.full) + '</span>' : '') +
              (t.draft ? '<span class="badge badge-draft">Draft</span>' : '') + '</dt>' +
              '<dd>' + esc(t.definition || '') + '</dd></div>';
          }).join('') + '</dl></section>';
      }).join('') +
      '<p class="empty" id="glossEmpty" hidden>No terms match. Try fewer letters.</p>';
  }
  function initGlossary() {
    var input = $('#glossSearch');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(), any = false;
      $$('.letter-group').forEach(function (g) {
        var vis = 0;
        $$('.term', g).forEach(function (t) { var ok = !q || t.dataset.text.indexOf(q) !== -1; t.hidden = !ok; if (ok) vis++; });
        g.hidden = !vis; if (vis) any = true;
      });
      $('#glossEmpty').hidden = any;
    });
  }

  // ---------- Global search ----------
  function buildIndex() {
    state.index = [];
    state.site.sections.forEach(function (sec) {
      (state.data[sec.id] || []).forEach(function (it) {
        var title = it.title || it.term || '';
        var parts = [title, it.full, it.summary, it.definition].concat(list(it.details), list(it.steps || it.howTo).map(stepText),
          list(it.goalLadder), list(it.prompts), list(it.tips), list(it.tags));
        state.index.push({
          sec: sec, id: it._id, title: title,
          snippet: it.summary || it.definition || it.full || '',
          titleLc: title.toLowerCase(),
          text: parts.filter(Boolean).join(' • ').toLowerCase()
        });
      });
    });
  }
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return state.index.filter(function (r) {
      return words.every(function (w) { return r.text.indexOf(w) !== -1; });
    }).map(function (r) {
      var score = 0;
      words.forEach(function (w) { if (r.titleLc === w) score += 10; else if (r.titleLc.indexOf(w) === 0) score += 6; else if (r.titleLc.indexOf(w) !== -1) score += 3; });
      return { r: r, score: score };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, 40).map(function (x) { return x.r; });
  }
  function highlight(text, q) {
    var out = esc(text);
    q.split(/\s+/).filter(function (w) { return w.length > 1; }).forEach(function (w) {
      var re = new RegExp('(' + esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  function initSearch() {
    var dlg = $('#searchDialog'), input = $('#searchInput'), box = $('#searchResults');
    function draw() {
      var q = input.value.trim();
      if (!state.site) { box.innerHTML = '<p>Still loading…</p>'; return; }
      if (!q) { box.innerHTML = '<p>Type to search every section: strategies, goals, fillers, glossary terms…</p>'; return; }
      var res = search(q);
      box.innerHTML = res.length ? res.map(function (r) {
        return '<a class="result" href="#/' + esc(r.sec.id) + '/' + esc(r.id) + '">' +
          '<span class="result-sec">' + esc(r.sec.label) + '</span>' +
          '<span class="result-title">' + highlight(r.title, q) + '</span>' +
          (r.snippet ? '<span class="result-snip">' + highlight(r.snippet, q) + '</span>' : '') + '</a>';
      }).join('') : '<p>No results for “' + esc(q) + '”.</p>';
    }
    function open() {
      if (dlg.open) return;
      dlg.showModal(); input.value = ''; draw(); input.focus();
    }
    $('#searchBtn').addEventListener('click', open);
    input.addEventListener('input', draw);
    // Enter = go to the first result; the Esc button (or the Esc key) closes the window
    $('#searchClose').addEventListener('click', function () { dlg.close(); });
    $('#searchForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var first = $('.result', box); if (first) first.click();
    });
    box.addEventListener('click', function (e) {
      var a = e.target.closest('.result'); if (!a) return;
      dlg.close();
      if (a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });  // click outside closes
    // Press "/" anywhere to search
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;
      e.preventDefault(); open();
    });
  }

  // ---------- Copy to clipboard ----------
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    fallbackCopy(text); return Promise.resolve();
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  // ---------- One click handler for the whole page ----------
  function initGlobalClicks() {
    document.addEventListener('click', function (e) {
      var copy = e.target.closest('[data-copy]');
      if (copy) {
        copyText(copy.dataset.copy).then(function () {
          copy.textContent = 'Copied'; copy.classList.add('done'); toast('Copied to clipboard');
          setTimeout(function () { copy.textContent = copy.dataset.label; copy.classList.remove('done'); }, 1400);
        });
        return;
      }
      var shotsBtn = e.target.closest('[data-shots]');
      if (shotsBtn) {
        var body = shotsBtn.nextElementSibling, show = body.hidden;
        body.hidden = !show;
        shotsBtn.setAttribute('aria-expanded', String(show));
        shotsBtn.textContent = (show ? 'Hide' : 'Show') + ' screenshots' + (shotsBtn.dataset.count ? ' (' + shotsBtn.dataset.count + ')' : '');
        if (show) { queuePhotos(body); loadEmbeds(body); }
        return;
      }
      var cardBtn = e.target.closest('.card-btn');
      if (cardBtn) { toggleCard(cardBtn.closest('.card')); return; }

      var chip = e.target.closest('[data-filter]');
      if (chip) {
        state.filter = chip.dataset.filter;
        // A tag inside a card on the Home page jumps to the Strategies page with that tag selected
        if (chip.dataset.jump && location.hash.indexOf('#/' + chip.dataset.jump) !== 0) { location.hash = '#/' + chip.dataset.jump; return; }
        applyFilter();
        if (chip.dataset.jump) window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      var letter = e.target.closest('[data-letter]');
      if (letter) {
        var g = document.getElementById('letter-' + letter.dataset.letter);
        if (g) g.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ---------- Light / dark theme ----------
  function initTheme() {
    var btn = $('#themeBtn');
    function label() {
      var dark = document.documentElement.dataset.theme !== 'light';
      btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    label();
    btn.addEventListener('click', function () {
      var next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode: fine */ }
      label();
    });
  }

  // ---------- Mobile menu ----------
  function initMenu() {
    var btn = $('#menuBtn'), nav = $('#nav');
    btn.addEventListener('click', function () {
      var open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); btn.focus(); } });
  }
  function closeMenu() {
    $('#nav').classList.remove('open');
    var btn = $('#menuBtn'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu');
  }

  init();
})();
