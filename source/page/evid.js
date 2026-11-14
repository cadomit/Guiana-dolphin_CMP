const { h, gate, ok, fill, badge, prio, more, fmt } = GD;
const pct = d3.format('.0%');
const LINES = { RES: 'Research', MON: 'Monitoring', MIT: 'Mitigation', PACB: 'Public awareness and capacity building' };

/* ---- Evidence counts per CMP action and per PAN objective ---- */
dash.calc('evid_cmp', {
  inputs: ['evidence_counts', 'actions'],
  title: 'Records per CMP action (PubMed, OpenAlex and SciSpace)',
  description: 'Joins each CMP action to the number of distinct records matching its topic: those returned by PubMed, those added from OpenAlex, those added from SciSpace, and their sum, which is also expressed as a share of all records naming the species.',
  fn: (ev, actions) => {
    const base = (ev.find((r) => r.framework === 'Baseline') || {}).count;
    return actions.map((a) => {
      const e = ev.find((r) => r.id === a.id) || {};
      const n = e.count == null ? null : Number(e.count);
      return { id: a.id, line: a.line, priority: a.priority, label: e.label || a.title, count: n, count_pubmed: e.count_pubmed == null ? null : Number(e.count_pubmed), count_oa: e.count_oa == null ? null : Number(e.count_oa), count_sci: e.count_sci == null ? null : Number(e.count_sci), measurable: e.measurable || 'No', share: n != null && base ? n / base : null, note: e.note || '', shared_with: e.shared_with || '', query: e.query || '' };
    });
  }
});
dash.calc('evid_pan', {
  inputs: ['evidence_counts'],
  title: 'Records per PAN objective (PubMed, OpenAlex and SciSpace)',
  description: 'Number of distinct records matching the topic of each objective of the Brazilian national action plan for marine cetaceans, split between PubMed and the OpenAlex and SciSpace records added to it, with the share of all records naming the species.',
  fn: (ev) => {
    const base = (ev.find((r) => r.framework === 'Baseline') || {}).count;
    return ev.filter((r) => r.framework === 'PAN objective').map((r) => ({ id: r.id, label: r.label, official_pt: r.official_pt, count: Number(r.count), count_pubmed: Number(r.count_pubmed), count_oa: Number(r.count_oa), count_sci: Number(r.count_sci || 0), share: base ? Number(r.count) / base : null, note: r.note, shared_with: r.shared_with, query: r.query }));
  }
});
dash.calc('evid_stats', {
  inputs: ['evidence_counts', 'actions'],
  title: 'Evidence indicators',
  description: 'Baseline count, number of CMP actions that can be matched to a literature count, and how many Very High priority actions have fewer records than the threshold.',
  fn: (ev, actions) => {
    const thr = 10;
    const cnt = (a) => { const e = ev.find((r) => r.id === a.id); return e && e.count != null ? Number(e.count) : null; };
    const meas = actions.filter((a) => cnt(a) != null);
    const vh = meas.filter((a) => a.priority === 'Very High');
    const low = vh.filter((a) => cnt(a) < thr);
    const cntp = (a) => { const e = ev.find((r) => r.id === a.id); return e && e.count_pubmed != null ? Number(e.count_pubmed) : null; };
    const lowpm = vh.filter((a) => cntp(a) != null && cntp(a) < thr);
    const lo = meas.slice().sort((a, b) => cnt(a) - cnt(b))[0], hi = meas.slice().sort((a, b) => cnt(b) - cnt(a))[0];
    return [{
      baseline: (ev.find((r) => r.framework === 'Baseline') || {}).count, retrieved: (ev.find((r) => r.framework === 'Baseline') || {}).retrieved,
      base_pm: (ev.find((r) => r.framework === 'Baseline') || {}).count_pubmed, base_oa: (ev.find((r) => r.framework === 'Baseline') || {}).count_oa, base_sci: (ev.find((r) => r.framework === 'Baseline') || {}).count_sci, n_vh_low_pm: lowpm.length,
      n_actions: actions.length, n_meas: meas.length, n_vh_meas: vh.length, n_vh_low: low.length, thr, low_ids: low.map((a) => a.id).join(', ') || 'none',
      lo_id: lo.id, lo_n: cnt(lo), hi_id: hi.id, hi_n: cnt(hi)
    }];
  }
});

