/* Thiệp cưới: đọc config.json rồi hiển thị. Cũng nhận bản xem trước từ admin.html qua postMessage. */
(function () {
  var DEFAULTS = window.INVITE_DEFAULTS;

  var WEEK = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
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

  function render() {
    $$('[data-t]').forEach(function (el) { el.textContent = state[el.dataset.t] || ''; });
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
    $('#mapLink').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);
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
    tick();
  }

  function tick() {
    var target = new Date(state.date + 'T' + state.startTime + ':00+07:00').getTime();
    var s = Math.floor((isNaN(target) ? 0 : Math.max(0, target - Date.now())) / 1000);
    $('#cd').textContent = pad(Math.floor(s / 86400));
    $('#ch').textContent = pad(Math.floor(s % 86400 / 3600));
    $('#cm').textContent = pad(Math.floor(s % 3600 / 60));
    $('#cs').textContent = pad(s % 60);
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
      copyText(lastMsg, 'Đã sao chép lời xác nhận');
    });
    $('#copyAgain').addEventListener('click', function () { copyText(lastMsg, 'Đã sao chép lời xác nhận'); });
    $('#copyAcc').addEventListener('click', function () { copyText((state.bankAcc || '').replace(/\s/g, ''), 'Đã sao chép số tài khoản'); });
  }

  function show() { document.body.classList.remove('loading'); }
  var isPreview = /[?&]preview\b/.test(location.search);
  function initSeal() {
    if (isPreview) return;
    document.body.classList.add('sealed');
    $('#openBtn').addEventListener('click', function (e) {
      e.preventDefault();
      document.body.classList.remove('sealed'); document.body.classList.add('opened');
      var t = $('#ngay'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function boot() {
    initSeal();
    initRsvp();
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
