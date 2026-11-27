(function () {
/* Threats by management unit: published studies and CMP records of stressors in each unit. */
dash.calc('mt_cells', {
  inputs: ['threat_studies', 'cmp_unit_threats'],
  title: 'Stressors by management unit',
  description: 'For each management unit and stressor, the number of published studies documenting the stressor there and whether the CMP records it for that unit.',
  fn: (studies, cmp) => {
    const m = new Map();
    const cell = (u, s) => { const k = u + '|' + s; if (!m.has(k)) m.set(k, { unit: u, stressor: s, n_studies: 0, cmp: false, cmp_basis: '' }); return m.get(k); };
    studies.forEach((r) => String(r.units || '').split(';').filter(Boolean).forEach((u) => String(r.stressors || '').split(';').filter(Boolean).forEach((s) => { cell(u, s).n_studies += 1; })));
    cmp.forEach((r) => { const c = cell(r.unit, r.stressor); c.cmp = true; c.cmp_basis = r.basis; });
    return [...m.values()];
  }
});
dash.calc('mt_units', {
  inputs: ['mus', 'threat_studies', 'mt_cells'],
  title: 'Evidence by management unit',
  description: 'For each management unit: studies that document at least one stressor there, and the number of stressors documented in studies or recorded by the CMP.',
  fn: (mus, studies, cells) => mus.slice().sort((a, b) => a.order - b.order).map((u) => {
    const c = cells.filter((x) => x.unit === u.mu);
    return { mu: u.mu, name: u.name, range: u.range, order: Number(u.order),
      n_studies: studies.filter((r) => String(r.units).split(';').includes(u.mu)).length,
      n_stressors: c.filter((x) => x.n_studies > 0).length,
      n_cmp_only: c.filter((x) => x.cmp && !x.n_studies).length };
  })
});

(() => {
  const { h } = GD;
  const EXTENT = { type: 'MultiPoint', coordinates: [[-88, -30], [-33, 17]] };
  const sel = () => dash.params().rmu || null;
  const pick = (mu) => dash.setParams({ rmu: mu || null });
  const defs = () => {
    const d = GD.ok('stressor_defs') || [];
    return { st: d.filter((x) => x.kind === 'stressor').sort((a, b) => a.order - b.order), im: d.filter((x) => x.kind === 'impact').sort((a, b) => a.order - b.order) };
  };
  const shade = (n) => (n === 0 ? 'mt-n0' : n <= 2 ? 'mt-n1' : n <= 4 ? 'mt-n2' : 'mt-n3');
  const SHADES = [['mt-n0', 'None found'], ['mt-n1', '1–2'], ['mt-n2', '3–4'], ['mt-n3', '5 or more']];
  const legend = (el, items, lead) => el.append(h('div', { class: 'gd-legend' }, lead ? h('span', { class: 'mt-lead', text: lead }) : null,
    items.map((i) => h('span', null, h('i', { class: 'gd-sw ' + i[0] }), i[1]))));

  // Map: coastal segments of each unit, shaded by the number of stressors documented in studies
  dash.draw('mt_map', (el) => {
    const g = GD.gate(el, 'mt_units'); if (!g) return;
    const base = dash.data('map_base'), segs = dash.data('mu_segments');
    if ([base, segs].some((x) => x.status !== 'ok' || !x.data || !x.data.features)) { el.textContent = [base, segs].some((x) => x.status === 'error') ? 'Failed to load' : '—'; return; }
    el.replaceChildren();
    const units = new Map(g[0].map((u) => [u.mu, u]));
    legend(el, SHADES.concat([['mt-none', 'Coast not assigned to a unit']]), 'Stressors documented in studies:');
    const W = Math.max(280, el.clientWidth), H = Math.round(Math.min(W * 1.0, 640));
    const proj = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], EXTENT), path = d3.geoPath(proj);
    const svg = d3.select(el).append('svg').attr('role', 'img').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-label', 'Map of the coast from Honduras to southern Brazil divided into the management units of the Guiana dolphin, shaded by the number of stressors documented in published studies in each unit.');
    svg.append('defs').append('clipPath').attr('id', 'mt-clip').append('rect').attr('width', W).attr('height', H).attr('rx', 6);
    const root = svg.append('g').attr('clip-path', 'url(#mt-clip)');
    root.append('rect').attr('class', 'gd-sea').attr('width', W).attr('height', H);
    root.append('g').selectAll('path').data(base.data.features).join('path').attr('class', 'gd-land').attr('d', path);
    const tip = GD.tip(el), cur = sel();
    const feats = segs.data.features;
    root.append('g').selectAll('path').data(feats).join('path')
      .attr('class', (f) => f.properties.mu ? 'mt-seg ' + shade((units.get(f.properties.mu) || {}).n_stressors || 0) + (f.properties.mu === cur ? ' on' : '') : 'mt-seg mt-none')
      .attr('d', path)
      .on('pointermove', (ev, f) => { const u = units.get(f.properties.mu); tip.show(ev, u ? u.mu + ' · ' + u.name : 'Not assigned to a unit', u ? [u.range, u.n_stressors + ' stressors in ' + u.n_studies + ' studies', 'Click for details'] : [f.properties.end]); })
      .on('pointerleave', () => tip.hide())
      .on('click', (ev, f) => { if (f.properties.mu) pick(f.properties.mu); });
    // unit labels, pushed seaward and kept apart
    const C = proj([-58, -8]);
    const lab = feats.filter((f) => f.properties.mu).map((f) => {
      const cs = f.geometry.coordinates, mid = proj(cs[Math.floor(cs.length / 2)]);
      const dx = mid[0] - C[0], dy = mid[1] - C[1], len = Math.hypot(dx, dy) || 1;
      return { f, ax: mid[0], ay: mid[1], x: mid[0] + dx / len * 34, y: mid[1] + dy / len * 34 };
    });
    const sim = d3.forceSimulation(lab).stop().force('x', d3.forceX((p) => p.x).strength(0.3)).force('y', d3.forceY((p) => p.y).strength(0.3)).force('c', d3.forceCollide(20));
    for (let i = 0; i < 160; i++) sim.tick();
    lab.forEach((p) => { p.x = Math.max(24, Math.min(W - 24, p.x)); p.y = Math.max(12, Math.min(H - 12, p.y)); });
    root.append('g').selectAll('line').data(lab).join('line').attr('class', 'gd-lead').attr('x1', (p) => p.ax).attr('y1', (p) => p.ay).attr('x2', (p) => p.x).attr('y2', (p) => p.y);
    const lg = root.append('g').selectAll('g').data(lab).join('g').attr('class', (p) => 'mt-lab' + (p.f.properties.mu === cur ? ' on' : '')).attr('transform', (p) => `translate(${p.x},${p.y})`)
      .on('click', (ev, p) => pick(p.f.properties.mu));
    lg.append('rect').attr('x', -21).attr('y', -9).attr('width', 42).attr('height', 18).attr('rx', 9);
    lg.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').text((p) => p.f.properties.mu);
  });

  // Matrix: units (rows, north to south) x stressors (columns, grouped by source)
  dash.draw('mt_matrix', (el) => {
    const g = GD.gate(el, 'mt_units', 'mt_cells', 'stressor_defs'); if (!g) return;
    el.replaceChildren();
    const units = g[0], cells = new Map(g[1].map((c) => [c.unit + '|' + c.stressor, c])), st = defs().st, cur = sel();
    const groups = [...new Set(st.map((s) => s.group))];
    legend(el, [['mt-dot', 'Published studies (size = number)'], ['mt-ring', 'Recorded by the CMP for the unit'], ['mt-x', 'Neither']]);
    const W = Math.max(320, el.clientWidth), narrow = W < 640;
    const rowH = 26, labW = narrow ? 58 : 200, headH = narrow ? 96 : 104, colW = Math.max(18, Math.min(46, (W - labW - 70) / st.length));
    const H = headH + units.length * rowH + 8;
    const svg = d3.select(el).append('svg').attr('role', 'img').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-label', 'Matrix of management units against stressors, showing where published studies document each stressor and where the CMP records it.');
    const cx = (i) => labW + i * colW + colW / 2;
    // group bands and rotated stressor labels
    groups.forEach((gr, gi) => {
      const idx = st.map((s, i) => (s.group === gr ? i : -1)).filter((i) => i >= 0);
      const x0 = labW + idx[0] * colW, x1 = labW + (idx[idx.length - 1] + 1) * colW;
      svg.append('rect').attr('class', 'mt-band' + (gi % 2 ? ' alt' : '')).attr('x', x0).attr('y', headH - 6).attr('width', x1 - x0).attr('height', H - headH);
    });
    svg.append('g').selectAll('text').data(st).join('text').attr('class', 'gd-lbl mt-col')
      .attr('transform', (s, i) => `translate(${cx(i) + 4},${headH - 10}) rotate(-55)`).text((s) => s.short || s.label)
      .append('title').text((s) => s.group + ': ' + s.label);
    const tip = GD.tip(el);
    const rows = svg.append('g').selectAll('g').data(units).join('g').attr('class', (u) => 'mt-row' + (u.mu === cur ? ' on' : '')).attr('transform', (u, i) => `translate(0,${headH + i * rowH})`)
      .on('click', (ev, u) => pick(u.mu));
    rows.append('rect').attr('class', 'mt-rowbg').attr('x', 0).attr('y', 0).attr('width', W).attr('height', rowH);
    rows.append('text').attr('class', 'gd-lbl').attr('x', 4).attr('y', rowH / 2 + 4).text((u) => (narrow ? u.mu : u.mu + ' · ' + u.name));
    const rmax = Math.min(colW, rowH) / 2 - 2;
    const r = d3.scaleSqrt().domain([0, d3.max(g[1], (c) => c.n_studies) || 1]).range([0, rmax]);
    units.forEach((u, ui) => st.forEach((s, si) => {
      const c = cells.get(u.mu + '|' + s.id), y = headH + ui * rowH + rowH / 2, x = cx(si);
      const gg = svg.append('g').attr('transform', `translate(${x},${y})`).attr('class', 'mt-cell')
        .on('pointermove', (ev) => tip.show(ev, u.mu + ' · ' + s.label, c ? [(c.n_studies ? c.n_studies + (c.n_studies === 1 ? ' published study' : ' published studies') : 'No published study found'), c.cmp ? 'CMP: ' + c.cmp_basis : 'Not recorded by the CMP for this unit'] : ['No published study found', 'Not recorded by the CMP for this unit']))
        .on('pointerleave', () => tip.hide()).on('click', () => pick(u.mu));
      if (c && c.cmp) gg.append('circle').attr('class', 'mt-ringc').attr('r', rmax + 1);
      if (c && c.n_studies) gg.append('circle').attr('class', 'mt-dotc').attr('r', Math.max(3, r(c.n_studies)));
      if (!c) gg.append('circle').attr('class', 'mt-xc').attr('r', 1.6);
    }));
    svg.append('g').selectAll('text').data(units).join('text').attr('class', 'ov-tick').attr('x', labW + st.length * colW + 8).attr('y', (u, i) => headH + i * rowH + rowH / 2 + 4)
      .text((u) => u.n_studies + (narrow ? '' : ' studies'));
  });

  // Unit selector (accessible alternative to clicking the map or the matrix)
  dash.draw('mt_select', (s) => {
    const u = GD.ok('mt_units') || [];
    s.replaceChildren(new Option('Choose a management unit…', ''), ...u.map((x) => new Option(x.mu + ' · ' + x.name, x.mu)));
    s.value = sel() || '';
    s.onchange = () => dash.setParams({ rmu: s.value || null });
  });

  // Selected unit: heading and summary
  const unit = () => (GD.ok('mt_units') || []).find((u) => u.mu === sel()) || null;
  dash.draw('mt_head', (el) => { const u = unit(); el.textContent = u ? u.mu + ' · ' + u.name : 'No unit selected'; });
  dash.draw('mt_range', (el) => { const u = unit(); el.textContent = u ? u.range : 'Click a unit on the map or a row of the matrix to see its stressors and the studies behind them.'; });
  dash.draw('mt_counts', (el) => {
    const u = unit(); if (!u) { el.textContent = ''; return; }
    el.textContent = u.n_studies + (u.n_studies === 1 ? ' study documents ' : ' studies document ') + u.n_stressors + (u.n_stressors === 1 ? ' stressor' : ' stressors') + ' in this unit' +
      (u.n_cmp_only ? '; the CMP records ' + u.n_cmp_only + ' more without a study found here.' : '.');
  });

  // Sources -> stressors -> impacts for the selected unit
  dash.draw('mt_flow', (el) => {
    el.replaceChildren();
    const u = sel(), studiesAll = GD.ok('threat_studies'), cellsAll = GD.ok('mt_cells');
    if (!u || !studiesAll || !cellsAll) return;
    const { st, im } = defs();
    const studies = studiesAll.filter((r) => String(r.units).split(';').includes(u));
    const cells = cellsAll.filter((c) => c.unit === u);
    const sts = st.filter((s) => cells.some((c) => c.stressor === s.id));
    if (!sts.length) { el.append(h('p', { class: 'gd-note', text: 'No stressor documented or recorded for this unit.' })); return; }
    const srcs = [...new Set(sts.map((s) => s.group))];
    const link2 = new Map(); // stressor|impact -> n studies
    studies.forEach((r) => { const ss = String(r.stressors).split(';'), ii = String(r.impacts).split(';').filter(Boolean); ss.forEach((s) => ii.forEach((i) => { const k = s + '|' + i; link2.set(k, (link2.get(k) || 0) + 1); })); });
    const ims = im.filter((i) => sts.some((s) => link2.get(s.id + '|' + i.id)));
    const W = Math.max(300, el.clientWidth), narrow = W < 560, rowH = 30;
    const n = Math.max(srcs.length, sts.length, ims.length, 1), H = 26 + n * rowH + 6;
    const colX = narrow ? [0, W * 0.33, W * 0.68] : [0, W * 0.3, W * 0.66], colW = narrow ? W * 0.3 : W * 0.26;
    const svg = d3.select(el).append('svg').attr('role', 'img').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-label', 'Diagram for the selected unit linking sources of pressure to the stressors they produce and to the impacts reported in the studies.');
    ['Source of pressure', 'Stressor', 'Impact reported'].forEach((t, i) => svg.append('text').attr('class', 'gd-head').attr('x', colX[i]).attr('y', 12).text(t));
    const y = (i, len) => 26 + (n - len) * rowH / 2 + i * rowH + rowH / 2;
    const ps = new Map(srcs.map((s, i) => [s, y(i, srcs.length)])), pst = new Map(sts.map((s, i) => [s.id, y(i, sts.length)])), pim = new Map(ims.map((s, i) => [s.id, y(i, ims.length)]));
    const curve = (x0, y0, x1, y1) => `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`;
    const nmax = d3.max([...link2.values()]) || 1;
    sts.forEach((s) => svg.append('path').attr('class', 'mt-flow').attr('d', curve(colX[0] + colW, ps.get(s.group), colX[1], pst.get(s.id))));
    sts.forEach((s) => ims.forEach((i) => { const k = link2.get(s.id + '|' + i.id); if (k) svg.append('path').attr('class', 'mt-flow').style('stroke-width', 1 + 5 * k / nmax).attr('d', curve(colX[1] + colW, pst.get(s.id), colX[2], pim.get(i.id))).append('title').text(k + (k === 1 ? ' study' : ' studies')); }));
    const box = (x, yy, label, cls, sub) => {
      const g = svg.append('g').attr('transform', `translate(${x},${yy})`).attr('class', 'mt-node ' + cls);
      g.append('rect').attr('y', -12).attr('width', colW).attr('height', 24).attr('rx', 12);
      const t = g.append('text').attr('class', 'gd-lbl').attr('x', 10).attr('y', 4).text(label);
      let s = label; while (t.node().getComputedTextLength() > colW - (sub ? 34 : 14) && s.length > 4) { s = s.slice(0, -2); t.text(s + '…'); }
      if (sub) g.append('text').attr('class', 'mt-sub').attr('x', colW - 8).attr('y', 4).attr('text-anchor', 'end').text(sub);
      g.append('title').text(label + (sub ? ' (' + sub + ')' : ''));
    };
    srcs.forEach((s) => box(colX[0], ps.get(s), s, 'src'));
    sts.forEach((s) => { const c = cells.find((x) => x.stressor === s.id); box(colX[1], pst.get(s.id), s.label.replace(/ \(.*\)$/, ''), c.n_studies ? 'st' : 'st cmp', c.n_studies ? String(c.n_studies) : 'CMP'); });
    ims.forEach((i) => box(colX[2], pim.get(i.id), i.label, 'im'));
  });

  // Studies for the selected unit, grouped by stressor
  const unitStudies = () => {
    const u = sel(), all = GD.ok('threat_studies'); if (!u || !all) return [];
    const { st, im } = defs(), lab = new Map(st.map((s) => [s.id, s.label])), ilab = new Map(im.map((s) => [s.id, s.label]));
    const out = [];
    st.forEach((s) => all.filter((r) => String(r.units).split(';').includes(u) && String(r.stressors).split(';').includes(s.id))
      .forEach((r) => out.push(Object.assign({}, r, { stressor_label: lab.get(s.id), impact_labels: String(r.impacts).split(';').filter(Boolean).map((i) => ilab.get(i)).join(', '),
        link: r.url || '', pdf: r.pmcid ? 'https://pmc.ncbi.nlm.nih.gov/articles/' + r.pmcid + '/' : '' }))));
    return out;
  };
  const MT_FIRST = 10;
  dash.draw('mt_list', (tb) => {
    const all = unitStudies(), rows = dash.params().mt_all ? all : all.slice(0, MT_FIRST);
    if (!rows.length) { tb.replaceChildren(h('tr', null, h('td', { class: 'gd-empty', colspan: 6, text: sel() ? 'No published study found for this unit.' : 'Select a unit to list its studies.' }))); return; }
    const a = (href, text) => (href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer', text }) : '');
    GD.fill(tb, rows, [
      { cls: 'nw', f: (r) => GD.badge(r.stressor_label.replace(/ \(.*\)$/, ''), '') },
      { cls: 'nw', f: (r) => r.year || 'n.d.' },
      { f: (r) => r.first_author },
      { cls: 'wide', f: (r) => r.title },
      { f: (r) => r.impact_labels },
      { cls: 'nw', f: (r) => h('span', { class: 'mt-links' }, a(r.link, r.doi ? 'Article' : 'SciSpace'), r.pdf ? ' · ' : '', a(r.pdf, 'Free PDF (PMC)')) }
    ]);
  });

  dash.draw('mt_more', (btn) => {
    const n = unitStudies().length, all = !!dash.params().mt_all;
    btn.style.display = n > MT_FIRST ? '' : 'none';
    btn.textContent = all ? 'Show fewer studies' : 'Show all ' + n + ' studies';
    btn.setAttribute('aria-expanded', all ? 'true' : 'false');
    btn.onclick = () => dash.setParams({ mt_all: all ? null : true });
  });

  // Download the selected unit's studies
  dash.draw('mt_dl', {
    mount(el) {
      GD.exporter([...document.querySelectorAll('[data-mt-dl]')], (m) => { el.textContent = m; }, (kind) => {
        const u = unit(); if (!u) return null;
        const rows = unitStudies().map((r) => ({ stressor: r.stressor_label, year: r.year || '', first_author: r.first_author, title: r.title, venue: r.venue, impacts: r.impact_labels, link: r.link, free_pdf: r.pdf }));
        const cols = [{ key: 'stressor', label: 'Stressor', w: 0 }, { key: 'year', label: 'Year', w: 30 }, { key: 'first_author', label: 'First author', w: 90 }, { key: 'title', label: 'Title', w: 270 },
          { key: 'venue', label: 'Journal or venue', w: 120 }, { key: 'impacts', label: 'Impacts reported', w: 0 }, { key: 'link', label: 'Link', w: 150 }, { key: 'free_pdf', label: 'Free PDF (PMC)', w: 0 }];
        return { name: 'guiana-dolphin-' + u.mu.replace('/', '-') + '-threat-studies', rows, groupKey: kind === 'pdf' ? 'stressor' : null,
          title: u.mu + ' · ' + u.name + ': published studies documenting stressors',
          subtitle: u.range + '. Studies assigned automatically from titles and abstracts; check each study before citing it.',
          cols: kind === 'csv' ? cols : cols.filter((c) => c.w) };
      });
      return {};
    },
    update() {}
  });
})();

})();
