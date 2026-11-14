"""Procesa NISAR L3 SME2 (data/raw/sme2/*.h5) → public/data/humedad/<area>.json + index.json.

Contrato de salida: contracts/humedad.schema.json (v0). Datos REALES: es_ejemplo = false.

Método por escena y por área (estructura del .h5 verificada el 2026-11-14 con 2 escenas reales):
  - Grilla EASE-Grid 2.0 de 200 m; `grids/latitude` y `grids/longitude` son vectores 1D → recorte directo por bbox.
  - Humedad: `grids/soilMoisture` (m³/m³), _FillValue -9999.
  - Calidad: `grids/retrievalQualityFlag`, bit menos significativo: 0 = recomendado, 1 = no recomendado.
  - Agua: `grids/ancillaryData/waterbodyFraction` > 0.5 se excluye.
  - HV: `grids/radarData/frequencyA/sigma0HV` (lineal) → media lineal → 10·log10 = hv_db.
  - Se promedian las celdas RECOMENDADAS. Si hay menos de MIN_CELDAS recomendadas, se usan todas las válidas
    y la observación se marca "dudosa".
  - Si un área cae fuera de la escena o no tiene celdas válidas, no se agrega punto para esa fecha.
  - Si dos escenas caen el mismo día (tracks distintos), se combinan ponderando por celdas.
Pendiente de verificar: leyenda de `ancillaryData/landCover` (para promediar solo celdas agrícolas).

Uso:  .venv/bin/python pipeline/03_procesar_nisar.py [--track 82]
      (--track filtra escenas de una sola órbita para una serie más comparable; por defecto usa todas)
"""
import argparse, json, pathlib, re, sys
from collections import defaultdict

import h5py
import numpy as np

from zonas import ZONAS

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "data" / "raw" / "sme2"
SALIDA = RAIZ / "public" / "data" / "humedad"
G = "science/LSAR/SME2/grids/"
FILL = -9999
MIN_CELDAS = 50          # SUPUESTO: mínimo de celdas recomendadas para considerar "buena" la observación
FRAC_AGUA_MAX = 0.5
FUENTE = "NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC"


def track_de(nombre: str):
    m = re.match(r"NISAR_L3_PR_SME2_\d+_(\d+)_", nombre)
    return int(m.group(1)) if m else None


def procesar_escena(ruta: pathlib.Path):
    """Devuelve (fecha, {area_id: dict con sumas parciales})."""
    with h5py.File(ruta, "r") as f:
        fecha = f["science/LSAR/identification/zeroDopplerStartTime"][()].decode()[:10]
        lat = f[G + "latitude"][:]
        lon = f[G + "longitude"][:]
        res = {}
        for aid, z in ZONAS.items():
            a, b, c, d = z["bbox"]
            fi = np.where((lat >= b) & (lat <= d))[0]
            co = np.where((lon >= a) & (lon <= c))[0]
            if len(fi) == 0 or len(co) == 0:
                continue
            sl = (slice(fi.min(), fi.max() + 1), slice(co.min(), co.max() + 1))
            sm = f[G + "soilMoisture"][sl]
            qf = f[G + "retrievalQualityFlag"][sl]
            agua = f[G + "ancillaryData/waterbodyFraction"][sl]
            hv = f[G + "radarData/frequencyA/sigma0HV"][sl]

            sin_agua = (agua == FILL) | (agua <= FRAC_AGUA_MAX)
            valida = (sm != FILL) & (sm >= 0) & (sm <= 1) & sin_agua
            recom = valida & (qf != FILL) & ((qf & 1) == 0)
            usar, calidad = (recom, "buena") if recom.sum() >= MIN_CELDAS else (valida, "dudosa")
            if usar.sum() == 0:
                continue
            hv_ok = usar & (hv != FILL) & (hv > 0)
            res[aid] = {
                "suma_sm": float(sm[usar].sum()), "n": int(usar.sum()),
                "suma_hv": float(hv[hv_ok].sum()), "n_hv": int(hv_ok.sum()),
                "calidad": calidad, "frac_recom": float(recom.sum() / max(1, valida.sum())),
            }
    return fecha, res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--track", type=int, default=None, help="usar solo escenas de este track (p. ej. 82)")
    args = ap.parse_args()

    archivos = sorted(p for p in ENTRADA.glob("*.h5") if "_QA_" not in p.name)
    if args.track is not None:
        archivos = [p for p in archivos if track_de(p.name) == args.track]
    if not archivos:
        sys.exit(f"No hay archivos SME2 en {ENTRADA} (track={args.track}). Corré antes la descarga.")
    print(f"Procesando {len(archivos)} escena(s) SME2…")

    # acumulado[area][fecha] = sumas combinadas de todas las escenas de ese día
    acumulado = defaultdict(dict)
    granulos = []
    for ruta in archivos:
        fecha, res = procesar_escena(ruta)
        granulos.append(ruta.stem)
        print(f"  {fecha}  track {track_de(ruta.name)}  áreas con datos: {', '.join(res) or '—'}")
        for aid, r in res.items():
            prev = acumulado[aid].get(fecha)
            if prev:
                for k in ("suma_sm", "n", "suma_hv", "n_hv"):
                    prev[k] += r[k]
                prev["calidad"] = "buena" if "buena" in (prev["calidad"], r["calidad"]) else "dudosa"
            else:
                acumulado[aid][fecha] = dict(r)

    SALIDA.mkdir(parents=True, exist_ok=True)
    indice = []
    for aid, z in ZONAS.items():
        serie = []
        for fecha in sorted(acumulado.get(aid, {})):
            r = acumulado[aid][fecha]
            serie.append({
                "fecha": fecha,
                "humedad_m3m3": round(r["suma_sm"] / r["n"], 3),
                "hv_db": round(10 * np.log10(r["suma_hv"] / r["n_hv"]), 1) if r["n_hv"] else None,
                "calidad": r["calidad"],
                "pixeles_validos": r["n"],
            })
        if not serie:
            print(f"  ⚠ {aid}: sin observaciones; no se escribe archivo")
            continue
        salida = {
            "id": aid, "zona": z["zona"], "tipo": z["tipo"], "bbox": z["bbox"],
            "fuente": FUENTE, "es_ejemplo": False,
            "mascara": "Celdas de 200 m con retrievalQualityFlag 'recomendado' y sin agua (waterbodyFraction ≤ 0.5); "
                       f"si hay menos de {MIN_CELDAS}, todas las válidas (calidad 'dudosa').",
            "serie": serie,
        }
        (SALIDA / f"{aid}.json").write_text(json.dumps(salida, ensure_ascii=False, indent=1))
        indice.append({"id": aid, "zona": z["zona"], "archivo": f"{aid}.json", "es_ejemplo": False})
        print(f"  ✔ {aid}: {len(serie)} fechas, {serie[0]['fecha']} → {serie[-1]['fecha']}, "
              f"última {serie[-1]['humedad_m3m3']} m³/m³ ({serie[-1]['calidad']})")

    (SALIDA / "index.json").write_text(json.dumps({
        "fuente": FUENTE, "es_ejemplo": False, "granulos": sorted(granulos), "zonas": indice,
    }, ensure_ascii=False, indent=1))
    print(f"→ {SALIDA}")


if __name__ == "__main__":
    main()
