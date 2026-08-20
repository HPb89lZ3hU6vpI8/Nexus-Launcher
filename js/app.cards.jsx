/* ============================================================================
   NEXUS LAUNCHER — THE GAME, HANG DANH SACH, THE SAP RA MAT, KE NGANG, THE LOAI
   Phu thuoc: window.NX (app.core.jsx)
   ========================================================================== */

(function () {
  'use strict';

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const {
  PLATFORMS,
  pctNum, reviewTone, reviewCountNum, fmtCount,
  getGamePlatform, isOnlineGame, customAppIdOf,
  coverSources, useCountdown, useReveal, prefersCalm,
  vnDate, vnTime, vnWeekday, mergeRelease,
  Img, TX, useLang
} = window.NX;

/* ----------------------------------------------------------------------------
   HUY HIEU NEN TANG
   -------------------------------------------------------------------------- */

function PlatformMark({ platform }) {
  const p = PLATFORMS.find(x => x.id === platform) || PLATFORMS[1];
  return (
    <div className="gc__plat" title={TX(p.label)} style={{ color: p.tone }}>
      <i className={p.ico}></i>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   THE GAME (luoi)
   -------------------------------------------------------------------------- */

function GameCard({ game, onOpen, eager }) {
  useLang();
  const tone = reviewTone(game.percent, game.reviewText);
  const pct = pctNum(game.percent);
  const count = reviewCountNum(game.reviewCount);
  const isCustom = !!customAppIdOf(game);
  const sources = useMemo(() => coverSources(game.appId), [game.appId]);
  /* The loai dau tien lam nhan phu — lap khoang trong ben phai ten tro choi */
  const genre = (game.tags && game.tags[0]) || '';

  return (
    <button className="gc" onClick={() => onOpen(game)} title={game.title}>
      <div className="gc__shot">
        <Img sources={sources} alt={game.title} imgClass="gc__img" eager={eager} />

        <div className="gc__flags">
          {game.redeem && (
            <span className="nx-badge nx-badge--ok">
              <i className="ph-fill ph-key"></i>{TX('KÍCH HOẠT')}
            </span>
          )}
          {isCustom && (
            <span className="nx-badge nx-badge--warn">
              <i className="ph-fill ph-hard-drives"></i>{TX('NGUỒN RIÊNG')}
            </span>
          )}
          {game.viethoa && (
            <span className="nx-badge nx-badge--gold">
              <i className="ph-fill ph-translate"></i>{TX('VIỆT HÓA')}
            </span>
          )}
        </div>

        <PlatformMark platform={getGamePlatform(game)} />
      </div>

      <div className="gc__body">
        <div className="gc__head">
          <div className="gc__title nx-clamp-2">{game.title}</div>
          {genre && <span className="gc__gen">{TX(genre)}</span>}
        </div>
        {/* Con so diem truoc day noi mot minh tren anh bia: vua che anh, vua
            khong tu noi duoc no la gi. Nay no nam ngay truoc dong chu danh gia
            -- "81 RAT TICH CUC" -- nen chinh dong chu do la loi giai thich cho
            con so, khong ton them mot chu nao ma anh bia thi sach hoan toan.
            Khong co diem thi rot lai ve dau cham mau nhu cu. */}
        <div className="gc__meta">
          <span className={'gc__rev ' + (pct === null ? 'gc__rev--dot ' : '') +
            (TX(game.reviewText).length >= 22 ? 'gc__rev--xxl ' :
             TX(game.reviewText).length >= 20 ? 'gc__rev--xlong ' :
             TX(game.reviewText).length >= 15 ? 'gc__rev--long ' : '') + 'gc__rev--' + tone}>
            {pct !== null && <b className="gc__rev__n">{Math.round(pct)}<i>%</i></b>}
            <span className="gc__rev__t">{TX(game.reviewText)}</span>
          </span>
          {/* Mot con so tran nhu "1K" khong noi len duoc no dem cai gi, nen chu
              "danh gia" bat buoc phai co. Chu duoc thu nho va lam mo hon con so de
              hang nay khong tranh cho voi nhan sac thai ben trai. Khi nhan sac thai
              qua dai (ban tieng Anh) thi cho nhan do xuong hai dong -- tuyet doi
              khong cat bot cum so + chu nay. */}
          {count > 0 && (
            <span className="gc__revn">
              {fmtCount(count)}<em>{TX('lượt đánh giá')}</em>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ----------------------------------------------------------------------------
   HANG DANH SACH (che do list)
   -------------------------------------------------------------------------- */

function GameRow({ game, onOpen }) {
  useLang();
  const tone = reviewTone(game.percent, game.reviewText);
  const n = pctNum(game.percent);
  const count = reviewCountNum(game.reviewCount);
  const sources = useMemo(() => coverSources(game.appId), [game.appId]);
  const plat = PLATFORMS.find(x => x.id === getGamePlatform(game)) || PLATFORMS[1];

  return (
    <button className="glr" onClick={() => onOpen(game)} title={game.title}>
      <div className="glr__shot"><Img sources={sources} alt={game.title} imgClass="gc__img" /></div>
      <div className="glr__main">
        <div className="glr__title">{game.title}</div>
        <div className="glr__sub">
          <span className="nx-tag" style={{ color: plat.tone }}>
            <i className={plat.ico}></i>{TX(plat.label)}
          </span>
          {n !== null && (
            <span className={'gc__rev gc__rev--dot gc__rev--' + tone}>
              <b className="gc__rev__n">{Math.round(n)}<i>%</i></b> · {TX(game.reviewText)}
            </span>
          )}
          {count > 0 && <span className="gc__revn">{fmtCount(count)}<em>{TX('lượt đánh giá')}</em></span>}
        </div>
      </div>
      <div className="glr__side">
        {game.viethoa && <span className="nx-badge nx-badge--gold"><i className="ph-fill ph-translate"></i>{TX('VIỆT HÓA')}</span>}
        {game.redeem && <span className="nx-badge nx-badge--ok"><i className="ph-fill ph-key"></i>{TX('KÍCH HOẠT')}</span>}
        {isOnlineGame(game) && <span className="nx-badge nx-badge--info"><i className="ph-fill ph-globe"></i>ONLINE</span>}
        <i className="ph-bold ph-caret-right glr__go"></i>
      </div>
    </button>
  );
}

/* ----------------------------------------------------------------------------
   THE SAP RA MAT + DEM NGUOC
   Moc gio luon quy ve gio Viet Nam (xem vnParts trong app.core.jsx), va duoc
   doi chieu voi ngay Steam dang niem yet — game bi doi lich se tu cap nhat.
   Het gio -> hien "DA PHAT HANH" thay vi dung im o 00 ngay 00:00:00.
   -------------------------------------------------------------------------- */

/* "18/08/2026 · 22:00" theo gio Viet Nam, bat ke may dang o mui gio nao */
function fmtReleaseDate(iso) {
  const d = vnDate(iso);
  return d ? d + ' · ' + vnTime(iso) : TX('Đang cập nhật');
}

/* Bao nhieu phan tram chang duong tu luc cong bo den ngay ra mat da di qua.
   Dung lam thanh tien do — nhin la biet con xa hay sap toi. */
const LEAD_MS = 120 * 86400000;   /* quy uoc: dem lui 120 ngay */

function UpcomingCard({ game, steam }) {
  useLang();
  const rel = useMemo(function () { return mergeRelease(game, steam); }, [game, steam]);
  const t = useCountdown(rel.target);
  const done = t.done || rel.released;

  const sources = useMemo(
    () => (game.cover ? [game.cover] : []).concat(coverSources(game.appId)),
    [game.appId, game.cover]
  );

  const left = t.d * 86400000 + t.h * 3600000 + t.m * 60000 + t.s * 1000;
  const pct = done ? 100 : Math.max(2, Math.min(100, Math.round((1 - left / LEAD_MS) * 100)));
  const wd = vnWeekday(rel.target);
  const soon = !done && t.d <= 7;

  return (
    <div className={'uc' + (done ? ' is-done' : '') + (soon ? ' is-soon' : '')}>
      <div className="uc__shot">
        <Img sources={sources} alt={game.title} imgClass="gc__img" />
        <div className="uc__tag">
          {done
            ? <span className="nx-badge nx-badge--ok"><i className="ph-fill ph-rocket-launch"></i>{TX('ĐÃ RA MẮT')}</span>
            : soon
              ? <span className="nx-badge nx-badge--warn"><i className="ph-fill ph-fire"></i>{TX('SẮP TỚI')}</span>
              : <span className="nx-badge nx-badge--br"><i className="ph-fill ph-hourglass-high"></i>{TX('SẮP RA MẮT')}</span>}
        </div>
        {rel.moved !== 0 && (
          <div className="uc__moved" title={TX('Steam đã dời lịch {n} ngày', { n: Math.abs(rel.moved) })}>
            <i className="ph-bold ph-arrows-clockwise"></i>
            {rel.moved > 0 ? TX('DỜI LẠI') : TX('SỚM HƠN')}
          </div>
        )}
        <div className="uc__glow" aria-hidden="true" />
      </div>

      <div className="uc__body">
        <div className="uc__title nx-clamp-2">{game.title}</div>

        <div className="uc__when">
          <span className="uc__date">
            <i className="ph-bold ph-calendar-blank"></i>
            {fmtReleaseDate(rel.target)}
          </span>
          <span className="uc__tz" title={TX('Múi giờ Việt Nam (UTC+7)')}>GMT+7</span>
        </div>
        {wd && <div className="uc__wd">{wd}{rel.source === 'steam' ? ' · ' + TX('theo Steam') : ''}</div>}

        {done ? (
          <div className="cd--done">
            <i className="ph-fill ph-check-circle"></i>{TX('ĐÃ PHÁT HÀNH')}
          </div>
        ) : (
          <React.Fragment>
            <div className="cd">
              {[['NGÀY', t.d], ['GIỜ', t.h], ['PHÚT', t.m], ['GIÂY', t.s]].map(([l, v], i) => (
                <div className="cd__cell" key={l} style={{ '--i': i }}>
                  <span className="cd__n" key={l + v}>{String(v).padStart(2, '0')}</span>
                  <span className="cd__l">{TX(l)}</span>
                </div>
              ))}
            </div>
            <div className="cd__rail" aria-hidden="true">
              <i style={{ width: pct + '%' }} />
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   KE NGANG CO CUON
   Mui ten hien khi hover (tu an khi cham dau/cuoi) VA nam keo bang chuot trai.
   Keo qua nguong DRAG_MIN moi tinh la keo — duoi nguong van la mot cu bam,
   nen bam vao the game khong bao gio bi hieu nham thanh keo.
   -------------------------------------------------------------------------- */

/* Vat ly cuon ngang -------------------------------------------------------
   DRAG_MIN : keo qua bao nhieu px moi tinh la keo (duoi nguong van la mot cu bam)
   FRICTION : ma sat cho MOI 16.67ms, roi quy doi theo thoi gian that -> man
              144Hz va man 60Hz truot giong het nhau. Truoc day code tru cung
              mot luong moi khung hinh nen man cang nhanh truot cang vot xa.
   V_MIN    : buong tay cham hon muc nay thi khong truot theo da
   V_STOP   : cham hon muc nay thi coi nhu da dung han
   BRAKE    : phanh khi sap cham hai dau. Toc do toi da cho phep = BRAKE * so px
              con lai, nen xe tu nha ga va do nhe vao mep -- khoang 100px
              cuoi la bat dau ha toc. Day chinh la cho truoc kia dam thang
              vao tuong roi dung khuc mot cai.                               */
/* Toa do ngang cua chuot, quy ve DUNG he pixel ma scrollLeft dang dung.
   Ca trang duoc phong to theo man hinh (xem script o dau index.html). Chuot
   tra ve toa do DA nhan he so phong to, con scrollLeft thi khong. Tron thang
   hai thu do lai se lam anh chay nhanh hon -- hoac cham hon -- ngon tay, nhin
   nhu anh bi truot khoi con tro. Chia lai cho khop. */
function cx(e) { return e.clientX / (window.NXZ ? window.NXZ() : 1); }

const DRAG_MIN = 6;
const FRICTION = 0.94;
const V_MIN = 0.055;
const V_STOP = 0.015;
const BRAKE = 0.022;
const NUDGE_MS = 460;

/* Nhanh luc dau, cham dan luc ve dich. Dung chung cho mui ten va cu truot
   theo da nen ca hai cho cung mot cam giac tay. */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function Shelf({ title, icon, sub, children, action }) {
  const ref = useRef(null);
  const secRef = useReveal();
  const [edge, setEdge] = useState({ start: true, end: false });
  const [grab, setGrab] = useState(false);
  const drag = useRef({
    down: false, moved: false, cap: false,
    x: 0, left: 0, id: 0, s: []
  });

  /* MOT vong requestAnimationFrame duy nhat dung chung cho ca cu truot theo da
     lan cu bam mui ten, de hai thu khong bao gio chay chong len nhau. */
  const anim = useRef(0);
  const stopAnim = useCallback(() => {
    if (anim.current) { cancelAnimationFrame(anim.current); anim.current = 0; }
  }, []);
  useEffect(() => stopAnim, [stopAnim]);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 || max <= 0 });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    /* Lan chuot ngang la nguoi dung tu lai: nhuong quyen ngay, dung de cu
       truot cu con lai giang co voi ho. */
    const onWheel = () => stopAnim();
    el.addEventListener('scroll', measure, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      el.removeEventListener('wheel', onWheel);
      ro.disconnect();
    };
  }, [measure, stopAnim, children]);

  /* Mui ten: nhay dung mot so nguyen the (be rong the + khe) nen hang the van
     dung thang hang sau moi cu bam. Truoc day viec canh hang nay do scroll-snap
     lo, ma chinh scroll-snap lai la thu lam giat cu keo tay -- nay tu tinh lay
     thi vua thang hang vua khong con ai giang co voi ai. */
  const nudge = dir => {
    const el = ref.current;
    if (!el) return;
    stopAnim();
    const first = el.firstElementChild;
    /* offsetWidth chu khong phai getBoundingClientRect: cai sau da nhan he so
       phong to roi, dem chung voi clientWidth ben duoi la lech nhau. */
    const cell = first ? first.offsetWidth + 18 : 280;
    const span = Math.max(cell, Math.floor(el.clientWidth / cell) * cell);
    const max = el.scrollWidth - el.clientWidth;
    const from = el.scrollLeft;
    const to = Math.max(0, Math.min(max, from + dir * span));
    if (to === from) return;
    if (prefersCalm()) { el.scrollLeft = to; return; }
    const t0 = performance.now();
    const run = ts => {
      const n = ref.current;
      if (!n) { anim.current = 0; return; }
      const k = Math.min(1, (ts - t0) / NUDGE_MS);
      n.scrollLeft = from + (to - from) * easeOutCubic(k);
      anim.current = k < 1 ? requestAnimationFrame(run) : 0;
    };
    anim.current = requestAnimationFrame(run);
  };

  /* --- nam & keo --------------------------------------------------------- */

  const onDown = e => {
    const el = ref.current;
    if (!el || e.button !== 0 || e.pointerType === 'touch') return;   /* cham: de trinh duyet tu lo */
    stopAnim();
    drag.current = {
      down: true, moved: false, cap: false,
      x: cx(e), left: el.scrollLeft, id: e.pointerId,
      s: [performance.now(), cx(e)]
    };
  };

  const onMove = e => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d.down) return;

    const dx = cx(e) - d.x;
    if (!d.moved) {
      if (Math.abs(dx) <= DRAG_MIN) return;
      d.moved = true;
      setGrab(true);
      /* Bat con tro SAU khi da vuot nguong, neu khong Chromium se nuot mat
         cu click vao the game ben trong. */
      try { el.setPointerCapture(e.pointerId); d.cap = true; } catch (err) {}
    }
    /* Ghi lai vet tay: tung cap (thoi diem, toa do). Lat nua do van toc tren
       ca doan ~100ms cuoi chu khong chi nhin khung hinh chot, nen mot khung
       hinh bi giat khong con lam hong cu truot. */
    const s = d.s;
    s.push(performance.now(), cx(e));
    if (s.length > 24) s.splice(0, s.length - 24);

    el.scrollLeft = d.left - dx;
  };

  const onUp = () => {
    const el = ref.current;
    const d = drag.current;
    if (d.cap && el) { try { el.releasePointerCapture(d.id); } catch (err) {} }
    d.down = false;
    d.cap = false;
    if (!d.moved) return;
    setGrab(false);
    if (!el || prefersCalm()) return;

    /* Van toc luc buong tay, do tren quang duong ~100ms cuoi cung (px moi ms) */
    const s = d.s || [];
    const n = s.length;
    let v = 0;
    if (n >= 4) {
      let i = n - 2;
      while (i >= 2 && s[n - 2] - s[i - 2] < 100) i -= 2;
      const dt = s[n - 2] - s[i];
      if (dt > 8) v = (s[n - 1] - s[i + 1]) / dt;
    }
    if (Math.abs(v) < V_MIN) return;

    let last = performance.now();
    const step = ts => {
      const el2 = ref.current;
      if (!el2) { anim.current = 0; return; }
      const dt = Math.min(48, ts - last);    /* tab bi treo thi khong nhay coc */
      last = ts;
      v *= Math.pow(FRICTION, dt / 16.667);

      const max = el2.scrollWidth - el2.clientWidth;
      const cur = el2.scrollLeft;
      /* v duong = tay keo sang phai = scrollLeft dang giam ve 0 */
      const room = Math.max(0, v > 0 ? cur : max - cur);
      const lim = BRAKE * room + V_STOP;
      if (Math.abs(v) > lim) v = v > 0 ? lim : -lim;

      let next = cur - v * dt;
      if (next <= 0) { next = 0; v = 0; }
      else if (next >= max) { next = max; v = 0; }
      el2.scrollLeft = next;

      anim.current = Math.abs(v) > V_STOP ? requestAnimationFrame(step) : 0;
    };
    anim.current = requestAnimationFrame(step);
  };

  /* Vua keo xong thi chan cu click de khong lo mo nham game */
  const onClickCapture = e => {
    if (!drag.current.moved) return;
    drag.current.moved = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <section className="nx-sec nx-reveal" ref={secRef}>
      <div className="nx-sec__head">
        <h2 className="nx-sec__title">{icon && <i className={icon}></i>}{title}</h2>
        {sub && <span className="nx-sec__sub">{sub}</span>}
        <span className="nx-sec__spacer" />
        {action}
      </div>
      <div className={'shelf' + (edge.start ? ' at-start' : '') + (edge.end ? ' at-end' : '')}
           style={{ marginLeft: 'calc(var(--pad-page) * -1)', marginRight: 'calc(var(--pad-page) * -1)' }}>
        <button className="shelf__nav shelf__nav--l" onClick={() => nudge(-1)}
                disabled={edge.start} aria-label={TX('Lùi lại')}>
          <i className="ph-bold ph-caret-left"></i>
        </button>
        <div className={'shelf__track' + (grab ? ' is-grab' : '')}
             ref={ref}
             onPointerDown={onDown}
             onPointerMove={onMove}
             onPointerUp={onUp}
             onPointerCancel={onUp}
             onClickCapture={onClickCapture}>
          {children}
        </div>
        <button className="shelf__nav shelf__nav--r" onClick={() => nudge(1)}
                disabled={edge.end} aria-label={TX('Tiến tới')}>
          <i className="ph-bold ph-caret-right"></i>
        </button>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------
   THE LOAI
   -------------------------------------------------------------------------- */

const GENRES = [
  { tag: 'HÀNH ĐỘNG',  ico: 'ph-fill ph-sword',         grad: 'linear-gradient(135deg,#ff4f6d,#ff9445)' },
  { tag: 'PHIÊU LƯU',  ico: 'ph-fill ph-compass',       grad: 'linear-gradient(135deg,#3ad8ff,#5aa8ff)' },
  { tag: 'NHẬP VAI',   ico: 'ph-fill ph-shield-chevron',grad: 'linear-gradient(135deg,#8b6cff,#c86cff)' },
  { tag: 'MÔ PHỎNG',   ico: 'ph-fill ph-factory',     grad: 'linear-gradient(135deg,#2fe0a4,#3ad8ff)' },
  { tag: 'HỢP TÁC',    ico: 'ph-fill ph-users-three',   grad: 'linear-gradient(135deg,#ffb545,#ffcf5c)' },
  { tag: 'CHIẾN LƯỢC', ico: 'ph-fill ph-strategy',  grad: 'linear-gradient(135deg,#5aa8ff,#8b6cff)' }
];

function GenreCard({ genre, count, onPick }) {
  useLang();
  return (
    <button className="gen" style={{ '--gen-grad': genre.grad }} onClick={() => onPick(genre.tag)}>
      <i className={'gen__ico ' + genre.ico}></i>
      <div className="gen__txt">
        <div className="gen__t">{TX(genre.tag)}</div>
        <div className="gen__n">{TX('{n} trò chơi', { n: count })}</div>
      </div>
    </button>
  );
}

/* ----------------------------------------------------------------------------
   XUAT RA
   -------------------------------------------------------------------------- */

Object.assign(window.NX, {
  PlatformMark, GameCard, GameRow, UpcomingCard, Shelf, GENRES, GenreCard
});

})();
