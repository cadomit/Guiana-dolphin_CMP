"""Build the RMU x stressor evidence table from PubMed and SciSpace records.
Each record is kept only if it names the Guiana dolphin; it is assigned to management units by place names
and to stressors by keywords found in the title (weight 3) or abstract (weight 1); a stressor needs a score >= 2 (>= 1 when the title concerns threats or conservation).
Usage: python3 -I build_threat_corpus.py <out.json> <pubmed json files...> -- <scispace json files...>"""
import json, re, sys, unicodedata

out_path = sys.argv[1]
args = sys.argv[2:]; i = args.index('--'); pm_files, sc_files = args[:i], args[i + 1:]

def norm(s): return unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
def ntitle(s): return re.sub(r'[^a-z0-9]+', ' ', norm(s)).strip()

recs = {}
for f in pm_files:
    for a in json.load(open(f))['articles']:
        t = a.get('title') or ''; ab = a.get('abstract') or ''
        au = (a.get('authors') or [{}])[0]
        y = (a.get('publication_date') or {}).get('year') or (a.get('electronic_publication_date') or {}).get('year')
        doi = (a.get('identifiers') or {}).get('doi') or a.get('doi') or ''
        k = ntitle(t)[:70]
        recs[k] = {'title': re.sub(r'\s+', ' ', t).strip(), 'abstract': ab, 'year': int(y) if y else None,
                   'first_author': (au.get('last_name') or '') + (' ' + au['initials'] if au.get('initials') else ''),
                   'venue': (a.get('journal') or {}).get('title') or '', 'doi': doi,
                   'pmid': (a.get('identifiers') or {}).get('pmid') or '', 'url': ('https://doi.org/' + doi) if doi else '', 'source': 'PubMed'}
for f in sc_files:
    for r in json.load(open(f))['results']:
        t = re.sub(r'<[^>]+>', '', r.get('title') or '').strip(); k = ntitle(t)[:70]
        if not k or k in recs: continue
        txt = r.get('text') or ''; head = txt.split('\n')[0].split(' · ')
        m = re.search(r'Abstract:\s*(.*)', txt, re.S); tl = re.search(r'TL;DR:\s*(.*?)\n', txt)
        recs[k] = {'title': re.sub(r'\s+', ' ', t), 'abstract': ((tl.group(1) + ' ') if tl else '') + (m.group(1) if m else ''),
                   'year': int(head[0]) if head and head[0].strip().isdigit() else None,
                   'first_author': head[1].split(',')[0].strip() if len(head) > 1 else '', 'venue': head[2].strip() if len(head) > 2 and 'Journal Article' not in head[2] else '',
                   'doi': '', 'pmid': '', 'url': (r.get('url') or '').split('?')[0], 'source': 'SciSpace'}

SPECIES = re.compile(r'guianensis|guiana dolphin|boto-cinza|boto cinza|estuarine dolphin|costero|tonina|sotalia', re.I)

