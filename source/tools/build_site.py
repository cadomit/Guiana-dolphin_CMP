"""Build the static GitHub Pages copy of the dashboard into site/.
Page files come from page/, data from data/, live sources from site/snapshots/."""
import json, glob, os, shutil, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(os.path.dirname(ROOT), 'docs')
LIVE_URL = 'https://claude.ai/artifact/79GgPWUJPym9LimjBMkvEd'
SNAP_DATE = '14 November 2026'

sources = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'datasets', '*.json'))):
    if f.endswith(',by-others'): continue
    ds = json.load(open(f)); sid = os.path.basename(f)[:-5]; s = ds['source']
    if s['kind'] == 'file':
        shutil.copy(os.path.join(ROOT, 'data', s['name']), os.path.join(SITE, 'data', s['name']))
        sources[sid] = {'file': 'data/' + s['name']}
    elif s.get('tool') == 'search_articles':
        sources[sid] = {'answer': 'snapshots/pubmed_search.json', 'calls': {'get_article_metadata': 'snapshots/pubmed_metadata.json'}, 'args': s['args']}
    elif s.get('connector') == 'SciSpace':
        sources[sid] = {'answer': 'snapshots/scispace_search.json', 'args': s['args']}
    else:
        raise SystemExit('unhandled source ' + sid)

shutil.copy(os.path.join(ROOT, 'page', 'app.css'), os.path.join(SITE, 'app.css'))
# in the dashboard each script runs in its own scope; anything shared goes on window
for n in ['app.js', 'draw.js', 'map.js', 'sci.js', 'evid.js']:
    src = open(os.path.join(ROOT, 'page', n)).read()
    open(os.path.join(SITE, n), 'w').write('(function () {\n' + src + '\n})();\n')

body = open(os.path.join(ROOT, 'page', 'index.html')).read()
body = body.replace('<meta name="dash-one-writer">', '').replace('<link rel="stylesheet" href="app.css">', '')
# the snapshot tables are no longer live: say so where the page says "live"
body = body.replace('Retrieved through the PubMed connector each time the dashboard is opened or refreshed.',
                    'Snapshot of the PubMed search taken on ' + SNAP_DATE + '; the live version refreshes on opening.')
body = body.replace('Retrieved through the SciSpace connector each time the dashboard is opened or refreshed.',
                    'Snapshot of the SciSpace search taken on ' + SNAP_DATE + '; the live version refreshes on opening.')
meta = json.load(open(os.path.join(ROOT, 'dash', 'meta.json')))
html = f'''<!doctype html>
<html lang="{meta.get('lang', 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{meta['title']}</title>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="app.css">
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script>window.DASH_SOURCES = {json.dumps(sources)};</script>
<script src="dash-runtime.js"></script>
</head>
<body>
<div class="site-banner">Static copy of the dashboard, data as of {SNAP_DATE}. The PubMed and SciSpace tables are snapshots. <a href="{LIVE_URL}">Open the live version on claude.ai</a> (access may be restricted).</div>
<div id="dash-root" lang="{meta.get('lang', 'en')}">
{body}
</div>
</body>
</html>
'''
open(os.path.join(SITE, 'index.html'), 'w').write(html)
open(os.path.join(SITE, '.nojekyll'), 'w').write('')
print(len(sources), 'sources;', sum(1 for v in sources.values() if 'answer' in v), 'snapshots')
