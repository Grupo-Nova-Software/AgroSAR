# AgroSAR Itapúa

> ⚠️ **Status: work in progress (NASA Space Apps 2026).** The data in `public/data/humedad/` is **FICTITIOUS sample data** until NISAR processing is complete.

A Progressive Web App (installable on phones) that shows farmers in **Itapúa, Paraguay** how **soil moisture** changes over time in their agricultural areas, using radar data from the **NASA-ISRO NISAR** mission, and gives simple guidance: **sow / wait / caution**.

Challenge: **Dancing with the SARs**, NASA Space Apps Challenge 2026.

## Data
| Source | Use | Access |
|---|---|---|
| NISAR L3 **SME2** soil moisture (200 m, *provisional*) | Main time series | ASF DAAC, Earthdata Login |
| NISAR L2 **GCOV** backscatter (HH/HV) | Crop/vegetation signal (selected scenes) | ASF DAAC, Earthdata Login |
| NASA POWER | Rainfall and temperature context | Public API |

All sources are cited in the app. NISAR soil moisture is a **provisional** product (partially validated).

## Run locally
```bash
npx pnpm@11.20.0 install
cp .env.example .env.local          # optional: Supabase, NASA keys
npx pnpm@11.20.0 dev                # http://localhost:3000
```
API: `GET /api/recomendacion?area=natalio&cultivo=soja`

Data pipeline (Python):
```bash
python3 -m venv .venv && . .venv/bin/activate && pip install -r pipeline/requirements.txt
python pipeline/01_listar_nisar.py     # list NISAR products (no login)
python pipeline/04_contexto_power.py   # NASA POWER (no login)
python pipeline/02_descargar_nisar.py --zona natalio --tipo SME2 --max 3   # needs Earthdata (~/.netrc)
```

## Limitations
Provisional NISAR data, decision thresholds that are **assumptions** (not yet agronomically validated), and approximate area boundaries. This tool supports and **does not replace** advice from local agronomists. Details (in Spanish): `docs/limitaciones.md`.

## Team docs (Spanish)
`docs/plan-equipo.md` (roles and workflow) · `docs/decision.md` · `contracts/` (data contracts) · `docs/SI_USAGE.md`

## Credits & license
MIT. Based on [nasa-space-apps-starter-template](https://github.com/marcosferr/nasa-space-apps-starter-template) (MIT). Community project, not affiliated with or endorsed by NASA.
