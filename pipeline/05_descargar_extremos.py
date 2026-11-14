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
import argparse, collections, getpass, os, pathlib, sys, time
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
        print(f"Buscando {nombre} en el catálogo de NASA (suele tardar 2–30 s; si tarda más, CMR está lento: esperá)…", flush=True)
        t0 = time.time()
        r = asf.search(intersectsWith=POLIGONO, start=DESDE, end=HASTA, maxResults=2000, **filtro)
        print(f"\n=== {nombre}: {len(r)} resultados ({time.time()-t0:.0f} s)")
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
    for p in (a, b):
        descargar(sesion, p, destino)


def descargar(sesion, p, destino):
    """Descarga con barra de progreso; si el archivo ya está completo, lo saltea."""
    url = p.properties["url"]
    f = destino / url.rsplit("/", 1)[-1]
    esperado = tam(p)
    if f.exists() and f.stat().st_size == esperado:
        print(f"  ya existe, se saltea: {f.name}")
        return
    parcial = f.with_suffix(f.suffix + ".part")
    with sesion.get(url, stream=True, timeout=120) as r:
        if r.status_code in (401, 403):
            sys.exit(f"Acceso denegado ({r.status_code}). Revisá credenciales y la app 'ASF' en Earthdata.")
        r.raise_for_status()
        if "text/html" in r.headers.get("Content-Type", ""):
            sys.exit("Earthdata devolvió una página HTML (login/EULA) en vez del archivo. "
                     "Revisá credenciales y aceptá la app/EULA de ASF en urs.earthdata.nasa.gov.")
        hecho = 0
        with open(parcial, "wb") as out:
            for chunk in r.iter_content(chunk_size=1 << 20):
                out.write(chunk)
                hecho += len(chunk)
                pct = 100 * hecho / esperado if esperado else 0
                print(f"\r  {f.name[:60]}…  {hecho/1e6:6.0f}/{esperado/1e6:.0f} MB  {pct:5.1f}%", end="", flush=True)
    print()
    parcial.rename(f)
    ok = f.stat().st_size == esperado
    print(f"  {'OK' if ok else 'ERROR tamaño'}: {f.name} ({f.stat().st_size/1e6:.0f} MB)")


if __name__ == "__main__":
    main()
