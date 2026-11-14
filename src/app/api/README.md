# APIs del backend — AgroSAR (rol Backend)

> **Estado:** funcionando con **datos FICTICIOS** (`public/data/humedad/*.json`, `es_ejemplo: true`) y **umbrales SUPUESTOS**
> (`config/cultivos/*.json`). Cuando el rol Datos publique la humedad NISAR real con el mismo contrato, las APIs la usan sin cambios.
> El clima (temperatura, radiación, pronóstico de lluvia) se integra **mañana**: hoy las heladas se estiman por calendario.

Cultivos: `soja`, `maiz`, `mandioca`. Áreas: las de `public/data/humedad/index.json` (`natalio`, `noreste`, `obligado_hohenau_miranda`).
Todas las respuestas traen `aviso` (texto de datos provisionales) y `supuesto: true`. Errores: `{ "error": "..." }` con 400/404.

## Parámetros comunes (query string o JSON)
| Parámetro | Valores | Para qué |
|---|---|---|
| `cultivo` | `soja` · `maiz` · `mandioca` | Por defecto `soja` |
| `fecha` | `AAAA-MM-DD` | Fecha de referencia. Por defecto, la última observación NISAR del área |
| `fecha_siembra` | `AAAA-MM-DD` | Si ya se sembró → **modo seguimiento** (alertas del cultivo en curso) |
| `ciclo` | ids de `GET /api/cultivos` | Ciclo de la semilla. Por defecto, el sugerido |
| `suelo` | `arcilloso` · `arenoso` · `franco` · `humedo` · `degradado` | Tipo de suelo del lote |
| `ph` | 0–14 | Acidez |
| `fertilidad` | `baja` · `media` · `alta` | |
| `drenaje` | `bueno` · `malo` | |
| `compactado`, `preparado` | `true` · `false` | |
| `pendiente_pct`, `materia_organica_pct` | 0–100 | |
| `profundidad` | `profundo` · `superficial` | |

## Endpoints

### `GET /api/cultivos` · `GET /api/cultivos?id=maiz`
Catálogo para armar la UI: temporadas, ciclos, etapas, umbrales de humedad, tabla suelo→semilla, catálogo de problemas.

### `GET /api/analisis?area=natalio&cultivo=maiz&suelo=arcilloso&ph=5.0`
**El endpoint principal.** Devuelve:
- `estado`: `sembrar` | `esperar` | `precaucion`, más `etiqueta` y `motivo` (en lenguaje simple)
- `modo`: `planificar` (sin `fecha_siembra`) | `seguimiento`
- `humedad`: estado (`seco` | `bajo` | `optimo` | `humedo` | `saturado` | `sin_datos`), media en m³/m³, n.º de observaciones, tendencia
- `temporada`: `en_ventana` | `tramo_tardio` | `temprana` | `tardia` | `fuera`, días restantes o de diferencia, próxima temporada
- `ventana`: `sembrar_ahora`, `dias_espera`, `fecha_estimada`, `motivo`
- `semilla`: semilla recomendada, motivo, `ciclo_sugerido`, alternativas (y guía de selección en mandioca)
- `fechas`: emergencia, etapas (con `critica_agua`), madurez, cosecha y límite de cosecha
- `alertas[]`: `{ id, problema_id, nivel: critico|advertencia|info, categoria, titulo, detalle, recomendacion, fuente_dato }`
  - `fuente_dato`: `nisar` (satélite) · `usuario` (lo que cargó) · `calendario` · `clima_pendiente`
- `pendiente_clima[]`: problemas que se resuelven cuando se integre el clima
- `fuentes[]`, `es_ejemplo`

### `GET /api/semilla?cultivo=soja&suelo=arenoso&fecha=2026-11-14`
"¿Qué semilla uso?". Indica si la siembra es tardía (→ semilla tardía) y el ciclo que madura antes de las heladas.
Con `&area=<id>` suma la humedad NISAR para detectar riesgo de estrés hídrico.

### `GET /api/ventana?area=noreste&cultivo=maiz&suelo=arcilloso`
"¿Siembro ahora o dentro de cuánto?" → `sembrar_ahora`, `dias_espera`, `fecha_estimada`, `motivo`.

### `GET /api/ranking?cultivo=soja`
"¿Dónde conviene más?" → áreas ordenadas por `puntaje` con su estado y humedad.

### `POST /api/lote`
Para el mapa: el frontend manda el polígono que dibujó el agricultor.
```json
{
  "cultivo": "maiz",
  "poligono": { "type": "Polygon", "coordinates": [[[-55.15,-26.75],[-55.14,-26.75],[-55.14,-26.741],[-55.15,-26.741],[-55.15,-26.75]]] },
  "fecha_siembra": "2026-09-10",
  "suelo": { "tipo": "franco", "ph": 6.1 }
}
```
Respuesta: `lote` (`hectareas`, `centroide`, `bbox`, `area_id`, `zona`, `dentro_de_area`, `areas_intersectadas`) + `analisis` (igual a `/api/analisis`).
Acepta `Polygon`, `MultiPolygon` o `Feature`, en WGS84 `[lon, lat]`.

### `GET /api/recomendacion` (contrato v0, sin cambios)
Se mantiene igual que en `contracts/recomendacion.schema.json`.

## Qué problema resuelve cada parte
| Cultivo | Problema (documentos del equipo) | Dónde |
|---|---|---|
| Los 3 | Falta / exceso de agua, suelo saturado, maquinaria | `src/lib/agro/humedad.ts`, `riesgos.ts` (NISAR) |
| Los 3 | Temporada: temprana, tardía, fuera de época | `temporada.ts` |
| Los 3 | Semilla según suelo; semilla tardía | `semilla.ts` + `config/cultivos/*.json` |
| Los 3 | ¿Sembrar ahora o cuándo? | `ventana.ts` |
| Los 3 | Fechas de floración, madurez y cosecha | `ciclo.ts` |
| Soja, maíz | Heladas antes de madurar (zafriña) | `heladas.ts` (calendario; clima real mañana) |
| Maíz, soja | Agua en floración / etapas posteriores | `riesgos.ts` (serie NISAR por etapa) |
| Los 3 | Acidez, nutrientes, MO, compactación, erosión, drenaje, profundidad, preparación | `suelo.ts` (datos del usuario) |
| Mandioca | Malezas, cosecha tardía, selección de ramas-semilla, heladas en invierno | `riesgos.ts` |
| Todos | Mapear la chacra (hectáreas, área NISAR) | `lote.ts` |

## Tests
```bash
node --import ./src/lib/agro/__tests__/registro.mjs --test src/lib/agro/__tests__/motor.test.mjs
```
