"""Exporta un MAPA de humedad NISAR SME2 de todo Itapúa por fecha → public/data/mapa_humedad/<fecha>.png

Para mostrar el dato del satélite directamente sobre el mapa de la app (capa de imagen) y ver cómo cambia
entre pasadas. Cada PNG usa una paleta de 24 colores: color = humedad (seco marrón → bueno verde → muy mojado azul), transparente
donde NISAR no tiene dato válido (agua, bordes, sin estimación).

Georreferenciación: la grilla EASE-Grid 2.0 no es regular en latitud, y los mapas web usan Web Mercator.
Por eso cada píxel de salida (regular en longitud y en Y de Mercator) toma la celda NISAR más cercana.
`index.json` trae el bbox exacto de la imagen, las fechas y la escala de colores (para la leyenda).

Uso:  .venv/bin/python pipeline/08_exportar_mapa_humedad.py [--track 82] [--res 300]
"""
import argparse, json, math, pathlib, re, struct, zlib

import h5py
import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "data" / "raw" / "sme2"
SALIDA = RAIZ / "public" / "data" / "mapa_humedad"
G = "science/LSAR/SME2/grids/"
FILL = -9999
# Departamento de Itapúa (bbox de OpenStreetMap/Nominatim, 2026-11-14)
ITAPUA = [-57.05, -27.61, -54.64, -26.09]
FUENTE = "NISAR L3 SME2 (provisional) · NASA-ISRO · ASF DAAC"

# Escala de colores: (humedad m³/m³, R, G, B). Interpolación lineal entre paradas.
ESCALA = [
    (0.08, 156, 79, 26),    # muy seco: marrón
    (0.15, 224, 138, 44),   # seco: naranja
    (0.20, 242, 211, 107),  # algo seco: amarillo
    (0.27, 95, 183, 96),    # bueno: verde
    (0.35, 63, 167, 181),   # húmedo: verde azulado
    (0.42, 44, 111, 209),   # muy mojado: azul
    (0.50, 27, 63, 156),    # saturado: azul oscuro
]
ALFA = 205


def track_de(nombre):
    m = re.match(r"NISAR_L3_PR_SME2_\d+_(\d+)_", nombre)
    return int(m.group(1)) if m else None


def merc_y(lat):
    return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


NIVELES = 24  # clases de color (índice 0 = transparente / sin dato)


def paleta():
    """Colores de las NIVELES clases, interpolando la escala entre su mínimo y su máximo."""
    xs = np.array([e[0] for e in ESCALA])
    centros = np.linspace(xs[0], xs[-1], NIVELES)
    return [tuple(int(np.interp(c, xs, [e[k + 1] for e in ESCALA])) for k in range(3)) for c in centros]


def escribir_png(ruta, indices):
    """PNG de paleta (8 bits, 1 byte por píxel) sin dependencias: pesa ~4 veces menos que RGBA."""
    alto, ancho = indices.shape
    crudo = b"".join(b"\x00" + indices[i].tobytes() for i in range(alto))
    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF)
    plte = bytes([0, 0, 0]) + b"".join(bytes(c) for c in paleta())
    trns = bytes([0] + [ALFA] * NIVELES)
    ruta.write_bytes(b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 3, 0, 0, 0))
                     + bloque(b"PLTE", plte) + bloque(b"tRNS", trns)
                     + bloque(b"IDAT", zlib.compress(crudo, 9)) + bloque(b"IEND", b""))


def colorear(sm, valida):
    """Humedad → índice de paleta 1..NIVELES (0 = sin dato)."""
    lo, hi = ESCALA[0][0], ESCALA[-1][0]
    idx = np.rint((np.clip(sm, lo, hi) - lo) / (hi - lo) * (NIVELES - 1)).astype(np.uint8) + 1
    return np.where(valida, idx, 0).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--track", type=int, default=82)
    ap.add_argument("--res", type=float, default=300, help="tamaño de píxel de salida en metros (aprox.)")
    args = ap.parse_args()

    archivos = sorted(p for p in ENTRADA.glob("*.h5") if "_QA_" not in p.name and track_de(p.name) == args.track)
    SALIDA.mkdir(parents=True, exist_ok=True)
    lo1, la1, lo2, la2 = ITAPUA
    lat_media = math.radians((la1 + la2) / 2)
    ancho = round((lo2 - lo1) * 111_320 * math.cos(lat_media) / args.res)
    alto = round((la2 - la1) * 110_570 / args.res)
    # Centros de píxel: regulares en longitud y en Y de Mercator (norte → sur)
    lon_px = lo1 + (np.arange(ancho) + 0.5) * (lo2 - lo1) / ancho
    y1, y2 = merc_y(la1), merc_y(la2)
    y_px = y2 - (np.arange(alto) + 0.5) * (y2 - y1) / alto
    lat_px = np.degrees(2 * np.arctan(np.exp(y_px)) - np.pi / 2)

    fechas = []
    for ruta in archivos:
        with h5py.File(ruta, "r") as f:
            fecha = f["science/LSAR/identification/zeroDopplerStartTime"][()].decode()[:10]
            lat = f[G + "latitude"][:].astype(float)   # norte → sur
            lon = f[G + "longitude"][:].astype(float)  # oeste → este
            sm = f[G + "soilMoisture"][:]
            agua = f[G + "ancillaryData/waterbodyFraction"][:]
        valida = (sm != FILL) & (sm >= 0) & (sm <= 1) & ((agua == FILL) | (agua <= 0.5))
        # Celda NISAR más cercana a cada píxel
        fi = np.abs(lat[None, :] - lat_px[:, None]).argmin(axis=1)
        co = np.abs(lon[None, :] - lon_px[:, None]).argmin(axis=1)
        dentro_f = (lat_px <= lat.max()) & (lat_px >= lat.min())
        dentro_c = (lon_px >= lon.min()) & (lon_px <= lon.max())
        sm_px = sm[np.ix_(fi, co)]
        ok_px = valida[np.ix_(fi, co)] & dentro_f[:, None] & dentro_c[None, :]
        salida = SALIDA / f"{fecha}.png"
        escribir_png(salida, colorear(sm_px, ok_px))
        fechas.append(fecha)
        print(f"  ✔ {fecha}: {ancho}×{alto} px, {ok_px.mean()*100:.0f}% con dato, {salida.stat().st_size/1e3:.0f} KB")

    (SALIDA / "index.json").write_text(json.dumps({
        "fuente": FUENTE, "es_ejemplo": False, "res_m_aprox": args.res,
        "bbox": ITAPUA, "fechas": sorted(fechas),
        "escala": [{"humedad_m3m3": e[0], "color": "#%02x%02x%02x" % e[1:]} for e in ESCALA],
        "nota": "Imagen por fecha en <fecha>.png (paleta, transparente = sin dato). Proyección: regular en longitud y en Y de Web Mercator dentro del bbox.",
    }, ensure_ascii=False, indent=1))
    print(f"→ {SALIDA}")


if __name__ == "__main__":
    main()
