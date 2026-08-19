/* ============================================================================
   NEXUS LAUNCHER — LOI: cau hinh, cau noi Python, tang media Steam, hook, icon
   File nay chay TRUOC moi file JSX khac. Xuat ra window.NX.*
   ========================================================================== */

(function () {
  'use strict';

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

/* ----------------------------------------------------------------------------
   0. NGON NGU
   js/i18n.js chay truoc file nay nen window.NXI18N chac chan da co. Van de mot
   ban du phong: neu vi ly do nao do no khong nap duoc thi ca giao dien van chay
   binh thuong bang tieng Viet thay vi trang trang.
   -------------------------------------------------------------------------- */

const I18N = window.NXI18N || {
  LANGS: [{ code: 'vi', label: 'Tiếng Việt', short: 'VI', steam: 'vietnamese', html: 'vi', flag: '🇻🇳' }],
  t: function (s) { return s; },
  get: function () { return 'vi'; },
  info: function () { return { code: 'vi', label: 'Tiếng Việt', short: 'VI', steam: 'vietnamese', html: 'vi', flag: '🇻🇳' }; },
  set: function () {},
  subscribe: function () { return function () {}; }
};

/* TX('cau tieng Viet') -> cau do theo ngon ngu dang chon.
   TX('Xem mục {n}', { n: 3 }) -> thay cho cho cac o {…}. */
function TX(s, vars) { return I18N.t(s, vars); }

/* Goi trong mot thanh phan React de no tu ve lai khi nguoi dung doi ngon ngu */
function useLang() {
  const [, bump] = useState(0);
  useEffect(function () {
    return I18N.subscribe(function () { bump(function (n) { return n + 1; }); });
  }, []);
  return I18N.get();
}

/* ----------------------------------------------------------------------------
   DAU SAC THAI CHO CAU THONG BAO
   Truoc day mau cua o thong bao duoc doan bang cach do xem cau chu co chua tu
   'Lỗi' hay 'Thành Công' hay khong. Cach do chi dung khi giao dien mai mai la
   tieng Viet. Nay moi cau thong bao mang san mot ky tu vo hinh o dau de noi ro
   no la loi hay thanh cong; cach do tu ra khong bao gio doc nham nua.
   -------------------------------------------------------------------------- */

const TONE_MARK = { bad: '\u0001', ok: '\u0002', warn: '\u0003', info: '\u0004' };
const MARK_RE = /^[\u0001-\u0004]/;

/* Gan dau sac thai vao dau cau */
function tagTone(tone, msg) {
  const s = msg === null || msg === undefined ? '' : String(msg);
  if (!s || MARK_RE.test(s)) return s;
  return (TONE_MARK[tone] || '') + s;
}

/* Doc dau sac thai. Khong co dau thi tra ve null de noi goi tu doan lay. */
function markedTone(msg) {
  const s = String(msg || '');
  const c = s.charAt(0);
  if (c === TONE_MARK.bad) return 'bad';
  if (c === TONE_MARK.ok) return 'ok';
  if (c === TONE_MARK.warn) return 'warn';
  if (c === TONE_MARK.info) return 'info';
  return null;
}

/* Bo dau sac thai truoc khi hien ra man hinh */
function stripTone(msg) {
  return String(msg === null || msg === undefined ? '' : msg).replace(MARK_RE, '');
}

/* ----------------------------------------------------------------------------
   1. HANG SO
   -------------------------------------------------------------------------- */

const APP_VERSION = '3.0.0';
const DISCORD_URL = 'https://discord.gg/fsQW3FaNnG';

/* CDN anh cua Steam — dat theo do tin cay giam dan */
const CDN_ITEM  = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';
const CDN_CF    = 'https://cdn.cloudflare.steamstatic.com/steam/apps';
const CDN_AK    = 'https://cdn.akamai.steamstatic.com/steam/apps';

/* Anh du phong cuoi cung: SVG noi tuyen — khong phu thuoc mang, khong bao gio hong */
const PLACEHOLDER =
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="215" viewBox="0 0 460 215">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#141b2b"/><stop offset="1" stop-color="#0b1018"/></linearGradient></defs>' +
    '<rect width="460" height="215" fill="url(#g)"/>' +
    '<g fill="none" stroke="#2a3550" stroke-width="2">' +
    '<circle cx="230" cy="98" r="26"/><path d="M215 98h30M230 83v30"/></g>' +
    '<text x="230" y="152" fill="#3d4a66" font-family="sans-serif" font-size="13" ' +
    'font-weight="700" letter-spacing="3" text-anchor="middle">NEXUS</text></svg>'
  );

/* Danh sach game co che do truc tuyen (giu nguyen tu ban cu) */
const ONLINE_TITLES = [
  'the forest', '7 days to die', 'stardew valley', 'among us', 'sons of the forest',
  'palworld', 'escape the backrooms', 'inside the backrooms', 'backrooms: escape together',
  'climb the backrooms', 'meccha chameleon', 'raft', 'rv there yet?'
];

/* Khong ho tro Cloud Save (giu nguyen tu ban cu) */
const NO_CLOUD_TITLES = [
  "assassin's creed 2", 'assassin’s creed 2', "assassin's creed ii",
  "assassin's creed revelations", "assassin's creed® revelations"
];
const NO_CLOUD_APPIDS = ['33230', '201870'];

/* Game tai qua nguon rieng (khong qua Steam) */
const CUSTOM_APPIDS = ['201870', '33230'];

const PLATFORMS = [
  { id: 'mienphi', label: 'MIỄN PHÍ', ico: 'ph-bold ph-gift',          tone: 'var(--ok)'      },
  { id: 'steam',   label: 'STEAM',    ico: 'fa-brands fa-steam',        tone: 'var(--c-steam)' },
  { id: 'battle',  label: 'BATTLE',   ico: 'fa-brands fa-battle-net',   tone: 'var(--c-battle)'},
  { id: 'eaplay',  label: 'EA PLAY',  ico: 'ph-bold ph-lightning',      tone: 'var(--c-ea)'    },
  { id: 'uplay',   label: 'UPLAY',    ico: 'ph-bold ph-spiral',         tone: 'var(--c-uplay)' },
  { id: 'epic',    label: 'EPIC',     ico: 'ph-bold ph-shield-star',    tone: 'var(--c-epic)'  }
];

/* ----------------------------------------------------------------------------
   2. CAU NOI PYTHON (pywebview)
   Moi loi goi deu qua callApi() -> khong bao gio nem loi lam trang trang.
   Neu 5.py chua co method do, tra ve {__missing:true} de UI bao "chua kha dung".
   -------------------------------------------------------------------------- */

function pyApi() {
  return (window.pywebview && window.pywebview.api) || null;
}

function hasApi(name) {
  const a = pyApi();
  return !!(a && typeof a[name] === 'function');
}

async function callApi(name, ...args) {
  const a = pyApi();
  if (!a || typeof a[name] !== 'function') {
    return { success: false, __missing: true, error: tagTone('bad', TX('Chức năng chưa khả dụng trong phiên bản này.')) };
  }
  try {
    const r = await a[name](...args);
    if (r === null || r === undefined) return { success: false, error: tagTone('bad', TX('Không nhận được phản hồi.')) };
    if (typeof r === 'string') { try { return JSON.parse(r); } catch (e) { return { success: false, error: r }; } }
    return r;
  } catch (err) {
    return { success: false, error: (err && err.message) ? err.message : String(err) };
  }
}

/* Doc thuoc tinh dong bo do Python day sang (vd cloud_save_precheck) */
function apiProp(name) {
  const a = pyApi();
  if (!a) return undefined;
  const v = a[name];
  return typeof v === 'function' ? undefined : v;
}

function openExternal(url) {
  if (!url) return;
  if (hasApi('open_external')) { callApi('open_external', url); return; }
  try { window.open(url, '_blank', 'noopener'); } catch (e) { /* bo qua */ }
}

/* ----------------------------------------------------------------------------
   3. TIEN ICH
   -------------------------------------------------------------------------- */

/* "93.08%" -> 93.08 ; "" -> null */
function pctNum(p) {
  if (p === null || p === undefined) return null;
  const n = parseFloat(String(p).replace('%', '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

/* Phan loai danh gia theo diem — KHONG bao gio in dau tru truoc phan tram.
   Ban cu render "-{percent}" nen game 59.94% hien ra "-59.94%". Da bo. */
function reviewTone(percent, text) {
  const n = pctNum(percent);
  if (n !== null) {
    if (n >= 70) return 'pos';
    if (n >= 40) return 'mix';
    return 'neg';
  }
  const t = String(text || '').toUpperCase();
  if (t.includes('TIÊU CỰC')) return 'neg';
  if (t.includes('ĐA DẠNG') || t.includes('TRÁI CHIỀU')) return 'mix';
  if (t.includes('TÍCH CỰC')) return 'pos';
  return 'mix';
}

const TONE_ICON = { pos: 'ph-fill ph-thumbs-up', mix: 'ph-fill ph-scales', neg: 'ph-fill ph-thumbs-down' };

/* "1.148.645 đánh giá" -> 1148645 */
function reviewCountNum(s) {
  if (!s) return 0;
  const digits = String(s).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function fmtCount(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace('.0', '') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'K';
  return String(n);
}

function fmtBytes(b) {
  if (!b || b <= 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 100 || i < 2 ? 0 : 1) + ' ' + u[i];
}

/* Bo ky tu thuong hieu de sap xep A-Z cho dung */
function sortKey(title) {
  return String(title || '').toLowerCase().replace(/[™®©]/g, '').trim();
}

function getGamePlatform(game) {
  if (game && game.platform) return game.platform;
  if (game && game.title && /Assassin['’‘]s/i.test(game.title)) return 'uplay';
  return 'steam';
}

function isOnlineGame(game) {
  return ONLINE_TITLES.includes(String(game.title || '').toLowerCase());
}

function hasCloudSave(game) {
  const t = String(game.title || '').toLowerCase();
  if (NO_CLOUD_TITLES.includes(t)) return false;
  if (NO_CLOUD_APPIDS.includes(String(game.appId))) return false;
  return true;
}

function customAppIdOf(game) {
  return CUSTOM_APPIDS.includes(String(game.appId)) ? String(game.appId) : null;
}

/* ----------------------------------------------------------------------------
   4. NGUON ANH — chuoi du phong nhieu tang, luon ket thuc bang PLACEHOLDER
   -------------------------------------------------------------------------- */

function coverSources(appId) {
  const m = window.STEAM_MEDIA && window.STEAM_MEDIA[String(appId)];
  const out = [];
  if (m && m.header_image) out.push(m.header_image);
  out.push(
    CDN_ITEM + '/' + appId + '/header.jpg',
    CDN_CF   + '/' + appId + '/header.jpg',
    CDN_AK   + '/' + appId + '/header.jpg',
    CDN_ITEM + '/' + appId + '/capsule_616x353.jpg',
    CDN_ITEM + '/' + appId + '/library_hero.jpg',
    PLACEHOLDER
  );
  return out.filter((v, i, a) => v && a.indexOf(v) === i);
}

function heroSources(appId) {
  return [
    CDN_ITEM + '/' + appId + '/library_hero.jpg',
    CDN_ITEM + '/' + appId + '/page_bg_generated_v6b.jpg',
    CDN_CF   + '/' + appId + '/page.bg.jpg',
    CDN_ITEM + '/' + appId + '/header.jpg',
    CDN_CF   + '/' + appId + '/header.jpg',
    PLACEHOLDER
  ];
}

/* ----------------------------------------------------------------------------
   5. TANG MEDIA STEAM
   Thu tu nguon: bo nho -> sessionStorage -> Python -> serverless.
   Gop cac loi goi trung appId (inflight) de khong ban 2 request cung luc.
   -------------------------------------------------------------------------- */

const SS_PREFIX = 'nx_media_v5_';
const memMedia = new Map();
const inflight = new Map();

/* Dua moi hinh dang du lieu ve cung 1 khuon */
function normalizeMedia(raw) {
  if (!raw || typeof raw !== 'object') return null;

  let items = [];
  if (Array.isArray(raw.items) && raw.items.length) {
    /* Khuon moi: giu Y NGUYEN thu tu Steam tra ve */
    items = raw.items.map(it => ({
      type: it.type === 'movie' || it.type === 'video' ? 'video' : 'image',
      src: it.src || '',
      thumb: it.thumb || ''
    })).filter(m => m.src);
  } else {
    /* Khuon cu: movies[] + screenshots[] — 2 trailer dau, roi anh, roi trailer con lai */
    const movies = Array.isArray(raw.movies) ? raw.movies : [];
    const shots  = Array.isArray(raw.screenshots) ? raw.screenshots : [];
    movies.slice(0, 2).forEach(m => items.push({ type: 'video', src: m.src || '', thumb: m.thumb || '' }));
    shots.forEach(s => {
      const full = typeof s === 'string' ? s : (s && (s.path_full || s.src)) || '';
      if (full) items.push({ type: 'image', src: full, thumb: (s && s.path_thumbnail) || full });
    });
    movies.slice(2).forEach(m => items.push({ type: 'video', src: m.src || '', thumb: m.thumb || '' }));
    items = items.filter(m => m.src);
  }

  if (!items.length && !raw.sysreq && !raw.sysreq_rec && !raw.short_description) return null;

  return {
    items,
    header_image: raw.header_image || '',
    background:   raw.background || '',
    sysreq:       raw.sysreq || null,
    sysreq_rec:   raw.sysreq_rec || null,
    desc:         raw.short_description || raw.desc || '',
    about:        raw.about || '',
    // Mang khoi co cau truc (tieu de / doan / danh sach / anh / anh dong)
    about_rich:   Array.isArray(raw.about_rich) ? raw.about_rich : null,
    about_lang:   raw.about_lang || '',
    desc_lang:    raw.desc_lang || '',
    developers:   Array.isArray(raw.developers) ? raw.developers : [],
    publishers:   Array.isArray(raw.publishers) ? raw.publishers : [],
    release:      raw.release_date || raw.release || '',
    genres:       Array.isArray(raw.genres) ? raw.genres : [],
    metacritic:   raw.metacritic || null
  };
}

function readSS(appId) {
  try {
    const s = sessionStorage.getItem(SS_PREFIX + appId);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

function writeSS(appId, data) {
  try { sessionStorage.setItem(SS_PREFIX + appId, JSON.stringify(data)); }
  catch (e) { /* het cho -> bo qua, van con bo nho */ }
}

/* Ten ngon ngu ma Steam hieu — dung cho tham so ?l= cua appdetails. */
const STEAM_L = { vi: 'vietnamese', en: 'english', ja: 'japanese', es: 'spanish', fr: 'french' };

/* Doi ngon ngu thi the loai, ngay phat hanh va bang cau hinh cung phai doi theo,
   nen kho nho phai kem ma ngon ngu. Ban Python chua biet nhan tham so ngon ngu
   nen chi dung no cho tieng Viet; cac thu tieng khac di qua ham tren Vercel. */
function fetchMedia(appId, lang) {
  const lg = STEAM_L[lang] ? lang : 'vi';
  const id = String(appId);
  const key = lg + ':' + id;
  if (memMedia.has(key)) return Promise.resolve(memMedia.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const cached = readSS(key);
  if (cached) { memMedia.set(key, cached); return Promise.resolve(cached); }

  const job = (async () => {
    /* Nguon 1: Python — nhanh nhat, khong vuong CORS, du 100% trailer */
    if (lg === 'vi' && hasApi('get_steam_media')) {
      const r = await callApi('get_steam_media', id);
      const n = normalizeMedia(r && r.data ? r.data : r);
      if (n) { memMedia.set(key, n); writeSS(key, n); return n; }
    }
    /* Nguon 2: ham serverless tren Vercel */
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 6000);
      const res = await fetch('/api/steammedia?appid=' + id + '&l=' + STEAM_L[lg], { signal: ac.signal });
      clearTimeout(to);
      if (res.ok) {
        const n = normalizeMedia(await res.json());
        if (n) { memMedia.set(key, n); writeSS(key, n); return n; }
      }
    } catch (e) { /* mat mang / qua han -> dung du lieu cung */ }
    memMedia.set(key, null);
    return null;
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

/* ----------------------------------------------------------------------------
   BAN DICH MO TA
   Steam chi co trang tieng Viet cho mot so game. Voi phan con lai, ham
   serverless /api/translate se dich va Vercel cache lai — nen lan mo thu hai
   cua bat ky ai cung gan nhu tuc thi. Hong mang thi im lang giu ban goc.
   -------------------------------------------------------------------------- */

const TR_PREFIX = 'nx_tr_v3_';
const memTr = new Map();
const trInflight = new Map();

/* Moi ngon ngu co mot ban dich rieng nen khoa nho phai kem ma ngon ngu, neu
   khong thi doi sang tieng Nhat van se thay ban tieng Viet cu nam trong bo nho. */
function fetchTranslation(appId, lang) {
  const lg = lang || I18N.get();
  const key = lg + ':' + String(appId);
  if (memTr.has(key)) return Promise.resolve(memTr.get(key));
  if (trInflight.has(key)) return trInflight.get(key);

  try {
    const cached = sessionStorage.getItem(TR_PREFIX + key);
    if (cached) {
      const v = JSON.parse(cached);
      memTr.set(key, v);
      return Promise.resolve(v);
    }
  } catch (e) { /* bo qua */ }

  const job = (async () => {
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 20000);
      const res = await fetch('/api/translate?appid=' + String(appId) + '&to=' + lg, { signal: ac.signal });
      clearTimeout(to);
      if (res.ok) {
        const d = await res.json();
        if (d && d.lang === lg && (d.about || (d.about_rich && d.about_rich.length))) {
          memTr.set(key, d);
          try { sessionStorage.setItem(TR_PREFIX + key, JSON.stringify(d)); } catch (e) {}
          return d;
        }
      }
    } catch (e) { /* mat mang -> giu ban goc */ }
    memTr.set(key, null);
    return null;
  })().finally(() => trInflight.delete(key));

  trInflight.set(key, job);
  return job;
}

/* Dung du lieu cung (STEAM_MEDIA) lam nen, phu du lieu song len tren.
   Luon tra ve it nhat 1 phan tu -> san khau media khong bao gio trong. */
function buildMedia(appId, live) {
  const out = [];
  if (live && live.items && live.items.length) {
    live.items.forEach((it, i) => out.push({
      type: it.type, src: it.src, thumb: it.thumb || '', key: it.type + i
    }));
  }
  if (!out.length) {
    const d = window.STEAM_MEDIA && window.STEAM_MEDIA[String(appId)];
    if (d) {
      const movies = d.movies || [];
      const shots  = d.screenshots || [];
      movies.slice(0, 2).forEach((m, i) => out.push({ type: 'video', src: m.src, thumb: m.thumb || '', key: 'v' + i }));
      shots.forEach((s, i) => {
        const full = typeof s === 'string' ? s : (s && s.path_full) || '';
        if (full) out.push({ type: 'image', src: full, thumb: full, key: 'ss' + i });
      });
      movies.slice(2).forEach((m, i) => out.push({ type: 'video', src: m.src, thumb: m.thumb || '', key: 'v' + (i + 2) }));
    }
  }
  if (!out.length) {
    [
      CDN_ITEM + '/' + appId + '/library_hero.jpg',
      CDN_ITEM + '/' + appId + '/header.jpg',
      CDN_ITEM + '/' + appId + '/library_600x900.jpg',
      CDN_CF   + '/' + appId + '/capsule_616x353.jpg'
    ].forEach((src, i) => out.push({ type: 'image', src, thumb: src, key: 'fb' + i }));
  }
  return out.filter(m => m.src);
}

/* ----------------------------------------------------------------------------
   6. CAU NOI TIEN TRINH TAI TU PYTHON
   Phai o cap module de con song khi component thao ra khoi cay.
   -------------------------------------------------------------------------- */

const REV_STATE_CACHE = new Map();
let _revListener = null;

window.__customProgress = (appId, data) => {
  const id = String(appId);
  const cur = REV_STATE_CACHE.get(id) || {};
  REV_STATE_CACHE.set(id, Object.assign({}, cur, { state: cur.state || 'downloading', progress: data }));
  if (_revListener && _revListener.appId === id && _revListener.progress) _revListener.progress(data);
};

function setRevListener(l) { _revListener = l; }

/* ----------------------------------------------------------------------------
   7. HOOK
   -------------------------------------------------------------------------- */

/* Anh tu chuyen sang nguon du phong khi loi, co hieu ung hien dan.

   LOI DA SUA: truoc day trang thai duoc dat lai trong useEffect. useEffect chi
   chay SAU khi trinh duyet ve xong khung hinh, con mot tam anh da nam san trong
   bo nho dem thi bao "tai xong" gan nhu tuc thi — tuc la truoc do. Thu tu that
   su xay ra: ve -> anh bao xong -> ghi nhan da tai -> useEffect cua lan gan moi
   chay -> XOA sach ghi nhan do -> tam anh nam im o do trong bang 0 mai mai.
   Cang chuyen qua lai giua cac trang thi cang nhieu anh vao bo dem, nen cang
   dung lau cang den nhieu the. Nay dat lai ngay trong luc ve, va hoi thang the
   anh xem no da xong chua thay vi cho no bao.
   -------------------------------------------------------------------------- */
function useFallbackImg(sources) {
  const key = Array.isArray(sources)
    ? sources.filter(Boolean).join('|')
    : String(sources || '');

  const list = useMemo(
    () => (Array.isArray(sources) ? sources.filter(Boolean) : [sources]).concat(PLACEHOLDER),
    [key]
  );

  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const elRef = useRef(null);

  /* Doi anh: dat lai ngay tai day. React cho phep mot thanh phan tu dat lai
     trang thai cua chinh no trong luc ve — no bo ket qua ve dang do va ve lai,
     khong he co khoang trong de anh trong bo dem chen vao giua. */
  const keyRef = useRef(key);
  if (keyRef.current !== key) {
    keyRef.current = key;
    setIdx(0);
    setLoaded(false);
  }

  const markLoaded = useCallback(function () { setLoaded(true); }, []);
  const onError = useCallback(function () {
    setLoaded(false);
    setIdx(function (i) { return i < list.length - 1 ? i + 1 : i; });
  }, [list]);

  /* Chot chan sau moi lan ve: hoi thang the anh. complete = da tai xong hoac
     da that bai; naturalWidth > 0 phan biet hai truong hop do. Nho vay du tay
     nghe load/error co bi lo mat thi trang thai van dung. */
  useEffect(function () {
    const el = elRef.current;
    if (!el || !el.complete) return;
    if (el.naturalWidth > 0) { if (!loaded) setLoaded(true); }
    else if (idx < list.length - 1) { setIdx(idx + 1); }
  });

  return { src: list[idx], loaded: loaded, onError: onError, onLoad: markLoaded, ref: elRef };
}

/* ----------------------------------------------------------------------------
   LICH RA MAT THEO GIO VIET NAM
   Moc gio trong danh sach da co san mui gio +07:00, nhung new Date().getHours()
   lai doc theo dong ho cua may. May cai lech mui gio -> ngay gio hien sai.
   Nen o day luon dinh mui gio Asia/Ho_Chi_Minh, bat ke may dang o dau.
   -------------------------------------------------------------------------- */

const VN_TZ = 'Asia/Ho_Chi_Minh';

const VN_FMT = (function () {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: VN_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  } catch (e) { return null; }
})();

/* -> { y, m, d, hh, mm, wd } theo gio VN; hong thi tra ve null */
function vnParts(input) {
  const dt = input instanceof Date ? input : new Date(input);
  if (isNaN(dt.getTime())) return null;

  if (!VN_FMT) {
    /* May qua cu, khong co Intl -> tu doi bang tay: UTC+7 */
    const s = new Date(dt.getTime() + 7 * 3600000);
    return {
      y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate(),
      hh: s.getUTCHours(), mm: s.getUTCMinutes(), wd: s.getUTCDay()
    };
  }

  const p = {};
  VN_FMT.formatToParts(dt).forEach(function (x) { p[x.type] = x.value; });
  return {
    y: +p.year, m: +p.month, d: +p.day,
    hh: +p.hour % 24, mm: +p.minute,
    wd: dt.getUTCDay() /* chi dung de tham chieu, khong hien ra */
  };
}

const VN_WD_SRC = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
/* Doc theo ngon ngu dang chon ngay luc goi, khong chot cung tu luc nap trang */
const VN_WD = new Proxy(VN_WD_SRC, {
  get: function (a, k) {
    const v = a[k];
    return typeof v === 'string' ? TX(v) : v;
  }
});
const p2 = function (n) { return String(n).padStart(2, '0'); };

/* "18/08/2026" theo gio VN */
function vnDate(input) {
  const v = vnParts(input);
  return v ? p2(v.d) + '/' + p2(v.m) + '/' + v.y : '';
}

/* "22:00" theo gio VN */
function vnTime(input) {
  const v = vnParts(input);
  return v ? p2(v.hh) + ':' + p2(v.mm) : '';
}

/* "2026-08-18" theo gio VN — dung de so sanh voi ngay Steam tra ve */
function vnYmd(input) {
  const v = vnParts(input);
  return v ? v.y + '-' + p2(v.m) + '-' + p2(v.d) : '';
}

/* "Thứ ba" theo gio VN */
function vnWeekday(input) {
  const dt = input instanceof Date ? input : new Date(input);
  if (isNaN(dt.getTime())) return '';
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: VN_TZ, weekday: 'short' })
      .format(dt);
    const k = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(s.slice(0, 3));
    return k >= 0 ? VN_WD[k] : '';
  } catch (e) { return ''; }
}

/* Bao nhieu ngay lich giua hai chuoi "YYYY-MM-DD" */
function daysBetweenYmd(a, b) {
  if (!a || !b) return 0;
  const t1 = Date.parse(a + 'T00:00:00Z');
  const t2 = Date.parse(b + 'T00:00:00Z');
  if (isNaN(t1) || isNaN(t2)) return 0;
  return Math.round((t2 - t1) / 86400000);
}

/* ----------------------------------------------------------------------------
   DOI CHIEU NGAY RA MAT VOI STEAM
   Steam khong tra ve gio, chi co ngay theo lich + co "coming_soon". Nen:
     * lech duoi 3 ngay  -> giu moc da bien tap (chi tiet toi tung gio,
                            chenh 1 ngay chi la do mui gio cua cua hang);
     * lech tu 3 ngay    -> game bi doi lich, lay ngay cua Steam va giu
                            nguyen khung gio cu;
     * coming_soon=false -> da phat hanh that, dem nguoc dung lai.
   -------------------------------------------------------------------------- */

const REL_SS = 'nx_rel_v1';
let memRel = null;
let relInflight = null;

function fetchReleases(ids) {
  const list = (ids || [])
    .map(function (x) { return String(x || '').trim(); })
    .filter(function (x) { return /^\d{2,10}$/.test(x); })
    .filter(function (x, i, a) { return a.indexOf(x) === i; })
    .slice(0, 32);

  if (!list.length) return Promise.resolve({});
  if (memRel) return Promise.resolve(memRel);
  if (relInflight) return relInflight;

  try {
    const c = sessionStorage.getItem(REL_SS);
    if (c) { memRel = JSON.parse(c) || {}; return Promise.resolve(memRel); }
  } catch (e) { /* bo qua */ }

  relInflight = (async function () {
    try {
      const ac = new AbortController();
      const to = setTimeout(function () { ac.abort(); }, 9000);
      const res = await fetch('/api/upcoming?ids=' + list.join(','), { signal: ac.signal });
      clearTimeout(to);
      if (res.ok) {
        const d = await res.json();
        if (d && d.ok && d.items) {
          memRel = d.items;
          try { sessionStorage.setItem(REL_SS, JSON.stringify(memRel)); } catch (e) {}
          return memRel;
        }
      }
    } catch (e) { /* mat mang -> giu lich da bien tap */ }
    memRel = {};
    return memRel;
  })().finally(function () { relInflight = null; });

  return relInflight;
}

/* Gop lich Steam vao mot the: tra ve moc gio da chinh + trang thai */
function mergeRelease(game, info) {
  const base = game && game.targetDate;
  const out = { target: base, moved: 0, released: false, steamYmd: '', source: 'local' };
  if (!base || !info) return out;

  if (info.coming_soon === false) out.released = true;
  if (!info.ymd) return out;

  out.steamYmd = info.ymd;
  const gap = daysBetweenYmd(vnYmd(base), info.ymd);
  if (Math.abs(gap) < 3) return out;   /* chi la lech mui gio */

  /* Doi lich that -> thay ngay, giu nguyen gio phut cua moc cu */
  const v = vnParts(base);
  const hh = v ? p2(v.hh) : '22';
  const mm = v ? p2(v.mm) : '00';
  const next = info.ymd + 'T' + hh + ':' + mm + ':00+07:00';
  if (!isNaN(new Date(next).getTime())) {
    out.target = next;
    out.moved = gap;
    out.source = 'steam';
  }
  return out;
}

/* Hook: goi mot lan cho ca danh sach, tra ve { appId: info } */
function useSteamReleases(games) {
  const ids = useMemo(function () {
    return (games || [])
      .map(function (g) { return g && g.appId; })
      .filter(Boolean)
      .map(String);
  }, [games]);

  const [map, setMap] = useState(function () { return memRel || {}; });

  useEffect(function () {
    if (!ids.length) return;
    let alive = true;
    fetchReleases(ids).then(function (m) { if (alive) setMap(m || {}); });
    return function () { alive = false; };
  }, [ids.join(',')]);

  return map;
}

/* Dem nguoc toi moc thoi gian. Het gio -> done = true (khong dung im o 00:00:00) */
function useCountdown(target) {
  const calc = useCallback(() => {
    const t = new Date(target).getTime();
    if (isNaN(t)) return { done: true, invalid: true, d: 0, h: 0, m: 0, s: 0 };
    const diff = t - Date.now();
    if (diff <= 0) return { done: true, d: 0, h: 0, m: 0, s: 0 };
    return {
      done: false,
      d: Math.floor(diff / 86400000),
      h: Math.floor(diff / 3600000) % 24,
      m: Math.floor(diff / 60000) % 60,
      s: Math.floor(diff / 1000) % 60
    };
  }, [target]);

  const [t, setT] = useState(calc);
  useEffect(() => {
    setT(calc());
    const id = setInterval(() => {
      const next = calc();
      setT(next);
      if (next.done) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [calc]);
  return t;
}

/* Dong menu tha xuong khi bam ra ngoai */
function useClickOutside(ref, onOut, active) {
  useEffect(() => {
    if (!active) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut, active]);
}

/* Bam Esc */
function useEscape(onEsc, active) {
  useEffect(() => {
    if (!active) return;
    const h = e => { if (e.key === 'Escape') { e.stopPropagation(); onEsc(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onEsc, active]);
}

/* ----------------------------------------------------------------------------
   8. HE THONG TOAST (dung chung toan app)
   Sua loi ban cu: nut dong goi closeToast — mot ham chua he duoc dinh nghia.
   -------------------------------------------------------------------------- */

const ToastCtx = React.createContext({ push: () => {}, close: () => {} });
let _toastSeq = 0;

function ToastHost({ children }) {
  const [list, setList] = useState([]);
  const timers = useRef(new Map());

  const close = useCallback(id => {
    setList(l => l.map(t => (t.id === id ? Object.assign({}, t, { out: true }) : t)));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
    setTimeout(() => setList(l => l.filter(t => t.id !== id)), 240);
  }, []);

  const push = useCallback((toast) => {
    const id = ++_toastSeq;
    const life = toast.life === 0 ? 0 : (toast.life || 7000);
    setList(l => [...l, Object.assign({ tone: 'info', life }, toast, { id })].slice(-4));
    if (life > 0) timers.current.set(id, setTimeout(() => close(id), life));
    return id;
  }, [close]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  const api = useMemo(() => ({ push, close }), [push, close]);
  const ICO = { ok: 'ph-fill ph-check-circle', bad: 'ph-fill ph-x-circle', warn: 'ph-fill ph-warning', info: 'ph-fill ph-info' };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts">
        {list.map(t => (
          <div key={t.id} className={'tst tst--' + t.tone + (t.out ? ' is-out' : '')} role="status">
            <i className={'tst__ico ' + (ICO[t.tone] || ICO.info)}></i>
            <div className="tst__main">
              <div className="tst__t">{t.title}</div>
              {t.desc ? <div className="tst__d">{t.desc}</div> : null}
            </div>
            <button className="tst__x" onClick={() => close(t.id)} aria-label={TX('Đóng')}>
              <i className="ph-bold ph-x"></i>
            </button>
            {t.life > 0 && (
              <div className="tst__bar" style={{ animationDuration: t.life + 'ms' }}></div>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function useToast() { return React.useContext(ToastCtx); }

/* ----------------------------------------------------------------------------
   9. COMPONENT NGUYEN TU
   -------------------------------------------------------------------------- */

/* Anh co khung xuong khi dang tai + tu doi nguon khi loi.
   eager = anh chac chan dang nam trong tam nhin (thanh dau, ke dau trang):
   tai ngay va uu tien cao thay vi cho trinh duyet thong thai quyet dinh. */
function Img({ sources, alt, className, imgClass, style, draggable, eager }) {
  const { src, loaded, onError, onLoad, ref } = useFallbackImg(sources);
  return (
    <React.Fragment>
      {!loaded && <div className={'nx-skel ' + (className || '')} style={Object.assign({ position: 'absolute', inset: 0 }, style)} />}
      <img
        ref={ref}
        src={src}
        alt={alt || ''}
        className={(imgClass || '') + (loaded ? ' is-in' : '')}
        onError={onError}
        onLoad={onLoad}
        loading={eager ? 'eager' : 'lazy'}
        fetchpriority={eager ? 'high' : 'auto'}
        decoding="async"
        draggable={draggable === undefined ? false : draggable}
        style={style}
      />
    </React.Fragment>
  );
}

/* Con so chay tang dan tu 0 len gia tri that */
function useCountUp(target, ms) {
  const [v, setV] = useState(function () {
    if (target === null || target === undefined) return null;
    return prefersCalm() ? target : 0;
  });
  useEffect(function () {
    if (target === null || target === undefined) { setV(null); return undefined; }
    if (prefersCalm()) { setV(target); return undefined; }
    let raf = 0;
    let t0 = 0;
    const dur = ms || 950;
    const step = function (t) {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / dur);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return function () { cancelAnimationFrame(raf); };
  }, [target, ms]);
  return v;
}

/* ----------------------------------------------------------------------------
   VONG TRON TI LE DANH GIA
   Bon lop chong len nhau: quang mo ngoai cung, ranh chim, cung mau chay theo
   ti le, va mot dau kim sang o cuoi cung. Con so o giua chay tang dan tu 0.

   LOI DA SUA: con so truoc day duoc dat giua bang place-items va dau % thi day
   len bang vertical-align. Ca hai deu lam lech: vertical-align keo cao hop dong
   chu nen chu so bi day xuong, con khoang cach chu am (letter-spacing) con cong
   them mot lan sau ky tu cuoi nen ca nhom bi keo sang trai. Nay dat giua bang
   flex va tra lai dung khoang thua o ky tu cuoi.
   -------------------------------------------------------------------------- */

let _ringSeq = 0;

function ScoreRing({ percent, size, thickness }) {
  const n = pctNum(percent);
  const s = size || 56;
  const w = thickness || 5;
  const r = (s - w - 3) / 2;
  const c = 2 * Math.PI * r;
  const p = n === null ? 0 : Math.max(0, Math.min(100, n));
  const off = n === null ? c : c * (1 - p / 100);
  const shown = useCountUp(n);
  /* Moi vong can mot id chuyen sac rieng, neu trung id thi trinh duyet
     dung chung mot dinh nghia va mau se sai o vong thu hai tro di. */
  const gid = useMemo(function () { return 'nxring' + (++_ringSeq); }, []);
  const mid = s / 2;
  return (
    <div className="rev__ring" style={{ width: s, height: s }}>
      <svg width={s} height={s} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="55%"  stopColor="currentColor" stopOpacity="0.86" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle className="rev__halo" cx={mid} cy={mid} r={r + w / 2 + 2.5} />
        <circle className="rev__trk" cx={mid} cy={mid} r={r} strokeWidth={w} />
        <circle className="rev__val" cx={mid} cy={mid} r={r} strokeWidth={w}
                stroke={'url(#' + gid + ')'}
                strokeDasharray={c} strokeDashoffset={off} />
        {n !== null && p > 1.5 && (
          <g className="rev__hand"
             style={{ transform: 'rotate(' + (p * 3.6) + 'deg)', transformOrigin: mid + 'px ' + mid + 'px' }}>
            <circle className="rev__end" cx={mid + r} cy={mid} r={w * 0.4} />
          </g>
        )}
      </svg>
      <span className="rev__pct">
        <b>{n === null ? '—' : Math.round(shown === null ? n : shown)}</b>
        {n !== null && <em>%</em>}
      </span>
    </div>
  );
}

/* Khoi ghi chu trang thai duoi nut hanh dong */
function Note({ tone, children }) {
  if (!children) return null;
  const ICO = {
    ok: 'ph-fill ph-check-circle', bad: 'ph-fill ph-x-circle',
    warn: 'ph-fill ph-warning', info: 'ph-fill ph-info', busy: ''
  };
  return (
    <div className={'note note--' + (tone || 'info')}>
      {tone === 'busy' ? <div className="nx-spin" /> : <i className={ICO[tone] || ICO.info}></i>}
      <span>{children}</span>
    </div>
  );
}

/* Khung modal dung chung: nen mo, thoat bang Esc, dong khi bam nen */
function Modal({ open, onClose, icon, title, desc, children, footer, wide, variant }) {
  const [out, setOut] = useState(false);
  const close = useCallback(() => {
    setOut(true);
    setTimeout(() => { setOut(false); onClose(); }, 200);
  }, [onClose]);
  useEscape(close, open);
  if (!open) return null;
  return (
    <div className={'mo ' + (variant || '') + (out ? ' is-out' : '')}
         onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="mo__box" style={wide ? { maxWidth: wide } : null}>
        {title && (
          <div className="mo__head">
            {icon && <div className="mo__ico"><i className={icon}></i></div>}
            <div>
              <div className="mo__t">{title}</div>
              {desc && <div className="mo__d">{desc}</div>}
            </div>
            <button className="nx-icobtn mo__x" onClick={close} aria-label={TX('Đóng')}>
              <i className="ph-bold ph-x"></i>
            </button>
          </div>
        )}
        <div className="mo__body">{children}</div>
        {footer && <div className="mo__foot">{footer}</div>}
      </div>
    </div>
  );
}

/* Trang thai rong dung chung */
function Empty({ icon, title, desc, action }) {
  return (
    <div className="nx-empty">
      <div className="nx-empty__ico"><i className={icon || 'ph-bold ph-magnifying-glass'}></i></div>
      <div className="nx-empty__t">{title}</div>
      {desc && <div className="nx-empty__d">{desc}</div>}
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------------------
   NGAY PHAT HANH DO STEAM TRA VE
   Steam tra ve mot chuoi da dich san theo ngon ngu dang xem, vi du
   "9 Thg07, 2026" hoac "Sep 2, 2026". De nguyen thi moi game mot kieu, nen
   quy het ve dd/mm/yyyy cho dong bo voi phan con lai cua giao dien.
   -------------------------------------------------------------------------- */

const EN_MONTH = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function steamDateVN(text) {
  const s = String(text || '').trim();
  if (!s) return '';

  const ym = s.match(/\b((?:19|20)\d{2})\b/);
  if (!ym) return s;                       /* "Coming soon", "To be announced" */
  const year = ym[1];
  let rest = s.replace(ym[0], ' ');

  let mon = 0;
  const vn = rest.match(/Th(?:g|áng)\s*0*(\d{1,2})/i);
  if (vn) { mon = +vn[1]; rest = rest.replace(vn[0], ' '); }
  else {
    const en = rest.match(/[A-Za-z]{3,}/);
    if (en) {
      const k = EN_MONTH[en[0].slice(0, 3).toLowerCase()];
      if (k) { mon = k; rest = rest.replace(en[0], ' '); }
    }
  }
  if (!mon || mon > 12) return s;          /* "Q1 2026" — giu nguyen */

  const d = rest.match(/\b(3[01]|[12]\d|0?[1-9])\b/);
  if (!d) return TX('Tháng {m}/{y}', { m: p2(mon), y: year });
  return p2(+d[1]) + '/' + p2(mon) + '/' + year;
}

/* ----------------------------------------------------------------------------
   HIEN DAN KHI CUON TOI
   Gan ref vao mot khoi; khoi do chay hieu ung xuat hien dung mot lan, ngay khi
   lot vao tam nhin. Khong ho tro IntersectionObserver, hoac nguoi dung da tat
   hieu ung chuyen dong, thi hien thang — khong giau gi ca.
   -------------------------------------------------------------------------- */

function prefersCalm() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
}

function useReveal(margin) {
  const ref = useRef(null);

  useEffect(function () {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window) || prefersCalm()) {
      el.classList.add('is-seen');
      return undefined;
    }
    /* Khoi da nam san trong tam nhin luc gan: mo ngay o khung hinh ke tiep.
       Cho IntersectionObserver bao thi som nhat cung phai qua mot nhip ve,
       du de nguoi dung thay mot khoang trong nhap nhay. */
    const root = el.closest('.nx-scroll');
    const rr = root
      ? root.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight || 0 };
    const er = el.getBoundingClientRect();
    if (er.top < rr.bottom && er.bottom > rr.top) {
      const raf = requestAnimationFrame(function () { el.classList.add('is-seen'); });
      return function () { cancelAnimationFrame(raf); };
    }

    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-seen');
        io.unobserve(en.target);
      });
    }, {
      root: el.closest('.nx-scroll') || null,
      rootMargin: margin || '0px 0px -6% 0px',
      threshold: 0.04
    });
    io.observe(el);
    return function () { io.disconnect(); };
  }, [margin]);

  return ref;
}

/* ----------------------------------------------------------------------------
   10. XUAT RA
   -------------------------------------------------------------------------- */

window.NX = {
  APP_VERSION, DISCORD_URL, CDN_ITEM, CDN_CF, CDN_AK, PLACEHOLDER,
  PLATFORMS, CUSTOM_APPIDS,
  pyApi, hasApi, callApi, apiProp, openExternal,
  pctNum, reviewTone, TONE_ICON, reviewCountNum, fmtCount, fmtBytes, sortKey,
  getGamePlatform, isOnlineGame, hasCloudSave, customAppIdOf,
  coverSources, heroSources, fetchMedia, buildMedia, fetchTranslation,
  REV_STATE_CACHE, setRevListener,
  useFallbackImg, useCountdown, useClickOutside, useEscape,
  VN_TZ, vnParts, vnDate, vnTime, vnYmd, vnWeekday, daysBetweenYmd,
  fetchReleases, mergeRelease, useSteamReleases, steamDateVN,
  prefersCalm, useReveal,
  ToastHost, useToast,
  Img, ScoreRing, useCountUp, Note, Modal, Empty,
  I18N, TX, useLang, tagTone, markedTone, stripTone
};

})();
