/* ============================================================================
   NEXUS AGENT — khung chat AI toan man hinh

   Giao dien nay chay tren Vercel (cong khai) nen KHONG giu bat ky khoa nao.
   Moi thu that — khoa API, doc/ghi file, chay lenh — deu nam trong Python o
   may nguoi dung. O day chi lam ba viec: gui chu xuong, ve lai nhung gi Python
   day len, va hoi nguoi dung dong y hay khong.

   Mo trong trinh duyet thuong (khong co pywebview) thi nut chat tu an di.

   BA CAI BAY DA BIET TRUOC O CODEBASE NAY, DA NE SAN:
     1. <html> bi dat style.zoom -> KHONG duoc dung 100vw/100vh, phai dung
        calc(100 * var(--vw)). Xem tokens.css:97-99.
     2. tokens.css quet moi phan tu ep animation-duration ve 0.001ms khi may bat
        giam chuyen dong (may nguoi dung DANG bat). Vi vay panel nay mo/dong bang
        transition chu khong bang animation, va cho quay dung .nx-spin — class da
        duoc mien tru san.
     3. app.views.jsx:649 bat Ctrl+F o tam window ma khong kiem tra dang go trong
        o nhap -> phai chan su kien ban phim ngay tai panel.
   ========================================================================== */

