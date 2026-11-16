"""Exporta la GRILLA real de NISAR SME2 (celdas de 200 m) de TODO Itapúa, en teselas → public/data/grilla/

Para que el análisis de chacras del backend use valores NISAR reales en cualquier lugar del departamento.
Contrato: contracts/humedad_grilla.schema.json (v1).

Todo Itapúa son ~407 mil celdas por fecha: demasiado para un solo archivo. Por eso se parte en teselas de
TESELA × TESELA celdas, alineadas a los índices globales de la grilla EASE-Grid 2.0 (no dependen de la escena).
El backend carga solo las teselas que toca la chacra (1 a 4). index.json lista las teselas con su bbox.

Formato de cada tesela (public/data/grilla/t_<fila>_<columna>.json):
  { id, res_m: 200, fuente, es_ejemplo: false, bbox: [lon_min, lat_min, lon_max, lat_max] (bordes de las celdas),
    lat: [centro de cada fila, norte → sur], lon: [centro de cada columna, oeste → este], fechas: [...],
    escala: 200, sin_dato: 255,
    humedad_b64: { "AAAA-MM-DD": base64 de filas × columnas bytes (fila por fila) } }
  Cada byte = humedad (m³/m³) × 200, redondeada (paso de 0,005; la precisión objetivo de SME2 es 0,06). 255 = sin dato:
  fuera del contorno de Itapúa, agua (waterbodyFraction > 0,5) o sin estimación válida. Mismo criterio que 03.
Si dos escenas del mismo track caen el mismo día, en cada tesela gana la que tiene más celdas válidas.

Uso:  .venv/bin/python pipeline/07_exportar_grilla.py [--track 82] [--tesela 128]
"""
import argparse, base64, json, pathlib, re

import h5py
import numpy as np

from zonas import CONTORNO, mascara_itapua

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "data" / "raw" / "sme2"
SALIDA = RAIZ / "public" / "data" / "grilla"
G = "science/LSAR/SME2/grids/"
FILL = -9999
ESCALA = 200
SIN_DATO = 255
FUENTE = "NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC · celdas EASE-Grid 2.0 de 200 m"


def track_de(nombre):
    m = re.match(r"NISAR_L3_PR_SME2_\d+_(\d+)_", nombre)
    return int(m.group(1)) if m else None


