"""Extract the IMMAs that include Sotalia guianensis from the IUCN IMMA GeoJSON and simplify them
for the web map. Source: IUCN MMPATF (2025) Global Dataset of Important Marine Mammal Areas (IUCN-IMMA).
Usage: python3 build_imma_polygons.py <iucn-imma.geojson> <out.geojson> <immas.json>"""
import json, sys
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

src, out, rows_path = sys.argv[1:4]
EXCLUDE = {'Southern Brazil and Uruguay Coastal Ecosystems IMMA'}  # outside the species' range (owner's decision)
d = json.load(open(src))
rows = json.load(open(rows_path))
by_code = {r['code']: r for r in rows}

def rnd(o, k=3):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)): return [round(o[0], k), round(o[1], k)]
        return [rnd(x, k) for x in o]
    return o

feats = []
for f in d['features']:
    p = f['properties']
    if 'Sotalia guianensis' not in (str(p.get('Qualifying Sp')) + str(p.get('Supporting Sp'))): continue
    if p['Title'].strip() in EXCLUDE: continue
    g = shape(f['geometry'])
    if not g.is_valid: g = g.buffer(0)
    s = g.simplify(0.005, preserve_topology=True)
    if s.is_empty: s = g
    # d3-geo expects exterior rings clockwise (the reverse of RFC 7946), or it fills the rest of the globe
    s = MultiPolygon([orient(q, sign=-1.0) for q in getattr(s, 'geoms', [s]) if isinstance(q, Polygon)])
    code = p['Ident Code']
    r = by_code.get(code)
    if r is None: raise SystemExit('IMMA not in list: ' + p['Title'])
    pt = g.representative_point()
    r['lat'], r['lon'] = round(pt.y, 3), round(pt.x, 3)
    r['located'] = 'Official boundary'
    feats.append({'type': 'Feature', 'properties': {'code': code, 'name': r['name'], 'no': r['no']}, 'geometry': rnd(mapping(s))})
json.dump({'type': 'FeatureCollection', 'features': feats}, open(out, 'w'), separators=(',', ':'))
with open(rows_path, 'w') as fh:
    fh.write('[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n]\n')
print(len(feats), 'features')
