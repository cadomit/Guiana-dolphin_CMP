const gdRoot = document.querySelector('.gd');
if (gdRoot) gdRoot.style.setProperty('--gd-a', dash.colors[0]);
const GD = window.GD = {};

GD.ok = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : null; };
GD.gate = (el, ...ids) => {
  const out = [];
  for (const id of ids) {
    const d = dash.data(id);
    if (d.status === 'ok' && Array.isArray(d.data)) { out.push(d.data); continue; }
    if (['TBODY', 'SELECT', 'UL', 'OL'].includes(el.tagName)) el.replaceChildren();
    else el.textContent = d.status === 'error' ? 'Failed to load' : '—';
    return null;
  }
  return out;
};
GD.h = (tag, props, ...kids) => {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) { if (k == null) continue; e.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return e;
};
GD.badge = (text, cls) => GD.h('span', { class: 'gd-badge ' + (cls || ''), text });
GD.prio = (p) => GD.badge(p, { 'Very High': 'vh', 'High': 'hi', 'Medium': 'md' }[p] || '');
GD.fmt = d3.format(',d');
GD.tip = (box) => {
  const t = document.createElement('div'); t.className = 'gd-tip'; t.hidden = true; box.appendChild(t);
  return {
    show(ev, title, lines) {
      t.replaceChildren(GD.h('div', { class: 'gd-tip-h', text: title }), ...(lines || []).map((l) => GD.h('div', { text: l })));
      t.hidden = false;
      const b = box.getBoundingClientRect(); const w = t.offsetWidth, hh = t.offsetHeight;
      let x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 14;
      if (x + w > box.clientWidth) x = Math.max(0, ev.clientX - b.left - w - 12);
      if (y + hh > box.clientHeight) y = Math.max(0, ev.clientY - b.top - hh - 10);
      t.style.left = x + 'px'; t.style.top = y + 'px';
    },
    hide() { t.hidden = true; }
  };
};
GD.fill = (tbody, rows, cols) => {
  tbody.replaceChildren();
  if (!rows.length) { tbody.append(GD.h('tr', null, GD.h('td', { class: 'gd-empty', colspan: cols.length, text: 'No records match the current selection.' }))); return; }
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    cols.forEach((c) => { const td = document.createElement('td'); if (c.cls) td.className = c.cls; const v = c.f(r); if (v != null && v !== '') td.append(v.nodeType ? v : document.createTextNode(String(v))); tr.append(td); });
    tbody.append(tr);
  });
};
GD.more = (summary, text) => text ? GD.h('details', null, GD.h('summary', { text: summary }), GD.h('p', { text })) : null;
GD.trim = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/\.\s*$/, '').trim();

