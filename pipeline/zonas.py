"""Áreas de estudio para las que el pipeline calcula series de humedad NISAR.

- Zonas agrícolas: centros verificados con OpenStreetMap/Nominatim (2026-11-14); bbox = centro ± margen (SUPUESTO).
- Distritos de trabajo del backend: copiados de config/zonas/itapua.json (rama backend), también APROXIMADOS.
  Si el backend cambia esos límites, actualizarlos acá.
Formato bbox: [lon_min, lat_min, lon_max, lat_max] (WGS84).
"""

ZONAS = {
    # Natalio: centro -26.756, -55.137
    "natalio": {"zona": "Natalio", "tipo": "zona", "bbox": [-55.22, -26.86, -55.04, -26.66]},
    # Capitán Meza -26.830,-55.338 · Pirapó -26.858,-55.544 · Edelira Km 20 -26.767,-55.278
    "noreste": {"zona": "Noreste: Capitán Meza, Pirapó, Edelira", "tipo": "zona", "bbox": [-55.62, -26.95, -55.24, -26.68]},
    # Obligado -27.055,-55.629 · Hohenau -27.071,-55.640 · Capitán Miranda -27.220,-55.801
    "obligado_hohenau_miranda": {"zona": "Obligado / Hohenau / Capitán Miranda", "tipo": "zona", "bbox": [-55.88, -27.28, -55.55, -26.98]},
    # Distritos del mapa de campo (backend: config/zonas/itapua.json)
    "san_rafael_del_parana": {"zona": "San Rafael del Paraná", "tipo": "distrito", "bbox": [-55.07, -26.80, -54.76, -26.52]},
    "bella_vista": {"zona": "Bella Vista", "tipo": "distrito", "bbox": [-55.68, -27.12, -55.49, -26.95]},
}


def wkt(bbox):
    a, b, c, d = bbox
    return f"POLYGON(({a} {b},{c} {b},{c} {d},{a} {d},{a} {b}))"


def bbox_union():
    """Rectángulo que contiene todas las áreas (para buscar escenas una sola vez)."""
    cajas = [z["bbox"] for z in ZONAS.values()]
    return [min(c[0] for c in cajas), min(c[1] for c in cajas), max(c[2] for c in cajas), max(c[3] for c in cajas)]