# management units: place names (normalised, lower case, no accents)
MU = {
 'CCOL':  r'colombia|morrosquillo|uraba|cispata|cartagena|costa rica|gandoca|manzanillo|panama|bocas del toro|nicaragua|miskit|honduras',
 'VEML':  r'maracaibo|gulf of venezuela|golfo de venezuela|zulia',
 'VEOR':  r'orinoco|gulf of paria|golfo de paria|trinidad',
 'FRGU':  r'french guiana|guyane|suriname|\bguyana\b',
 'BRNO':  r'amapa|\bpara state|state of para\b|para, brazil|\b(no|do|in) para\b|paraense|marajo|amazon estuar|amazon river mouth|amazon coast|amazonian estuar|belem|braganca|guajara|caete',
 'BRNE1': r'maranhao|sao marcos|sao luis|\bpiaui state|state of piaui|parnaiba|ceara|fortaleza|mucuripe|icapui',
 'BRNE2': r'rio grande do norte|\bpipa\b|tibau do sul|natal\b|paraiba|joao pessoa|pernambuco|recife|itamaraca|potiguar|lucena|cabedelo|barra de mamanguape|mamanguape',
 'BRNE3': r'alagoas|maceio|sergipe|aracaju|sao francisco river|vaza.barris|piaui.fundo.real|mangue seco',
 'BRNE4': r'bahia|todos os santos|salvador|ilheus|camamu|caravelas|abrolhos|canavieiras|porto seguro|itacare|cumuruxatiba|marau',
 'BRSE1': r'espirito santo|doce river|rio doce|vitoria|benevente|anchieta|piraque|sao joao da barra|paraiba do sul|campos dos goytacazes|northern rio de janeiro|north of rio de janeiro|macae',
 'BRSE2': r'guanabara|sepetiba|ilha grande|paraty|parati|angra dos reis|rio de janeiro|ubatuba|sao sebastiao|caraguatatuba|araca bay|south.?eastern brazil.*rio',
 'BRS/SE':r'cananeia|cananea|iguape|paranagua|parana state|state of parana|parana, brazil|guaratuba|antonina|laranjeiras|babitonga|santa catarina|sao francisco do sul|florianopolis|pinheiros|superagui|ilha do mel|norte bay|baia norte|santos estuar|sao vicente|santos bay|baixada santista',
}
MU_RE = {k: re.compile(v) for k, v in MU.items()}

# stressors grouped by source of pressure
STRESSORS = [
 ('bycatch',   'Fisheries',            'Bycatch and entanglement', r'by.?catch|incidental(ly)? capt|incidental mortality|gill.?net|entangl|fishing net|net mortality|fisher(y|ies) interaction|interaction(s)? with (artisanal )?fisher|fishing gear|fishery.related'),
 ('take',      'Fisheries',            'Directed take and use as bait or food', r'directed take|wild.?meat|as bait|used as bait|intentional(ly)? (capture|kill)|hunting|consum(ed|ption) of (dolphin|cetacean)|harpoon'),
 ('prey',      'Fisheries',            'Prey depletion and overfishing', r'overfish|prey depletion|prey availability|food web alteration|competition with fisher'),
 ('chem',      'Effluents and runoff', 'Chemical contaminants (metals, POPs, PAHs)', r'mercury|\bhg\b|cadmium|\bpb\b|trace element|heavy metal|metal\(loid\)|organochlorin|\bpcbs?\b|\bddt|persistent organic|\bpops\b|pbde|flame retardant|dioxin|organobromin|organohalogen|pesticide|contaminant|pollutant|\bpahs?\b|polycyclic aromatic|xenobiotic|butyltin|perfluor|pfas|selenium'),
 ('debris',    'Effluents and runoff', 'Plastics and marine debris', r'microplastic|plastic|marine debris|litter|ghost (net|gear)'),
 ('sewage',    'Effluents and runoff', 'Sewage, eutrophication and microbial pollution', r'sewage|eutrophic|fecal|faecal|antimicrobial resist|multidrug|antibiotic resist|harmful algal'),
 ('spill',     'Mining and oil',       'Mine tailings and oil spills', r'tailing|fundao|samarco|mining (waste|disaster)|mine waste|oil spill|oil pollution|crude oil|petroleum'),
 ('disease',   'Pathogens',            'Infectious disease and pathogens', r'morbillivirus|virus|viral|pathogen|toxoplasm|brucell|lacazi|lobomycosis|lobo.?like|poxvirus|herpes|leptospir|parasit|bacteri|fung(al|us)|infecti|epizoot|unusual mortality'),
 ('noise',     'Shipping, ports and tourism', 'Underwater noise', r'noise|acoustic (disturb|pollution)|anthropogenic sound|sound exposure|pile.?driving|seismic'),
 ('vessels',   'Shipping, ports and tourism', 'Vessel traffic, collisions and tourism', r'boat|vessel|\bship|maritime traffic|boat traffic|collision|tourism|dolphin.?watch|swimmer|recreational'),
 ('habitat',   'Coastal development',  'Habitat loss, ports and coastal development', r'habitat loss|habitat degradation|port (construction|expansion|activit|development)|harbou?r|dredg|bridge|coastal development|urbani[sz]|land reclamation|construction|anthropi[sz]|industriali[sz]|human.dominated|seascape|marine spatial'),
 ('climate',   'Climate',              'Climate change and extreme events', r'climate change|global warming|el nino|la nina|sea surface temperature|marine heatwave|drought'),
]
ST_RE = [(k, g, l, re.compile(p)) for k, g, l, p in STRESSORS]

