"""Descarga la SERIE completa de NISAR SME2 de un track sobre las áreas de pipeline/zonas.py.

Uso (en TU terminal, porque pide la contraseña con getpass):
    .venv/bin/python pipeline/06_descargar_serie.py                 # track 82 (por defecto)
    .venv/bin/python pipeline/06_descargar_serie.py --solo-listar   # solo lista, sin login
    .venv/bin/python pipeline/06_descargar_serie.py --track 132

Por qué un solo track: misma órbita y mismo ángulo de incidencia en todas las fechas → serie más comparable.
Track 82 (descendente) cubre las 5 áreas: 10 escenas del 19-jun al 17-oct-2026, ~1,15 GB (listado del 2026-11-14).
Los archivos que ya existen completos se saltean. Destino: data/raw/sme2/ (ignorado por git).
Después: .venv/bin/python pipeline/03_procesar_nisar.py --track 82
"""
import argparse, importlib.util, pathlib, sys
import asf_search as asf
from zonas import bbox_union, wkt

RAIZ = pathlib.Path(__file__).resolve().parent.parent
# Reutiliza tam/credenciales/descargar del script 05 (nombre con número: se carga por ruta)
_spec = importlib.util.spec_from_file_location("descarga05", pathlib.Path(__file__).with_name("05_descargar_extremos.py"))
d05 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(d05)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--track", type=int, default=82)
    ap.add_argument("--solo-listar", action="store_true")
    args = ap.parse_args()

    print("Buscando NISAR SME2 en el catálogo de NASA (2–30 s)…", flush=True)
    res = asf.search(dataset=asf.DATASET.NISAR, processingLevel="SME2", intersectsWith=wkt(bbox_union()),
                     start="2025-01-01T00:00:00Z", maxResults=2000)
    escenas = sorted((p for p in res if p.properties.get("pathNumber") == args.track), key=lambda p: p.properties["startTime"])
    if not escenas:
        sys.exit(f"No hay escenas SME2 del track {args.track} sobre las áreas.")

    destino = RAIZ / "data" / "raw" / "sme2"
    destino.mkdir(parents=True, exist_ok=True)
    faltan = []
    for p in escenas:
        nombre = p.properties["url"].rsplit("/", 1)[-1]
        f = destino / nombre
        ya = f.exists() and f.stat().st_size == d05.tam(p)
        print(f"  {p.properties['startTime'][:10]}  {d05.tam(p)/1e6:5.0f} MB  {'ya descargado' if ya else 'FALTA'}")
        if not ya:
            faltan.append(p)
    total = sum(d05.tam(p) for p in faltan)
    print(f"Track {args.track}: {len(escenas)} escenas; faltan {len(faltan)} ({total/1e9:.2f} GB).")
    if args.solo_listar or not faltan:
        return
    if input(f"¿Descargar {total/1e9:.2f} GB en {destino}? [s/N] ").strip().lower() != "s":
        sys.exit("Cancelado.")

    usuario, clave = d05.credenciales()
    try:
        sesion = asf.ASFSession().auth_with_creds(usuario, clave)
    except Exception as e:
        sys.exit(f"Login Earthdata falló: {e}")
    finally:
        del clave
    for i, p in enumerate(faltan, 1):
        print(f"[{i}/{len(faltan)}]", end=" ")
        d05.descargar(sesion, p, destino)
    print(f"\nListo. Ahora: .venv/bin/python pipeline/03_procesar_nisar.py --track {args.track}")


if __name__ == "__main__":
    main()
