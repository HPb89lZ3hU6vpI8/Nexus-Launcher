// ============================================================================
// Vercel Serverless Function — lay du lieu Steam appdetails cho Nexus Launcher.
//
// Tra ve:
//   items[]            thu tu media GIU NGUYEN nhu trang Steam (trailer + anh)
//   movies[], screenshots[]   (giu lai cho ban UI cu)
//   header_image, background, capsule
//   short_description, about        mo ta game (GAME_DATA khong co truong nay)
//   developers[], publishers[], genres[], categories[]
//   release_date, coming_soon, metacritic
//   sysreq             { os, cpu, ram, gpu, dx, storage, audio, connection, note }
//   sysreq_rec         nhu tren nhung la cau hinh de nghi
// ============================================================================

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&#39;': "'", '&#039;': "'", '&nbsp;': ' ', '&reg;': '®',
  '&trade;': '™', '&copy;': '©', '&hellip;': '…',
  '&mdash;': '—', '&ndash;': '–', '&rsquo;': '’',
  '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”',
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/&[a-z]+;|&#0?\d{1,5};/gi, (m) => {
      if (ENTITIES[m]) return ENTITIES[m];
      const num = m.match(/^&#0?(\d{1,5});$/);
      if (num) {
        const code = parseInt(num[1], 10);
        if (code > 0 && code < 0x110000) return String.fromCodePoint(code);
      }
      return m;
    })
    .replace(/&amp;/g, '&');
}

