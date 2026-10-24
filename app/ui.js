/* CleanFrame — gallery home for Samsung Tizen.
   ES5, no framework, no network. One photo, the time, your apps. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var WALLS = window.CleanFrameWallpapers || [];
  var STORE = 'cleanframe.next.v1';
  var MAX_HOME = 9;
  var ICONS = 'assets/icons/';
  var WALLS_DIR = 'assets/wallpapers/';
  var KEY = { 37: 'left', 38: 'up', 39: 'right', 40: 'down', 13: 'ok', 27: 'back', 8: 'back', 10009: 'back', 461: 'back' };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var stage = $('stage'), photo = $('photo'), timeEl = $('time'), dateEl = $('date'),
      rail = $('rail'), focusName = $('focusName'), controls = $('controls'),
      overlay = $('overlay'), overlayTitle = $('overlayTitle'), overlayHint = $('overlayHint'),
      overlayBody = $('overlayBody'), statusEl = $('status');

  var S = {
    wall: WALLS.length ? WALLS[0].id : 'misty',
    clock24: false,
    home: [],
    apps: [],
    ready: false,
    view: 'home',
    sel: 0,
    oi: 0,
    edit: false,
    firstRow: 0,
    shownWall: null,
    clockTimer: 0,
    statusTimer: 0
  };

  var CONTROLS = [
    { id: 'ambient', name: 'Ambient', run: function () { FrameDevice.art(deviceDone('Ambient')); } },
    { id: 'apps', name: 'All apps', run: function () { openApps(false); } },
    { id: 'settings', name: 'Settings', run: function () { openSettings(); } }
  ];

  var SVG = {
    ambient: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="9" cy="9.8" r="1.5"/><path d="m4.6 17.6 4.4-4.4 3 3 2.6-2.6 5 5"/>',
    apps: '<rect x="4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8"/><rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8"/><rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"/>'
  };

  /* ---------- helpers ---------- */

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function safeId(id) { return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function notify(text) {
    clearTimeout(S.statusTimer);
    if (!text) { statusEl.className = 'status'; return; }
    statusEl.textContent = text;
    statusEl.className = 'status is-on';
    S.statusTimer = setTimeout(function () { statusEl.className = 'status'; }, 3200);
  }

  function deviceDone(label) {
    return function (err) {
      if (err) notify(err.message || (label + ' is not available on this TV.'));
    };
  }

  /* ---------- state ---------- */

  function appById(appId) {
    for (var i = 0; i < S.apps.length; i++) if (S.apps[i].appId === appId) return S.apps[i];
    return null;
  }

  function load() {
    var raw;
    try { raw = localStorage.getItem(STORE); } catch (e) { return; }
    if (!raw) return;
    var saved;
    try { saved = JSON.parse(raw); } catch (e) { return; }
    if (!saved || typeof saved !== 'object') return;
    for (var i = 0; i < WALLS.length; i++) if (WALLS[i].id === saved.wall) S.wall = saved.wall;
    S.clock24 = !!saved.clock24;
    if (Array.isArray(saved.home)) {
      S.home = saved.home.filter(function (id) { return safeId(id); }).slice(0, MAX_HOME);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ wall: S.wall, clock24: S.clock24, home: S.home }));
    } catch (e) { notify('Could not save preferences.'); }
  }

  function seedHome() {
    if (S.home.length) return;
    var preferred = ['stremio', 'jellyfin', 'spotify', 'netflix', 'youtube', 'primevideo', 'disneyplus', 'appletv'];
    var added = 0, used = {};
    preferred.forEach(function (brand) {
      if (added >= MAX_HOME) return;
      for (var i = 0; i < S.apps.length; i++) {
        if (S.apps[i].brand === brand && !used[S.apps[i].appId]) {
          S.home.push(S.apps[i].appId); used[S.apps[i].appId] = true; added++; return;
        }
      }
    });
    /* Fill the rest of the rail so it does not look broken on a TV whose app IDs differ. */
    for (var j = 0; j < S.apps.length && S.home.length < 6; j++) {
      if (!used[S.apps[j].appId]) { S.home.push(S.apps[j].appId); used[S.apps[j].appId] = true; }
    }
    if (S.home.length) save();
  }

  /* ---------- artwork ---------- */

  function wallMeta(id) {
    for (var i = 0; i < WALLS.length; i++) if (WALLS[i].id === id) return WALLS[i];
    return { id: id, name: id, tone: 'dark' };
  }

  function paintWall() {
    var meta = wallMeta(S.wall);
    if (S.shownWall === S.wall) { applyTone(meta); return; }
    S.shownWall = S.wall;
    applyTone(meta);
    var img = new Image();
    img.onload = function () {
      photo.src = img.src;
      photo.className = 'photo is-on';
    };
    img.onerror = function () { photo.className = 'photo'; };
    img.src = WALLS_DIR + S.wall + '.jpg';
  }

  function applyTone(meta) {
    stage.className = 'stage' + (S.view === 'home' ? '' : ' is-overlay') + (meta.tone === 'light' ? ' tone-light' : '');
  }

  /* ---------- marks ---------- */

  function markHtml(appId, cls) {
    var a = appById(appId), inner;
    if (!a) return '';
    if (a.brand) {
      var url = ICONS + a.brand + '.svg';
      inner = '<span class="mk" style="-webkit-mask-image:url(' + url + ');mask-image:url(' + url + ')"></span>';
    } else if (a.icon) {
      inner = '<img class="mk" src="' + esc(a.icon) + '" alt="">';
    } else {
      inner = '<span class="mono">' + esc((a.name || '?').charAt(0)) + '</span>';
    }
    return '<span class="markbox ' + (cls || '') + '">' + inner + '</span>';
  }

  /* ---------- home ---------- */

  function renderClock() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    if (!S.clock24) h = h % 12 || 12;
    timeEl.textContent = (S.clock24 ? pad(h) : String(h)) + ':' + pad(m);
    dateEl.textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    scheduleClock();
  }

  function scheduleClock() {
    clearTimeout(S.clockTimer);
    var ms = 60000 - (Date.now() % 60000) + 40;
    S.clockTimer = setTimeout(renderClock, ms);
  }

  function renderRail() {
    var html = '', n = S.home.length;
    for (var i = 0; i < n; i++) {
      var appId = S.home[i], a = appById(appId);
      html += '<button type="button" tabindex="-1" class="tile' + (S.view === 'home' && S.sel === i ? ' is-focus' : '') +
        '" data-i="' + i + '" aria-label="' + esc(a ? a.name : appId) + '">' + markHtml(appId) + '</button>';
    }
    rail.innerHTML = html;
    placeFocusName();
  }

  function placeFocusName() {
    if (S.view !== 'home' || S.sel >= S.home.length || !S.home.length) {
      focusName.className = 'focus-name';
      return;
    }
    var a = appById(S.home[S.sel]);
    focusName.textContent = a ? a.name : '';
    var tiles = rail.querySelectorAll('.tile');
    var tile = tiles[S.sel];
    if (!tile) { focusName.className = 'focus-name'; return; }
    focusName.className = 'focus-name is-on';
    var w = focusName.offsetWidth;
    var x = rail.offsetLeft + tile.offsetLeft + tile.offsetWidth / 2 - w / 2;
    focusName.style.left = Math.round(clamp(x, 40, 1880 - w)) + 'px';
  }

  function renderControls() {
    var html = '';
    for (var i = 0; i < CONTROLS.length; i++) {
      var c = CONTROLS[i], focused = S.view === 'home' && S.sel === S.home.length + i;
      html += '<button type="button" tabindex="-1" class="control' + (focused ? ' is-focus' : '') + '" data-c="' + i +
        '" aria-label="' + esc(c.name) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + SVG[c.id] + '</svg></button>';
    }
    controls.innerHTML = html;
  }

  function renderHome() {
    applyTone(wallMeta(S.wall));
    renderClock();
    renderRail();
    renderControls();
    paintWall();
  }

  /* ---------- overlays ---------- */

  function openOverlay(view, title, hint) {
    S.view = view;
    S.oi = 0;
    S.firstRow = 0;
    applyTone(wallMeta(S.wall));
    overlay.hidden = false;
    overlayTitle.textContent = title;
    overlayHint.textContent = hint || '';
    overlayBody.innerHTML = '';
    overlayBody.scrollTop = 0;
    renderRail();
    renderControls();
  }

  function closeOverlay() {
    S.view = 'home';
    S.edit = false;
    overlay.hidden = true;
    renderHome();
  }

  function openApps(edit) {
    S.edit = edit;
    openOverlay('apps', edit ? 'Apps on Home' : 'All apps',
      edit ? 'OK adds or removes. Back when done.' : 'OK opens. Back returns.');
    var grid = document.createElement('div');
    grid.className = 'grid';
    var list = S.apps.slice(0).sort(function (a, b) {
      return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
    });
    if (!list.length) {
      grid.innerHTML = '<p class="overlay-hint">No installed apps were reported by the TV.</p>';
    }
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var on = S.home.indexOf(a.appId) >= 0;
      var card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'button');
      card.setAttribute('data-app', a.appId);
      card.innerHTML = markHtml(a.appId) + '<span class="name">' + esc(a.name) +
        (edit ? ' <span class="dot">' + (on ? '\u25CF' : '\u25CB') + '</span>' : '') + '</span>';
      grid.appendChild(card);
    }
    overlayBody.appendChild(grid);
    S.cards = grid.querySelectorAll('.card');
    paintOverlayFocus();
  }

  function openWalls() {
    openOverlay('walls', 'Background', 'OK applies. Back returns.');
    var wrap = document.createElement('div');
    wrap.className = 'walls';
    for (var i = 0; i < WALLS.length; i++) {
      var w = WALLS[i];
      var node = document.createElement('div');
      node.className = 'wall' + (w.id === S.wall ? ' is-current' : '');
      node.setAttribute('role', 'button');
      node.setAttribute('data-wall', w.id);
      node.innerHTML = '<img src="' + WALLS_DIR + w.id + '-thumb.jpg" alt=""><span class="cap">' + esc(w.name) + '</span>';
      wrap.appendChild(node);
    }
    overlayBody.appendChild(wrap);
    S.cards = wrap.querySelectorAll('.wall');
    var idx = 0;
    for (var j = 0; j < WALLS.length; j++) if (WALLS[j].id === S.wall) idx = j;
    S.oi = idx;
    paintOverlayFocus();
  }

  function openSettings() {
    openOverlay('settings', 'Settings', 'OK changes. Back returns.');
    var rows = [
      { label: 'Background', value: wallMeta(S.wall).name, run: openWalls },
      { label: 'Clock', value: S.clock24 ? '24-hour' : '12-hour', run: function () { S.clock24 = !S.clock24; save(); closeOverlay(); openSettings(); } },
      { label: 'Apps on Home', value: S.home.length + ' of ' + MAX_HOME, run: function () { openApps(true); } },
      { label: 'Diagnostics', value: S.apps.length + ' apps', run: openDiagnostics }
    ];
    S.rows = rows;
    var box = document.createElement('div');
    box.className = 'rows';
    for (var i = 0; i < rows.length; i++) {
      var row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('role', 'button');
      row.innerHTML = '<span class="label">' + esc(rows[i].label) + '</span><span class="value">' + esc(rows[i].value) + '</span>';
      box.appendChild(row);
    }
    overlayBody.appendChild(box);
    S.cards = box.querySelectorAll('.row');
    paintOverlayFocus();
  }

  function openDiagnostics() {
    openOverlay('diagnostics', 'Diagnostics', 'Back returns.');
    var timeStyle = window.getComputedStyle(timeEl);
    var manrope = !!(document.fonts && document.fonts.check && document.fonts.check('16px Manrope'));
    var facts = [
      ['Viewport', window.innerWidth + ' x ' + window.innerHeight],
      ['Screen', screen.width + ' x ' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x'],
      ['Manrope loaded', manrope ? 'yes' : 'NO - falling back'],
      ['Clock font', timeStyle.fontFamily.replace(/"/g, '') + ' ' + timeStyle.fontWeight + ' ' + timeStyle.fontSize],
      ['Installed apps', String(S.apps.length)],
      ['Engine', (navigator.userAgent || '').replace(/^.*?\(/, '').split(')')[0]]
    ];
    var box = document.createElement('div');
    box.className = 'rows';
    for (var i = 0; i < facts.length; i++) {
      var row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = '<span class="label">' + esc(facts[i][0]) + '</span><span class="value">' + esc(facts[i][1]) + '</span>';
      box.appendChild(row);
    }
    overlayBody.appendChild(box);
    S.cards = box.querySelectorAll('.row');
    paintOverlayFocus();
  }

  function columns() { return S.view === 'apps' ? 7 : S.view === 'walls' ? 5 : 1; }  function cardCount() { return S.cards ? S.cards.length : 0; }

  function paintOverlayFocus() {
    if (!S.cards) return;
    var cols = columns();
    for (var i = 0; i < S.cards.length; i++) {
      var el = S.cards[i];
      var on = i === S.oi;
      if (el.classList) el.classList.toggle('is-focus', on);
      else el.className = el.className.replace(/\s*is-focus/, '') + (on ? ' is-focus' : '');
    }
    if (S.view === 'apps' || S.view === 'walls') {
      var rowH = S.view === 'apps' ? 220 : 224;
      var body = overlayBody.clientHeight;
      var row = Math.floor(S.oi / cols), rows = Math.max(1, Math.floor(body / rowH));
      if (row < S.firstRow) S.firstRow = row;
      if (row > S.firstRow + rows - 1) S.firstRow = row - rows + 1;
      var grid = overlayBody.querySelector('.grid, .walls');
      if (grid) grid.style.transform = 'translateY(' + (-S.firstRow * rowH) + 'px)';
    }
  }

  /* ---------- actions ---------- */

  function launchApp(appId) {
    var a = appById(appId);
    notify('Opening ' + (a ? a.name : 'app') + '\u2026');
    FrameDevice.launchApp(appId, deviceDone('That app'));
  }

  function activateHome() {
    if (S.sel < S.home.length) {
      launchApp(S.home[S.sel]);
    } else {
      var c = CONTROLS[S.sel - S.home.length];
      if (c) c.run();
    }
  }

  function activateOverlay() {
    if (S.view === 'apps') {
      var card = S.cards[S.oi];
      if (!card) return;
      var appId = card.getAttribute('data-app');
      if (!S.edit) { closeOverlay(); launchApp(appId); return; }
      var at = S.home.indexOf(appId);
      if (at >= 0) { S.home.splice(at, 1); }
      else if (S.home.length >= MAX_HOME) { notify('Home holds ' + MAX_HOME + ' apps. Remove one first.'); return; }
      else { S.home.push(appId); }
      save();
      var on = S.home.indexOf(appId) >= 0;
      var dot = card.querySelector('.dot');
      if (dot) dot.textContent = on ? '\u25CF' : '\u25CB';
      renderRail();
    } else if (S.view === 'walls') {
      var node = S.cards[S.oi];
      if (!node) return;
      S.wall = node.getAttribute('data-wall');
      save();
      closeOverlay();
    } else if (S.view === 'settings') {
      var row = S.rows[S.oi];
      if (row) row.run();
    }
  }

  function moveOverlay(dir) {
    var cols = columns(), n = cardCount();
    if (!n) return;
    var i = S.oi;
    if (S.view === 'settings') {
      if (dir === 'up') i = Math.max(0, i - 1);
      if (dir === 'down') i = Math.min(n - 1, i + 1);
    } else {
      if (dir === 'left') { if (i % cols > 0) i--; }
      else if (dir === 'right') { if (i % cols < cols - 1 && i + 1 < n) i++; }
      else if (dir === 'up') { if (i - cols >= 0) i -= cols; }
      else if (dir === 'down') { if (i + cols < n) i += cols; }
    }
    S.oi = i;
    paintOverlayFocus();
  }

  function moveHome(dir) {
    var total = S.home.length + CONTROLS.length;
    if (!total) return;
    if (dir === 'left') S.sel = clamp(S.sel - 1, 0, total - 1);
    else if (dir === 'right') S.sel = clamp(S.sel + 1, 0, total - 1);
    else if (dir === 'down' || dir === 'up') return;
    renderRail();
    renderControls();
  }

  function back() {
    if (S.view !== 'home') {
      if (S.view === 'apps' && S.edit) { closeOverlay(); openSettings(); return; }
      if (S.view === 'walls') { closeOverlay(); openSettings(); return; }
      closeOverlay();
    }
  }

  /* ---------- input ---------- */

  document.addEventListener('keydown', function (ev) {
    var k = KEY[ev.keyCode];
    if (!k) return;
    ev.preventDefault();
    if (S.view === 'home') {
      if (k === 'ok') activateHome();
      else if (k === 'back') { /* stay on Home */ }
      else moveHome(k);
    } else {
      if (k === 'ok') activateOverlay();
      else if (k === 'back') back();
      else moveOverlay(k);
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { renderClock(); }
  });

  /* ---------- boot ---------- */

  function boot() {
    load();
    paintWall();
    renderClock();
    renderControls();
    renderRail();
    FrameDevice.apps(function (err, list) {
      if (!err && list && list.length) {
        S.apps = list;
        S.ready = true;
        seedHome();
        renderRail();
        renderControls();
        placeFocusName();
      } else {
        notify('Could not read the installed app list.');
      }
    });
  }

  boot();
}());
