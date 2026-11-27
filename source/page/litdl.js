/* File exports shared by the page: CSV and a minimal PDF writer, offered through the
   dashboard's downloads capability (the viewer confirms each save). The literature
   tables (PubMed, SciSpace, most-cited) use them here; other sections use GD.exporter. */
(() => {
  const latin = (s) => String(s == null ? '' : s).replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\xFF]/g, '?');

  const toCSV = (cols, rows) => {
    const q = (v) => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [cols.map((c) => q(c.label)).join(','), ...rows.map((r) => cols.map((c) => q(r[c.key])).join(','))].join('\r\n') + '\r\n';
  };

  // A4 landscape, Helvetica; cols: [{key, label, w}] with widths in points; rows grouped by groupKey.
  const toPDF = ({ title, subtitle, cols, rows, groupKey }) => {
    const W = 842, H = 595, M = 36, FS = 8.5, LH = 11, cw = FS * 0.5;
    const esc = (s) => latin(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const wrap = (s, width) => {
      const maxC = Math.max(4, Math.floor(width / cw)), words = [], out = []; let line = '';
      latin(s).split(/\s+/).forEach((w) => { while (w.length > maxC) { words.push(w.slice(0, maxC)); w = w.slice(maxC); } words.push(w); });
      words.forEach((w) => { const t = line ? line + ' ' + w : w; if (t.length * cw > width && line) { out.push(line); line = w; } else line = t; });
      if (line) out.push(line); return out.length ? out : [''];
    };
    const colX = []; let acc = M; cols.forEach((c) => { colX.push(acc); acc += c.w + 6; });
    const pages = []; let ops = [], y = H - M;
    const text = (x, yy, s, bold, size) => ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + (size || FS) + ' Tf ' + x + ' ' + yy.toFixed(1) + ' Td (' + esc(s) + ') Tj ET');
    const newPage = () => { if (ops.length) pages.push(ops.join('\n')); ops = []; y = H - M; };
    const header = () => { cols.forEach((c, i) => text(colX[i], y, c.label, true)); y -= LH + 2; };
    text(M, y, title, true, 11); y -= LH * 1.4;
    if (subtitle) wrap(subtitle, W - 2 * M).forEach((ln) => { text(M, y, ln); y -= LH; });
    y -= 4;
    let current = null;
    if (!groupKey) header();
    rows.forEach((r) => {
      if (groupKey && r[groupKey] !== current) {
        current = r[groupKey];
        if (y < M + LH * 4) newPage();
        y -= 4; text(M, y, current, true); y -= LH + 2; header();
      }
      const cells = cols.map((c) => wrap(r[c.key], c.w));
      const n = Math.max(...cells.map((c) => c.length));
      if (y - n * LH < M) { newPage(); if (groupKey) { text(M, y, current + ' (continued)', true); y -= LH + 2; } header(); }
      cells.forEach((c, i) => c.forEach((ln, k) => text(colX[i], y - k * LH, ln)));
      y -= n * LH + 3;
    });
    newPage();
    const objs = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const kids = [];
    pages.forEach((content, i) => {
      const pn = 5 + i * 2, cn = pn + 1; kids.push(pn + ' 0 R');
      const body = content + '\nBT /F1 7 Tf ' + M + ' 18 Td (' + esc('Page ' + (i + 1) + ' of ' + pages.length) + ') Tj ET';
      objs[pn] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + cn + ' 0 R >>';
      objs[cn] = '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream';
    });
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>';
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
    for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
    const xref = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n' + offs.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  };

  let dlPromise = null;
  const downloads = () => {
    if (!dlPromise) dlPromise = Promise.resolve(window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads') : null).catch(() => null);
    return dlPromise;
  };
  const today = () => new Date().toISOString().slice(0, 10);

  // Wire buttons [selector] to an export; say(msg) reports the outcome.
  // spec(kind) returns {name, cols, rows, title, subtitle, groupKey} or null when nothing is ready.
  GD.exporter = (btns, say, spec) => {
    btns.forEach((b) => { b.disabled = true; });
    downloads().then((d) => {
      btns.forEach((b) => { b.disabled = !d; b.style.display = d ? '' : 'none'; });
      if (!d) say('Downloads are not available in this view; rows can also be downloaded as CSV from Sources.');
    });
    btns.forEach((b) => b.addEventListener('click', async () => {
      const d = await downloads(); if (!d) return;
      const kind = b.dataset.kind || b.dataset.litDl, s = spec(kind);
      if (!s || !s.rows.length) { say('Nothing to download yet.'); return; }
      const data = kind === 'csv' ? toCSV(s.cols, s.rows) : toPDF(s);
      say('Preparing ' + kind.toUpperCase() + '…');
      try {
        const res = await d.save({ filename: s.name + '-' + today() + '.' + kind, data });
        say(res && res.status === 'delivered' ? 'Sent.' : 'Saved ' + s.rows.length + ' records.');
      } catch (e) {
        const code = e && e.code;
        say(code === 'declined' ? '' : code === 'rate_limited' ? 'Another download is waiting for confirmation.' : 'Download is not available here.');
      }
    }));
  };

  // Literature tables
  const LIT_COLS = [{ key: 'list', label: 'List', w: 0 }, { key: 'year', label: 'Year', w: 30 }, { key: 'date', label: 'Date', w: 0 }, { key: 'first_author', label: 'First author', w: 96 },
    { key: 'title', label: 'Title', w: 288 }, { key: 'venue', label: 'Journal or venue', w: 164 }, { key: 'citations', label: 'Citations', w: 0 }, { key: 'theme', label: 'Theme', w: 0 }, { key: 'link', label: 'Link', w: 166 }];
  const litRows = () => {
    const pm = GD.ok('pubmed_live') || [], sc = GD.ok('scispace_live') || [], lr = GD.ok('lit_records') || [];
    return [
      ...pm.map((r) => ({ list: 'PubMed (most recent)', year: String(r.date || '').slice(0, 4), date: r.date || '', first_author: r.first_author || '', title: r.title || '', venue: r.journal || '', citations: '', theme: '', link: r.doi ? 'https://doi.org/' + r.doi : '' })),
      ...sc.map((r) => ({ list: 'SciSpace (since 2015)', year: r.year == null ? '' : String(r.year), date: '', first_author: r.first_author || '', title: r.title || '', venue: r.venue || '', citations: r.citations ? String(r.citations) : '', theme: r.theme || '', link: r.url || '' })),
      ...lr.map((r) => ({ list: 'Most-cited works (OpenAlex)', year: r.year == null ? '' : String(r.year), date: '', first_author: r.first_author || '', title: r.title || '', venue: r.journal || '', citations: String(r.citations == null ? '' : r.citations), theme: '', link: r.doi || '' }))
    ];
  };
  dash.draw('lit_dl', {
    mount(el) {
      GD.exporter([...document.querySelectorAll('[data-lit-dl]')], (m) => { el.textContent = m; }, (kind) => {
        const rows = litRows().map((r) => Object.assign({}, r, { venue: kind === 'pdf' && r.citations ? r.venue + ' (' + r.citations + ' cit.)' : r.venue }));
        return { name: 'guiana-dolphin-literature', rows, groupKey: 'list',
          title: 'Guiana dolphin (Sotalia guianensis): literature records, exported ' + today(),
          cols: kind === 'csv' ? LIT_COLS : LIT_COLS.filter((c) => c.w) };
      });
      return {};
    },
    update() {}
  });
})();
