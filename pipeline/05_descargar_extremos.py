"""Busca NISAR SME2 sobre Itapúa (área sur) y descarga 2 escenas: la más antigua y la más reciente.

Uso (en TU terminal, para que getpass pueda preguntar la contraseña):
    .venv/bin/python pipeline/05_descargar_extremos.py               # lista y descarga
    .venv/bin/python pipeline/05_descargar_extremos.py --solo-listar # solo lista, sin login

Respaldo automático: si no hay SME2 → NISAR GCOV → Sentinel-1 GRD_HD.
Las dos escenas se eligen del MISMO track/frame (el que tiene más fechas) para que cubran
la misma área y sean comparables. Destino: data/raw/<producto>/ (ignorado por git).
Credenciales: getpass (nunca se guardan). Alternativa no interactiva: variables de entorno
EARTHDATA_USERNAME / EARTHDATA_PASSWORD.
"""
import argparse, collections, getpass, os, pathlib, sys
import asf_search as asf

POLIGONO = "POLYGON((-56.2 -27.4, -55.3 -27.4, -55.3 -26.8, -56.2 -26.8, -56.2 -27.4))"
DESDE, HASTA = "2025-01-01T00:00:00Z", None  # todo el archivo disponible
RAIZ = pathlib.Path(__file__).resolve().parent.parent
LIMITE_SIN_CONFIRMAR_GB = 1.0

BUSQUEDAS = [
    ("NISAR SME2", dict(dataset=asf.DATASET.NISAR, processingLevel="SME2")),
    ("NISAR GCOV", dict(dataset=asf.DATASET.NISAR, processingLevel="GCOV")),
    ("SENTINEL-1 GRD_HD", dict(platform=asf.PLATFORM.SENTINEL1, processingLevel="GRD_HD")),
]


def tam(p):
    """Bytes del archivo principal que se descarga (properties['url'])."""
    b = p.properties.get("bytes")
    if isinstance(b, dict):  # NISAR: dict por archivo
        nombre = p.properties["url"].rsplit("/", 1)[-1]
        return (b.get(nombre) or {}).get("bytes") or 0
    return b or 0


def buscar():
    for nombre, filtro in BUSQUEDAS:
        r = asf.search(intersectsWith=POLIGONO, start=DESDE, end=HASTA, maxResults=2000, **filtro)
        print(f"\n=== {nombre}: {len(r)} resultados")
        if len(r):
            return nombre, list(r)
        print("    sin resultados, probando respaldo…")
    sys.exit("No se encontraron productos en ninguna búsqueda.")


def listar(nombre, res):
    res = sorted(res, key=lambda p: p.properties["startTime"])
    print(f"{'fecha (UTC)':20} {'track/frame':12} {'dir':4} {'MB':>7}  archivo")
    for p in res:
        pr = p.properties
        print(f"{pr['startTime'][:19]:20} {str(pr.get('pathNumber'))+'/'+str(pr.get('frameNumber')):12} "
              f"{(pr.get('flightDirection') or '?')[:4]:4} {tam(p)/1e6:7.0f}  {pr['url'].rsplit('/',1)[-1]}")
    total = sum(tam(p) for p in res)
    print(f"Total: {len(res)} archivos, {len({p.properties['startTime'][:10] for p in res})} fechas, {total/1e9:.2f} GB")
    return res


def elegir_extremos(res):
    grupos = collections.defaultdict(list)
    for p in res:
        grupos[(p.properties.get("pathNumber"), p.properties.get("frameNumber"))].append(p)
    clave, escenas = max(grupos.items(), key=lambda kv: len({x.properties["startTime"][:10] for x in kv[1]}))
    escenas.sort(key=lambda p: p.properties["startTime"])
    print(f"\nTrack/frame elegido {clave[0]}/{clave[1]} ({len(escenas)} escenas): misma área en ambas fechas.")
    return [escenas[0], escenas[-1]]


def credenciales():
    u, pw = os.getenv("EARTHDATA_USERNAME"), os.getenv("EARTHDATA_PASSWORD")
    if u and pw:
        return u, pw
    if not sys.stdin.isatty():
        sys.exit("Sin terminal interactiva: ejecutá el script en tu terminal o usá EARTHDATA_USERNAME/EARTHDATA_PASSWORD.")
    return input("Usuario Earthdata: ").strip(), getpass.getpass("Contraseña Earthdata (no se muestra): ")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo-listar", action="store_true")
    args = ap.parse_args()

    nombre, res = buscar()
    res = listar(nombre, res)
    a, b = elegir_extremos(res)
    total = tam(a) + tam(b)
    for etiqueta, p in (("MÁS ANTIGUA", a), ("MÁS RECIENTE", b)):
        print(f"  {etiqueta:12} {p.properties['startTime'][:10]}  {tam(p)/1e6:.0f} MB  {p.properties['url'].rsplit('/',1)[-1]}")
    print(f"  A descargar: {total/1e6:.0f} MB")
    if args.solo_listar:
        return

    if total / 1e9 > LIMITE_SIN_CONFIRMAR_GB and input(f"Son {total/1e9:.1f} GB. ¿Seguir? [s/N] ").lower() != "s":
        sys.exit("Cancelado.")

    destino = RAIZ / "data" / "raw" / nombre.split()[-1].lower()
    destino.mkdir(parents=True, exist_ok=True)
    usuario, clave = credenciales()
    try:
        sesion = asf.ASFSession().auth_with_creds(usuario, clave)
    except Exception as e:
        sys.exit(f"Login Earthdata falló: {e}\n¿Usuario/contraseña correctos? ¿Aprobaste la app 'ASF' en urs.earthdata.nasa.gov?")
    finally:
        del clave

    print(f"Descargando en {destino} …")
    asf.ASFSearchResults([a, b]).download(path=str(destino), session=sesion, processes=2)
    for p in (a, b):
        f = destino / p.properties["url"].rsplit("/", 1)[-1]
        ok = f.exists() and f.stat().st_size == tam(p)
        print(f"  {'OK ' if ok else 'ERROR'} {f.name} ({f.stat().st_size/1e6 if f.exists() else 0:.0f} MB)")


if __name__ == "__main__":
    main()
