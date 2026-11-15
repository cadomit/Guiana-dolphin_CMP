/* At a glance: a graphical abstract of the sections below. Every figure is read from
   the same datasets and calculations as the detailed sections. */
dash.calc('ov_threats', {
  inputs: ['cmp_threats'],
  title: 'CMP threats: counts',
  description: 'Number of threats in the CMP summary table and how many carry High priority.',
  fn: (threats) => [{ n_threats: threats.length, n_high: threats.filter((t) => t.priority === 'High').length }]
});
dash.calc('ov_status', {
  inputs: ['status'],
  title: 'Latest category by jurisdiction',
  description: 'Most recent dated category for the IUCN global listing and for each national list; jurisdictions with no category found are left out.',
  fn: (status) => {
    const latest = new Map();
    status.filter((r) => (r.level === 'Global' || r.level === 'National') && r.category && r.year != null).forEach((r) => {
      const k = r.level === 'Global' ? 'IUCN (global)' : r.jurisdiction.replace(/ \(France\)$/, '');
      const p = latest.get(k); if (!p || r.year > p.year) latest.set(k, { jurisdiction: k, level: r.level, category: r.category, year: r.year });
    });
    return [...latest.values()];
  }
});

(() => {
  const { h } = GD;
  const CATS = ['DD', 'LC', 'NT', 'VU', 'EN', 'CR'];
  const CLS = { DD: 'dd', NT: 's1', VU: 's2', EN: 's3', CR: 's3' };
  const svgIn = (el, H, label) => d3.select(el).append('svg').attr('role', 'img').attr('aria-label', label)
    .attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${Math.max(200, el.clientWidth)} ${H}`);
  const stop = (el, ...ids) => {
    for (const id of ids) { const d = dash.data(id); if (d.status !== 'ok' || d.data == null) { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return true; } }
    el.replaceChildren(); return false;
  };
  const val = (id, f) => { const d = GD.ok(id); return d && d[0] ? d[0][f] : null; };

  // big numbers on the cards
  [['ov_g', 'kpi', 'global_cat'], ['ov_n', 'kpi', 'national_cat'], ['ov_est', 'kpi', 'n_mus_est'], ['ov_mus', 'kpi', 'n_mus'],
    ['ov_thr', 'ov_threats', 'n_threats'], ['ov_high', 'ov_threats', 'n_high'], ['ov_scored', 'thr_stats', 'scored'], ['ov_rows', 'thr_stats', 'n'],
    ['ov_act', 'kpi', 'n_actions'], ['ov_vh', 'kpi', 'n_vh'], ['ov_open', 'kpi', 'n_open'], ['ov_iwc', 'kpi', 'n_iwc'],
    ['ov_imma', 'imma_stats', 'n_immas'], ['ov_qual', 'imma_stats', 'n_qualifying'], ['ov_base', 'evid_stats', 'baseline'],
    ['ov_lo_id', 'evid_stats', 'lo_id'], ['ov_lo_n', 'evid_stats', 'lo_n']]
    .forEach(([name, id, f]) => dash.draw(name, (el) => { const v = val(id, f); el.textContent = v == null ? '—' : String(v); }));

  // Status: one scale from Data Deficient to Critically Endangered, one marker per jurisdiction
  dash.draw('ov_status_viz', (el) => {
    if (stop(el, 'ov_status')) return;
    const rows = dash.data('ov_status').data;
    const W = Math.max(200, el.clientWidth);
    const x = d3.scalePoint().domain(CATS).range([14, W - 14]);
    const by = d3.group(rows, (r) => r.category);
    const H = 34 + 12 * d3.max([...by.values()], (v) => v.length);
    const svg = svgIn(el, H, 'Latest conservation category for the IUCN global listing and each national list, on a scale from Data Deficient to Critically Endangered.');
    svg.append('line').attr('class', 'ov-axis').attr('x1', x('DD')).attr('x2', x('CR')).attr('y1', 14).attr('y2', 14);
    svg.append('g').selectAll('text').data(CATS).join('text').attr('x', (c) => x(c)).attr('y', 9).attr('text-anchor', 'middle').attr('class', 'ov-tick').text((c) => c);
    const tip = GD.tip(el);
    const pts = [];
    by.forEach((list, c) => list.sort((a, b) => (a.level === 'Global' ? -1 : 0) - (b.level === 'Global' ? -1 : 0)).forEach((r, i) => pts.push({ r, x: x(c), y: 26 + i * 12 })));
    svg.append('g').selectAll('circle').data(pts).join('circle').attr('class', (p) => 'gd-mk ' + (CLS[p.r.category] || 's1') + (p.r.level === 'Global' ? ' ov-global' : ''))
      .attr('cx', (p) => p.x).attr('cy', (p) => p.y).attr('r', 5)
      .on('pointermove pointerdown', (ev, p) => tip.show(ev, p.r.jurisdiction, [(GD.catWord[p.r.category] || p.r.category) + ' (' + p.r.year + ')']))
      .on('pointerleave', () => tip.hide());
  });

  // Populations: one square per management unit, north to south, shaded by the number of abundance studies
  const STEPS = [[0, 0, 'ov-empty', 'None'], [1, 1, 'gd-seg s1', '1'], [2, 3, 'gd-seg s2', '2–3'], [4, Infinity, 'gd-seg s3', '4 or more']];
  const stepOf = (n) => STEPS.find((st) => n >= st[0] && n <= st[1]);
  dash.draw('ov_mu_viz', (el) => {
    if (stop(el, 'mu_cov')) return;
    const rows = dash.data('mu_cov').data;
    const W = Math.max(200, el.clientWidth), n = rows.length, gap = 3;
    const s = Math.min(26, (W - gap * (n - 1)) / n);
    const svg = svgIn(el, s + 34, 'Management units from north to south, shaded by the number of abundance studies available for each; hollow squares have none.');
    const tip = GD.tip(el);
    const g = svg.append('g').selectAll('g').data(rows).join('g').attr('transform', (r, i) => `translate(${i * (s + gap)},0)`)
      .on('pointermove pointerdown', (ev, r) => tip.show(ev, r.mu + ' · ' + r.name, [r.range, r.n_est ? r.n_est + (r.n_est === 1 ? ' study' : ' studies') + '; ' + d3.format(',')(r.low) + (r.high !== r.low ? '–' + d3.format(',')(r.high) : '') + ' individuals' : 'No abundance estimate']))
      .on('pointerleave', () => tip.hide());
    g.append('rect').attr('class', (r) => stepOf(r.n_est)[2]).attr('width', s).attr('height', s).attr('rx', 3);
    g.append('text').attr('class', (r) => 'ov-n' + (r.n_est >= 2 ? ' inv' : '')).attr('x', s / 2).attr('y', s / 2 + 4).attr('text-anchor', 'middle').text((r) => (r.n_est ? r.n_est : ''));
    svg.append('text').attr('x', 0).attr('y', s + 13).attr('class', 'ov-tick').text('North');
    svg.append('text').attr('x', (n - 1) * (s + gap) + s).attr('y', s + 13).attr('text-anchor', 'end').attr('class', 'ov-tick').text('South');
    // legend
    const lg = svg.append('g').attr('transform', `translate(0,${s + 22})`);
    lg.append('text').attr('class', 'ov-tick').attr('y', 9).text('Studies:');
    let lx = 44;
    STEPS.forEach((st) => {
      lg.append('rect').attr('class', st[2]).attr('x', lx).attr('y', 0).attr('width', 10).attr('height', 10).attr('rx', 2);
      const t = lg.append('text').attr('class', 'ov-tick').attr('x', lx + 13).attr('y', 9).text(st[3]);
      lx += 13 + t.node().getComputedTextLength() + 10;
    });
  });

  // Threats: the CMP threats by name, with their kind of impact
  dash.draw('ov_thr_list', (ul) => {
    const g = GD.gate(ul, 'cmp_threats'); if (!g) return;
    ul.replaceChildren(...g[0].map((t) => h('li', null,
      h('span', { class: 'ov-li-t', text: String(t.threat).replace(/\s*\(.*\)\s*$/, '') }),
      h('span', { class: 'ov-li-k', text: t.kind + (t.evidence ? ' · ' + String(t.evidence).toLowerCase() + ' evidence' : '') }))));
  });

  // Threats: share of scoring rows done
  dash.draw('ov_thr_viz', (el) => {
    if (stop(el, 'thr_stats')) return;
    const t = dash.data('thr_stats').data[0];
    const W = Math.max(200, el.clientWidth);
    const x = d3.scaleLinear().domain([0, t.n]).range([0, W]);
    const svg = svgIn(el, 26, 'Threat scoring form: rows scored provisionally, requiring review and not scored.');
    const parts = [['Scored (provisional)', t.scored, 's3'], ['Review required', t.review, 's2'], ['Not scored', t.unscored, 's1']];
    let acc = 0; const tip = GD.tip(el);
    svg.append('g').selectAll('rect').data(parts.map((p) => { const o = { p, x0: acc }; acc += p[1]; return o; })).join('rect')
      .attr('class', (d) => 'gd-seg ' + d.p[2]).attr('x', (d) => x(d.x0)).attr('y', 4).attr('width', (d) => Math.max(0, x(d.p[1]) - 2)).attr('height', 14).attr('rx', 3)
      .on('pointermove pointerdown', (ev, d) => tip.show(ev, d.p[0], [d.p[1] + ' of ' + t.n + ' rows'])).on('pointerleave', () => tip.hide());
  });

  // Actions: one numbered square per action, by strategic line; shade = priority,
  // orange outline = fewer published records than the evidence threshold
  dash.draw('ov_act_viz', (el) => {
    if (stop(el, 'actions', 'evid_cmp', 'evid_stats')) return;
    const acts = dash.data('actions').data, ev = dash.data('evid_cmp').data, thr = dash.data('evid_stats').data[0].thr;
    const cnt = new Map(ev.map((e) => [e.id, e.count]));
    const lines = [['RES', 'Research'], ['MON', 'Monitoring'], ['MIT', 'Mitigation'], ['PACB', 'Awareness']];
    const PCLS = { 'Very High': 's3', High: 's2', Medium: 's1' };
    const W = Math.max(200, el.clientWidth), gap = 3, rowGap = 7;
    const svg = svgIn(el, 10, 'Planned actions by strategic line, numbered within each line; darker squares have higher priority and an orange outline marks actions with few published records.');
    const tip = GD.tip(el);
    const lab = svg.append('g').selectAll('text').data(lines).join('text').attr('class', 'gd-lbl ov-rowlbl').text((l) => l[1]);
    let lw = 0; lab.each(function () { lw = Math.max(lw, this.getComputedTextLength()); });
    const x0 = Math.min(lw + 8, W * 0.4);
    const maxN = d3.max(lines, (l) => acts.filter((r) => r.line === l[0]).length);
    const countW = 58;
    const s = Math.max(14, Math.min(24, (W - x0 - countW - gap * (maxN - 1)) / maxN));
    lines.forEach((l, i) => {
      const y = i * (s + rowGap);
      const a = acts.filter((r) => r.line === l[0]);
      lab.filter((d) => d === l).attr('y', y + s / 2 + 4);
      const g = svg.append('g').selectAll('g').data(a).join('g').attr('transform', (r, k) => `translate(${x0 + k * (s + gap)},${y})`)
        .on('pointermove pointerdown', (ev2, r) => {
          const c = cnt.get(r.id);
          tip.show(ev2, r.id + ' · ' + r.priority, [r.title, c == null ? 'Not measured by a literature count' : c + ' published records' + (c < thr ? ' (fewer than ' + thr + ')' : '')]);
        })
        .on('pointerleave', () => tip.hide());
      g.append('rect').attr('class', (r) => 'gd-seg ' + (PCLS[r.priority] || 's1') + (cnt.get(r.id) != null && cnt.get(r.id) < thr ? ' ov-low' : ''))
        .attr('width', s).attr('height', s).attr('rx', 3);
      if (s >= 13) g.append('text').attr('class', (r) => 'ov-n' + (r.priority !== 'Medium' ? ' inv' : '')).style('font-size', s < 18 ? '9.5px' : null).attr('x', s / 2).attr('y', s / 2 + 4).attr('text-anchor', 'middle')
        .text((r) => String(Number(String(r.id).split('#')[1])));
      const vh = a.filter((r) => r.priority === 'Very High').length;
      svg.append('text').attr('class', 'ov-tick').attr('x', x0 + a.length * (s + gap) + 4).attr('y', y + s / 2 + 4).text(a.length + ' · ' + vh + ' VH');
    });
    // legend
    const ly = lines.length * (s + rowGap) + 4;
    const lg = svg.append('g').attr('transform', `translate(0,${ly})`);
    let lx = 0, row = 0;
    [['gd-seg s3', 'Very High (VH)'], ['gd-seg s2', 'High'], ['gd-seg s1', 'Medium'], ['ov-lowkey', 'Under ' + thr + ' records']].forEach((k) => {
      const t = lg.append('text').attr('class', 'ov-tick').text(k[1]);
      const tw = t.node().getComputedTextLength() + 25;
      if (lx + tw > W && lx > 0) { lx = 0; row++; }
      lg.append('rect').attr('class', k[0]).attr('x', lx).attr('y', row * 14).attr('width', 10).attr('height', 10).attr('rx', 2);
      t.attr('x', lx + 13).attr('y', row * 14 + 9);
      lx += tw;
    });
    const H = ly + (row + 1) * 14 + 2;
    svg.attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  });

  // IWC: one dot per recommendation, open ones dark
  dash.draw('ov_iwc_viz', (el) => {
    if (stop(el, 'iwc')) return;
    const recs = dash.data('iwc').data.slice().sort((a, b) => (a.status === 'Open' ? -1 : 0) - (b.status === 'Open' ? -1 : 0));
    const W = Math.max(200, el.clientWidth), d = 12, perRow = Math.max(1, Math.floor(W / (d + 4)));
    const rowsN = Math.ceil(recs.length / perRow);
    const svg = svgIn(el, rowsN * (d + 4), 'IWC Scientific Committee recommendations; dark dots are still open.');
    const tip = GD.tip(el);
    svg.append('g').selectAll('circle').data(recs).join('circle')
      .attr('class', (r) => 'gd-mk ' + (r.status === 'Open' ? 's3' : 's1')).attr('r', d / 2)
      .attr('cx', (r, i) => (i % perRow) * (d + 4) + d / 2 + 1).attr('cy', (r, i) => Math.floor(i / perRow) * (d + 4) + d / 2 + 1)
      .on('pointermove pointerdown', (ev, r) => tip.show(ev, r.id + ' · ' + r.status + ' (' + r.year + ')', [r.summary])).on('pointerleave', () => tip.hide());
  });

  // IMMAs: one dot per area, north to south; filled where the species qualifies
  dash.draw('ov_imma_viz', (el) => {
    if (stop(el, 'immas')) return;
    const rows = dash.data('immas').data;
    const W = Math.max(200, el.clientWidth), n = rows.length, d = Math.min(14, (W - 2) / n - 3);
    const svg = svgIn(el, d + 18, 'Important Marine Mammal Areas from north to south; filled dots list the Guiana dolphin as a qualifying species.');
    const tip = GD.tip(el);
    svg.append('g').selectAll('circle').data(rows).join('circle')
      .attr('class', (r) => (/^Qualifying/.test(r.role) ? 'gd-mk s3' : 'ov-hollow')).attr('r', d / 2)
      .attr('cx', (r, i) => i * (W - d) / Math.max(1, n - 1) + d / 2).attr('cy', d / 2 + 1)
      .on('pointermove pointerdown', (ev, r) => tip.show(ev, r.name, [r.countries, r.role])).on('pointerleave', () => tip.hide());
    svg.append('text').attr('x', 0).attr('y', d + 15).attr('class', 'ov-tick').text('North');
    svg.append('text').attr('x', W).attr('y', d + 15).attr('text-anchor', 'end').attr('class', 'ov-tick').text('South');
  });

  // Flow: CMP threats -> linked actions -> published evidence for each action.
  // Wide: curves from each threat to its actions. Narrow: a dot matrix (threat x action).
  dash.draw('ov_flow', (el) => {
    if (stop(el, 'cmp_threats', 'evid_cmp', 'evid_stats')) return;
    const threats = dash.data('cmp_threats').data, acts = dash.data('evid_cmp').data, thr = dash.data('evid_stats').data[0].thr;
    const W = Math.max(280, el.clientWidth), narrow = W < 640;
    const short = (t) => String(t.threat).replace(/\s*\(.*\)\s*$/, '');
    const abbr = threats.map((t) => short(t).charAt(0).toUpperCase());
    const actIndex = new Map(acts.map((a, i) => [a.id, i]));
    const links = [];
    threats.forEach((t, ti) => String(t.actions || '').split(';').map((x) => x.trim()).filter((id) => actIndex.has(id)).forEach((id) => links.push({ ti, ai: actIndex.get(id), t })));
    const linked = new Set(links.map((l) => l.ai));
    const rowH = narrow ? 20 : 22;
    const legendH = narrow ? 14 * Math.ceil(threats.length / 2) + 6 : 0;
    const top = 22 + legendH, H = top + acts.length * rowH + 16;
    const svg = svgIn(el, H, 'Diagram linking the four threats of the CMP to the actions that address them, with the number of published records available for each action.');
    const tip = GD.tip(el);
    const ay = (i) => top + i * rowH + rowH / 2;
    let idX, lk, tg;
    if (!narrow) {
      const leftW = Math.round(W * 0.22);
      idX = leftW + Math.round(W * 0.16) + 60;
      const ty = (i) => top + (i + 0.5) * (acts.length * rowH) / threats.length;
      svg.append('text').attr('class', 'gd-head').attr('x', 0).attr('y', 12).text('CMP threat');
      const path = (l) => { const x0 = leftW + 4, x1 = idX - 64, y0 = ty(l.ti), y1 = ay(l.ai), mx = (x0 + x1) / 2; return `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`; };
      lk = svg.append('g').selectAll('path').data(links).join('path').attr('class', 'ov-link').attr('d', path);
      tg = svg.append('g').selectAll('g').data(threats).join('g').attr('class', 'ov-threat').attr('transform', (t, i) => `translate(0,${ty(i)})`);
      tg.each(function (t) {
        const words = short(t).split(' '), maxC = Math.max(10, Math.floor((leftW - 14) / 6.8));
        const lines = []; let cur = '';
        words.forEach((w) => { if ((cur + ' ' + w).trim().length > maxC && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
        lines.push(cur);
        const n = Math.min(3, lines.length), bh = 10 + n * 14;
        d3.select(this).append('rect').attr('x', 0).attr('y', -bh / 2).attr('width', leftW).attr('height', bh).attr('rx', 6);
        const txt = d3.select(this).append('text').attr('class', 'gd-lbl').attr('y', -((n - 1) * 14) / 2 + 4);
        lines.slice(0, 3).forEach((ln, k) => txt.append('tspan').attr('x', 8).attr('dy', k ? 14 : 0).text(ln));
      });
    } else {
      const cw = 18;
      threats.forEach((t, i) => svg.append('text').attr('class', 'ov-tick').attr('x', (i % 2) * (W / 2)).attr('y', 10 + Math.floor(i / 2) * 14).text(abbr[i] + ' · ' + short(t)));
      idX = threats.length * cw + 58;
      tg = svg.append('g').selectAll('g').data(threats).join('g').attr('class', 'ov-threat').attr('transform', (t, i) => `translate(${i * cw + cw / 2},0)`);
      tg.append('text').attr('class', 'gd-head').attr('text-anchor', 'middle').attr('y', top - 6).text((t, i) => abbr[i]);
      tg.append('line').attr('class', 'ov-col').attr('y1', top).attr('y2', top + acts.length * rowH);
      lk = svg.append('g').selectAll('circle').data(links).join('circle').attr('class', 'ov-dot')
        .attr('cx', (l) => l.ti * cw + cw / 2).attr('cy', (l) => ay(l.ai)).attr('r', 4.5);
    }
    tg.on('pointerenter', (ev, t) => lk.classed('on', (l) => l.t === t)).on('pointerleave', () => { lk.classed('on', false); tip.hide(); })
      .on('pointermove pointerdown', (ev, t) => tip.show(ev, short(t), [t.priority + ' priority · ' + t.kind, 'Evidence of impact: ' + t.evidence]));
    const barX0 = idX + 10, barX1 = W - 30;
    svg.append('text').attr('class', 'gd-head').attr('x', idX).attr('y', top - 6).attr('text-anchor', 'end').text('Action');
    svg.append('text').attr('class', 'gd-head').attr('x', barX0).attr('y', top - 6).text(narrow ? 'Records' : 'Published records');
    const mx = d3.max(acts, (a) => a.count || 0) || 1;
    const x = d3.scaleLinear().domain([0, mx]).range([barX0, barX1]);
    svg.append('line').attr('class', 'ov-thr').attr('x1', x(thr)).attr('x2', x(thr)).attr('y1', top - 2).attr('y2', H - 14);
    const ag = svg.append('g').selectAll('g').data(acts).join('g').attr('transform', (a, i) => `translate(0,${ay(i)})`);
    ag.append('text').attr('x', idX).attr('y', 4).attr('text-anchor', 'end').attr('class', (a, i) => (linked.has(i) ? 'gd-lbl' : '') + (a.priority === 'Very High' ? ' ov-vh' : '')).text((a) => a.id);
    ag.filter((a) => a.count != null).append('rect').attr('class', (a) => 'gd-seg ' + (a.priority === 'Very High' ? 's3' : 's2') + (a.count < thr ? ' ov-low' : ''))
      .attr('x', barX0).attr('y', -6).attr('height', 12).attr('rx', 2).attr('width', (a) => Math.max(2, x(a.count) - barX0));
    ag.filter((a) => a.count != null).append('text').attr('x', (a) => x(a.count) + 4).attr('y', 4).text((a) => a.count);
    ag.filter((a) => a.count == null).append('text').attr('class', 'gd-gap').attr('x', barX0 + 4).attr('y', 4).text(narrow ? 'not measured' : 'not measured by a literature count');
    ag.append('rect').attr('class', 'gd-hit').attr('x', idX - 60).attr('y', -rowH / 2).attr('width', W - idX + 60).attr('height', rowH)
      .on('pointerenter', (ev, a) => lk.classed('on', (l) => acts[l.ai] === a)).on('pointerleave', () => { lk.classed('on', false); tip.hide(); })
      .on('pointermove pointerdown', (ev, a) => tip.show(ev, a.id + ' · ' + a.priority, [a.label, a.count == null ? 'Not measured by a literature count' : a.count + ' records', threats.filter((t) => links.some((l) => l.t === t && acts[l.ai] === a)).map(short).join('; ') || 'Not linked to a CMP threat']));
    svg.append('text').attr('class', 'ov-tick').attr('x', x(thr) + 3).attr('y', H - 2).text(thr + ' records');
  });

  // cards open their section
  document.querySelectorAll('.ov-card[data-go]').forEach((c) => c.addEventListener('keydown', (e) => { if (e.key === 'Enter') c.click(); }));
})();
