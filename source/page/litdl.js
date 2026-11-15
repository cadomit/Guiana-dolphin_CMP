/* Download the literature tables (PubMed, SciSpace, most-cited) as CSV or PDF.
   Files are offered through the dashboard's downloads capability; the viewer confirms each save. */
(() => {
  const COLS = ['list', 'year', 'date', 'first_author', 'title', 'venue', 'citations', 'theme', 'link'];
  const HEAD = ['List', 'Year', 'Date', 'First author', 'Title', 'Journal or venue', 'Citations', 'Theme', 'Link'];
  const rowsNow = () => {
    const pm = GD.ok('pubmed_live') || [], sc = GD.ok('scispace_live') || [], lr = GD.ok('lit_records') || [];
    return [
      ...pm.map((r) => ({ list: 'PubMed (most recent)', year: String(r.date || '').slice(0, 4), date: r.date || '', first_author: r.first_author || '', title: r.title || '', venue: r.journal || '', citations: '', theme: '', link: r.doi ? 'https://doi.org/' + r.doi : '' })),
      ...sc.map((r) => ({ list: 'SciSpace (since 2015)', year: r.year == null ? '' : String(r.year), date: '', first_author: r.first_author || '', title: r.title || '', venue: r.venue || '', citations: r.citations ? String(r.citations) : '', theme: r.theme || '', link: r.url || '' })),
      ...lr.map((r) => ({ list: 'Most-cited works (OpenAlex)', year: r.year == null ? '' : String(r.year), date: '', first_author: r.first_author || '', title: r.title || '', venue: r.journal || '', citations: String(r.citations == null ? '' : r.citations), theme: '', link: r.doi || '' }))
    ];
  };
  const today = () => new Date().toISOString().slice(0, 10);

  const toCSV = (rows) => {
    const q = (v) => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [HEAD.map(q).join(','), ...rows.map((r) => COLS.map((c) => q(r[c])).join(','))].join('\r\n') + '\r\n';
  };

  // Minimal PDF writer: A4 landscape, Helvetica, text wrapped by estimated width.
  const toPDF = (rows, title) => {
    const W = 842, H = 595, M = 36, FS = 8.5, LH = 11;
    const latin = (s) => String(s == null ? '' : s).replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\xFF]/g, '?');
    const esc = (s) => latin(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const cw = FS * 0.5; // average Helvetica glyph width
    const wrap = (s, width) => {
      const out = []; let line = '';
      const maxC = Math.max(4, Math.floor(width / cw));
      const words = [];
      latin(s).split(/\s+/).forEach((w) => { while (w.length > maxC) { words.push(w.slice(0, maxC)); w = w.slice(maxC); } words.push(w); });
      words.forEach((w) => { const t = line ? line + ' ' + w : w; if (t.length * cw > width && line) { out.push(line); line = w; } else line = t; });
      if (line) out.push(line); return out.length ? out : [''];
    };
    const colX = [M, M + 34, M + 136, M + 430, M + 600];
    const colW = [30, 96, 288, 164, W - M - (M + 600)];
    const pages = []; let ops = [], y = H - M;
    const text = (x, yy, s, bold) => ops.push('BT /' + (bold ? 'F2' : 'F1') + ' ' + FS + ' Tf ' + x + ' ' + yy.toFixed(1) + ' Td (' + esc(s) + ') Tj ET');
    const newPage = () => { if (ops.length) pages.push(ops.join('\n')); ops = []; y = H - M; };
    const header = () => { ['Year', 'First author', 'Title', 'Journal or venue', 'Link'].forEach((h, i) => text(colX[i], y, h, true)); y -= LH + 2; };
    text(M, y, title, true); y -= LH * 1.6;
    let current = null;
    rows.forEach((r) => {
      if (r.list !== current) {
        current = r.list;
        if (y < M + LH * 4) newPage();
        y -= 4; text(M, y, current, true); y -= LH + 2; header();
      }
      const cells = [r.year || r.date, r.first_author, r.title, r.venue + (r.citations ? ' (' + r.citations + ' cit.)' : ''), r.link].map((v, i) => wrap(v, colW[i]));
      const n = Math.max(...cells.map((c) => c.length));
      if (y - n * LH < M) { newPage(); text(M, y, current + ' (continued)', true); y -= LH + 2; header(); }
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
      const footer = 'BT /F1 7 Tf ' + M + ' 18 Td (' + esc('Page ' + (i + 1) + ' of ' + pages.length) + ') Tj ET';
      const body = content + '\n' + footer;
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

  dash.draw('lit_dl', {
    mount(el) {
      const btns = [...document.querySelectorAll('[data-lit-dl]')];
      let downloads = null;
      const say = (msg) => { el.textContent = msg; };
      const go = async (kind) => {
        if (!downloads) return;
        const rows = rowsNow();
        if (!rows.length) { say('The literature tables have not loaded yet.'); return; }
        const name = 'guiana-dolphin-literature-' + today() + '.' + kind;
        const data = kind === 'csv' ? toCSV(rows) : toPDF(rows, 'Guiana dolphin (Sotalia guianensis): literature records, exported ' + today());
        say('Preparing ' + kind.toUpperCase() + '…');
        try {
          const res = await downloads.save({ filename: name, data });
          say(res && res.status === 'delivered' ? 'Sent.' : 'Saved ' + rows.length + ' records.');
        } catch (e) {
          const code = e && e.code;
          say(code === 'declined' ? '' : code === 'rate_limited' ? 'Another download is waiting for confirmation.' : 'Download is not available here.');
        }
      };
      btns.forEach((b) => { b.disabled = true; b.addEventListener('click', () => go(b.dataset.litDl)); });
      const api = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads') : Promise.resolve(null);
      Promise.resolve(api).then((d) => {
        downloads = d;
        btns.forEach((b) => { b.disabled = !d; b.style.display = d ? '' : 'none'; });
        if (!d) say('Downloads are not available in this view; rows can also be downloaded as CSV from Sources.');
      }).catch(() => btns.forEach((b) => { b.style.display = 'none'; }));
      return {};
    },
    update() {}
  });
})();