/* ---- CMS and IWC instruments ---- */
dash.calc('instr_by', {
  inputs: ['intl_instruments'],
  title: 'Instruments by theme and body',
  description: 'Number of listed CMS and IWC instruments in each threat theme.',
  fn: (rows) => {
    const themes = [...new Set(rows.map((r) => r.theme))];
    themes.sort((a, b) => rows.filter((r) => r.theme === b).length - rows.filter((r) => r.theme === a).length);
    const out = [];
    themes.forEach((t) => ['CMS', 'IWC'].forEach((b) => { const n = rows.filter((r) => r.theme === t && r.body === b).length; if (n) out.push({ theme: t, body: b, n }); }));
    return out;
  }
});
dash.calc('instr_stats', {
  inputs: ['intl_instruments'],
  title: 'Instrument indicators',
  description: 'Number of listed instruments, of those that name the species, and of those whose full text has not been reviewed.',
  fn: (rows) => [{
    n: rows.length, n_cms: rows.filter((r) => r.body === 'CMS').length, n_iwc: rows.filter((r) => r.body === 'IWC').length,
    n_named: rows.filter((r) => /^yes/i.test(r.species_named)).length,
    n_themes: new Set(rows.map((r) => r.theme)).size
  }]
});
[
  ['evid_stats', { e_base: (r) => fmt(r.baseline), e_basepm: (r) => fmt(r.base_pm), e_baseoa: (r) => fmt(r.base_oa), e_basesci: (r) => fmt(r.base_sci), e_vhlowpm: (r) => r.n_vh_low_pm, e_retr: (r) => r.retrieved, e_nmeas: (r) => r.n_meas, e_nact: (r) => r.n_actions, e_vhlow: (r) => r.n_vh_low, e_vhmeas: (r) => r.n_vh_meas, e_thr: (r) => r.thr, e_lowids: (r) => r.low_ids, e_loid: (r) => r.lo_id, e_lon: (r) => r.lo_n, e_hiid: (r) => r.hi_id, e_hin: (r) => r.hi_n }],
  ['instr_stats', { x_n: (r) => r.n, x_cms: (r) => r.n_cms, x_iwc: (r) => r.n_iwc, x_named: (r) => r.n_named, x_themes: (r) => r.n_themes }]
].forEach(([id, map]) => Object.entries(map).forEach(([name, f]) => dash.draw(name, (el) => {
  const d = dash.data(id);
  el.textContent = d.status === 'ok' && d.data && d.data[0] ? String(f(d.data[0])) : '—';
})));

/* ---- Horizontal bars of record counts ---- */
function evBars(el, rows, o) {
  el.replaceChildren();
  if (!rows.length) { el.append(h('p', { class: 'gd-note', text: 'No records match the current selection.' })); return; }
  if (o.legend) el.append(h('div', { class: 'gd-legend' }, o.legend.map((i) => h('span', null, h('i', { class: 'gd-sw ' + i.cls }), i.label))));
  const W = Math.max(280, el.clientWidth), narrow = W < 520, rowH = 26, top = 4, H = top + rows.length * rowH + 26;
  const labW = Math.round(W * (narrow ? 0.5 : 0.4)), chars = Math.max(8, Math.floor((labW - 6) / 6.3));
  const maxN = d3.max(rows, (r) => r.count || 0) || 1;
  const x = d3.scaleLinear().domain([0, maxN]).nice().range([labW, W - 44]);
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('aria-label', o.aria);
  const ticks = x.ticks(Math.min(6, Math.max(2, Math.floor((W - labW) / 80)))).filter(Number.isInteger);
  svg.append('g').attr('class', 'gd-grid').selectAll('line').data(ticks).join('line').attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top).attr('y2', H - 22);
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', (d) => x(d)).attr('y', H - 7).attr('text-anchor', 'middle').text((d) => d);
  const cut = (s) => (s.length > chars ? s.slice(0, chars - 1).trimEnd() + '…' : s);
  rows.forEach((r, i) => {
    const yy = top + i * rowH;
    svg.append('text').attr('class', 'gd-lbl').attr('x', 0).attr('y', yy + rowH / 2 + 4).text(cut(r.id + ' · ' + r.label));
    if (r.count == null) svg.append('text').attr('class', 'gd-gap').attr('x', labW + 6).attr('y', yy + rowH / 2 + 4).text('not measured by a literature count');
    else {
      const pm = Math.min(r.count, r.count_pubmed || 0), oa = Math.min(r.count - pm, r.count_oa || 0), xp = x(pm), xo = x(pm + oa);
      if (pm > 0) svg.append('rect').attr('class', 'gd-seg s3').attr('x', labW).attr('y', yy + 5).attr('width', Math.max(2, xp - labW - (r.count > pm ? 2 : 0))).attr('height', rowH - 10).attr('rx', 3);
      if (oa > 0) svg.append('rect').attr('class', 'gd-seg s2').attr('x', xp).attr('y', yy + 5).attr('width', Math.max(2, xo - xp - (r.count > pm + oa ? 2 : 0))).attr('height', rowH - 10).attr('rx', 3);
      if (r.count > pm + oa) svg.append('rect').attr('class', 'gd-seg s1').attr('x', xo).attr('y', yy + 5).attr('width', Math.max(2, x(r.count) - xo)).attr('height', rowH - 10).attr('rx', 3);
      if (r.count === 0) svg.append('rect').attr('class', 'gd-seg s1').attr('x', labW).attr('y', yy + 5).attr('width', 2).attr('height', rowH - 10).attr('rx', 1);
      svg.append('text').attr('x', x(r.count) + 6).attr('y', yy + rowH / 2 + 4).text(r.count);
    }
  });
  const tip = GD.tip(el);
  svg.append('g').selectAll('rect').data(rows).join('rect').attr('class', 'gd-hit').attr('x', 0).attr('width', W).attr('y', (d, i) => top + i * rowH).attr('height', rowH)
    .on('pointermove pointerdown', (ev, d) => tip.show(ev, d.id + ' · ' + d.label, o.detail(d))).on('pointerleave', () => tip.hide());
}
const cmpRows = (rows) => { const p = dash.params(); return rows.filter((r) => (!p.e_line || r.line === p.e_line) && (!p.e_prio || r.priority === p.e_prio)); };
const LEG = [{ cls: 's3', label: 'PubMed' }, { cls: 's2', label: 'Added from OpenAlex (not already in PubMed)' }, { cls: 's1', label: 'Added from SciSpace (in neither)' }];
const detailOf = (r) => [r.count == null ? 'No count (governance action)' : r.count + ' distinct records: ' + r.count_pubmed + ' in PubMed, ' + r.count_oa + ' added from OpenAlex, ' + (r.count_sci || 0) + ' added from SciSpace' + (r.share != null ? ' (' + pct(r.share) + ' of all records naming the species)' : ''), r.priority ? 'Priority: ' + r.priority : '', r.shared_with ? 'Same literature stream as ' + r.shared_with : ''].filter(Boolean);

