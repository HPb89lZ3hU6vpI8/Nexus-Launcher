/* ============================================================================
   NEXUS LAUNCHER — DICH VU TICH HOP
   Ban the keo ngang, 5 muc: Cloud Save · Cánh Cụt Team · Game Thuần Việt · Easy-Install · Fluenty UI
   Ca bo nam gon trong mot man hinh: keo trai/phai de doi the, khong cuon doc.
   Phu thuoc: window.NX (app.core.jsx)
   ========================================================================== */

(function () {
  'use strict';

  const { useState, useEffect, useCallback, useRef } = React;
  const {
    callApi, hasApi, apiProp, openExternal, DISCORD_URL, Note, useToast,
    TX, useLang, tagTone, markedTone, stripTone, prefersCalm
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

        {/* Than the xep MOT cot doc. Ban truoc chia hai cot cho the lun
            xuong, nhung hai cot khong bao gio dai bang nhau nen cot ngan hon
            de lai mot mang trong to tuong, nhin ra ngay la lech. Mot cot doc
            thi khong the lech duoc, va the giu dung dang cao thanh quen
            thuoc. */}
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

                {/* Danh sach "khong ho tro" nam NGAY TRONG bang thong tin,
                    cach cac dong tren bang mot duong ke mo. Truoc kia no la
                    mot khoi rieng gom bon vien pill; bon pill do xep tran ra
                    ba dong so le nhau, vua lech vua an mat 90px chieu cao.
                    Viet lien thanh mot cau, ngan cach bang dau cham giua, thi
                    chi ton hai dong va thang hang voi Buoc 1/2/3 ben tren. */}
                {card.unsup && (
                  <div className="sc__unsup">
                    <span className="sc__unsup-h"><i className="ph-fill ph-prohibit"></i>{TX(card.unsupHead)}</span>
                    <span className="sc__unsup-l">
                      {card.unsup.map(function (u) { return TX(u); }).join(' · ')}
                    </span>
                  </div>
                )}
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
      <ServiceCard
        card={card}
        note={note ? <Note tone={tone}>{stripTone(note)}</Note> : null}
      >
        {/* O nhap AppID dung CHUNG mot hang voi nut kich hoat. Truoc kia no
            chiem rieng mot dong trong than the, lam the nay cao hon bon the
            kia 61px -- ma ca nam the phai cao bang nhau nen bon the con lai
            bi keo theo, ho ra mot mang trong. Bo luon nut kinh lup ben canh
            o nhap: no chi mo trang tim kiem Steam, ma viec do thanh ben trai
            da co san muc "Tra cuu AppID", con dong Buoc 1 trong bang cung da
            chi cho tra o SteamDB. */}
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
          <button className="nx-btn nx-btn--accent nx-btn--lg" onClick={click} disabled={st === 'activating'}>
            {st === 'activating'
              ? <Busy label={TX('Đang kích hoạt...')} />
              : <React.Fragment><i className="ph-fill ph-lightning"></i>{TX('KÍCH HOẠT NGAY')}</React.Fragment>}
          </button>
        </div>
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
     BAN THE KEO NGANG
     Truoc day nam the xep thanh luoi doc, trang dai gap doi man hinh nen phai
     cuon len cuon xuong nhu mot trang web. Nay xep thanh MOT hang keo ngang:
     the dang xem nam giua, to va ro; hai the ke ben lui ra sau, nho lai va mo
     di roi tho nua nguoi o mep man hinh -- nhin la biet con keo duoc nua.
     ========================================================================== */

  const DECK_GAP = 24;      /* khe giua hai the */
  const SNAP_MS = 520;      /* thoi gian bay ve the dich */

  /* Windows co mot cong tac Hieu ung hoat anh trong Tro nang > Hieu ung hinh
     anh. Nhieu may tat san, hoac bi cac tool toi uu he thong tat ho ma chu
     may khong he biet. Khi no tat, trinh duyet bao prefers-reduced-motion:
     reduce, va truoc day deck NHAY thang tu the nay sang the kia gon trong
     dung mot khung hinh -- do la cai khong he co animation nhin vao thay rat
     xau. Nhung cu truot ngang o day khong phai do trang tri: no la thu duy
     nhat cho biet the vua chay ve dau, mat no thi bam xong khong con biet
     minh dang dung o dau trong nam the. Nen thay vi tat han, rut ngan lai.
     Van nhin ra duong di, ma van ton trong y muon it chuyen dong. */
  const SNAP_CALM_MS = 380;

  /* Duong cong chuyen dong. Ban cu dung easeOutCubic -- vot nhanh ngay tu
     dau roi cham dan ve cuoi. Duong do dung cho luc THA TAY sau khi keo, vi
     luc buong ra the dang co san van toc. Nay bo keo tay, moi cu chuyen deu
     bat dau tu DUNG YEN, ma easeOutCubic bat dau o toc do cao nhat nen no
     giat mot cai ngay khung hinh dau. Doi sang smootherstep: van toc VA gia
     toc deu bang khong o ca hai dau, nen the tu tu lan di roi tu tu dung
     lai, khong con diem nao gay khuc. */
  function easeSmooth(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function Deck({ children, label }) {
    const items = React.Children.toArray(children);
    const n = items.length;

    const vp = useRef(null);
    const track = useRef(null);
    const cells = useRef([]);
    const [active, setActive] = useState(0);

    /* Vi tri tinh theo DON VI THE, co phan le: 1.37 nghia la dang o giua the 1
       va the 2. Giu trong ref chu khong phai state -- moi khung hinh tu tay ve
       lai se muot hon nhieu so voi viec bat React dung lai ca cay component
       sau chuc lan moi giay. */
    const pos = useRef(0);
    const dest = useRef(0);
    const geo = useRef({ w: 0, cw: 0 });
    const anim = useRef(0);

    const stopAnim = useCallback(function () {
      if (anim.current) { cancelAnimationFrame(anim.current); anim.current = 0; }
    }, []);

    /* Ve mot khung hinh: day ca hang sang ngang, roi tung the tu thu nho va mo
       di theo khoang cach toi tam. */
    const paint = useCallback(function () {
      const g = geo.current;
      if (!g.cw) return;
      const step = g.cw + DECK_GAP;
      const p = pos.current;
      if (track.current) {
        track.current.style.transform =
          'translate3d(' + (g.w / 2 - g.cw / 2 - p * step) + 'px,0,0)';
      }
      for (let i = 0; i < n; i++) {
        const el = cells.current[i];
        if (!el) continue;
        const d = Math.abs(i - p);
        const k = Math.min(1, d);
        const sc = 1 - k * 0.13;
        /* The thu nho lai thi mep cua no thut vao, khe ho se toac ra dung bang
           phan be di. Keo nguoc lai chung ay px de khoang cach nhin van deu. */
        const shift = (i < p ? 1 : -1) * (1 - sc) * g.cw / 2;
        el.style.transform = 'translate3d(' + shift + 'px,0,0) scale(' + sc + ')';
        el.style.opacity = String(1 - k * 0.6);
        el.style.zIndex = String(50 - Math.round(Math.min(9, d) * 5));
      }
    }, [n]);

    const measure = useCallback(function () {
      const el = vp.current;
      if (!el) return;
      const w = el.clientWidth;
      /* Be rong the KHONG phai mot ti le co dinh. Cua so cang hep thi the phai
         chiem ti le cang LON, vi the hep lai la chu xuong dong nhieu hon va
         the cao vot len -- dung luc man hinh nho cung thap di. Cho ti le chay
         muot tu 49% (cua so nho) ve 32% (man hinh 1080p tro len), ket qua la
         the luon rong quanh 440-475px. Do KHONG phai con so chon bua: chieu
         cao that cua the gan nhu khong doi theo be rong (do luoc rat it khi
         hep lai), nen be rong la thu duy nhat quyet dinh the trong cao hay
         bet. 460px dat canh chieu cao 480-645px cho ra dang the doc quen
         thuoc, ma hai the ben canh van tho ra du de nhin thay. Chay muot chu
         khong nhay bac, de keo gian cua so khong bi giat. */
      const f = clamp(0.49 - (w - 900) * (0.49 - 0.32) / 540, 0.32, 0.49);
      const cw = Math.round(clamp(w * f, 400, 520));
      geo.current = { w: w, cw: cw };
      el.style.setProperty('--cw', cw + 'px');
      paint();
    }, [paint]);

    useEffect(function () {
      measure();
      const el = vp.current;
      if (!el) return undefined;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return function () { ro.disconnect(); stopAnim(); };
    }, [measure, stopAnim]);

    /* React ve lai xong thi cac ref vua duoc gan lai -> son lai mot lan cho
       chac, neu khong the se nhay ve dung nguyen ban trong mot khung hinh. */
    useEffect(function () { paint(); });

    /* Bay muot ve the dich: tu tu lan di roi tu tu dung lai. */
    const glide = useCallback(function (to) {
      const t = clamp(Math.round(to), 0, n - 1);
      dest.current = t;
      setActive(t);
      stopAnim();
      const from = pos.current;
      if (from === t) return;
      const ms = prefersCalm() ? SNAP_CALM_MS : SNAP_MS;
      const t0 = performance.now();
      const run = function (ts) {
        const k = Math.min(1, (ts - t0) / ms);
        pos.current = from + (t - from) * easeSmooth(k);
        paint();
        anim.current = k < 1 ? requestAnimationFrame(run) : 0;
      };
      anim.current = requestAnimationFrame(run);
    }, [n, paint, stopAnim]);

    const go = useCallback(function (d) { glide(dest.current + d); }, [glide]);

    /* Bam vao mot the ben canh = chon the do, chu khong phai bam nut ben
       trong no; nut cua the khong duoc chon da bi tat o CSS.

       Truoc day cho phep KEO TAY va LAN CHUOT. Bo ca hai. Keo ngang o giua
       mot trang von cuon doc duoc thi rat de bi hieu nham thanh keo trang,
       con lan chuot thi cuop mat cu cuon trang tren man hinh thap -- dung
       luc nguoi dung can cuon nhat. Nay chi con BAM: bam the ben canh, bam
       cham tron ben duoi, hoac phim mui ten. */
    const pick = function (i) {
      if (i !== dest.current) glide(i);
    };

    /* ---- phim mui ten ---- */
    useEffect(function () {
      const onKey = function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const a = document.activeElement;
        if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return;
        if (!vp.current || !vp.current.offsetParent) return;
        e.preventDefault();
        go(e.key === 'ArrowRight' ? 1 : -1);
      };
      window.addEventListener('keydown', onKey);
      return function () { window.removeEventListener('keydown', onKey); };
    }, [go]);

    return (
      <div className="ig__deck">
        <div
          className="ig__vp"
          ref={vp}
          role="group"
          aria-label={label}
        >
          <div className="ig__track" ref={track}>
            {items.map(function (it, i) {
              return (
                <div
                  className={'ig__cell' + (i === active ? ' is-on' : '')}
                  key={i}
                  ref={function (el) { cells.current[i] = el; }}
                  onClick={function () { pick(i); }}
                  aria-hidden={i === active ? undefined : 'true'}
                >
                  {it}
                </div>
              );
            })}
          </div>
        </div>

        <div className="ig__dots" role="tablist">
          {items.map(function (it, i) {
            return (
              <button
                key={i}
                className={'ig__dot' + (i === active ? ' is-on' : '')}
                onClick={function () { glide(i); }}
                role="tab"
                aria-selected={i === active}
                aria-label={TX('Dịch vụ') + ' ' + (i + 1)}
              />
            );
          })}
        </div>
      </div>
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
      <div className="nx-page nx-page--deck">
        <header className="ig__hero">
          <h1 className="ig__title">{TX('Hệ thống dịch vụ tích hợp')}</h1>
          <p className="ig__sub">
            {TX('Năm tiện ích chạy trực tiếp trên máy bạn: đồng bộ save, cài bản Việt hóa, mở khóa game bằng AppID và thay giao diện Steam — tất cả chỉ một lần bấm.')}
          </p>
        </header>

        <Deck label={TX('Hệ thống dịch vụ tích hợp')}>
          <CloudCard card={byId.cloud} />
          <ToolCard card={byId.canhcut} />
          <ToolCard card={byId.thuanviet} />
          <EasyCard card={byId.vip} />
          <FluentyCard card={byId.fluenty} />
        </Deck>

        <div className="ig__foot">
          <button className="bn bn--discord bn--slim" onClick={function () { openExternal(DISCORD_URL); }}>
            <span className="bn__ico"><i className="fa-brands fa-discord"></i></span>
            <span className="bn__t">{TX('CẦN THÊM GAME HOẶC GẶP LỖI?')}</span>
            <span className="bn__d">{TX('Gửi yêu cầu trong Discord, đội hỗ trợ sẽ xử lý trực tiếp')}</span>
            <i className="bn__go ph-bold ph-arrow-up-right"></i>
          </button>
        </div>
      </div>
    );
  }

  Object.assign(window.NX, { IntegrateContent, SERVICE_CARDS: CARDS });
})();