IMPACTS = [
 ('mortality', 'Mortality', r'mortality|dead\b|death|stranded|stranding|carcass|killed|lethal'),
 ('health', 'Health and body burden', r'lesion|patholog|immun|health|body condition|histopath|concentration|accumulat|bioaccum|exposure|toxic|infect'),
 ('behaviour', 'Behaviour and habitat use', r'behavio|habitat use|whistle|vocal|displac|avoid|distribution|area use|home range|foraging'),
 ('population', 'Population decline', r'population decline|declin|decreas|abundance|extinction|viability|survival|removal'),
]
IM_RE = [(k, l, re.compile(p)) for k, l, p in IMPACTS]

# manual corrections after reading the abstract (title prefix, lower case, no accents)
OVERRIDES = {
 'human-induced injuries to marine tucuxis': ['bycatch', 'vessels'],
}

rows = []
for r in recs.values():
    T = norm(r['title']); A = norm(r['abstract']); TA = T + ' ' + A
    if not SPECIES.search(TA): continue
    # studies centred on river dolphins (Sotalia fluviatilis, Inia) are left out
    if re.search(r'river dolphin|fluviatilis|\binia\b|boto vermelho', T) and not re.search(r'guianensis|guiana dolphin|marine tucuxi|costero|estuarine dolphin', T): continue
    # studies about other species, or not about cetaceans at all, are left out
    if not re.search(r'dolphin|cetacean|sotalia|tucuxi|boto|delphinid|odontocete|marine mammal|tetrapod|golfinho|delfin', T): continue
    if re.search(r'humpback|killer whale|orcinus|tursiops|bottlenose|franciscana|pontoporia', T) and not re.search(r'guianensis|guiana dolphin|sotalia', T): continue
    # a place named in the title decides; otherwise places named in the abstract
    mus = [m for m, rx in MU_RE.items() if rx.search(T)] or [m for m, rx in MU_RE.items() if rx.search(A)]
    sts = []
    # reviews and conservation assessments list each threat once: one mention is enough there
    need = 1 if re.search(r'threat|conservation|impact|anthropogenic|human activit|pressure', T) else 2
    for k, g, l, rx in ST_RE:
        score = 3 * len(rx.findall(T)) + len(rx.findall(A))
        if score >= need: sts.append(k)
    if not mus or not sts: continue
    for pre, fix in OVERRIDES.items():
        if T.startswith(pre): sts = fix
    ims = [k for k, l, rx in IM_RE if rx.search(TA)]
    rows.append({'title': r['title'], 'year': r['year'], 'first_author': r['first_author'], 'venue': r['venue'],
                 'doi': r['doi'], 'pmid': r['pmid'], 'url': r['url'], 'index': r['source'],
                 'mus': mus, 'stressors': sts, 'impacts': ims})
rows.sort(key=lambda x: (-(x['year'] or 0), x['title']))
json.dump({'stressors': [{'id': k, 'group': g, 'label': l} for k, g, l, _ in STRESSORS],
           'impacts': [{'id': k, 'label': l} for k, l, _ in IMPACTS], 'studies': rows}, open(out_path, 'w'), ensure_ascii=False, indent=0)
print(len(recs), 'records;', len(rows), 'assigned')
from collections import Counter
c = Counter((m, s) for x in rows for m in x['mus'] for s in x['stressors'])
for m in MU: print(m.ljust(6), ' '.join(f"{s}:{c[(m, s)]}" for s, *_ in STRESSORS if c[(m, s)]))
