/* ============================================================================
   NEXUS LAUNCHER — TRANG CHI TIET GAME
   San khau media (anh + video HLS/MP4) · bang thong so · toan bo luong hanh dong
   Phu thuoc: window.NX (app.core.jsx)
   ========================================================================== */

(function () {
  'use strict';

  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const {
    DISCORD_URL, PLATFORMS,
    callApi, openExternal,
    pctNum, reviewTone, TONE_ICON, reviewCountNum, fmtCount, fmtBytes,
    getGamePlatform, isOnlineGame, hasCloudSave, customAppIdOf,
    coverSources, fetchMedia, buildMedia,
    REV_STATE_CACHE, setRevListener,
    useEscape, useToast,
    Img, ScoreRing, Note
  } = window.NX;

  /* --------------------------------------------------------------------------
     TIEN ICH RIENG CHO TRANG NAY
     ------------------------------------------------------------------------ */

  /* Doi cau thong bao tieng Viet thanh mau sac dung ngu canh */
  const HINT_BAD = [
    'Lỗi', 'lỗi', 'Sai Mã', 'Chưa Cài Đặt', 'Chưa cài đặt', 'Không Đủ',
    'Code Này', 'Vui lòng', 'Vui Lòng Thử', 'không tồn tại', 'Thất Bại', 'thất bại',
    'chưa khả dụng', 'Không nhận được'
  ];
  const HINT_OK = [
    'Hoàn Tất', 'Thành Công', 'thành công', 'Bạn Đã Có', 'Đã Tắt', 'Đã đổi', 'Sẵn Sàng'
  ];

  function noteTone(msg) {
    if (!msg) return 'info';
    const s = String(msg);
    for (let i = 0; i < HINT_BAD.length; i++) if (s.indexOf(HINT_BAD[i]) >= 0) return 'bad';
    for (let i = 0; i < HINT_OK.length; i++) if (s.indexOf(HINT_OK[i]) >= 0) return 'ok';
    return 'warn';
  }

  /* Steam tra ve HTML cho about_the_game -> doi thanh van ban thuan */
  const _decoder = document.createElement('textarea');
  function stripHtml(html) {
    if (!html) return '';
    let s = String(html)
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '');
    _decoder.innerHTML = s;
    s = _decoder.value;
    return s.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  }

  const PALWORLD_APPID = '1623730';
  const DRAG_THRESHOLD = 6;
  const IS_HLS = /\.m3u8(\?|$)/i;

  /* --------------------------------------------------------------------------
     SAN KHAU MEDIA — chi 1 video duoc gan nguon tai mot thoi diem
     (tranh cham tran gioi han 6 ket noi/host cua trinh duyet)
     ------------------------------------------------------------------------ */

  function MediaStage({ game, media, idx, setIdx, onZoom }) {
    const vids = useRef({});
    const [busy, setBusy] = useState(false);
    const [fail, setFail] = useState(false);

    const cur = media[idx];

    useEffect(() => {
      const item = media[idx];
      if (!item || item.type !== 'video') { setBusy(false); setFail(false); return undefined; }
      const el = vids.current[String(idx)];
      if (!el) return undefined;

      let hls = null;
      let dead = false;
      setBusy(true);
      setFail(false);

      const ready = () => {
        if (dead) return;
        setBusy(false);
        const p = el.play();
        if (p && p.catch) p.catch(function () {});
      };
      const broke = () => { if (!dead) { setBusy(false); setFail(true); } };

      if (IS_HLS.test(item.src) && window.Hls && window.Hls.isSupported()) {
        hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 24,
          maxMaxBufferLength: 48,
          backBufferLength: 12
        });
        hls.on(window.Hls.Events.MANIFEST_PARSED, ready);
        hls.on(window.Hls.Events.ERROR, function (_evt, data) {
          if (!data || !data.fatal || dead) return;
          if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) { hls.startLoad(); return; }
          if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); return; }
          try { hls.destroy(); } catch (e) {}
          hls = null;
          broke();
        });
        hls.loadSource(item.src);
        hls.attachMedia(el);
      } else {
        el.addEventListener('canplay', ready, { once: true });
        el.addEventListener('error', broke, { once: true });
        el.src = item.src;
        try { el.load(); } catch (e) {}
      }

      return function () {
        dead = true;
        if (hls) { try { hls.destroy(); } catch (e) {} }
        try { el.pause(); } catch (e) {}
        el.removeAttribute('src');
        try { el.load(); } catch (e) {}
      };
    }, [idx, media]);

    /* Cua so bi an -> tam dung het */
    useEffect(function () {
      const onVis = function () {
        if (!document.hidden) return;
        Object.keys(vids.current).forEach(function (k) {
          const v = vids.current[k];
          if (v) { try { v.pause(); } catch (e) {} }
        });
      };
      document.addEventListener('visibilitychange', onVis);
      return function () { document.removeEventListener('visibilitychange', onVis); };
    }, []);

    const go = useCallback(function (d) {
      if (media.length < 2) return;
      setIdx(function (i) { return (i + d + media.length) % media.length; });
    }, [media.length, setIdx]);

    useEffect(function () {
      const onKey = function (e) {
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
      };
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, [go]);

    /* ---- Dai anh nho: keo de cuon, click de chon ---- */
    const strip = useRef(null);
    const drag = useRef({ down: false, moved: false, x: 0, left: 0 });
    const [dragging, setDragging] = useState(false);

    const onDown = function (e) {
      const el = strip.current;
      if (!el) return;
      drag.current = { down: true, moved: false, x: e.clientX, left: el.scrollLeft };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const onMove = function (e) {
      const el = strip.current;
      if (!el || !drag.current.down) return;
      const dx = e.clientX - drag.current.x;
      if (!drag.current.moved && Math.abs(dx) > DRAG_THRESHOLD) { drag.current.moved = true; setDragging(true); }
      if (drag.current.moved) el.scrollLeft = drag.current.left - dx;
    };
    const onUp = function (e) {
      const el = strip.current;
      if (el) { try { el.releasePointerCapture(e.pointerId); } catch (err) {} }
      drag.current.down = false;
      setDragging(false);
    };
    const pick = function (i) { if (!drag.current.moved) setIdx(i); };

    /* Keo o dang xem vao tam nhin */
    useEffect(function () {
      const el = strip.current;
      if (!el) return;
      const node = el.querySelector('[data-i="' + idx + '"]');
      if (!node) return;
      const l = node.offsetLeft;
      const r = l + node.offsetWidth;
      if (l < el.scrollLeft + 8) el.scrollTo({ left: Math.max(0, l - 16), behavior: 'smooth' });
      else if (r > el.scrollLeft + el.clientWidth - 8) el.scrollTo({ left: r - el.clientWidth + 16, behavior: 'smooth' });
    }, [idx]);

    return (
      <div>
        <div className="gd__stage">
          {media.map(function (m, i) {
            const on = i === idx;
            return (
              <div className={'gd__slide' + (on ? ' is-on' : '')} key={m.key}>
                {m.type === 'video' ? (
                  <video
                    ref={function (el) { vids.current[String(i)] = el; }}
                    poster={m.thumb || undefined}
                    controls={on}
                    muted
                    playsInline
                    preload="none"
                    disablePictureInPicture
                    controlsList="nodownload noremoteplayback"
                  />
                ) : (
                  <img
                    src={m.src}
                    alt={game.title}
                    draggable="false"
                    onClick={function () { onZoom(m.src); }}
                    onError={function (e) {
                      const el = e.target;
                      el.onerror = null;
                      const fb = coverSources(game.appId);
                      el.src = fb[0];
                    }}
                  />
                )}
              </div>
            );
          })}

          {cur && cur.type === 'image' && (
            <button className="gd__zoom" onClick={function () { onZoom(cur.src); }} aria-label="Phóng to">
              <i className="ph-bold ph-magnifying-glass-plus"></i>
            </button>
          )}

          {busy && <div className="gd__stage-load"><div className="nx-spin nx-spin--lg" /></div>}

          {fail && cur && cur.type === 'video' && (
            <div className="gd__stage-load"
                 style={{ background: 'rgba(5,7,11,0.86)', flexDirection: 'column', gap: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph-fill ph-video-camera-slash" style={{ fontSize: 30, color: 'var(--tx-faint)' }}></i>
              <span style={{ fontSize: 12, color: 'var(--tx-dim)', fontWeight: 600 }}>Không tải được video này</span>
            </div>
          )}

          {media.length > 1 && (
            <React.Fragment>
              <button className="gd__arrow gd__arrow--l" onClick={function () { go(-1); }} aria-label="Trước">
                <i className="ph-bold ph-caret-left"></i>
              </button>
              <button className="gd__arrow gd__arrow--r" onClick={function () { go(1); }} aria-label="Sau">
                <i className="ph-bold ph-caret-right"></i>
              </button>
              <div className="gd__counter">{idx + 1} / {media.length}</div>
            </React.Fragment>
          )}
        </div>

        {media.length > 1 && (
          <div
            className={'gd__strip' + (dragging ? ' is-drag' : '')}
            ref={strip}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDragStart={function (e) { e.preventDefault(); }}
          >
            {media.map(function (m, i) {
              return (
                <button
                  key={m.key}
                  data-i={i}
                  className={'gd__thumb' + (i === idx ? ' is-on' : '')}
                  onClick={function () { pick(i); }}
                  aria-label={'Xem mục ' + (i + 1)}
                >
                  <img src={m.thumb || m.src} alt="" draggable="false"
                       onError={function (e) { e.target.style.visibility = 'hidden'; }} />
                  {m.type === 'video' && (
                    <span className="gd__thumb-play"><i className="ph-fill ph-play"></i></span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     BANG THONG SO
     ------------------------------------------------------------------------ */

  function SpecRow({ ico, k, children }) {
    return (
      <div className="spec__row">
        <div className="spec__k">{ico && <i className={ico}></i>}{k}</div>
        <div className="spec__v">{children}</div>
      </div>
    );
  }

  function InfoSpecs({ game, live }) {
    const online = isOnlineGame(game);
    const cloud = hasCloudSave(game);
    const plat = PLATFORMS.find(function (p) { return p.id === getGamePlatform(game); }) || PLATFORMS[1];
    const dev = live && live.developers && live.developers.length ? live.developers.join(', ') : null;
    const pub = live && live.publishers && live.publishers.length ? live.publishers.join(', ') : null;
    const rel = live && live.release ? live.release : null;

    return (
      <div className="spec">
        <SpecRow ico="ph-bold ph-mask-happy" k="Chế độ">
          <span className={online ? 'spec__v--ok' : 'spec__v--bad'} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span className="nx-dot nx-dot--live" style={{ background: online ? 'var(--ok)' : 'var(--warn)' }}></span>
            <span style={{ color: online ? 'var(--ok)' : 'var(--warn)' }}>{online ? 'ONLINE' : 'OFFLINE'}</span>
          </span>
        </SpecRow>

        <SpecRow ico="ph-bold ph-user-plus" k="Yêu cầu">
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>
            MIỄN PHÍ <i className="ph-fill ph-gift"></i>
          </span>
        </SpecRow>

        <SpecRow ico="ph-fill ph-cloud" k="Cloud Save">
          {cloud
            ? <span className="spec__v--ok"><i className="ph-fill ph-check-circle"></i> Có hỗ trợ</span>
            : <span className="spec__v--bad"><i className="ph-fill ph-x-circle"></i> Không hỗ trợ</span>}
        </SpecRow>

        <SpecRow ico="ph-fill ph-floppy-disk" k="Local Save">
          <span className="spec__v--ok"><i className="ph-fill ph-check-circle"></i> Có hỗ trợ</span>
        </SpecRow>

        <SpecRow ico="ph-bold ph-storefront" k="Nền tảng">
          <span style={{ color: plat.tone, fontWeight: 700 }}>
            <i className={plat.ico} style={{ marginRight: 6 }}></i>{plat.label}
          </span>
        </SpecRow>

        {dev && <SpecRow ico="ph-bold ph-code" k="Nhà phát triển">{dev}</SpecRow>}
        {pub && <SpecRow ico="ph-bold ph-buildings" k="Nhà phát hành">{pub}</SpecRow>}
        {rel && <SpecRow ico="ph-bold ph-calendar-blank" k="Ngày phát hành">{rel}</SpecRow>}

        <SpecRow ico="ph-bold ph-identification-card" k="App ID">
          <span className="nx-num nx-selectable">{game.appId || '—'}</span>
        </SpecRow>
      </div>
    );
  }

  function SysSpecs({ req }) {
    const r = req || {};
    const rows = [
      ['ph-bold ph-windows-logo', 'Hệ điều hành', r.os],
      ['ph-bold ph-cpu', 'Bộ xử lý', r.cpu],
      ['ph-bold ph-circuitry', 'Bộ nhớ RAM', r.ram],
      ['ph-bold ph-monitor', 'Đồ họa', r.gpu],
      ['ph-bold ph-cube', 'DirectX', r.dx],
      ['ph-bold ph-wifi-high', 'Kết nối', r.connection],
      ['ph-bold ph-hard-drive', 'Lưu trữ', r.storage],
      ['ph-bold ph-note', 'Ghi chú', r.note]
    ].filter(function (x) { return !!x[2]; });

    if (!rows.length) {
      return (
        <div className="spec">
          <SpecRow ico="ph-bold ph-info" k="Cấu hình">Chưa có dữ liệu cấu hình cho trò chơi này.</SpecRow>
        </div>
      );
    }

    return (
      <div className="spec">
        <SpecRow ico="ph-bold ph-check-square" k="Kiến trúc">Yêu cầu CPU và hệ điều hành 64-bit</SpecRow>
        {rows.map(function (row) {
          return <SpecRow key={row[1]} ico={row[0]} k={row[1]}>{row[2]}</SpecRow>;
        })}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     NUT HANH DONG LON (2 dong: nhan phu + nhan chinh)
     ------------------------------------------------------------------------ */

  function ActionButton(props) {
    const spinning = !!props.spinning;
    return (
      <button
        className={'abtn abtn--' + (props.tone || 'primary')}
        onClick={props.onClick}
        disabled={props.disabled}
        type="button"
      >
        <span className="abtn__ico">
          {spinning ? <span className="nx-spin" /> : <i className={props.ico}></i>}
        </span>
        <span className="abtn__txt">
          <span className="abtn__k">{props.eyebrow}</span>
          <span className="abtn__v">{props.label}</span>
        </span>
        {props.arrow !== false && !spinning && <i className="abtn__go ph-bold ph-arrow-right"></i>}
      </button>
    );
  }

  /* --------------------------------------------------------------------------
     MODAL DUNG TRONG TRANG NAY
     ------------------------------------------------------------------------ */

  function Sheet({ open, onClose, icon, iconTone, title, desc, children, footer }) {
    useEscape(onClose, open);
    if (!open) return null;
    return (
      <div className="mo" onMouseDown={function (e) { if (e.target === e.currentTarget) onClose(); }}>
        <div className="mo__box">
          <div className="mo__head">
            <div className="mo__ico" style={iconTone ? { color: iconTone } : null}><i className={icon}></i></div>
            <div>
              <div className="mo__t">{title}</div>
              {desc && <div className="mo__d">{desc}</div>}
            </div>
            <button className="nx-icobtn mo__x" onClick={onClose} aria-label="Đóng">
              <i className="ph-bold ph-x"></i>
            </button>
          </div>
          <div className="mo__body">{children}</div>
          {footer && <div className="mo__foot">{footer}</div>}
        </div>
      </div>
    );
  }

  /* ==========================================================================
     TRANG CHI TIET
     ========================================================================== */

  function GameDetail({ game, onBack }) {
    const toast = useToast();

    /* ---- Hang so dan xuat: khai bao TRUOC moi effect de khong dinh TDZ ---- */
    const appId = game.appId ? String(game.appId) : '';
    const isUpcoming = !!(game.upcoming || game.isUpcoming || game.targetDate ||
                          (game.id && String(game.id).indexOf('up_') === 0));
    const customAppId = customAppIdOf(game);
    const isPalworld = appId === PALWORLD_APPID;
    const hasFix = !!game.fix;
    const hasRedeem = game.redeem === true;
    const tone = reviewTone(game.percent, game.reviewText);
    const pct = pctNum(game.percent);
    const revCount = reviewCountNum(game.reviewCount);
    const tags = Array.isArray(game.tags) ? game.tags : [];

    /* ---- Media ---- */
    const [live, setLive] = useState(null);
    const [idx, setIdx] = useState(0);
    const [zoom, setZoom] = useState(null);
    const media = useMemo(function () { return buildMedia(appId, live); }, [appId, live]);

    /* ---- Panel ---- */
    const [tab, setTab] = useState('info');

    /* ---- Truy cap game (share qua Steam) ---- */
    const [accessState, setAccessState] = useState('idle');
    const [accessNote, setAccessNote] = useState('');

    /* ---- Fix game ---- */
    const [fixState, setFixState] = useState('idle');
    const [fixNote, setFixNote] = useState('');

    /* ---- Palworld: doi ngon ngu ---- */
    const [palHasFix, setPalHasFix] = useState(false);
    const [palLang, setPalLang] = useState('');
    const [langOpen, setLangOpen] = useState(false);
    const [langBusy, setLangBusy] = useState(false);

    /* ---- Redeem code ---- */
    const [code, setCode] = useState('');
    const [redeemState, setRedeemState] = useState('idle');
    const [redeemNote, setRedeemNote] = useState('');

    /* ---- Game nguon rieng (tai truc tiep, khong qua Steam) ---- */
    const [revState, setRevState] = useState('idle');
    const [revNote, setRevNote] = useState('');
    const [revProgress, setRevProgress] = useState({ percent: 0, downloaded: 0, total: 0 });
    const [revSize, setRevSize] = useState(null);
    const [revPath, setRevPath] = useState('');
    const [revSaved, setRevSaved] = useState('');
    const [revPicker, setRevPicker] = useState(false);
    const [revConfirm, setRevConfirm] = useState(false);

    /* ------------------------------------------------------------------
       LAY DU LIEU STEAM (anh, video, mo ta, cau hinh)
       ------------------------------------------------------------------ */
    useEffect(function () {
      let alive = true;
      setLive(null);
      setIdx(0);
      if (!appId) return undefined;
      /* false = da hoi Steam nhung khong co du lieu -> thoat khoi trang thai dang tai */
      fetchMedia(appId).then(function (d) { if (alive) setLive(d || false); });
      return function () { alive = false; };
    }, [appId]);

    /* Ve dau trang khi doi game */
    useEffect(function () {
      const sc = document.querySelector('.nx-scroll');
      if (sc) sc.scrollTop = 0;
    }, [appId]);

    const sysreq = (live && live.sysreq) || game.sysreq || null;
    const about = useMemo(function () {
      if (!live) return '';
      const long = stripHtml(live.about);
      const short = stripHtml(live.desc);
      if (long && long.length > 40) return long;
      return short || long;
    }, [live]);

    /* Anh nen mo phia sau trang */
    const bgSrc = useMemo(function () {
      const m = media[idx];
      if (m && m.type === 'image') return m.src;
      if (m && m.thumb) return m.thumb;
      return coverSources(appId)[0];
    }, [media, idx, appId]);

    /* ------------------------------------------------------------------
       CAU NOI TIEN TRINH TAI TU PYTHON
       ------------------------------------------------------------------ */
    const updateRevCache = useCallback(function (patch) {
      if (!customAppId) return;
      const cur = REV_STATE_CACHE.get(customAppId) || {};
      REV_STATE_CACHE.set(customAppId, Object.assign({}, cur, patch));
    }, [customAppId]);

    const persistRevState = useCallback(function (next, patch) {
      setRevState(next);
      updateRevCache(Object.assign({ state: next }, patch || {}));
    }, [updateRevCache]);

    useEffect(function () {
      if (!customAppId) return undefined;
      setRevListener({ appId: customAppId, progress: function (d) { setRevProgress(d); } });
      return function () { setRevListener(null); };
    }, [customAppId]);

    /* Khoi phuc trang thai khi mo lai trang */
    useEffect(function () {
      if (!customAppId) return undefined;
      let alive = true;

      const cached = REV_STATE_CACHE.get(customAppId);
      if (cached && cached.state) {
        setRevState(cached.state);
        if (cached.progress) setRevProgress(cached.progress);
        if (cached.installPath) setRevPath(cached.installPath);
        if (cached.fileSize) setRevSize(cached.fileSize);
      }

      (async function () {
        const st = await callApi('get_custom_status', customAppId);
        if (!alive || !st) return;

        if (st.state === 'installed') {
          const chk = await callApi('check_custom_install', customAppId);
          if (!alive) return;
          if (chk && chk.installed) {
            setRevSaved(chk.path || '');
            persistRevState('installed');
          } else {
            persistRevState('idle');
            REV_STATE_CACHE.delete(customAppId);
          }
          return;
        }

        if (st.state === 'downloading' || st.state === 'installing') {
          setRevState(st.state);
          if (st.progress) setRevProgress(st.progress);
          if (st.install_path) setRevPath(st.install_path);
          updateRevCache({ state: st.state, progress: st.progress, installPath: st.install_path });
          return;
        }

        if (st.state === 'error') {
          setRevState('idle');
          if (st.error) setRevNote('Lỗi: ' + st.error);
          return;
        }

        const chk = await callApi('check_custom_install', customAppId);
        if (!alive) return;
        if (chk && chk.installed) {
          setRevSaved(chk.path || '');
          persistRevState('installed');
        }
      })();

      return function () { alive = false; };
    }, [customAppId, persistRevState, updateRevCache]);

    /* Palworld: da co SteamFix.ini chua? */
    useEffect(function () {
      if (!isPalworld) return undefined;
      let alive = true;
      (async function () {
        const steam = await callApi('check_steam');
        if (!alive || !steam || !steam.installed) return;
        const r = await callApi('check_palworld_steamfix', steam.path);
        if (!alive || !r) return;
        setPalHasFix(!!r.has_steamfix);
        if (r.language) setPalLang(r.language);
      })();
      return function () { alive = false; };
    }, [isPalworld]);

    /* Tu an ghi chu Fix Game */
    useEffect(function () {
      if (!fixNote) return undefined;
      const ms = noteTone(fixNote) === 'bad' ? 6000 : 3500;
      const t = setTimeout(function () { setFixNote(''); }, ms);
      return function () { clearTimeout(t); };
    }, [fixNote]);

    /* ------------------------------------------------------------------
       LUONG: KICH HOAT CODE
       ------------------------------------------------------------------ */
    const onRedeem = useCallback(async function () {
      const clean = String(code || '').trim().toUpperCase();
      if (clean.length !== 6) { setRedeemNote('Sai Mã, Vui Lòng Thử Lại'); return; }

      setRedeemState('redeeming');
      setRedeemNote('');
      const r = await callApi('redeem_code', clean, appId);
      setRedeemState('idle');

      if (!r || r.invalid || r.code_not_found) { setRedeemNote('Sai Mã, Vui Lòng Thử Lại'); return; }
      if (r.not_installed) { setRedeemNote('Bạn Chưa Cài Đặt NexusT'); return; }
      if (r.wrong_game) { setRedeemNote('Code Này Phải Kích Hoạt Ở Game Khác'); return; }
      if (r.success) {
        setCode('');
        setRedeemNote('Đã Kích Hoạt Game Thành Công' +
          (r.uses_remaining !== null && r.uses_remaining !== undefined ? ' (còn ' + r.uses_remaining + ' lượt)' : ''));
        toast.push({ tone: 'ok', title: 'Kích hoạt thành công', desc: game.title });
        return;
      }
      setRedeemNote(r.error || 'Sai Mã, Vui Lòng Thử Lại');
    }, [code, appId, game.title, toast]);

    /* ------------------------------------------------------------------
       LUONG: FIX GAME
       ------------------------------------------------------------------ */
    const onFix = useCallback(async function () {
      setFixState('fixing');
      setFixNote('');

      const steam = await callApi('check_steam');
      if (!steam || !steam.installed) {
        setFixState('idle');
        setFixNote('Chưa Cài Đặt Steam, Vui Lòng Cài Đặt Steam Trước Khi Fix Game');
        return;
      }

      const r = await callApi('fix_game', steam.path, game.fix, game.appId);
      setFixState('idle');

      if (!r || r.not_installed) { setFixNote('Bạn chưa cài đặt game'); return; }
      if (r.success) {
        setFixNote('Đã Fix Game Hoàn Tất');
        toast.push({ tone: 'ok', title: 'Đã fix game hoàn tất', desc: game.title });
        if (isPalworld) {
          const p = await callApi('check_palworld_steamfix', steam.path);
          if (p) { setPalHasFix(!!p.has_steamfix); if (p.language) setPalLang(p.language); }
        }
        return;
      }
      setFixNote(r.error || 'Lỗi: Không fix được game');
    }, [game.fix, game.appId, game.title, isPalworld, toast]);

    /* ------------------------------------------------------------------
       LUONG: DOI NGON NGU PALWORLD
       ------------------------------------------------------------------ */
    const onLangPick = useCallback(async function (langCode) {
      setLangBusy(true);
      const steam = await callApi('check_steam');
      if (!steam || !steam.installed) {
        setLangBusy(false);
        setLangOpen(false);
        toast.push({ tone: 'bad', title: 'Chưa Cài Đặt Steam', desc: 'Vui lòng cài Steam trước khi đổi ngôn ngữ.' });
        return;
      }

      const r = await callApi('set_palworld_language', steam.path, langCode);
      setLangBusy(false);

      if (r && r.success) {
        const list = window.PALWORLD_LANGUAGES || [];
        const found = list.find(function (l) { return l.code === langCode; });
        setPalLang(langCode);
        setLangOpen(false);
        toast.push({
          tone: 'ok',
          title: 'Đã đổi ngôn ngữ thành ' + ((found && found.native) || langCode),
          desc: 'Thay đổi áp dụng khi khởi động lại Palworld.'
        });
        return;
      }
      toast.push({ tone: 'bad', title: 'Không đổi được ngôn ngữ', desc: (r && r.error) || 'Vui lòng thử lại.' });
    }, [toast]);

    /* ------------------------------------------------------------------
       LUONG: TRUY CAP GAME (NexusT -> Windows Update -> share)
       ------------------------------------------------------------------ */
    const onAccess = useCallback(async function () {
      setAccessNote('');
      setAccessState('checking');

      const steam = await callApi('check_steam');
      if (!steam || !steam.installed) {
        setAccessState('idle');
        setAccessNote('Chưa Cài Đặt Steam, Vui Lòng Cài Đặt Steam Trước');
        return;
      }

      const nx = await callApi('check_nexust', steam.path);
      if (!nx || !nx.installed) {
        setAccessState('installing_nexust');
        const ins = await callApi('install_nexust', steam.path);
        if (!ins || !ins.success) {
          setAccessState('idle');
          setAccessNote((ins && ins.error) || 'Lỗi: Không cài đặt được NexusT');
          return;
        }
      }

      if (game.redeem === true) {
        setAccessState('disabling_wu');
        const rw = await callApi('disable_windows_update');
        if (rw && rw.warning) {
          setAccessNote(rw.warning);
        } else if (rw && rw.disabled) {
          setAccessNote('Đã Tắt Windows Update Hoàn Tất');
        }
      }

      setAccessState('sharing');
      const r2 = await callApi('share_game', steam.path, appId);
      setAccessState('idle');

      if (!r2) { setAccessNote('Lỗi: Không nhận được phản hồi'); return; }
      if (r2.already || r2.already_exists) { setAccessNote('Bạn Đã Có Game Này'); return; }
      if (r2.success) {
        setAccessNote('Đã Share Game Qua Tài Khoản Steam Của Bạn Hoàn Tất');
        toast.push({ tone: 'ok', title: 'Đã thêm game vào Steam', desc: game.title });
        return;
      }
      setAccessNote(r2.error || 'Lỗi: Không share được game');
    }, [appId, game.redeem, game.title, toast]);

    /* ------------------------------------------------------------------
       LUONG: GAME NGUON RIENG
       ------------------------------------------------------------------ */
    const onRevStart = useCallback(async function () {
      setRevNote('');
      persistRevState('checking');

      const s = await callApi('get_custom_file_size', customAppId);
      if (!s || !s.success) {
        persistRevState('idle');
        setRevNote('Lỗi: Không lấy được dung lượng file từ Buzzheavier');
        return;
      }

      setRevSize(s);
      setRevPath('');
      setRevPicker(true);
      persistRevState('selecting', { fileSize: s });
    }, [customAppId, persistRevState]);

    const onRevBrowse = useCallback(async function () {
      const r = await callApi('open_folder_dialog');
      if (r && r.path) setRevPath(r.path);
    }, []);

    const onRevSave = useCallback(async function () {
      if (!revPath) return;
      setRevPicker(false);
      setRevNote('');
      persistRevState('checking_space', { installPath: revPath });

      const need = revSize ? revSize.size_bytes : 0;
      const space = await callApi('check_custom_disk_space', revPath, need);
      if (!space || !space.enough) {
        persistRevState('idle');
        setRevNote('Không Đủ Dung Lượng Hệ Thống');
        toast.push({ tone: 'bad', title: 'Không Đủ Dung Lượng Hệ Thống', desc: 'Cần khoảng ' + fmtBytes(need * 2) + ' trống.' });
        return;
      }

      const p0 = { percent: 0, downloaded: 0, total: need };
      setRevProgress(p0);
      persistRevState('downloading', { progress: p0, installPath: revPath });

      const r = await callApi('install_custom_game', customAppId, revPath);
      if (r && r.success) {
        setRevSaved(r.path || revPath);
        setRevProgress({ percent: 0, downloaded: 0, total: 0 });
        persistRevState('installed');
        REV_STATE_CACHE.delete(customAppId);
        toast.push({ tone: 'ok', title: 'Cài đặt hoàn tất', desc: game.title });
        return;
      }
      persistRevState('idle');
      setRevNote('Lỗi: ' + ((r && r.error) || 'Không cài đặt được game'));
    }, [revPath, revSize, customAppId, persistRevState, game.title, toast]);

    const onRevCancel = useCallback(function () {
      setRevPicker(false);
      persistRevState('idle');
    }, [persistRevState]);

    const onRevLaunch = useCallback(async function () {
      toast.push({ tone: 'info', title: 'Đang Khởi Chạy Game', desc: 'Vui Lòng Đợi...' });
      const r = await callApi('launch_custom_game', customAppId);
      if (r && !r.success) toast.push({ tone: 'bad', title: 'Không khởi chạy được', desc: r.error || 'Vui lòng thử lại.' });
    }, [customAppId, toast]);

    const onRevFolder = useCallback(async function () {
      const r = await callApi('open_custom_folder', customAppId);
      if (r && !r.success) toast.push({ tone: 'bad', title: 'Không mở được thư mục', desc: r.error || '' });
    }, [customAppId, toast]);

    const onRevUninstall = useCallback(async function () {
      setRevConfirm(false);
      const r = await callApi('uninstall_custom_game', customAppId);
      if (r && r.success) {
        setRevSaved('');
        setRevPath('');
        persistRevState('idle');
        REV_STATE_CACHE.delete(customAppId);
        toast.push({ tone: 'ok', title: 'Đã gỡ cài đặt', desc: game.title });
        return;
      }
      toast.push({ tone: 'bad', title: 'Không gỡ được game', desc: (r && r.error) || 'Vui lòng thử lại.' });
    }, [customAppId, persistRevState, game.title, toast]);

    /* ------------------------------------------------------------------
       NHAN NUT THEO TRANG THAI
       ------------------------------------------------------------------ */
    const ACCESS_LABEL = {
      idle: 'Click Vào Đây Để Truy Cập',
      checking: 'Đang Kiểm Tra...',
      installing_nexust: 'Đang Cài Đặt NexusT...',
      disabling_wu: 'Đang Tắt Windows Update...',
      writing_registry: 'Đang Ghi Registry Xác Thực...',
      sharing: 'Đang Share Game Qua Steam...'
    };
    const REV_LABEL = {
      idle: 'Click Vào Đây Để Truy Cập',
      checking: 'Đang Kiểm Tra...',
      selecting: 'Đang Chờ Chọn Thư Mục...',
      checking_space: 'Đang Kiểm Tra Dung Lượng...',
      downloading: 'Đang Tải Game...',
      installing: 'Đang Cài Đặt Game...'
    };

    const langs = window.PALWORLD_LANGUAGES || [];
    const curLang = langs.find(function (l) { return l.code === palLang; });

    /* ================================================================== */
    return (
      <div className="gd">
        <div className="gd__bg">
          <div className={'gd__bg-img is-in'} style={{ backgroundImage: 'url("' + bgSrc + '")' }} />
        </div>

        <div className="gd__inner">
          <div className="gd__head">
            <button className="gd__back" onClick={onBack}>
              <i className="ph-bold ph-arrow-left"></i>Quay lại
            </button>
            <div className="gd__crumb">Thư viện · <b>{game.title}</b></div>
          </div>

          <div className="gd__grid">
            {/* ------------------------------ COT TRAI ------------------------------ */}
            <div>
              <MediaStage game={game} media={media} idx={idx} setIdx={setIdx} onZoom={setZoom} />

              <div className="gd__about">
                <h3><i className="ph-bold ph-text-align-left"></i>Giới thiệu</h3>
                {about ? (
                  <div className="gd__desc">{about}</div>
                ) : live === null ? (
                  <div className="gd__desc" style={{ color: 'var(--tx-faint)' }}>
                    <span className="nx-spin" style={{ marginRight: 8, verticalAlign: '-2px' }} />
                    Đang tải mô tả từ Steam...
                  </div>
                ) : (
                  <div className="gd__desc" style={{ color: 'var(--tx-faint)' }}>
                    Chưa có mô tả cho trò chơi này.
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------------ COT PHAI ------------------------------ */}
            <aside className="gd__panel">
              <div className="gd__cover">
                <Img sources={coverSources(appId)} alt={game.title}
                     imgClass="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div className="gd__cover-t">{game.title}</div>
              </div>

              <div className="pc">
                {!isUpcoming && (
                  <div className={'rev is-' + tone}>
                    <ScoreRing percent={game.percent} size={58} />
                    <div className="rev__main">
                      <div className={'rev__txt is-' + tone}>{game.reviewText || 'Chưa có đánh giá'}</div>
                      <div className="rev__cnt">
                        {revCount > 0 ? fmtCount(revCount) + ' lượt đánh giá trên Steam' : (game.reviewCount || '—')}
                      </div>
                    </div>
                    {pct !== null && <i className={TONE_ICON[tone] + ' is-' + tone} style={{ fontSize: 20 }}></i>}
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="gd__tags">
                    <span className="nx-tag" style={{ color: 'var(--c-steam)' }}>
                      <i className="fa-brands fa-steam"></i>STEAM
                    </span>
                    {tags.map(function (t) { return <span className="nx-tag" key={t}>{t}</span>; })}
                  </div>
                )}

                <div className="pt">
                  <button className={'pt__b' + (tab === 'info' ? ' is-on' : '')} onClick={function () { setTab('info'); }}>
                    <i className="ph-bold ph-info"></i>Thông tin
                  </button>
                  <button className={'pt__b' + (tab === 'sys' ? ' is-on' : '')} onClick={function () { setTab('sys'); }}>
                    <i className="ph-bold ph-desktop-tower"></i>Cấu hình
                  </button>
                </div>

                {tab === 'info' ? <InfoSpecs game={game} live={live} /> : <SysSpecs req={sysreq} />}

                {/* ---------------------------- HANH DONG ---------------------------- */}
                <div className="act">
                  {isUpcoming && (
                    <ActionButton
                      tone="mute" ico="ph-fill ph-clock" arrow={false} disabled
                      eyebrow="CHƯA CÓ" label="Sắp Ra Mắt"
                    />
                  )}

                  {/* --- Game nguon rieng --- */}
                  {!isUpcoming && customAppId && revState !== 'installed' && (
                    <React.Fragment>
                      <ActionButton
                        tone="primary"
                        ico="ph-bold ph-key"
                        spinning={revState !== 'idle'}
                        disabled={revState !== 'idle'}
                        eyebrow="TRUY CẬP GAME"
                        label={REV_LABEL[revState] || 'Đang Xử Lý...'}
                        onClick={onRevStart}
                      />

                      {revState === 'downloading' && revProgress.total > 0 && (
                        <div className="prog">
                          <div className="prog__top">
                            <span className="prog__pct">{Number(revProgress.percent || 0).toFixed(1)}%</span>
                            <span className="prog__sub">
                              {fmtBytes(revProgress.downloaded)} / {fmtBytes(revProgress.total)}
                            </span>
                          </div>
                          <div className="prog__trk">
                            <div className="prog__bar" style={{ width: Math.max(0, Math.min(100, revProgress.percent || 0)) + '%' }} />
                          </div>
                        </div>
                      )}

                      {(revState === 'installing' || (revState === 'downloading' && !revProgress.total)) && (
                        <div className="prog">
                          <div className="prog__top">
                            <span className="prog__sub">
                              {revState === 'installing'
                                ? 'Đang giải nén và cài đặt, vui lòng đợi vài phút...'
                                : 'Đang khởi tạo tiến trình tải...'}
                            </span>
                          </div>
                          <div className="prog__trk prog__trk--indet"><div className="prog__bar" /></div>
                        </div>
                      )}

                      {revNote && <Note tone={noteTone(revNote)}>{revNote}</Note>}
                    </React.Fragment>
                  )}

                  {!isUpcoming && customAppId && revState === 'installed' && (
                    <React.Fragment>
                      <div className="act__hr"><i className="ph-fill ph-check-circle"></i>Sẵn sàng khởi chạy</div>
                      <div className="act__grid">
                        <button className="nx-btn nx-btn--primary act__wide" onClick={onRevLaunch}>
                          <i className="ph-fill ph-play"></i>Khởi Chạy
                        </button>
                        <button className="nx-btn nx-btn--ghost" onClick={onRevFolder}>
                          <i className="ph-fill ph-folder-open"></i>Thư Mục
                        </button>
                        <button className="nx-btn nx-btn--bad" onClick={function () { setRevConfirm(true); }}>
                          <i className="ph-fill ph-trash"></i>Gỡ Cài Đặt
                        </button>
                      </div>
                      {revSaved && (
                        <div className="prog__sub nx-selectable" style={{ wordBreak: 'break-all' }}>
                          <i className="ph-bold ph-map-pin" style={{ marginRight: 5 }}></i>{revSaved}
                        </div>
                      )}
                    </React.Fragment>
                  )}

                  {/* --- Game qua Steam --- */}
                  {!isUpcoming && appId && !customAppId && (
                    <React.Fragment>
                      <ActionButton
                        tone="primary"
                        ico="ph-bold ph-key"
                        spinning={accessState !== 'idle'}
                        disabled={accessState !== 'idle'}
                        eyebrow="TRUY CẬP GAME"
                        label={ACCESS_LABEL[accessState] || 'Đang Xử Lý...'}
                        onClick={onAccess}
                      />
                      {accessNote && <Note tone={noteTone(accessNote)}>{accessNote}</Note>}

                      {hasFix && (isPalworld && palHasFix ? (
                        <ActionButton
                          tone="ghost"
                          ico="ph-bold ph-translate"
                          spinning={langBusy}
                          disabled={langBusy}
                          eyebrow={curLang ? ('ĐANG DÙNG: ' + String(curLang.native).toUpperCase()) : 'THAY ĐỔI NGÔN NGỮ'}
                          label={langBusy ? 'Đang đổi...' : 'Thay Đổi Ngôn Ngữ'}
                          onClick={function () { setLangOpen(true); }}
                        />
                      ) : (
                        <ActionButton
                          tone="ghost"
                          ico="ph-bold ph-wrench"
                          spinning={fixState !== 'idle'}
                          disabled={fixState !== 'idle'}
                          eyebrow="SỬA LỖI KẾT NỐI"
                          label={fixState === 'idle' ? 'Fix Game' : 'Đang Fix Game...'}
                          onClick={onFix}
                        />
                      ))}
                      {fixNote && <Note tone={noteTone(fixNote)}>{fixNote}</Note>}

                      {hasRedeem && (
                        <React.Fragment>
                          <div className="code">
                            <input
                              type="text"
                              value={code}
                              onChange={function (e) { setCode(e.target.value.toUpperCase().slice(0, 6)); }}
                              onKeyDown={function (e) { if (e.key === 'Enter' && redeemState === 'idle') onRedeem(); }}
                              placeholder="NHẬP 6 KÝ TỰ"
                              maxLength={6}
                              spellCheck="false"
                              disabled={redeemState !== 'idle'}
                            />
                            <button
                              className="nx-btn nx-btn--warn"
                              style={{ height: 42, flex: 'none' }}
                              onClick={onRedeem}
                              disabled={redeemState !== 'idle'}
                            >
                              {redeemState === 'idle'
                                ? <React.Fragment><i className="ph-fill ph-ticket"></i>Kích hoạt</React.Fragment>
                                : <React.Fragment><span className="nx-spin" />Đang xử lý</React.Fragment>}
                            </button>
                          </div>
                          {redeemNote && <Note tone={noteTone(redeemNote)}>{redeemNote}</Note>}
                        </React.Fragment>
                      )}
                    </React.Fragment>
                  )}

                  {!isUpcoming && appId && (
                    <button
                      className="nx-btn nx-btn--ghost nx-btn--sm nx-btn--full"
                      onClick={function () { openExternal('https://store.steampowered.com/app/' + appId + '/'); }}
                    >
                      <i className="fa-brands fa-steam"></i>Xem trên Steam Store
                    </button>
                  )}
                </div>
              </div>

              {/* ------------------------------ BANNER ------------------------------ */}
              <button className="bn bn--discord" onClick={function () { openExternal(DISCORD_URL); }}>
                <span className="bn__ico"><i className="fa-brands fa-discord"></i></span>
                <span style={{ textAlign: 'left' }}>
                  <span className="bn__t" style={{ display: 'block' }}>HỖ TRỢ &amp; CẬP NHẬT</span>
                  <span className="bn__d" style={{ display: 'block' }}>Tham gia Discord để nhận thông tin mới nhất</span>
                </span>
                <i className="bn__go ph-bold ph-arrow-up-right"></i>
              </button>

              {game.viethoaLink && (
                <button className="bn bn--vh" onClick={function () { openExternal(game.viethoaLink); }}>
                  <span className="bn__ico">
                    <img src={game.viethoaLogo || 'https://theredteam.vn/index_files/images/logoRedHome.png'}
                         alt="Việt hóa"
                         onError={function (e) { e.target.style.display = 'none'; }} />
                  </span>
                  <span style={{ textAlign: 'left' }}>
                    <span className="bn__t" style={{ display: 'block' }}>HỖ TRỢ VIỆT HÓA</span>
                    <span className="bn__d" style={{ display: 'block' }}>
                      {game.viethoaDesc || 'Tải bản dịch tiếng Việt từ The Red Team'}
                    </span>
                  </span>
                  <i className="bn__go ph-bold ph-arrow-up-right"></i>
                </button>
              )}
            </aside>
          </div>
        </div>

        {/* ------------------------------ PHONG TO ANH ------------------------------ */}
        {zoom && <ZoomView src={zoom} alt={game.title} onClose={function () { setZoom(null); }} />}

        {/* ------------------------------ CHON THU MUC ------------------------------ */}
        <Sheet
          open={revPicker}
          onClose={onRevCancel}
          icon="ph-fill ph-folder-plus"
          title="Chọn vị trí cài đặt"
          desc={'Cần tối thiểu ' + (revSize ? (revSize.size_gb * 2).toFixed(2) + ' GB' : '...') + ' dung lượng trống'}
          footer={
            <React.Fragment>
              <button className="nx-btn nx-btn--ghost" onClick={onRevCancel}>Hủy</button>
              <button className="nx-btn nx-btn--primary" onClick={onRevSave} disabled={!revPath}>
                <i className="ph-bold ph-download-simple"></i>Bắt đầu tải
              </button>
            </React.Fragment>
          }
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              readOnly
              value={revPath}
              placeholder="VD: D:\Games"
              onClick={onRevBrowse}
              style={{
                flex: 1, minWidth: 0, height: 42, padding: '0 14px',
                borderRadius: 'var(--r-sm)', background: 'var(--bg-sunken)',
                border: '1px solid var(--line-mid)', color: 'var(--tx-hi)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            />
            <button className="nx-btn nx-btn--ghost" style={{ height: 42, flex: 'none' }} onClick={onRevBrowse}>
              <i className="ph-bold ph-folder-open"></i>Duyệt
            </button>
          </div>
          {revSize && (
            <div className="prog__sub" style={{ marginTop: 12 }}>
              <i className="ph-bold ph-file-archive" style={{ marginRight: 6 }}></i>
              Dung lượng tải về: <b style={{ color: 'var(--br-1)' }}>{revSize.size_gb} GB</b>
            </div>
          )}
        </Sheet>

        {/* ------------------------------ XAC NHAN GO ------------------------------ */}
        <Sheet
          open={revConfirm}
          onClose={function () { setRevConfirm(false); }}
          icon="ph-fill ph-warning"
          iconTone="var(--bad)"
          title="Gỡ cài đặt trò chơi?"
          desc="Toàn bộ thư mục game sẽ bị xóa và không thể hoàn tác."
          footer={
            <React.Fragment>
              <button className="nx-btn nx-btn--ghost" onClick={function () { setRevConfirm(false); }}>Hủy</button>
              <button className="nx-btn nx-btn--bad" onClick={onRevUninstall}>
                <i className="ph-bold ph-trash"></i>Gỡ cài đặt
              </button>
            </React.Fragment>
          }
        >
          <div className="prog__sub nx-selectable" style={{ wordBreak: 'break-all' }}>
            {revSaved || game.title}
          </div>
        </Sheet>

        {/* ------------------------------ CHON NGON NGU ------------------------------ */}
        <Sheet
          open={langOpen}
          onClose={function () { setLangOpen(false); }}
          icon="ph-fill ph-translate"
          title="Ngôn ngữ cho Palworld"
          desc="Thay đổi chỉ áp dụng khi khởi động lại game."
          footer={<button className="nx-btn nx-btn--ghost" onClick={function () { setLangOpen(false); }}>Đóng</button>}
        >
          <div className="lang">
            {langs.map(function (l) {
              return (
                <button
                  key={l.code}
                  className={'lang__b' + (palLang === l.code ? ' is-on' : '')}
                  disabled={langBusy}
                  onClick={function () { onLangPick(l.code); }}
                >
                  <i className={'lang__f ph-fill ' + (palLang === l.code ? 'ph-check-circle' : 'ph-globe-hemisphere-east')}></i>
                  <span className="lang__n">
                    <span style={{ display: 'block', fontWeight: 750 }}>{l.native}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--tx-faint)' }}>{l.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Sheet>
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     LOP PHU PHONG TO ANH
     ------------------------------------------------------------------------ */

  function ZoomView({ src, alt, onClose }) {
    useEscape(onClose, true);
    return (
      <div className="mo mo--img" onMouseDown={function (e) { if (e.target === e.currentTarget) onClose(); }}>
        <div className="mo__box">
          <img src={src} alt={alt || ''} onClick={onClose} />
        </div>
        <button className="nx-icobtn mo__x" onClick={onClose} aria-label="Đóng">
          <i className="ph-bold ph-x"></i>
        </button>
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     XUAT RA
     ------------------------------------------------------------------------ */

  Object.assign(window.NX, { GameDetail, MediaStage, ActionButton, Sheet, ZoomView, noteTone, stripHtml });
})();
