/* ============================================================================
   NEXUS LAUNCHER — DICH VU TICH HOP
   Luoi 5 the: Cloud Save · Cánh Cụt Team · Game Thuần Việt · Easy-Install · Fluenty UI
   Thay carousel cu (the bi tran chu) bang luoi khong bao gio vo bo cuc.
   Phu thuoc: window.NX (app.core.jsx)
   ========================================================================== */

(function () {
  'use strict';

  const { useState, useEffect, useCallback } = React;
  const {
    callApi, hasApi, apiProp, openExternal, DISCORD_URL, Note, useToast,
    TX, useLang, tagTone, markedTone, stripTone
  } = window.NX;

  /* --------------------------------------------------------------------------
     DU LIEU THE
     ------------------------------------------------------------------------ */

  const CARDS = [
    {
      id: 'cloud',
      title: 'CLOUD SAVE',
      badge: 'ĐỒNG BỘ DỮ LIỆU',
      ico: 'ph-fill ph-cloud-arrow-up',
      a: '#b45309', b: '#f59e0b', glow: 'rgba(245,158,11,0.13)',
      features: [
        'Sync save data & tiến trình chơi tự động',
        'Đồng bộ thành tích và thời gian chơi',
        'Bảo toàn dữ liệu khi đổi thiết bị',
        'Dung lượng lưu trữ không giới hạn',
        'Hệ thống tự động backup an toàn'
      ],
      infoHead: 'HỆ THỐNG CLOUD',
      info: [
        ['Máy chủ', 'Lưu trữ trên máy chủ riêng, miễn phí'],
        ['Tự động sync', 'Khắc phục lỗi Steam Cloud'],
        ['Bảo mật', 'An toàn dữ liệu tuyệt đối']
      ],
      note: 'Dữ liệu được bảo mật tuyệt đối cho mọi trò chơi Steam.'
    },
    {
      id: 'canhcut',
      title: 'CÁNH CỤT TEAM',
      badge: 'DỊCH THUẬT CAO CẤP',
      ico: 'ph-fill ph-book-open-text',
      a: '#0e7490', b: '#06b6d4', glow: 'rgba(6,182,212,0.13)',
      features: [
        'Việt hóa game AAA và Indie chất lượng cao',
        'Hơn 100 dự án lớn: Elden Ring, Wukong, MGS V',
        'Từng câu thoại dịch tỉ mỉ, sắc thái mượt',
        'Tích hợp launcher tự động tải và cài đặt',
        'Cập nhật bản vá mới nhất liên tục'
      ],
      infoHead: 'THÔNG TIN BẢN DỊCH',
      info: [
        ['Phiên bản', 'Patch Việt hóa mới nhất'],
        ['Nhóm dịch', 'Cánh Cụt Team'],
        ['Hỗ trợ', 'PC Win 10/11 và Steam Deck']
      ],
      note: 'Bản dịch độc quyền được thực hiện bởi Cánh Cụt Team.'
    },
    {
      id: 'thuanviet',
      title: 'GAME THUẦN VIỆT',
      badge: 'VIỆT HÓA TOÀN DIỆN',
      ico: 'ph-fill ph-text-aa',
      a: '#047857', b: '#10b981', glow: 'rgba(16,185,129,0.13)',
      features: [
        'Chuyển ngữ thủ công, giữ tinh thần bản gốc',
        'Chất lượng thật — cảm xúc thật',
        'Cài đặt 1-click, tự động nhận đường dẫn',
        'Tương thích 100% Windows 10/11 mới nhất',
        'Tối ưu UI/HUD tiếng Việt chuẩn nét'
      ],
      infoHead: 'ĐẶC TÍNH BẢN DỊCH',
      info: [
        ['Dịch thuật', '100% chuyển ngữ thủ công'],
        ['Giao diện', 'Tối ưu UI/HUD chuẩn nét'],
        ['Cài đặt', 'Tự động 1-click nhanh chóng']
      ],
      note: 'Trải nghiệm Việt hóa chuẩn nhất bởi Game Thuần Việt.'
    },
    {
      id: 'vip',
      title: 'EASY-INSTALL GAMES',
      badge: 'CHIA SẺ GAME',
      ico: 'ph-fill ph-rocket-launch',
      a: '#9f1239', b: '#f43f5e', glow: 'rgba(244,63,94,0.13)',
      features: [
        'Tự động thêm và mở khóa game qua Steam',
        'Chơi ngay lập tức chỉ với một AppID',
        'Tự động tải và cập nhật file manifest Lua',
        'Kho AppID mở rộng liên tục theo yêu cầu',
        'Không cần thao tác thủ công với Steam'
      ],
      infoHead: 'CÁCH SỬ DỤNG',
      info: [
        ['Bước 1', 'Tra AppID của game trên SteamDB'],
        ['Bước 2', 'Dán AppID vào ô bên dưới'],
        ['Bước 3', 'Bấm Kích hoạt rồi mở lại Steam']
      ],
      unsupHead: 'CÁC TRÒ CHƠI KHÔNG HỖ TRỢ',
      unsup: ['Denuvo Anti-Tamper', 'Game Online', 'Launcher bên thứ 3 (Uplay/EA)', 'Anti-Cheat (EAC)'],
      note: 'Trò chơi có thể phát sinh trục trặc — hãy tham gia Discord để được hỗ trợ và yêu cầu thêm game.'
    },
    {
      id: 'fluenty',
      title: 'FLUENTY UI',
      badge: 'GIAO DIỆN STEAM PREMIUM',
      ico: 'ph-fill ph-paint-brush-broad',
      a: '#4338ca', b: '#6366f1', glow: 'rgba(99,102,241,0.14)',
      features: [
        'Giao diện Steam phong cách Windows 11: tối giản, bo góc mượt, kính mờ sang trọng',
        'Tự do thay đổi bảng màu accent và font chữ',
        'Bố cục gọn gàng, ẩn chi tiết thừa, thư viện hiển thị đẹp hơn',
        'Widget lối tắt cho bạn bè, thông báo và game yêu thích',
        'Cập nhật liên tục, tương thích mọi bản nâng cấp Steam'
      ],
      infoHead: 'THÔNG TIN GÓI',
      info: [
        ['Phiên bản', 'Fluenty UI Premium — bản trả phí $5, hiện miễn phí'],
        ['Tác giả', 'Fluenty / Millennium'],
        ['Hỗ trợ', 'PC Win 10/11']
      ],
      note: 'Cài đặt sẽ tự khởi động lại Steam để áp dụng giao diện mới.'
    }
  ];

  /* Phai viet thanh ham chu khong phai hang so — neu chot cung luc nap trang
     thi doi ngon ngu xong cau nay van dung o thu tieng cu. */
  function noApp() {
    return tagTone('bad', TX('Vui lòng mở bằng ứng dụng Nexus Launcher.'));
  }

  /* Mot cau thong bao -> o mau dung sac thai. Sac thai doc tu dau vo hinh gan
     san o dau cau; cau nao khong co dau (loi tu ban Python bao ve) thi coi la loi. */
  function noteBox(note) {
    if (!note) return null;
    return <Note tone={markedTone(note) || 'bad'}>{stripTone(note)}</Note>;
  }

  /* --------------------------------------------------------------------------
     KHUNG THE
     ------------------------------------------------------------------------ */

  function ServiceCard({ card, children, note }) {
    return (
      <article className="sc" style={{ '--sc-a': card.a, '--sc-b': card.b, '--sc-glow': card.glow }}>
        <header className="sc__head">
          <div className="sc__ico"><i className={card.ico}></i></div>
          <div>
            <div className="sc__ttl">{TX(card.title)}</div>
            <div className="sc__sub">{TX(card.badge)}</div>
          </div>
        </header>

        <div className="sc__body">
          <div className="sc__feats">
            {card.features.map(function (f, i) {
              return (
                <div className="sc__feat" key={i}>
                  <i className="ph-fill ph-check-circle"></i>
                  <span>{TX(f)}</span>
                </div>
              );
            })}
          </div>

          {card.info && (
            <div className="sc__info">
              <div className="sc__info-h">{TX(card.infoHead)}</div>
              <div className="sc__info-b">
                {card.info.map(function (kv) {
                  return (
                    <div className="sc__kv" key={kv[0]}>
                      <b>{TX(kv[0])}</b><span>{TX(kv[1])}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {card.unsup && (
            <div className="sc__unsup">
              <div className="sc__unsup-h"><i className="ph-fill ph-prohibit"></i>{TX(card.unsupHead)}</div>
              <div className="sc__unsup-tags">
                {card.unsup.map(function (u) { return <span className="nx-tag" key={u}>{TX(u)}</span>; })}
              </div>
            </div>
          )}

          {card.note && (
            <div className="sc__note"><i className="ph-fill ph-info"></i><span>{TX(card.note)}</span></div>
          )}
        </div>

        <footer className="sc__foot">
          {children}
          {note}
        </footer>
      </article>
    );
  }

  function Busy({ label }) {
    return <React.Fragment><span className="nx-spin" />{label}</React.Fragment>;
  }

  /* --------------------------------------------------------------------------
     1. CLOUD SAVE
     ------------------------------------------------------------------------ */

  function CloudCard({ card }) {
    const toast = useToast();
    const [st, setSt] = useState('checking');
    const [note, setNote] = useState('');

    useEffect(function () {
      if (!note) return undefined;
      const t = setTimeout(function () { setNote(''); }, 10000);
      return function () { clearTimeout(t); };
    }, [note]);

    useEffect(function () {
      let dead = false;
      const pre = apiProp('cloud_save_precheck');
      if (pre && typeof pre === 'object' && 'installed' in pre) { setSt(pre.installed ? 'installed' : 'idle'); return undefined; }
      if (!hasApi('check_cloud_save')) { setSt('idle'); return undefined; }
      callApi('check_cloud_save').then(function (r) {
        if (!dead) setSt(r && r.installed ? 'installed' : 'idle');
      });
      return function () { dead = true; };
    }, []);

    const install = useCallback(async function () {
      if (st !== 'idle') return;
      if (!hasApi('install_cloud_save')) { setNote(noApp()); return; }
      setNote('');
      setSt('installing');
      const r = await callApi('install_cloud_save');
      if (r && r.already) { setSt('installed'); return; }
      if (r && r.success) {
        setSt('installed');
        setNote(tagTone('ok', TX('Đã cài đặt Cloud Save thành công! Steam đã tự khởi chạy lại.')));
        toast.push({ tone: 'ok', title: TX('Cloud Save đã sẵn sàng'), desc: TX('Steam đã tự khởi chạy lại.') });
        return;
      }
      setSt('idle');
      setNote((r && r.error) || tagTone('bad', TX('Lỗi không xác định.')));
    }, [st, toast]);

    const uninstall = useCallback(async function () {
      if (!hasApi('uninstall_cloud_save')) { setNote(noApp()); return; }
      setNote('');
      setSt('uninstalling');
      const r = await callApi('uninstall_cloud_save');
      if (r && r.success) { setSt('idle'); setNote(tagTone('ok', TX('Đã gỡ cài đặt Cloud Save thành công!'))); return; }
      setSt('installed');
      setNote((r && r.error) || tagTone('bad', TX('Lỗi khi gỡ cài đặt Cloud Save.')));
    }, []);

    const reinstall = useCallback(async function () {
      if (!hasApi('uninstall_cloud_save') || !hasApi('install_cloud_save')) { setNote(noApp()); return; }
      setNote('');
      setSt('uninstalling');
      const un = await callApi('uninstall_cloud_save');
      if (!un || !un.success) {
        setSt('installed');
        setNote((un && un.error) || tagTone('bad', TX('Lỗi khi gỡ file cũ.')));
        return;
      }
      setSt('installing');
      const re = hasApi('reinstall_cloud_save')
        ? await callApi('reinstall_cloud_save')
        : await callApi('install_cloud_save', true);
      if (re && re.success) {
        setSt('installed');
        setNote(tagTone('ok', TX('Đã cài đặt lại Cloud Save thành công! Steam đã tự khởi chạy lại.')));
        return;
      }
      setSt('idle');
      setNote((re && re.error) || tagTone('bad', TX('Lỗi cài đặt lại Cloud Save.')));
    }, []);

    const busy = st === 'installing' || st === 'uninstalling' || st === 'checking';

    return (
      <ServiceCard card={card} note={noteBox(note)}>
        {st === 'installed' ? (
          <div className="act__grid">
            <button className="nx-btn nx-btn--ghost" onClick={reinstall} disabled={busy}>
              <i className="ph-bold ph-arrows-clockwise"></i>{TX('Cài lại')}
            </button>
            <button className="nx-btn nx-btn--bad" onClick={uninstall} disabled={busy}>
              <i className="ph-bold ph-trash"></i>{TX('Gỡ bỏ')}
            </button>
            <div className="act__wide nx-badge nx-badge--ok" style={{ justifyContent: 'center', padding: '7px 0' }}>
              <i className="ph-fill ph-check-circle"></i>{TX('ĐANG BẬT')}
            </div>
          </div>
        ) : (
          <button className="nx-btn nx-btn--accent nx-btn--full nx-btn--lg" onClick={install} disabled={busy}>
            {st === 'checking' ? <Busy label={TX('Đang kiểm tra...')} />
              : st === 'installing' ? <Busy label={TX('Đang cài đặt...')} />
              : st === 'uninstalling' ? <Busy label={TX('Đang gỡ...')} />
              : <React.Fragment><i className="ph-fill ph-lightning"></i>{TX('KÍCH HOẠT NGAY')}</React.Fragment>}
          </button>
        )}
      </ServiceCard>
    );
  }

  /* --------------------------------------------------------------------------
     2 + 3. TOOL VIET HOA (canhcut / thuanviet)
     ------------------------------------------------------------------------ */

  function ToolCard({ card }) {
    const [st, setSt] = useState('checking');
    const [note, setNote] = useState('');

    useEffect(function () {
      if (!note) return undefined;
      const t = setTimeout(function () { setNote(''); }, 10000);
      return function () { clearTimeout(t); };
    }, [note]);

    useEffect(function () {
      let dead = false;
      if (!hasApi('check_integration')) { setSt('idle'); return undefined; }
      callApi('check_integration', card.id).then(function (r) {
        if (!dead) setSt(r && r.installed ? 'installed' : 'idle');
      });
      return function () { dead = true; };
    }, [card.id]);

    const click = useCallback(async function () {
      if (st === 'checking' || st === 'installing') return;

      if (st === 'installed') {
        if (!hasApi('launch_integration')) { setNote(noApp()); return; }
        const r = await callApi('launch_integration', card.id);
        if (!r || !r.success) setNote((r && r.error) || tagTone('bad', TX('Không thể khởi chạy tool.')));
        return;
      }

      if (!hasApi('activate_integration')) { setNote(noApp()); return; }
      setNote('');
      setSt('installing');
      const r = await callApi('activate_integration', card.id);
      if (r && (r.success || r.already)) { setSt('installed'); return; }
      setSt('idle');
      setNote((r && r.error) || tagTone('bad', TX('Lỗi cài đặt tool.')));
    }, [st, card.id]);

    return (
      <ServiceCard card={card} note={noteBox(note)}>
        <button
          className={'nx-btn nx-btn--full nx-btn--lg ' + (st === 'installed' ? 'nx-btn--ok' : 'nx-btn--accent')}
          onClick={click}
          disabled={st === 'checking' || st === 'installing'}
        >
          {st === 'checking' ? <Busy label={TX('Đang kiểm tra...')} />
            : st === 'installing' ? <Busy label={TX('Đang cài đặt...')} />
            : st === 'installed' ? <React.Fragment><i className="ph-fill ph-play"></i>{TX('MỞ CÔNG CỤ')}</React.Fragment>
            : <React.Fragment><i className="ph-fill ph-lightning"></i>{TX('KÍCH HOẠT NGAY')}</React.Fragment>}
        </button>
      </ServiceCard>
    );
  }

  /* --------------------------------------------------------------------------
     4. EASY-INSTALL GAMES
     ------------------------------------------------------------------------ */

  function EasyCard({ card }) {
    const toast = useToast();
    const [appid, setAppid] = useState('');
    const [st, setSt] = useState('idle');
    const [note, setNote] = useState('');

    useEffect(function () {
      if (!note) return undefined;
      const t = setTimeout(function () { setNote(''); setSt('idle'); }, 10000);
      return function () { clearTimeout(t); };
    }, [note]);

    const click = useCallback(async function () {
      if (st === 'activating') return;
      const clean = String(appid || '').trim();
      if (!clean) { setSt('error'); setNote(TX('Vui lòng nhập AppID game.')); return; }

      setSt('activating');
      setNote('');

      const r = await callApi('activate_easy_install_game', clean);

      if (r && r.success) {
        if (r.already_exists) { setSt('already'); setNote(TX('Bạn đã có trò chơi này rồi')); return; }
        setSt('success');
        setNote(r.message || TX('Đã kích hoạt thành công trò chơi có AppID {id}', { id: clean }));
        toast.push({ tone: 'ok', title: TX('Đã kích hoạt AppID {id}', { id: clean }), desc: TX('Mở lại Steam để thấy game.') });
        return;
      }

      setSt('error');
      const err = (r && r.error) ? String(r.error) : '';
      if (!err || /404|Không tìm thấy|file Lua|Server/i.test(err)) {
        setNote(TX('Máy chủ hiện chưa có trò chơi nào mang AppID {id}', { id: clean }));
      } else {
        setNote(err);
      }
    }, [appid, st, toast]);

    const tone = st === 'success' ? 'ok' : st === 'already' ? 'warn' : 'bad';

    return (
      <ServiceCard card={card} note={note ? <Note tone={tone}>{stripTone(note)}</Note> : null}>
        <div className="sc__appid">
          <input
            type="text"
            inputMode="numeric"
            value={appid}
            onChange={function (e) { setAppid(e.target.value.replace(/[^0-9]/g, '').slice(0, 10)); }}
            onKeyDown={function (e) { if (e.key === 'Enter') click(); }}
            placeholder={TX('Nhập AppID, ví dụ 1245620')}
            spellCheck="false"
            disabled={st === 'activating'}
          />
          <button className="nx-btn nx-btn--ghost" style={{ height: 40, flex: 'none' }}
                  onClick={function () { openExternal('https://store.steampowered.com/search/?term=' + encodeURIComponent(appid || '')); }}
                  title={TX('Tra AppID trên Steam')}>
            <i className="ph-bold ph-magnifying-glass"></i>
          </button>
        </div>
        <button className="nx-btn nx-btn--accent nx-btn--full nx-btn--lg" onClick={click} disabled={st === 'activating'}>
          {st === 'activating'
            ? <Busy label={TX('Đang kích hoạt...')} />
            : <React.Fragment><i className="ph-fill ph-lightning"></i>{TX('KÍCH HOẠT NGAY')}</React.Fragment>}
        </button>
      </ServiceCard>
    );
  }

  /* --------------------------------------------------------------------------
     5. FLUENTY UI
     ------------------------------------------------------------------------ */

  function FluentyCard({ card }) {
    const toast = useToast();
    const [st, setSt] = useState('checking');
    const [note, setNote] = useState('');

    useEffect(function () {
      if (!note) return undefined;
      const t = setTimeout(function () { setNote(''); }, 10000);
      return function () { clearTimeout(t); };
    }, [note]);

    useEffect(function () {
      let dead = false;
      const pre = apiProp('fluenty_precheck');
      if (pre && typeof pre === 'object' && 'installed' in pre) { setSt(pre.installed ? 'installed' : 'idle'); return undefined; }
      if (!hasApi('check_fluenty_installed')) { setSt('idle'); return undefined; }
      callApi('check_fluenty_installed').then(function (r) {
        if (!dead) setSt(r && r.installed ? 'installed' : 'idle');
      });
      return function () { dead = true; };
    }, []);

    const click = useCallback(async function () {
      setNote('');

      if (st === 'installed') {
        if (!hasApi('uninstall_fluenty')) { setNote(noApp()); return; }
        setSt('uninstalling');
        const r = await callApi('uninstall_fluenty');
        if (r && r.success) { setSt('idle'); setNote(tagTone('ok', TX('Đã gỡ Fluenty UI thành công!'))); return; }
        setSt('installed');
        setNote((r && r.error) || tagTone('bad', TX('Lỗi gỡ cài đặt Fluenty UI.')));
        return;
      }

      if (st !== 'idle') return;
      if (!hasApi('install_fluenty')) { setNote(noApp()); return; }
      setSt('installing');
      const r = await callApi('install_fluenty');
      if (r && r.already) { setSt('installed'); return; }
      if (r && r.success) {
        setSt('installed');
        setNote(tagTone('ok', TX('Đã cài đặt Fluenty UI thành công! Steam đã tự khởi chạy lại.')));
        toast.push({ tone: 'ok', title: TX('Fluenty UI đã bật'), desc: TX('Steam đã tự khởi chạy lại.') });
        return;
      }
      setSt('idle');
      setNote((r && r.error) || tagTone('bad', TX('Lỗi cài đặt Fluenty UI.')));
    }, [st, toast]);

    const busy = st === 'checking' || st === 'installing' || st === 'uninstalling';

    return (
      <ServiceCard card={card} note={noteBox(note)}>
        <button
          className={'nx-btn nx-btn--full nx-btn--lg ' + (st === 'installed' ? 'nx-btn--bad' : 'nx-btn--accent')}
          onClick={click}
          disabled={busy}
        >
          {st === 'checking' ? <Busy label={TX('Đang kiểm tra...')} />
            : st === 'installing' ? <Busy label={TX('Đang cài đặt...')} />
            : st === 'uninstalling' ? <Busy label={TX('Đang gỡ...')} />
            : st === 'installed' ? <React.Fragment><i className="ph-bold ph-trash"></i>{TX('GỠ CÀI ĐẶT')}</React.Fragment>
            : <React.Fragment><i className="ph-fill ph-lightning"></i>{TX('KÍCH HOẠT NGAY')}</React.Fragment>}
        </button>
      </ServiceCard>
    );
  }

  /* ==========================================================================
     TRANG TICH HOP
     ========================================================================== */

  function IntegrateContent() {
    useLang();
    const byId = {};
    CARDS.forEach(function (c) { byId[c.id] = c; });

    return (
      <div className="nx-page">
        <header className="ig__hero">
          <h1 className="ig__title">{TX('Hệ thống dịch vụ tích hợp')}</h1>
          <p className="ig__sub">
            {TX('Năm tiện ích chạy trực tiếp trên máy bạn: đồng bộ save, cài bản Việt hóa, mở khóa game bằng AppID và thay giao diện Steam — tất cả chỉ một lần bấm.')}
          </p>
        </header>

        <div className="ig__grid">
          <CloudCard card={byId.cloud} />
          <ToolCard card={byId.canhcut} />
          <ToolCard card={byId.thuanviet} />
          <EasyCard card={byId.vip} />
          <FluentyCard card={byId.fluenty} />
        </div>

        <div style={{ padding: '0 var(--pad-page) 52px' }}>
          <button className="bn bn--discord" onClick={function () { openExternal(DISCORD_URL); }}>
            <span className="bn__ico"><i className="fa-brands fa-discord"></i></span>
            <span style={{ textAlign: 'left' }}>
              <span className="bn__t" style={{ display: 'block' }}>{TX('CẦN THÊM GAME HOẶC GẶP LỖI?')}</span>
              <span className="bn__d" style={{ display: 'block' }}>
                {TX('Gửi yêu cầu trong Discord, đội hỗ trợ sẽ xử lý trực tiếp')}
              </span>
            </span>
            <i className="bn__go ph-bold ph-arrow-up-right"></i>
          </button>
        </div>
      </div>
    );
  }

  Object.assign(window.NX, { IntegrateContent, SERVICE_CARDS: CARDS });
})();
