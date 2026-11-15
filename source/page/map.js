/* IMMA map: Natural Earth countries, the species' approximate coastal occurrence,
   and the IMMAs whose factsheets name the Guiana dolphin (provisional locations). */
dash.calc('imma_stats', {
  title: 'IMMAs that include the Guiana dolphin: counts',
  description: 'Number of IMMAs that include the Guiana dolphin, of the jurisdictions they cover and of those that list it as a qualifying species.',
  inputs: ['immas'],
  fn: (immas) => {
    const countries = new Set();
    immas.forEach((r) => String(r.countries || '').split(';').map((s) => s.trim()).filter(Boolean).forEach((c) => countries.add(c)));
    return [{ n_immas: immas.length, n_countries: countries.size, n_qualifying: immas.filter((r) => r.role === 'Qualifying species').length }];
  }
});

(() => {
  const { h, fill, ok } = GD;
  const EXTENT = { type: 'MultiPoint', coordinates: [[-88, -33], [-33, 17]] };

  dash.draw('imma_map', (el) => {
    const g = GD.gate(el, 'immas', 'states'); if (!g) return;
    // range states as listed in the dashboard's range-state table; French Guiana is drawn as part of France
    const RS = new Set(g[1].map((s) => String(s.country).replace(/^French Guiana \(France\)$/, 'France')));
    const base = dash.data('map_base'), lay = dash.data('map_layers'), polys = dash.data('imma_polys');
    if ([base, lay, polys].some((x) => x.status !== 'ok' || !x.data || !x.data.features)) {
      el.textContent = [base, lay, polys].some((x) => x.status === 'error') ? 'Failed to load' : '—'; return;
    }
    el.replaceChildren();
    const rows = g[0];
    const W = Math.max(280, el.clientWidth);
    const H = Math.round(Math.min(W * 1.02, 680));
    const proj = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], EXTENT);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).append('svg').attr('role', 'img')
      .attr('aria-label', 'Map of the western tropical Atlantic from Honduras to southern Brazil, showing the approximate coastal occurrence of the Guiana dolphin and ' + rows.length + ' Important Marine Mammal Areas that include it, numbered from north to south.')
      .attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
    svg.append('defs').append('clipPath').attr('id', 'gd-map-clip').append('rect').attr('width', W).attr('height', H).attr('rx', 6);
    const root = svg.append('g').attr('clip-path', 'url(#gd-map-clip)');
    root.append('rect').attr('class', 'gd-sea').attr('width', W).attr('height', H);
    root.append('path').attr('class', 'gd-grat').attr('d', path(d3.geoGraticule().extent([[-100, -45], [-20, 30]]).step([10, 10])()));
    root.append('g').selectAll('path').data(base.data.features).join('path')
      .attr('class', (d) => 'gd-land' + (RS.has(d.properties.name) ? ' rs' : '')).attr('d', path);
    const feats = lay.data.features || [];
    root.append('g').selectAll('path').data(feats.filter((f) => f.properties.kind === 'range')).join('path').attr('class', 'gd-range').attr('d', path);
    // official IMMA boundaries (IUCN MMPATF), largest first so small areas stay on top
    const byNo = new Map(rows.map((r) => [r.no, r]));
    const pf = polys.data.features.slice().sort((a, b) => d3.geoArea(b) - d3.geoArea(a));
    const pg = root.append('g').selectAll('path').data(pf).join('path').attr('class', 'gd-immapoly').attr('d', path);

    const r = W < 480 ? 9 : 11;
    const pts = rows.map((d) => { const p = proj([+d.lon, +d.lat]); return { d, ax: p[0], ay: p[1], x: p[0], y: p[1] }; });
    // keep numbered badges apart; each stays tied to its true location by a leader line
    const sim = d3.forceSimulation(pts).stop()
      .force('x', d3.forceX((p) => p.ax).strength(0.25)).force('y', d3.forceY((p) => p.ay).strength(0.25))
      .force('c', d3.forceCollide(r + 3));
    for (let i = 0; i < 200; i++) sim.tick();
    pts.forEach((p) => { p.x = Math.max(r + 2, Math.min(W - r - 2, p.x)); p.y = Math.max(r + 2, Math.min(H - r - 2, p.y)); });
    const tip = GD.tip(el);
    root.append('g').selectAll('line').data(pts.filter((p) => Math.hypot(p.x - p.ax, p.y - p.ay) > r * 0.6)).join('line').attr('class', 'gd-lead')
      .attr('x1', (p) => p.ax).attr('y1', (p) => p.ay).attr('x2', (p) => p.x).attr('y2', (p) => p.y);
    root.append('g').selectAll('circle').data(pts).join('circle').attr('class', 'gd-anchor').attr('cx', (p) => p.ax).attr('cy', (p) => p.ay).attr('r', 2);
    const mk = root.append('g').selectAll('g').data(pts).join('g').attr('class', 'gd-imma').attr('transform', (p) => `translate(${p.x},${p.y})`);
    mk.append('circle').attr('r', r);
    mk.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').text((p) => p.d.no);
    const info = (d) => [d.countries, 'Guiana dolphin: ' + d.role.toLowerCase(), 'Criteria: ' + d.criteria, d3.format(',')(d.area_km2) + ' km² · recognised ' + d.year];
    const hl = (no) => pg.classed('on', (f) => f.properties.no === no);
    mk.on('pointermove pointerdown', (ev, p) => { hl(p.d.no); tip.show(ev, p.d.no + '. ' + p.d.name, info(p.d)); })
      .on('pointerleave', () => { hl(null); tip.hide(); });
    pg.on('pointermove pointerdown', (ev, f) => { const d = byNo.get(f.properties.no); if (!d) return; hl(d.no); tip.show(ev, d.no + '. ' + d.name, info(d)); })
      .on('pointerleave', () => { hl(null); tip.hide(); });

    // place-name hints for orientation, kept clear of the markers
    const hints = [['Atlantic Ocean', -40, 5], ['Caribbean Sea', -73.5, 15]];
    root.append('g').selectAll('text').data(hints).join('text').attr('class', 'gd-sea-lbl').attr('text-anchor', 'middle')
      .attr('x', (d) => proj([d[1], d[2]])[0]).attr('y', (d) => proj([d[1], d[2]])[1]).text((d) => d[0]);
  });

  dash.draw('imma_body', (tb) => {
    const g = GD.gate(tb, 'immas'); if (!g) return;
    fill(tb, g[0], [
      { cls: 'num', f: (r) => r.no },
      { cls: 'nw', f: (r) => h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', text: r.name }) },
      { f: (r) => r.countries },
      { f: (r) => r.role },
      { cls: 'nw', f: (r) => r.criteria },
      { cls: 'num', f: (r) => d3.format(',')(r.area_km2) },
      { cls: 'num', f: (r) => r.year }
    ]);
  });

  dash.draw('imma_n', (el) => { const s = ok('imma_stats'); el.textContent = s && s[0] ? s[0].n_immas : '—'; });
  dash.draw('imma_c', (el) => { const s = ok('imma_stats'); el.textContent = s && s[0] ? s[0].n_countries : '—'; });
  dash.draw('imma_q', (el) => { const s = ok('imma_stats'); el.textContent = s && s[0] ? s[0].n_qualifying : '—'; });
})();
