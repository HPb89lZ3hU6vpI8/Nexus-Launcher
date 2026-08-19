// ============================================================================
// Vercel Serverless Function — dich mo ta game cua Steam sang tieng Viet.
//
// Vi sao nhan APPID chu khong nhan van ban?
//   Nhan appid => GET thuan tuy => CDN cua Vercel cache duoc ca ngay.
//   Nguoi thu hai mo cung mot game se nhan ket qua tuc thi, khong ton lan dich.
//
//   GET /api/translate?appid=252490
//   -> { appid, lang: 'vi', about, desc, source: 'auto' }
//
// Khong can API key. Neu dich that bai thi tra ve ban goc kem lang:'en'
// de giao dien van hien duoc chu, khong bao gio de trong.
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

// Dau thanh + nguyen am rieng cua tieng Viet. Dung de doan van ban da la
// tieng Viet hay chua (Steam chi dich san mot so game).
// ---------------------------------------------------------------------------
// HTML cua Steam -> mang khoi CO CAU TRUC, GIU LAI anh & anh dong giua bai.
// Trang cua hang Steam chen bang-ron, anh minh hoa (.avif/.gif) va ca "anh
// dong" (<video autoplay muted loop> webm/mp4) vao giua cac doan van.
// htmlToText() phia tren nem het di nen mo ta trong launcher chi con chu.
//
//   { k:'h',   t }                    tieu de muc
//   { k:'p',   t }                    doan van
//   { k:'ul',  items:[] }             danh sach gach dau dong
//   { k:'img', src, w, h }            anh tinh / anh gif
//   { k:'vid', src, poster, w, h }    anh dong (webm hoac mp4)
// ---------------------------------------------------------------------------

const M_IMG = '\u0000';
const M_LI = '\u0001';
const M_H = '\u0002';
const M_VID = '\u0003';

