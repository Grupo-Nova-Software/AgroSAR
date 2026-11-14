# contracts/ — contratos de datos entre roles

> **Estado: PROPUESTA v0.** Hay que confirmarla entre los 3 en la reunión inicial. Después, **cualquier cambio entra por PR aprobado por los 3**.

Un contrato es el formato acordado de un archivo que **un rol produce y otro consume**. Mientras los formatos se respeten, cada persona puede trabajar sola con datos de ejemplo, sin esperar a las demás.

| Contrato | Lo produce | Lo consume | Ubicación de los datos |
|---|---|---|---|
| `humedad.schema.json` | Datos (`pipeline/`) | Backend, Frontend | `public/data/humedad/<id>.json` + `index.json` |
| `recomendacion.schema.json` | Backend (`src/lib/`, `src/app/api/`) | Frontend | `GET /api/recomendacion?area=<id>&cultivo=<c>` |

Los tipos TypeScript equivalentes están en `src/types/contratos.ts` (también compartido; se cambia junto con estos esquemas).

## Reglas
- Para agregar un campo **opcional**: PR chico; nadie se rompe.
- Para renombrar o quitar un campo: avisar a los 3, porque rompe a quien lo consume.
- Todo dato de ejemplo lleva `"es_ejemplo": true` y la fuente `"EJEMPLO FICTICIO"`.
- Unidades en el nombre del campo (`_m3m3`, `_db`, `_mm`).
- Fechas en ISO `AAAA-MM-DD`; coordenadas en WGS84 `[lon, lat]`.
