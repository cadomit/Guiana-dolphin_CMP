# Guiana-dolphin_CMP

It is a dashboard integrating the current knowledge and conservation efforts on the Guiana dolphin, focused mostly on the IWC initiative.

**Dashboard prepared by the Laboratório de Ecologia e Conservação, Universidade Federal do Paraná, Paraná, Brazil.**

The dashboard supports the IWC Conservation Management Plan (CMP) for the Guiana dolphin (*Sotalia guianensis*). It covers:

- a graphical summary of the evidence ("At a glance");
- population structure and abundance;
- threats and the threat scoring forms;
- the 2024–2028 action plan;
- IWC recommendations and CMS/IWC instruments;
- international and Brazilian conservation status;
- Important Marine Mammal Areas (IMMAs);
- the scientific literature, with CSV and PDF downloads;
- the evidence available for each priority action;
- references and credits.

- **Website (GitHub Pages):** https://cadomit.github.io/Guiana-dolphin_CMP/
- **Live version (claude.ai):** https://claude.ai/artifact/79GgPWUJPym9LimjBMkvEd. It refreshes the PubMed and SciSpace tables when opened; access depends on the owner's sharing settings.

## Suggested citation

Laboratório de Ecologia e Conservação, Universidade Federal do Paraná (2026). *Guiana dolphin: evidence and assessment dashboard*. Supporting the IWC Conservation Management Plan for *Sotalia guianensis*. https://cadomit.github.io/Guiana-dolphin_CMP/

Cover photograph: Laboratório de Ecologia e Conservação/UFPR.

## What is in the website

All figures come from the JSON files in `docs/data/`. The PubMed and SciSpace tables are snapshots taken on 15 November 2026 (`docs/snapshots/`); the live version refreshes them. The full list of data sources is in the "References and credits" section of the dashboard.

## Data credits and terms of use

- **IMMAs** (`imma_polygons.json`, `immas.json`): derived from IUCN MMPATF (2025) Global Dataset of Important Marine Mammal Areas (IUCN-IMMA), December 2025, made available under agreement on terms and conditions of use by the IUCN Joint SSC/WCPA Marine Mammal Protected Areas Task Force and accessible via the IMMA e-Atlas, https://www.marinemammalhabitat.org/imma-eatlas/. They are used with permission. Boundaries are simplified for display (about 500 m). These files are **not** covered by the repository's CC0 licence: any reuse must follow the IUCN IMMA terms of use and cite the source. Use does not imply endorsement by the IUCN MMPATF.
- **Coastline and borders:** Natural Earth 1:50m, public domain.
- **Literature:** PubMed (NCBI/NLM), OpenAlex and SciSpace.
- **Cover photograph:** © Laboratório de Ecologia e Conservação/UFPR. It is not covered by the CC0 licence.

Unless stated otherwise above, the code and the remaining data are released under CC0 1.0 (see `LICENSE`).

## Layout

```
docs/                 the published site (GitHub Pages serves this folder)
source/page/          the dashboard's page files (HTML, CSS, scripts)
source/data/          data files
source/datasets/      where each figure comes from (file or live query)
source/snapshots/     recorded answers of the live PubMed and SciSpace queries
source/tools/         build_site.py (rebuilds docs/), build_imma_polygons.py, build_map_layers.py
```

To rebuild the site after changing a page or data file, run `python3 source/tools/build_site.py`. `docs/dash-runtime.js` is a small stand-in for the dashboard runtime, so the page scripts run unchanged.
