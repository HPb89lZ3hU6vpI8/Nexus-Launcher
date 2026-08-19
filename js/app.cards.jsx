/* ============================================================================
   NEXUS LAUNCHER — THE GAME, HANG DANH SACH, THE SAP RA MAT, KE NGANG, THE LOAI
   Phu thuoc: window.NX (app.core.jsx)
   ========================================================================== */

(function () {
  'use strict';

const { useState, useEffect, useRef, useMemo, useCallback } = React;

const {
  PLATFORMS,
  pctNum, reviewTone, TONE_ICON, reviewCountNum, fmtCount,
  getGamePlatform, isOnlineGame, customAppIdOf,
  coverSources, useCountdown,
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
          <div className={'gc__score gc__score--' + tone}>
            <i className={TONE_ICON[tone]}></i>
            {Math.round(n)}%
          </div>
        )}
      </div>

      <div className="gc__body">
        <div className="gc__title nx-clamp-2">{game.title}</div>
        <div className="gc__meta">
          <span className={'gc__rev gc__rev--' + tone}>{game.reviewText}</span>
          {count > 0 && <span className="gc__revn">{fmtCount(count)} đánh giá</span>}
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
            <span className={'gc__rev gc__rev--' + tone}>
              <i className={TONE_ICON[tone]} style={{ marginRight: 4 }}></i>
              {Math.round(n)}% · {game.reviewText}
            </span>
          )}
          {count > 0 && <span className="gc__revn">{fmtCount(count)} đánh giá</span>}
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
   Het gio -> hien "DA PHAT HANH" thay vi dung im o 00 ngay 00:00:00.
   -------------------------------------------------------------------------- */

function fmtReleaseDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Đang cập nhật';
  const p = n => String(n).padStart(2, '0');
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
         ' · ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function UpcomingCard({ game }) {
  const t = useCountdown(game.targetDate);
  const sources = useMemo(
    () => (game.cover ? [game.cover] : []).concat(coverSources(game.appId)),
    [game.appId, game.cover]
  );

  return (
    <div className="uc">
      <div className="uc__shot">
        <Img sources={sources} alt={game.title} imgClass="gc__img" />
        <div className="uc__tag">
          {t.done
            ? <span className="nx-badge nx-badge--ok"><i className="ph-fill ph-rocket-launch"></i>ĐÃ RA MẮT</span>
            : <span className="nx-badge nx-badge--br"><i className="ph-fill ph-hourglass-high"></i>SẮP RA MẮT</span>}
        </div>
      </div>
      <div className="uc__body">
        <div className="uc__title nx-clamp-2">{game.title}</div>
        <div className="uc__date">
          <i className="ph-bold ph-calendar-blank"></i>
          {fmtReleaseDate(game.targetDate)}
        </div>

        {t.done ? (
          <div className="cd--done">
            <i className="ph-fill ph-check-circle"></i>ĐÃ PHÁT HÀNH
          </div>
        ) : (
          <div className="cd">
            {[['NGÀY', t.d], ['GIỜ', t.h], ['PHÚT', t.m], ['GIÂY', t.s]].map(([l, v]) => (
              <div className="cd__cell" key={l}>
                <span className="cd__n">{String(v).padStart(2, '0')}</span>
                <span className="cd__l">{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
   KE NGANG CO CUON — mui ten hien khi hover, tu an khi cham dau/cuoi
   -------------------------------------------------------------------------- */

function Shelf({ title, icon, sub, children, action }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

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

  return (
    <section className="nx-sec">
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
        <div className="shelf__track" ref={ref}>{children}</div>
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
