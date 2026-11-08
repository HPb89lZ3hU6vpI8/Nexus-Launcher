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
    imgCounts, imgAddSeen, imgAddDone, imgDropSeen,
    GameCard, GameRow, UpcomingCard, Shelf, GENRES, GenreCard,
    useSteamReleases,
    Empty, TX, useLang
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

  /* Tai anh nen theo danh sach du phong — tra ve URL dau tien tai duoc.

     Nguyen tac: KHONG BAO GIO xoa trang tam anh dang co.

     Ban cu dat lai { src: '', ready: false } ngay dong dau moi lan doi game.
     Bang chuyen hero doi game 7.4 giay mot lan, va tam library_hero cua game
     ke tiep luon nguoi -- 1 den 2 MB tai tu may chu Steam, tu lan doi thu hai
     tro di khong con gi trong bo nho dem. Suot ca quang tai do, day hero
     khong con anh: den thui. O che (.hero__well) da chot cung sau lan dau nen
     khong the che giup. Man hinh khoi dong dep den may cung vo nghia neu vao
     trong roi cu 7.4 giay lai chop mot mang den.

     Cach lam dung: tam moi duoc tai am tham bang new Image() ngoai cay DOM,
     khong dinh gi toi nhung gi dang hien. Tai xong moi trao doi trong dung
     mot nhip -- tam cu tut xuong o prev lam nen, tam moi phu len tren. Mat
     nguoi khong bao gio nhin thay mot khung hinh trong nao.

     ready mot khi da bat thi khong tat lai: no co nghia la "da tung co anh
     that", chu khong phai "tam nay vua tai xong". */
  function useBgImage(list) {
    const key = (list && list[0]) || '';
    const [st, setSt] = useState({ src: '', prev: '', ready: false });

    useEffect(function () {
      let alive = true;
      if (!list || !list.length) return undefined;

      let n = 0;
      const arrive = function (url) {
        if (!alive) return;
        setSt(function (p) {
          /* Cung mot dia chi thi khong dung toi cay DOM -- tranh mot vong ve
             lai thua va tranh lam moi lop nen dang mo dan. */
          if (p.src === url) return p;
          return { src: url, prev: p.src, ready: true };
        });
      };
      const step = function () {
        if (!alive) return;
        if (n >= list.length) { arrive(list[list.length - 1]); return; }
        const url = list[n++];
        const im = new Image();
        /* Anh nen hero la tam anh to nhat va de thay nhat tren trang -- xin
           trinh duyet uu tien no thay vi xep hang chung voi anh bia cac the. */
        try { im.fetchPriority = 'high'; } catch (e) {}
        im.onload = function () { arrive(url); };
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
    const lang = useLang();
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

      fetchMedia(appId, lang).then(function (d) {
        if (!alive || !d) return;
        const s = clipDesc(plain(d.desc) || plain(d.about));
        if (s) setDesc(s);

        const have = String(d.desc_lang || d.about_lang || '').toLowerCase();
        if (have === lang) return;
        fetchTranslation(appId, lang).then(function (t) {
          if (!alive || !t) return;
          const v = clipDesc(plain(t.desc) || plain(t.about));
          if (v) setDesc(v);
        });
      });

      return function () { alive = false; };
    }, [appId, lang]);

    /* ---- O CHO cua anh nen hero ----
       Anh nen doi game moi 7.4 giay. Moi lan doi, useBgImage dat lai
       ready = false mot nhip -- neu buoc o cho song theo bg.ready thi cu 7.4
       giay lai co mot tam man toi quet ngang qua day hero, mai mai. Vi the
       chot lai: xong lan dau la xong han. Phan tu luon nam tren trang (khong
       thao ra) nen khong co cu giat nao khi doi anh. */
    const wellDone = useRef(false);
    if (appId && bg.ready) wellDone.current = true;

    /* Het sach nguon that su thi useBgImage roi ve tam PLACEHOLDER -- mot tam
       anh data: nam san trong trang, khong bao gio loi duoc. Do la that bai
       chu khong phai thanh cong: tat vet sang an mung di.

       Khac voi wellDone, cai nay KHONG duoc chot cung. No mo ta tam anh DANG
       hien, ma tam anh thi doi moi 7.4 giay. Chot cung thi chi can mot game
       trong bang chuyen thieu anh la tu do tro di khong game nao con duoc
       vien sang nua. Tinh thang tu bg.src moi lan ve la luon dung. */
    const wellNA = String(bg.src).slice(0, 5) === 'data:';

    /* Anh nen hero cung la mot anh dang cho -- gop no vao bo dem chung. */
    const heroSeen = useRef(false);
    const heroDone = useRef(false);
    useEffect(function () {
      /* Khong co game nao thi khong co anh nen nao de cho -- dung ghi vao mau
         so, keo theo thanh chi bao khong bao gio day duoc. */
      if (!appId || heroSeen.current) return;
      heroSeen.current = true;
      imgAddSeen();
    }, [appId]);
    useEffect(function () {
      if (heroDone.current || !heroSeen.current || !bg.ready) return;
      heroDone.current = true;
      imgAddDone();
    }, [bg.ready]);
    /* Roi khoi trang khi anh nen con dang tai thi tra lai suat da ghi. */
    useEffect(function () {
      return function () {
        if (heroSeen.current && !heroDone.current) imgDropSeen();
      };
    }, []);

    /* ---- Thanh chi bao anh dot dau ----
       Doc bo dem trong app.core.jsx qua su kien, khong qua state chung, nen
       khong component nao khac bi ve lai theo. */
    const [load, setLoad] = useState(imgCounts);
    useEffect(function () {
      const on = function () {
        /* Moi anh ve xong ban ra mot su kien -- khoang 14 lan cho mot man
           hinh. Neu lan nao cung dat mot vat the moi vao state thi hero ve
           lai 14 lan du chang co gi doi. So sanh truoc, giong thi giu nguyen
           vat the cu, React thay khong doi la bo qua. */
        setLoad(function (p) {
          const c = imgCounts();
          if (p.seen === c.seen && p.done === c.done && p.locked === c.locked) return p;
          return c;
        });
      };
      window.addEventListener('nx:img-tick', on);
      on();
      return function () { window.removeEventListener('nx:img-tick', on); };
    }, []);

    /* ---- Den bao "van dang cho mang" ----
       Moi lan co anh ve thi tat den va dat lai dong ho; chi khi 1.8 giay troi
       qua ma khong co gi ve thi moi bat len. Mang khoe hoac cache nong thi
       nguoi dung khong bao gio nhin thay no.

       Chuoi nguon anh luon ket thuc bang PLACEHOLDER (anh data: nam san trong
       trang, khong the loi -- xem useFallbackImg ben app.core.jsx) nen trang
       thai cho LUON tu giai quyet: den nay khong bao gio ket o trang thai sang
       vinh vien. */
    const [waiting, setWaiting] = useState(false);
    useEffect(function () {
      if (load.seen === 0 || load.done >= load.seen) { setWaiting(false); return undefined; }
      setWaiting(false);
      const t = setTimeout(function () { setWaiting(true); }, 1800);
      return function () { clearTimeout(t); };
    }, [load.seen, load.done]);

    /* Han chot cung cho ca thanh chi bao.

       Doan ghi chu ben tren noi trang thai cho "luon tu giai quyet" vi chuoi
       nguon anh ket bang PLACEHOLDER khong the loi. Dieu do chi dung khi yeu
       cau BI TU CHOI. Mot ket noi treo thi khac han: khong co su kien load,
       cung khong co su kien error -- trinh duyet cu ngoi doi, ma <img> thi
       khong co han cho. Chuyen nay xay ra that voi may chu anh cua Steam nhin
       tu Viet Nam.

       Hau qua neu khong chan: mau so khong bao gio day, thanh chi bao sang
       vinh vien, va sau 1.8 giay no chuyen sang lop long lanh chay lap vo
       han -- ngay tren mot may vua yeu cau giam chuyen dong. Do la trang
       thai "dang tai" xau nhat co the co.

       12 giay la du rong: anh nao ve duoc thi da ve tu lau. Qua moc do thi
       coi nhu xong va don thanh chi bao di. Anh van tiep tuc ve binh thuong
       neu no con den -- moc nay chi tat cai thanh bao, khong huy gi ca. */
    const [expired, setExpired] = useState(false);
    useEffect(function () {
      if (load.seen === 0 || load.done >= load.seen) return undefined;
      const t = setTimeout(function () { setExpired(true); }, 12000);
      return function () { clearTimeout(t); };
    }, [load.seen, load.done]);

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
        {/* Hai lop nen chong len nhau.

            Lop duoi giu tam anh CU va luon dac. Lop tren mang tam MOI, gan
            khoa theo dia chi anh nen moi tam la mot phan tu moi: no vao trang
            o opacity 0 roi mo dan len 1 qua 900ms (xem .hero__bg trong
            views.css). Trong suot 900ms do, tam cu van nam nguyen ben duoi
            nen khong he co khoang trong.

            Truoc day lop nay gan khoa theo appId -- tuc la thao ra lap lai
            moi lan doi game, dung vao dung luc chua co anh moi. */}
        {bg.prev ? (
          <div className="hero__bg--prev"
               style={{ backgroundImage: 'url("' + bg.prev + '")' }}
               key={'p-' + bg.prev} />
        ) : null}
        {bg.src ? (
          <div className={'hero__bg' + (bg.ready ? ' is-in' : '')}
               style={{ backgroundImage: 'url("' + bg.src + '")' }}
               key={bg.src} />
        ) : null}
        <div className={'hero__well'
                        + (wellDone.current ? ' is-done' : '')
                        + (wellNA ? ' is-na' : '')} />
        <div className="hero__scrim" />
        <div className="hero__aurora"><i /><i /></div>

        {/* Thanh chi bao anh dot dau. Bien han khi da ve du, va khong bao gio
            song lai vi bo dem tu khoa -- xem imgAddDone ben app.core.jsx. */}
        {load.seen > 0 && (
          <div className={'hero__load'
                          + (load.done >= load.seen || expired ? ' is-done' : '')
                          + (waiting && !expired ? ' is-waiting' : '')}>
            <i style={{ transform: 'scaleX(' + (load.done / load.seen) + ')' }} />
          </div>
        )}

        <div className="hero__edge" />

        <div className="hero__in" key={'in-' + appId}>
          <div className="hero__eyebrow">
            <i className="ph-fill ph-flame"></i>
            <span>{TX('Nổi bật hôm nay')}</span>
          </div>

          <h1 className="hero__title">{g.title}</h1>

          {/* Mot dai kinh duy nhat thay cho chum huy hieu roi rac truoc day */}
          <div className={'hero__strip hero__strip--' + tone}>
            {pct !== null && (
              <span className="hero__cell hero__cell--score">
                <b className="hero__pct">{Math.round(pct)}<em>%</em></b>
                <span className="hero__tone">{TX(g.reviewText)}</span>
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
              return <span className="hero__cell hero__cell--tag" key={t}>{TX(t)}</span>;
            })}
            {g.viethoa && (
              <span className="hero__chip hero__chip--vi">
                <i className="ph-fill ph-translate"></i>{TX('Việt hoá')}
              </span>
            )}
            {isOnlineGame(g) && (
              <span className="hero__chip hero__chip--on">
                <i className="ph-fill ph-globe-simple"></i>Online
              </span>
            )}
          </div>

          <p className="hero__desc nx-clamp-3">
            {desc || TX('Thư viện Nexus tổng hợp trò chơi bản quyền — truy cập nhanh, cài đặt gọn, không quảng cáo.')}
          </p>

          <div className="hero__acts">
            <button className="nx-btn nx-btn--lg hero__cta" onClick={function () { onOpen(g); }}>
              <i className="ph-fill ph-play"></i>{TX('Xem chi tiết')}
            </button>
            <button className="nx-btn nx-btn--ghost nx-btn--lg" onClick={onLibrary}>
              <i className="ph-bold ph-squares-four"></i>{TX('Toàn bộ thư viện')}
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
          <div className="stat__l">{TX(label)}</div>
        </div>
      </div>
    );
  }

  function HomeContent({ games, upcoming, onOpen, onGenre, onLibrary }) {
    useLang();
    /* Doi chieu lich ra mat voi Steam — game bi doi ngay se tu cap nhat */
    const rel = useSteamReleases(upcoming);

    const picks = useMemo(function () {
      const pool = games.filter(function (g) {
        return g.appId && pctNum(g.percent) !== null && pctNum(g.percent) >= 84 && reviewCountNum(g.reviewCount) >= 15000;
      });
      pool.sort(function (a, b) { return reviewCountNum(b.reviewCount) - reviewCountNum(a.reviewCount); });
      /* Nhanh du phong cung phai loc appId. Nhanh chinh doi g.appId vi khong
         co no thi heroSources() khong dung noi duong dan anh nen -> hero roi
         ve tam anh xam. Nhanh du phong truoc day lay games.slice() nguyen si,
         nghia la dung luc danh sach khong ai dat nguong (loc theo the loai
         hep, hoac ban du lieu moi chua co diem danh gia) thi hero lai boc
         phai game khong co anh — dung luc trang can dep nhat.

         Ba tang chu khong phai hai: neu ca danh sach khong game nao co appId
         thi van phai tra ve mot cai gi do, vi Hero doc picks[0] ngay khong
         kiem tra rong. */
      const withId = games.filter(function (g) { return !!g.appId; });
      return (pool.length ? pool
              : (withId.length ? withId : games.slice())).slice(0, 5);
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
          {label || TX('Xem tất cả')}<i className="ph-bold ph-arrow-right"></i>
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
          {/* nhan la cau tieng Viet goc — Stat tu dich bang TX() */}
        </div>

        {trending.length > 0 && (
          <Shelf title={TX('Đang thịnh hành')} icon="ph-fill ph-trend-up"
                 sub={TX('Nhiều lượt đánh giá nhất trên Steam')} action={seeAll()}>
            {trending.map(function (g, i) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} eager={i < 6} />; })}
          </Shelf>
        )}

        {fresh.length > 0 && (
          <Shelf title={TX('Mới cập nhật')} icon="ph-fill ph-sparkle"
                 sub={TX('Vừa được thêm vào thư viện')} action={seeAll()}>
            {fresh.map(function (g, i) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </Shelf>
        )}

        {(upcoming && upcoming.length > 0) && (
          <Shelf title={TX('Sắp ra mắt')} icon="ph-fill ph-rocket-launch"
                 sub={TX('Đếm ngược tới ngày phát hành')}>
            {upcoming.map(function (g) {
              return <UpcomingCard key={g.id || g.appId} game={g}
                                    steam={rel[String(g.appId)]} />;
            })}
          </Shelf>
        )}

        {topRated.length > 0 && (
          <Shelf title={TX('Đánh giá cao nhất')} icon="ph-fill ph-star"
                 sub={TX('Người chơi Steam chấm điểm tốt nhất')} action={seeAll()}>
            {topRated.map(function (g, i) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </Shelf>
        )}

        {viet.length > 0 && (
          <Shelf title={TX('Có Việt hóa')} icon="ph-fill ph-translate"
                 sub={TX('Bản dịch tiếng Việt sẵn sàng')} action={seeAll()}>
            {viet.map(function (g, i) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} />; })}
          </Shelf>
        )}

        <section className="nx-sec">
          <div className="nx-sec__head">
            <h2 className="nx-sec__title"><i className="ph-fill ph-squares-four"></i>{TX('Duyệt theo thể loại')}</h2>
            <span className="nx-sec__sub">{TX('Chọn nhanh phong cách bạn thích')}</span>
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
                <span className="bn__t" style={{ display: 'block' }}>{TX('CỘNG ĐỒNG NEXUS')}</span>
                <span className="bn__d" style={{ display: 'block' }}>
                  {TX('Tham gia Discord để nhận game mới, bản vá và hỗ trợ trực tiếp')}
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
    useLang();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const close = useCallback(function () { setOpen(false); }, []);
    useClickOutside(ref, close, open);

    const cur = options.find(function (o) { return o.id === value; }) || options[0];

    return (
      <div className={'dd' + (open ? ' is-open' : '')} ref={ref}>
        <button className="dd__btn" onClick={function () { setOpen(function (v) { return !v; }); }}>
          <i className={icon || cur.ico}></i>
          {TX(cur.label)}
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
                  {TX(o.label)}
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
    useLang();
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
              placeholder={TX('Tìm trò chơi, thẻ, App ID…')}
              spellCheck="false"
            />
            <i className="nx-search__ico ph-bold ph-magnifying-glass"></i>
            {q && (
              <button className="nx-search__clear" onClick={function () { setQ(''); }} aria-label={TX('Xóa')}>
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
                <i className={f.ico}></i>{TX(f.label)}
              </button>
            );
          })}

          {genre && (
            <button className="nx-chip is-on" onClick={onClearGenre} title={TX('Bỏ lọc thể loại')}>
              <i className="ph-fill ph-tag"></i>{TX(genre)}
              <i className="ph-bold ph-x" style={{ marginLeft: 2, fontSize: 10 }}></i>
            </button>
          )}

          <span className="lib__spacer" />

          <div className="lib__right">
            <span className="lib__count"><b>{list.length}</b> / {TX('{n} trò chơi', { n: games.length })}</span>

            <Dropdown value={sort} options={SORTS} onPick={setSort} />

            <div className="lib__view" role="group" aria-label={TX('Kiểu hiển thị')}>
              <button
                className={'nx-icobtn' + (view === 'grid' ? ' is-on' : '')}
                onClick={function () { setView('grid'); }}
                title={TX('Hiển thị dạng lưới')}
              >
                <i className="ph-bold ph-squares-four"></i>
              </button>
              <button
                className={'nx-icobtn' + (view === 'list' ? ' is-on' : '')}
                onClick={function () { setView('list'); }}
                title={TX('Hiển thị dạng danh sách')}
              >
                <i className="ph-bold ph-rows"></i>
              </button>
            </div>
          </div>
        </div>

        {list.length === 0 ? (
          <Empty
            icon="ph-bold ph-magnifying-glass"
            title={TX('Không tìm thấy trò chơi nào')}
            desc={TX('Thử đổi từ khóa hoặc bỏ bớt bộ lọc đang bật.')}
            action={<button className="nx-btn nx-btn--ghost" onClick={reset}><i className="ph-bold ph-arrow-counter-clockwise"></i>{TX('Đặt lại bộ lọc')}</button>}
          />
        ) : view === 'grid' ? (
          <div className="nx-grid">
            {list.map(function (g, i) { return <GameCard key={g.id || g.appId} game={g} onOpen={onOpen} eager={i < 12} />; })}
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
    useLang();
    return (
      <div className="ns">
        <div className="ns__ico"><i className="ph-fill ph-arrows-out-line-horizontal"></i></div>
        <div className="ns__t">{TX('Cửa sổ đang quá hẹp')}</div>
        <div className="ns__d">
          {TX('Nexus Launcher cần chiều ngang tối thiểu 820px để hiển thị đầy đủ thanh điều hướng, kệ trò chơi và bảng thông tin. Hãy phóng to cửa sổ hoặc giảm mức thu phóng bằng')}
          <b> {TX('Ctrl và dấu trừ')}</b>.
          {width ? <span> {TX('(hiện tại: {w}px)', { w: width })}</span> : null}
        </div>
        <button className="nx-btn nx-btn--ghost" onClick={function () { openExternal(DISCORD_URL); }}>
          <i className="fa-brands fa-discord"></i>{TX('Cần hỗ trợ? Vào Discord')}
        </button>
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     XUAT RA
     ------------------------------------------------------------------------ */

  Object.assign(window.NX, { Hero, HomeContent, LibraryContent, NotSupported, Dropdown, plain, useBgImage });
})();
