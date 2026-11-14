"""ESQUELETO — convierte .h5 NISAR (data/raw/nisar/) a data/processed/<zona>.json.

Esquema de salida:
  {"zona", "bbox":[lon_min,lat_min,lon_max,lat_max],
   "serie":[{"fecha","humedad_m3m3","hv_db","calidad"}]}

PENDIENTE DE VERIFICAR (aún no abrimos ningún .h5):
  - Rutas internas de la variable de humedad y de las banderas de calidad en SME2.
  - Rutas de HHHH/HVHV en GCOV (vienen en potencia lineal: hv_db = 10*log10(HVHV)).
  - Proyección: SME2 en EASE-Grid 200 m; GCOV en UTM -> reproyectar la bbox antes de recortar.
Explorar primero con:  h5ls -r archivo.h5 | less   o   python -c "import h5py; h5py.File(f).visit(print)"
"""
import json, pathlib, sys
from zonas import ZONAS

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def humedad_media_zona(ruta_h5, bbox):
    """TODO: abrir con h5py, recortar a bbox, aplicar máscara de calidad y devolver (media, calidad)."""
    raise NotImplementedError


def hv_db_medio_zona(ruta_h5, bbox):
    """TODO: abrir GCOV, recortar, media de HVHV en lineal y luego 10*log10."""
    raise NotImplementedError


def main():
    for zid, z in ZONAS.items():
        serie = []
        # TODO: recorrer archivos SME2/GCOV de la zona, emparejar por fecha y llenar `serie`.
        if not serie:
            print(f"{zid}: sin datos procesados aún; no se sobrescribe el JSON de ejemplo.", file=sys.stderr)
            continue
        out = {"zona": z["zona"], "id": zid, "bbox": z["bbox"], "fuente": "NISAR SME2/GCOV (provisional)", "serie": serie}
        (RAIZ / f"data/processed/{zid}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
