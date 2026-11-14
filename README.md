# AgroSAR Itapúa

> ⚠️ **Estado: MVP con DATOS DE EJEMPLO (ficticios).** Los JSON de `data/processed/` son sintéticos hasta que se ejecute el procesamiento NISAR.

Web estática para agricultores de Itapúa (Paraguay). Muestra cómo cambian en el tiempo la **humedad del suelo** y la **retrodispersión** de radar de los cultivos en 3 zonas agrícolas, y ofrece una orientación simple: **sembrar / esperar / precaución**. Proyecto del NASA Space Apps 2026 (el desafío elegido está en `docs/decision.md`).

**Zonas:** Natalio · Noreste (Capitán Meza, Pirapó, Edelira) · Obligado / Hohenau / Capitán Miranda.

## Datos
| Fuente | Uso | Acceso |
|---|---|---|
| NISAR L3 **SME2** (humedad del suelo, 200 m, *provisional*) | Serie principal `humedad_m3m3` | ASF DAAC, login Earthdata |
| NISAR L2 **GCOV** (retrodispersión HH/HV) | Serie `hv_db` (vegetación/cultivo) | ASF DAAC, login Earthdata, ~2 GB/archivo |
| NASA POWER | Contexto: lluvia y temperatura | API pública, sin login |
| SMAP L3, GPM IMERG | Comparación opcional | Login Earthdata |

Esquema de cada zona (`data/processed/<id>.json`):
```json
{"zona": "...", "bbox": [lon_min, lat_min, lon_max, lat_max],
 "serie": [{"fecha": "AAAA-MM-DD", "humedad_m3m3": 0.25, "hv_db": -17.0, "calidad": "buena|dudosa"}]}
```
`data/processed/index.json` lista las zonas que carga la web.

## Cómo correr
**Web** (sin compilación; hay que servirla desde la raíz del repo para que lea `/data` y `/config`):
```bash
python3 -m http.server 8000     # luego abrir http://localhost:8000/src/
```
Vercel: importar el repo sin framework y sin comando de build; `vercel.json` redirige `/` a `src/index.html`.

**Scripts de datos:**
```bash
python3 -m venv .venv && . .venv/bin/activate && pip install -r scripts/requirements.txt
python scripts/01_listar_nisar.py          # solo lista, sin login
python scripts/04_contexto_power.py        # NASA POWER, sin login
python scripts/02_descargar_nisar.py --zona natalio --tipo SME2 --max 3   # requiere Earthdata; pide confirmación
python scripts/03_procesar_nisar.py        # ESQUELETO: falta implementarlo
```
**Credenciales:** nunca en el código. Usar `~/.netrc` (`machine urs.earthdata.nasa.gov login … password …`, `chmod 600`) o las variables de entorno `EARTHDATA_USERNAME` / `EARTHDATA_PASSWORD`.

## Limitaciones
Ver [`docs/limitaciones.md`](docs/limitaciones.md). En resumen: datos NISAR provisionales, umbrales **SUPUESTOS**, sin validación de campo, bbox aproximadas, y la orientación **no** reemplaza al técnico agrícola.
