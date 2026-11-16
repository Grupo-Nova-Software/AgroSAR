"""Área de estudio del pipeline: TODO el departamento de Itapúa.

Antes había 5 rectángulos (zonas y distritos aproximados). Ahora hay una sola área, con el contorno real del
departamento (config/zonas/itapua_contorno.json, generado por pipeline/09_contorno_itapua.py a partir de
OpenStreetMap). El pipeline, el backend y el mapa de la app usan ese mismo archivo.
Formato bbox: [lon_min, lat_min, lon_max, lat_max] (WGS84). Anillo: [[lon, lat], ...] cerrado.
"""
import json, pathlib

import numpy as np

_RUTA = pathlib.Path(__file__).resolve().parent.parent / "config" / "zonas" / "itapua_contorno.json"
if not _RUTA.exists():
    raise SystemExit(f"Falta {_RUTA}. Corré antes: .venv/bin/python pipeline/09_contorno_itapua.py")
CONTORNO = json.loads(_RUTA.read_text())

ZONAS = {
    "itapua": {"zona": "Itapúa", "tipo": "departamento", "bbox": CONTORNO["bbox"], "anillo": CONTORNO["anillo"]},
}


def dentro_del_anillo(lon, lat, anillo):
    """Máscara booleana: qué puntos (lon, lat: arreglos de la misma forma) caen dentro del anillo.
    Trazado de rayos, vectorizado por lado del polígono."""
    a = np.asarray(anillo, float)
    x, y = a[:, 0], a[:, 1]
    dentro = np.zeros(np.shape(lon), bool)
    for i in range(len(x) - 1):
        x1, y1, x2, y2 = x[i], y[i], x[i + 1], y[i + 1]
        if y1 == y2:
            continue
        cruza = ((y1 > lat) != (y2 > lat)) & (lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1)
        dentro ^= cruza
    return dentro


def mascara_itapua(lon_1d, lat_1d):
    """Máscara [filas, columnas] de las celdas cuyo centro cae dentro de Itapúa (lat_1d: filas, lon_1d: columnas)."""
    lon, lat = np.meshgrid(np.asarray(lon_1d, float), np.asarray(lat_1d, float))
    return dentro_del_anillo(lon, lat, CONTORNO["anillo"])


def wkt(bbox):
    a, b, c, d = bbox
    return f"POLYGON(({a} {b},{c} {b},{c} {d},{a} {d},{a} {b}))"


def bbox_union():
    """Rectángulo que contiene todas las áreas (para buscar escenas una sola vez)."""
    cajas = [z["bbox"] for z in ZONAS.values()]
    return [min(c[0] for c in cajas), min(c[1] for c in cajas), max(c[2] for c in cajas), max(c[3] for c in cajas)]
