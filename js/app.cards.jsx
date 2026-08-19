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
  Img
} = window.NX;

/* ----------------------------------------------------------------------------
   HUY HIEU NEN TANG
   -------------------------------------------------------------------------- */

function PlatformMark({ platform }) {
  const p = PLATFORMS.find(x => x.id === platform) || PLATFORMS[1];
  return (
    <div className="gc__plat" title={p.label} style={{ color: p.tone }}>
      <i className={p.ico}></i>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   THE GAME (luoi)
   -------------------------------------------------------------------------- */

function GameCard({ game, onOpen }) {
  const tone = reviewTone(game.percent, game.reviewText);
  const n = pctNum(game.percent);
  const count = reviewCountNum(game.reviewCount);
  const isCustom = !!customAppIdOf(game);
  const sources = useMemo(() => coverSources(game.appId), [game.appId]);

  return (
    <button className="gc" onClick={() => onOpen(game)} title={game.title}>
      <div className="gc__shot">
        <Img sources={sources} alt={game.title} imgClass="gc__img" />

        <div className="gc__flags">
          {game.redeem && (
            <span className="nx-badge nx-badge--ok">
              <i className="ph-fill ph-key"></i>KÍCH HOẠT
            </span>
          )}
          {isCustom && (
            <span className="nx-badge nx-badge--warn">
              <i className="ph-fill ph-hard-drives"></i>NGUỒN RIÊNG
            </span>
          )}
          {game.viethoa && (
            <span className="nx-badge nx-badge--gold">
              <i className="ph-fill ph-translate"></i>VIỆT HÓA
            </span>
          )}
        </div>

        <PlatformMark platform={getGamePlatform(game)} />

        <div className="gc__play"><i className="ph-fill ph-caret-right"></i></div>

        {n !== null && (
          <div className={'gc__score gc__score--' + tone}
               title={game.reviewText || ''}>
            <b>{Math.round(n)}</b><em>%</em>
          </div>
        )}
      </div>

      <div className="gc__body">
        <div className="gc__title nx-clamp-2">{game.title}</div>
        <div className="gc__meta">
          <span className={'gc__rev gc__rev--dot gc__rev--' + tone}>{game.reviewText}</span>
          {count > 0 && <span className="gc__revn">{fmtCount(count)}<em>đánh giá</em></span>}
        </div>
      </div>
    </button>
  );
}

/* ----------------------------------------------------------------------------
   HANG DANH SACH (che do list)
   -------------------------------------------------------------------------- */

function GameRow({ game, onOpen }) {
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
            <i className={plat.ico}></i>{plat.label}
          </span>
          {n !== null && (
            <span className={'gc__rev gc__rev--dot gc__rev--' + tone}>
              <b className="gc__rev__n">{Math.round(n)}%</b> · {game.reviewText}
            </span>
          )}
          {count > 0 && <span className="gc__revn">{fmtCount(count)}<em>đánh giá</em></span>}
        </div>
      </div>
      <div className="glr__side">
        {game.viethoa && <span className="nx-badge nx-badge--gold"><i className="ph-fill ph-translate"></i>VIỆT HÓA</span>}
        {game.redeem && <span className="nx-badge nx-badge--ok"><i className="ph-fill ph-key"></i>KÍCH HOẠT</span>}
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
  return d ? d + ' · ' + vnTime(iso) : 'Đang cập nhật';
}

/* Bao nhieu phan tram chang duong tu luc cong bo den ngay ra mat da di qua.
   Dung lam thanh tien do — nhin la biet con xa hay sap toi. */
const LEAD_MS = 120 * 86400000;   /* quy uoc: dem lui 120 ngay */

function UpcomingCard({ game, steam }) {
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
            ? <span className="nx-badge nx-badge--ok"><i className="ph-fill ph-rocket-launch"></i>ĐÃ RA MẮT</span>
            : soon
              ? <span className="nx-badge nx-badge--warn"><i className="ph-fill ph-fire"></i>SẮP TỚI</span>
              : <span className="nx-badge nx-badge--br"><i className="ph-fill ph-hourglass-high"></i>SẮP RA MẮT</span>}
        </div>
        {rel.moved !== 0 && (
          <div className="uc__moved" title={'Steam đã dời lịch ' + Math.abs(rel.moved) + ' ngày'}>
            <i className="ph-bold ph-arrows-clockwise"></i>
            {rel.moved > 0 ? 'DỜI LẠI' : 'SỚM HƠN'}
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
          <span className="uc__tz" title="Múi giờ Việt Nam (UTC+7)">GMT+7</span>
        </div>
        {wd && <div className="uc__wd">{wd}{rel.source === 'steam' ? ' · theo Steam' : ''}</div>}

        {done ? (
          <div className="cd--done">
            <i className="ph-fill ph-check-circle"></i>ĐÃ PHÁT HÀNH
          </div>
        ) : (
          <React.Fragment>
            <div className="cd">
              {[['NGÀY', t.d], ['GIỜ', t.h], ['PHÚT', t.m], ['GIÂY', t.s]].map(([l, v], i) => (
                <div className="cd__cell" key={l} style={{ '--i': i }}>
                  <span className="cd__n" key={l + v}>{String(v).padStart(2, '0')}</span>
                  <span className="cd__l">{l}</span>
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

const DRAG_MIN = 6;

function Shelf({ title, icon, sub, children, action }) {
  const ref = useRef(null);
  const secRef = useReveal();
  const [edge, setEdge] = useState({ start: true, end: false });
  const [grab, setGrab] = useState(false);
  const drag = useRef({
    down: false, moved: false, cap: false,
    x: 0, left: 0, id: 0, px: 0, t: 0, v: 0
  });

  /* Cu truot theo da sau khi tha tay */
  const glide = useRef(0);
  const stopGlide = useCallback(() => {
    if (glide.current) { cancelAnimationFrame(glide.current); glide.current = 0; }
  }, []);
  useEffect(() => stopGlide, [stopGlide]);

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
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); };
  }, [measure, children]);

  const nudge = dir => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.82), behavior: 'smooth' });
  };

  /* --- nam & keo --------------------------------------------------------- */

  const onDown = e => {
    const el = ref.current;
    if (!el || e.button !== 0 || e.pointerType === 'touch') return;   /* cham: de trinh duyet tu lo */
    stopGlide();
    drag.current = {
      down: true, moved: false, cap: false,
      x: e.clientX, left: el.scrollLeft, id: e.pointerId,
      px: e.clientX, t: performance.now(), v: 0
    };
  };

  const onMove = e => {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d.down) return;

    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) <= DRAG_MIN) return;
      d.moved = true;
      setGrab(true);
      /* Bat con tro SAU khi da vuot nguong, neu khong Chromium se nuot mat
         cu click vao the game ben trong. */
      try { el.setPointerCapture(e.pointerId); d.cap = true; } catch (err) {}
    }
    /* Van toc tuc thoi (px moi ms) — lam min de mot khung hinh giat khong
       lam hong cu truot theo da phia sau. */
    const now = performance.now();
    const dt = Math.max(1, now - d.t);
    d.v = d.v * 0.7 + ((e.clientX - d.px) / dt) * 0.3;
    d.px = e.clientX;
    d.t = now;

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

    /* Tha tay van con da: truot tiep roi cham dan lai, giong lat trang tren
       dien thoai. Nguoi dung tat hieu ung chuyen dong thi dung ngay. */
    let v = d.v;
    if (Math.abs(v) < 0.09 || prefersCalm()) return;
    const step = () => {
      const n = ref.current;
      if (!n) { glide.current = 0; return; }
      v *= 0.93;
      n.scrollLeft -= v * 16;
      glide.current = Math.abs(v) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    glide.current = requestAnimationFrame(step);
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
                disabled={edge.start} aria-label="Lùi lại">
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
                disabled={edge.end} aria-label="Tiến tới">
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
  return (
    <button className="gen" style={{ '--gen-grad': genre.grad }} onClick={() => onPick(genre.tag)}>
      <i className={'gen__ico ' + genre.ico}></i>
      <div className="gen__txt">
        <div className="gen__t">{genre.tag}</div>
        <div className="gen__n">{count} trò chơi</div>
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
