"""Lista (NO descarga) productos NISAR SME2 y GCOV por zona.
No requiere credenciales. Uso:  python scripts/01_listar_nisar.py [--desde 2026-05-14] [--hasta 2026-11-14]
Escribe data/raw/nisar_listado.json (ignorado por git)."""
import argparse, json, pathlib, statistics
import asf_search as asf
from zonas import ZONAS, wkt

p = argparse.ArgumentParser()
p.add_argument("--desde", default="2026-05-14")
p.add_argument("--hasta", default="2026-11-14")
args = p.parse_args()

def tam_h5(prod):
    for f in prod.umm.get("DataGranule", {}).get("ArchiveAndDistributionInformation", []):
        if f.get("Name", "").endswith(".h5") and "QA" not in f["Name"]:
            m = {"B": 1, "KB": 1e3, "MB": 1e6, "GB": 1e9}.get(f.get("SizeUnit", "B"), 1)
            return f.get("Size", 0) * m
    return None

salida = {}
for zid, z in ZONAS.items():
    salida[zid] = {}
    for tipo in ("SME2", "GCOV"):
        r = asf.search(dataset=asf.DATASET.NISAR, processingLevel=tipo, intersectsWith=wkt(z["bbox"]),
                       start=f"{args.desde}T00:00:00Z", end=f"{args.hasta}T23:59:59Z", maxResults=2000)
        filas = [{"fecha": x.properties["startTime"], "nombre": x.properties["fileID"],
                  "url": x.properties["url"], "bytes": tam_h5(x),
                  "track": x.properties.get("pathNumber"), "frame": x.properties.get("frameNumber"),
                  "dir": x.properties.get("flightDirection")} for x in r]
        salida[zid][tipo] = filas
        fechas = sorted({f["fecha"][:10] for f in filas})
        tams = [f["bytes"] for f in filas if f["bytes"]]
        print(f"{zid:26s} {tipo}: {len(filas):3d} prod, {len(fechas):3d} fechas, "
              f"última {fechas[-1] if fechas else '-'}, mediana {statistics.median(tams)/1e6 if tams else 0:.0f} MB, "
              f"total {sum(tams)/1e9:.1f} GB")

out = pathlib.Path(__file__).resolve().parent.parent / "data/raw/nisar_listado.json"
out.write_text(json.dumps(salida, indent=1))
print("->", out)
