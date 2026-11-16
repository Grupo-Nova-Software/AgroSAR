"""Contorno del departamento de Itapúa → config/zonas/itapua_contorno.json

Fuente: OpenStreetMap (relación 389898, límite administrativo de Itapúa) vía Nominatim. © OpenStreetMap contributors, ODbL 1.0.
No requiere login. El contorno original tiene ~19 mil puntos; se simplifica (Douglas-Peucker) para que pese poco
y se pueda usar igual en el pipeline, en el backend y en el mapa de la app (los tres usan ESTE archivo).

Uso:  .venv/bin/python pipeline/09_contorno_itapua.py [--tolerancia-m 60] [--desde archivo_nominatim.json]
"""
import argparse, json, pathlib, urllib.request

import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "config" / "zonas" / "itapua_contorno.json"
URL = "https://nominatim.openstreetmap.org/search?state=Itap%C3%BAa&country=Paraguay&format=jsonv2&polygon_geojson=1&limit=1"
M_LAT = 110_570.0


def simplificar(pts, tol):
    """Douglas-Peucker iterativo sobre un anillo abierto (en metros planos)."""
    n = len(pts)
    conservar = np.zeros(n, bool)
    conservar[[0, n - 1]] = True
    pila = [(0, n - 1)]
    while pila:
        a, b = pila.pop()
        if b <= a + 1:
            continue
        p, q = pts[a], pts[b]
        seg = q - p
        largo = np.hypot(*seg)
        medio = pts[a + 1:b] - p
        d = np.abs(seg[0] * medio[:, 1] - seg[1] * medio[:, 0]) / largo if largo > 0 else np.hypot(medio[:, 0], medio[:, 1])
        i = int(d.argmax())
        if d[i] > tol:
            k = a + 1 + i
            conservar[k] = True
            pila += [(a, k), (k, b)]
    return conservar


def area_km2(lonlat):
    k = 111_320.0 * np.cos(np.radians(lonlat[:, 1].mean()))
    x, y = lonlat[:, 0] * k, lonlat[:, 1] * M_LAT
    return abs((x[:-1] * y[1:] - x[1:] * y[:-1]).sum()) / 2 / 1e6


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tolerancia-m", type=float, default=60)
    ap.add_argument("--desde", help="respuesta de Nominatim ya descargada (para no volver a pedirla)")
    args = ap.parse_args()

    if args.desde:
        datos = json.loads(pathlib.Path(args.desde).read_text())
    else:
        with urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "geo-research-script/1.0"}), timeout=60) as r:
            datos = json.loads(r.read())
    reg = datos[0]
    geo = reg["geojson"]
    polis = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
    # Anillo exterior del polígono más grande (se descartan islotes sueltos y los huecos interiores)
    exterior = max((np.array(p[0], float) for p in polis), key=area_km2)

    k = 111_320.0 * np.cos(np.radians(exterior[:, 1].mean()))
    plano = np.column_stack([exterior[:, 0] * k, exterior[:, 1] * M_LAT])
    # El anillo es cerrado (primer punto = último): se parte en dos mitades para que el algoritmo tenga extremos distintos
    mitad = len(plano) // 2
    conservar = np.concatenate([simplificar(plano[:mitad + 1], args.tolerancia_m)[:-1], simplificar(plano[mitad:], args.tolerancia_m)])
    anillo = exterior[conservar]
    if not np.allclose(anillo[0], anillo[-1]):
        anillo = np.vstack([anillo, anillo[:1]])
    anillo = np.round(anillo, 5)

    lon, lat = anillo[:, 0], anillo[:, 1]
    # Centroide del polígono (no el promedio de los puntos)
    cruz = lon[:-1] * lat[1:] - lon[1:] * lat[:-1]
    cx = ((lon[:-1] + lon[1:]) * cruz).sum() / (3 * cruz.sum())
    cy = ((lat[:-1] + lat[1:]) * cruz).sum() / (3 * cruz.sum())
    salida = {
        "_fuente": f"© OpenStreetMap contributors (ODbL 1.0) · {reg.get('osm_type')} {reg.get('osm_id')} · {reg.get('display_name')}",
        "_nota": f"Anillo exterior simplificado (Douglas-Peucker, tolerancia {args.tolerancia_m:g} m). Sin islotes ni enclaves. Generado por pipeline/09_contorno_itapua.py.",
        "id": "itapua",
        "nombre": "Itapúa",
        "bbox": [float(lon.min()), float(lat.min()), float(lon.max()), float(lat.max())],
        "centro": [round(float(cx), 4), round(float(cy), 4)],
        "superficie_km2": round(area_km2(anillo)),
        "anillo": anillo.tolist(),
    }
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"✔ {SALIDA.relative_to(RAIZ)}: {len(exterior)} → {len(anillo)} puntos, {salida['superficie_km2']} km² "
          f"(original {area_km2(exterior):.0f} km²), bbox {salida['bbox']}, centro {salida['centro']}, {SALIDA.stat().st_size/1024:.0f} KB")


if __name__ == "__main__":
    main()
