# Use of Super Intelligence (SI) — registro del equipo

> Space Apps 2026 llama "Super Intelligence (SI)" a la IA. La entrega **debe** describir cómo se usó. Este archivo es el borrador para el campo "Use of SI" del formulario. Llénalo **durante** el hackathon, no al final.
> Recuerda: la SI **no** puede usarse para idear la solución. Las imágenes y videos generados llevan marca de agua visible, y el código, audio y datos generados se identifican aquí y en el README.

## Template (antes del hackathon)
| Herramienta | Uso | Archivos |
|---|---|---|
| Claude Code (Anthropic) | Investigación de recursos públicos de los challenges, documentación del template, skills y código boilerplate (Next.js + Supabase) | `docs/`, `.claude/skills/` (las propias), `src/` |

## Proyecto (completar desde el sáb 14 nov 9:00)
| Herramienta | Uso | Archivos / assets | ¿Marca de agua o etiqueta? |
|---|---|---|---|
| Claude Code (Anthropic, Claude Opus 5.5) | Lectura de los textos oficiales de los desafíos A y B y de la guía de evaluación; verificación de disponibilidad de datos NISAR/SMAP/IMERG/POWER/Open-Meteo para Itapúa (solo listados y llamadas de prueba) | `docs/decision.md`, `docs/limitaciones.md` | Etiqueta en este archivo |
| Claude Code (Anthropic, Claude Opus 5.5) | Estructura del repo, integración del template, contratos de datos, scripts de listado/descarga (esqueletos), motor de reglas portado, endpoint `/api/recomendacion`, página y manifest provisionales, docs del equipo | `pipeline/`, `contracts/`, `src/lib/recomendacion.ts`, `src/app/api/recomendacion/`, `src/app/page.tsx`, `src/app/manifest.ts`, `src/components/DemoAreas.tsx`, `docs/plan-equipo.md`, `CLAUDE.md`, `README.md` | Etiqueta en este archivo |
| Claude Code (Anthropic, Claude Opus 5.5) | Datos de ejemplo **sintéticos** (marcados "EJEMPLO FICTICIO", `es_ejemplo: true`) | `public/data/humedad/*.json` | Sí, en el propio JSON y en la UI |
| Claude Code (Anthropic, rol Backend; modelos Claude Opus 5.5, Fable 5.1 y Sonnet 5.5) | Motor agronómico para soja, maíz y mandioca (temporada, ciclo, semilla, riesgos, ventana de siembra, lote) a partir de los documentos y las ideas del equipo; configuración por cultivo con umbrales **SUPUESTOS** sin validar; APIs `/api/cultivos`, `/api/analisis`, `/api/semilla`, `/api/ventana`, `/api/ranking`, `/api/lote`; tests | `config/cultivos/`, `src/lib/agro/`, `src/app/api/{cultivos,analisis,semilla,ventana,ranking,lote}/`, `src/app/api/README.md` | Etiqueta en este archivo; los valores agronómicos llevan `supuesto: true` |
| Claude Code (Anthropic, rol Backend) | Mapa de campo de San Rafael del Paraná y Bella Vista: distritos aproximados, grilla tipo NISAR de 200 m, aptitud, sectores del lote y página de prueba. Los datos SAR de la grilla son **sintéticos** (ruido determinista), no son NISAR | `config/zonas/`, `src/lib/mapa/`, `src/app/api/mapa/` | Sí: `es_ejemplo: true` y fuente "EJEMPLO FICTICIO (grilla generada, no es dato NISAR)" en las respuestas y en la página |

> Nota del equipo: la idea del proyecto (humedad del suelo con NISAR + orientación sembrar/esperar/precaución para agricultores de Itapúa, foco en cultivos principales, PWA) fue definida por el equipo. Algunos detalles técnicos sugeridos por la IA (agregación por distrito, máscara agrícola, uso de HV de GCOV) quedan **pendientes de decisión del equipo**.