def bordes(centros):
    """Bordes de las celdas a partir de sus centros (la grilla no es regular en latitud)."""
    c = np.asarray(centros, float)
    medio = (c[:-1] + c[1:]) / 2
    return np.concatenate([[c[0] - (medio[0] - c[0])], medio, [c[-1] + (c[-1] - medio[-1])]])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--track", type=int, default=82)
    ap.add_argument("--tesela", type=int, default=128, help="lado de cada tesela, en celdas")
    args = ap.parse_args()
    T = args.tesela

    archivos = sorted(p for p in ENTRADA.glob("*.h5") if "_QA_" not in p.name and track_de(p.name) == args.track)
    print(f"{len(archivos)} escena(s) del track {args.track}; teselas de {T}×{T} celdas")
    a, b, c, d = CONTORNO["bbox"]

    teselas = {}   # id → {filas, cols (índices EASE globales), lat, lon, dentro (máscara), humedad: {fecha: uint8}, _validas}
    for ruta in archivos:
        with h5py.File(ruta, "r") as f:
            fecha = f["science/LSAR/identification/zeroDopplerStartTime"][()].decode()[:10]
            lat = f[G + "latitude"][:].astype(float)
            lon = f[G + "longitude"][:].astype(float)
            fila_g = f[G + "EASEGridRowIndex"][:].astype(int)
            col_g = f[G + "EASEGridColumnIndex"][:].astype(int)
            fi = np.where((lat >= b) & (lat <= d))[0]
            co = np.where((lon >= a) & (lon <= c))[0]
            sl = (slice(fi.min(), fi.max() + 1), slice(co.min(), co.max() + 1))
            sm = f[G + "soilMoisture"][sl].astype(float)
            agua = f[G + "ancillaryData/waterbodyFraction"][sl]
        lat, lon, fila_g, col_g = lat[sl[0]], lon[sl[1]], fila_g[sl[0]], col_g[sl[1]]
        dentro = mascara_itapua(lon, lat)
        valida = (sm != FILL) & (sm >= 0) & (sm <= 1) & ((agua == FILL) | (agua <= 0.5)) & dentro
        cuant = np.where(valida, np.clip(np.rint(sm * ESCALA), 0, SIN_DATO - 1), SIN_DATO).astype(np.uint8)

        for tf in np.unique(fila_g // T):
            ii = np.where(fila_g // T == tf)[0]
            for tc in np.unique(col_g // T):
                jj = np.where(col_g // T == tc)[0]
                sub_dentro = dentro[np.ix_(ii, jj)]
                if not sub_dentro.any():
                    continue  # tesela completamente fuera de Itapúa
                # Recorte a las filas y columnas que tienen alguna celda dentro de Itapúa
                fi_ok = np.where(sub_dentro.any(axis=1))[0]
                co_ok = np.where(sub_dentro.any(axis=0))[0]
                ii2 = ii[fi_ok.min(): fi_ok.max() + 1]
                jj2 = jj[co_ok.min(): co_ok.max() + 1]
                tid = f"t_{tf}_{tc}"
                t = teselas.get(tid)
                if t is None:
                    t = teselas[tid] = {"filas": fila_g[ii2].tolist(), "cols": col_g[jj2].tolist(), "lat": lat[ii2], "lon": lon[jj2],
                                        "humedad": {}, "_validas": {}}
                elif t["filas"] != fila_g[ii2].tolist() or t["cols"] != col_g[jj2].tolist():
                    raise SystemExit(f"{tid}: la escena {ruta.name} no coincide con la grilla de las anteriores")
                n_ok = int(valida[np.ix_(ii2, jj2)].sum())
                if t["_validas"].get(fecha, -1) >= n_ok:
                    continue  # ya hay una escena mejor para ese día
                t["_validas"][fecha] = n_ok
                t["humedad"][fecha] = cuant[np.ix_(ii2, jj2)]
        print(f"  {fecha}: {int(valida.sum())} celdas con dato de {int(dentro.sum())} dentro de Itapúa ({100 * valida.sum() / dentro.sum():.1f} %)")

    SALIDA.mkdir(parents=True, exist_ok=True)
    for viejo in SALIDA.glob("*.json"):
        viejo.unlink()
    indice, total, fechas_todas = [], 0, set()
    for tid in sorted(teselas):
        t = teselas[tid]
        fechas = sorted(t["humedad"])
        fechas_todas.update(fechas)
        bl, bo = bordes(t["lat"]), bordes(t["lon"])
        bbox = [round(float(bo.min()), 5), round(float(bl.min()), 5), round(float(bo.max()), 5), round(float(bl.max()), 5)]
        salida = {
            "id": tid, "res_m": 200, "fuente": FUENTE, "es_ejemplo": False, "bbox": bbox,
            "lat": [round(float(x), 5) for x in t["lat"]], "lon": [round(float(x), 5) for x in t["lon"]],
            "fechas": fechas, "escala": ESCALA, "sin_dato": SIN_DATO,
            "humedad_b64": {f: base64.b64encode(t["humedad"][f].tobytes()).decode() for f in fechas},
        }
        ruta = SALIDA / f"{tid}.json"
        ruta.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")))
        total += ruta.stat().st_size
        indice.append({"id": tid, "archivo": f"{tid}.json", "bbox": bbox, "filas": len(salida["lat"]), "columnas": len(salida["lon"])})
    (SALIDA / "index.json").write_text(json.dumps({
        "fuente": FUENTE, "es_ejemplo": False, "res_m": 200, "formato": "b64-uint8", "escala": ESCALA, "sin_dato": SIN_DATO,
        "area": {"id": "itapua", "zona": "Itapúa", "bbox": CONTORNO["bbox"]},
        "fechas": sorted(fechas_todas), "tesela_celdas": T, "areas": indice,
    }, ensure_ascii=False, indent=1))
    print(f"✔ {len(indice)} teselas, {total / 1e6:.1f} MB en total → {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
