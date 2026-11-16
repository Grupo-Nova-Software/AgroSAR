# AgroSAR — NASA Space Apps Challenge 2026 submission (copy/paste text) · Team NOVA

> Only `[DEMO LINK]` is left: upload `AgroSAR_presentacion.pptx` to Google Drive / OneDrive ("Anyone with the link can view") and paste it.
> Every field below is in English, as the competition requires.

---

## Project name
AgroSAR

## High-level project summary (≤ 1 paragraph)
AgroSAR is a mobile web app (installable on any phone) that tells small farmers in Itapúa, Paraguay whether it is a good moment to sow. The farmer draws their field on an aerial map and receives a plain answer — "Good time to sow", "Better wait" or "Don't sow now" — with one sentence explaining why. The core of the answer is soil moisture measured by the NASA-ISRO NISAR L-band radar (L3 SME2 product, 200 m cells, 10 passes from 19 June to 17 October 2026), which sees the ground day or night and through clouds. We combine it with NASA POWER weather data and a forecast to give practical advice (best hours to spray, heavy rain, frost, dry spells). It addresses "Dancing with the SARs" by turning SAR-derived soil moisture into a decision a farmer with no technical training can act on, helping avoid failed sowings that waste seed, fuel and labour.

## Link to the project demo
[DEMO LINK] — 7-slide presentation (`docs/entrega/AgroSAR_presentacion.pptx`, upload it to Google Drive / OneDrive as "Anyone with the link can view" and paste the link here).

## Link to the final project
App: https://agro-sar.vercel.app/
Code: https://github.com/Grupo-Nova-Software/AgroSAR

## Detailed project description

**What it does.** AgroSAR gives each farmer a recommendation for their own field:
- Mark your field (any shape) anywhere inside Itapúa on an aerial map. The app only covers Itapúa and rejects fields outside the department.
- Receive a traffic light (sow / wait / caution) with a one-sentence reason, the soil water level (Dry / Good / Wet), the date of the satellite pass, and a warning when the data is old.
- See how soil water has evolved over the 10 satellite passes in a simple chart.
- Weather screen for all of Itapúa: today, tomorrow and the next days, plain advice, and a map with rain, temperature, wind and more.
- The home screen summarises "today": sky, soil water measured by radar, and what to do with the chosen crop (soybean, maize or cassava).

**Physical hypothesis behind the data.** Radar is sensitive to the dielectric constant: wet soil reflects more of the L-band signal back to the satellite (stronger backscatter) than dry soil, and L-band penetrates crop canopy better than shorter wavelengths. NISAR's SME2 product converts this into volumetric soil moisture; we also keep the HV backscatter (vegetation-sensitive) in each series.

**How it works.**
1. *Download:* 10 NISAR L3 SME2 granules over Itapúa (track 82), about 1.1 GB, soil moisture in m³/m³ on 200 m EASE-Grid 2.0 cells.
2. *Clean:* keep only cells inside the real Itapúa boundary (OpenStreetMap), flagged "recommended" by NISAR (`retrievalQualityFlag`) and with less than 50% water (`waterbodyFraction`).
3. *Package:* ~2.85 million cells per pass are reduced to 42 map tiles (6.7 MB, one byte per cell, base64) and a department-wide series; a colour map per date is also exported.
4. *Per field:* the server reads the 200 m cells under the farmer's polygon and builds that field's own moisture time series. Where NISAR has no valid cell, the field shows "no data" — values are never invented.
5. *Decide:* moisture is compared with per-crop Dry / Good / Wet limits and the sowing season to produce the recommendation.
6. *Weather:* NASA POWER (history, FAO-56 evaporation, water balance) plus an Open-Meteo forecast produce day-by-day advice; the latest NISAR pass is cross-checked in the drought level.

**Benefits.** Fewer failed or badly timed sowings; SAR data usable without training; works offline; Spanish and English; light enough for older phones (the animated background measures its own smoothness and switches to a minimal mode, and can be turned off).

**What we hope to achieve.** A tool cooperatives and extension technicians can put in farmers' hands, validated with local agronomists, and a method that extends to other regions and crops.

**Honest limits.** NISAR SME2 is a provisional product (target accuracy 0.06 m³/m³). The latest pass we processed is 17 October 2026, so the app flags the data as old. The Dry/Good/Wet limits and sowing seasons are team assumptions and have not yet been validated by agronomists. The radar measures only the top ~5 cm of soil; deeper water is an estimate from rain and evaporation. It has been tested by our team and mentors on several phones and tablets, but we have not run a formal field trial with farmers.

**Tools.** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4, Leaflet maps, deployed on Vercel; Python (h5py, numpy, asf_search) for the NISAR pipeline; service worker for offline use; ASF DAAC / NASA Earthdata for data download.

## Use of Super Intelligence (SI) — *not shown to judges*
Yes. The product idea (soil moisture from NISAR for Itapúa farmers, with a sow / wait / caution recommendation) was defined by the team. We used Claude Code (Anthropic) as a coding assistant to implement it: the Python NISAR processing pipeline, the backend APIs, the web interface, tests, and hand-coded SVG icons based on sketches drawn by our team's designer. A page generated by AI was never used to decide how to solve the challenge. Everything is logged in `docs/SI_USAGE.md` (tool, purpose, files). The soil-moisture data are real NISAR data, not AI-generated; any sample data is marked `es_ejemplo: true`. No NASA logos or marks are used, and no images or voices of minors.

## NASA data
- **NISAR L3 Soil Moisture, SME2 (provisional)** — NASA-ISRO, distributed by the ASF DAAC. 10 granules, track 82, 19 Jun – 17 Oct 2026. Layers used: `soilMoisture`, `retrievalQualityFlag`, `ancillaryData/waterbodyFraction`, `latitude`/`longitude`, EASE-Grid indices; HV backscatter (`sigma0HV`) stored in the per-area series. **This is the core of the app.**
- **NASA POWER (daily and climatology)** — precipitation, temperature (mean/max/min), relative humidity, wind and solar radiation; used for the water balance (FAO-56 evapotranspiration), recent rain and normal monthly rainfall.

## Space-agency partner data and other references
- **ISRO** — co-developer of the NISAR mission whose data we use (via NASA-ISRO NISAR).
- **Open-Meteo** — weather forecast (CC BY 4.0). *Not NASA data.*
- **OpenStreetMap contributors** — Itapúa administrative boundary (relation 389898) and street layer (ODbL 1.0).
- **Esri World Imagery** (Esri, Maxar, Earthstar Geographics) — aerial base map; **Esri reference labels** for place names.
- **Leaflet** (BSD-2) for maps; **Next.js**, **React**, **Tailwind CSS** (MIT); **Bricolage Grotesque** and **Atkinson Hyperlegible** fonts (SIL OFL).
- Soybean/maize/cassava agronomic thresholds: team assumptions, listed in `config/` and flagged as unvalidated.
- Icons and illustrations: drawn in code from sketches by the team's designer.
