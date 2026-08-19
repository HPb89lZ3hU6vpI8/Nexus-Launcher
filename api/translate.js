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

    let about = htmlToText(d.about_the_game || d.detailed_description || '');
    let desc = htmlToText(d.short_description || '');
    let source = 'steam';

    // 2. Steam chua dich -> tu dich.
    if (!isVietnamese(about)) {
      const src = about.length > 4200 ? about.slice(0, 4200).trim() + '…' : about;
      about = await translate(src, ctrl.signal);
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
      desc: '',
      error: (err && err.message) || 'that bai',
    });
  }
};