dash.draw('chart_evid_cmp', (el) => {
  const g = gate(el, 'evid_cmp'); if (!g) return;
  evBars(el, cmpRows(g[0]), {
    legend: LEG,
    aria: 'Stacked bar chart: number of distinct records naming the Guiana dolphin that match the topic of each action of the CMP, split between PubMed records and records added from OpenAlex and SciSpace.',
    detail: detailOf
  });
});
dash.draw('chart_evid_pan', (el) => {
  const g = gate(el, 'evid_pan'); if (!g) return;
  evBars(el, g[0], { legend: LEG, aria: 'Stacked bar chart: number of distinct records naming the Guiana dolphin that match the topic of each specific objective of the Brazilian national action plan for marine cetaceans, split between PubMed records and records added from OpenAlex and SciSpace.', detail: (r) => detailOf(r).concat(r.official_pt ? [r.official_pt] : []) });
});

GD.select('f_e_line', 'e_line', 'All strategic lines', 'actions', (r) => [...new Set(r.map((a) => a.line))].map((l) => ({ value: l, label: LINES[l] || l })));
GD.select('f_e_prio', 'e_prio', 'All priorities', 'actions', () => ['Very High', 'High', 'Medium']);

dash.draw('evid_body', (tb) => {
  const g = gate(tb, 'evid_cmp'); if (!g) return;
  fill(tb, cmpRows(g[0]), [
    { cls: 'nw', f: (r) => r.id }, { f: (r) => prio(r.priority) },
    { cls: 'wide', f: (r) => h('span', null, r.label, more('Search query', r.query), r.note ? h('div', { class: 'gd-note', text: r.note }) : null) },
    { cls: 'num', f: (r) => (r.count == null ? '' : String(r.count_pubmed)) },
    { cls: 'num', f: (r) => (r.count == null ? '' : String(r.count_oa)) },
    { cls: 'num', f: (r) => (r.count == null ? '' : String(r.count_sci || 0)) },
    { cls: 'num', f: (r) => (r.count == null ? badge('Not measured', '') : h('b', { text: String(r.count) })) },
    { cls: 'num', f: (r) => (r.share == null ? '' : pct(r.share)) }
  ]);
});
dash.draw('pan_body', (tb) => {
  const g = gate(tb, 'evid_pan'); if (!g) return;
  fill(tb, g[0], [
    { cls: 'nw', f: (r) => r.id },
    { cls: 'wide', f: (r) => h('span', null, r.label, r.official_pt ? h('div', { class: 'gd-note', lang: 'pt', text: r.official_pt }) : null) },
    { cls: 'wide', f: (r) => h('span', null, more('Search query', r.query), r.note ? h('div', { class: 'gd-note', text: r.note }) : null) },
    { cls: 'num', f: (r) => String(r.count_pubmed) }, { cls: 'num', f: (r) => String(r.count_oa) }, { cls: 'num', f: (r) => String(r.count_sci || 0) }, { cls: 'num', f: (r) => h('b', { text: String(r.count) }) },
    { cls: 'num', f: (r) => (r.share == null ? '' : pct(r.share)) }
  ]);
});