function absUrl(u, base) {
  if (!u) return '';
  let src = String(u).replace(/\{STEAM_APP_IMAGE\}/g, base).trim();
  if (/^\/\//.test(src)) src = 'https:' + src;
  return /^https?:\/\//i.test(src) ? src : '';
}

function sizeOf(tag) {
  const w = (tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [])[1] || '';
  const h = (tag.match(/\bheight\s*=\s*["']?(\d+)/i) || [])[1] || '';
  return w + '|' + h;
}

function parseRich(html, appId) {
  if (!html) return [];

  const base =
    'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + appId;

  let s = String(html)
    // Anh dong: <video ...><source src=".webm"><source src=".mp4"></video>
    .replace(/<\s*video[\s\S]*?<\s*\/\s*video\s*>/gi, (tag) => {
      const poster = absUrl((tag.match(/poster\s*=\s*["']([^"']+)["']/i) || [])[1], base);
      const webm = tag.match(/<\s*source[^>]*src\s*=\s*["']([^"']+\.webm[^"']*)["']/i);
      const mp4 = tag.match(/<\s*source[^>]*src\s*=\s*["']([^"']+\.mp4[^"']*)["']/i);
      const src = absUrl((webm && webm[1]) || (mp4 && mp4[1]) || '', base);
      if (!src && !poster) return '';
      return '\n' + M_VID + src + '|' + poster + '|' + sizeOf(tag) + '\n';
    })
    .replace(/<\s*img[^>]*>/gi, (tag) => {
      const src = absUrl((tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1], base);
      if (!src) return '';
      return '\n' + M_IMG + src + '|' + sizeOf(tag) + '\n';
    })
    .replace(/<\s*h[1-6][^>]*>/gi, '\n' + M_H)
    .replace(/<\s*\/\s*h[1-6]\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n' + M_LI)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|ul|ol|tr|table|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  s = decodeEntities(s).replace(/\r/g, '');

  const out = [];
  let list = null;
  const flush = () => {
    if (list && list.items.length) out.push(list);
    list = null;
  };

  s.split('\n').forEach((raw) => {
    const line = raw.replace(/[ \t\u00a0]+/g, ' ').trim();
    if (!line) return;

    const head = line.charAt(0);

    if (head === M_VID) {
      flush();
      const b = line.slice(1).split('|');
      out.push({ k: 'vid', src: b[0] || '', poster: b[1] || '', w: +b[2] || 0, h: +b[3] || 0 });
      return;
    }

    if (head === M_IMG) {
      flush();
      const b = line.slice(1).split('|');
      if (b[0]) out.push({ k: 'img', src: b[0], w: +b[1] || 0, h: +b[2] || 0 });
      return;
    }

    if (head === M_LI) {
      const t = line.slice(1).replace(/^[\u2022\u25aa\u25cf\u00b7*\-\u2013\u2014]\s*/, '').trim();
      if (!t) return;
      if (!list) list = { k: 'ul', items: [] };
      list.items.push(t);
      return;
    }

    flush();

    if (head === M_H) {
      const t = line.slice(1).trim();
      if (t) out.push({ k: 'h', t });
      return;
    }

    out.push({ k: 'p', t: line });
  });

  flush();

  // Steam doi khi lap lai cung mot bang-ron ngan cach hai lan lien tiep
  return out.filter((b, i, arr) => {
    if (b.k !== 'img' && b.k !== 'vid') return true;
    const prev = arr[i - 1];
    return !(prev && prev.k === b.k && prev.src === b.src);
  });
}

const IS_MEDIA = (b) => b.k === 'img' || b.k === 'vid';

// Cat bot khi mo ta qua dai — chi dem ky tu VAN BAN, khong bao gio bo anh.
function clampRich(blocks, limit) {
  const out = [];
  let n = 0;
  let cut = false;
  for (const b of blocks) {
    if (IS_MEDIA(b)) { out.push(b); continue; }
    const len = b.k === 'ul' ? b.items.join(' ').length : String(b.t || '').length;
    if (n + len > limit && out.length) { cut = true; break; }
    out.push(b);
    n += len;
  }
  // Chi khi bi cat giua chung moi bo anh mo coi o cuoi.
  // (Vai game nhu The Witcher 3 co mo ta THUAN anh — phai giu nguyen.)
  if (cut) while (out.length > 1 && IS_MEDIA(out[out.length - 1])) out.pop();
  return out;
}

const VI_MARK =
  /[ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/g;

function isVietnamese(s) {
  if (!s) return false;
  const hits = String(s).match(VI_MARK);
  return !!hits && hits.length >= 3;
}

// Cat van ban thanh tung mieng <= LIMIT ky tu, uu tien cat o cho xuong dong
// roi moi den dau cham -> cau khong bi dut giua chung khi dich.
const LIMIT = 1800;

function chunk(text) {
  const out = [];
  let rest = String(text);
  while (rest.length > LIMIT) {
    let cut = rest.lastIndexOf('\n', LIMIT);
    if (cut < LIMIT * 0.5) cut = rest.lastIndexOf('. ', LIMIT);
    if (cut < LIMIT * 0.5) cut = rest.lastIndexOf(' ', LIMIT);
    if (cut < LIMIT * 0.5) cut = LIMIT;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out;
}

async function translateChunk(text, signal) {
  const r = await fetch(
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t',
    {
      method: 'POST',
      signal,
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: 'q=' + encodeURIComponent(text),
    }
  );
  if (!r.ok) throw new Error('translate ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j) || !Array.isArray(j[0])) throw new Error('khuon la');
  return j[0].map((seg) => (seg && seg[0]) || '').join('');
}

async function translate(text, signal) {
  if (!text) return '';
  const parts = chunk(text);
  const done = [];
  for (const p of parts) done.push(await translateChunk(p, signal));
  return done
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Dich MOT MANG KHOI ma van giu nguyen thu tu va vi tri anh/video.
//
// Google translate_a giu nguyen ky tu xuong dong, nen co the gom nhieu doan
// van vao mot goi roi tach lai — nhanh hon nhieu so voi dich tung doan.
// Neu so dong tra ve khong khop (rat hiem) thi lui ve dich tung dong; dong
// nao dich hong thi giu nguyen ban goc chu khong bao gio de trong.
// ---------------------------------------------------------------------------

async function translateLines(lines, signal) {
  const out = new Array(lines.length);

  const one = async (idx) => {
    const src = lines[idx];
    try {
      const t =
        src.length > 4000
          ? await translate(src, signal)
          : await translateChunk(src, signal);
      out[idx] = String(t || '').replace(/\s*\n+\s*/g, ' ').trim() || src;
    } catch (e) {
      out[idx] = src;
    }
  };

  let i = 0;
  while (i < lines.length) {
    let j = i;
    let n = 0;
    while (j < lines.length && (j === i || n + lines[j].length + 1 <= LIMIT)) {
      n += lines[j].length + 1;
      j++;
    }

    if (j - i === 1) {
      await one(i);
    } else {
      let ok = false;
      try {
        const got = String(
          (await translateChunk(lines.slice(i, j).join('\n'), signal)) || ''
        ).split('\n');
        if (got.length === j - i && got.every((x) => x.trim())) {
          for (let k = i; k < j; k++) out[k] = got[k - i].trim();
          ok = true;
        }
      } catch (e) {
        /* roi xuong dich tung dong */
      }
      if (!ok) for (let k = i; k < j; k++) await one(k);
    }

    i = j;
  }

  return out;
}

async function translateRich(blocks, signal) {
  const segs = [];
  const at = [];

  blocks.forEach((b, i) => {
    if (b.k === 'ul') {
      (b.items || []).forEach((t, j) => {
        if (t) { segs.push(t); at.push([i, j]); }
      });
      return;
    }
    if (b.k === 'p' || b.k === 'h') {
      const t = String(b.t || '');
      if (t) { segs.push(t); at.push([i, -1]); }
    }
  });

  if (!segs.length) return blocks;

  const done = await translateLines(segs, signal);
  const copy = blocks.map((b) =>
    b.k === 'ul'
      ? { k: 'ul', items: (b.items || []).slice() }
      : Object.assign({}, b)
  );

  done.forEach((t, k) => {
    if (!t) return;
    const i = at[k][0];
    const j = at[k][1];
    if (j < 0) copy[i].t = t;
    else copy[i].items[j] = t;
  });

  return copy;
}

// Doi mang khoi -> van ban thuan, de truong "about" cu van chay binh thuong.
function richToText(blocks) {
  return blocks
    .map((b) =>
      b.k === 'ul'
        ? (b.items || []).map((t) => '\u2022 ' + t).join('\n')
        : b.k === 'p' || b.k === 'h'
        ? String(b.t || '')
        : ''
    )
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const appId = String((req.query && req.query.appid) || '').trim();
  if (!/^\d{1,10}$/.test(appId)) {
    res.status(400).json({ error: 'appid khong hop le' });
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18000);

  try {
    // 1. Lay ban tieng Viet cua Steam truoc — neu nha phat hanh da dich san
    //    thi dung luon, chat luong hon may dich.
    const viRes = await fetch(
      'https://store.steampowered.com/api/appdetails?appids=' + appId + '&l=vietnamese&cc=us',
      { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' } }
    );
    if (!viRes.ok) throw new Error('steam ' + viRes.status);
    const viJson = await viRes.json();
    const d = viJson && viJson[appId] && viJson[appId].data;
    if (!d) {
      clearTimeout(timer);
      res.status(404).json({ error: 'Steam khong co du lieu app nay' });
      return;
    }

    const aboutHtml = d.about_the_game || d.detailed_description || '';
    let about = htmlToText(aboutHtml);
    let desc = htmlToText(d.short_description || '');
    let rich = clampRich(parseRich(aboutHtml, appId), 6000);
    let source = 'steam';

    // Game co phan gioi thieu thuan anh/video -> chen mo ta ngan len dau.
    const richChars = rich.reduce(
      (n, b) =>
        n +
        (b.k === 'ul'
          ? b.items.join(' ').length
          : b.k === 'p' || b.k === 'h'
          ? String(b.t || '').length
          : 0),
      0
    );
    if (richChars < 40 && desc) rich.unshift({ k: 'p', t: desc });

    // 2. Steam chua dich -> tu dich.
    if (!isVietnamese(about)) {
      rich = await translateRich(rich, ctrl.signal);
      // Dich mang khoi da bao tron noi dung -> khoi goi Google them lan nua.
      const flat = richToText(rich);
      about = flat || (await translate(about.slice(0, 4200), ctrl.signal));
      source = 'auto';
    }
    if (!isVietnamese(desc)) {
      desc = await translate(desc, ctrl.signal);
      source = source === 'steam' ? 'auto' : source;
    }

    clearTimeout(timer);

    // Cache manh: ban dich cua mot game khong doi theo tung nguoi dung.
    res.setHeader(
      'Cache-Control',
      'public, max-age=21600, s-maxage=604800, stale-while-revalidate=2592000'
    );
    res.status(200).json({
      appid: appId,
      lang: isVietnamese(about) ? 'vi' : 'en',
      source,
      about: about.length > 4000 ? about.slice(0, 4000).trim() + '…' : about,
      // Khuon co cau truc: giu tieu de, danh sach VA anh/video chen giua bai.
      about_rich: rich,
      desc,
    });
  } catch (err) {
    clearTimeout(timer);
    // Dich hong khong duoc lam vo trang -> tra 200 kem lang:'en' de giao dien
    // im lang giu nguyen ban goc.
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({
      appid: appId,
      lang: 'en',
      source: 'none',
      about: '',
      about_rich: [],
      desc: '',
      error: (err && err.message) || 'that bai',
    });
  }
};
