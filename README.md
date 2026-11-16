# AgroSAR

**Soil moisture from NISAR radar to help small farmers in Itapúa, Paraguay decide when to sow.**

- **Live app:** https://agro-sar.vercel.app/ (progressive web app: open it on a phone and tap *Install app*)
- **Challenge:** Dancing with the SARs · NASA Space Apps Challenge 2026 · **Team NOVA**
- Community project. Not affiliated with or endorsed by NASA.

## What it does
The farmer draws their field on an aerial map of Itapúa and gets a clear answer — **Good time to sow / Better wait / Don't sow now** — with one sentence of reasoning, the soil water level (Dry / Good / Wet), the date of the satellite pass and a warning when the data is old. A weather screen for all of Itapúa adds plain advice (best hours to spray, heavy rain, frost, dry spells). The interface is in English and Spanish, works offline and is designed for people who are not tech-savvy.

## How NASA data is used
| Source | Use |
|---|---|
| **NISAR L3 SME2** soil moisture (NASA-ISRO, 200 m, *provisional*), via ASF DAAC | The core of the app. 10 passes over Itapúa (track 82, 19 Jun – 17 Oct 2026). |
| **NASA POWER** (daily and climatology) | Recent rain, temperature, evaporation (FAO-56) and 30-day water balance. |
| Open-Meteo (*not NASA data*) | Weather forecast and weather map. |
| OpenStreetMap, Esri imagery | Itapúa boundary and map base layers. |

### Data pipeline (`pipeline/`, Python)
1. `01`–`02` list and download NISAR SME2 granules (Earthdata login; run by a person, never stored in the repo).
2. `09_contorno_itapua.py` builds the Itapúa boundary from OpenStreetMap (`config/zonas/itapua_contorno.json`).
3. `03_procesar_nisar.py` keeps cells inside Itapúa that NISAR flags as *recommended* and with < 50 % water, and builds the department series (`public/data/humedad/`).
4. `07_exportar_grilla.py` packs the 200 m grid of the whole department into 42 map tiles of 128 × 128 cells (6.7 MB, one byte per cell) in `public/data/grilla/`.
5. `08_exportar_mapa_humedad.py` exports a colour map per pass.

At request time the server (`src/lib/mapa`, `src/app/api/lote`) reads the cells under the farmer's polygon, builds that field's own moisture series and compares it with per-crop Dry / Good / Wet limits and the sowing season (`config/cultivos/`). Where NISAR has no valid cell the field shows *no data*: values are never invented. Fields outside Itapúa are rejected.

## Honest limits
- NISAR SME2 is a **provisional** product (target accuracy 0.06 m³/m³) and measures only the top ~5 cm of soil.
- The latest pass processed is 17 Oct 2026; the app flags data older than 24 days.
- The Dry / Good / Wet limits and sowing seasons are **team assumptions**, not yet validated by agronomists (`docs/limitaciones.md`).
- Tested by the team and mentors on several phones and tablets; no formal field trial with farmers yet.

## Run locally
```bash
npx pnpm@11.20.0 install
npx pnpm@11.20.0 dev                # http://localhost:3000
npx pnpm@11.20.0 lint && npx pnpm@11.20.0 build
node --import ./src/lib/agro/__tests__/registro.mjs --test src/lib/**/__tests__/*.test.mjs
```
Pipeline: `python3 -m venv .venv && . .venv/bin/activate && pip install -r pipeline/requirements.txt`.
Stack: Next.js 16, React 19, TypeScript, Tailwind 4, Leaflet, Python (h5py, numpy). Deployed on Vercel.

## Use of AI
The product idea was defined by the team. Code was written with the assistance of Claude Code (Anthropic); every use is logged in [`docs/SI_USAGE.md`](docs/SI_USAGE.md). Icons are vector drawings written in code from sketches by the team's designer. NISAR data are real, not AI-generated.

## Credits and licences
NISAR (NASA-ISRO, ASF DAAC) · NASA POWER (public domain) · Open-Meteo (CC BY 4.0) · OpenStreetMap contributors (ODbL) · Esri, Maxar, Earthstar Geographics · Leaflet (BSD-2) · Next.js, React, Tailwind (MIT) · Bricolage Grotesque, Atkinson Hyperlegible (SIL OFL). Code license: see [`LICENSE`](LICENSE).
