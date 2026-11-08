/* ============================================================================
   NEXUS LAUNCHER — KHUNG UNG DUNG
   Rail trai · thanh tren · dieu huong · thu phong · phim tat · man hinh khoi dong
   File nay chay CUOI CUNG. Phu thuoc: window.NX (core, cards, detail, views, integrate)
   ========================================================================== */

(function () {
  'use strict';

  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const {
    APP_VERSION, DISCORD_URL,
    callApi, hasApi, openExternal,
    ToastHost,
    GameDetail, HomeContent, LibraryContent, NotSupported, IntegrateContent,
    prefersCalm, useClickOutside, useEscape,
    I18N, TX, useLang
  } = window.NX;

  /* --------------------------------------------------------------------------
     KHOA THU PHONG THU CONG
     ------------------------------------------------------------------------ */

  /* Muc phong to cua giao dien do doan script o dau index.html tu tinh theo
     man hinh. Nguoi dung khong duoc tu chinh them: chan Ctrl +/-/0 va Ctrl +
     con lan, vi so do ho chinh se chong len so do tu tinh, giao dien lech ngay.

     Truoc day dong duoi la lenh XOA TRANG muc phong to, tu thoi launcher con
     khoa cung o 100%. Nay khong duoc xoa nua -- xoa la mat luon phan tu can
     theo man hinh, va do React chay sau nen no xoa dung cai vua dat xong. Thay
     bang mot lan goi lai ham tu can cho chac. */
  function useNoZoom() {
    useEffect(function () {
      if (window.NXFit) window.NXFit();
      try { localStorage.removeItem('nx.zoom'); } catch (e) {}

      const onKey = function (e) {
        if (!e.ctrlKey && !e.metaKey) return;
        const k = e.key;
        if (k === '+' || k === '=' || k === '-' || k === '_' || k === '0' ||
            e.code === 'NumpadAdd' || e.code === 'NumpadSubtract' || e.code === 'Numpad0') {
          e.preventDefault();
        }
      };
      const onWheel = function (e) {
        if (e.ctrlKey || e.metaKey) e.preventDefault();
      };
      window.addEventListener('keydown', onKey);
      window.addEventListener('wheel', onWheel, { passive: false });
      return function () {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('wheel', onWheel);
      };
    }, []);
  }

  /* --------------------------------------------------------------------------
     KHOA CAC PHIM CUA TRINH DUYET KHI CHAY TRONG UNG DUNG
     ------------------------------------------------------------------------ */

  function useDesktopLock() {
    useEffect(function () {
      const inApp = !!(window.pywebview);

      const onCtx = function (e) {
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        // Dang boi den mot doan chu thi cho menu hien, de con muc Copy.
        // Khong co ngoai le nay thi to xong bam chuot phai lai khong ra gi,
        // nguoi dung tuong hong. Ctrl+C van chay du co menu hay khong.
        try {
          const sel = window.getSelection && window.getSelection();
          if (sel && !sel.isCollapsed && String(sel).trim()) return;
        } catch (err) { /* khong lay duoc vung to thi chan nhu cu */ }
        e.preventDefault();
      };
      const onKey = function (e) {
        if (!inApp) return;
        const k = (e.key || '').toLowerCase();
        if (k === 'f5' || ((e.ctrlKey || e.metaKey) && k === 'r')) { e.preventDefault(); }
        if ((e.ctrlKey || e.metaKey) && k === 'p') { e.preventDefault(); }
      };
      const onDrop = function (e) { e.preventDefault(); };

      document.addEventListener('contextmenu', onCtx);
      window.addEventListener('keydown', onKey);
      window.addEventListener('dragover', onDrop);
      window.addEventListener('drop', onDrop);
      return function () {
        document.removeEventListener('contextmenu', onCtx);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('dragover', onDrop);
        window.removeEventListener('drop', onDrop);
      };
    }, []);
  }

  /* --------------------------------------------------------------------------
     KICH THUOC CUA SO
     ------------------------------------------------------------------------ */

  /* Tra ve be ngang MA BO CUC DUOC DUNG, khong phai so pixel that cua cua so.
     Ca trang dang duoc phong to theo man hinh, nen phai chia lai cho he so do.
     Neu khong, may dat do phan giai cao cua Windows (200-250%) se bi bao la
     "man hinh qua hep" du bo cuc thuc te con rat rong. */
  function useViewport() {
    const eff = function () {
      return Math.round(window.innerWidth / (window.NXZ ? window.NXZ() : 1));
    };
    const [w, setW] = useState(eff);
    useEffect(function () {
      let raf = 0;
      const on = function () {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { setW(eff()); });
      };
      window.addEventListener('resize', on);
      return function () { window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
    }, []);
    return w;
  }

  /* --------------------------------------------------------------------------
     TRANG THAI STEAM TREN THANH TREN
     ------------------------------------------------------------------------ */

  function SteamPill() {
    const [st, setSt] = useState('checking');

    const probe = useCallback(function () {
      if (!hasApi('check_steam')) { setSt('offline'); return; }
      setSt('checking');
      callApi('check_steam').then(function (r) {
        setSt(r && r.installed ? 'ok' : 'missing');
      });
    }, []);

    useEffect(function () { probe(); }, [probe]);
    useLang();

    const map = {
      checking: { c: 'var(--tx-faint)', t: TX('Đang kiểm tra Steam') },
      ok:       { c: 'var(--ok)',       t: TX('Steam đã sẵn sàng') },
      missing:  { c: 'var(--warn)',     t: TX('Chưa cài đặt Steam') },
      offline:  { c: 'var(--tx-faint)', t: TX('Chế độ xem trước') }
    };
    const m = map[st] || map.offline;

    return (
      <button className="nx-chip nx-chip--static nx-steam" onClick={probe} title={TX('Bấm để kiểm tra lại')}>
        <span className={'nx-dot' + (st === 'ok' ? ' nx-dot--live' : '')} style={{ background: m.c }} />
        {m.t}
      </button>
    );
  }

  /* --------------------------------------------------------------------------
     RAIL TRAI
     ------------------------------------------------------------------------ */

  const TABS = [
    { id: 'home',      label: 'Trang chủ',  ico: 'ph-fill ph-house' },
    { id: 'library',   label: 'Thư viện',   ico: 'ph-fill ph-game-controller' },
    { id: 'integrate', label: 'Tích hợp',   ico: 'ph-fill ph-puzzle-piece' }
    /* label la cau tieng Viet goc — dich luc ve bang TX() */
  ];

  function Rail({ tab, onTab, counts }) {
    useLang();
    return (
      <nav className="nx-rail">
        <div className="nx-rail__brand" onClick={function () { onTab('home'); }}>
          <div className="nx-rail__logo"><i className="ph-fill ph-lightning"></i></div>
          <div className="nx-rail__word">NEXUS<span>LAUNCHER</span></div>
        </div>

        <div className="nx-rail__body nx-noscroll">
          <div className="nx-rail__label">{TX('Điều hướng')}</div>
          {TABS.map(function (t) {
            return (
              <button
                key={t.id}
                className={'nx-nav' + (tab === t.id ? ' is-on' : '')}
                onClick={function () { onTab(t.id); }}
              >
                <span className="nx-nav__ico"><i className={t.ico}></i></span>
                <span className="nx-nav__txt">{TX(t.label)}</span>
                {counts[t.id] !== undefined && <span className="nx-nav__count">{counts[t.id]}</span>}
              </button>
            );
          })}

          <div className="nx-rail__label">{TX('Lối tắt')}</div>
          <button className="nx-nav" onClick={function () { openExternal('https://store.steampowered.com/'); }}>
            <span className="nx-nav__ico"><i className="fa-brands fa-steam"></i></span>
            <span className="nx-nav__txt">Steam Store</span>
            <i className="ph-bold ph-arrow-up-right" style={{ fontSize: 12, opacity: 0.5 }}></i>
          </button>
          <button className="nx-nav" onClick={function () { openExternal('https://steamdb.info/'); }}>
            <span className="nx-nav__ico"><i className="ph-bold ph-database"></i></span>
            <span className="nx-nav__txt">{TX('Tra cứu AppID')}</span>
            <i className="ph-bold ph-arrow-up-right" style={{ fontSize: 12, opacity: 0.5 }}></i>
          </button>
        </div>

        <div className="nx-rail__foot">
          <button className="nx-discord" onClick={function () { openExternal(DISCORD_URL); }}>
            <i className="fa-brands fa-discord"></i>
            <span>{TX('Cộng đồng Discord')}</span>
          </button>
          <div className="nx-ver">v{APP_VERSION}</div>
        </div>
      </nav>
    );
  }

  /* --------------------------------------------------------------------------
     THANH TREN
     ------------------------------------------------------------------------ */

  const TOP_COPY = {
    home:      { t: 'Trang chủ',  s: 'Trò chơi nổi bật và mới cập nhật',   i: 'ph-fill ph-house' },
    library:   { t: 'Thư viện',   s: 'Toàn bộ trò chơi có trong Nexus',    i: 'ph-fill ph-squares-four' },
    integrate: { t: 'Tích hợp',   s: 'Dịch vụ chạy trực tiếp trên máy bạn', i: 'ph-fill ph-plugs-connected' },
    game:      { t: 'Chi tiết',   s: 'Thông tin, hình ảnh và cài đặt',      i: 'ph-fill ph-game-controller' }
  };

  /* --------------------------------------------------------------------------
     NUT CHON NGON NGU
     Mot nut nho o goc phai thanh tren. Bam vao mo ra bang nam thu tieng; moi
     dong viet bang chinh thu tieng do nen ai cung doc duoc dong cua minh ma
     khong can biet tieng Viet. Chon xong thi ca giao dien doi ngay lap tuc.
     ------------------------------------------------------------------------ */

  function LangPicker() {
    const cur = useLang();
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    const now = I18N.info();

    useClickOutside(box, function () { setOpen(false); }, open);
    useEscape(function () { setOpen(false); }, open);

    const pick = useCallback(function (code) {
      I18N.set(code);
      setOpen(false);
    }, []);

    return (
      <div className={'nx-lang' + (open ? ' is-open' : '')} ref={box}>
        <button
          type="button"
          className="nx-lang__btn"
          onClick={function () { setOpen(function (v) { return !v; }); }}
          title={TX('Ngôn ngữ giao diện')}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <i className="ph-bold ph-translate nx-lang__glyph"></i>
          <span className="nx-lang__code">{now.short}</span>
          <i className="ph-bold ph-caret-down nx-lang__caret"></i>
        </button>

        {open && (
          <div className="nx-lang__pop" role="listbox" aria-label={TX('Chọn ngôn ngữ')}>
            <div className="nx-lang__head">
              <span>{TX('Ngôn ngữ giao diện')}</span>
              <small>{TX('Toàn bộ giao diện sẽ đổi theo')}</small>
            </div>
            {I18N.LANGS.map(function (L) {
              const on = L.code === cur;
              return (
                <button
                  key={L.code}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={'nx-lang__row' + (on ? ' is-on' : '')}
                  onClick={function () { pick(L.code); }}
                >
                  <span className="nx-lang__flag" aria-hidden="true">{L.flag}</span>
                  <span className="nx-lang__name" lang={L.html}>{L.label}</span>
                  <span className="nx-lang__tag">{L.short}</span>
                  <i className="ph-bold ph-check nx-lang__tick"></i>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function TopBar({ tab, agentOn, onAgent }) {
    useLang();
    const c = TOP_COPY[tab] || TOP_COPY.home;
    /* Doc thang tu window.NX luc render chu khong destructure o dau file:
       neu vi ly do nao do app.agent.jsx chua nap kip, cho nay chi la null
       thay vi nem loi lam trang trang. */
    const AgentBtn = window.NX && window.NX.AgentButton;
    return (
      <header className="nx-top">
        <span className="nx-top__ico" aria-hidden="true"><i className={c.i}></i></span>
        <div className="nx-top__head">
          <div className="nx-top__title">{TX(c.t)}</div>
          <div className="nx-top__sub">{TX(c.s)}</div>
        </div>

        <span className="nx-top__spacer" />

        <SteamPill />

        {AgentBtn ? <AgentBtn open={agentOn} onToggle={onAgent} /> : null}

        <LangPicker />

        <button className="nx-icobtn" onClick={function () { openExternal(DISCORD_URL); }} title="Discord">
          <i className="fa-brands fa-discord"></i>
        </button>
      </header>
    );
  }

  /* --------------------------------------------------------------------------
     MAN HINH KHOI DONG — the tinh nam san trong index.html, chi go bo o day
     ------------------------------------------------------------------------ */

  function dismissBoot() {
    const el = document.getElementById('nx-boot');
    if (!el || el.dataset.gone) return;
    el.dataset.gone = '1';

    function hide() {
      el.classList.add('is-gone');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900);
    }

    /* Cho thanh tien do chay not len 100% roi moi tat. Neu khong thi nguoi
       dung thay no bien mat o 70-80%, trong nhu bi cat ngang. */
    if (window.NXBOOT && NXBOOT.done) {
      let fired = false;
      const go = function () { if (!fired) { fired = true; hide(); } };
      NXBOOT.done(go);
      /* Luoi an toan: cua so bi thu nho xuong khay thi requestAnimationFrame
         ngung chay, bo dem se khong bao gio bao xong — cho toi da 1.2 giay. */
      setTimeout(go, 1200);
    } else {
      hide();
    }
  }

  /* --------------------------------------------------------------------------
     DUONG DAN — cho phep mo thang mot tab hoac mot game bang dau thang
     vi du: #library · #integrate · #game=1623730
     ------------------------------------------------------------------------ */

  function initialRoute(games) {
    let h = '';
    try { h = decodeURIComponent((window.location.hash || '').replace(/^#/, '')); } catch (e) { h = ''; }
    if (h.indexOf('game=') === 0) {
      const id = h.slice(5).trim();
      const g = games.filter(function (x) {
        return String(x.appId) === id || String(x.id) === id;
      })[0];
      if (g) return { tab: 'library', game: g };
    }
    if (h === 'library' || h === 'integrate' || h === 'home') return { tab: h, game: null };
    return { tab: 'home', game: null };
  }

  /* ==========================================================================
     CHUYEN TRANG
     Doi trang khong cat phut mot nua: trang cu mo dan va nhich len roi moi
     nhuong cho, trang moi troi len thay the. Trang cu duoc giu nguyen trong
     mot ref suot thoi gian do — co doi state gi ben ngoai cung khong lam
     no nhay ra giua chung.
     ========================================================================== */

  const SWAP_MS = 180;

  function ViewSwap({ vkey, children }) {
    const cur = useRef({ k: vkey, el: children });
    const pend = useRef(null);
    /* Khoa nam trong state chu khong chi rieng pha: dat lai dung mot gia tri
       cu thi React coi nhu khong doi va bo qua lan ve lai — khi tat hieu ung
       chuyen dong, trang moi se khong bao gio duoc dua ra man hinh. */
    const [st, setSt] = useState({ k: vkey, phase: 'in' });

    /* Con o lai trang cu thi cu cap nhat noi dung moi nhat cua chinh no */
    if (vkey === cur.current.k) cur.current.el = children;
    pend.current = { k: vkey, el: children };

    useEffect(function () {
      if (vkey === cur.current.k) {
        /* Bam nguoc lai dung trang dang o giua chung: huy pha di ra,
           khong de trang nam lai o trang thai tang hinh. */
        setSt(function (s) { return s.phase === 'out' ? { k: s.k, phase: 'in' } : s; });
        return undefined;
      }

      const swap = function () {
        cur.current = { k: pend.current.k, el: pend.current.el };
        setSt({ k: pend.current.k, phase: 'in' });
      };
      if (prefersCalm()) { swap(); return undefined; }

      setSt(function (s) { return { k: s.k, phase: 'out' }; });
      const t = setTimeout(swap, SWAP_MS);
      return function () { clearTimeout(t); };
    }, [vkey]);

    return (
      <div className={'nx-view is-' + st.phase} key={cur.current.k}>
        {cur.current.el}
      </div>
    );
  }

  /* ==========================================================================
     UNG DUNG
     ========================================================================== */

  function App() {
    const games = useMemo(function () {
      const raw = Array.isArray(window.GAME_DATA) ? window.GAME_DATA : [];
      return raw.filter(function (g) { return g && g.title; });
    }, []);
    const upcoming = useMemo(function () {
      return Array.isArray(window.UPCOMING_GAMES) ? window.UPCOMING_GAMES : [];
    }, []);

    const route = useMemo(function () { return initialRoute(games); }, [games]);

    const [tab, setTab] = useState(route.tab);
    const [active, setActive] = useState(route.game);
    /* Khung chat AI. De o day chu khong o Rail vi thanh tren luon hien o moi
       trang, con Rail bi an khi cua so hep. */
    const [agentOn, setAgentOn] = useState(false);
    const [genre, setGenre] = useState('');

    const backTab = useRef(route.tab);
    const scrollRef = useRef(null);
    const memo = useRef({});

    useNoZoom();
    const vw = useViewport();
    useDesktopLock();

    useEffect(function () {
      const t = setTimeout(dismissBoot, 420);
      return function () { clearTimeout(t); };
    }, []);

    /* Nho vi tri cuon cua tung tab */
    const view = active ? 'game' : tab;

    const remember = useCallback(function () {
      const el = scrollRef.current;
      if (el) memo.current[view] = el.scrollTop;
    }, [view]);

    /* Doi trang cu tien ra het roi moi tra vi tri cuon — dat ngay bay gio
       thi thay ca trang dang mo dan bi giat mot cai. */
    useEffect(function () {
      const t = setTimeout(function () {
        const el = scrollRef.current;
        if (el) el.scrollTop = view === 'game' ? 0 : (memo.current[view] || 0);
      }, SWAP_MS);
      return function () { clearTimeout(t); };
    }, [view]);

    const goTab = useCallback(function (id) {
      remember();
      setActive(null);
      setTab(id);
    }, [remember]);

    const openGame = useCallback(function (g) {
      remember();
      backTab.current = tab;
      setActive(g);
    }, [remember, tab]);

    const closeGame = useCallback(function () {
      setActive(null);
      setTab(backTab.current || 'home');
    }, []);

    const pickGenre = useCallback(function (tag) {
      remember();
      setGenre(tag);
      setActive(null);
      setTab('library');
    }, [remember]);

    const goLibrary = useCallback(function () {
      remember();
      setGenre('');
      setActive(null);
      setTab('library');
    }, [remember]);

    /* Alt + mui ten / Backspace de quay lai tu trang chi tiet */
    useEffect(function () {
      if (!active) return undefined;
      const h = function (e) {
        const inField = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
        if (inField) return;
        if ((e.altKey && e.key === 'ArrowLeft') || e.key === 'Backspace') { e.preventDefault(); closeGame(); }
      };
      window.addEventListener('keydown', h);
      return function () { window.removeEventListener('keydown', h); };
    }, [active, closeGame]);

    const counts = useMemo(function () {
      return { library: games.length, integrate: 5 };
    }, [games.length]);

    const narrow = vw < 820;

    let body;
    if (narrow) {
      body = <NotSupported width={vw} />;
    } else if (active) {
      body = (
        <GameDetail
          key={active.id || active.appId}
          game={active}
          onBack={closeGame}
          backLabel={(TOP_COPY[backTab.current] || TOP_COPY.library).t}
          backIcon={(TOP_COPY[backTab.current] || TOP_COPY.library).i}
        />
      );
    } else if (tab === 'library') {
      body = (
        <LibraryContent
          games={games}
          onOpen={openGame}
          genre={genre}
          onClearGenre={function () { setGenre(''); }}
        />
      );
    } else if (tab === 'integrate') {
      body = <IntegrateContent />;
    } else {
      body = (
        <HomeContent
          games={games}
          upcoming={upcoming}
          onOpen={openGame}
          onGenre={pickGenre}
          onLibrary={goLibrary}
        />
      );
    }

    const AgentUI = window.NX && window.NX.AgentOverlay;

    return (
      <div className="nx-shell">
        <Rail tab={active ? backTab.current : tab} onTab={goTab} counts={counts} />
        <main className="nx-main">
          <TopBar tab={view} agentOn={agentOn}
                  onAgent={function () { setAgentOn(function (v) { return !v; }); }} />
          <div className="nx-scroll" ref={scrollRef} onScroll={remember}>
            <ViewSwap vkey={narrow ? 'narrow' : (active ? 'game:' + (active.id || active.appId) : tab)}>
              {body}
            </ViewSwap>
          </div>
        </main>
        {AgentUI ? <AgentUI open={agentOn} onClose={function () { setAgentOn(false); }} /> : null}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     GAN VAO DOM
     ------------------------------------------------------------------------ */

  const mount = document.getElementById('root');

  function Root() {
    return (
      <ToastHost>
        <App />
      </ToastHost>
    );
  }

  if (ReactDOM.createRoot) {
    ReactDOM.createRoot(mount).render(<Root />);
  } else {
    ReactDOM.render(<Root />, mount);
  }

  Object.assign(window.NX, { App, Rail, TopBar, ViewSwap, dismissBoot });
})();
