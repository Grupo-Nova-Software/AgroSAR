"""Descarga contexto climático de NASA POWER (sin login) para el centro de cada zona.
Variables: PRECTOTCORR (lluvia mm/día), T2M (°C), GWETTOP (humedad superficial relativa 0-1, NO m3/m3).
Uso: python pipeline/04_contexto_power.py --desde 20260601 --hasta 20261110
Escribe data/raw/power_<zona>.json"""
import argparse, json, pathlib, urllib.parse, urllib.request
from zonas import ZONAS

RAIZ = pathlib.Path(__file__).resolve().parent.parent
p = argparse.ArgumentParser()
p.add_argument("--desde", default="20260601")
p.add_argument("--hasta", default="20261110")
args = p.parse_args()

for zid, z in ZONAS.items():
    a, b, c, d = z["bbox"]
    q = urllib.parse.urlencode({"parameters": "PRECTOTCORR,T2M,GWETTOP", "community": "AG",
                                "longitude": round((a + c) / 2, 3), "latitude": round((b + d) / 2, 3),
                                "start": args.desde, "end": args.hasta, "format": "JSON"})
    url = "https://power.larc.nasa.gov/api/temporal/daily/point?" + q
    datos = json.load(urllib.request.urlopen(url, timeout=120))
    (RAIZ / f"data/raw/power_{zid}.json").write_text(json.dumps(datos))
    print(zid, "ok", datos.get("messages"))
