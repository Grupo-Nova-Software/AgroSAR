"""Zonas de estudio. Centros verificados con OpenStreetMap/Nominatim (2026-11-14).
Las bbox (centro ± margen) son SUPUESTAS: ajustarlas a los límites reales de cada zona."""

ZONAS = {
    # Natalio: centro -26.756, -55.137
    "natalio": {"zona": "Natalio", "bbox": [-55.22, -26.86, -55.04, -26.66]},
    # Capitán Meza -26.830,-55.338 · Pirapó -26.858,-55.544 · Edelira Km 20 -26.767,-55.278
    "noreste": {"zona": "Noreste: Capitán Meza, Pirapó, Edelira", "bbox": [-55.62, -26.95, -55.24, -26.68]},
    # Obligado -27.055,-55.629 · Hohenau -27.071,-55.640 · Capitán Miranda -27.220,-55.801
    "obligado_hohenau_miranda": {"zona": "Obligado / Hohenau / Capitán Miranda", "bbox": [-55.88, -27.28, -55.55, -26.98]},
}


def wkt(bbox):
    a, b, c, d = bbox
    return f"POLYGON(({a} {b},{c} {b},{c} {d},{a} {d},{a} {b}))"
