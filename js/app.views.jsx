/* ============================================================================
   NEXUS LAUNCHER — TRANG CHU · THU VIEN · TRANG KHONG HO TRO
   Phu thuoc: window.NX (app.core.jsx, app.cards.jsx)
   ========================================================================== */

(function () {
  'use strict';

  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const {
    DISCORD_URL,
    openExternal,
    pctNum, reviewTone, TONE_ICON, reviewCountNum, fmtCount, sortKey,
    isOnlineGame, customAppIdOf,
    coverSources, heroSources, fetchMedia, fetchTranslation,
    useClickOutside, useReveal,
    GameCard, GameRow, UpcomingCard, Shelf, GENRES, GenreCard,
    useSteamReleases,
    Empty
  } = window.NX;

  /* --------------------------------------------------------------------------
     TIEN ICH
     ------------------------------------------------------------------------ */

  const _tmp = document.createElement('textarea');
  function plain(html) {
    if (!html) return '';
    _tmp.innerHTML = String(html).replace(/<[^>]+>/g, ' ');
    return _tmp.value.replace(/\s+/g, ' ').trim();
  }

  /* Tai anh nen theo danh sach du phong — tra ve URL dau tien tai duoc */
  function useBgImage(list) {
    const key = (list && list[0]) || '';
    const [st, setSt] = useState({ src: '', ready: false });

    useEffect(function () {
      let alive = true;
      setSt({ src: '', ready: false });
      if (!list || !list.length) return undefined;

      let n = 0;
      const step = function () {
        if (!alive) return;
        if (n >= list.length) { setSt({ src: list[list.length - 1], ready: true }); return; }
        const url = list[n++];
        const im = new Image();
        im.onload = function () { if (alive) setSt({ src: url, ready: true }); };
        im.onerror = step;
        im.src = url;
      };
      step();

      return function () { alive = false; };
      /* eslint-disable-next-line */
    }, [key]);

    return st;
  }

  const byNewest = function (a, b) {
    const x = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const y = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return (isNaN(y) ? 0 : y) - (isNaN(x) ? 0 : x);
  };

  /* ==========================================================================
     HERO TRANG CHU — bang chuyen tu dong, dung khi ro chuot
     ========================================================================== */

  const HERO_MS = 7400;

  /* Cat mo ta cho vua khung, khong cat giua chung mot tu */
  function clipDesc(s) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length > 238 ? t.slice(0, 236).replace(/\s+\S*$/, '') + '…' : t;
  }

  function Hero({ picks, onOpen, onLibrary }) {
    const [i, setI] = useState(0);
    const [hold, setHold] = useState(false);

    const g = picks[i] || picks[0];
    const appId = g && g.appId ? String(g.appId) : '';

    const srcs = useMemo(function () { return heroSources(appId); }, [appId]);
    const bg = useBgImage(srcs);

    /* Mo ta: hien ban goc ngay khi co, roi lang le thay bang ban tieng Viet.
       Game nao Steam da co san trang tieng Viet thi khong goi ban dich nua. */
    const [desc, setDesc] = useState('');
    useEffect(function () {
      let alive = true;
      setDesc('');
      if (!appId) return undefined;

      fetchMedia(appId).then(function (d) {
        if (!alive || !d) return;
        const s = clipDesc(plain(d.desc) || plain(d.about));
        if (s) setDesc(s);

        const lang = String(d.desc_lang || d.about_lang || '').toLowerCase();
        if (lang === 'vi') return;
        fetchTranslation(appId).then(function (t) {
          if (!alive || !t) return;
          const v = clipDesc(plain(t.desc) || plain(t.about));
          if (v) setDesc(v);
        });
      });

      return function () { alive = false; };
    }, [appId]);

    /* Dem gio con lai cua slide. Ro chuot vao la dung, roi chuot ra thi chay
       tiep dung cho vua dung — thanh chay duoi cham cung theo nhip nay. */
    const leftRef = useRef(HERO_MS);
    const t0Ref = useRef(0);

    useEffect(function () { leftRef.current = HERO_MS; }, [i]);

    useEffect(function () {
      if (hold || picks.length < 2) return undefined;
      t0Ref.current = Date.now();
      const t = setTimeout(function () {
        setI(function (v) { return (v + 1) % picks.length; });
      }, leftRef.current);
      return function () {
        clearTimeout(t);
        const used = Date.now() - t0Ref.current;
        leftRef.current = Math.max(500, leftRef.current - used);
      };
    }, [i, hold, picks.length]);

    if (!g) return null;

    const tone = reviewTone(g.percent, g.reviewText);
    const pct = pctNum(g.percent);
    const cnt = reviewCountNum(g.reviewCount);
    const tags = (Array.isArray(g.tags) ? g.tags : []).slice(0, 2);

    return (
      <section
        className="hero"
        onMouseEnter={function () { setHold(true); }}
        onMouseLeave={function () { setHold(false); }}
      >
        <div className={'hero__bg' + (bg.ready ? ' is-in' : '')}
             style={bg.src ? { backgroundImage: 'url("' + bg.src + '")' } : null}
             key={appId} />
        <div className="hero__scrim" />
        <div className="hero__aurora"><i /><i /></div>
        <div className="hero__edge" />

        <div className="hero__in" key={'in-' + appId}>
          <div className="hero__eyebrow">
            <i className="ph-fill ph-flame"></i>
            <span>Nổi bật hôm nay</span>
          </div>

          <h1 className="hero__title">{g.title}</h1>

          {/* Mot dai kinh duy nhat thay cho chum huy hieu roi rac truoc day */}
          <div className={'hero__strip hero__strip--' + tone}>
            {pct !== null && (
              <span className="hero__cell hero__cell--score">
                <b className="hero__pct">{Math.round(pct)}<em>%</em></b>
                <span className="hero__tone">{g.reviewText}</span>
              </span>
            )}
            {pct !== null && cnt > 0 && <i className="hero__sep" />}
            {cnt > 0 && (
              <span className="hero__cell hero__cell--cnt">
                <i className="ph-fill ph-users-three"></i>{fmtCount(cnt)}
              </span>
            )}
            {tags.length > 0 && <i className="hero__sep" />}
            {tags.map(function (t) {
              return <span className="hero__cell hero__cell--tag" key={t}>{t}</span>;
            })}
            {g.viethoa && (
              <span className="hero__chip hero__chip--vi">
                <i className="ph-fill ph-translate"></i>Việt hoá
              </span>
            )}
            {isOnlineGame(g) && (
              <span className="hero__chip hero__chip--on">
                <i className="ph-fill ph-globe-simple"></i>Online
              </span>
            )}
          </div>

          <p className="hero__desc nx-clamp-3">
            {desc || 'Thư viện Nexus tổng hợp trò chơi bản quyền — truy cập nhanh, cài đặt gọn, không quảng cáo.'}
          </p>

          <div className="hero__acts">
            <button className="nx-btn nx-btn--primary nx-btn--lg hero__cta" onClick={function () { onOpen(g); }}>
              <i className="ph-fill ph-play"></i>Xem chi tiết
            </button>
            <button className="nx-btn nx-btn--ghost nx-btn--lg" onClick={onLibrary}>
              <i className="ph-bold ph-squares-four"></i>Toàn bộ thư viện
            </button>
          </div>
        </div>

        {picks.length > 1 && (
          <div className={'hero__nav' + (hold ? ' is-hold' : '')}>
            <span className="hero__num">
              <b>{('0' + (i + 1)).slice(-2)}</b>
              <i />
              {('0' + picks.length).slice(-2)}
            </span>
            <div className="hero__dots">
              {picks.map(function (p, k) {
                return (
                  <button
                    key={p.id || p.appId || k}
                    className={'hero__dot' + (k === i ? ' is-on' : '')}
                    onClick={function () { setI(k); }}
                    aria-label={'Xem ' + p.title}
                  >
                    {/* Khoa doi theo slide -> thanh chay khoi lai tu dau */}
                    <i key={'f' + i} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ==========================================================================
     TRANG CHU
     ========================================================================== */

  function Stat({ ico, tint, n, label }) {
    return (
      <div className="stat">
        <div className="stat__ico" style={{ background: tint.bg, color: tint.fg }}><i className={ico}></i></div>
        <div>
          <div className="stat__n">{n}</div>
          <div className="stat__l">{label}</div>
        </div>
      </div>
    );
  }

  function HomeContent({ games, upcoming, onOpen, onGenre, onLibrary }) {
    /* Doi chieu lich ra mat voi Steam — game bi doi ngay se tu cap nhat */
    const rel = useSteamReleases(upcoming);

    const picks = useMemo(function () {
      const pool = games.filter(function (g) {
        return g.appId && pctNum(g.percent) !== null && pctNum(g.percent) >= 84 && reviewCountNum(g.reviewCount) >= 15000;
      });
      pool.sort(function (a, b) { return reviewCountNum(b.reviewCount) - reviewCountNum(a.reviewCount); });
      return (pool.length ? pool : games.slice()).slice(0, 5);
    }, [games]);

    const trending = useMemo(function () {
      const pool = games.filter(function (g) { return reviewCountNum(g.reviewCount) > 0; });
      pool.sort(function (a, b) { return reviewCountNum(b.reviewCount) - reviewCountNum(a.reviewCount); });
      return pool.slice(0, 20);
    }, [games]);

    const fresh = useMemo(function () {
      const pool = games.filter(function (g) { return !!g.addedAt; });
      pool.sort(byNewest);
      return pool.slice(0, 20);
    }, [games]);

    const topRated = useMemo(function () {
      const pool = games.filter(function (g) {
        return pctNum(g.percent) !== null && reviewCountNum(g.reviewCount) >= 3000;
      });
      pool.sort(function (a, b) {
        const d = pctNum(b.percent) - pctNum(a.percent);
        return d !== 0 ? d : reviewCountNum(b.reviewCount) - reviewCountNum(a.reviewCount);
      });
      return pool.slice(0, 20);
    }, [games]);

    const viet = useMemo(function () {
      return games.filter(function (g) { return !!g.viethoa; }).sort(byNewest).slice(0, 20);
    }, [games]);

    const genreCounts = useMemo(function () {
      const m = {};
      GENRES.forEach(function (x) { m[x.tag] = 0; });
      games.forEach(function (g) {
        (g.tags || []).forEach(function (t) {
          const k = String(t).toUpperCase();
          if (m[k] !== undefined) m[k] += 1;
        });
      });
      return m;
    }, [games]);

    const stats = useMemo(function () {
      return {
        total: games.length,
        viet: games.filter(function (g) { return !!g.viethoa; }).length,
        custom: games.filter(function (g) { return !!customAppIdOf(g); }).length,
        soon: (upcoming || []).length
      };
    }, [games, upcoming]);

    const seeAll = function (label) {
      return (
        <button className="nx-btn nx-btn--ghost nx-btn--sm" onClick={onLibrary}>
          {label || 'Xem tất cả'}<i className="ph-bold ph-arrow-right"></i>
        </button>
      );
    };

    return (
      <div className="nx-page">
        <Hero picks={picks} onOpen={onOpen} onLibrary={onLibrary} />

        <div className="stat__row">
          <Stat ico="ph-fill ph-game-controller" n={stats.total} label="Trò chơi"
                tint={{ bg: 'var(--br-1-soft)', fg: 'var(--br-1)' }} />
          <Stat ico="ph-fill ph-translate" n={stats.viet} label="Có Việt hóa"
                tint={{ bg: 'var(--gold-soft)', fg: 'var(--gold)' }} />
          <Stat ico="ph-fill ph-hard-drives" n={stats.custom} label="Nguồn riêng"
                tint={{ bg: 'var(--warn-soft)', fg: 'var(--warn)' }} />
          <Stat ico="ph-fill ph-hourglass-high" n={stats.soon} label="Sắp ra mắt"
                tint={{ bg: 'var(--br-3-soft)', fg: 'var(--br-3)' }} />
        </div>

        {trending.length > 0 && (
          <Shelf title="Đang thịnh hành" icon="ph-fill ph-trend-up"
                 sub="Nhiều lượt đánh giá nhất trên Steam" action={seeAll()}>
            {trending.map(function (g) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </Shelf>
        )}

        {fresh.length > 0 && (
          <Shelf title="Mới cập nhật" icon="ph-fill ph-sparkle"
                 sub="Vừa được thêm vào thư viện" action={seeAll()}>
            {fresh.map(function (g) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </Shelf>
        )}

        {(upcoming && upcoming.length > 0) && (
          <Shelf title="Sắp ra mắt" icon="ph-fill ph-rocket-launch"
                 sub="Đếm ngược tới ngày phát hành">
            {upcoming.map(function (g) {
              return <UpcomingCard key={g.id || g.appId} game={g}
                                    steam={rel[String(g.appId)]} />;
            })}
          </Shelf>
        )}

        {topRated.length > 0 && (
          <Shelf title="Đánh giá cao nhất" icon="ph-fill ph-star"
                 sub="Người chơi Steam chấm điểm tốt nhất" action={seeAll()}>
            {topRated.map(function (g) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </Shelf>
        )}

        {viet.length > 0 && (
          <Shelf title="Có Việt hóa" icon="ph-fill ph-translate"
                 sub="Bản dịch tiếng Việt sẵn sàng" action={seeAll()}>
            {viet.map(function (g) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </Shelf>
        )}

        <section className="nx-sec">
          <div className="nx-sec__head">
            <h2 className="nx-sec__title"><i className="ph-fill ph-squares-four"></i>Duyệt theo thể loại</h2>
            <span className="nx-sec__sub">Chọn nhanh phong cách bạn thích</span>
          </div>
          <div className="gen__grid">
            {GENRES.map(function (x) {
              return <GenreCard key={x.tag} genre={x} count={genreCounts[x.tag] || 0} onPick={onGenre} />;
            })}
          </div>
        </section>

        <section className="nx-sec">
          <div style={{ padding: '0 var(--pad-page) 52px' }}>
            <button className="bn bn--discord" onClick={function () { openExternal(DISCORD_URL); }}>
              <span className="bn__ico"><i className="fa-brands fa-discord"></i></span>
              <span style={{ textAlign: 'left' }}>
                <span className="bn__t" style={{ display: 'block' }}>CỘNG ĐỒNG NEXUS</span>
                <span className="bn__d" style={{ display: 'block' }}>
                  Tham gia Discord để nhận game mới, bản vá và hỗ trợ trực tiếp
                </span>
              </span>
              <i className="bn__go ph-bold ph-arrow-up-right"></i>
            </button>
          </div>
        </section>
      </div>
    );
  }

  /* ==========================================================================
     THU VIEN
     ========================================================================== */

  const FILTERS = [
    { id: 'all',     label: 'Tất cả',        ico: 'ph-bold ph-squares-four' },
    { id: 'viethoa', label: 'Việt hóa',      ico: 'ph-fill ph-translate' },
    { id: 'redeem',  label: 'Cần kích hoạt', ico: 'ph-fill ph-key' },
    { id: 'online',  label: 'Chơi mạng',     ico: 'ph-fill ph-globe' },
    { id: 'custom',  label: 'Nguồn riêng',   ico: 'ph-fill ph-hard-drives' }
  ];

  const SORTS = [
    { id: 'az',      label: 'Tên A → Z',            ico: 'ph-bold ph-sort-ascending' },
    { id: 'za',      label: 'Tên Z → A',            ico: 'ph-bold ph-sort-descending' },
    { id: 'rating',  label: 'Điểm đánh giá cao',    ico: 'ph-fill ph-star' },
    { id: 'reviews', label: 'Nhiều lượt đánh giá',  ico: 'ph-fill ph-chat-circle-text' },
    { id: 'new',     label: 'Mới thêm gần đây',     ico: 'ph-bold ph-sparkle' }
  ];

  function Dropdown({ value, options, onPick, icon }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const close = useCallback(function () { setOpen(false); }, []);
    useClickOutside(ref, close, open);

    const cur = options.find(function (o) { return o.id === value; }) || options[0];

    return (
      <div className={'dd' + (open ? ' is-open' : '')} ref={ref}>
        <button className="dd__btn" onClick={function () { setOpen(function (v) { return !v; }); }}>
          <i className={icon || cur.ico}></i>
          {cur.label}
          <i className="ph-bold ph-caret-down"></i>
        </button>
        {open && (
          <div className="dd__menu">
            {options.map(function (o) {
              return (
                <button
                  key={o.id}
                  className={'dd__item' + (o.id === value ? ' is-on' : '')}
                  onClick={function () { onPick(o.id); setOpen(false); }}
                >
                  <i className={o.ico}></i>
                  {o.label}
                  {o.id === value && <i className="dd__tick ph-bold ph-check"></i>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function LibraryContent({ games, onOpen, genre, onClearGenre }) {
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('az');
    const [view, setView] = useState('grid');
    const inputRef = useRef(null);

    /* Ctrl+F / dau "/" -> nhay vao o tim kiem */
    useEffect(function () {
      const h = function (e) {
        const inField = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
        if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (!inField && e.key === '/')) {
          e.preventDefault();
          if (inputRef.current) inputRef.current.focus();
        }
      };
      window.addEventListener('keydown', h);
      return function () { window.removeEventListener('keydown', h); };
    }, []);

    const list = useMemo(function () {
      const needle = q.trim().toLowerCase();
      let out = games.filter(function (g) {
        if (filter === 'viethoa' && !g.viethoa) return false;
        if (filter === 'redeem' && g.redeem !== true) return false;
        if (filter === 'online' && !isOnlineGame(g)) return false;
        if (filter === 'custom' && !customAppIdOf(g)) return false;

        if (genre) {
          const tags = (g.tags || []).map(function (t) { return String(t).toUpperCase(); });
          if (tags.indexOf(String(genre).toUpperCase()) < 0) return false;
        }

        if (needle) {
          const hay = (g.title + ' ' + (g.baseName || '') + ' ' + (g.tags || []).join(' ') + ' ' + (g.appId || '')).toLowerCase();
          if (hay.indexOf(needle) < 0) return false;
        }
        return true;
      });

      out = out.slice();
      if (sort === 'az') out.sort(function (a, b) { return sortKey(a.title) < sortKey(b.title) ? -1 : sortKey(a.title) > sortKey(b.title) ? 1 : 0; });
      else if (sort === 'za') out.sort(function (a, b) { return sortKey(a.title) > sortKey(b.title) ? -1 : sortKey(a.title) < sortKey(b.title) ? 1 : 0; });
      else if (sort === 'rating') out.sort(function (a, b) {
        const x = pctNum(a.percent), y = pctNum(b.percent);
        return (y === null ? -1 : y) - (x === null ? -1 : x);
      });
      else if (sort === 'reviews') out.sort(function (a, b) { return reviewCountNum(b.reviewCount) - reviewCountNum(a.reviewCount); });
      else if (sort === 'new') out.sort(byNewest);

      return out;
    }, [games, q, filter, sort, genre]);

    const reset = function () {
      setQ('');
      setFilter('all');
      if (genre && onClearGenre) onClearGenre();
    };

    return (
      <div className="nx-page">
        <div className="lib__bar">
          <div className="nx-search">
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={function (e) { setQ(e.target.value); }}
              placeholder="Tìm trò chơi, thẻ, App ID…"
              spellCheck="false"
            />
            <i className="nx-search__ico ph-bold ph-magnifying-glass"></i>
            {q && (
              <button className="nx-search__clear" onClick={function () { setQ(''); }} aria-label="Xóa">
                <i className="ph-bold ph-x"></i>
              </button>
            )}
          </div>

          {FILTERS.map(function (f) {
            return (
              <button
                key={f.id}
                className={'nx-chip' + (filter === f.id ? ' is-on' : '')}
                onClick={function () { setFilter(f.id); }}
              >
                <i className={f.ico}></i>{f.label}
              </button>
            );
          })}

          {genre && (
            <button className="nx-chip is-on" onClick={onClearGenre} title="Bỏ lọc thể loại">
              <i className="ph-fill ph-tag"></i>{genre}
              <i className="ph-bold ph-x" style={{ marginLeft: 2, fontSize: 10 }}></i>
            </button>
          )}

          <span className="lib__spacer" />

          <div className="lib__right">
            <span className="lib__count"><b>{list.length}</b> / {games.length} trò chơi</span>

            <Dropdown value={sort} options={SORTS} onPick={setSort} />

            <div className="lib__view" role="group" aria-label="Kiểu hiển thị">
              <button
                className={'nx-icobtn' + (view === 'grid' ? ' is-on' : '')}
                onClick={function () { setView('grid'); }}
                title="Hiển thị dạng lưới"
              >
                <i className="ph-bold ph-squares-four"></i>
              </button>
              <button
                className={'nx-icobtn' + (view === 'list' ? ' is-on' : '')}
                onClick={function () { setView('list'); }}
                title="Hiển thị dạng danh sách"
              >
                <i className="ph-bold ph-rows"></i>
              </button>
            </div>
          </div>
        </div>

        {list.length === 0 ? (
          <Empty
            icon="ph-bold ph-magnifying-glass"
            title="Không tìm thấy trò chơi nào"
            desc="Thử đổi từ khóa hoặc bỏ bớt bộ lọc đang bật."
            action={<button className="nx-btn nx-btn--ghost" onClick={reset}><i className="ph-bold ph-arrow-counter-clockwise"></i>Đặt lại bộ lọc</button>}
          />
        ) : view === 'grid' ? (
          <div className="nx-grid">
            {list.map(function (g) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </div>
        ) : (
          <div className="nx-list">
            {list.map(function (g) { return <GameRow key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </div>
        )}
      </div>
    );
  }

  /* ==========================================================================
     TRANG KHONG HO TRO (mo tren trinh duyet thay vi ung dung)
     ========================================================================== */

  function NotSupported({ width }) {
    return (
      <div className="ns">
        <div className="ns__ico"><i className="ph-fill ph-arrows-out-line-horizontal"></i></div>
        <div className="ns__t">Cửa sổ đang quá hẹp</div>
        <div className="ns__d">
          Nexus Launcher cần chiều ngang tối thiểu <b>820px</b> để hiển thị đầy đủ thanh điều hướng,
          kệ trò chơi và bảng thông tin. Hãy phóng to cửa sổ hoặc giảm mức thu phóng bằng
          <b> Ctrl và dấu trừ</b>.
          {width ? <span> (hiện tại: {width}px)</span> : null}
        </div>
        <button className="nx-btn nx-btn--ghost" onClick={function () { openExternal(DISCORD_URL); }}>
          <i className="fa-brands fa-discord"></i>Cần hỗ trợ? Vào Discord
        </button>
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     XUAT RA
     ------------------------------------------------------------------------ */

  Object.assign(window.NX, { Hero, HomeContent, LibraryContent, NotSupported, Dropdown, plain, useBgImage });
})();
