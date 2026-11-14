"""ESQUELETO — descarga productos NISAR listados por 01_listar_nisar.py.

Credenciales: NUNCA en el código. earthaccess las toma de:
  - ~/.netrc  (machine urs.earthdata.nasa.gov login ... password ...; chmod 600), o
  - variables de entorno EARTHDATA_USERNAME / EARTHDATA_PASSWORD.

Tamaños verificados (2026-11-14): SME2 ~123 MB/archivo (~3,9 GB todo Itapúa, 6 meses);
GCOV ~2 GB/archivo (~84 GB). Por defecto solo SME2 y pide confirmación antes de bajar.
Uso: python pipeline/02_descargar_nisar.py --tipo SME2 --zona natalio [--max 5]
"""
import argparse, json, pathlib
import earthaccess

RAIZ = pathlib.Path(__file__).resolve().parent.parent
p = argparse.ArgumentParser()
p.add_argument("--tipo", default="SME2", choices=["SME2", "GCOV"])
p.add_argument("--zona", required=True)
p.add_argument("--max", type=int, default=5)
args = p.parse_args()

listado = json.loads((RAIZ / "data/raw/nisar_listado.json").read_text())
filas = sorted(listado[args.zona][args.tipo], key=lambda f: f["fecha"], reverse=True)[: args.max]
total = sum(f["bytes"] or 0 for f in filas) / 1e9
print(f"{len(filas)} archivos {args.tipo} para {args.zona}: {total:.2f} GB")
if input("¿Descargar? [s/N] ").strip().lower() != "s":
    raise SystemExit("Cancelado.")

earthaccess.login(strategy="environment" if __import__("os").getenv("EARTHDATA_USERNAME") else "netrc")
destino = RAIZ / "data/raw/nisar" / args.tipo
destino.mkdir(parents=True, exist_ok=True)
earthaccess.download([f["url"] for f in filas], local_path=str(destino))

# TODO: evaluar lectura parcial remota (earthaccess.open + h5py) para GCOV en vez de bajar 2 GB.
