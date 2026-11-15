(function () {
/* Works cited in the tables, collected from the source fields of the datasets. */
dash.calc('refs_cited', {
  inputs: ['abundance', 'status', 'salve'],
  title: 'Works cited in the tables',
  description: 'Author–year citations collected from the source columns of the abundance, status and SALVE indicator tables; acts and datasets listed under Data sources are left out.',
  fn: (abundance, status, salve) => {
    const SKIP = /^(SALVE|IUCN|Libro Rojo|MADS|UICN|São Paulo State Decree|Rio de Janeiro Municipal|No |Project presentation|Farro et al)/;
    const used = new Map();
    const add = (src, where) => (/^No /.test(String(src || '')) ? [] : String(src || '').split(';')).forEach((part) => {
      let c = part.trim().replace(/,\s*(cited in SALVE|per CMP|SALVE)\b.*$/, '').replace(/\s+/g, ' ').trim();
      if (!c || SKIP.test(c) || !/\(\d{4}\)/.test(c)) return;
      if (!used.has(c)) used.set(c, new Set());
      used.get(c).add(where);
    });
    abundance.forEach((r) => add(r.source, 'abundance'));
    status.forEach((r) => add(r.source, 'conservation status'));
    salve.forEach((r) => add(r.source, 'SALVE indicators'));
    return [...used.entries()].map(([citation, w]) => ({ citation, used_in: [...w].join(', ') }))
      .sort((a, b) => a.citation.localeCompare(b.citation, 'pt'));
  }
});
dash.draw('refs_list', (ul) => {
  const d = dash.data('refs_cited');
  if (d.status !== 'ok' || !Array.isArray(d.data)) { ul.replaceChildren(); return; }
  ul.replaceChildren(...d.data.map((r) => GD.h('li', null, r.citation, ' ', GD.h('span', { class: 'gd-ref-k', text: '(' + r.used_in + ')' }))));
});

})();