// HTML cua Steam -> van ban thuan, giu xuong dong o cho hop ly.
function htmlToText(html) {
  if (!html) return '';
  return decodeEntities(
    String(html)
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Parse khoi pc_requirements (HTML) -> object co cau truc.
// Steam thuong viet "<strong>Memory:</strong> 8 GB RAM" nhung cung co khi
// nhan va gia tri nam o hai dong khac nhau.
const KEY_MAP = {
  os: 'os',
  'os *': 'os',
  'operating system': 'os',
  processor: 'cpu',
  cpu: 'cpu',
  memory: 'ram',
  ram: 'ram',
  graphics: 'gpu',
  'video card': 'gpu',
  directx: 'dx',
  storage: 'storage',
  'hard drive': 'storage',
  'hard disk space': 'storage',
  'hard disk': 'storage',
  'available space': 'storage',
  sound: 'audio',
  'sound card': 'audio',
  network: 'connection',
  'additional notes': 'note',
  additional: 'note',
};

const KEY_RE = new RegExp(
  '^(?:minimum|recommended)?[:\\s]*(.*?)\\b(OS\\s*\\*?|Operating System|Processor|CPU|Memory|RAM|' +
    'Graphics|Video Card|DirectX|Storage|Hard Drive|Hard Disk Space|Hard Disk|Available Space|' +
    'Sound Card|Sound|Network|Additional Notes|Additional)\\s*:\\s*(.*)$',
  'i'
);

function parseSysreq(htmlStr) {
  const text = htmlToText(htmlStr);
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(KEY_RE);
    if (!m) continue;
    const k = KEY_MAP[m[2].toLowerCase().replace(/\s*\*$/, '')];
    if (!k || out[k]) continue;
    let val = (m[3] || '').trim();
    // Gia tri nam o dong sau, va dong do khong phai mot nhan khac
    if (!val && i + 1 < lines.length && !KEY_RE.test(lines[i + 1])) {
      val = lines[i + 1].trim();
      i++;
    }
    if (val) out[k] = val.replace(/\s{2,}/g, ' ').slice(0, 400);
  }

  // Vai game chi ghi "Requires a 64-bit processor and operating system"
  if (!out.os) {
    const bit = lines.find((l) => /64[-\s]?bit/i.test(l) && !/^(minimum|recommended)/i.test(l));
    if (bit) out.os = bit.slice(0, 200);
  }

  return Object.keys(out).length ? out : null;
}

// Dau thanh + nguyen am rieng cua tieng Viet -> doan xem Steam da dich chua.
const VI_MARK =
  /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/g;

function isVietnamese(s) {
  if (!s) return false;
  const hits = String(s).match(VI_MARK);
  return !!hits && hits.length >= 3;
}

// Steam tra hls_h264 (chuoi .m3u8) hoac mp4/webm (chuoi HOAC object {480, max}).
function pickMovieSrc(m) {
  if (typeof m.hls_h264 === 'string' && m.hls_h264) return m.hls_h264;
  for (const key of ['mp4', 'webm']) {
    const v = m[key];
    if (!v) continue;
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.max || v['480'] || Object.values(v)[0] || '';
  }
  return '';
}

function httpsify(u) {
  return String(u || '').replace(/^http:\/\//i, 'https://');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Trinh duyet giu 1 gio; CDN cua Vercel giu 1 ngay va van phuc vu ban cu
  // trong 7 ngay khi dang lam moi -> mo lai game gan nhu tuc thi.
  res.setHeader(
    'Cache-Control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  );
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const appId = String((req.query && req.query.appid) || '').trim();
  if (!/^\d{1,10}$/.test(appId)) {
    res.status(400).json({ error: 'appid khong hop le' });
    return;
  }

  const lang = /^[a-z]+$/i.test(String((req.query && req.query.l) || ''))
    ? String(req.query.l)
    : 'vietnamese';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);

  try {
    const url =
      'https://store.steampowered.com/api/appdetails?appids=' +
      appId + '&l=' + lang + '&cc=us';

    const steamRes = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.6,en;q=0.4',
      },
    });
    clearTimeout(timer);

    if (!steamRes.ok) {
      res.status(502).json({ error: 'Steam tra ve ' + steamRes.status });
      return;
    }

    const json = await steamRes.json();
    const entry = json && json[appId];
    if (!entry || !entry.success || !entry.data) {
      res.status(404).json({ error: 'Steam khong co du lieu app nay' });
      return;
    }
    const d = entry.data;

    // ---- media ------------------------------------------------------------
    const movies = (d.movies || [])
      .map((m) => ({
        id: m.id || null,
        name: m.name || '',
        src: httpsify(pickMovieSrc(m)),
        thumb: httpsify(m.thumbnail || ''),
      }))
      .filter((m) => m.src);

    const shots = (d.screenshots || [])
      .map((s) => ({
        src: httpsify(s.path_full || ''),
        thumb: httpsify(s.path_thumbnail || s.path_full || ''),
      }))
      .filter((s) => s.src);

    // Thu tu hien thi: 2 trailer dau -> toan bo anh -> trailer con lai.
    const items = [];
    movies.slice(0, 2).forEach((m) => items.push({ type: 'video', src: m.src, thumb: m.thumb }));
    shots.forEach((s) => items.push({ type: 'image', src: s.src, thumb: s.thumb }));
    movies.slice(2).forEach((m) => items.push({ type: 'video', src: m.src, thumb: m.thumb }));

    // ---- cau hinh ---------------------------------------------------------
    const pc = d.pc_requirements && typeof d.pc_requirements === 'object' ? d.pc_requirements : {};
    const sysreq = parseSysreq(pc.minimum || '');
    const sysreqRec = parseSysreq(pc.recommended || '');

    // ---- mo ta ------------------------------------------------------------
    const short = htmlToText(d.short_description || '');
    const about = htmlToText(d.about_the_game || d.detailed_description || '');

    res.status(200).json({
      appid: appId,
      name: d.name || '',
      type: d.type || 'game',

      items,
      movies: movies.map((m) => ({ src: m.src, thumb: m.thumb })),
      screenshots: shots.map((s) => s.src),

      header_image: httpsify(d.header_image || ''),
      capsule: httpsify(d.capsule_imagev5 || d.capsule_image || ''),
      background: httpsify(d.background_raw || d.background || ''),

      short_description: short,
      about: about.length > 4000 ? about.slice(0, 4000).trim() + '…' : about,
      // Nhieu game khong co trang cua hang tieng Viet -> Steam van tra tieng Anh.
      // Giao dien dua vao co nay de goi /api/translate.
      about_lang: isVietnamese(about) ? 'vi' : 'en',
      desc_lang: isVietnamese(short) ? 'vi' : 'en',

      developers: Array.isArray(d.developers) ? d.developers.slice(0, 6) : [],
      publishers: Array.isArray(d.publishers) ? d.publishers.slice(0, 6) : [],
      genres: Array.isArray(d.genres) ? d.genres.map((g) => g.description).filter(Boolean) : [],
      categories: Array.isArray(d.categories)
        ? d.categories.map((c) => c.description).filter(Boolean).slice(0, 24)
        : [],

      release_date: (d.release_date && d.release_date.date) || '',
      coming_soon: !!(d.release_date && d.release_date.coming_soon),
      metacritic: d.metacritic && d.metacritic.score ? d.metacritic.score : null,

      sysreq,
      sysreq_rec: sysreqRec,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = (err && err.message) || 'timeout';
    res.status(502).json({ error: 'Steam API that bai', detail: msg });
  }
};
