/* VoltStop – class-project prototype. Fictional business, no real payments. */
(function () {
  'use strict';

  var SWAP_PRICE = 150;
  var FREE_SWAP_POINTS = 150;
  var STORE_KEY = 'voltstop-demo-v1';

  var KIOSKS = [
    { id: 0, name: 'Stage 2, Kenyatta Ave', dist: '350 m', ready: 6, lat: -0.2860, lng: 36.0690 },
    { id: 1, name: 'Free Area market', dist: '1.2 km', ready: 2, lat: -0.2790, lng: 36.0950 },
    { id: 2, name: 'Pipeline duka', dist: '2.0 km', ready: 0, note: 'full in 15 min', lat: -0.3040, lng: 36.1100 },
    { id: 3, name: 'Section 58', dist: '2.6 km', ready: 4, lat: -0.2700, lng: 36.0720 },
    { id: 4, name: 'Lanet junction', dist: '4.1 km', ready: 7, lat: -0.2900, lng: 36.1400 }
  ];

  var REWARDS = [
    { id: 'swap', name: 'Free swap', cost: 150, icon: 'bolt' },
    { id: 'airtime', name: 'KSh 50 airtime', cost: 80, icon: 'phone' },
    { id: 'charge', name: 'Free phone charge', cost: 30, icon: 'plug' },
    { id: 'helmet', name: '10% off a helmet', cost: 500, icon: 'helmet' }
  ];

  /* ---------- State (localStorage, safely) ---------- */
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); }

  function defaultState() {
    return { wallet: 450, points: 140, streak: 5, lastSwapDay: daysAgo(1), freeSwaps: 0, swaps: 23, lastSwap: null };
  }
  var memoryState = null;
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s.wallet === 'number') return Object.assign(defaultState(), s);
      }
    } catch (e) { /* private mode or blocked storage */ }
    return memoryState || defaultState();
  }
  function save(s) {
    memoryState = s;
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }
  function resetDemo() {
    try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    memoryState = null;
    swapFlow = null;
    topupReturn = null;
    toast('Demo reset: KSh 450, 140 points, 5-day streak');
    if (location.hash === '#home') render(); else location.hash = '#home';
  }

  /* ---------- Helpers ---------- */
  var app = document.getElementById('app');
  var nav = document.getElementById('nav');
  var toastEl = document.getElementById('toast');
  var toastTimer;

  function ksh(n) { return 'KSh ' + Number(n).toLocaleString('en-KE'); }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  function availClass(k) { return k.ready === 0 ? 'none' : (k.ready <= 2 ? 'low' : 'ready'); }
  function availColor(k) { return k.ready === 0 ? '#9AA8A1' : (k.ready <= 2 ? '#F2B705' : '#3DDC84'); }
  function availText(k) { return k.ready === 0 ? (k.note || 'none ready') : k.ready + ' ready'; }
  function isOffPeak(d) { var h = (d || new Date()).getHours(); return h >= 22 || h < 6; }

  var PIN = 'M50 4C26.8 4 8 22.4 8 45.2C8 74 50 116 50 116C50 116 92 74 92 45.2C92 22.4 73.2 4 50 4Z';
  var BOLT = 'M57 17L32 57H48L42 89L69 45H53L57 17Z';
  function logo(pinFill, boltFill) {
    return '<svg viewBox="0 0 100 120" aria-hidden="true"><path d="' + PIN + '" fill="' + (pinFill || '#F2B705') + '"/><path d="' + BOLT + '" fill="' + (boltFill || '#0B3D2E') + '"/></svg>';
  }
  function brand() { return '<a class="brand" href="#home" aria-label="VoltStop home">' + logo() + '<span>Volt<span class="stop">Stop</span></span></a>'; }

  var ICON = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2.4 1.3-3.8 2.4-5 .2 1.6.9 2.7 2 3.2C11 8.6 11.3 5.2 12 2z"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3M16 13.5h2"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>',
    plug: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/></svg>',
    helmet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 16a9 9 0 0 1 18 0v2H3zM12 7v4M3 16h10l2-4"/></svg>',
    gift: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v10H4zM2 7h20v4H2zM12 7v14M12 7c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z"/></svg>'
  };

  function head(title, backHref) {
    return '<header class="page-head"><a class="back" href="' + (backHref || '#home') + '" aria-label="Back">' + ICON.back + '</a><h1>' + title + '</h1></header>';
  }

  /* ---------- Router ---------- */
  var cleanup = null;
  var swapFlow = null;     // { kioskId, step }
  var topupReturn = null;  // e.g. '#swap/0'
  var swapTimers = [];

  function parseHash() {
    var h = (location.hash || '#home').slice(1);
    var parts = h.split('/');
    return { name: parts[0] || 'home', arg: parts[1] };
  }

  function render() {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    swapTimers.forEach(clearTimeout); swapTimers = [];
    var r = parseHash();
    var views = { home: viewHome, map: viewMap, scan: viewScan, swap: viewSwap, rewards: viewRewards, topup: viewTopup, account: viewAccount };
    var view = views[r.name] || viewHome;
    var tab = { home: 'home', map: 'map', rewards: 'rewards', account: 'account' }[r.name];
    document.body.classList.toggle('no-nav', r.name === 'scan' || r.name === 'swap');
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      var on = a.getAttribute('data-tab') === tab;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    view(r.arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);

  /* ---------- Home ---------- */
  function viewHome() {
    var s = load();
    var toward = Math.min(s.points, FREE_SWAP_POINTS);
    var pct = Math.round(toward / FREE_SWAP_POINTS * 100);
    var pointsHint = s.points >= FREE_SWAP_POINTS
      ? 'You have enough for a <b>free swap</b>. <a href="#rewards">Redeem it</a>'
      : '<b>' + (FREE_SWAP_POINTS - s.points) + ' more points</b> for a free swap';

    app.innerHTML =
      '<section class="hero">' +
        '<div class="hero-top">' + brand() +
          '<span class="streak-pill">' + ICON.flame + s.streak + '-day streak</span></div>' +
        '<p class="greeting">Habari, Brian</p>' +
        '<p class="sub">Ready to ride? Swap a battery in under a minute.</p>' +
      '</section>' +
      '<div class="wrap lift">' +
        '<div class="card">' +
          '<p class="label">VoltStop wallet</p>' +
          '<p class="balance"><small>KSh</small>' + s.wallet.toLocaleString('en-KE') + '</p>' +
          '<div class="row"><span class="hint">One swap = ' + ksh(SWAP_PRICE) + (s.freeSwaps ? ' · <b>' + s.freeSwaps + ' free swap' + (s.freeSwaps > 1 ? 's' : '') + '</b>' : '') + '</span>' +
          '<a class="btn btn-primary btn-sm" href="#topup">' + ICON.wallet + 'Top up M-Pesa</a></div>' +
        '</div>' +
        '<a class="btn btn-yellow btn-block btn-big" href="#scan">' + ICON.scan + 'Scan to swap</a>' +
        '<div style="height:14px"></div>' +
        '<a class="card" href="#rewards" style="display:block;text-decoration:none">' +
          '<div class="row"><h2 style="margin:0">VoltPoints</h2><b>' + s.points + ' / ' + FREE_SWAP_POINTS + '</b></div>' +
          '<div class="bar" role="progressbar" aria-label="Points toward a free swap" aria-valuemin="0" aria-valuemax="' + FREE_SWAP_POINTS + '" aria-valuenow="' + toward + '"><span style="width:' + pct + '%"></span></div>' +
          '<p class="hint">' + pointsHint + '</p>' +
        '</a>' +
        '<div class="card">' +
          '<div class="row"><h2 style="margin:0">Kiosks near you</h2><a class="link-btn" href="#map">Map</a></div>' +
          '<ul class="kiosk-list">' + KIOSKS.map(kioskRow).join('') + '</ul>' +
        '</div>' +
        '<p class="footer-note">Prototype for a class project · <button class="link-btn" id="reset">Reset demo</button></p>' +
      '</div>';
    document.getElementById('reset').onclick = resetDemo;
  }

  function kioskRow(k) {
    return '<li><a class="kiosk" href="#map/' + k.id + '">' +
      '<span class="kiosk-icon">' + logo() + '</span>' +
      '<span class="kiosk-body"><span class="kiosk-name">' + k.name + '</span><br><span class="kiosk-meta">' + k.dist + ' away</span></span>' +
      '<span class="avail"><span class="dot ' + availClass(k) + '"></span>' + availText(k) + '</span>' + ICON.chev +
      '</a></li>';
  }

  /* ---------- Map ---------- */
  function viewMap(arg) {
    app.innerHTML = head('Kiosks in Nakuru') +
      '<div class="map-wrap">' +
        '<div id="map" role="region" aria-label="Map of VoltStop kiosks"></div>' +
        '<div class="map-legend" aria-hidden="true"><span><i class="dot ready"></i>3+ ready</span><span><i class="dot low"></i>1–2 ready</span><span><i class="dot none"></i>Charging</span></div>' +
        '<div class="sheet" id="sheet" aria-live="polite"></div>' +
      '</div>';

    var sheet = document.getElementById('sheet');
    function showKiosk(k) {
      var canSwap = k.ready > 0;
      sheet.innerHTML =
        '<button class="close" aria-label="Close">' + ICON.close + '</button>' +
        '<h3>' + k.name + '</h3>' +
        '<p class="kiosk-meta" style="margin:0 0 10px">' + k.dist + ' away · open 24 hours</p>' +
        '<p class="avail" style="margin:0 0 14px"><span class="dot ' + availClass(k) + '"></span>' +
          (canSwap ? k.ready + ' of 8 batteries ready' : 'No batteries ready – ' + (k.note || 'check back soon')) + '</p>' +
        (canSwap
          ? '<a class="btn btn-yellow btn-block" href="#swap/' + k.id + '">' + ICON.bolt.replace('<svg', '<svg fill="currentColor"') + 'Swap here · ' + ksh(SWAP_PRICE) + '</a>'
          : '<button class="btn btn-block" disabled>Swap here</button>');
      sheet.classList.add('open');
      sheet.querySelector('.close').onclick = function () { sheet.classList.remove('open'); };
    }

    if (!window.L) {
      document.getElementById('map').innerHTML = '<div class="map-fallback"><p>The map could not load (no internet?). Pick a kiosk instead:</p></div>';
      var fb = document.querySelector('.map-fallback');
      fb.insertAdjacentHTML('beforeend', '<ul class="kiosk-list" style="text-align:left;background:#fff;border-radius:16px;padding:0 12px">' +
        KIOSKS.map(function (k) { return '<li><a class="kiosk" href="#swap/' + k.id + '"><span class="kiosk-body"><span class="kiosk-name">' + k.name + '</span></span><span class="avail"><span class="dot ' + availClass(k) + '"></span>' + availText(k) + '</span></a></li>'; }).join('') + '</ul>');
      return;
    }

    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([-0.2833, 36.0667], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    function focusPin(k) {
      var pt = map.project([k.lat, k.lng], map.getZoom()).add([0, 90]);
      map.panTo(map.unproject(pt, map.getZoom()));
    }
    var bounds = [];
    KIOSKS.forEach(function (k) {
      var icon = L.divIcon({
        className: 'pin-marker',
        html: '<svg viewBox="0 0 100 120" width="34" height="41"><path d="' + PIN + '" fill="' + availColor(k) + '" stroke="#0B3D2E" stroke-width="5"/><path d="' + BOLT + '" fill="#0B3D2E"/></svg>',
        iconSize: [34, 41], iconAnchor: [17, 40]
      });
      var m = L.marker([k.lat, k.lng], { icon: icon, title: k.name, keyboard: true }).addTo(map);
      m.on('click', function () { showKiosk(k); focusPin(k); });
      bounds.push([k.lat, k.lng]);
    });
    map.fitBounds(bounds, { padding: [30, 30] });
    map.on('click', function () { sheet.classList.remove('open'); });

    var pre = KIOSKS[Number(arg)];
    if (pre) { map.setView([pre.lat, pre.lng], 14, { animate: false }); showKiosk(pre); focusPin(pre); }
    setTimeout(function () { map.invalidateSize(); }, 100);
    cleanup = function () { map.remove(); };
  }

  /* ---------- Scan ---------- */
  function viewScan() {
    var qr = '<svg class="fake-qr" viewBox="0 0 7 7" aria-hidden="true" fill="#fff"><path d="M0 0h3v3H0zM4 0h3v3H4zM0 4h3v3H0zM4 4h1v1H4zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM6 6h1v1H6z"/></svg>';
    app.innerHTML =
      '<section class="scan-screen">' +
        '<header class="page-head" style="background:transparent">' +
          '<a class="back" href="#home" aria-label="Back">' + ICON.back + '</a><h1>Scan kiosk QR</h1></header>' +
        '<div class="viewfinder" id="vf" aria-hidden="true">' + qr +
          '<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>' +
          '<span class="scanline"></span></div>' +
        '<div class="scan-copy"><h2 id="scan-title">Point at the code on the kiosk</h2>' +
          '<p>This prototype does not use your camera. Tap “Simulate scan” to pretend you scanned Stage 2, Kenyatta Ave.</p></div>' +
        '<div class="scan-actions">' +
          '<button class="btn btn-yellow btn-block" id="sim">' + ICON.scan + 'Simulate scan</button>' +
          '<a class="btn btn-ghost btn-block" href="#map">' + ICON.map + 'Choose a kiosk on the map</a>' +
        '</div>' +
      '</section>';
    document.getElementById('sim').onclick = function () {
      this.disabled = true;
      document.getElementById('vf').classList.add('found');
      document.getElementById('scan-title').textContent = 'Found: Stage 2, Kenyatta Ave';
      swapTimers.push(setTimeout(function () { location.hash = '#swap/0'; }, 700));
    };
  }

  /* ---------- Swap ---------- */
  // Door layout for a kiosk: door 3 = empty slot for your battery, door 6 = full battery for you.
  function doorLayout(k) {
    var leds = {};
    for (var i = 1; i <= 8; i++) leds[i] = 'charging';
    leds[3] = 'empty';
    leds[6] = 'ready';
    var others = [1, 2, 4, 5, 8, 7];
    for (var j = 0; j < Math.max(0, k.ready - 1) && j < others.length; j++) leds[others[j]] = 'ready';
    return leds;
  }

  function viewSwap(arg) {
    var k = KIOSKS[Number(arg)] || KIOSKS[0];
    var s = load();

    if (k.ready === 0) {
      app.innerHTML = head('Swap', '#map') + '<div class="wrap" style="padding-top:16px"><div class="card"><h2>' + k.name + '</h2><p>No batteries ready right now – ' + (k.note || 'please try another kiosk') + '.</p><a class="btn btn-primary btn-block" href="#map">Find another kiosk</a></div></div>';
      return;
    }
    if (!swapFlow || swapFlow.kioskId !== k.id || swapFlow.step === 'done') {
      if (s.wallet < SWAP_PRICE && !s.freeSwaps) {
        topupReturn = '#swap/' + k.id;
        location.hash = '#topup';
        return;
      }
      swapFlow = { kioskId: k.id, step: 'a' };
    }
    drawSwap(k);
  }

  function drawSwap(k) {
    var step = swapFlow.step;
    if (step === 'success') return drawSuccess(k);

    var leds = doorLayout(k);
    var doorClass = {};
    if (step === 'a') { doorClass[3] = 'open-yellow'; }
    if (step === 'b') { leds[3] = 'charging'; doorClass[3] = 'checking'; }
    if (step === 'c') { leds[3] = 'charging'; doorClass[6] = 'open-green'; }

    var doors = '';
    for (var i = 1; i <= 8; i++) {
      doors += '<div class="door ' + (doorClass[i] || '') + '" aria-label="Door ' + i + ', ' + leds[i] + '"><span class="led ' + leds[i] + '"></span><span>' + i + '</span><span class="handle"></span></div>';
    }

    var n = { a: 1, b: 2, c: 3 }[step];
    var steps = '<div class="steps" aria-hidden="true">' + [1, 2, 3].map(function (x) { return '<i class="' + (x <= n ? 'on' : '') + '"></i>'; }).join('') + '</div>';

    var body;
    if (step === 'a') {
      body = '<p class="step-label">Step 1 of 3</p><h2>Door 3 is open – put your empty battery in</h2>' +
        '<p>Slide the battery in until it clicks, then close the door.</p>' +
        '<button class="btn btn-primary btn-block" id="next">' + ICON.door + 'I’ve closed the door</button>';
    } else if (step === 'b') {
      body = '<p class="step-label">Step 2 of 3</p><div class="spinner" role="img" aria-label="Loading"></div><h2>Checking your battery…</h2>' +
        '<p>The kiosk is testing its health and charge.</p>';
    } else {
      body = '<p class="step-label">Step 3 of 3</p><h2>Door 6 is open – take your full battery</h2>' +
        '<p>Battery 100% charged · about 70 km of riding.</p>' +
        '<button class="btn btn-yellow btn-block" id="next">' + ICON.bolt.replace('<svg', '<svg fill="currentColor"') + 'Got it – I took the battery</button>';
    }

    app.innerHTML = head('Swap at kiosk', '#home') +
      '<div class="wrap">' +
        '<div class="kiosk-banner">' + '<span class="kiosk-icon" style="width:32px;height:32px">' + logo() + '</span><span><strong>' + k.name + '</strong><br>Locker with 8 doors</span></div>' +
        '<div class="locker">' + doors + '</div>' +
        '<div class="locker-legend" aria-hidden="true"><span><i class="dot ready"></i>Full</span><span><i class="dot low"></i>Charging</span><span><i class="dot none"></i>Empty</span></div>' +
        '<div class="card instruction" aria-live="polite">' + steps + body + '</div>' +
      '</div>';

    var next = document.getElementById('next');
    if (step === 'a') {
      next.onclick = function () {
        swapFlow.step = 'b'; drawSwap(k);
      };
    } else if (step === 'c') {
      next.onclick = function () { completeSwap(); swapFlow.step = 'success'; drawSwap(k); };
    } else if (step === 'b') {
      swapTimers.push(setTimeout(function () { if (swapFlow && swapFlow.step === 'b') { swapFlow.step = 'c'; drawSwap(k); } }, 2000));
    }
  }

  function completeSwap() {
    var s = load();
    var now = new Date();
    var free = s.freeSwaps > 0;
    var paid = free ? 0 : SWAP_PRICE;
    if (free) s.freeSwaps -= 1; else s.wallet -= SWAP_PRICE;
    var bonus = isOffPeak(now) ? 5 : 0;
    var earned = 10 + bonus;
    s.points += earned;
    var today = dayKey(now);
    if (s.lastSwapDay !== today) {
      s.streak = (s.lastSwapDay === daysAgo(1)) ? s.streak + 1 : 1;
      s.lastSwapDay = today;
    }
    s.swaps += 1;
    s.lastSwap = { paid: paid, free: free, earned: earned, bonus: bonus };
    save(s);
  }

  function drawSuccess(k) {
    var s = load();
    var ls = s.lastSwap || { paid: SWAP_PRICE, earned: 10, bonus: 0 };
    var colors = ['#F2B705', '#3DDC84', '#1F6F50', '#0B3D2E', '#FFFFFF'];
    var conf = '';
    for (var i = 0; i < 36; i++) {
      conf += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + colors[i % colors.length] +
        ';animation-delay:' + (Math.random() * .5).toFixed(2) + 's;animation-duration:' + (1.4 + Math.random()).toFixed(2) + 's"></i>';
    }
    var paidText = ls.free ? 'Free swap used' : ksh(ls.paid) + ' paid';
    app.innerHTML = head('Swap complete', '#home') +
      '<div class="wrap"><div class="card success">' +
        '<div class="confetti" aria-hidden="true">' + conf + '</div>' +
        '<svg class="check-circle" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46"/><path d="M29 52l14 14 29-31"/></svg>' +
        '<h2>Swap done. Ride safe!</h2>' +
        '<p class="paid">' + paidText + ' · <span class="pts">+' + ls.earned + ' VoltPoints</span></p>' +
        (ls.bonus ? '<p class="hint">Includes +' + ls.bonus + ' off-peak bonus</p>' : '') +
        '<div class="summary" style="margin-top:18px">' +
          '<div class="row"><span>Kiosk</span><b>' + k.name + '</b></div>' +
          '<div class="row"><span>Wallet balance</span><b>' + ksh(s.wallet) + '</b></div>' +
          '<div class="row"><span>VoltPoints</span><b>' + s.points + '</b></div>' +
          '<div class="row"><span>Streak</span><b>' + s.streak + ' days</b></div>' +
        '</div>' +
      '</div>' +
      '<a class="btn btn-primary btn-block" href="#home">Back to home</a>' +
      '<div style="height:10px"></div>' +
      '<a class="btn btn-outline btn-block" href="#rewards">See my rewards</a></div>';
    swapFlow.step = 'done';
  }

  /* ---------- Top up ---------- */
  function viewTopup() {
    var s = load();
    var amounts = [150, 300, 500, 1000];
    var chosen = s.wallet < SWAP_PRICE ? 150 : 300;
    var needNotice = topupReturn
      ? '<div class="notice">Your balance is ' + ksh(s.wallet) + '. Top up at least ' + ksh(SWAP_PRICE - s.wallet) + ' to swap – you’ll go straight back to the kiosk.</div>'
      : '';

    app.innerHTML = head('Top up wallet', topupReturn ? '#home' : '#home') +
      '<div class="wrap" style="padding-top:16px">' +
        needNotice +
        '<div class="card">' +
          '<p class="label">Current balance</p><p class="balance"><small>KSh</small>' + s.wallet.toLocaleString('en-KE') + '</p>' +
          '<h2>Choose an amount</h2>' +
          '<div class="chips" role="group" aria-label="Amount">' + amounts.map(function (a) {
            return '<button class="chip" data-amt="' + a + '" aria-pressed="' + (a === chosen) + '">' + ksh(a) + '</button>';
          }).join('') + '</div>' +
          '<div class="sim-note">' + ICON.info + '<span><b>Simulation only.</b> No money moves and no real M-Pesa prompt is sent. Do not enter your real PIN anywhere.</span></div>' +
          '<button class="btn btn-primary btn-block" id="pay">Pay ' + ksh(chosen) + ' with M-Pesa</button>' +
        '</div>' +
        '<p class="footer-note">Paying from 0712 345 678 (demo number)</p>' +
      '</div>';

    var pay = document.getElementById('pay');
    Array.prototype.forEach.call(app.querySelectorAll('.chip'), function (c) {
      c.onclick = function () {
        chosen = Number(c.getAttribute('data-amt'));
        Array.prototype.forEach.call(app.querySelectorAll('.chip'), function (o) { o.setAttribute('aria-pressed', String(o === c)); });
        pay.textContent = 'Pay ' + ksh(chosen) + ' with M-Pesa';
      };
    });
    pay.onclick = function () { mpesaPrompt(chosen); };
  }

  function mpesaPrompt(amount) {
    var ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="prompt" role="dialog" aria-modal="true" aria-labelledby="mp-t">' +
      '<span class="sim-tag">Simulated M-Pesa</span>' +
      '<h3 id="mp-t">Check your phone and enter your M-Pesa PIN</h3>' +
      '<p>Pay ' + ksh(amount) + ' to VoltStop. (In this demo nothing is sent – just wait.)</p>' +
      '<div class="pin-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<div class="spinner" role="img" aria-label="Waiting"></div></div>';
    document.querySelector('.phone').appendChild(ov);
    var dots = ov.querySelectorAll('.pin-dots i');
    var t = [];
    for (var i = 0; i < 4; i++) (function (i) { t.push(setTimeout(function () { dots[i].classList.add('on'); }, 300 + i * 350)); })(i);
    t.push(setTimeout(function () {
      var s = load();
      s.wallet += amount;
      save(s);
      ov.querySelector('.prompt').innerHTML =
        '<svg class="check-circle" viewBox="0 0 100 100" style="width:84px;height:84px" aria-hidden="true"><circle cx="50" cy="50" r="46"/><path d="M29 52l14 14 29-31"/></svg>' +
        '<span class="sim-tag">Simulated</span><h3>Top up successful</h3>' +
        '<p>' + ksh(amount) + ' added. New balance: <b>' + ksh(s.wallet) + '</b></p>' +
        '<button class="btn btn-primary btn-block" id="mp-ok">' + (topupReturn ? 'Continue to swap' : 'Done') + '</button>';
      document.getElementById('mp-ok').onclick = function () {
        ov.remove();
        var back = topupReturn; topupReturn = null;
        if (back && s.wallet >= SWAP_PRICE) location.hash = back;
        else if (back) { topupReturn = back; render(); }
        else location.hash = '#home';
      };
      document.getElementById('mp-ok').focus();
    }, 2000));
    cleanup = function () { t.forEach(clearTimeout); if (ov.parentNode) ov.remove(); };
  }

  /* ---------- Rewards ---------- */
  function viewRewards() {
    var s = load();
    var r = 52, c = 2 * Math.PI * r;
    var frac = Math.min(1, s.points / FREE_SWAP_POINTS);
    var swappedToday = s.lastSwapDay === dayKey();
    var week = '';
    var labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var offset = swappedToday ? i : i - 1;
      var on = offset >= 0 && offset < s.streak;
      week += '<span class="' + (on ? 'on' : '') + '"><i></i>' + (i === 0 ? 'Today' : labels[d.getDay()]) + '</span>';
    }

    app.innerHTML = head('Rewards') +
      '<div class="wrap" style="padding-top:16px">' +
        '<div class="card ring-card">' +
          '<div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="' + r + '" fill="none" stroke-width="12"/>' +
            '<circle class="fill" cx="60" cy="60" r="' + r + '" fill="none" stroke-width="12" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - frac)).toFixed(1) + '"/></svg>' +
            '<div class="center"><div><b>' + s.points + '</b><small>VoltPoints</small></div></div></div>' +
          '<div><h2 style="margin-bottom:4px">' + (s.points >= FREE_SWAP_POINTS ? 'Free swap unlocked!' : (FREE_SWAP_POINTS - s.points) + ' to a free swap') + '</h2>' +
            '<p class="hint">150 points = 1 free swap' + (s.freeSwaps ? '<br><b>' + s.freeSwaps + ' free swap' + (s.freeSwaps > 1 ? 's' : '') + ' ready to use</b>' : '') + '</p></div>' +
        '</div>' +
        '<div class="card">' +
          '<p class="streak-line">' + ICON.flame + s.streak + '-day swap streak' + (swappedToday ? ' – nice work today!' : ' – swap today to keep it going') + '</p>' +
          '<div class="week">' + week + '</div>' +
        '</div>' +
        '<div class="card"><h2>Rewards</h2>' + REWARDS.map(function (rw) {
          var ok = s.points >= rw.cost;
          return '<div class="reward"><span class="reward-icon">' + ICON[rw.icon] + '</span>' +
            '<span class="reward-body"><span class="reward-name">' + rw.name + '</span><br><span class="reward-cost">' + rw.cost + ' pts' + (ok ? '' : ' · need ' + (rw.cost - s.points) + ' more') + '</span></span>' +
            '<button class="btn btn-sm ' + (ok ? 'btn-yellow' : '') + '" data-rw="' + rw.id + '"' + (ok ? '' : ' disabled') + '>Redeem</button></div>';
        }).join('') + '</div>' +
        '<div class="card"><h2>Ways to earn</h2><ul class="earn">' +
          '<li><span>Every swap</span><b>+10</b></li>' +
          '<li><span>Off-peak swap (10 pm–6 am)</span><b>+5 bonus</b></li>' +
          '<li><span>Refer a rider</span><b>+100</b></li>' +
        '</ul></div>' +
      '</div>';

    Array.prototype.forEach.call(app.querySelectorAll('[data-rw]'), function (b) {
      b.onclick = function () {
        var rw = REWARDS.filter(function (x) { return x.id === b.getAttribute('data-rw'); })[0];
        var st = load();
        if (st.points < rw.cost) return;
        st.points -= rw.cost;
        var code = 'VS-' + Math.random().toString(36).slice(2, 6).toUpperCase();
        var msg;
        if (rw.id === 'swap') { st.freeSwaps += 1; msg = 'Free swap added – it’s used on your next swap'; }
        else if (rw.id === 'airtime') msg = 'KSh 50 airtime sent to 0712 345 678 (simulated)';
        else if (rw.id === 'charge') msg = 'Show code ' + code + ' at any kiosk for a phone charge';
        else msg = 'Helmet discount code: ' + code;
        save(st);
        viewRewards();
        toast(msg);
      };
    });
  }

  /* ---------- Account ---------- */
  function viewAccount() {
    var s = load();
    app.innerHTML = head('Account') +
      '<div class="wrap" style="padding-top:16px">' +
        '<div class="card"><div class="row" style="justify-content:flex-start;gap:14px"><div class="avatar">B</div>' +
          '<div><h2 style="margin:0">Brian</h2><p class="hint">Boda rider · Nakuru</p></div></div></div>' +
        '<div class="card">' +
          '<div class="kv"><span>Phone (demo)</span><b>0712 345 678</b></div>' +
          '<div class="kv"><span>Wallet</span><b>' + ksh(s.wallet) + '</b></div>' +
          '<div class="kv"><span>VoltPoints</span><b>' + s.points + '</b></div>' +
          '<div class="kv"><span>Total swaps</span><b>' + s.swaps + '</b></div>' +
          '<div class="kv"><span>Streak</span><b>' + s.streak + ' days</b></div>' +
        '</div>' +
        '<div class="card"><h2>About this prototype</h2><p class="hint" style="line-height:1.5">VoltStop is a fictional battery-swap business made for a class presentation. Kiosks, prices and the rider are made up. No payments are real and no camera or location is used.</p></div>' +
        '<button class="btn btn-outline btn-block" id="reset">Reset demo</button>' +
      '</div>';
    document.getElementById('reset').onclick = resetDemo;
  }

  if (!location.hash) history.replaceState(null, '', '#home');
  render();
})();
