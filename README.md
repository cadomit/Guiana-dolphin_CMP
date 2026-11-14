# Guiana-dolphin_CMP

It is a dashboard integrating the current knowledge and conservation efforts on the Guiana dolphin, focused mostly on the IWC initiative.

Dashboard supporting the IWC Conservation Management Plan (CMP) for the Guiana dolphin (*Sotalia guianensis*):
population structure and abundance, threats, the 2024–2028 action plan, IWC recommendations, CMS/IWC
instruments, international and Brazilian conservation status, Important Marine Mammal Areas (IMMAs),
scientific literature and the evidence available for each priority action.

- **Static copy (this repository, GitHub Pages):** https://cadomit.github.io/Guiana-dolphin_CMP/
- **Live version (claude.ai):** https://claude.ai/artifact/79GgPWUJPym9LimjBMkvEd — refreshes the PubMed and
  SciSpace tables on opening; access depends on the owner's sharing settings.

## What is in the static copy

All figures come from the JSON files in `docs/data/`. The PubMed and SciSpace tables are snapshots taken on
14 November 2026 (`docs/snapshots/`); every other source is the same file the live dashboard uses.
The IMMA map is **provisional**: markers and coastal extents are approximate locations placed from the IMMA
factsheets, not the official IMMA boundaries (available from the IUCN MMPATF on request under licence).
Coastline and borders: [Natural Earth](https://www.naturalearthdata.com/) 1:50m (public domain).

## Layout

```
docs/                 the published site (GitHub Pages serves this folder)
source/page/          the dashboard's page files (HTML, CSS, scripts)
source/data/          data files
source/datasets/      where each figure comes from (file or live query)
source/snapshots/     recorded answers of the live PubMed and SciSpace queries
source/tools/         build_site.py (rebuilds docs/), build_map_layers.py (map layers)
```

To rebuild the site after changing a page or data file: `python3 source/tools/build_site.py`.
`docs/dash-runtime.js` is a small stand-in for the dashboard runtime so the page scripts run unchanged.

## Licence

Released under CC0 1.0 (see `LICENSE`). Natural Earth data are in the public domain; cite the original sources listed in the dashboard when reusing figures.
