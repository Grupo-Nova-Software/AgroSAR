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

## Mapa de campo (San Rafael del Paraná y Bella Vista)

> Grilla SAR **FICTICIA** (determinista) de 200 m sobre los dos distritos, hasta que el pipeline procese NISAR SME2.
> Límites de distritos **aproximados** (`config/zonas/itapua.json`). Fondo real: imagen satelital Esri y NASA GIBS (HLS 30 m, NDVI MODIS).

| Endpoint | Qué responde |
|---|---|
| `GET /api/mapa/demo` | **Página de prueba** del mapa (Leaflet): capas, grilla coloreada por aptitud / humedad / cobertura, dibujo del lote y panel de análisis. Referencia para el frontend, no es la UI final. |
| `GET /api/mapa/zonas` | GeoJSON de los distritos + `bbox` para centrar el mapa |
| `GET /api/mapa/celdas?bbox=w,s,e,n&cultivo=soja&fecha=AAAA-MM-DD&res=200` | GeoJSON de celdas con `cobertura` (cultivo/pastura/bosque/agua/urbano), `pendiente_pct`, `humedad_m3m3`, `humedad_estado`, `aptitud` 0–100, `apto`, `motivos`. Si el bbox es grande, sube la resolución (`res_m`) para no pasar de 4000 celdas. |
| `POST /api/lote` | Ahora arma la **serie SAR de las celdas del lote** (ficticia), devuelve `sectores` (ha aptas, % por cobertura, humedad min/media/max, 3 mejores y peores sectores) y `celdas` en GeoJSON para pintar el lote. Máximo 10 000 ha. |

Flujo para el frontend: `zonas` → centrar mapa → `celdas` por `moveend` (zoom ≥ 11) → el agricultor dibuja el polígono → `POST /api/lote` → pintar `celdas` del lote por `aptitud` y mostrar `analisis` + `sectores`.

Tests del mapa: `node --import ./src/lib/agro/__tests__/registro.mjs --test src/lib/mapa/__tests__/mapa.test.mjs`

## Cambios del 14-nov (noche)
- **Fecha por defecto = hoy** (hora de Paraguay), ya no la de la última pasada. La temporada y los consejos son para el día en que se abre la app.
- **`humedad`** usa la última pasada NISAR disponible aunque esté fuera de la ventana de 10 días, y agrega
  `dias_desde_observacion` (antigüedad del dato) y `desactualizada` (`true` si pasa de 24 días, SUPUESTO).
- **`POST /api/lote`** analiza el lote en cualquier lugar: usa la grilla NISAR real de `public/data/grilla/` (índice en `index.json`)
  y trata el lote como cultivable (no hay capa real de cobertura). Fuera de las áreas con grilla, la humedad es ficticia y `es_ejemplo: true`.

## Clima (`/api/clima`, `/api/clima/mapa`)

> **Fuentes:** NASA POWER (histórico diario, dato NASA, sin login; publica con 2–3 días de demora y los faltantes `-999` se descartan) ·
> Open-Meteo (pronóstico horario y 14 días; **modelo, NO es dato NASA**, CC BY 4.0) · NISAR SME2 (`public/data/humedad/`).
> **Umbrales SUPUESTOS** del equipo en `src/lib/clima/supuestos.ts` (regla de pulverización, calor, helada, niveles de sequía).
> Los 4 niveles de sequía son una clasificación propia: **no** son un protocolo oficial del MAG ni de la SEN.
> El backend devuelve códigos y números; los textos EN / ES los arma la interfaz.

### `GET /api/clima?area=natalio&cultivo=soja` · `GET /api/clima?lat=-26.65&lon=-54.81&cultivo=maiz`
Con `area`, usa el centro de la zona (el de `config/zonas/itapua.json` si es un distrito; si no, el centro de su bbox).
Con `lat` y `lon` (clic en la chacra), responde para ese punto y busca la zona NISAR que lo contiene o la más cercana.
Opcional: `fecha_siembra=AAAA-MM-DD`. Errores: 400 (parámetros), 404 (área), 502 (no respondió ninguna fuente).

| Campo | Qué responde |
|---|---|
| `lluvia.hoy` / `lluvia.manana` | `mm`, `prob_max_pct`, `llueve` y `pico` (bloque de horas seguidas con más agua). "Hoy" cuenta solo lo que falta del día |
| `ventanas_secas[]` | Bloques de días seguidos con menos de 2 mm en los próximos 14 días |
| `pulverizacion` | `regla` + horas aptas y bloques de hoy y mañana (viento 3–15 km/h, sin lluvia, < 30 °C, HR > 40 %) |
| `temperatura` | Hora del pico de calor y de la mínima (con punto de rocío), `estres_calor` y `helada` |
| `temperatura.helada` | `riesgo` (`ninguno` / `bajo` / `alto`) con la **mínima pronosticada**, el registro de POWER de 30 días y el período por calendario del cultivo |
| `sequia` | `nivel` (`optimo` / `atencion` / `moderada` / `severa`), `factores[]`, `dias_sin_lluvia`, balance P − ET0 de 15 y 30 días y de los próximos 14, y `nisar` (última pasada, antigüedad, `desactualizada`) |
| `perspectiva` | Lluvia **normal** de este mes y los 3 siguientes (climatología NASA POWER, **no es pronóstico**), etapas del cultivo por mes y anomalía del mes actual |
| `horario[]` (48 h) · `diario[]` (14 d) · `historico[]` (30 d) | Series para la interfaz. Cada día del histórico dice su `fuente` (`nasa_power` u `open_meteo` para los días que POWER todavía no publicó) |
| `estado_fuentes` | Qué fuente respondió. Si una falla, el resto se devuelve igual |

Notas: la ET0 de los días de POWER se calcula con **FAO-56 Penman-Monteith** (`et0PenmanMonteith`); `GWETTOP` es una fracción 0–1 de un modelo
y **no se compara** con NISAR (m³/m³); una pasada NISAR de más de 24 días no decide el nivel de sequía.

### `GET /api/clima/mapa`
Grilla de pronóstico sobre Itapúa (9 × 6 puntos, ~30 km, una sola llamada a Open-Meteo): 48 h en pasos de 3 h (`h`) y 14 días (`d`),
más 7 **puntos de referencia** (`nodos`). Los valores de los nodos son del modelo, **no mediciones de estaciones**; sus coordenadas
las pasó el equipo y no están verificadas. El frontend interpola la grilla para dibujar las capas.

### Caché (Next.js 16, `cacheComponents`)
`src/lib/clima/fuentes.ts` usa `'use cache'` + `cacheLife("hours")` (climatología: `"weeks"`). Las coordenadas se redondean a 2 decimales
(~1 km) y la fecha / hora local van como argumento: son la clave de caché.

Tests: `node --import ./src/lib/agro/__tests__/registro.mjs --test src/lib/clima/__tests__/clima.test.mjs`
