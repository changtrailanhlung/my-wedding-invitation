/* Thiệp cưới: đọc config.json rồi hiển thị. Cũng nhận bản xem trước từ admin.html qua postMessage. */
(function () {
  var DEFAULTS = window.INVITE_DEFAULTS;
  var WEEK = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function merge(c) {
    var out = Object.assign({}, DEFAULTS, c || {});
    out.images = Object.assign({}, (c && c.images) || {});
    return out;
  }
  var state = merge();

  function parseDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    return { y: y, mo: mo, d: d, wd: WEEK[new Date(y, mo - 1, d).getDay()], txt: pad(d) + '.' + pad(mo) + '.' + y };
  }
  function gcal(d) { return d.toISOString().replace(/[-:]|\.\d{3}/g, ''); }

  /* ===== Màu sắc và ảnh nền ===== */
  function isHex(v) { return /^#[0-9a-fA-F]{6}$/.test(v || ''); }
  function lum(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  var THEME_VARS = ['--accent', '--accent-ink', '--bg', '--surface', '--ink', '--muted', '--line', '--tint', '--hero-a', '--hero-b', '--hero-c', '--bg-img', '--ov'];
  function applyTheme() {
    var st = document.documentElement.style;
    THEME_VARS.forEach(function (k) { st.removeProperty(k); });
    var any = false;
    if (isHex(state.accent)) {
      any = true;
      st.setProperty('--accent', state.accent);
      st.setProperty('--accent-ink', lum(state.accent) > 0.55 ? '#1B1B1B' : '#FFFFFF');
      st.setProperty('--hero-a', 'color-mix(in srgb, ' + state.accent + ' 40%, #0B1620)');
      st.setProperty('--hero-b', 'color-mix(in srgb, ' + state.accent + ' 70%, #0B1620)');
      st.setProperty('--hero-c', state.accent);
    }
    if (isHex(state.pageBg)) st.setProperty('--bg', state.pageBg);
    if (isHex(state.cardBg)) { any = true; st.setProperty('--surface', state.cardBg); }
    if (isHex(state.textColor)) { any = true; st.setProperty('--ink', state.textColor); }
    if (any) {
      st.setProperty('--tint', 'color-mix(in srgb, var(--accent) 7%, var(--surface))');
      st.setProperty('--line', 'color-mix(in srgb, var(--ink) 16%, var(--surface))');
      st.setProperty('--muted', 'color-mix(in srgb, var(--ink) 62%, var(--surface))');
    }
    var bg = state.images.bg;
    document.body.classList.toggle('has-bg', !!bg);
    if (bg) {
      st.setProperty('--bg-img', 'url("' + bg + '")');
      var ov = parseInt(state.overlay, 10); if (isNaN(ov)) ov = 88;
      st.setProperty('--ov', Math.max(40, Math.min(100, ov)) + '%');
    }
  }

  /* ===== Hiệu ứng rơi: cánh hoa, trái tim, lấp lánh ===== */
  var fx = { cv: null, ctx: null, parts: [], burst: [], raf: 0, type: 'none', color: '#A64B63', w: 0, h: 0, dpr: 1, applied: '' };
  function fxResize() {
    if (!fx.cv) return;
    fx.dpr = Math.min(2, window.devicePixelRatio || 1); fx.w = window.innerWidth; fx.h = window.innerHeight;
    fx.cv.width = Math.round(fx.w * fx.dpr); fx.cv.height = Math.round(fx.h * fx.dpr);
    fx.cv.style.width = fx.w + 'px'; fx.cv.style.height = fx.h + 'px';
    fx.ctx.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
  }
  function newPart(initial) {
    var spark = fx.type === 'sparkle';
    return { x: Math.random() * fx.w, y: initial ? Math.random() * fx.h : -20 - Math.random() * 80,
      vy: (spark ? 0.25 : 0.5) + Math.random() * (spark ? 0.5 : 1.1), sw: Math.random() * 6.28, swv: 0.01 + Math.random() * 0.02,
      amp: 0.4 + Math.random() * 0.9, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.03,
      s: spark ? 3 + Math.random() * 4 : 7 + Math.random() * 8, a: 0.45 + Math.random() * 0.45, hl: Math.random() < 0.35, tw: Math.random() * 6.28 };
  }
  function shape(c, type, s) {
    c.beginPath();
    if (type === 'heart') {
      c.moveTo(0, s * 0.5); c.bezierCurveTo(-s * 1.1, -s * 0.3, -s * 0.5, -s * 1.0, 0, -s * 0.4);
      c.bezierCurveTo(s * 0.5, -s * 1.0, s * 1.1, -s * 0.3, 0, s * 0.5);
    } else if (type === 'sparkle') {
      c.moveTo(0, -s * 1.6); c.quadraticCurveTo(s * 0.18, -s * 0.18, s * 1.6, 0); c.quadraticCurveTo(s * 0.18, s * 0.18, 0, s * 1.6);
      c.quadraticCurveTo(-s * 0.18, s * 0.18, -s * 1.6, 0); c.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s * 1.6);
    } else {
      c.moveTo(0, -s); c.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.7, 0, s); c.bezierCurveTo(-s * 0.7, s * 0.7, -s * 0.9, -s * 0.6, 0, -s);
    }
    c.closePath();
  }
  function drawPart(p, alpha) {
    var c = fx.ctx; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = alpha;
    c.fillStyle = fx.type === 'sparkle' ? '#F6D98B' : (p.hl ? '#FFFFFF' : fx.color);
    if (fx.type === 'sparkle') c.globalAlpha = alpha * (0.55 + 0.45 * Math.sin(p.tw));
    shape(c, fx.type, p.s);
    c.fill();
    if (fx.type === 'petal' && !p.hl) { c.globalAlpha = alpha * 0.35; c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(-p.s * 0.2, -p.s * 0.3, p.s * 0.25, p.s * 0.5, 0.4, 0, 6.28); c.fill(); }
    c.restore();
  }
  function fxLoop() {
    fx.raf = 0;
    if (!fx.cv || document.hidden) return;
    fx.ctx.clearRect(0, 0, fx.w, fx.h);
    fx.parts.forEach(function (p) {
      p.y += p.vy; p.sw += p.swv; p.x += Math.sin(p.sw) * p.amp; p.r += p.vr; p.tw += 0.06;
      if (p.y > fx.h + 24) { Object.assign(p, newPart(false)); }
      drawPart(p, p.a);
    });
    for (var i = fx.burst.length - 1; i >= 0; i--) {
      var b = fx.burst[i]; b.vy += 0.14; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life -= 0.011; b.tw += 0.1;
      if (b.life <= 0 || b.y > fx.h + 30) { fx.burst.splice(i, 1); continue; }
      drawPart(b, Math.min(1, b.life) * 0.95);
    }
    if (fx.type !== 'none' || fx.burst.length) fx.raf = requestAnimationFrame(fxLoop);
  }
  function fxKick() { if (!fx.raf && fx.cv && !document.hidden) fx.raf = requestAnimationFrame(fxLoop); }
  function fxSet(type) {
    if (reduced) type = 'none';
    var col = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#A64B63';
    fx.color = col;
    if (type === fx.applied) return;
    fx.applied = type; fx.type = type;
    if (type === 'none') { fx.parts = []; if (fx.ctx) fx.ctx.clearRect(0, 0, fx.w, fx.h); return; }
    if (!fx.cv) {
      fx.cv = document.createElement('canvas'); fx.cv.setAttribute('aria-hidden', 'true');
      fx.cv.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:5';
      document.body.append(fx.cv); fx.ctx = fx.cv.getContext('2d'); fxResize();
      window.addEventListener('resize', fxResize);
      document.addEventListener('visibilitychange', fxKick);
    }
    var n = fx.w < 600 ? 16 : 28; if (type === 'sparkle') n = fx.w < 600 ? 22 : 38;
    fx.parts = []; for (var i = 0; i < n; i++) fx.parts.push(newPart(true));
    fxKick();
  }
  function fxPuff(x, y) {
    for (var i = 0; i < 10; i++) {
      var a = Math.random() * 6.28, sp = 1.5 + Math.random() * 3.5, p = newPart(false);
      p.x = x; p.y = y; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 1.5; p.vr = (Math.random() - 0.5) * 0.2;
      p.life = 0.8 + Math.random() * 0.5; p.s = fx.type === 'sparkle' ? 2.5 + Math.random() * 3 : 5 + Math.random() * 5;
      fx.burst.push(p);
    }
    fxKick();
  }
  function initPuff() {
    document.addEventListener('click', function (e) {
      if (reduced || fx.type === 'none' || !fx.cv) return;
      if (e.target.closest && e.target.closest('a,button,input,select,textarea,label,iframe')) return;
      fxPuff(e.clientX, e.clientY);
    });
  }
  function initPointer() {
    var last = 0;
    document.addEventListener('pointermove', function (e) {
      if (reduced || fx.type === 'none' || !fx.cv || e.pointerType !== 'mouse' || fx.burst.length > 150) return;
      var n = performance.now(); if (n - last < 45) return; last = n;
      var p = newPart(false);
      p.x = e.clientX; p.y = e.clientY; p.vx = (Math.random() - 0.5) * 1.2; p.vy = (Math.random() - 0.2) * 1.2; p.vr = (Math.random() - 0.5) * 0.2;
      p.life = 0.7; p.s = fx.type === 'sparkle' ? 2.5 + Math.random() * 2.5 : 4 + Math.random() * 4;
      fx.burst.push(p); fxKick();
    });
    var arch = $('.arch');
    if (arch && !reduced) {
      arch.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = arch.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        arch.style.transform = 'perspective(700px) rotateY(' + (x * 10) + 'deg) rotateX(' + (-y * 10) + 'deg)';
      });
      arch.addEventListener('pointerleave', function () { arch.style.transform = ''; });
    }
  }
  function initScroll() {
    var bar = document.createElement('div'); bar.id = 'progress'; bar.setAttribute('aria-hidden', 'true'); document.body.append(bar);
    var hero = $('.hero .slot'), pending = false;
    function upd() {
      pending = false;
      var h = document.documentElement.scrollHeight - window.innerHeight, y = window.scrollY || 0;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
      if (hero && !reduced) hero.style.setProperty('--py', Math.max(0, Math.min(40, y * 0.25)) + 'px');
    }
    window.addEventListener('scroll', function () { if (!pending) { pending = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }
  function fxBurst() {
    if (reduced || fx.type === 'none' || !fx.cv) return;
    var cx = fx.w / 2, cy = fx.h * 0.62;
    for (var i = 0; i < 70; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, sp = 5 + Math.random() * 9, p = newPart(false);
      p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.vr = (Math.random() - 0.5) * 0.25;
      p.life = 1.2 + Math.random() * 0.8; p.s = fx.type === 'sparkle' ? 3 + Math.random() * 4 : 6 + Math.random() * 8;
      fx.burst.push(p);
    }
    fxKick();
  }

  /* ===== Hiện dần khi cuộn ===== */
  function countUp(el, to) {
    if (reduced) return;
    var t0 = performance.now(), dur = 900;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pad(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function initReveal() {
    if (reduced || !('IntersectionObserver' in window)) return;
    var sel = '.sec > *, .arch, .album .slot, .facts > div, .count > div, .pair > div, .family > div, .gift, .thanks > *';
    var els = $$(sel).filter(function (el, i, arr) { return arr.indexOf(el) === i; });
    els.forEach(function (el) {
      var sib = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.classList.add('rv'); el.style.setProperty('--d', Math.min(sib, 6) * 70 + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var el = e.target;
        if (e.isIntersecting) {
          if (el.classList.contains('in')) return;
          el.classList.add('in');
          if (el.id === 'dayNum') { var d = parseDate(state.date); if (d) countUp(el, d.d); }
        } else {
          /* rời khỏi màn hình: ẩn lại, và lần sau vào sẽ trượt từ đúng phía đó */
          el.style.setProperty('--ty', (e.boundingClientRect.top < 0 ? -28 : 28) + 'px');
          el.classList.remove('in');
        }
      });
    }, { threshold: 0.1, rootMargin: '-5% 0px -5% 0px' });
    els.forEach(function (el) { io.observe(el); });
    document.body.classList.add('rv-on');
  }

  /* ===== Nhạc nền ===== */
  var bgm = { a: null, src: '' };
  function musicSync() {
    var btn = $('#musicBtn'), src = state.music || '';
    if (!src) { if (bgm.a) bgm.a.pause(); bgm.src = ''; btn.hidden = true; return; }
    if (!bgm.a) {
      bgm.a = new Audio(); bgm.a.loop = true; bgm.a.volume = 0.7; bgm.a.preload = 'none';
      bgm.a.addEventListener('play', function () { btn.classList.add('playing'); btn.setAttribute('aria-pressed', 'true'); });
      bgm.a.addEventListener('pause', function () { btn.classList.remove('playing'); btn.setAttribute('aria-pressed', 'false'); });
    }
    if (bgm.src !== src) { var was = !bgm.a.paused; bgm.a.src = src; bgm.src = src; if (was) bgm.a.play().catch(function () {}); }
    btn.title = state.musicName ? 'Nhạc nền: ' + state.musicName : 'Nhạc nền';
    btn.hidden = !(isPreview || document.body.classList.contains('opened'));
  }
  function initMusic() {
    $('#musicBtn').addEventListener('click', function () {
      if (!bgm.a) return;
      if (bgm.a.paused) bgm.a.play().catch(function () { toast('Trình duyệt chưa cho phát nhạc, hãy bấm lại.'); });
      else bgm.a.pause();
    });
  }

  var mapQ = null, mapT = 0;
  function setMap(q) {
    if (q === mapQ) return;
    var first = mapQ === null; mapQ = q;
    clearTimeout(mapT);
    var go = function () { $('#mapFrame').src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed'; };
    if (first) go(); else mapT = setTimeout(go, 600);
  }

  function render() {
    applyTheme();
    $$('[data-t]:not([data-lines])').forEach(function (el) { el.textContent = state[el.dataset.t] || ''; });
    $$('[data-lines]').forEach(function (el) {
      var t = state[el.dataset.t] || '';
      if (el.dataset.built === t) return;
      el.textContent = '';
      t.split('\n').forEach(function (l, i) { var s = document.createElement('span'); s.className = 'ln'; s.style.setProperty('--i', i); s.textContent = l || '\u00a0'; el.append(s); });
      el.dataset.built = t;
    });
    var dt = parseDate(state.date);
    $('#heroDate').textContent = dt ? pad(dt.d) + ' · ' + pad(dt.mo) + ' · ' + dt.y : '';
    $('#dayNum').textContent = dt ? pad(dt.d) : '--';
    $('#dayMonth').textContent = dt ? 'Tháng ' + dt.mo + ' ' + dt.y : '';
    $('#dayWeek').textContent = dt ? dt.wd : '';
    var tl = $('#timeLine');
    tl.textContent = 'Đón khách ' + state.receptionTime + ' · Khai tiệc ' + state.startTime;
    var small = document.createElement('small'); small.textContent = dt ? dt.wd + ', ' + dt.txt : ''; tl.append(small);
    var rd = parseDate(state.rsvpDeadline); $('#rsvpDate').textContent = rd ? rd.txt : '';
    $('#dressRow').hidden = !(state.dress || '').trim();
    $('#giftSec').hidden = !(state.bankAcc || '').trim();
    var place = (state.venue + ' ' + state.address).trim();
    var q = (state.mapQuery || '').trim() || place;
    var ml = (state.mapLink || '').trim();
    $('#mapLink').href = /^https?:\/\//i.test(ml) ? ml : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    setMap(q);
    var digits = (state.contactPhone || '').replace(/\D/g, '');
    $('#zaloLink').href = digits ? 'https://zalo.me/' + digits : '#';
    if (dt) {
      var start = new Date(state.date + 'T' + state.receptionTime + ':00+07:00');
      if (!isNaN(start)) {
        var end = new Date(start.getTime() + 4 * 3600 * 1000);
        $('#calLink').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
          encodeURIComponent('Đám cưới ' + state.groomName + ' & ' + state.brideName) +
          '&dates=' + gcal(start) + '/' + gcal(end) +
          '&details=' + encodeURIComponent('Đón khách ' + state.receptionTime + ', khai tiệc ' + state.startTime) +
          '&location=' + encodeURIComponent(place);
      }
    }
    document.title = state.groomName + ' & ' + state.brideName;
    $$('.slot[data-img]').forEach(function (el) {
      var src = state.images[el.dataset.img];
      el.classList.toggle('empty', !src);
      el.style.backgroundImage = src ? 'url("' + src + '")' : '';
    });
    fxSet(state.effect || 'none');
    musicSync();
    tick();
  }

  function setNum(sel, v) {
    var el = $(sel); if (el.textContent === v) return;
    el.textContent = v;
    if (!reduced && el.dataset.set) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    el.dataset.set = '1';
  }
  function tick() {
    var target = new Date(state.date + 'T' + state.startTime + ':00+07:00').getTime();
    var s = Math.floor((isNaN(target) ? 0 : Math.max(0, target - Date.now())) / 1000);
    setNum('#cd', pad(Math.floor(s / 86400)));
    setNum('#ch', pad(Math.floor(s % 86400 / 3600)));
    setNum('#cm', pad(Math.floor(s % 3600 / 60)));
    setNum('#cs', pad(s % 60));
  }

  var tt;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(tt); tt = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function copyText(text, okMsg) {
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      t.remove(); toast(ok ? okMsg : 'Không sao chép được, hãy chọn và sao chép thủ công.');
    }
    try { navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); } catch (e) { fallback(); }
  }

  function initRsvp() {
    var lastMsg = '';
    $('#rsvpForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var dt = parseDate(state.date), note = $('#gNote').value.trim();
      lastMsg = 'Xác nhận tham dự tiệc cưới ' + state.groomName + ' & ' + state.brideName + (dt ? ' ngày ' + dt.txt : '') +
        '\nHọ tên: ' + $('#gName').value.trim() + '\nSố người: ' + $('#gCount').value + (note ? '\nLời chúc: ' + note : '');
      $('#rsvpText').textContent = lastMsg; $('#rsvpDone').hidden = false;
      var br = $('#rsvpForm button[type=submit]').getBoundingClientRect();
      for (var k = 0; k < 4; k++) fxPuff(br.left + br.width / 2, br.top + br.height / 2);
      copyText(lastMsg, 'Đã sao chép lời xác nhận');
    });
    $('#copyAgain').addEventListener('click', function () { copyText(lastMsg, 'Đã sao chép lời xác nhận'); });
    $('#copyAcc').addEventListener('click', function () { copyText((state.bankAcc || '').replace(/\s/g, ''), 'Đã sao chép số tài khoản'); });
  }

  var isPreview = /[?&]preview\b/.test(location.search);
  function show() { document.body.classList.remove('loading'); }
  function initSeal() {
    if (isPreview) return;
    document.body.classList.add('sealed');
    $('#openBtn').addEventListener('click', function (e) {
      e.preventDefault();
      document.body.classList.remove('sealed'); document.body.classList.add('opened');
      fxBurst();
      musicSync();
      if (bgm.a) bgm.a.play().catch(function () {});
      var t = $('#ngay'); if (t) t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function boot() {
    initSeal();
    initMusic();
    initRsvp();
    initReveal();
    initScroll();
    initPuff();
    initPointer();
    setInterval(tick, 1000);
    window.addEventListener('message', function (e) {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'config') return;
      state = merge(e.data.config); render(); show();
    });
    if (isPreview) {
      if (window.parent !== window) window.parent.postMessage({ type: 'ready' }, location.origin);
      return;
    }
    fetch('config.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (c) { state = merge(c); render(); show(); });
  }
  boot();
})();
