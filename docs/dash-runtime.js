/* Minimal stand-in for the claude.ai dashboard runtime, so the page's own scripts
   run unchanged as a static site. Data come from the JSON files beside this page;
   the two live sources (PubMed, SciSpace) are replayed from dated snapshots. */
(function () {
  const SOURCES = window.DASH_SOURCES || {};
  const store = {};        // id -> {status, data, columns, meta, message, truncated}
  const loaders = {}, calcs = {}, draws = {}, onDataFns = [];
  let params = Object.assign({}, window.DASH_PARAMS || {});
  let scheduled = false;

  const empty = (status, message) => ({ status, data: [], columns: [], meta: [], message: message || '', refreshing: false, truncated: false });
  const colsOf = (rows) => (Array.isArray(rows) && rows.length && typeof rows[0] === 'object' ? Object.keys(rows[0]) : []);
  const fetchJSON = (u) => fetch(u, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); });

  function normalise(out) {
    if (Array.isArray(out)) return { data: out, columns: colsOf(out), meta: [], truncated: false };
    if (out && Array.isArray(out.rows)) return { data: out.rows, columns: out.columns || colsOf(out.rows), meta: out.meta || [], truncated: !!out.truncated };
    if (out && 'data' in out) return { data: out.data, columns: out.columns || colsOf(out.data), meta: out.meta || [], truncated: !!out.truncated };
    return { data: out, columns: [], meta: [], truncated: false };
  }

  async function load(id) {
    const src = SOURCES[id];
    try {
      let answer, call = () => Promise.reject(new Error('No recorded answer'));
      if (src.file) answer = await fetchJSON(src.file);
      else {
        answer = await fetchJSON(src.answer);
        const rec = src.calls || {};
        call = (tool) => (rec[tool] ? fetchJSON(rec[tool]) : Promise.reject(new Error('No recorded answer for ' + tool)));
      }
      const l = loaders[id];
      const out = l ? await l.fn({ answer, items: [answer], call, args: src.args || {}, read: {} }) : answer;
      store[id] = Object.assign({ status: 'ok', message: '', refreshing: false }, normalise(out));
    } catch (e) {
      console.error(e);
      store[id] = empty('error', String(e && e.message || e));
    }
    schedule();
  }

  function calcValue(id) {
    const c = calcs[id];
    const ins = [];
    for (const i of c.inputs) {
      const d = data(i);
      if (d.status !== 'ok') return Object.assign(empty(d.status === 'error' ? 'error' : 'loading'), { data: null });
      ins.push(calcs[i] ? d.data : (Array.isArray(d.data) ? d.data : []));
    }
    try {
      const v = c.fn(...ins);
      return { status: 'ok', data: v, columns: colsOf(v), meta: [], message: '', refreshing: false, truncated: false };
    } catch (e) { console.error(e); return Object.assign(empty('error', String(e.message || e)), { data: null }); }
  }

  function data(id) {
    if (calcs[id]) return calcValue(id);
    if (store[id]) return store[id];
    if (SOURCES[id]) return empty('loading');
    return empty('missing');
  }

  function runDraw(name, el) {
    const d = draws[name];
    try {
      if (typeof d === 'function') d(el);
      else {
        if (!el.__dashMade) { el.replaceChildren(); el.__dashMade = { v: d.mount ? d.mount(el) : undefined }; }
        if (d.update) d.update(el, el.__dashMade.v);
      }
    } catch (e) { console.error('draw ' + name, e); }
  }

  function render() {
    scheduled = false;
    onDataFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    Object.keys(draws).forEach((name) => document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      if (el.closest('[hidden]')) return;
      runDraw(name, el);
    }));
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(render); } }


  // Downloads: the static site saves files straight through the browser.
  if (!window.claude) {
    window.claude = { use: async (name) => (name !== 'downloads' ? null : {
      save: async ({ filename, data }) => {
        const blob = data instanceof Blob ? data : new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return { status: 'saved' };
      }
    }) };
  }
  window.dash = {
    data,
    onData(fn) { onDataFns.push(fn); try { fn(); } catch (e) { console.error(e); } },
    calc(id, spec) { calcs[id] = spec; },
    loader(id, spec) { loaders[id] = spec; },
    draw(name, fn) { if (fn === undefined) { document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => runDraw(name, el)); return; } draws[name] = fn; },
    params() { return Object.assign({}, params); },
    setParams(p) { for (const [k, v] of Object.entries(p)) { if (v == null) delete params[k]; else params[k] = v; } schedule(); },
    resetParams() { params = Object.assign({}, window.DASH_PARAMS || {}); schedule(); },
    refresh() {},
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } },
    colors: ['var(--dash-c0)', 'var(--dash-c1)', 'var(--dash-c2)', 'var(--dash-c3)', 'var(--dash-c4)']
  };

  // hidden sections: draw when they are revealed
  new MutationObserver(schedule).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  let lastW = 0;
  window.addEventListener('resize', () => { const w = window.innerWidth; if (w !== lastW) { lastW = w; schedule(); } });

  document.addEventListener('DOMContentLoaded', () => {
    Object.keys(SOURCES).forEach(load);
    schedule();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 300); }
  });
})();