(function () {
  'use strict';

  const { useState, useEffect, useRef, useCallback, useMemo } = React;
  const { TX, useLang, callApi, hasApi, useToast, useEscape, useClickOutside,
          prefersCalm } = window.NX;

  /* --------------------------------------------------------------------------
     1. MARKDOWN RUT GON
     Chi lam nhung thu model hay dung: khoi code, code trong dong, in dam,
     in nghieng, gach dau dong, tieu de. Khong keo ca thu vien markdown ve chi
     de hien vai dong chu — them 40KB CDN cho viec nay la khong dang.
     ------------------------------------------------------------------------ */

  function inlineMd(s, keyBase) {
    // Tach theo `code` truoc, roi moi xu ly dam/nghieng ben trong phan con lai.
    const out = [];
    const parts = String(s).split(/(`[^`]+`)/g);
    parts.forEach(function (p, i) {
      if (!p) return;
      if (p.charAt(0) === '`' && p.charAt(p.length - 1) === '`' && p.length > 2) {
        out.push(<code key={keyBase + 'c' + i} className="ag-code">{p.slice(1, -1)}</code>);
        return;
      }
      const seg = p.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      seg.forEach(function (q, j) {
        if (!q) return;
        const k = keyBase + 'i' + i + '_' + j;
        if (q.length > 4 && q.slice(0, 2) === '**' && q.slice(-2) === '**') {
          out.push(<strong key={k}>{q.slice(2, -2)}</strong>);
        } else if (q.length > 2 && q.charAt(0) === '*' && q.charAt(q.length - 1) === '*') {
          out.push(<em key={k}>{q.slice(1, -1)}</em>);
        } else {
          out.push(<span key={k}>{q}</span>);
        }
      });
    });
    return out;
  }

  function CodeBlock({ lang, code }) {
    const [copied, setCopied] = useState(false);
    return (
      <div className="ag-cb">
        <div className="ag-cb__bar">
          <span className="ag-cb__lang">{lang || 'văn bản'}</span>
          <button
            className="ag-cb__copy"
            onClick={function () {
              try {
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(function () { setCopied(false); }, 1400);
              } catch (e) { /* trinh duyet chan clipboard -> bo qua */ }
            }}
          >
            <i className={copied ? 'ph-bold ph-check' : 'ph-bold ph-copy'}></i>
            {copied ? TX('Đã chép') : TX('Chép')}
          </button>
        </div>
        <pre className="ag-cb__pre"><code>{code}</code></pre>
      </div>
    );
  }

  function Markdown({ text }) {
    /* useDeferredValue: khi chu dang chay ve lien tuc, React duoc phep ve phan
       Markdown o muc uu tien THAP. Nghia la neu khung hinh dang ban, no hoan
       viec phan tich lai mot nhip thay vi chan luong — go phim va cuon chuot
       van nhay ngay. Text cuoi cung luon dung, chi la co the cham mot nhip. */
    const shown = React.useDeferredValue ? React.useDeferredValue(text) : text;
    const nodes = useMemo(function () {
      const src = String(shown || '');
      const out = [];
      // Tach khoi code ba dau huyen truoc tien.
      const chunks = src.split(/```/g);
      chunks.forEach(function (chunk, ci) {
        if (ci % 2 === 1) {
          const nl = chunk.indexOf('\n');
          const lang = nl > -1 ? chunk.slice(0, nl).trim() : '';
          const code = nl > -1 ? chunk.slice(nl + 1) : chunk;
          out.push(<CodeBlock key={'cb' + ci} lang={lang} code={code.replace(/\n$/, '')} />);
          return;
        }
        const lines = chunk.split('\n');
        let buf = [];
        let listBuf = [];

        function flushList(tag) {
          if (!listBuf.length) return;
          out.push(
            <ul key={'ul' + ci + '_' + out.length} className="ag-ul">
              {listBuf.map(function (t, i) {
                return <li key={i}>{inlineMd(t, 'l' + ci + i)}</li>;
              })}
            </ul>
          );
          listBuf = [];
        }

        function flushPara() {
          if (!buf.length) return;
          const t = buf.join('\n');
          if (t.trim()) {
            out.push(<p key={'p' + ci + '_' + out.length} className="ag-p">{inlineMd(t, 'p' + ci + out.length)}</p>);
          }
          buf = [];
        }

        lines.forEach(function (ln) {
          const li = ln.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
          const hd = ln.match(/^(#{1,4})\s+(.*)$/);
          if (li) {
            flushPara();
            listBuf.push(li[1]);
          } else if (hd) {
            flushPara(); flushList();
            out.push(
              <div key={'h' + ci + '_' + out.length} className={'ag-h ag-h--' + hd[1].length}>
                {inlineMd(hd[2], 'h' + ci + out.length)}
              </div>
            );
          } else if (!ln.trim()) {
            flushPara(); flushList();
          } else {
            flushList();
            buf.push(ln);
          }
        });
        flushPara(); flushList();
      });
      return out;
    }, [shown]);
    return <div className="ag-md">{nodes}</div>;
  }

  /* --------------------------------------------------------------------------
     2. NHAN VA MAU CHO TUNG TOOL
     ------------------------------------------------------------------------ */

  const TOOL_META = {
    read_file:    { i: 'ph-fill ph-file-text',       t: 'Đọc file',        tone: 'read' },
    write_file:   { i: 'ph-fill ph-file-plus',       t: 'Ghi file',        tone: 'write' },
    edit_file:    { i: 'ph-fill ph-pencil-simple',   t: 'Sửa file',        tone: 'write' },
    list_dir:     { i: 'ph-fill ph-folder-open',     t: 'Xem thư mục',     tone: 'read' },
    make_dir:     { i: 'ph-fill ph-folder-plus',     t: 'Tạo thư mục',     tone: 'write' },
    move_path:    { i: 'ph-fill ph-arrows-left-right', t: 'Di chuyển',     tone: 'write' },
    delete_path:  { i: 'ph-fill ph-trash',           t: 'Xoá',             tone: 'danger' },
    glob_files:   { i: 'ph-fill ph-magnifying-glass', t: 'Tìm file',       tone: 'read' },
    grep_files:   { i: 'ph-fill ph-text-aa',         t: 'Tìm trong file',  tone: 'read' },
    run_command:  { i: 'ph-fill ph-terminal-window', t: 'Chạy lệnh',       tone: 'run' },
    web_search:   { i: 'ph-fill ph-globe',           t: 'Tìm trên web',    tone: 'read' },
    fetch_url:    { i: 'ph-fill ph-link',            t: 'Đọc trang web',   tone: 'read' },
    download_file:{ i: 'ph-fill ph-download-simple', t: 'Tải file về',     tone: 'write' },
  };

  function metaOf(name) {
    return TOOL_META[name] || { i: 'ph-fill ph-wrench', t: name || 'Thao tác', tone: 'read' };
  }

  /* --------------------------------------------------------------------------
     3. CAC MANH GIAO DIEN
     ------------------------------------------------------------------------ */

  function DiffView({ d }) {
    if (!d) return null;
    const lines = String(d.text || '').split('\n').filter(Boolean);
    return (
      <div className="ag-diff">
        <div className="ag-diff__bar">
          <i className="ph-fill ph-file-text"></i>
          <span className="ag-diff__path">{d.path || ''}</span>
          <span className="ag-diff__add">+{d.add || 0}</span>
          <span className="ag-diff__rm">-{d.rm || 0}</span>
        </div>
        {lines.length ? (
          <pre className="ag-diff__body">
            {lines.map(function (ln, i) {
              const c = ln.charAt(0) === '+' ? 'ag-diff__l ag-diff__l--a'
                      : ln.charAt(0) === '-' ? 'ag-diff__l ag-diff__l--r'
                      : 'ag-diff__l';
              return <div key={i} className={c}>{ln}</div>;
            })}
          </pre>
        ) : null}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     4C. MOT DONG TRONG CUOC TRO CHUYEN — boc React.memo

     Day la thu quyet dinh do muot. Truoc day moi lan model tra ve them mot manh
     chu (khoang 20 lan/giay), React dung lai TOAN BO danh sach: hoi thoai 80
     dong thi 80 dong deu duoc so lai, va moi doan van deu duoc phan tich
     Markdown lai tu dau. Cang chat lau cang giat.

     Boc memo thi dong nao khong doi se khong dung lai. Luc dang tra loi chi con
     DUNG MOT dong duoc ve lai — phan con lai dung yen hoan toan.
     ------------------------------------------------------------------------ */

  const Row = React.memo(function Row({ it, onAnswer }) {
    if (it.k === 'me') {
      return (
        <div className="ag__row ag__row--me">
          <div className="ag__mewrap">
            {it.pics && it.pics.length ? (
              <div className="ag__pics">
                {it.pics.map(function (u, i) {
                  return <img key={i} className="ag__pic" src={u} alt="" />;
                })}
              </div>
            ) : null}
            {it.s ? <div className="ag__me">{it.s}</div> : null}
          </div>
        </div>
      );
    }
    if (it.k === 'text') {
      return <div className="ag__row"><div className="ag__ai"><Markdown text={it.s} /></div></div>;
    }
    if (it.k === 'think') {
      return <div className="ag__row ag__row--sub"><ThinkBlock text={it.s} /></div>;
    }
    if (it.k === 'tool') {
      return <div className="ag__row ag__row--sub"><ToolCard item={it} /></div>;
    }
    if (it.k === 'ask') {
      return <div className="ag__row ag__row--sub"><AskCard item={it} onAnswer={onAnswer} /></div>;
    }
    if (it.k === 'err') {
      return (
        <div className="ag__row ag__row--sub">
          <div className="ag__err"><i className="ph-fill ph-warning-octagon"></i><div>{it.s}</div></div>
        </div>
      );
    }
    return <div className="ag__row ag__row--sub"><div className="ag__note">{it.s}</div></div>;
  }, function (a, b) {
    // Chi ve lai khi noi dung that su doi. So tung truong thay vi so ca object:
    // moi lan nhan su kien minh tao object moi nen so bang === se luon khac.
    const x = a.it, y = b.it;
    return x === y || (
      x.k === y.k && x.id === y.id && x.s === y.s &&
      x.state === y.state && x.out === y.out &&
      x.answered === y.answered && x.ok === y.ok &&
      x.denied === y.denied && x.pics === y.pics
    );
  });

  function ToolCard({ item }) {
    const [open, setOpen] = useState(false);
    const m = metaOf(item.name);
    const running = item.state === 'run';
    const bad = item.state === 'bad';
    const denied = item.denied;
    const cls = 'ag-tool ag-tool--' + m.tone
      + (running ? ' is-run' : '') + (bad ? ' is-bad' : '') + (denied ? ' is-denied' : '');
    return (
      <div className={cls}>
        <button className="ag-tool__head" onClick={function () { setOpen(!open); }}>
          <span className="ag-tool__ico">
            {running ? <span className="nx-spin" /> : <i className={m.i}></i>}
          </span>
          <span className="ag-tool__name">{TX(m.t)}</span>
          <span className="ag-tool__sum" title={item.summary || ''}>{item.summary || ''}</span>
          {denied ? <span className="ag-tool__tag ag-tool__tag--no">{TX('đã từ chối')}</span>
            : bad ? <span className="ag-tool__tag ag-tool__tag--bad">{TX('lỗi')}</span>
            : running ? null
            : <span className="ag-tool__tag ag-tool__tag--ok"><i className="ph-bold ph-check"></i></span>}
          {item.out ? <i className={'ag-tool__caret ph-bold ' + (open ? 'ph-caret-up' : 'ph-caret-down')}></i> : null}
        </button>
        {open && item.out ? <pre className="ag-tool__out">{item.out}</pre> : null}
      </div>
    );
  }

  function AskCard({ item, onAnswer }) {
    const m = metaOf(item.tool);
    const isCmd = item.tool === 'run_command';
    const isDel = item.tool === 'delete_path';
    if (item.answered) {
      return (
        <div className={'ag-ask is-done' + (item.ok ? ' is-yes' : ' is-no')}>
          <i className={item.ok ? 'ph-fill ph-check-circle' : 'ph-fill ph-x-circle'}></i>
          <span>{item.ok ? TX('Bạn đã đồng ý') : TX('Bạn đã từ chối')} · {TX(m.t)} {item.summary}</span>
        </div>
      );
    }
    return (
      <div className={'ag-ask' + (isDel ? ' ag-ask--danger' : '')}>
        <div className="ag-ask__head">
          <span className="ag-ask__ico"><i className={m.i}></i></span>
          <div className="ag-ask__txt">
            <div className="ag-ask__t">{TX('Agent muốn')} {TX(m.t).toLowerCase()}</div>
            <div className="ag-ask__s">{item.summary}</div>
          </div>
        </div>

        {isCmd ? (
          <pre className="ag-ask__cmd">{(item.args && item.args.command) || ''}</pre>
        ) : null}
        {isDel ? (
          <div className="ag-ask__warn">
            <i className="ph-fill ph-warning"></i>
            {TX('Thao tác xoá không hoàn tác được.')}
          </div>
        ) : null}
        <DiffView d={item.preview} />

        <div className="ag-ask__act">
          <button className="nx-btn nx-btn--primary nx-btn--sm"
                  onClick={function () { onAnswer(item.id, true); }}>
            <i className="ph-bold ph-check"></i>{TX('Đồng ý')}
          </button>
          <button className="nx-btn nx-btn--ghost nx-btn--sm"
                  onClick={function () { onAnswer(item.id, false); }}>
            <i className="ph-bold ph-x"></i>{TX('Từ chối')}
          </button>
        </div>
      </div>
    );
  }

  function ThinkBlock({ text }) {
    const [open, setOpen] = useState(false);
    if (!text || !text.trim()) return null;
    return (
      <div className={'ag-think' + (open ? ' is-open' : '')}>
        <button className="ag-think__head" onClick={function () { setOpen(!open); }}>
          <i className="ph-fill ph-brain"></i>
          <span>{TX('Đang suy nghĩ')}</span>
          <i className={'ph-bold ' + (open ? 'ph-caret-up' : 'ph-caret-down')}></i>
        </button>
        {open ? <div className="ag-think__body">{text}</div> : null}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     4. BANG CAI DAT
     ------------------------------------------------------------------------ */

  function Settings({ st, onClose, onSave }) {
    const [cwd, setCwd] = useState((st && st.cwd) || '');
    const [askRead, setAskRead] = useState(!!(st && st.ask_read));
    const toast = useToast();

    return (
      <div className="ag-cfg">
        <div className="ag-cfg__head">
          <i className="ph-fill ph-gear-six"></i>
          <span>{TX('Cài đặt')}</span>
          <button className="ag-x" onClick={onClose}><i className="ph-bold ph-x"></i></button>
        </div>

        <div className="ag-cfg__body">
          <div className="ag-cfg__row">
            <div className="ag-cfg__lb">{TX('Thư mục làm việc')}</div>
            <div className="ag-cfg__hint">{TX('Nơi agent chạy lệnh khi bạn không nói rõ đường dẫn.')}</div>
            <div className="ag-cfg__pick">
              <input className="ag-in" value={cwd} placeholder={TX('Chưa chọn')}
                     onChange={function (e) { setCwd(e.target.value); }} />
              <button className="nx-btn nx-btn--ghost nx-btn--sm" onClick={async function () {
                const r = await callApi('ai_pick_folder');
                if (r && r.success && r.path) { setCwd(r.path); onSave({ cwd: r.path }); }
              }}>
                <i className="ph-bold ph-folder-open"></i>{TX('Chọn')}
              </button>
            </div>
          </div>

          {/* Muc suy nghi da chuyen thanh chip Effort o thanh duoi, khong de o day
              nua — de hai cho cung chinh mot thu thi kieu gi cung co luc lech. */}

          <label className="ag-cfg__sw">
            <input type="checkbox" checked={askRead} onChange={function (e) {
              setAskRead(e.target.checked); onSave({ ask_read: e.target.checked });
            }} />
            <span>
              <b>{TX('Hỏi cả khi agent chỉ đọc file')}</b>
              <i>{TX('Mặc định chỉ hỏi khi ghi hoặc chạy lệnh. Bật cái này sẽ hỏi rất nhiều.')}</i>
            </span>
          </label>

          {/* Khong con phan Ket noi o day. Dia chi may chu, khoa API va mo hinh
              deu lay tu hang so trong nexus_agent.py — do la nguon duy nhat.
              De thanh o sua duoc trong giao dien chi tao ra kha nang hai noi
              lech nhau roi kho lan ra dang chay bang cai nao. */}
          <div className="ag-cfg__info">
            <div><span>{TX('Máy chủ')}</span><b>{(st && st.base_url) || '—'}</b></div>
            <div><span>{TX('Tìm web')}</span><b>{st && st.has_exa ? TX('có') : TX('chưa bật')}</b></div>
            <div><span>{TX('Số công cụ')}</span><b>{(st && st.tools && st.tools.length) || 0}</b></div>
          </div>

          <button className="nx-btn nx-btn--ghost nx-btn--sm nx-btn--full" onClick={async function () {
            await callApi('ai_reset');
            toast.push({ tone: 'ok', title: TX('Đã xoá cuộc trò chuyện') });
            onClose();
            window.dispatchEvent(new CustomEvent('nx-agent-cleared'));
          }}>
            <i className="ph-bold ph-broom"></i>{TX('Bắt đầu cuộc trò chuyện mới')}
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     4A. DANH SACH CUOC TRO CHUYEN

     Python luu messages theo dinh dang cua API (co tool_use, tool_result,
     thinking). Khi mo lai mot phien cu, phai doi nguoc ve dang hien thi —
     do la viec cua msgsToItems() ben duoi.
     ------------------------------------------------------------------------ */

  function msgsToItems(msgs) {
    const out = [];
    const toolAt = {};                 // id tool -> vi tri trong out, de ghep ket qua
    (msgs || []).forEach(function (m, mi) {
      const role = m.role;
      const c = m.content;

      if (typeof c === 'string') {
        out.push({ k: role === 'user' ? 'me' : 'text', s: c, id: 'h' + mi });
        return;
      }
      if (!Array.isArray(c)) return;

      /* Anh trong CUNG mot tin nhan phai gom lai roi gan vao bong bong chu,
         khong tach thanh dong rieng — nguoi dung gui anh kem cau hoi thi luc
         xem lai cung phai thay chung o cung mot cho. */
      const pics = c.filter(function (b) { return b.type === 'image'; })
                    .map(function (b) {
                      const s = (b.source || {});
                      return 'data:' + (s.media_type || 'image/png') + ';base64,' + (s.data || '');
                    });
      let picsUsed = false;

      c.forEach(function (b, bi) {
        const id = 'h' + mi + '_' + bi;
        if (b.type === 'text') {
          if (role === 'user') {
            const it = { k: 'me', s: b.text || '', id: id };
            if (pics.length && !picsUsed) { it.pics = pics; picsUsed = true; }
            out.push(it);
          } else out.push({ k: 'text', s: b.text || '', id: id });
        } else if (b.type === 'thinking') {
          out.push({ k: 'think', s: b.thinking || '', id: id });
        } else if (b.type === 'tool_use') {
          toolAt[b.id] = out.length;
          out.push({ k: 'tool', id: b.id, name: b.name, args: b.input || {},
                     summary: sumOf(b.name, b.input || {}), state: 'ok' });
        } else if (b.type === 'tool_result') {
          const at = toolAt[b.tool_use_id];
          if (at !== undefined && out[at]) {
            out[at].out = typeof b.content === 'string' ? b.content : '';
            out[at].state = b.is_error ? 'bad' : 'ok';
          }
        }
      });
    });
    return out;
  }

  /* Ban rut gon cua tool_summary ben Python — chi de dung lai lich su cu. */
  function sumOf(name, a) {
    a = a || {};
    if (name === 'run_command') return String(a.command || '').slice(0, 120);
    if (name === 'web_search') return String(a.query || '').slice(0, 120);
    if (name === 'fetch_url') return String(a.url || '').slice(0, 120);
    if (name === 'download_file') {
      const u = String(a.url || '');
      return (u.split('?')[0].replace(/\/+$/, '').split('/').pop() || u).slice(0, 120);
    }
    if (name === 'glob_files' || name === 'grep_files') return String(a.pattern || '');
    if (name === 'move_path') return String(a.src || '').split(/[\\/]/).pop();
    const p = String(a.path || '');
    return p.split(/[\\/]/).pop() || p;
  }

  function whenText(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const hh = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (sameDay) return hh;
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  }

  function SessionRow({ s, on, run, onOpen, onDelete, onRename }) {
    const [edit, setEdit] = useState(false);
    const [val, setVal] = useState(s.title);
    const inRef = useRef(null);

    useEffect(function () {
      if (edit && inRef.current) { inRef.current.focus(); inRef.current.select(); }
    }, [edit]);

    function done(save) {
      setEdit(false);
      const t = val.trim();
      if (save && t && t !== s.title) onRename(s.id, t);
      else setVal(s.title);
    }

    if (edit) {
      return (
        <div className="ag__ses is-edit">
          <input ref={inRef} className="ag__ses__in" value={val} spellCheck={false}
                 onChange={function (e) { setVal(e.target.value); }}
                 onBlur={function () { done(true); }}
                 onKeyDown={function (e) {
                   e.stopPropagation();
                   if (e.key === 'Enter') { e.preventDefault(); done(true); }
                   if (e.key === 'Escape') { e.preventDefault(); done(false); }
                 }} />
        </div>
      );
    }

    return (
      <div className={'ag__ses' + (on ? ' is-on' : '')}>
        <button className="ag__ses__b" onClick={function () { onOpen(s.id); }}
                onDoubleClick={function () { setVal(s.title); setEdit(true); }}
                title={s.title + ' — ' + TX('bấm đúp để đổi tên')}>
          {run ? <span className="nx-spin ag__ses__run" /> : null}
          <span className="ag__ses__t">{s.title}</span>
          <span className="ag__ses__m">{run ? TX('đang chạy') : whenText(s.updated)}</span>
        </button>
        <button className="ag__ses__i" title={TX('Đổi tên')}
                onClick={function (e) { e.stopPropagation(); setVal(s.title); setEdit(true); }}>
          <i className="ph-bold ph-pencil-simple"></i>
        </button>
        <button className="ag__ses__x" title={TX('Xoá')}
                onClick={function (e) { e.stopPropagation(); onDelete(s.id); }}>
          <i className="ph-bold ph-trash"></i>
        </button>
      </div>
    );
  }

  function SessionList({ open, list, cur, running, onOpen, onNew, onDelete, onRename }) {
    useLang();
    if (!open) return null;
    return (
      <aside className="ag__side">
        <button className="ag__new" onClick={onNew}>
          <i className="ph-bold ph-plus"></i>{TX('Cuộc trò chuyện mới')}
        </button>

        <div className="ag__side__h">{TX('Gần đây')}</div>

        <div className="ag__side__l">
          {!list.length ? (
            <div className="ag__side__e">{TX('Chưa có cuộc nào')}</div>
          ) : list.map(function (s) {
            return <SessionRow key={s.id} s={s} on={s.id === cur}
                               run={(running || []).indexOf(s.id) > -1}
                               onOpen={onOpen} onDelete={onDelete} onRename={onRename} />;
          })}
        </div>
      </aside>
    );
  }

  /* --------------------------------------------------------------------------
     4B. CHON MODEL VA MUC EFFORT — hai chip o goc phai thanh duoi
     ------------------------------------------------------------------------ */

  function ModelPicker({ st, onPick }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useClickOutside(ref, function () { setOpen(false); }, open);
    useEscape(function () { setOpen(false); }, open);

    const list = (st && st.models) || [];
    const curId = (st && st.model) || '';
    const cur1m = !!(st && st.ctx_1m);
    const cur = list.filter(function (m) {
      return m.id === curId && !!m.ctx1m === cur1m;
    })[0] || { ten: curId || '—', ctx1m: cur1m };
    /* Chi co dung mot model thi khong mo menu — bam vao chi de thay mot dong
       duy nhat la vo duyen. Luc do chip chi con la nhan. */
    const single = list.length <= 1;

    /* Phim tat 1..5 khi menu dang mo. Menu co in san so ben phai moi dong, neu
       bam so ma khong chay thi con so do chi la trang tri gay hieu nham. */
    useEffect(function () {
      if (!open) return;
      function onKey(e) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= list.length) {
          e.preventDefault();
          e.stopPropagation();
          const m = list[n - 1];
          setOpen(false);
          onPick({ model: m.id, ctx_1m: !!m.ctx1m });
        }
      }
      window.addEventListener('keydown', onKey, true);
      return function () { window.removeEventListener('keydown', onKey, true); };
    }, [open, list, onPick]);

    return (
      <div className="ag-pk" ref={ref}>
        <button className={'ag-pk__b' + (open ? ' is-on' : '') + (single ? ' is-lone' : '')}
                onClick={function () { if (!single) setOpen(!open); }}
                disabled={single}
                title={single ? cur.ten : TX('Chọn mô hình')}>
          <span>{cur.ten}</span>
          {cur.ctx1m ? <b className="ag-pk__1m">1M</b> : null}
          {single ? null : <i className="ph-bold ph-caret-up"></i>}
        </button>
        {open && !single ? (
          <div className="ag-pk__menu" role="listbox">
            <div className="ag-pk__h">{TX('Mô hình')}</div>
            {list.map(function (m, i) {
              const on = m.id === curId && !!m.ctx1m === cur1m;
              return (
                <button key={i} role="option" aria-selected={on}
                        className={'ag-pk__i' + (on ? ' is-on' : '')}
                        onClick={function () {
                          setOpen(false);
                          onPick({ model: m.id, ctx_1m: !!m.ctx1m });
                        }}>
                  <span className="ag-pk__n">
                    {m.ten}
                    {m.ctx1m ? <b className="ag-pk__1m">1M</b> : null}
                  </span>
                  <span className="ag-pk__g">{m.ghi}</span>
                  {on ? <i className="ph-bold ph-check"></i> : <em>{i + 1}</em>}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  /* Thanh truot 5 nac. Dung <input type="range"> that chu khong ve tay: no cho
     keo bang chuot, bam mui ten, va doc duoc bang trinh doc man hinh — mien phi. */
  function EffortPicker({ st, onPick }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useClickOutside(ref, function () { setOpen(false); }, open);
    useEscape(function () { setOpen(false); }, open);

    const val = (st && st.effort) || 5;
    const name = (st && st.effort_name) || '';

    return (
      <div className="ag-pk" ref={ref}>
        <button className={'ag-pk__b' + (open ? ' is-on' : '')}
                onClick={function () { setOpen(!open); }}
                title={TX('Mức suy nghĩ')}>
          <span>{TX(name)}</span>
          <i className="ph-bold ph-caret-up"></i>
        </button>
        {open ? (
          <div className="ag-pk__menu ag-pk__menu--eff">
            <div className="ag-eff__t">
              {TX('Mức suy nghĩ')} <b>{TX(name)}</b>
            </div>
            <input
              className="ag-eff__r"
              type="range" min="1" max="5" step="1" value={val}
              onChange={function (e) { onPick({ effort: +e.target.value }); }}
            />
            <div className="ag-eff__lb">
              <span>{TX('Nhanh hơn')}</span>
              <span>{TX('Kỹ hơn')}</span>
            </div>
            <div className="ag-eff__d">
              {val <= 1
                ? TX('Trả lời ngay, gần như không suy nghĩ. Hợp với việc đơn giản.')
                : val >= 5
                  ? TX('Suy nghĩ lâu nhất. Chậm hơn nhưng làm việc khó tốt hơn hẳn.')
                  : TX('Cân bằng giữa tốc độ và độ kỹ.')}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     5. KHUNG CHAT CHINH
     ------------------------------------------------------------------------ */

  /* Cau goi y giu ngan de moi the vua dung mot dong — hai the canh nhau ma mot
     cai hai dong, mot cai mot dong thi nhin lech han. */
  const GOI_Y = [
    { i: 'ph-fill ph-folder-open',     t: 'Thư mục này có những gì?' },
    { i: 'ph-fill ph-bug',             t: 'Đọc file này tìm lỗi giúp tôi' },
    { i: 'ph-fill ph-globe',           t: 'Tìm trên web giúp tôi' },
    { i: 'ph-fill ph-terminal-window', t: 'Chạy lệnh rồi báo kết quả' },
  ];

  function AgentPanel({ onClose }) {
    useLang();
    const toast = useToast();
    /* Tin nhan luu THEO TUNG PHIEN, khong phai mot mang chung.
       Nhieu cuoc tro chuyen chay cung luc: dang xem phien A ma phien B tra ve
       thi ket qua cua B phai roi vao nhanh cua B, khong duoc chen vao man hinh
       dang mo. Chuyen qua lai giua cac phien thi noi dung van con nguyen. */
    const [byId, setById] = useState({});          // sid -> danh sach hien thi
    const [curSid, setCurSid] = useState('');
    const [running, setRunning] = useState([]);    // cac sid dang chay
    const items = byId[curSid] || [];
    const busy = running.indexOf(curSid) > -1;
    const setBusy = useCallback(function (on) {
      setRunning(function (p) {
        const has = p.indexOf(curSid) > -1;
        if (on && !has) return p.concat([curSid]);
        if (!on && has) return p.filter(function (x) { return x !== curSid; });
        return p;
      });
    }, [curSid]);
    const [draft, setDraft] = useState('');
    const [st, setSt] = useState(null);
    const [cfgOpen, setCfgOpen] = useState(false);
    const [sideOpen, setSideOpen] = useState(true);
    const [ses, setSes] = useState({ list: [], current: '' });
    const [imgs, setImgs] = useState([]);        // anh dinh kem chua gui
    const [drag, setDrag] = useState(false);
    const bodyRef = useRef(null);
    const taRef = useRef(null);
    const fileRef = useRef(null);
    const stick = useRef(true);

    /* --- dinh kem anh: chon file, dan Ctrl+V, hoac keo tha ---
       Khong gioi han so luong hay dung luong o day. Neu anh qua to thi chinh
       API se tu bao loi, va thong bao loi da duoc doi sang tieng Viet. */
    const addFiles = useCallback(function (files) {
      const arr = Array.prototype.slice.call(files || []).filter(function (f) {
        return f && f.type && f.type.indexOf('image/') === 0;
      });
      arr.forEach(function (f) {
        const fr = new FileReader();
        fr.onload = function () {
          const url = String(fr.result || '');
          const comma = url.indexOf(',');
          if (comma < 0) return;
          setImgs(function (p) {
            return p.concat([{
              id: 'i' + Date.now() + '_' + Math.round(Math.random() * 1e6),
              media_type: f.type,
              data: url.slice(comma + 1),
              url: url,
              name: f.name || 'anh',
              size: f.size || 0,
            }]);
          });
        };
        fr.readAsDataURL(f);
      });
    }, []);

    function onPaste(e) {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      const fs = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
          const f = items[i].getAsFile();
          if (f) fs.push(f);
        }
      }
      if (fs.length) { e.preventDefault(); addFiles(fs); }
    }

    /* --- nap trang thai tu Python --- */
    const refresh = useCallback(async function () {
      const r = await callApi('ai_state');
      if (r && r.success) setSt(r);
      else setSt({ success: false, error: (r && r.error) || '' });
    }, []);

    const loadSes = useCallback(async function () {
      const r = await callApi('ai_sessions');
      if (r && r.success) {
        setSes({ list: r.list || [], current: r.current || '' });
        if (r.running) setRunning(r.running);
        setCurSid(function (p) { return p || r.current || ''; });
      }
    }, []);

    useEffect(function () { refresh(); loadSes(); }, [refresh, loadSes]);

    const openSes = useCallback(async function (sid) {
      const r = await callApi('ai_session_open', sid);
      if (!r || !r.success) {
        toast.push({ tone: 'bad', title: TX('Không mở được'), desc: (r && r.error) || '' });
        return;
      }
      // Phien dang chay san thi giu nguyen noi dung dang co tren man hinh,
      // khong nap de — nap de se xoa mat phan agent vua viet them.
      setById(function (p) {
        if (r.busy && p[sid] && p[sid].length) return p;
        const n = Object.assign({}, p);
        n[sid] = msgsToItems(r.messages);
        return n;
      });
      setCurSid(sid);
      setSes(function (p) { return { list: p.list, current: sid }; });
      stick.current = true;
    }, [toast]);

    const newSes = useCallback(async function () {
      const r = await callApi('ai_reset');
      if (r && r.sid) {
        setById(function (p) { const n = Object.assign({}, p); n[r.sid] = []; return n; });
        setCurSid(r.sid);
        setSes(function (p) { return { list: p.list, current: r.sid }; });
      }
      loadSes();
    }, [loadSes]);

    const renSes = useCallback(async function (sid, title) {
      // Doi ten ngay tren giao dien roi moi goi xuong Python: bam xong thay doi
      // lien, khong phai cho mot vong goi qua lai.
      setSes(function (p) {
        return { current: p.current,
                 list: p.list.map(function (x) {
                   return x.id === sid ? Object.assign({}, x, { title: title }) : x;
                 }) };
      });
      const r = await callApi('ai_session_rename', sid, title);
      if (!r || !r.success) loadSes();      // that bai -> nap lai ten that
    }, [loadSes]);

    const delSes = useCallback(async function (sid) {
      const r = await callApi('ai_session_delete', sid);
      if (r && r.success) {
        setById(function (p) { const n = Object.assign({}, p); delete n[sid]; return n; });
        setRunning(function (p) { return p.filter(function (x) { return x !== sid; }); });
        if (curSid === sid) setCurSid('');
        loadSes();
      }
    }, [curSid, loadSes]);

    /* --- nhan su kien Python day len ---

       Python goi window.__nxAgentPush(danhSachSuKien) moi ~50ms. O day KHONG
       goi setState ngay: don su kien vao mot cai gio (ref) roi moi khung hinh
       mot lan do het gio vao state. Lam vay thi du Python co ban su kien day
       hon, giao dien van chi ve lai theo nhip man hinh — khong bi don ung.

       Ket hop voi React.memo o Row: moi khung hinh chi ve lai dung mot dong. */
    const inbox = useRef([]);
    const rafId = useRef(0);
    const applyRef = useRef(null);

    /* drain PHAI doc applyEvents qua ref, khong duoc bat cung vao closure.
       Neu viet useCallback(..., []) thi no giu mai ban applyEvents cua lan dung
       dau tien — luc do chua co phien nao. Su kien nao thieu sid se roi vao
       nhanh rong va co "dang chay" khong bao gio duoc tat, o nhap ket luon.
       Loi nay tim ra khi do: bam nut Gui thi chay, bam Enter thi khong. */
    const drain = useCallback(function () {
      rafId.current = 0;
      const batch = inbox.current;
      if (!batch.length) return;
      inbox.current = [];
      if (applyRef.current) applyRef.current(batch);
    }, []);

    const applyEvents = useCallback(function (batch) {
      /* Danh sach phien vua chay xong PHAI tinh o day, TRUOC khi goi setById.

         Ban dau minh gom no ben trong ham cap nhat cua setById — nhung React
         chi chay ham do luc ve lai, nen dong kiem tra ngay sau luon thay rong
         va co "dang chay" khong bao gio duoc tat: o nhap khoa cung sau luot dau
         tien. Tim ra khi do runtime: nut van la nut Dung du agent da tra loi
         xong. */
      const endedIn = [];
      for (let i = 0; i < batch.length; i++) {
        const e = batch[i];
        if (e.t === 'done' || e.t === 'error' || e.t === 'stopped') {
          endedIn.push(e.sid || curSid);
        }
      }
      if (endedIn.length) {
        setRunning(function (p) {
          return p.filter(function (x) { return endedIn.indexOf(x) < 0; });
        });
      }

      setById(function (prev) {
        const next = Object.assign({}, prev);

        batch.forEach(function (ev) {
          const sid = ev.sid || curSid;
          if (!sid) return;
          // Chi sao chep nhanh cua phien co su kien — cac phien khac giu nguyen
          // tham chieu cu nen React khong dung lai chung.
          const list = (next[sid] === prev[sid]) ? (prev[sid] || []).slice() : next[sid];
          next[sid] = list;

          const t = ev.t;
          if (t === 'text' || t === 'think') {
            const kind = (t === 'text') ? 'text' : 'think';
            const last = list.length ? list[list.length - 1] : null;
            if (last && last.k === kind) {
              // Thay bang object MOI chu khong sua tai cho: React.memo o Row so
              // tung truong, sua tai cho thi no tuong khong doi va bo qua.
              list[list.length - 1] = Object.assign({}, last, { s: (last.s || '') + (ev.s || '') });
            } else {
              list.push({ k: kind, s: ev.s || '',
                          id: kind.charAt(0) + list.length + '_' + Date.now() });
            }
          } else if (t === 'tool_call') {
            list.push({ k: 'tool', id: ev.id, name: ev.name, summary: ev.summary,
                        args: ev.args, state: 'run' });
          } else if (t === 'tool_done') {
            for (let i = list.length - 1; i >= 0; i--) {
              if (list[i].k === 'tool' && list[i].id === ev.id) {
                list[i] = Object.assign({}, list[i], {
                  state: ev.ok ? 'ok' : 'bad', out: ev.text || '', denied: !!ev.denied });
                break;
              }
            }
          } else if (t === 'ask') {
            list.push({ k: 'ask', id: ev.id, tool: ev.tool, summary: ev.summary,
                        args: ev.args, preview: ev.preview, answered: false, sid: sid });
          } else if (t === 'error') {
            list.push({ k: 'err', id: 'e' + Date.now() + '_' + list.length, s: ev.msg || '' });
          } else if (t === 'stopped') {
            list.push({ k: 'note', id: 'n' + Date.now() + '_' + list.length,
                        s: TX('Đã dừng theo yêu cầu của bạn.') });
          }
          // 'done' khong them dong nao vao man hinh — no chi tat co dang chay,
          // va viec do da lam o tren truoc khi goi setById.
        });
        return next;
      });
    }, [curSid]);

    // Luon tro toi ban applyEvents moi nhat (co curSid dung o thoi diem hien tai)
    applyRef.current = applyEvents;

    useEffect(function () {
      window.__nxAgentPush = function (batch) {
        if (!batch || !batch.length) return;
        for (let i = 0; i < batch.length; i++) inbox.current.push(batch[i]);
        if (!rafId.current) rafId.current = requestAnimationFrame(drain);
      };
      return function () {
        window.__nxAgentPush = null;
        if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = 0; }
      };
    }, [drain]);

    /* --- xoa lich su khi bam "cuoc tro chuyen moi" --- */
    useEffect(function () {
      function clear() { setById({}); setCurSid(''); loadSes(); }
      window.addEventListener('nx-agent-cleared', clear);
      return function () { window.removeEventListener('nx-agent-cleared', clear); };
    }, [loadSes]);

    /* Chay xong mot luot thi nap lai danh sach: Python vua ghi phien va co the
       vua dat tieu de tu tin nhan dau tien. */
    useEffect(function () {
      if (!busy) loadSes();
    }, [busy, loadSes]);

    /* --- tu cuon xuong, nhung ton trong khi nguoi dung dang doc o tren --- */
    useEffect(function () {
      const el = bodyRef.current;
      if (el && stick.current) el.scrollTop = el.scrollHeight;
    }, [items]);

    function onScroll() {
      const el = bodyRef.current;
      if (!el) return;
      stick.current = (el.scrollHeight - el.scrollTop - el.clientHeight) < 90;
    }

    /* Do be rong thanh cuon roi bao cho o nhap biet ma bu vao.

       Vung cuon bi thanh cuon an mat vai pixel ben phai, nen truc giua cua no
       lech sang trai so voi o nhap — do duoc 5px. CSS scrollbar-gutter khong
       giai quyet duoc o trinh duyet nay (thu ca 'stable' lan 'both-edges' deu
       khong doi). Do bang JS thi chac chan, va tu dung voi moi kieu thanh cuon. */
    useEffect(function () {
      function measure() {
        const el = bodyRef.current;
        if (!el) return;
        const sbw = el.offsetWidth - el.clientWidth;
        el.parentNode.style.setProperty('--ag-sbw', sbw + 'px');
      }
      measure();
      window.addEventListener('resize', measure);
      const t = setTimeout(measure, 400);   // do lai sau khi font va anh on dinh
      return function () { window.removeEventListener('resize', measure); clearTimeout(t); };
    }, [items.length, sideOpen]);

    /* --- gui tin nhan --- */
    const send = useCallback(async function (text) {
      const msg = String(text == null ? draft : text).trim();
      const pics = imgs.slice();
      // Cho gui khi chi co anh ma chua go chu — anh cung la mot cau hoi.
      if ((!msg && !pics.length) || busy) return;
      // Chua co phien nao dang mo -> tao phien moi truoc khi gui
      let sid = curSid;
      if (!sid) {
        const nr = await callApi('ai_reset');
        sid = (nr && nr.sid) || '';
        if (sid) { setCurSid(sid); loadSes(); }
      }
      const mine = { k: 'me', id: 'm' + Date.now(), s: msg,
                     pics: pics.map(function (x) { return x.url; }) };
      setById(function (p) {
        const n = Object.assign({}, p);
        n[sid] = (p[sid] || []).concat([mine]);
        return n;
      });
      setDraft('');
      setImgs([]);
      setBusy(true);
      stick.current = true;
      const r = await callApi('ai_send', msg || TX('Xem ảnh này giúp tôi.'),
        pics.map(function (x) { return { media_type: x.media_type, data: x.data }; }), sid);
      if (!r || !r.success) {
        setBusy(false);
        setById(function (p) {
          const n = Object.assign({}, p);
          n[sid] = (p[sid] || []).concat([{ k: 'err', id: 'e' + Date.now(),
                        s: (r && r.error) || TX('Không gửi được.') }]);
          return n;
        });
      }
    }, [draft, busy, imgs, curSid, loadSes]);

    const answer = useCallback(async function (pid, ok) {
      let owner = curSid;
      setById(function (p) {
        const n = Object.assign({}, p);
        Object.keys(p).forEach(function (sid) {
          let hit = false;
          const l = p[sid].map(function (x) {
            if (x.k === 'ask' && x.id === pid) { hit = true; owner = sid;
              return Object.assign({}, x, { answered: true, ok: ok }); }
            return x;
          });
          if (hit) n[sid] = l;
        });
        return n;
      });
      await callApi('ai_approve', pid, ok, null, owner);
    }, [curSid]);

    /* --- ban phim: Esc dong, Enter gui, chan phim tat cua app ben duoi ---
       app.views.jsx:649 bat Ctrl+F o tam window va KHONG kiem tra dang go trong
       o nhap. Neu khong chan tai day, go Ctrl+F trong khung chat se nhay focus
       sang o tim kiem thu vien. --- */
    useEscape(onClose, true);

    function onKeyDown(e) {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        send();
      }
    }

    /* --- o nhap tu cao dan theo noi dung --- */
    useEffect(function () {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 190) + 'px';
    }, [draft]);

    const mode = (st && st.mode) || 'manual';
    const ready = !!(st && st.ready);

    function setMode(m) {
      callApi('ai_config', { mode: m }).then(function (r) { if (r && r.success) setSt(r); });
    }

    function saveCfg(patch) {
      callApi('ai_config', patch).then(function (r) { if (r && r.success) setSt(r); });
    }

    /* Dung onKeyDown (pha noi bot) chu KHONG phai onKeyDownCapture.
       Capture chay TRUOC khi su kien toi o nhap, nen stopPropagation o do se
       chan luon handler Enter cua chinh o nhap -> Enter roi ve hanh vi mac dinh
       la xuong dong. Dat o pha noi bot thi o nhap xu ly xong roi moi chan: vua
       gui duoc tin, vua khong de phim tat cua launcher cuop mat. */
    return (
      <div className={'ag' + (drag ? ' is-drag' : '')}
           onKeyDown={function (e) { e.stopPropagation(); }}
           onDragOver={function (e) { e.preventDefault(); if (!drag) setDrag(true); }}
           onDragLeave={function (e) {
             if (e.currentTarget === e.target) setDrag(false);
           }}
           onDrop={function (e) {
             e.preventDefault();
             setDrag(false);
             addFiles(e.dataTransfer && e.dataTransfer.files);
           }}>
        <div className="ag__glow" aria-hidden="true" />

        {/* ---- thanh tren ---- */}
        <header className="ag__bar">
          <button className={'ag__ib ag__ib--side' + (sideOpen ? ' is-on' : '')}
                  onClick={function () { setSideOpen(!sideOpen); }}
                  title={TX('Danh sách cuộc trò chuyện')}>
            <i className="ph-bold ph-sidebar-simple"></i>
          </button>
          <span className="ag__logo"><i className="ph-fill ph-sparkle"></i></span>
          <div className="ag__id">
            <div className="ag__name">Nexus Agent</div>
            <div className="ag__sub">
              {ready ? ((st && st.model) || '') : TX('Chưa cấu hình khoá API')}
            </div>
          </div>

          <span className="ag__spacer" />

          <button className="ag__ib ag__ib--cfg" onClick={function () { setCfgOpen(!cfgOpen); }}
                  title={TX('Cài đặt')}>
            <i className="ph-fill ph-gear-six"></i>
          </button>
          <button className="ag__ib ag__ib--x" onClick={onClose} title={TX('Đóng')}>
            <i className="ph-bold ph-x"></i>
          </button>
        </header>

        {/* ---- than: danh sach phien ben trai, cuoc tro chuyen ben phai ---- */}
        <div className="ag__mid">
        <SessionList open={sideOpen} list={ses.list} cur={curSid} running={running}
                     onOpen={openSes} onNew={newSes} onDelete={delSes} onRename={renSes} />

        {/* Cot phai gom CA vung cuon LAN o nhap. Neu de o nhap ra ngoai, no se
            can giua toan man hinh con noi dung chat bi thanh ben day sang phai
            -> hai cai lech truc nhau, nhin ra ngay. */}
        <div className="ag__col">
        <div className="ag__body" ref={bodyRef} onScroll={onScroll}>
          <div className={'ag__inner' + (items.length ? '' : ' ag__inner--empty')}>
            {!items.length ? (
              <div className="ag__hi">
                <div className="ag__hi__orb"><i className="ph-fill ph-sparkle"></i></div>
                <h2 className="ag__hi__t">{TX('Tôi giúp được gì cho bạn?')}</h2>
                <p className="ag__hi__d">
                  {TX('Tôi đọc và sửa được file trên máy bạn, chạy lệnh, và tra cứu trên mạng.')}
                </p>
                {!ready ? (
                  <div className="ag__hi__warn">
                    <i className="ph-fill ph-warning-circle"></i>
                    <span>{TX('Chưa có khoá API nên chưa dùng được. Khoá được đọc từ máy bạn, không nằm trên mạng.')}</span>
                  </div>
                ) : (
                  <div className="ag__hi__chips">
                    {GOI_Y.map(function (g, i) {
                      return (
                        <button key={i} className="ag__chip" onClick={function () { send(g.t); }}>
                          <i className={g.i}></i>{TX(g.t)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* Khong gan avatar vao tung tin: bong bong gradient ben phai da du
                de biet dau la loi minh, phan con lai la loi agent. */}
            {items.map(function (it) {
              return <Row key={it.id} it={it} onAnswer={answer} />;
            })}

            {busy ? (
              <div className="ag__row ag__row--sub">
                <div className="ag__wait"><span className="nx-spin" />{TX('Đang làm...')}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ---- o nhap ---- */}
        <footer className="ag__foot">
          {imgs.length ? (
            <div className="ag__att">
              {imgs.map(function (im) {
                return (
                  <div key={im.id} className="ag__att__i">
                    <img src={im.url} alt="" />
                    <button title={TX('Bỏ ảnh này')} onClick={function () {
                      setImgs(function (p) { return p.filter(function (x) { return x.id !== im.id; }); });
                    }}><i className="ph-bold ph-x"></i></button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className={'ag__in' + (busy ? ' is-busy' : '')}>
            <button className="ag__clip" disabled={!ready} title={TX('Đính kèm ảnh')}
                    onClick={function () { if (fileRef.current) fileRef.current.click(); }}>
              <i className="ph-bold ph-plus"></i>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple
                   style={{ display: 'none' }}
                   onChange={function (e) { addFiles(e.target.files); e.target.value = ''; }} />

            <textarea
              ref={taRef}
              className="ag__ta"
              rows={1}
              value={draft}
              disabled={!ready}
              placeholder={ready ? TX('Nhắn gì đó... (Enter để gửi, Shift+Enter xuống dòng, dán ảnh bằng Ctrl+V)')
                                 : TX('Chưa cấu hình khoá API')}
              onChange={function (e) { setDraft(e.target.value); }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
            />
            {busy ? (
              <button className="ag__send ag__send--stop"
                      onClick={function () { callApi('ai_stop', curSid); }}
                      title={TX('Dừng')}>
                <i className="ph-fill ph-stop"></i>
              </button>
            ) : (
              <button className="ag__send" disabled={(!draft.trim() && !imgs.length) || !ready}
                      onClick={function () { send(); }} title={TX('Gửi')}>
                <i className="ph-fill ph-paper-plane-right"></i>
              </button>
            )}
          </div>
          {/* Thanh duoi: ben trai la che do quyen, ben phai la model + muc suy nghi.
              Bo cuc nay hoc theo Claude App — moi thu dieu khien cuoc tro chuyen
              deu nam ngay canh o nhap, khong phai lan len thanh tren tim. */}
          <div className="ag__bot">
            <button className={'ag__perm' + (mode === 'bypass' ? ' is-free' : '')}
                    onClick={function () { setMode(mode === 'bypass' ? 'manual' : 'bypass'); }}
                    title={mode === 'bypass'
                      ? TX('Đang tự do. Bấm để chuyển sang cần duyệt.')
                      : TX('Đang cần duyệt. Bấm để chuyển sang tự do.')}>
              <i className={mode === 'bypass' ? 'ph-fill ph-lightning' : 'ph-fill ph-shield-check'}></i>
              {mode === 'bypass' ? TX('Tự do') : TX('Cần duyệt')}
            </button>

            <span className="ag__bot__sp" />

            <ModelPicker st={st} onPick={saveCfg} />
            <EffortPicker st={st} onPick={saveCfg} />
          </div>
        </footer>
        </div>
        </div>

        {cfgOpen ? <Settings st={st} onClose={function () { setCfgOpen(false); }} onSave={saveCfg} /> : null}
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     6. LOP BOC — dung portal ra thang body

     Ly do phai portal: panel dung position: fixed. Bat ky to tien nao mang
     transform/filter/perspective (ke ca ma tran don vi tu animation-fill-mode)
     deu tao containing block moi, lam fixed neo sai cho. Dua thang ra body la
     cach chac chan nhat — dung dung pattern cua ZoomView o app.detail.jsx:1692.
     ------------------------------------------------------------------------ */

  function AgentOverlay({ open, onClose }) {
    /* Khoi tao THEO che do giam chuyen dong.

       May nguoi dung luon bat giam chuyen dong, va voi che do do thi dung nhat
       la panel hien ra ngay lap tuc — khong hieu ung, khong cho nhip nao. Lam
       vay cung go bo hoan toan rui ro treo o man hinh trang: neu khoi tao false
       roi doi timer bat len, ma trinh duyet hoan timer (no hoan ca rAF lan
       setTimeout khi cua so khong duoc chu y), thi panel ket o opacity 0.
       Loi nay da xay ra that khi do runtime, hai lan lien. */
    const [shown, setShown] = useState(function () {
      try { return prefersCalm(); } catch (e) { return false; }
    });

    /* Mo: gan node truoc, bat class o nhip sau -> transition co cai de chay.

       Dung CA requestAnimationFrame LAN setTimeout, khong dung rieng rAF.
       Ly do: trinh duyet hoan rAF khi cua so khong duoc chu y. Neu chi dua vao
       rAF thi co luc class 'is-in' khong bao gio duoc bat, panel ket o
       opacity:0 va nguoi dung nhin thay man hinh trang tron. Loi nay da xay ra
       that khi do runtime: panel do duoc 1576x926 = dung 1600x940 nhan 0.985,
       tuc van dang o trang thai chua mo. setTimeout la duong cuu. */
    useEffect(function () {
      let calm = false;
      try { calm = prefersCalm(); } catch (e) { /* bo qua */ }
      if (!open) { setShown(calm); return; }
      if (calm) { setShown(true); return; }        // hien ngay, khong doi nhip nao
      const raf = requestAnimationFrame(function () { setShown(true); });
      const tm = setTimeout(function () { setShown(true); }, 110);
      return function () { cancelAnimationFrame(raf); clearTimeout(tm); };
    }, [open]);

    // Khoa cuon nen. Body da overflow:hidden san (base.css:17) nen phai khoa
    // .nx-scroll — day moi la vung cuon that cua app.
    useEffect(function () {
      if (!open) return;
      const sc = document.querySelector('.nx-scroll');
      const old = sc ? sc.style.overflow : '';
      if (sc) sc.style.overflow = 'hidden';
      return function () { if (sc) sc.style.overflow = old; };
    }, [open]);

    if (!open) return null;
    return ReactDOM.createPortal(
      <div className={'ag-wrap' + (shown ? ' is-in' : '')}>
        <AgentPanel onClose={onClose} />
      </div>,
      document.body
    );
  }

  /* Nut mo tren thanh tren. Khong co pywebview (mo bang trinh duyet thuong)
     thi an han di — bam cung khong lam duoc gi. */
  function AgentButton({ open, onToggle }) {
    if (!window.pywebview) return null;
    return (
      <button className={'nx-icobtn ag-btn' + (open ? ' is-on' : '')}
              onClick={onToggle} title="Nexus Agent">
        <i className="ph-fill ph-sparkle"></i>
      </button>
    );
  }

  Object.assign(window.NX, { AgentOverlay, AgentButton, AgentPanel });
})();
