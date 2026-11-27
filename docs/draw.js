(function () {
const { h, gate, ok, fill, badge, prio, more, trim, fmt } = GD;
const CW = GD.catWord;
const cleanCat = (s) => { const t = String(s || '').replace(/^\d+\s*/, ''); return t.charAt(0).toUpperCase() + t.slice(1); };

function measure(labs, maxW, xPos) {
  let wmax = 0;
  labs.each(function () { wmax = Math.max(wmax, this.getComputedTextLength()); });
  const ml = Math.min(Math.ceil(wmax) + (xPos || 0) + 10, maxW);
  labs.each(function () {
    let t = this.textContent;
    while (this.getComputedTextLength() > ml - (xPos || 0) - 10 && t.length > 3) { t = t.slice(0, -2); this.textContent = t + '…'; }
  });
  return ml;
}
function legendOf(items) {
  return h('div', { class: 'gd-legend' }, items.map((i) => h('span', null, h('i', { class: 'gd-sw ' + i.cls }), i.label)));
}
function pointerTip(sel, tip, fn) {
  sel.on('pointermove pointerdown', (ev, d) => { const t = fn(d); tip.show(ev, t[0], t[1]); }).on('pointerleave', () => tip.hide());
}

/* Generic horizontal stacked bar (ordinal single-hue steps). */
GD.hstack = (el, cfg) => {
  el.replaceChildren();
  const rows = cfg.rows;
  const cats = [...new Set(rows.map((r) => r[cfg.catKey]))];
  const lab = cfg.label || ((c) => c);
  const tot = new Map(cats.map((c) => [c, d3.sum(rows.filter((r) => r[cfg.catKey] === c), (r) => r.n)]));
  el.append(legendOf(cfg.sers.filter((s) => rows.some((r) => r[cfg.serKey] === s.key)).map((s) => ({ cls: s.cls, label: s.key }))));
  const W = Math.max(260, el.clientWidth);
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', cfg.aria).attr('width', '100%');
  const rowH = 30, top = 4, H = top + cats.length * rowH + 24;
  const labs = svg.append('g').selectAll('text').data(cats).join('text').attr('class', 'gd-lbl').text((c) => lab(c));
  const ml = measure(labs, Math.round(W * 0.45));
  labs.attr('x', 0).attr('y', (c, i) => top + i * rowH + rowH / 2 + 4);
  svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().domain([0, d3.max([...tot.values()])]).nice().range([ml, W - 40]);
  const ticks = x.ticks(Math.min(6, Math.max(2, Math.floor((W - ml) / 80)))).filter(Number.isInteger);
  svg.append('g').attr('class', 'gd-grid').selectAll('line').data(ticks).join('line').attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top).attr('y2', H - 22);
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', (d) => x(d)).attr('y', H - 7).attr('text-anchor', 'middle').text((d) => d);
  const tip = GD.tip(el);
  const bars = [];
  cats.forEach((c, i) => {
    let acc = 0;
    cfg.sers.forEach((s) => {
      const r = rows.find((q) => q[cfg.catKey] === c && q[cfg.serKey] === s.key); if (!r) return;
      bars.push({ c, s, n: r.n, x0: x(acc), x1: x(acc + r.n), y: top + i * rowH + 5 }); acc += r.n;
    });
    svg.append('text').attr('x', x(acc) + 6).attr('y', top + i * rowH + rowH / 2 + 4).text(acc);
  });
  const sel = svg.append('g').selectAll('rect').data(bars).join('rect').attr('class', (d) => 'gd-seg ' + d.s.cls)
    .attr('x', (d) => d.x0).attr('y', (d) => d.y).attr('width', (d) => Math.max(2, d.x1 - d.x0 - 2)).attr('height', rowH - 14).attr('rx', 3);
  pointerTip(sel, tip, (d) => [lab(d.c) + ' · ' + d.s.key, [d.n + ' ' + cfg.unit].concat(cfg.detail ? cfg.detail(d.c, d.s.key) : [])]);
};

dash.draw('chart_actions', (el) => {
  const g = gate(el, 'actions_by', 'actions'); if (!g) return;
  GD.hstack(el, {
    rows: g[0], catKey: 'line_name', serKey: 'priority', unit: 'actions',
    sers: [{ key: 'Very High', cls: 's3' }, { key: 'High', cls: 's2' }, { key: 'Medium', cls: 's1' }],
    aria: 'Stacked bar chart: number of planned actions in each strategic line by priority.',
    detail: (c, p) => { const ids = g[1].filter((a) => a.priority === p && g[0].some((r) => r.line_name === c && r.line === a.line)).map((a) => a.id); return ids.length ? [ids.join(', ')] : []; }
  });
});
dash.draw('chart_iwc', (el) => {
  const g = gate(el, 'iwc_by', 'iwc'); if (!g) return;
  GD.hstack(el, {
    rows: g[0], catKey: 'year', serKey: 'status', unit: 'recommendations',
    sers: [{ key: 'Open', cls: 's3' }, { key: 'Closed', cls: 's2' }, { key: 'Superseded', cls: 's1' }],
    aria: 'Stacked bar chart: IWC Scientific Committee recommendations by year of adoption and current status.',
    detail: (c, s) => { const ids = g[1].filter((r) => String(r.year) === c && r.status === s).map((r) => r.id); return ids.length ? [ids.join(', ')] : []; }
  });
});
dash.draw('chart_thr', (el) => {
  const g = gate(el, 'thr_by_cat'); if (!g) return;
  GD.hstack(el, {
    rows: g[0], catKey: 'category', serKey: 'status', unit: 'threat rows', label: cleanCat,
    sers: [{ key: 'Scored (provisional)', cls: 's3' }, { key: 'Review required', cls: 's2' }, { key: 'Not scored', cls: 's1' }],
    aria: 'Stacked bar chart: rows of the overall threat scoring form in each threat category by scoring status.'
  });
});
dash.draw('chart_gear', (el) => {
  const g = gate(el, 'gear_by'); if (!g) return;
  GD.hstack(el, {
    rows: g[0], catKey: 'gear_class', serKey: 'status', unit: 'gear types',
    sers: [{ key: 'Scored (provisional)', cls: 's3' }, { key: 'Not scored', cls: 's2' }, { key: 'Unscored', cls: 's1' }],
    aria: 'Stacked bar chart: fishing gear types in each gear class by scoring status.'
  });
});

/* Abundance estimates, grouped by management unit. */
dash.draw('chart_abund', (el) => {
  const g = gate(el, 'abundance', 'mus'); if (!g) return;
  const [ab, mus] = g; el.replaceChildren();
  const items = [];
  mus.slice().sort((a, b) => a.order - b.order).forEach((m) => {
    items.push({ t: 'head', m });
    const s = ab.filter((r) => r.mu === m.mu);
    if (!s.length) items.push({ t: 'gap', m });
    s.forEach((r) => items.push({ t: 'est', m, r }));
  });
  const W = Math.max(280, el.clientWidth), narrow = W < 520;
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('width', '100%')
    .attr('aria-label', 'Range chart of abundance estimates by study, grouped by management unit from north to south, on a logarithmic scale.');
  let yy = 2; items.forEach((it) => { it.y = yy; it.h = it.t === 'head' ? 26 : 20; yy += it.h; });
  const H = yy + 26;
  svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const estLabs = svg.append('g').selectAll('text').data(items.filter((i) => i.t === 'est')).join('text').attr('class', 'gd-lbl').attr('x', 12).text((d) => d.r.area);
  const ml = measure(estLabs, Math.round(W * (narrow ? 0.46 : 0.4)), 12);
  estLabs.attr('y', (d) => d.y + d.h / 2 + 4);
  const x = d3.scaleLog().domain([20, 6000]).range([ml, W - 24]);
  const ticks = (narrow ? [50, 200, 1000, 5000] : [20, 50, 100, 200, 500, 1000, 2000, 5000]);
  svg.append('g').attr('class', 'gd-grid').selectAll('line').data(ticks).join('line').attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', 0).attr('y2', H - 22);
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', (d) => x(d)).attr('y', H - 7).attr('text-anchor', 'middle').text((d) => fmt(d));
  items.filter((i) => i.t === 'head').forEach((it, k) => {
    if (k) svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', it.y + 1).attr('y2', it.y + 1).style('stroke', 'var(--color-border-line)');
    svg.append('text').attr('class', 'gd-head').attr('x', 0).attr('y', it.y + 19).text(it.m.mu + ' · ' + it.m.name);
  });
  items.filter((i) => i.t === 'gap').forEach((it) => svg.append('text').attr('class', 'gd-gap').attr('x', 12).attr('y', it.y + 14).text('No estimate recorded in the sources reviewed'));
  const tip = GD.tip(el);
  const est = items.filter((i) => i.t === 'est');
  const mk = svg.append('g');
  est.forEach((it) => {
    const { low, high } = it.r, cy = it.y + it.h / 2;
    if (low === high) mk.append('circle').attr('class', 'gd-rng').attr('cx', x(low)).attr('cy', cy).attr('r', 4);
    else mk.append('rect').attr('class', 'gd-rng').attr('x', x(low)).attr('y', cy - 3).attr('width', Math.max(6, x(high) - x(low))).attr('height', 6).attr('rx', 3);
    const txt = low === high ? fmt(low) : fmt(low) + '–' + fmt(high);
    const right = x(high) < W - 70;
    mk.append('text').attr('x', right ? x(high) + 8 : x(low) - 8).attr('y', cy + 4).attr('text-anchor', right ? 'start' : 'end').text(txt);
  });
  const hit = svg.append('g').selectAll('rect').data(est).join('rect').attr('class', 'gd-hit').attr('x', 0).attr('width', W).attr('y', (d) => d.y).attr('height', (d) => d.h);
  pointerTip(hit, tip, (d) => [d.r.area + ' (' + d.m.mu + ')', [d.r.low === d.r.high ? 'Estimate: ' + fmt(d.r.low) : 'Range: ' + fmt(d.r.low) + '–' + fmt(d.r.high), d.r.source, d.r.method, 'Origin: ' + d.r.origin].filter(Boolean)]);
});

/* Conservation status ladder by jurisdiction. */
dash.draw('chart_status', (el) => {
  const g = gate(el, 'status'); if (!g) return;
  const st = g[0]; el.replaceChildren();
  const states = [...new Set(st.filter((r) => r.level === 'State').map((r) => r.area))].sort((a, b) => a.localeCompare(b, 'pt'));
  // other range states north to south, then Brazil and its states
  const ORDER = ['Honduras', 'Nicaragua', 'Costa Rica', 'Panama', 'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'French Guiana (France)'];
  const others = [...new Set(st.filter((r) => r.level === 'National' && r.jurisdiction !== 'Brazil').map((r) => r.jurisdiction))]
    .sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const lanes = [{ label: 'IUCN Red List (global)', f: (r) => r.level === 'Global' }]
    .concat(others.map((c) => ({ label: 'National · ' + c, f: (r) => r.level === 'National' && r.jurisdiction === c })))
    .concat([{ label: 'Brazil (national list)', f: (r) => r.level === 'National' && r.jurisdiction === 'Brazil' }])
    .concat(states.map((s) => ({ label: 'State · ' + s, f: (r) => r.level === 'State' && r.area === s })))
    .concat([...new Set(st.filter((r) => r.level === 'Municipal').map((r) => r.area))].map((m) => ({ label: 'Municipal · ' + m.replace(/ \(municipality\)$/, ''), f: (r) => r.level === 'Municipal' && r.area === m })));
  lanes.forEach((l) => {
    const all = st.filter(l.f);
    l.none = all.filter((r) => !r.category);
    l.pts = all.filter((r) => r.category).sort((a, b) => (a.year == null ? 9999 : a.year) - (b.year == null ? 9999 : b.year));
  });
  const cls = { DD: 'dd', NT: 's1', VU: 's2', EN: 's3', T: 'tu' };
  el.append(legendOf(['DD', 'NT', 'VU', 'EN', 'T'].filter((c) => c !== 'T' || st.some((r) => r.category === 'T')).map((c) => ({ cls: cls[c], label: CW[c] + ' (' + c + ')' }))));
  const W = Math.max(280, el.clientWidth), narrow = W < 520, laneH = 28, top = 4, H = top + lanes.length * laneH + 26;
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('aria-label', 'Timeline of conservation status assessments by jurisdiction, showing the category assigned in each year.');
  const labs = svg.append('g').selectAll('text').data(lanes).join('text').attr('class', 'gd-lbl').text((l) => l.label);
  const ml = measure(labs, Math.round(W * 0.38));
  labs.attr('x', 0).attr('y', (l, i) => top + i * laneH + laneH / 2 + 4);
  const hasND = st.some((r) => r.year == null), ndX = W - 26;
  const x = d3.scaleLinear().domain([1998, 2027]).range([ml + 10, W - (hasND ? 62 : 30)]);
  const ticks = narrow ? [2000, 2010, 2020] : [2000, 2005, 2010, 2015, 2020, 2025];
  svg.append('g').attr('class', 'gd-grid').selectAll('line').data(ticks).join('line').attr('x1', (d) => x(d)).attr('x2', (d) => x(d)).attr('y1', top).attr('y2', H - 22);
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', (d) => x(d)).attr('y', H - 7).attr('text-anchor', 'middle').text((d) => d);
  if (hasND) svg.append('text').attr('x', ndX).attr('y', H - 7).attr('text-anchor', 'middle').text('n.d.');
  const tip = GD.tip(el);
  const px = (r) => (r.year == null ? ndX : x(r.year));
  const line = d3.line().x(px).y((r) => r.cy);
  lanes.forEach((l, i) => {
    const cy = top + i * laneH + laneH / 2; l.pts.forEach((p) => { p.cy = cy; p.lane = l.label; });
    const dated = l.pts.filter((p) => p.year != null);
    if (dated.length > 1) svg.append('path').attr('class', 'gd-ln').attr('d', line(dated));
  });
  lanes.forEach((l, i) => {
    if (l.pts.length || !l.none.length) return;
    const t = svg.append('text').attr('class', 'gd-gap').attr('x', x(1998) + 4).attr('y', top + i * laneH + laneH / 2 + 4).text(/^State/.test(l.label) ? 'No official state listing found' : 'No national category found');
    const r0 = l.none[0];
    t.on('pointermove pointerdown', (ev) => tip.show(ev, l.label, [r0.source])).on('pointerleave', () => tip.hide());
  });
  const pts = lanes.flatMap((l) => l.pts);
  const mk = svg.append('g').selectAll('circle').data(pts).join('circle').attr('class', (d) => 'gd-mk ' + (cls[d.category] || 's1')).attr('cx', px).attr('cy', (d) => d.cy).attr('r', narrow ? 5 : 7);
  lanes.forEach((l) => l.pts.forEach((p, k) => {
    const nx = l.pts[k + 1]; if (nx && px(nx) - px(p) < 40) return;
    svg.append('text').attr('x', px(p) + (narrow ? 8 : 11)).attr('y', p.cy + 4).text(p.category);
  }));
  const hit = svg.append('g').selectAll('circle').data(pts).join('circle').attr('class', 'gd-hit').attr('cx', px).attr('cy', (d) => d.cy).attr('r', 12);
  pointerTip(hit, tip, (d) => [d.lane + ' · ' + (CW[d.category] || d.category), ['Year: ' + (d.year == null ? 'not recorded' : d.year), d.criterion ? 'Criteria: ' + d.criterion : '', 'Source: ' + d.source].filter(Boolean)]);
});

/* Literature output: two open snapshots on one count scale. */
dash.draw('chart_lit', (el) => {
  const g = gate(el, 'lit_years', 'pubmed_years'); if (!g) return;
  el.replaceChildren();
  const S = [{ key: 'OpenAlex (journal articles)', short: 'OpenAlex', rows: g[0], col: dash.colors[0], dash: null }, { key: 'PubMed (all record types)', short: 'PubMed', rows: g[1], col: dash.colors[1] || dash.colors[0], dash: '5 3' }];
  const lg = h('div', { class: 'gd-legend' }, S.map((s) => { const i = h('i', { class: 'gd-sw' }); i.style.background = s.col; return h('span', null, i, s.key); }));
  lg.append(h('span', null, h('i', { class: 'gd-sw part' }), 'Hollow marker: current year, incomplete'));
  el.append(lg);
  const W = Math.max(280, el.clientWidth), H = W < 520 ? 220 : 260, ml = 30, mr = W < 520 ? 66 : 84, mt = 8, mb = 24;
  const years = [...new Set(S.flatMap((s) => s.rows.map((r) => r.year)))].sort((a, b) => a - b);
  const x = d3.scaleLinear().domain([years[0], years[years.length - 1]]).range([ml, W - mr]);
  const y = d3.scaleLinear().domain([0, d3.max(S, (s) => d3.max(s.rows, (r) => r.articles))]).nice().range([H - mb, mt]);
  const svg = d3.select(el).append('svg').attr('role', 'img').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
    .attr('aria-label', 'Line chart of the number of publications per year on Sotalia guianensis in OpenAlex and PubMed.');
  const yt = y.ticks(4);
  svg.append('g').attr('class', 'gd-grid').selectAll('line').data(yt).join('line').attr('x1', ml).attr('x2', W - mr).attr('y1', (d) => y(d)).attr('y2', (d) => y(d));
  svg.append('g').selectAll('text').data(yt).join('text').attr('x', ml - 6).attr('y', (d) => y(d) + 4).attr('text-anchor', 'end').text((d) => d);
  const lastY = years[years.length - 1];
  const xt = years.filter((v) => v % 5 === 0 || v === lastY).filter((v) => W >= 520 || v % 10 === 0 || v === lastY)
    .filter((v) => v === lastY || x(lastY) - x(v) > 38); // keep the final year's label clear of the one before
  svg.append('g').selectAll('text').data(xt).join('text').attr('x', (d) => x(d)).attr('y', H - 7).attr('text-anchor', 'middle').text((d) => d);
  const ln = d3.line().x((r) => x(r.year)).y((r) => y(r.articles));
  S.forEach((s) => {
    const rows = s.rows.slice().sort((a, b) => a.year - b.year);
    const p = svg.append('path').attr('d', ln(rows)).attr('fill', 'none').attr('stroke-width', 2).style('stroke', s.col); if (s.dash) p.attr('stroke-dasharray', s.dash);
    svg.append('g').selectAll('circle').data(rows).join('circle').attr('cx', (r) => x(r.year)).attr('cy', (r) => y(r.articles)).attr('r', 3.5).attr('stroke-width', 2)
      .style('stroke', (r) => (r.partial ? s.col : 'var(--color-bg)')).style('fill', (r) => (r.partial ? 'var(--color-bg)' : s.col));
    s.last = rows[rows.length - 1];
  });
  const ends = S.map((s) => ({ s, yy: y(s.last.articles) })).sort((a, b) => a.yy - b.yy);
  if (ends.length === 2 && ends[1].yy - ends[0].yy < 14) ends[1].yy = ends[0].yy + 14;
  // keep both end labels above the year labels of the x axis
  const lowest = H - mb - 8;
  if (ends.length && ends[ends.length - 1].yy > lowest) { const d = ends[ends.length - 1].yy - lowest; ends.forEach((e) => { e.yy -= d; }); }
  ends.forEach((e) => svg.append('text').attr('x', x(e.s.last.year) + 8).attr('y', e.yy + 4).text(e.s.short + ' · ' + e.s.last.articles));
  const tip = GD.tip(el);
  const cross = svg.append('line').attr('y1', mt).attr('y2', H - mb).style('stroke', 'var(--cds-chart-reference, var(--color-fg-muted))').attr('visibility', 'hidden');
  svg.append('rect').attr('class', 'gd-hit').attr('x', ml).attr('y', mt).attr('width', W - mr - ml).attr('height', H - mt - mb)
    .on('pointermove pointerdown', (ev) => {
      const r = svg.node().getBoundingClientRect(); const yr = Math.round(x.invert(((ev.clientX - r.left) / r.width) * W));
      const yv = Math.min(years[years.length - 1], Math.max(years[0], yr));
      cross.attr('x1', x(yv)).attr('x2', x(yv)).attr('visibility', 'visible');
      tip.show(ev, String(yv), S.map((s) => { const q = s.rows.find((a) => a.year === yv); return s.short + ': ' + (q ? q.articles + (q.partial ? ' (incomplete year)' : '') : 'no data'); }));
    }).on('pointerleave', () => { cross.attr('visibility', 'hidden'); tip.hide(); });
});

/* Filters whose choices come from data. */
function mkSelect(name, param, allLabel, src, vals) {
  dash.draw(name, (sel) => {
    const rows = ok(src) || [];
    sel.replaceChildren(new Option(allLabel, ''), ...vals(rows).map((v) => (typeof v === 'string' ? new Option(v, v) : new Option(v.label, v.value))));
    sel.value = dash.params()[param] || '';
    sel.onchange = () => dash.setParams({ [param]: sel.value || null });
  });
}
const LINE_NAMES = { RES: 'Research', MON: 'Monitoring', MIT: 'Mitigation', PACB: 'Public awareness and capacity building' };
mkSelect('f_a_line', 'a_line', 'All strategic lines', 'actions', (r) => [...new Set(r.map((a) => a.line))].map((l) => ({ value: l, label: LINE_NAMES[l] || l })));
mkSelect('f_a_prio', 'a_prio', 'All priorities', 'actions', () => ['Very High', 'High', 'Medium']);
mkSelect('f_i_status', 'i_status', 'All statuses', 'iwc', (r) => [...new Set(r.map((a) => a.status))]);
mkSelect('f_t_status', 't_status', 'All scoring statuses', 'threat_scores', (r) => [...new Set(r.map((a) => a.status))]);
mkSelect('f_g_status', 'g_status', 'All scoring statuses', 'fisheries', (r) => [...new Set(r.map((a) => a.status))]);
mkSelect('f_s_group', 's_group', 'All indicator groups', 'salve', (r) => [...new Set(r.map((a) => a.group))]);

const P = () => dash.params();
const link = (href, text) => (/^https?:\/\//.test(href) ? h('a', { class: 'gd-link', href, target: '_blank', rel: 'noopener noreferrer', text }) : text);
const statusBadge = (s) => badge(s, s === 'Review required' ? 'warn' : s === 'Scored (provisional)' ? 'md' : '');
const blank = (v) => (v ? v : '—');

dash.draw('units_body', (tb) => {
  const g = gate(tb, 'mu_cov'); if (!g) return;
  fill(tb, g[0], [
    { cls: 'nw', f: (r) => r.mu }, { f: (r) => r.name }, { f: (r) => r.range }, { cls: 'num', f: (r) => String(r.n_est) },
    { cls: 'nw', f: (r) => (r.n_est ? (r.low === r.high ? fmt(r.low) : fmt(r.low) + '–' + fmt(r.high)) : badge('No estimate', 'gap')) },
    { cls: 'wide', f: (r) => r.note }
  ]);
});
dash.draw('threat_body', (tb) => {
  const g = gate(tb, 'threat_cov'); if (!g) return;
  fill(tb, g[0], [
    { cls: 'wide', f: (r) => r.threat }, { f: (r) => r.kind }, { f: (r) => r.evidence }, { f: (r) => prio(r.priority) },
    { cls: 'wide', f: (r) => h('span', null, r.n_actions + ' linked actions (' + r.n_vh + ' Very High)', more('Action identifiers', r.action_ids)) },
    { cls: 'wide', f: (r) => r.urgent }
  ]);
});
dash.draw('thr_body', (tb) => {
  const g = gate(tb, 'threat_scores'); if (!g) return;
  const f = P().t_status; const rows = g[0].filter((r) => !f || r.status === f);
  fill(tb, rows, [
    { f: (r) => cleanCat(r.category) }, { cls: 'wide', f: (r) => r.level1 + (r.level2 ? ' — ' + r.level2 : '') },
    { f: (r) => blank(trim(r.timing)) }, { f: (r) => blank(trim(r.scope)) }, { f: (r) => blank(r.severity) }, { f: (r) => blank(r.cost) },
    { f: (r) => statusBadge(r.status) },
    { cls: 'wide', f: (r) => more('Comment', [r.comment, r.mitigation ? 'Mitigation: ' + r.mitigation : ''].filter(Boolean).join(' ')) }
  ]);
});
dash.draw('gear_body', (tb) => {
  const g = gate(tb, 'fisheries'); if (!g) return;
  const f = P().g_status; const rows = g[0].filter((r) => !f || r.status === f);
  fill(tb, rows, [
    { f: (r) => r.gear_class }, { cls: 'wide', f: (r) => r.gear }, { f: (r) => blank(trim(r.timing)) }, { f: (r) => blank(trim(r.scope)) },
    { cls: 'wide', f: (r) => blank(String(r.severity || '').replace('; whichever is the longer', '')) },
    { f: (r) => statusBadge(r.status) }, { cls: 'wide', f: (r) => more('Comment', r.comment) }
  ]);
});
dash.draw('actions_body', (tb) => {
  const g = gate(tb, 'actions'); if (!g) return;
  const p = P(), q = String(p.a_q || '').toLowerCase();
  const rows = g[0].filter((r) => (!p.a_line || r.line === p.a_line) && (!p.a_prio || r.priority === p.a_prio) && (!q || (r.id + ' ' + r.title + ' ' + r.topic + ' ' + r.region).toLowerCase().includes(q)));
  fill(tb, rows, [
    { cls: 'nw', f: (r) => r.id }, { f: (r) => LINE_NAMES[r.line] || r.line }, { f: (r) => r.topic },
    { cls: 'wide', f: (r) => h('span', null, r.title, more('Budget (as stated in the CMP)', r.budget), r.priority_detail && r.priority_detail !== r.priority ? more('Priority by component', r.priority_detail) : null) },
    { f: (r) => r.region }, { cls: 'num', f: (r) => r.years }, { f: (r) => prio(r.priority) }
  ]);
});
dash.draw('iwc_body', (tb) => {
  const g = gate(tb, 'iwc'); if (!g) return;
  const f = P().i_status; const rows = g[0].filter((r) => !f || r.status === f);
  fill(tb, rows, [
    { cls: 'nw', f: (r) => r.id }, { cls: 'nw', f: (r) => String(r.year) }, { f: (r) => blank(r.theme) },
    { f: (r) => badge(r.status, r.status === 'Open' ? 'warn' : '') }, { cls: 'wide', f: (r) => r.summary }, { f: (r) => r.note }
  ]);
});
dash.draw('workshop_body', (tb) => {
  const g = gate(tb, 'workshop'); if (!g) return;
  fill(tb, g[0], [{ f: (r) => r.topic }, { f: (r) => r.verb }, { cls: 'wide', f: (r) => r.ask }, { f: (r) => r.addressee }, { f: (r) => badge(r.state, 'warn') }]);
});
dash.draw('salve_body', (tb) => {
  const g = gate(tb, 'salve'); if (!g) return;
  const f = P().s_group; const rows = g[0].filter((r) => !f || r.group === f);
  fill(tb, rows, [
    { f: (r) => r.group }, { cls: 'wide', f: (r) => r.indicator }, { cls: 'nw', f: (r) => r.value + (r.unit ? ' ' + r.unit : '') },
    { f: (r) => r.area }, { f: (r) => r.source }, { cls: 'wide', f: (r) => r.note }
  ]);
});
dash.draw('states_body', (tb) => {
  const g = gate(tb, 'states'); if (!g) return;
  fill(tb, g[0], [{ cls: 'nw', f: (r) => r.country }, { f: (r) => r.iwc }, { f: (r) => r.proponent }, { cls: 'wide', f: (r) => r.instruments }]);
});
dash.draw('timeline', (ul) => {
  const g = gate(ul, 'milestones'); if (!g) return;
  ul.replaceChildren(...g[0].map((m) => h('li', { class: m.kind === 'Planned' ? 'plan' : '' }, h('span', { class: 'gd-tl-y', text: String(m.year) }), m.event, ' ', h('span', { class: 'gd-tl-k', text: '(' + m.kind + '; ' + m.source + ')' }))));
});
dash.draw('lit_body', (tb) => {
  const g = gate(tb, 'lit_records'); if (!g) return;
  fill(tb, g[0], [
    { cls: 'nw', f: (r) => (r.year == null ? '' : String(r.year)) }, { f: (r) => r.first_author }, { cls: 'wide', f: (r) => r.title }, { f: (r) => r.journal },
    { cls: 'num', f: (r) => String(r.citations) }, { cls: 'nw', f: (r) => (r.doi ? link(r.doi, 'DOI') : '') }
  ]);
});
dash.draw('pm_body', (tb) => {
  const g = gate(tb, 'pubmed_live'); if (!g) return;
  fill(tb, g[0], [
    { cls: 'nw', f: (r) => r.date }, { f: (r) => r.first_author }, { cls: 'wide', f: (r) => r.title }, { f: (r) => r.journal },
    { cls: 'nw', f: (r) => (r.doi ? link('https://doi.org/' + r.doi, 'DOI') : '') }
  ]);
});
dash.draw('flags_body', (tb) => {
  const g = gate(tb, 'flags'); if (!g) return;
  const ORD = { 'Pending in CMP text': 0, 'To confirm': 1, Open: 2, Resolved: 3 };
  const SCL = { 'Pending in CMP text': 'hi', 'To confirm': 'md', Open: 'md', Resolved: '' };
  const rows = g[0].slice().sort((a, b) => (ORD[a.status] ?? 9) - (ORD[b.status] ?? 9));
  fill(tb, rows, [{ cls: 'nw', f: (r) => r.topic }, { cls: 'nw', f: (r) => badge(r.status || '', SCL[r.status] || '') }, { cls: 'wide', f: (r) => r.issue }, { cls: 'wide', f: (r) => r.action }, { cls: 'wide', f: (r) => r.resolution }]);
});

})();