/* ---- OpenAlex records added to the PubMed counts ---- */
const topicIds = (ev) => { const m = new Map(); ev.forEach((r) => { if (r.query_key && r.query_key !== 'baseline') { const a = m.get(r.query_key) || []; a.push(r.id); m.set(r.query_key, a); } }); return m; };
GD.select('f_o_topic', 'o_topic', 'All topics', 'evidence_counts', (ev) => { const m = topicIds(ev); return [...m].map(([k, ids]) => ({ value: k, label: ids.join(', ') + ' · ' + ev.find((r) => r.query_key === k).label })); });
const oaRows = (rows) => {
  const p = dash.params(), q = String(p.o_q || '').toLowerCase();
  return rows.filter((r) => (!p.o_topic || String(r.topics).split(';').includes(p.o_topic)) && (!q || (r.title + ' ' + r.year).toLowerCase().includes(q)));
};
dash.draw('oa_body', (tb) => {
  const g = gate(tb, 'oa_records', 'evidence_counts'); if (!g) return;
  const m = topicIds(g[1]);
  fill(tb, oaRows(g[0]), [
    { cls: 'nw', f: (r) => String(r.year) },
    { cls: 'wide', f: (r) => (r.doi ? h('a', { class: 'gd-link', href: r.doi, target: '_blank', rel: 'noopener noreferrer', text: r.title }) : r.title) },
    { cls: 'wide', f: (r) => { const ids = [...new Set(String(r.topics).split(';').filter(Boolean).flatMap((k) => m.get(k) || []))]; return ids.length ? ids.join(', ') : badge('No topic matched', ''); } },
    { cls: 'nw', f: (r) => r.source || 'OpenAlex' },
    { cls: 'nw', f: (r) => ({ title: 'Title', abstract: 'Abstract', 'title+abstract': 'Title and abstract' }[r.matched_by] || '') },
    { cls: 'nw', f: (r) => r.openalex_id }
  ]);
});
dash.draw('oa_count', (el) => {
  const g = gate(el, 'oa_records'); if (!g) return;
  el.textContent = 'Showing ' + oaRows(g[0]).length + ' of ' + g[0].length + ' records';
});

/* ---- Instruments ---- */
dash.draw('chart_instr', (el) => {
  const g = gate(el, 'instr_by'); if (!g) return;
  GD.hstack(el, {
    rows: g[0], catKey: 'theme', serKey: 'body', unit: 'instruments',
    sers: [{ key: 'CMS', cls: 's3' }, { key: 'IWC', cls: 's1' }],
    aria: 'Stacked bar chart: number of listed CMS and IWC instruments in each threat theme.'
  });
});
GD.select('f_x_body', 'x_body', 'All bodies', 'intl_instruments', () => ['CMS', 'IWC']);
GD.select('f_x_theme', 'x_theme', 'All themes', 'intl_instruments', (r) => [...new Set(r.map((a) => a.theme))]);
dash.draw('instr_body', (tb) => {
  const g = gate(tb, 'intl_instruments'); if (!g) return;
  const p = dash.params();
  const rows = g[0].filter((r) => (!p.x_body || r.body === p.x_body) && (!p.x_theme || r.theme === p.x_theme));
  fill(tb, rows, [
    { cls: 'nw', f: (r) => badge(r.body, r.body === 'CMS' ? 'md' : '') }, { cls: 'nw', f: (r) => r.ref },
    { cls: 'wide', f: (r) => h('span', null, r.title, more('Verification', r.verification)) },
    { cls: 'nw', f: (r) => r.adopted }, { f: (r) => r.theme }, { f: (r) => r.species_named }, { f: (r) => r.cmp_actions },
    { cls: 'nw', f: (r) => (/^https?:\/\//.test(r.url) ? h('a', { class: 'gd-link', href: r.url, target: '_blank', rel: 'noopener noreferrer', text: 'Source' }) : '') }
  ]);
});
