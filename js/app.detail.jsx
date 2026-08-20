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
    coverSources, fetchMedia, buildMedia, fetchTranslation, steamDateVN,
    REV_STATE_CACHE, setRevListener,
    useEscape, useToast,
    Img, useCountUp, Note,
    TX, useLang, tagTone, markedTone, stripTone
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

  /* Cau nao do minh tu dat thi da co san dau bao mau o dau chuoi — doc dau do
     truoc, vi sau khi dich sang tieng khac thi do tu khoa se khong con dung. */
  function noteTone(msg) {
    if (!msg) return 'info';
    const mk = markedTone(msg);
    if (mk) return mk;
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

  /* --------------------------------------------------------------------------
     CAT MO TA THANH KHOI
     Steam chi tra ve mot khoi van ban dai. Doc mot buc tuong chu la cuc hinh,
     nen o day tach ra thanh: doan dan, tieu de phu, danh sach gach dau dong,
     doan thuong -- de mat luot qua van nam duoc y chinh.
     ------------------------------------------------------------------------ */

  const BULLET_RE = /^[•▪●·*\-–—]\s+/;

  function parseAbout(text) {
    const lines = String(text || '').split('\n').map(function (l) { return l.trim(); });
    const blocks = [];
    let para = [];
    let list = [];

    /* Steam doi khi ngat dong giua cau -> noi lai neu dong truoc chua ket thuc */
    function pushPara(t) {
      const last = para.length ? para[para.length - 1] : '';
      if (last && !/[.!?…:;"”'’)\]]$/.test(last)) para[para.length - 1] = last + ' ' + t;
      else para.push(t);
    }
    function flushPara() {
      for (let i = 0; i < para.length; i++) blocks.push({ k: 'p', t: para[i] });
      para = [];
    }
    function flushList() {
      if (list.length) { blocks.push({ k: 'ul', items: list }); list = []; }
    }
    function nextAt(i) {
      for (let j = i + 1; j < lines.length; j++) if (lines[j]) return lines[j];
      return '';
    }
    /* Dong ngan, khong dau ket cau, dung truoc mot doan dai -> tieu de phu */
    function isHead(t, next) {
      if (!next || BULLET_RE.test(t)) return false;
      if (/[:：]$/.test(t)) return true;
      if (t.length > 52 || t.split(/\s+/).length > 7) return false;
      if (/[.,;!?…"”'’]$/.test(t)) return false;
      if (!/^[\p{Lu}\p{N}]/u.test(t)) return false;
      return BULLET_RE.test(next) || next.length > 60;
    }

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i];
      if (!t) {
        /* Dong trong giua hai gach dau dong khong duoc cat doi danh sach */
        if (!BULLET_RE.test(nextAt(i))) flushList();
        flushPara();
        continue;
      }
      if (BULLET_RE.test(t)) { flushPara(); list.push(t.replace(BULLET_RE, '').trim()); continue; }
      flushList();
      if (isHead(t, nextAt(i))) {
        flushPara();
        blocks.push({ k: 'h', t: t.replace(/[:：]$/, '') });
        continue;
      }
      pushPara(t);
    }
    flushList();
    flushPara();

    /* Vai game dung dau cham tron cho tieu de muc -> danh sach chi co 1 muc
       thuc chat la mot tieu de, khong phai gach dau dong. */
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.k === 'ul' && b.items.length === 1 && b.items[0].length <= 64 &&
          !/[.!?…]$/.test(b.items[0])) {
        blocks[i] = { k: 'h', t: b.items[0].replace(/[:：]$/, '') };
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].k === 'p') { blocks[i].k = 'lead'; break; }
    }
    return blocks;
  }

  /* Cao toi da khi chua bung -- du de doc y chinh ma khong nuot ca trang */
  const ABOUT_CLAMP = 470;

  /* Ten ngon ngu goc cua trang cua hang Steam (Steam chi bao vi / khong-vi) */
  /* Ten cac thu tieng — de bao cho nguoi doc biet ban goc tren Steam viet bang gi */
  const LANG_LABEL = {
    vi: 'Tiếng Việt', en: 'Tiếng Anh', ja: 'Tiếng Nhật',
    es: 'Tiếng Tây Ban Nha', fr: 'Tiếng Pháp'
  };
  function langLabel(c) { return TX(LANG_LABEL[c] || 'ngoại ngữ'); }

  /* Anh dong Steam nhung giua bai: chi cho chay khi dang nam trong khung nhin,
     cuon qua la dung — do khong lam nong may khi mo ta co toi 10 video. */
  function RichVideo({ b }) {
    const ref = useRef(null);
    const [on, setOn] = useState(false);

    useEffect(function () {
      const el = ref.current;
      if (!el || typeof IntersectionObserver === 'undefined') return undefined;
      const io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) {
            const p = el.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            el.pause();
          }
        });
      }, { threshold: 0.15 });
      io.observe(el);
      return function () { io.disconnect(); };
    }, []);

    return (
      <video
        ref={ref}
        className={'gd__media' + (on ? ' is-on' : '')}
        src={b.src}
        poster={b.poster || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedData={function () { setOn(true); }}
      />
    );
  }

  function RichFigure({ b }) {
    const [ok, setOk] = useState(true);
    const ratio = b.w && b.h ? b.w + ' / ' + b.h : undefined;
    if (!ok) return null;
    return (
      <figure className={'gd__fig' + (b.k === 'vid' ? ' gd__fig--v' : '')}
              style={{ aspectRatio: ratio }}>
        {b.k === 'vid' ? (
          <RichVideo b={b} />
        ) : (
          <img className="gd__media" src={b.src} alt="" loading="lazy" decoding="async"
               onError={function () { setOk(false); }} />
        )}
      </figure>
    );
  }

  /* Ve mang khoi da co cau truc (tieu de / doan / danh sach / anh / anh dong) */
  function RichBody({ blocks }) {
    let lead = true;
    return blocks.map(function (b, i) {
      if (b.k === 'img' || b.k === 'vid') return <RichFigure key={i} b={b} />;

      if (b.k === 'h') return <h4 className="gd__h" key={i}>{b.t}</h4>;

      if (b.k === 'ul') {
        return (
          <ul className="gd__ul" key={i}>
            {b.items.map(function (t, j) {
              return (
                <li key={j}>
                  <i className="ph-fill ph-caret-right" aria-hidden="true"></i>
                  <span>{t}</span>
                </li>
              );
            })}
          </ul>
        );
      }

      const isLead = lead && b.k === 'p';
      if (isLead) lead = false;
      return <p className={isLead ? 'gd__lead' : 'gd__p'} key={i}>{b.t}</p>;
    });
  }

  function AboutBlock({ appId, live, about }) {
    const lang = useLang();
    const [tr, setTr] = useState(null);     /* null = dang cho, false = khong co */
    const [open, setOpen] = useState(false);
    const [tall, setTall] = useState(false);
    const body = useRef(null);

    /* Steam khong co trang cua hang o thu tieng dang chon -> nho may chu dich */
    const srcLang = (live && live.about_lang) || '';
    const hasRaw = !!(live && Array.isArray(live.about_rich) && live.about_rich.length);
    const needTr = !!(live && srcLang && srcLang !== lang && (about || hasRaw));

    useEffect(function () {
      /* PHAI xoa ban dich cu o day.

         Truoc day cho "return" luon khi khong con can dich. Nhung khi nguoi
         dung dang o trong trang game va doi ngon ngu giao dien ve dung ngon
         ngu goc cua bai gioi thieu (vd bai viet tieng Anh, doi giao dien sang
         EN), needTr chuyen tu true sang false -> hieu ung thoat som -> bien
         "tr" van con giu ban dich tieng Viet cu -> moi thu khac doi ngon ngu
         het rieng bai gioi thieu thi khong. Dat lai thanh false (= khong co
         ban dich) de bai viet quay ve ban goc ngay lap tuc. */
      if (!needTr || !appId) { setTr(false); return undefined; }
      let alive = true;
      setTr(null);
      fetchTranslation(appId, lang).then(function (d) { if (alive) setTr(d || false); });
      return function () { alive = false; };
    }, [needTr, appId, lang]);

    const viText = tr && tr.about ? tr.about : '';
    const viRich = tr && Array.isArray(tr.about_rich) && tr.about_rich.length ? tr.about_rich : null;
    const useVi = !!viRich || !!viText;

    /* Uu tien mang khoi (giu duoc anh + anh dong Steam chen giua bai);
       chi khi khong co moi tach chu bang bo doan heuristic cu. */
    const blocks = useMemo(function () {
      const raw = hasRaw ? live.about_rich : null;
      if (useVi && viRich) return viRich;
      if (!useVi && raw) return raw;
      if (useVi && viText) return parseAbout(viText);
      if (raw) return raw;
      return parseAbout(about);
    }, [useVi, viRich, viText, hasRaw, live, about]);

    const hasMedia = useMemo(function () {
      return blocks.some(function (b) { return b.k === 'img' || b.k === 'vid'; });
    }, [blocks]);

    const hasText = !!(about || blocks.length);

    useEffect(function () {
      const el = body.current;
      const cap = hasMedia ? ABOUT_CLAMP + 250 : ABOUT_CLAMP;
      setTall(!!el && el.scrollHeight > cap + 90);
    }, [blocks, hasMedia]);

    useEffect(function () { setOpen(false); }, [appId, lang]);

    /* Vai con so nho thay cho cap nut doi ngon ngu cu — dau trang do khong bi
       trong, va nguoi doc biet truoc bai dai bao nhieu. */
    const stat = useMemo(function () {
      let chars = 0;
      let shots = 0;
      blocks.forEach(function (b) {
        if (b.k === 'img' || b.k === 'vid') { shots++; return; }
        chars += b.k === 'ul'
          ? (b.items || []).join(' ').length
          : String(b.t || '').length;
      });
      return { mins: Math.max(1, Math.round(chars / 900)), shots: shots };
    }, [blocks]);

    const native = srcLang === lang;
    const langChip = srcLang ? (
      <span
        className={'gd__lang is-' + (native ? 'vi' : 'en')}
        title={native
          ? TX('Nhà phát hành đã viết sẵn bản này trên Steam')
          : TX('Trang Steam của trò chơi này chỉ có {lang}', { lang: langLabel(srcLang) })}>
        <i className={'ph-fill ' + (native ? 'ph-seal-check' : 'ph-globe-hemisphere-west')}></i>
        {LANG_LABEL[srcLang] ? langLabel(srcLang) : srcLang.toUpperCase()}
      </span>
    ) : null;

    return (
      <section className="gd__about">
        <div className="gd__about-h">
          <span className="gd__about-i"><i className="ph-fill ph-article"></i></span>
          <h3>{TX('Giới thiệu')}</h3>
          {langChip}
          <span className="gd__rule" />
          {needTr && tr === null && (
            <span className="gd__trwait"><span className="nx-spin" />{TX('Đang dịch')}</span>
          )}
          {hasText && (
            <div className="gd__meta">
              <span className="gd__meta__i" title={TX('Thời gian đọc ước tính')}>
                <i className="ph-fill ph-book-open-text"></i>
                {TX('{n} phút đọc', { n: stat.mins })}
              </span>
              {stat.shots > 0 && (
                <span className="gd__meta__i" title={TX('Ảnh và video kèm trong bài giới thiệu')}>
                  <i className="ph-fill ph-images-square"></i>{stat.shots}
                </span>
              )}
              {tr && tr.source === 'steam' && (
                <span className="gd__meta__i is-ok" title={TX('Bản dịch chính thức của nhà phát hành')}>
                  <i className="ph-fill ph-seal-check"></i>{TX('Chính chủ')}
                </span>
              )}
              {tr && tr.source === 'auto' && (
                <span className="gd__meta__i is-tr" title={TX('Bản dịch do máy thực hiện')}>
                  <i className="ph-fill ph-translate"></i>{TX('Đã dịch')}
                </span>
              )}
            </div>
          )}
        </div>

        {!hasText && live === null && (
          <div className="gd__skel" aria-label={TX('Đang tải mô tả')}>
            <span /><span /><span /><span /><span />
          </div>
        )}

        {!hasText && live !== null && (
          <p className="gd__p gd__p--empty">{TX('Chưa có mô tả cho trò chơi này.')}</p>
        )}

        {hasText && (
          <React.Fragment>
            <div
              className={'gd__body' + (hasMedia ? ' has-media' : '') + (tall && !open ? ' is-clamp' : '')}
              ref={body}>
              <RichBody blocks={blocks} />
            </div>

            {tall && (
              <button type="button" className="gd__more"
                      onClick={function () { setOpen(!open); }}>
                <i className={'ph-bold ' + (open ? 'ph-caret-up' : 'ph-caret-down')}></i>
                {open ? TX('Thu gọn') : TX('Đọc thêm')}
              </button>
            )}

            {tr && tr.source === 'auto' && (
              <div className="gd__trnote">
                <i className="ph-bold ph-translate"></i>
                <span>
                  {TX('Bản dịch tự động — bản gốc do nhà phát hành viết bằng {lang}.', { lang: langLabel(srcLang) })}
                </span>
              </div>
            )}
          </React.Fragment>
        )}
      </section>
    );
  }

  /* --------------------------------------------------------------------------
     DIEM DANH GIA — BANG SO

     Ban truoc la mot vong tron co con so dat giua. Con so nam de tuyet doi
     chong len giua vong, nen chi can font tai cham mot nhip, chieu cao dong
     chu lech mot chut hay so lieu doi tu 2 sang 3 chu so la lai lech tam --
     da chinh nhieu lan van con.

     Ban nay bo han vong tron. Con so va dau % nam canh nhau trong mot hop
     flex canh theo CHAN CHU (align-items: baseline) — day la cach trinh duyet
     xep chu binh thuong, khong he co toa do tuyet doi nao, nen ve mat cau truc
     KHONG THE lech duoc, du font hay so chu so co doi the nao.
     ------------------------------------------------------------------------ */
  function ScorePlate({ percent }) {
    const shown = useCountUp(percent);
    if (percent === null || percent === undefined) {
      return (
        <div className="rev__plate is-na">
          <span className="rev__num">—</span>
        </div>
      );
    }
    const v = Math.round(shown === null ? percent : shown);
    return (
      <div className="rev__plate">
        <span className="rev__num">{v}%</span>
      </div>
    );
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
      drag.current = { down: true, moved: false, cap: false, x: e.clientX, left: el.scrollLeft };
      /* KHONG bat con tro ngay o day. Neu bat, Chromium se chuyen huong su kien
         click sang chinh dai anh thay vi vao nut ben trong -> khong doi duoc
         anh/video. Chi bat khi nguoi dung that su keo (xem onMove). */
    };
    const onMove = function (e) {
      const el = strip.current;
      if (!el || !drag.current.down) return;
      const dx = e.clientX - drag.current.x;
      if (!drag.current.moved && Math.abs(dx) > DRAG_THRESHOLD) {
        drag.current.moved = true;
        setDragging(true);
        try { el.setPointerCapture(e.pointerId); drag.current.cap = true; } catch (err) {}
      }
      if (drag.current.moved) el.scrollLeft = drag.current.left - dx;
    };
    const onUp = function (e) {
      const el = strip.current;
      if (el && drag.current.cap) { try { el.releasePointerCapture(e.pointerId); } catch (err) {} }
      drag.current.down = false;
      drag.current.cap = false;
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
            <button className="gd__zoom" onClick={function () { onZoom(cur.src); }} aria-label={TX('Phóng to')}>
              <i className="ph-bold ph-magnifying-glass-plus"></i>
            </button>
          )}

          {busy && <div className="gd__stage-load"><div className="nx-spin nx-spin--lg" /></div>}

          {fail && cur && cur.type === 'video' && (
            <div className="gd__stage-load"
                 style={{ background: 'rgba(5,7,11,0.86)', flexDirection: 'column', gap: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ph-fill ph-video-camera-slash" style={{ fontSize: 30, color: 'var(--tx-faint)' }}></i>
              <span style={{ fontSize: 12, color: 'var(--tx-dim)', fontWeight: 600 }}>{TX('Không tải được video này')}</span>
            </div>
          )}

          {media.length > 1 && (
            <React.Fragment>
              <button className="gd__arrow gd__arrow--l" onClick={function () { go(-1); }} aria-label={TX('Trước')}>
                <i className="ph-bold ph-caret-left"></i>
              </button>
              <button className="gd__arrow gd__arrow--r" onClick={function () { go(1); }} aria-label={TX('Sau')}>
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
                  aria-label={TX('Xem mục {n}', { n: i + 1 })}
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

  /* The gia tri nho trong bang thong so — thay cho chu mau tho truoc day */
  function SpecChip({ tone, ico, tint, children }) {
    return (
      <span className={'spec__chip is-' + (tone || 'plain')}
            style={tint ? { '--chip': tint } : undefined}>
        {ico && <i className={ico}></i>}
        {children}
      </span>
    );
  }

  function SpecRow({ ico, k, children }) {
    return (
      <div className="spec__row">
        <div className="spec__k">{ico && <i className={ico}></i>}{k}</div>
        <div className="spec__v">{children}</div>
      </div>
    );
  }

  function InfoSpecs({ game, live }) {
    useLang();
    const online = isOnlineGame(game);
    const cloud = hasCloudSave(game);
    const plat = PLATFORMS.find(function (p) { return p.id === getGamePlatform(game); }) || PLATFORMS[1];
    const dev = live && live.developers && live.developers.length ? live.developers.join(', ') : null;
    const pub = live && live.publishers && live.publishers.length ? live.publishers.join(', ') : null;
    const rel = live && live.release ? steamDateVN(live.release) : null;

    return (
      <div className="spec">
        <SpecRow ico="ph-bold ph-broadcast" k={TX('Chế độ')}>
          <SpecChip tone={online ? 'ok' : 'warn'}>
            <span className="nx-dot nx-dot--live"></span>
            {online ? TX('Trực tuyến') : TX('Ngoại tuyến')}
          </SpecChip>
        </SpecRow>

        <SpecRow ico="ph-bold ph-tag" k={TX('Yêu cầu')}>
          <SpecChip tone="gold" ico="ph-fill ph-gift">{TX('Miễn phí')}</SpecChip>
        </SpecRow>

        <SpecRow ico="ph-fill ph-cloud" k="Cloud Save">
          {cloud
            ? <SpecChip tone="ok" ico="ph-bold ph-check">{TX('Có hỗ trợ')}</SpecChip>
            : <SpecChip tone="bad" ico="ph-bold ph-x">{TX('Không hỗ trợ')}</SpecChip>}
        </SpecRow>

        <SpecRow ico="ph-fill ph-floppy-disk" k="Local Save">
          <SpecChip tone="ok" ico="ph-bold ph-check">{TX('Có hỗ trợ')}</SpecChip>
        </SpecRow>

        <SpecRow ico="ph-bold ph-storefront" k={TX('Nền tảng')}>
          <SpecChip tone="tint" ico={plat.ico} tint={plat.tone}>{TX(plat.label)}</SpecChip>
        </SpecRow>

        {dev && <SpecRow ico="ph-bold ph-code" k={TX('Nhà phát triển')}>{dev}</SpecRow>}
        {pub && <SpecRow ico="ph-bold ph-buildings" k={TX('Nhà phát hành')}>{pub}</SpecRow>}
        {rel && <SpecRow ico="ph-bold ph-calendar-blank" k={TX('Ngày phát hành')}><span className="spec__v--num">{rel}</span></SpecRow>}

        <SpecRow ico="ph-bold ph-identification-card" k="App ID">
          <span className="spec__v--num nx-selectable">{game.appId || '—'}</span>
        </SpecRow>
      </div>
    );
  }

  /* Cac truong cau hinh Steam tra ve, theo thu tu hien thi */
  const SYS_FIELDS = [
    ['ph-bold ph-windows-logo', 'Hệ điều hành', 'os'],
    ['ph-bold ph-cpu', 'Bộ xử lý', 'cpu'],
    ['ph-bold ph-circuitry', 'Bộ nhớ RAM', 'ram'],
    ['ph-bold ph-monitor', 'Đồ họa', 'gpu'],
    ['ph-bold ph-cube', 'DirectX', 'dx'],
    ['ph-bold ph-wifi-high', 'Kết nối', 'connection'],
    ['ph-bold ph-hard-drive', 'Lưu trữ', 'storage'],
    ['ph-bold ph-note', 'Ghi chú', 'note']
  ];

  function sysRows(req) {
    const r = req || {};
    return SYS_FIELDS
      .map(function (f) { return [f[0], f[1], r[f[2]]]; })
      .filter(function (x) { return !!x[2]; });
  }

  /* Mot nhom cau hinh (Toi thieu hoac De nghi). Tra ve null neu Steam khong co. */
  function SysGroup({ req, head, ico }) {
    const rows = sysRows(req);
    if (!rows.length) return null;

    return (
      <div className="sysg">
        <div className="sysg__head"><i className={ico}></i>{TX(head)}</div>
        <div className="spec">
          {rows.map(function (row) {
            return <SpecRow key={row[1]} ico={row[0]} k={TX(row[1])}>{row[2]}</SpecRow>;
          })}
        </div>
      </div>
    );
  }

  function SysSpecs({ req, rec }) {
    const hasMin = sysRows(req).length > 0;
    /* Chi hien nhom De nghi khi Steam that su ghi khac phan Toi thieu */
    const same = req && rec && JSON.stringify(req) === JSON.stringify(rec);
    const hasRec = !same && sysRows(rec).length > 0;

    if (!hasMin && !hasRec) {
      return (
        <div className="spec">
          <SpecRow ico="ph-bold ph-info" k={TX('Cấu hình')}>{TX('Chưa có dữ liệu cấu hình cho trò chơi này.')}</SpecRow>
        </div>
      );
    }

    return (
      <div className="sys">
        {hasMin && <SysGroup req={req} head="CẤU HÌNH TỐI THIỂU" ico="ph-bold ph-gauge" />}
        {hasRec && <SysGroup req={rec} head="CẤU HÌNH ĐỀ NGHỊ" ico="ph-bold ph-rocket-launch" />}
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
            <button className="nx-icobtn mo__x" onClick={onClose} aria-label={TX('Đóng')}>
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

  function GameDetail({ game, onBack, backLabel, backIcon }) {
    const toast = useToast();
    /* Doi ngon ngu -> ve lai ca trang, va hoi lai Steam bang thu tieng moi. */
    const lang = useLang();

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
      fetchMedia(appId, lang).then(function (d) { if (alive) setLive(d || false); });
      return function () { alive = false; };
    }, [appId, lang]);

    /* Ve dau trang khi doi game */
    useEffect(function () {
      const sc = document.querySelector('.nx-scroll');
      if (sc) sc.scrollTop = 0;
    }, [appId]);

    const sysreq = (live && live.sysreq) || game.sysreq || null;
    const sysreqRec = (live && live.sysreq_rec) || null;
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
          if (st.error) setRevNote(tagTone('bad', TX('Lỗi: {e}', { e: st.error })));
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
      if (clean.length !== 6) { setRedeemNote(tagTone('bad', TX('Sai mã, vui lòng thử lại'))); return; }

      setRedeemState('redeeming');
      setRedeemNote('');
      const r = await callApi('redeem_code', clean, appId);
      setRedeemState('idle');

      if (!r || r.invalid || r.code_not_found) { setRedeemNote(tagTone('bad', TX('Sai mã, vui lòng thử lại'))); return; }
      if (r.not_installed) { setRedeemNote(tagTone('bad', TX('Bạn chưa cài đặt NexusT'))); return; }
      if (r.wrong_game) { setRedeemNote(tagTone('bad', TX('Mã này phải kích hoạt ở trò chơi khác'))); return; }
      if (r.success) {
        setCode('');
        setRedeemNote(tagTone('ok', TX('Đã kích hoạt trò chơi thành công') +
          (r.uses_remaining !== null && r.uses_remaining !== undefined
            ? ' ' + TX('(còn {n} lượt)', { n: r.uses_remaining })
            : '')));
        toast.push({ tone: 'ok', title: TX('Kích hoạt thành công'), desc: game.title });
        return;
      }
      setRedeemNote(r.error || tagTone('bad', TX('Sai mã, vui lòng thử lại')));
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
        setFixNote(tagTone('bad', TX('Chưa cài đặt Steam, vui lòng cài Steam trước khi fix game')));
        return;
      }

      const r = await callApi('fix_game', steam.path, game.fix, game.appId);
      setFixState('idle');

      if (!r || r.not_installed) { setFixNote(tagTone('bad', TX('Bạn chưa cài đặt trò chơi này'))); return; }
      if (r.success) {
        setFixNote(tagTone('ok', TX('Đã fix game hoàn tất')));
        toast.push({ tone: 'ok', title: TX('Đã fix game hoàn tất'), desc: game.title });
        if (isPalworld) {
          const p = await callApi('check_palworld_steamfix', steam.path);
          if (p) { setPalHasFix(!!p.has_steamfix); if (p.language) setPalLang(p.language); }
        }
        return;
      }
      setFixNote(r.error || tagTone('bad', TX('Lỗi: không fix được game')));
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
        toast.push({ tone: 'bad', title: TX('Chưa cài đặt Steam'), desc: TX('Vui lòng cài Steam trước khi đổi ngôn ngữ.') });
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
          title: TX('Đã đổi ngôn ngữ thành {lang}', { lang: (found && found.native) || langCode }),
          desc: TX('Thay đổi áp dụng khi khởi động lại Palworld.')
        });
        return;
      }
      toast.push({ tone: 'bad', title: TX('Không đổi được ngôn ngữ'), desc: (r && r.error) || TX('Vui lòng thử lại.') });
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
        setAccessNote(tagTone('bad', TX('Chưa cài đặt Steam, vui lòng cài Steam trước')));
        return;
      }

      const nx = await callApi('check_nexust', steam.path);
      if (!nx || !nx.installed) {
        setAccessState('installing_nexust');
        const ins = await callApi('install_nexust', steam.path);
        if (!ins || !ins.success) {
          setAccessState('idle');
          setAccessNote((ins && ins.error) || tagTone('bad', TX('Lỗi: không cài đặt được NexusT')));
          return;
        }
      }

      if (game.redeem === true) {
        setAccessState('disabling_wu');
        const rw = await callApi('disable_windows_update');
        if (rw && rw.warning) {
          setAccessNote(rw.warning);
        } else if (rw && rw.disabled) {
          setAccessNote(tagTone('ok', TX('Đã tắt Windows Update hoàn tất')));
        }
      }

      setAccessState('sharing');
      const r2 = await callApi('share_game', steam.path, appId);
      setAccessState('idle');

      if (!r2) { setAccessNote(tagTone('bad', TX('Lỗi: không nhận được phản hồi'))); return; }
      if (r2.already || r2.already_exists) { setAccessNote(tagTone('warn', TX('Bạn đã có trò chơi này rồi'))); return; }
      if (r2.success) {
        setAccessNote(tagTone('ok', TX('Đã thêm trò chơi vào tài khoản Steam của bạn')));
        toast.push({ tone: 'ok', title: TX('Đã thêm trò chơi vào Steam'), desc: game.title });
        return;
      }
      setAccessNote(r2.error || tagTone('bad', TX('Lỗi: không thêm được trò chơi')));
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
        setRevNote(tagTone('bad', TX('Lỗi: không lấy được dung lượng tệp từ Buzzheavier')));
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
        setRevNote(tagTone('bad', TX('Ổ đĩa không đủ dung lượng trống')));
        toast.push({ tone: 'bad', title: TX('Ổ đĩa không đủ dung lượng trống'), desc: TX('Cần khoảng {size} trống.', { size: fmtBytes(need * 2) }) });
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
        toast.push({ tone: 'ok', title: TX('Cài đặt hoàn tất'), desc: game.title });
        return;
      }
      persistRevState('idle');
      setRevNote(tagTone('bad', TX('Lỗi: {e}', { e: (r && r.error) || TX('không cài đặt được trò chơi') })));
    }, [revPath, revSize, customAppId, persistRevState, game.title, toast]);

    const onRevCancel = useCallback(function () {
      setRevPicker(false);
      persistRevState('idle');
    }, [persistRevState]);

    const onRevLaunch = useCallback(async function () {
      toast.push({ tone: 'info', title: TX('Đang khởi chạy trò chơi'), desc: TX('Vui lòng đợi...') });
      const r = await callApi('launch_custom_game', customAppId);
      if (r && !r.success) toast.push({ tone: 'bad', title: TX('Không khởi chạy được'), desc: r.error || TX('Vui lòng thử lại.') });
    }, [customAppId, toast]);

    const onRevFolder = useCallback(async function () {
      const r = await callApi('open_custom_folder', customAppId);
      if (r && !r.success) toast.push({ tone: 'bad', title: TX('Không mở được thư mục'), desc: r.error || '' });
    }, [customAppId, toast]);

    const onRevUninstall = useCallback(async function () {
      setRevConfirm(false);
      const r = await callApi('uninstall_custom_game', customAppId);
      if (r && r.success) {
        setRevSaved('');
        setRevPath('');
        persistRevState('idle');
        REV_STATE_CACHE.delete(customAppId);
        toast.push({ tone: 'ok', title: TX('Đã gỡ cài đặt'), desc: game.title });
        return;
      }
      toast.push({ tone: 'bad', title: TX('Không gỡ được trò chơi'), desc: (r && r.error) || TX('Vui lòng thử lại.') });
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
            <button className="gd__back" onClick={onBack} title={TX('Quay lại (Esc)')} aria-label={TX('Quay lại')}>
              <i className="ph-bold ph-arrow-left"></i>
            </button>
            <nav className="gd__crumb" aria-label={TX('Đường dẫn')}>
              <button type="button" className="gd__crumb-b" onClick={onBack}>
                <i className={backIcon || 'ph-fill ph-squares-four'}></i>
                <span>{TX(backLabel || 'Thư viện')}</span>
              </button>
              <i className="gd__crumb-s ph-bold ph-caret-right" aria-hidden="true"></i>
              <span className="gd__crumb-c" title={game.title}>{game.title}</span>
            </nav>
          </div>

          <div className="gd__grid">
            {/* ------------------------------ COT TRAI ------------------------------ */}
            <div>
              <MediaStage game={game} media={media} idx={idx} setIdx={setIdx} onZoom={setZoom} />

              <AboutBlock appId={appId} live={live} about={about} />
            </div>

            {/* ------------------------------ COT PHAI ------------------------------ */}
            <aside className="gd__panel">
              <div className="gd__cover">
                <Img sources={coverSources(appId)} alt={game.title}
                     imgClass="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div className="gd__cover-t">{game.title}</div>
              </div>

              {/* Khoi hanh dong dat ngay duoi anh bia de luon nhin thay ma
                 khong phai cuon xuong. */}
              <div className="pc pc--act">
                {/* ---------------------------- HANH DONG ---------------------------- */}
                <div className="act">
                  {isUpcoming && (
                    <ActionButton
                      tone="mute" ico="ph-fill ph-clock" arrow={false} disabled
                      eyebrow={TX('CHƯA CÓ')} label={TX('Sắp ra mắt')}
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
                        eyebrow={TX('TRUY CẬP GAME')}
                        label={TX(REV_LABEL[revState] || 'Đang xử lý...')}
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
                                ? TX('Đang giải nén và cài đặt, vui lòng đợi vài phút...')
                                : TX('Đang khởi tạo tiến trình tải...')}
                            </span>
                          </div>
                          <div className="prog__trk prog__trk--indet"><div className="prog__bar" /></div>
                        </div>
                      )}

                      {revNote && <Note tone={noteTone(revNote)}>{stripTone(revNote)}</Note>}
                    </React.Fragment>
                  )}

                  {!isUpcoming && customAppId && revState === 'installed' && (
                    <React.Fragment>
                      <div className="act__hr"><i className="ph-fill ph-check-circle"></i>{TX('Sẵn sàng khởi chạy')}</div>
                      <div className="act__grid">
                        <button className="nx-btn nx-btn--primary act__wide" onClick={onRevLaunch}>
                          <i className="ph-fill ph-play"></i>{TX('Khởi chạy')}
                        </button>
                        <button className="nx-btn nx-btn--ghost" onClick={onRevFolder}>
                          <i className="ph-fill ph-folder-open"></i>{TX('Thư mục')}
                        </button>
                        <button className="nx-btn nx-btn--bad" onClick={function () { setRevConfirm(true); }}>
                          <i className="ph-fill ph-trash"></i>{TX('Gỡ cài đặt')}
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
                        eyebrow={TX('TRUY CẬP GAME')}
                        label={TX(ACCESS_LABEL[accessState] || 'Đang xử lý...')}
                        onClick={onAccess}
                      />
                      {accessNote && <Note tone={noteTone(accessNote)}>{stripTone(accessNote)}</Note>}

                      {hasFix && (isPalworld && palHasFix ? (
                        <ActionButton
                          tone="ghost"
                          ico="ph-bold ph-translate"
                          spinning={langBusy}
                          disabled={langBusy}
                          eyebrow={curLang
                            ? TX('ĐANG DÙNG: {lang}', { lang: String(curLang.native).toUpperCase() })
                            : TX('THAY ĐỔI NGÔN NGỮ')}
                          label={langBusy ? TX('Đang đổi...') : TX('Thay đổi ngôn ngữ')}
                          onClick={function () { setLangOpen(true); }}
                        />
                      ) : (
                        <ActionButton
                          tone="ghost"
                          ico="ph-bold ph-wrench"
                          spinning={fixState !== 'idle'}
                          disabled={fixState !== 'idle'}
                          eyebrow={TX('SỬA LỖI KẾT NỐI')}
                          label={fixState === 'idle' ? TX('Fix Game') : TX('Đang fix game...')}
                          onClick={onFix}
                        />
                      ))}
                      {fixNote && <Note tone={noteTone(fixNote)}>{stripTone(fixNote)}</Note>}

                      {hasRedeem && (
                        <React.Fragment>
                          <div className="code">
                            <input
                              type="text"
                              value={code}
                              onChange={function (e) { setCode(e.target.value.toUpperCase().slice(0, 6)); }}
                              onKeyDown={function (e) { if (e.key === 'Enter' && redeemState === 'idle') onRedeem(); }}
                              placeholder={TX('NHẬP 6 KÝ TỰ')}
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
                                ? <React.Fragment><i className="ph-fill ph-ticket"></i>{TX('Kích hoạt')}</React.Fragment>
                                : <React.Fragment><span className="nx-spin" />{TX('Đang xử lý')}</React.Fragment>}
                            </button>
                          </div>
                          {redeemNote && <Note tone={noteTone(redeemNote)}>{stripTone(redeemNote)}</Note>}
                        </React.Fragment>
                      )}
                    </React.Fragment>
                  )}

                  {!isUpcoming && appId && (
                    <button
                      className="nx-btn nx-btn--ghost nx-btn--sm nx-btn--full"
                      onClick={function () { openExternal('https://store.steampowered.com/app/' + appId + '/'); }}
                    >
                      <i className="fa-brands fa-steam"></i>{TX('Xem trên Steam Store')}
                    </button>
                  )}
                </div>
              </div>

              <div className="pc">
                {!isUpcoming && (
                  <div className={'rev is-' + tone}>
                    <ScorePlate percent={pct} />
                    <div className="rev__main">
                      <div className="rev__txt">{TX(game.reviewText || 'Chưa có đánh giá')}</div>
                      {pct !== null && (
                        <div className="rev__meter" aria-hidden="true">
                          <i style={{ width: Math.max(2, Math.min(100, pct)) + '%' }} />
                        </div>
                      )}
                      {/* Nhanh du phong cu in thang game.reviewCount -- ma chuoi do nam
                          san trong du lieu duoi dang tieng Viet ("0 danh gia"), nen khi
                          giao dien chuyen sang tieng Anh no van la tieng Viet. Con so da
                          duoc tach ra roi thi cu dung mot khuon duy nhat cho moi truong
                          hop: fmtCount(0) tra ve "0", va phan chu thi di qua TX. */}
                      <div className="rev__cnt">
                        <b>{fmtCount(revCount)}</b>
                        <span>{TX('lượt đánh giá trên Steam')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="gd__tags">
                    <span className="nx-tag" style={{ color: 'var(--c-steam)' }}>
                      <i className="fa-brands fa-steam"></i>STEAM
                    </span>
                    {tags.map(function (t) { return <span className="nx-tag" key={t}>{TX(t)}</span>; })}
                  </div>
                )}

                <div className="pt">
                  <button className={'pt__b' + (tab === 'info' ? ' is-on' : '')} onClick={function () { setTab('info'); }}>
                    <i className="ph-bold ph-info"></i>{TX('Thông tin')}
                  </button>
                  <button className={'pt__b' + (tab === 'sys' ? ' is-on' : '')} onClick={function () { setTab('sys'); }}>
                    <i className="ph-bold ph-desktop-tower"></i>{TX('Cấu hình')}
                  </button>
                </div>

                {tab === 'info' ? <InfoSpecs game={game} live={live} /> : <SysSpecs req={sysreq} rec={sysreqRec} />}

              </div>

              {/* ------------------------------ BANNER ------------------------------ */}
              <button className="bn bn--discord" onClick={function () { openExternal(DISCORD_URL); }}>
                <span className="bn__ico"><i className="fa-brands fa-discord"></i></span>
                <span style={{ textAlign: 'left' }}>
                  <span className="bn__t" style={{ display: 'block' }}>{TX('HỖ TRỢ & CẬP NHẬT')}</span>
                  <span className="bn__d" style={{ display: 'block' }}>{TX('Tham gia Discord để nhận thông tin mới nhất')}</span>
                </span>
                <i className="bn__go ph-bold ph-arrow-up-right"></i>
              </button>

              {game.viethoaLink && (
                <button className="bn bn--vh" onClick={function () { openExternal(game.viethoaLink); }}>
                  <span className="bn__ico">
                    <img src={game.viethoaLogo || 'https://theredteam.vn/index_files/images/logoRedHome.png'}
                         alt={TX('Việt hóa')}
                         onError={function (e) { e.target.style.display = 'none'; }} />
                  </span>
                  <span style={{ textAlign: 'left' }}>
                    <span className="bn__t" style={{ display: 'block' }}>{TX('HỖ TRỢ VIỆT HÓA')}</span>
                    <span className="bn__d" style={{ display: 'block' }}>
                      {game.viethoaDesc || TX('Tải bản dịch tiếng Việt từ The Red Team')}
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
          title={TX('Chọn vị trí cài đặt')}
          desc={TX('Cần tối thiểu {size} dung lượng trống', { size: revSize ? (revSize.size_gb * 2).toFixed(2) + ' GB' : '...' })}
          footer={
            <React.Fragment>
              <button className="nx-btn nx-btn--ghost" onClick={onRevCancel}>{TX('Hủy')}</button>
              <button className="nx-btn nx-btn--primary" onClick={onRevSave} disabled={!revPath}>
                <i className="ph-bold ph-download-simple"></i>{TX('Bắt đầu tải')}
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
              <i className="ph-bold ph-folder-open"></i>{TX('Duyệt')}
            </button>
          </div>
          {revSize && (
            <div className="prog__sub" style={{ marginTop: 12 }}>
              <i className="ph-bold ph-file-archive" style={{ marginRight: 6 }}></i>
              {TX('Dung lượng tải về:')} <b style={{ color: 'var(--br-1)' }}>{revSize.size_gb} GB</b>
            </div>
          )}
        </Sheet>

        {/* ------------------------------ XAC NHAN GO ------------------------------ */}
        <Sheet
          open={revConfirm}
          onClose={function () { setRevConfirm(false); }}
          icon="ph-fill ph-warning"
          iconTone="var(--bad)"
          title={TX('Gỡ cài đặt trò chơi?')}
          desc={TX('Toàn bộ thư mục game sẽ bị xóa và không thể hoàn tác.')}
          footer={
            <React.Fragment>
              <button className="nx-btn nx-btn--ghost" onClick={function () { setRevConfirm(false); }}>{TX('Hủy')}</button>
              <button className="nx-btn nx-btn--bad" onClick={onRevUninstall}>
                <i className="ph-bold ph-trash"></i>{TX('Gỡ cài đặt')}
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
          title={TX('Ngôn ngữ cho Palworld')}
          desc={TX('Thay đổi chỉ áp dụng khi khởi động lại game.')}
          footer={<button className="nx-btn nx-btn--ghost" onClick={function () { setLangOpen(false); }}>{TX('Đóng')}</button>}
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
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--tx-faint)' }}>{TX(l.name)}</span>
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
    /* Ve thang vao <body>.

       Lop nay dung position:fixed de phu kin khung nhin. Nhung fixed chi neo
       theo khung nhin khi KHONG co to tien nao mang transform/filter/perspective
       -- neu co, no neo theo the do. Cay the cua trang chi tiet co nhieu lop
       nhu vay (hieu ung chuyen trang, lop lam mo hau canh...), nen chi can them
       mot lop moi la anh lai bi day lech. Chuyen ra ngoai cung la cach chac
       chan nhat: tu day ve sau khong lop cha nao trong trang anh huong duoc. */
    const node = (
      <div className="mo mo--img" onMouseDown={function (e) { if (e.target === e.currentTarget) onClose(); }}>
        <div className="mo__box">
          <img src={src} alt={alt || ''} onClick={onClose} />
        </div>
        <button className="nx-icobtn mo__x" onClick={onClose} aria-label={TX('Đóng')}>
          <i className="ph-bold ph-x"></i>
        </button>
      </div>
    );
    return ReactDOM.createPortal(node, document.body);
  }

  /* --------------------------------------------------------------------------
     XUAT RA
     ------------------------------------------------------------------------ */

  Object.assign(window.NX, { GameDetail, MediaStage, ActionButton, AboutBlock, RichBody, parseAbout, Sheet, ZoomView, noteTone, stripHtml });
})();
