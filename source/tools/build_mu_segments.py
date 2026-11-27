"""Split the species' coastal occurrence line (data/map_layers.json) into management-unit segments.
Breakpoints are approximate coastal boundaries taken from the CMP's description of each unit (CMP 5.2)."""
import json, math
lay = json.load(open('data/map_layers.json'))
line = next(f for f in lay['features'] if f['properties']['kind'] == 'range')['geometry']['coordinates']
# (unit, end point of the unit along the coast, boundary described)
BREAKS = [
 ('CCOL',  (-71.32, 11.85), 'Colombia–Venezuela border (Castilletes)'),
 ('VEML',  (-70.05, 11.70), 'Paraguaná Peninsula, east side of the Gulf of Venezuela'),
 (None,    (-62.30, 10.65), 'Gulf of Paria (Venezuelan Caribbean coast not assigned to a unit)'),
 ('VEOR',  (-59.99, 8.55),  'Venezuela–Guyana border'),
 ('FRGU',  (-51.62, 4.38),  'French Guiana–Brazil border (Oiapoque)'),
 ('BRNO',  (-46.10, -1.10), 'Pará–Maranhão border (Gurupi River)'),
 ('BRNE1', (-37.25, -4.83), 'Ceará–Rio Grande do Norte border'),
 ('BRNE2', (-35.15, -8.88), 'Pernambuco–Alagoas border'),
 ('BRNE3', (-38.00, -12.55),'north of Todos os Santos Bay, Bahia'),
 ('BRNE4', (-39.66, -18.35),'Bahia–Espírito Santo border'),
 ('BRSE1', (-42.02, -22.88),'Cabo Frio, northern Rio de Janeiro'),
 ('BRSE2', (-46.10, -23.85),'Bertioga, northern São Paulo'),
 ('BRS/SE',(-48.64, -27.56),'southern limit of the species (Santa Catarina)'),
]
def nearest(pt, start):
    return min(range(start, len(line)), key=lambda i: (line[i][0] - pt[0]) ** 2 + (line[i][1] - pt[1]) ** 2)
feats, i0 = [], 0
for mu, pt, desc in BREAKS:
    i1 = nearest(pt, i0)
    seg = line[i0:i1 + 1]
    if mu and len(seg) > 1:
        feats.append({'type': 'Feature', 'properties': {'mu': mu, 'end': desc}, 'geometry': {'type': 'LineString', 'coordinates': seg}})
    elif not mu:
        feats.append({'type': 'Feature', 'properties': {'mu': '', 'end': desc}, 'geometry': {'type': 'LineString', 'coordinates': seg}})
    i0 = i1
json.dump({'type': 'FeatureCollection', 'features': feats}, open('data/mu_segments.json', 'w'), separators=(',', ':'))
for f in feats: print(f['properties']['mu'] or '(none)', len(f['geometry']['coordinates']), f['geometry']['coordinates'][0], f['geometry']['coordinates'][-1])
