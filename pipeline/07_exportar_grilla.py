"""Exporta la GRILLA real de NISAR SME2 (celdas de 200 m) por área → public/data/grilla/<area>.json

Para que el mapa de celdas y el análisis de lotes del backend usen valores NISAR reales en vez de la grilla
ficticia. Contrato: contracts/humedad_grilla.schema.json (PROPUESTA v0).

Formato (compacto, una matriz por fecha, filas de norte a sur, columnas de oeste a este):
  { id, zona, res_m: 200, fuente, es_ejemplo: false,
    lat: [lat del centro de cada fila], lon: [lon del centro de cada columna],
    fechas: ["AAAA-MM-DD", ...],
    humedad: { "AAAA-MM-DD": [[0.231, null, ...], ...] },   # m³/m³, null = sin dato / agua / no válida
    recomendada: {...} }   # OPCIONAL (--con-recomendada): 1 = celda "recomendada" por NISAR
Además escribe public/data/grilla/index.json con el bbox y las fechas de cada área.
Mismo criterio que 03_procesar_nisar.py (agua excluida, _FillValue → null). Si dos escenas del mismo track
caen el mismo día, gana la que tiene más celdas válidas.

Uso:  .venv/bin/python pipeline/07_exportar_grilla.py [--track 82] [--areas san_rafael_del_parana,bella_vista]
"""
import argparse, json, pathlib, re

import h5py
import numpy as np

from zonas import ZONAS

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "data" / "raw" / "sme2"
SALIDA = RAIZ / "public" / "data" / "grilla"
G = "science/LSAR/SME2/grids/"
FILL = -9999
FUENTE = "NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC · celdas EASE-Grid 2.0 de 200 m"


def track_de(nombre):
    m = re.match(r"NISAR_L3_PR_SME2_\d+_(\d+)_", nombre)
    return int(m.group(1)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--track", type=int, default=82)
    ap.add_argument("--areas", default=",".join(ZONAS))
    ap.add_argument("--con-recomendada", action="store_true", help="incluir la matriz 0/1 de celdas recomendadas (duplica el peso)")
    args = ap.parse_args()
    areas = [a for a in args.areas.split(",") if a in ZONAS]

    archivos = sorted(p for p in ENTRADA.glob("*.h5") if "_QA_" not in p.name and track_de(p.name) == args.track)
    print(f"{len(archivos)} escena(s) del track {args.track}; áreas: {', '.join(areas)}")
    SALIDA.mkdir(parents=True, exist_ok=True)

    salida = {a: None for a in areas}
    for ruta in archivos:
        with h5py.File(ruta, "r") as f:
            fecha = f["science/LSAR/identification/zeroDopplerStartTime"][()].decode()[:10]
            lat = f[G + "latitude"][:]
            lon = f[G + "longitude"][:]
            for aid in areas:
                a, b, c, d = ZONAS[aid]["bbox"]
                fi = np.where((lat >= b) & (lat <= d))[0]
                co = np.where((lon >= a) & (lon <= c))[0]
                if len(fi) == 0 or len(co) == 0:
                    continue
                sl = (slice(fi.min(), fi.max() + 1), slice(co.min(), co.max() + 1))
                sm = f[G + "soilMoisture"][sl].astype(float)
                qf = f[G + "retrievalQualityFlag"][sl]
                agua = f[G + "ancillaryData/waterbodyFraction"][sl]
                valida = (sm != FILL) & (sm >= 0) & (sm <= 1) & ((agua == FILL) | (agua <= 0.5))
                recom = valida & (qf != FILL) & ((qf & 1) == 0)

                o = salida[aid]
                if o is None:
                    o = salida[aid] = {
                        "id": aid, "zona": ZONAS[aid]["zona"], "res_m": 200, "fuente": FUENTE, "es_ejemplo": False,
                        "bbox": ZONAS[aid]["bbox"],
                        "lat": [round(float(x), 5) for x in lat[sl[0]]],
                        "lon": [round(float(x), 5) for x in lon[sl[1]]],
                        "fechas": [], "humedad": {}, "recomendada": {}, "_validas": {},
                    }
                if o["_validas"].get(fecha, -1) >= int(valida.sum()):
                    continue  # ya hay una escena mejor para ese día
                o["_validas"][fecha] = int(valida.sum())
                # 2 decimales: la precisión objetivo de SME2 es 0,06 m³/m³, y el archivo pesa bastante menos.
                o["humedad"][fecha] = [[round(float(v), 2) if ok else None for v, ok in zip(fila, okf)]
                                       for fila, okf in zip(sm, valida)]
                if args.con_recomendada:
                    o["recomendada"][fecha] = recom.astype(int).tolist()

    indice = []
    for aid, o in salida.items():
        if o is None:
            print(f"  ⚠ {aid}: sin escenas")
            continue
        del o["_validas"]
        if not args.con_recomendada:
            del o["recomendada"]
        o["fechas"] = sorted(o["humedad"])
        indice.append({"id": aid, "zona": o["zona"], "archivo": f"{aid}.json", "bbox": o["bbox"], "fechas": o["fechas"]})
        ruta = SALIDA / f"{aid}.json"
        ruta.write_text(json.dumps(o, ensure_ascii=False, separators=(",", ":")))
        print(f"  ✔ {aid}: {len(o['lat'])}×{len(o['lon'])} celdas, {len(o['fechas'])} fechas, {ruta.stat().st_size/1e6:.2f} MB")
    # Índice para que el backend cargue solo la grilla que necesita.
    (SALIDA / "index.json").write_text(json.dumps({"fuente": FUENTE, "res_m": 200, "areas": indice}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
