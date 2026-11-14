"""Build the map layers for the IMMA section from Natural Earth 1:50m (world-atlas@2.0.2).
Usage: python3 build_map_layers.py <world-atlas dir> <out dir>"""
import json, sys, math
from shapely.geometry import shape, box, mapping, LineString, Point
from shapely.ops import unary_union

src, out = sys.argv[1], sys.argv[2]
BBOX = box(-92, -37, -28, 22)

def decode(topo, obj):
    sc, tr = topo['transform']['scale'], topo['transform']['translate']
    arcs = []
    for a in topo['arcs']:
        x = y = 0; pts = []
        for dx, dy in a:
            x += dx; y += dy; pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)
    def ring(ids):
        pts = []
        for i in ids:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts.extend(seg if not pts else seg[1:])
        return pts
    feats = []
    for g in topo['objects'][obj]['geometries']:
        if g['type'] == 'Polygon': geom = {'type': 'Polygon', 'coordinates': [ring(r) for r in g['arcs']]}
        elif g['type'] == 'MultiPolygon': geom = {'type': 'MultiPolygon', 'coordinates': [[ring(r) for r in p] for p in g['arcs']]}
        else: continue
        feats.append((g.get('properties', {}).get('name', ''), shape(geom).buffer(0)))
    return feats

def rnd(o, d=2):
    if isinstance(o, (list, tuple)):
        if o and isinstance(o[0], (int, float)): return [round(o[0], d), round(o[1], d)]
        return [rnd(x, d) for x in o]
    return o

# 1. Countries, clipped and simplified
countries = decode(json.load(open(f'{src}/countries-50m.json')), 'countries')
base = []
for name, g in countries:
    c = g.intersection(BBOX)
    if c.is_empty: continue
    c = c.simplify(0.03, preserve_topology=True)
    if c.is_empty or c.area < 0.01 or name == 'Fiji': continue
    base.append({'type': 'Feature', 'properties': {'name': name}, 'geometry': rnd(mapping(c))})
json.dump({'type': 'FeatureCollection', 'features': base}, open(f'{out}/basemap_countries.json', 'w'), separators=(',', ':'))

# 2. Mainland Americas coastline ring
land = decode(json.load(open(f'{src}/land-50m.json')), 'land')
probe = Point(-60, -10)
geoms = [p for _, g in land for p in getattr(g, 'geoms', [g])]
main = next(p for p in geoms if p.contains(probe))
ring = list(main.exterior.coords)[:-1]
n = len(ring)
def nearest(lon, lat): return min(range(n), key=lambda i: (ring[i][0] - lon) ** 2 + (ring[i][1] - lat) ** 2)
def arc(a, b, via):
    """Coast between a and b, taking the way round that passes nearest to `via`."""
    i, j, v = nearest(*a), nearest(*b), nearest(*via)
    fwd = [(i + k) % n for k in range(((j - i) % n) + 1)]
    bwd = [(i - k) % n for k in range(((i - j) % n) + 1)]
    path = fwd if v in fwd else bwd
    # Natural Earth's land ring is joined to Africa at a seam (~16.5S); keep only the American side.
    pts = [ring[k] for k in path if -86 < ring[k][0] < -34 and -28 < ring[k][1] < 17]
    ls = LineString(pts).simplify(0.04)
    return rnd(list(ls.coords))

layers = [
    {'type': 'Feature', 'properties': {'kind': 'range', 'name': 'Approximate occurrence: coastal waters from Honduras to Santa Catarina'},
     'geometry': {'type': 'LineString', 'coordinates': arc((-84.4, 15.8), (-48.55, -27.6), (-52.5, 5.0))}},
    {'type': 'Feature', 'properties': {'kind': 'imma', 'name': 'Guianas to Amazon Outflow'},
     'geometry': {'type': 'LineString', 'coordinates': arc((-55.2, 5.95), (-44.3, -2.4), (-51.5, 4.0))}},
    {'type': 'Feature', 'properties': {'kind': 'imma', 'name': 'Urabá to Morrosquillo'},
     'geometry': {'type': 'LineString', 'coordinates': arc((-77.0, 8.6), (-75.6, 9.6), (-76.5, 8.9))}},
    {'type': 'Feature', 'properties': {'kind': 'imma', 'name': 'Punta Mona to Bocas del Toro Archipelago'},
     'geometry': {'type': 'LineString', 'coordinates': arc((-82.62, 9.63), (-82.15, 9.2), (-82.45, 9.45))}},
]
json.dump({'type': 'FeatureCollection', 'features': layers}, open(f'{out}/map_layers.json', 'w'), separators=(',', ':'))
for f in layers: print(f['properties']['name'], len(f['geometry']['coordinates']), 'pts')
