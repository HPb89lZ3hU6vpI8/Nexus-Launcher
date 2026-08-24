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
    const nodes = useMemo(function () {
      const src = String(text || '');
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
    }, [text]);
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
    /* Ba o ket noi. Bat buoc phai sua duoc ngay tai day: khi may chu chet, thong
       bao loi bao "mo Cai dat de doi dia chi" — neu cho nay chi hien thi thi loi
       khuyen do dan nguoi dung vao ngo cut. */
    const [url, setUrl] = useState((st && st.base_url) || '');
    const [model, setModel] = useState((st && st.model) || '');
    const [key, setKey] = useState('');
    const [saved, setSaved] = useState(false);
    const toast = useToast();

    function saveConn() {
      const patch = { base_url: url.trim(), model: model.trim() };
      if (key.trim()) patch.api_key = key.trim();   // bo trong = giu khoa cu
      onSave(patch);
      setKey('');
      setSaved(true);
      setTimeout(function () { setSaved(false); }, 1800);
      toast.push({ tone: 'ok', title: TX('Đã lưu kết nối') });
    }

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

          <div className="ag-cfg__sep">{TX('Kết nối')}</div>

          <div className="ag-cfg__row">
            <div className="ag-cfg__lb">{TX('Địa chỉ máy chủ')}</div>
            <div className="ag-cfg__hint">
              {TX('Mặc định lấy từ file nexus_agent.py trên máy bạn. Chỉ sửa ở đây khi muốn đổi tạm.')}
            </div>
            <input className="ag-in ag-in--w" value={url} spellCheck={false}
                   placeholder="https://..."
                   onChange={function (e) { setUrl(e.target.value); }} />
          </div>

          <div className="ag-cfg__row">
            <div className="ag-cfg__lb">{TX('Mô hình')}</div>
            <input className="ag-in ag-in--w" value={model} spellCheck={false}
                   placeholder="claude-opus-5"
                   onChange={function (e) { setModel(e.target.value); }} />
          </div>

          <div className="ag-cfg__row">
            <div className="ag-cfg__lb">{TX('Khoá API')}</div>
            <div className="ag-cfg__hint">
              {st && st.has_key
                ? TX('Đã có khoá sẵn trong nexus_agent.py. Để trống nếu không muốn đổi.')
                : TX('Chưa có khoá. Khoá chỉ nằm trên máy bạn, không bao giờ lên mạng.')}
            </div>
            <input className="ag-in ag-in--w" type="password" value={key} spellCheck={false}
                   placeholder={st && st.has_key ? '••••••••••••' : TX('Dán khoá vào đây')}
                   onChange={function (e) { setKey(e.target.value); }} />
          </div>

          <button className="nx-btn nx-btn--primary nx-btn--sm nx-btn--full" onClick={saveConn}>
            <i className={saved ? 'ph-bold ph-check' : 'ph-bold ph-floppy-disk'}></i>
            {saved ? TX('Đã lưu') : TX('Lưu kết nối')}
          </button>

          <div className="ag-cfg__info">
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
        <button className={'ag-pk__b' + (open ? ' is-on' : '')}
                onClick={function () { setOpen(!open); }}>
          <span>{cur.ten}</span>
          {cur.ctx1m ? <b className="ag-pk__1m">1M</b> : null}
          <i className="ph-bold ph-caret-up"></i>
        </button>
        {open ? (
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
    const [items, setItems] = useState([]);        // dong thoi gian hien thi
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState('');
    const [st, setSt] = useState(null);
    const [cfgOpen, setCfgOpen] = useState(false);
    const bodyRef = useRef(null);
    const taRef = useRef(null);
    const stick = useRef(true);

    /* --- nap trang thai tu Python --- */
    const refresh = useCallback(async function () {
      const r = await callApi('ai_state');
      if (r && r.success) setSt(r);
      else setSt({ success: false, error: (r && r.error) || '' });
    }, []);

    useEffect(function () { refresh(); }, [refresh]);

    /* --- nhan su kien Python day len ---
       Python goi window.__nxAgentPush(danhSachSuKien) theo tung dot ~50ms. */
    useEffect(function () {
      window.__nxAgentPush = function (batch) {
        if (!batch || !batch.length) return;
        setItems(function (prev) {
          const list = prev.slice();

          function lastOf(kind) {
            for (let i = list.length - 1; i >= 0; i--) if (list[i].k === kind) return list[i];
            return null;
          }

          batch.forEach(function (ev) {
            const t = ev.t;
            if (t === 'text') {
              const last = list.length ? list[list.length - 1] : null;
              if (last && last.k === 'text') last.s = (last.s || '') + (ev.s || '');
              else list.push({ k: 'text', s: ev.s || '', id: 'x' + list.length + '_' + Date.now() });
            } else if (t === 'think') {
              const last = list.length ? list[list.length - 1] : null;
              if (last && last.k === 'think') last.s = (last.s || '') + (ev.s || '');
              else list.push({ k: 'think', s: ev.s || '', id: 'k' + list.length + '_' + Date.now() });
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
                          args: ev.args, preview: ev.preview, answered: false });
            } else if (t === 'error') {
              list.push({ k: 'err', id: 'e' + Date.now(), s: ev.msg || '' });
              setBusy(false);
            } else if (t === 'stopped') {
              list.push({ k: 'note', id: 'n' + Date.now(), s: TX('Đã dừng theo yêu cầu của bạn.') });
              setBusy(false);
            } else if (t === 'done') {
              setBusy(false);
            }
          });
          return list;
        });
      };
      return function () { window.__nxAgentPush = null; };
    }, []);

    /* --- xoa lich su khi bam "cuoc tro chuyen moi" --- */
    useEffect(function () {
      function clear() { setItems([]); }
      window.addEventListener('nx-agent-cleared', clear);
      return function () { window.removeEventListener('nx-agent-cleared', clear); };
    }, []);

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

    /* --- gui tin nhan --- */
    const send = useCallback(async function (text) {
      const msg = String(text == null ? draft : text).trim();
      if (!msg || busy) return;
      setItems(function (p) { return p.concat([{ k: 'me', id: 'm' + Date.now(), s: msg }]); });
      setDraft('');
      setBusy(true);
      stick.current = true;
      const r = await callApi('ai_send', msg);
      if (!r || !r.success) {
        setBusy(false);
        setItems(function (p) {
          return p.concat([{ k: 'err', id: 'e' + Date.now(),
                             s: (r && r.error) || TX('Không gửi được.') }]);
        });
      }
    }, [draft, busy]);

    const answer = useCallback(async function (pid, ok) {
      setItems(function (p) {
        return p.map(function (x) {
          return (x.k === 'ask' && x.id === pid) ? Object.assign({}, x, { answered: true, ok: ok }) : x;
        });
      });
      await callApi('ai_approve', pid, ok);
    }, []);

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

    return (
      <div className="ag" onKeyDownCapture={function (e) { e.stopPropagation(); }}>
        <div className="ag__glow" aria-hidden="true" />

        {/* ---- thanh tren ---- */}
        <header className="ag__bar">
          <span className="ag__logo"><i className="ph-fill ph-sparkle"></i></span>
          <div className="ag__id">
            <div className="ag__name">Nexus Agent</div>
            <div className="ag__sub">
              {ready ? ((st && st.model) || '') : TX('Chưa cấu hình khoá API')}
            </div>
          </div>

          <span className="ag__spacer" />

          <button className="ag__ib" onClick={function () { setCfgOpen(!cfgOpen); }} title={TX('Cài đặt')}>
            <i className="ph-fill ph-gear-six"></i>
          </button>
          <button className="ag__ib ag__ib--x" onClick={onClose} title={TX('Đóng')}>
            <i className="ph-bold ph-x"></i>
          </button>
        </header>

        {/* ---- than ---- */}
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

            {items.map(function (it) {
              if (it.k === 'me') {
                return (
                  <div key={it.id} className="ag__row ag__row--me">
                    <div className="ag__me">{it.s}</div>
                  </div>
                );
              }
              if (it.k === 'text') {
                return (
                  <div key={it.id} className="ag__row">
                    <span className="ag__av"><i className="ph-fill ph-sparkle"></i></span>
                    <div className="ag__ai"><Markdown text={it.s} /></div>
                  </div>
                );
              }
              if (it.k === 'think') {
                return <div key={it.id} className="ag__row ag__row--sub"><ThinkBlock text={it.s} /></div>;
              }
              if (it.k === 'tool') {
                return <div key={it.id} className="ag__row ag__row--sub"><ToolCard item={it} /></div>;
              }
              if (it.k === 'ask') {
                return <div key={it.id} className="ag__row ag__row--sub"><AskCard item={it} onAnswer={answer} /></div>;
              }
              if (it.k === 'err') {
                return (
                  <div key={it.id} className="ag__row ag__row--sub">
                    <div className="ag__err">
                      <i className="ph-fill ph-warning-octagon"></i>
                      <div>{it.s}</div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={it.id} className="ag__row ag__row--sub">
                  <div className="ag__note">{it.s}</div>
                </div>
              );
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
          <div className={'ag__in' + (busy ? ' is-busy' : '')}>
            <textarea
              ref={taRef}
              className="ag__ta"
              rows={1}
              value={draft}
              disabled={!ready}
              placeholder={ready ? TX('Nhắn gì đó cho agent... (Enter để gửi, Shift+Enter xuống dòng)')
                                 : TX('Chưa cấu hình khoá API')}
              onChange={function (e) { setDraft(e.target.value); }}
              onKeyDown={onKeyDown}
            />
            {busy ? (
              <button className="ag__send ag__send--stop" onClick={function () { callApi('ai_stop'); }}
                      title={TX('Dừng')}>
                <i className="ph-fill ph-stop"></i>
              </button>
            ) : (
              <button className="ag__send" disabled={!draft.trim() || !ready}
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
