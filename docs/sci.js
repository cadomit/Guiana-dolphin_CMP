(function () {
/* Keyword-based themes: the title is tested first, then the abstract excerpt. First match wins. */
const SCI_THEMES = [
  ['Pollution and contaminants', /contamin|pollut|mercury|metal|pcb|organochlor|persistent organic|pesticide|plastic|debris|toxic|hydrocarbon|trace element/i],
  ['Fisheries and bycatch', /bycatch|by-catch|fisher|gillnet|\bnets?\b|entangle|incidental capture|fishing/i],
  ['Health and disease', /health|disease|pathogen|parasit|virus|morbilli|lesion|necropsy|strand|toxoplasm|lobomycosis|infect|immun|h(a)?ematolog|blood|microbio|bacteri/i],
  ['Acoustics and disturbance', /acoustic|whistle|sound|noise|echoloc|vessel|boat|tourism|watching|disturb|soundscape/i],
  ['Population, genetics and life history', /genetic|genom|population structure|phylogeo|abundance|density|survival|photo-ident|mark-recapture|life history|reproduc|growth|taxonom|mitochond|demograph/i],
  ['Habitat, ecology and behaviour', /habitat|distribution|movement|forag|feeding|diet|behavio|estuar|\bbay\b|ecolog|occurrence|climate|spatial|site fidelity|residen/i]
];
const SCI_OTHER = 'General or other';
const sciTheme = (title, text) => {
  for (const src of [String(title || ''), String(text || '')]) for (const [name, re] of SCI_THEMES) if (re.test(src)) return name;
  return SCI_OTHER;
};

dash.loader('scispace_live', {
  description: 'Reads the SciSpace search results and extracts year, first author, venue, citations and title; only records that name Sotalia guianensis or the Guiana dolphin are kept. A keyword-based theme is assigned from the title, then from the abstract excerpt.',
  fn: ({ answer }) => {
    let res = answer;
    if (typeof res === 'string') { try { res = JSON.parse(res); } catch (e) { res = {}; } }
    const list = (res && res.results) || [];
    const types = /^(Journal Article|Book Chapter|Dataset|Preprint|Review|Conference Paper|Book|Thesis)$/i;
    const data = list.filter((r) => /guianensis|guiana dolphin/i.test((r.title || '') + ' ' + (r.text || ''))).map((r) => {
      const head = String(r.text || '').split('\n')[0].split(' · ').map((s) => s.trim());
      const cite = head.find((s) => /^\d+\s+citations?$/i.test(s));
      const venue = head.slice(2).find((s) => s && !/citations?$/i.test(s) && !types.test(s)) || '';
      const title = String(r.title || '').replace(/<[^>]+>/g, '').replace(/\s*\(\s*\)/g, '').replace(/\s+/g, ' ').trim();
      return {
        year: Number(head[0]) || null,
        first_author: (head[1] || '').split(',')[0].trim(),
        title,
        venue,
        citations: cite ? Number(cite.match(/\d+/)[0]) : 0,
        theme: sciTheme(title, r.text),
        url: String(r.url || '').split('?')[0]
      };
    }).sort((a, b) => (b.year || 0) - (a.year || 0));
    return { data, columns: ['year', 'first_author', 'title', 'venue', 'citations', 'theme', 'url'], meta: [{ label: 'Records returned by SciSpace', value: String(list.length) }, { label: 'Records naming the species', value: String(data.length) }] };
  }
});

/* A filter whose choices come from data; shared with the later scripts. */
GD.select = (name, param, allLabel, src, vals) => dash.draw(name, (sel) => {
  const rows = GD.ok(src) || [];
  sel.replaceChildren(new Option(allLabel, ''), ...vals(rows).map((v) => (typeof v === 'string' ? new Option(v, v) : new Option(v.label, v.value))));
  sel.value = dash.params()[param] || '';
  sel.onchange = () => dash.setParams({ [param]: sel.value || null });
});

GD.select('f_sci_year', 'sci_year', 'All years', 'scispace_live', (rows) => [...new Set(rows.map((r) => r.year).filter(Boolean))].sort((a, b) => b - a).map(String));
GD.select('f_sci_theme', 'sci_theme', 'All themes', 'scispace_live', (rows) => [...SCI_THEMES.map((t) => t[0]), SCI_OTHER].filter((t) => rows.some((r) => r.theme === t)));

const sciRows = (rows) => {
  const p = dash.params();
  return rows.filter((r) => (!p.sci_year || String(r.year) === String(p.sci_year)) && (!p.sci_theme || r.theme === p.sci_theme));
};
dash.draw('sci_body', (el) => {
  const g = GD.gate(el, 'scispace_live'); if (!g) return;
  GD.fill(el, sciRows(g[0]), [
    { cls: 'nw', f: (r) => r.year || 'n.d.' },
    { f: (r) => r.first_author },
    { cls: 'wide', f: (r) => r.title },
    { f: (r) => r.venue },
    { f: (r) => GD.badge(r.theme, '') },
    { cls: 'num', f: (r) => (r.citations ? GD.fmt(r.citations) : '') },
    { cls: 'nw', f: (r) => (r.url ? GD.h('a', { href: r.url, target: '_blank', rel: 'noopener', text: 'SciSpace' }) : '') }
  ]);
});
dash.draw('sci_count', (el) => {
  const g = GD.gate(el, 'scispace_live'); if (!g) return;
  el.textContent = 'Showing ' + sciRows(g[0]).length + ' of ' + g[0].length + ' records';
});

})();
