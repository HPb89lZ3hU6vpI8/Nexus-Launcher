/* ============================================================================
   NEXUS LAUNCHER — LOI: cau hinh, cau noi Python, tang media Steam, hook, icon
   File nay chay TRUOC moi file JSX khac. Xuat ra window.NX.*
   ========================================================================== */

(function () {
  'use strict';

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

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
    return { success: false, __missing: true, error: 'Chức năng chưa khả dụng trong phiên bản này.' };
  }
  try {
    const r = await a[name](...args);
    if (r === null || r === undefined) return { success: false, error: 'Không nhận được phản hồi.' };
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

const SS_PREFIX = 'nx_media_v4_';
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

function fetchMedia(appId) {
  const key = String(appId);
  if (memMedia.has(key)) return Promise.resolve(memMedia.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const cached = readSS(key);
  if (cached) { memMedia.set(key, cached); return Promise.resolve(cached); }

  const job = (async () => {
    /* Nguon 1: Python — nhanh nhat, khong vuong CORS, du 100% trailer */
    if (hasApi('get_steam_media')) {
      const r = await callApi('get_steam_media', key);
      const n = normalizeMedia(r && r.data ? r.data : r);
      if (n) { memMedia.set(key, n); writeSS(key, n); return n; }
    }
    /* Nguon 2: ham serverless tren Vercel */
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 6000);
      const res = await fetch('/api/steammedia?appid=' + key, { signal: ac.signal });
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

const TR_PREFIX = 'nx_tr_v1_';
const memTr = new Map();
const trInflight = new Map();

function fetchTranslation(appId) {
  const key = String(appId);
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
      const res = await fetch('/api/translate?appid=' + key, { signal: ac.signal });
      clearTimeout(to);
      if (res.ok) {
        const d = await res.json();
        if (d && d.lang === 'vi' && d.about) {
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

/* Anh tu chuyen sang nguon du phong khi loi, co hieu ung hien dan */
function useFallbackImg(sources) {
  const list = useMemo(
    () => (Array.isArray(sources) ? sources.filter(Boolean) : [sources]).concat(PLACEHOLDER),
    [Array.isArray(sources) ? sources.join('|') : sources]
  );
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setIdx(0); setLoaded(false); }, [list]);
  const onError = useCallback(() => setIdx(i => (i < list.length - 1 ? i + 1 : i)), [list]);
  const onLoad  = useCallback(() => setLoaded(true), []);
  return { src: list[idx], loaded, onError, onLoad };
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
            <button className="tst__x" onClick={() => close(t.id)} aria-label="Đóng">
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

/* Anh co khung xuong khi dang tai + tu doi nguon khi loi */
function Img({ sources, alt, className, imgClass, style, draggable }) {
  const { src, loaded, onError, onLoad } = useFallbackImg(sources);
  return (
    <React.Fragment>
      {!loaded && <div className={'nx-skel ' + (className || '')} style={Object.assign({ position: 'absolute', inset: 0 }, style)} />}
      <img
        src={src}
        alt={alt || ''}
        className={(imgClass || '') + (loaded ? ' is-in' : '')}
        onError={onError}
        onLoad={onLoad}
        loading="lazy"
        decoding="async"
        draggable={draggable === undefined ? false : draggable}
        style={style}
      />
    </React.Fragment>
  );
}

/* Vong tron ti le danh gia */
let _ringSeq = 0;

function ScoreRing({ percent, size, thickness }) {
  const n = pctNum(percent);
  const s = size || 56;
  const w = thickness || 5;
  const r = (s - w - 3) / 2;
  const c = 2 * Math.PI * r;
  const off = n === null ? c : c * (1 - Math.max(0, Math.min(100, n)) / 100);
  /* Moi vong can mot id chuyen sac rieng, neu trung id thi trinh duyet
     dung chung mot dinh nghia va mau se sai o vong thu hai tro di. */
  const gid = useMemo(function () { return 'nxring' + (++_ringSeq); }, []);
  return (
    <div className="rev__ring" style={{ width: s, height: s }}>
      <svg width={s} height={s} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="55%"  stopColor="currentColor" stopOpacity="0.82" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle className="rev__trk" cx={s / 2} cy={s / 2} r={r} strokeWidth={w} />
        <circle className="rev__val" cx={s / 2} cy={s / 2} r={r} strokeWidth={w}
                stroke={'url(#' + gid + ')'}
                strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className="rev__pct">
        {n === null ? '—' : Math.round(n)}
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
            <button className="nx-icobtn mo__x" onClick={close} aria-label="Đóng">
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
  ToastHost, useToast,
  Img, ScoreRing, Note, Modal, Empty
};

})();