const CAT_WORD = { DD: 'Data Deficient', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered' };
GD.catWord = CAT_WORD;

dash.calc('kpi', {
  inputs: ['actions', 'mus', 'abundance', 'iwc', 'status'],
  title: 'Headline indicators',
  description: 'Counts and latest categories derived from the action plan, management units, abundance studies, IWC recommendations and status history.',
  fn: (actions, mus, abundance, iwc, status) => {
    const withEst = new Set(abundance.map((r) => r.mu));
    const gaps = mus.filter((m) => !withEst.has(m.mu)).map((m) => m.mu);
    const latest = (lvl, j) => status.filter((r) => r.level === lvl && (!j || r.jurisdiction === j) && r.year != null && r.category).sort((a, b) => b.year - a.year)[0] || {};
    const g = latest('Global'), n = latest('National', 'Brazil');
    return [{
      n_mus: mus.length, n_mus_est: mus.length - gaps.length, gap_mus: gaps.join(', '),
      n_actions: actions.length, n_vh: actions.filter((a) => a.priority === 'Very High').length,
      n_iwc: iwc.length, n_open: iwc.filter((r) => r.status === 'Open').length,
      global_cat: g.category, global_year: g.year, national_cat: n.category, national_year: n.year
    }];
  }
});

dash.calc('mu_cov', {
  inputs: ['mus', 'abundance'],
  title: 'Evidence coverage by management unit',
  description: 'Number of abundance studies and the lowest and highest bounds reported for each management unit.',
  fn: (mus, abundance) => mus.slice().sort((a, b) => a.order - b.order).map((m) => {
    const s = abundance.filter((r) => r.mu === m.mu);
    return { mu: m.mu, name: m.name, range: m.range, note: m.note, order: m.order, n_est: s.length, low: s.length ? d3.min(s, (r) => r.low) : null, high: s.length ? d3.max(s, (r) => r.high) : null };
  })
});

dash.calc('actions_by', {
  inputs: ['actions'],
  title: 'Actions by strategic line and priority',
  description: 'Number of planned actions in each strategic line, split by the priority assigned in the CMP.',
  fn: (actions) => {
    const names = { RES: 'Research', MON: 'Monitoring', MIT: 'Mitigation', PACB: 'Public awareness and capacity building' };
    const out = [];
    Object.keys(names).forEach((l) => ['Very High', 'High', 'Medium'].forEach((p) => {
      const n = actions.filter((x) => x.line === l && x.priority === p).length;
      if (n) out.push({ line: l, line_name: names[l], priority: p, n });
    }));
    return out;
  }
});

dash.calc('iwc_by', {
  inputs: ['iwc'],
  title: 'IWC recommendations by year and status',
  description: 'Number of recommendations in each year of adoption, split by current status.',
  fn: (iwc) => {
    const out = [];
    [...new Set(iwc.map((r) => r.year))].sort().forEach((y) => ['Open', 'Closed', 'Superseded'].forEach((s) => {
      const n = iwc.filter((r) => r.year === y && r.status === s).length;
      if (n) out.push({ year: String(y), status: s, n });
    }));
    return out;
  }
});

dash.calc('threat_cov', {
  inputs: ['cmp_threats', 'actions'],
  title: 'Action coverage of CMP threats',
  description: 'For each threat in the CMP summary, the number of linked actions and how many of them are Very High priority.',
  fn: (threats, actions) => threats.map((t) => {
    const ids = String(t.actions || '').split(';').map((s) => s.trim()).filter(Boolean);
    const hit = ids.map((id) => actions.find((a) => a.id === id)).filter(Boolean);
    return { threat: t.threat, kind: t.kind, cause: t.cause, evidence: t.evidence, impact: t.impact, priority: t.priority, urgent: t.urgent, n_actions: ids.length, n_vh: hit.filter((a) => a.priority === 'Very High').length, action_ids: ids.join(', ') };
  })
});

dash.calc('thr_stats', {
  inputs: ['threat_scores', 'fisheries'],
  title: 'Threat scoring completeness',
  description: 'Counts of scored, review-required and unscored rows in the overall and fisheries threat scoring forms.',
  fn: (t, f) => {
    const sc = t.filter((r) => r.status === 'Scored (provisional)');
    return [{
      n: t.length, scored: sc.length,
      review: t.filter((r) => r.status === 'Review required').length,
      unscored: t.filter((r) => r.status === 'Not scored').length,
      sev_unknown: sc.filter((r) => r.severity === 'Unknown').length,
      f_n: f.length,
      f_scored: f.filter((r) => r.status === 'Scored (provisional)').length,
      f_pending: f.filter((r) => r.status !== 'Scored (provisional)').length,
      f_quant: f.filter((r) => r.severity && r.severity !== 'Unknown').map((r) => r.gear).join('; ')
    }];
  }
});

dash.calc('thr_by_cat', {
  inputs: ['threat_scores'],
  title: 'Threat rows by category and scoring status',
  description: 'Number of rows of the overall threat scoring form in each threat category, split by scoring status.',
  fn: (t) => {
    const out = [];
    [...new Set(t.map((r) => r.category))].forEach((c) => ['Scored (provisional)', 'Review required', 'Not scored'].forEach((s) => {
      const n = t.filter((r) => r.category === c && r.status === s).length;
      if (n) out.push({ category: c, status: s, n });
    }));
    return out;
  }
});

dash.calc('gear_by', {
  inputs: ['fisheries'],
  title: 'Fishing gear rows by class and scoring status',
  description: 'Number of gear types in each gear class, split by scoring status.',
  fn: (f) => {
    const out = [];
    [...new Set(f.map((r) => r.gear_class))].forEach((c) => ['Scored (provisional)', 'Not scored', 'Unscored'].forEach((s) => {
      const n = f.filter((r) => r.gear_class === c && r.status === s).length;
      if (n) out.push({ gear_class: c, status: s, n });
    }));
    return out;
  }
});

dash.calc('lit_stats', {
  inputs: ['lit_years', 'pubmed_years'],
  title: 'Literature indicators',
  description: 'Totals and peak years of the open bibliographic snapshots (OpenAlex and PubMed); the current year is excluded from peaks.',
  fn: (oa, pm) => {
    const o = oa.slice().sort((a, b) => a.year - b.year), p = pm.slice().sort((a, b) => a.year - b.year);
    const full = o.filter((r) => !r.partial);
    const pk = full.reduce((a, b) => (b.articles > a.articles ? b : a));
    const part = o.find((r) => r.partial) || {};
    return [{
      oa_total: o.reduce((s, r) => s + r.articles, 0), oa_first: o[0].year,
      oa_last_year: full[full.length - 1].year, oa_last_n: full[full.length - 1].articles,
      oa_peak_year: pk.year, oa_peak_n: pk.articles, oa_partial_year: part.year, oa_partial_n: part.articles,
      pm_last_year: p.filter((r) => !r.partial).slice(-1)[0].year, pm_last_n: p.filter((r) => !r.partial).slice(-1)[0].articles
    }];
  }
});

dash.loader('lit_records', {
  description: 'Reads a JSON or delimited-text export (Scopus, Web of Science, OpenAlex or this dashboard\'s own format) and maps common column headings to year, first author, title, journal, citations and DOI.',
  fn: ({ answer }) => {
    const norm = (s) => String(s == null ? '' : s).replace(/^﻿/, '').trim().toLowerCase();
    let recs;
    if (Array.isArray(answer)) recs = answer;
    else if (typeof answer === 'string') {
      const text = answer.replace(/^﻿/, '');
      if (text.trim()[0] === '[') recs = JSON.parse(text);
      else {
        const first = text.split(/\r?\n/)[0];
        const delim = ['\t', ';', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
        const rows = []; let row = [], cell = '', q = false;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
          else if (c === '"') q = true;
          else if (c === delim) { row.push(cell); cell = ''; }
          else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
          else cell += c;
        }
        row.push(cell); if (row.some((x) => x !== '')) rows.push(row);
        const head = rows.shift().map(norm);
        recs = rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
      }
    } else throw new Error('The file content could not be read as JSON or delimited text.');
    const pick = (r, keys) => { const m = {}; for (const k of Object.keys(r)) m[norm(k)] = r[k]; for (const k of keys) if (m[k] != null && m[k] !== '') return m[k]; return ''; };
    const out = recs.map((r) => {
      const doi = String(pick(r, ['doi', 'di'])).trim();
      return {
        year: Number(String(pick(r, ['year', 'publication year', 'py', 'publication_year'])).slice(0, 4)) || null,
        first_author: String(pick(r, ['first_author', 'authors', 'author', 'au', 'author full names', 'authorships.author.display_name'])).split(/[;|]/)[0].trim(),
        title: String(pick(r, ['title', 'article title', 'ti', 'document title'])).trim(),
        journal: String(pick(r, ['journal', 'source title', 'publication name', 'so', 'primary_location.source.display_name'])).trim(),
        citations: Number(String(pick(r, ['citations', 'cited by', 'times cited, all databases', 'times cited, wos core', 'times cited', 'cited_by_count', 'z9', 'tc'])).replace(/[^0-9.]/g, '')) || 0,
        doi: /^10\./.test(doi) ? 'https://doi.org/' + doi : doi,
        source: String(pick(r, ['source', 'database', 'db']) || 'Imported file'),
        retrieved: String(pick(r, ['retrieved']))
      };
    }).filter((r) => r.title).sort((a, b) => b.citations - a.citations);
    return out;
  }
});

dash.loader('pubmed_live', {
  description: 'Fetches the title, journal, first author, date and DOI of each PubMed record returned by the search.',
  fn: async ({ answer, call }) => {
    const ids = (answer && answer.pmids) || [];
    const meta = [{ label: 'PubMed query as translated', value: String((answer && answer.query_translation) || '') }, { label: 'Records matching (all years)', value: String((answer && answer.total_count) != null ? answer.total_count : '') }];
    if (!ids.length) return { data: [], columns: ['pmid', 'date', 'first_author', 'title', 'journal', 'doi'], meta };
    const res = await call('get_article_metadata', { pmids: ids });
    const arts = (res && res.articles) || [];
    const data = arts.map((a) => {
      const d = a.publication_date || {}; const au = (a.authors || [])[0] || {};
      return {
        pmid: String((a.identifiers || {}).pmid || ''),
        date: [d.year, (/^[A-Za-z]{3}/.test(String(d.month || '')) ? String(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(String(d.month).slice(0, 3).toLowerCase()) + 1).padStart(2, '0') : d.month && String(d.month).padStart(2, '0')), d.day && String(d.day).padStart(2, '0')].filter(Boolean).join('-'),
        first_author: au.last_name ? au.last_name + (au.initials ? ' ' + au.initials : '') : '',
        title: String(a.title || '').replace(/\s*\(\s*\)/g, '').replace(/\s+/g, ' ').trim(),
        journal: String((a.journal && a.journal.title) || ''),
        doi: String((a.identifiers || {}).doi || '')
      };
    }).sort((x, y) => (y.date > x.date ? 1 : y.date < x.date ? -1 : 0));
    return { data, columns: ['pmid', 'date', 'first_author', 'title', 'journal', 'doi'], meta };
  }
});

/* Sentence and tile values, each bound to one marked cell. */
[
  ['kpi', {
    g_cat: (r) => CAT_WORD[r.global_cat] || r.global_cat, g_year: (r) => String(r.global_year),
    n_cat: (r) => CAT_WORD[r.national_cat] || r.national_cat, n_year: (r) => String(r.national_year),
    l_est: (r) => r.n_mus_est, l_mus: (r) => r.n_mus, l_vh: (r) => r.n_vh, l_act: (r) => r.n_actions, l_open: (r) => r.n_open,
    t_g: (r) => r.global_cat, t_n: (r) => r.national_cat, t_est: (r) => r.n_mus_est, t_act: (r) => r.n_actions, t_open: (r) => r.n_open,
    lbl_mus: (r) => r.n_mus, lbl_vh: (r) => r.n_vh, lbl_iwc: (r) => r.n_iwc, gap_list: (r) => r.gap_mus || 'none'
  }],
  ['thr_stats', {
    t_scored: (r) => r.scored, lbl_thr: (r) => r.n,
    s_n: (r) => r.n, s_scored: (r) => r.scored, s_review: (r) => r.review, s_unscored: (r) => r.unscored, s_unknown: (r) => r.sev_unknown,
    f_n: (r) => r.f_n, f_scored: (r) => r.f_scored, f_pending: (r) => r.f_pending, f_quant: (r) => r.f_quant || 'none'
  }],
  ['lit_stats', {
    o_total: (r) => GD.fmt(r.oa_total), o_first: (r) => r.oa_first, o_peak_year: (r) => r.oa_peak_year, o_peak_n: (r) => r.oa_peak_n,
    o_last_year: (r) => r.oa_last_year, o_last_n: (r) => r.oa_last_n, o_part_year: (r) => r.oa_partial_year, o_part_n: (r) => r.oa_partial_n,
    p_last_year: (r) => r.pm_last_year, p_last_n: (r) => r.pm_last_n
  }]
].forEach(([id, map]) => Object.entries(map).forEach(([name, f]) => dash.draw(name, (el) => {
  const d = dash.data(id);
  el.textContent = d.status === 'ok' && d.data && d.data[0] ? String(f(d.data[0])) : '—';
})));

/* Navigation and free-text filters listen only. */
const gdReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const t = document.getElementById(a.dataset.go);
  if (t) { t.scrollIntoView({ behavior: gdReduce ? 'auto' : 'smooth', block: 'start' }); dash.setLink(a.dataset.go); }
}));
document.querySelectorAll('input[data-param]').forEach((i) => i.addEventListener('input', () => dash.setParams({ [i.dataset.param]: i.value || null })));
