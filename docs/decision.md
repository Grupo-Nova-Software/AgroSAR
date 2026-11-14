# Decisión: ¿qué desafío elegir?

> Investigado el 2026-11-14. **C** = CONFIRMADO en la fuente oficial o en una prueba real · **S** = SUPUESTO / juicio nuestro.

## Recomendación: **A) Dancing with the SARs**
Nuestra idea (serie temporal de humedad del suelo en 3 zonas de Itapúa + orientación) encaja casi literalmente con A: app interactiva con **NISAR** que muestre cambios de superficie en el tiempo, con "actionable insights"; menciona explícitamente agricultura y humedad del suelo (C). B pide otra cosa: una herramienta para **explorar estrategias de rotación de cultivos** y salud del suelo (C). Presentar "sembrar/esperar/precaución" en B arriesga el criterio **Relevance** ("fully and directly addresses the challenge", C, Judging Guide). Los datos NISAR existen y son recientes para las 3 zonas (C, ver abajo).

**Dudas abiertas:** (1) SME2 es **provisional** (parcialmente validado; meta de precisión 0,06 m³/m³) (C). (2) Los GCOV pesan ~2 GB cada uno (C): solo podremos bajar unos pocos. (3) Aún no abrimos ningún `.h5` (sin credenciales Earthdata): la estructura interna no está verificada. (4) Los umbrales sembrar/esperar/precaución son supuestos (S).

## Resumen de cada desafío (C, texto oficial)
| | A) Dancing with the SARs | B) Field Shift |
|---|---|---|
| Qué pide | App interactiva que use **NISAR** para seguir y visualizar ≥1 tipo de cambio de superficie (agricultura, humedad del suelo, inundación…) en un lugar elegido | Herramienta de apoyo a decisiones con datos NASA + suelo, cultivos y prioridades del agricultor para **explorar rotaciones** que mejoren el suelo y la resiliencia |
| Salidas sugeridas | Mapas de cambio, animaciones de series, dashboards; código abierto; relato/informe; hipótesis de causas físicas | App/modelo/mapa; "puede comparar al menos 3 estrategias de rotación" (incl. la actual) con evidencia, beneficios, vacíos y riesgos |
| Datos | Earthdata Search, ASF Vertex, NISAR User Guide, ARSET (ES), StoryMaps; socios: RCM/RADARSAT (CSA), **SAOCOM (CONAE)** | SMAP, GPM/IMERG, Landsat/MODIS/VIIRS, POWER, SRTM, ECOSTRESS, GLDAS, GEDI, FAO GAEZ, Sentinel-2, ERA5 + muchas fuentes **solo EE. UU.** (SSURGO, CDL, PRISM, NAIP…) |

**Entregables comunes (C, Submission Guide):** video ≤30 s (con subtítulos en inglés) **o** ≤7 diapositivas en inglés; formulario en inglés; enviar antes del **15-nov 23:59 hora local**; listar todos los recursos; señalar el uso de IA. **Criterios (C):** Impact, Creativity, Validity, Relevance, Presentation (puntaje 1–5). Ninguna de las dos páginas de desafío agrega criterios propios.

## Datos para Itapúa (pruebas reales, sin descargar nada)
| Fuente | Resultado |
|---|---|
| NISAR **SME2** (L3, 200 m) | Área total: 36 productos, 34 fechas, 2026-06-19 → **2026-10-21**; .h5 de 34–128 MB (mediana 123); **3,9 GB** en total. Por zona: Natalio 24 fechas, Noreste 24, Obligado/Hohenau/Miranda 19; hueco máx. 16 días (C) |
| NISAR **GCOV** (L2, HH/HV) | 44 productos, 40 fechas, hasta **2026-10-29**; .h5 de 1,4–2,0 GB; **84 GB** en total (C). Por zona: 30/30/20 fechas |
| NASA POWER | OK sin login. Lluvia, T2M y GWETTOP hasta el 10-nov (C) |
| Open-Meteo | OK sin login. Humedad de suelo de modelo (no NASA) + pronóstico (C) |
| SMAP L3 (SPL3SMP 36 km / SPL3SMP_E 9 km) | 48–49 gránulos desde el 1-oct; el último, del **12-nov** (CMR) (C) |
| GPM IMERG Early/Late | 43–44 gránulos diarios; el último, del 13-nov (CMR) (C) |
| Descarga NISAR/SMAP/IMERG | Requiere **login Earthdata** (HTTP 302 → URS). En esta máquina no hay `~/.netrc` ni credenciales (C) |

## Comparación A vs B (S, juicio nuestro)
| Criterio | A | B |
|---|---|---|
| Ajuste a nuestra idea | **Alto** | Medio-bajo (faltan las rotaciones) |
| Riesgo de datos | Medio (NISAR provisional, archivos grandes) | Bajo en clima; alto en suelo/cultivos locales (las fuentes son de EE. UU.) |
| Esfuerzo en 48 h con 4 personas | Medio-alto (HDF5, recorte a 200 m) | Alto (modelo agronómico de rotaciones + 3 estrategias) |
| Capacidad de diferenciarnos | **Alta** (NISAR es nuevo y poco usado; Agencia Espacial del Paraguay es socia) | Media (tema muy concurrido) |
| Riesgo de incumplir requisitos | Bajo si NISAR es el núcleo | **Medio-alto** (Relevance) |

**Paso manual (Earthdata):** crear una cuenta en urs.earthdata.nasa.gov → autorizar las apps "ASF" y "NASA GESDISC DATA ARCHIVE" → crear `~/.netrc` (chmod 600) o usar `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`. Alternativa: ASF Vertex → Dataset "NISAR" → dibujar el área de Itapúa → filtrar por SME2 → cola de descarga.
