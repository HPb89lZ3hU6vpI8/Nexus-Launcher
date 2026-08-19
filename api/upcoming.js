// ---------------------------------------------------------------------------
// /api/upcoming?ids=2825860,2584270,...
//
// Doi chieu ngay phat hanh cua cac game "sap ra mat" voi Steam.
//
// Steam KHONG tra ve timestamp — chi co mot chuoi ngay theo lich ("Sep 2, 2026")
// va co "coming_soon". Vi vay:
//   * moc gio chinh xac (theo gio VN) van lay tu danh sach da bien tap san;
//   * Steam dung de PHAT HIEN GAME BI DOI LICH va game da phat hanh that.
//
// Chi doc mot truong nen moi goi chi ~100 byte; CDN cache 1 gio.
// ---------------------------------------------------------------------------

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// "Sep 2, 2026" / "2 Sep, 2026" / "September 2, 2026" -> "2026-09-02".
// Chuoi chi co thang ("Aug 2026"), quy ("Q3 2026") hay nam -> null, luc do
// giu nguyen moc da bien tap vi no chi tiet hon.
function toYmd(text) {
  const s = String(text || '').trim();
  if (!s) return null;

  const year = (s.match(/\b(20\d{2})\b/) || [])[1];
  if (!year) return null;

  const mon = (s.match(/\b([A-Za-z]{3,})\b/) || [])[1];
  const m = mon ? MONTHS[mon.slice(0, 3).toLowerCase()] : 0;
  if (!m) return null;

  // Ngay = so 1..31 KHONG phai nam
  const day = (s.match(/\b(3[01]|[12]\d|0?[1-9])\b(?!\d)/) || [])[1];
  if (!day) return null;

  const p = (n) => String(n).padStart(2, '0');
  return year + '-' + p(m) + '-' + p(+day);
}

async function readOne(appid, signal) {
  const url =
    'https://store.steampowered.com/api/appdetails' +
    '?appids=' + appid + '&filters=release_date&cc=us&l=english';

  const r = await fetch(url, {
    signal,
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);

  const j = await r.json();
  const node = j && j[appid];
  if (!node || !node.success || !node.data) throw new Error('no data');

  const rd = node.data.release_date || {};
  return {
    coming_soon: !!rd.coming_soon,
    date: String(rd.date || ''),
    ymd: toYmd(rd.date),
  };
}

// Chay theo tung top nho de khong bi Steam chan vi goi qua day mot luc.
async function pool(ids, size, job) {
  const out = {};
  let i = 0;

  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++];
      try {
        out[id] = await job(id);
      } catch (e) {
        /* thieu mot game thi bo qua — client giu moc cu */
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(size, ids.length) }, worker)
  );
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  const ids = String((req.query && req.query.ids) || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^\d{2,10}$/.test(x))
    .filter((x, k, a) => a.indexOf(x) === k)
    .slice(0, 32);

  if (!ids.length) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({ ok: false, error: 'thieu tham so ids', items: {} });
    return;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);

  try {
    const items = await pool(ids, 6, (id) => readOne(id, ctrl.signal));
    clearTimeout(timer);

    // Ngay phat hanh hiem khi doi -> cache manh, van lam moi ngam sau 1 gio.
    res.setHeader(
      'Cache-Control',
      'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400'
    );
    res.status(200).json({ ok: true, items });
  } catch (e) {
    clearTimeout(timer);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: false, error: String((e && e.message) || e), items: {} });
  }
};
