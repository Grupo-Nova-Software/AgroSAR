@AGENTS.md

# AgroSAR Itapúa — instrucciones para Claude Code

> `AGENTS.md` (importado arriba) trae las **reglas del evento** y las convenciones de Next.js 16. Son obligatorias.
> Si hay diferencias de estructura, **este archivo manda** para este proyecto.

## Proyecto (tenelo siempre en cuenta)
- **Qué es:** una PWA (web instalable en el celular) para agricultores de **Itapúa, Paraguay**. Muestra la humedad del suelo medida por el radar **NASA-ISRO NISAR** en las zonas o distritos agrícolas, con foco en los cultivos principales (soja primero), y da una orientación simple: **sembrar / esperar / precaución**, con el porqué.
- **Desafío:** NASA Space Apps 2026, **"Dancing with the SARs"** (`docs/challenges/05-dancing-with-the-sars.md`). NISAR tiene que ser el **núcleo** de la app (criterio *Relevance*), no un adorno.
- **Fecha límite:** dom **15-nov-2026 23:59, hora local**. Demo: video ≤30 s con subtítulos en inglés, o ≤7 slides.
- **Stack:** Next.js 16 (App Router, `cacheComponents`) + React 19 + Tailwind 4 + TypeScript · Supabase (opcional) · Vercel · pnpm (`npx pnpm@11.20.0 …` si no está instalado) · pipeline en Python.
- **Idioma de las respuestas: respondé SIEMPRE en español** al usuario (mensajes, resúmenes, explicaciones), sin excepción.
- **Idioma del producto:** la UI y el README entregables van en **inglés** (regla de Space Apps), con español como segundo idioma para los agricultores. Esto es solo para lo que se entrega; los docs internos, los comentarios y los mensajes de commit van en español.
- **La idea es del equipo.** No propongas el enfoque de solución (regla de Space Apps sobre "SI"); implementá y evaluá lo que el equipo decide. Registrá el uso de IA en `docs/SI_USAGE.md`.

## Datos verificados (2026-11-14) — ver `docs/decision.md` y `docs/limitaciones.md`
- **NISAR SME2** (humedad, L3, 200 m, **provisional**, precisión objetivo 0,06 m³/m³): sobre todo Itapúa hay 105 archivos y 53 fechas (18-jun → 21-oct), ~117 MB cada uno, **10,7 GB** en total.
- **NISAR GCOV** (retrodispersión HH/HV, L2): 127 archivos, ~1,9 GB cada uno, **316 GB** en total. **Nunca descargues en masa.**
- Descargar requiere login Earthdata. NASA POWER y Open-Meteo no lo requieren. Open-Meteo **no** es dato NASA.
- Los umbrales de `config/umbrales.json` son **SUPUESTOS**.

## Roles y carpetas — editá SOLO las carpetas del rol del usuario
**Al empezar la sesión, preguntá el rol si no lo sabés.** Si una tarea requiere tocar la carpeta de otro rol, avisá y proponé el cambio; no lo hagas.

| Rol | Puede editar |
|---|---|
| **Datos** | `pipeline/`, `public/data/humedad/`, `data/` (local, ignorado) |
| **Backend** | `src/app/api/`, `src/lib/`, `supabase/`, `config/` |
| **Frontend** | `src/app/` (excepto `api/`), `src/components/`, `public/` (excepto `public/data/`) |
| **Compartido (solo por PR aprobado por los 3)** | `contracts/`, `src/types/contratos.ts`, `docs/`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `.gitignore` |

Los contratos de datos (`contracts/`) definen qué produce cada rol. Respetalos al escribir y al leer.

## Git
- Nunca hagas commit ni push a `main` (está protegida). Cada persona trabaja en **su rama**: `datos`, `backend` o `frontend`, y abre un PR hacia `main` cada 1–2 h.
- `git fetch origin && git rebase origin/main` al empezar y después de cada PR mergeado. En **tu propia rama** está permitido `git push --force-with-lease` después de un rebase; en ramas ajenas o en `main`, nunca.
- Antes de commitear, revisá `git status` y agregá solo los archivos del rol (no uses `git add -A` a ciegas).
- Dependencias nuevas: `package.json` y `pnpm-lock.yaml` van juntos en un PR propio y chico. Si el lockfile tiene conflicto, quedate con el de `main` y corré `pnpm install`.
- Antes de dar algo por terminado: `pnpm lint && pnpm build` (JS) o ejecutar el script (Python).

## Reglas duras
- Credenciales nunca en archivos: van en `.env.local` (ignorado), `~/.netrc` o variables de entorno.
- No descargues más de ~1 GB sin confirmación explícita del usuario.
- No inventes datos. Lo ficticio lleva `"es_ejemplo": true` y la fuente "EJEMPLO FICTICIO", y la UI muestra el aviso de datos provisionales.
- Sin logos de NASA. Sin imágenes ni voces de menores de 18 años. Citar todas las fuentes.
