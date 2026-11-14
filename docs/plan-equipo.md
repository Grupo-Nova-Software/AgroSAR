# Plan del equipo — Desafío A (NISAR) · cultivos de Itapúa

> Decidido: desafío **A, Dancing with the SARs**. Fecha límite: **15-nov 23:59, hora local**. **C** = confirmado · **S** = supuesto.

## 1. Idea integrada
**"¿Cómo está la humedad del suelo donde se siembra soja (y los demás cultivos principales) en todo Itapúa, y qué conviene hacer?"**

1. **Dónde están los cultivos:** una máscara de cultivo/agricultura sobre Itapúa. Candidatos (S, verificar disponibilidad y licencia): MapBiomas Paraguay, ESA WorldCover (clase "cropland", sin tipo de cultivo) y estadísticas del MAG/INE para saber cuáles son los cultivos principales de cada distrito.
2. **Cómo está el suelo:** NISAR SME2 (200 m) promediado **solo sobre píxeles agrícolas**, **por distrito** de Itapúa y por fecha.
3. **Qué hace el cultivo:** GCOV HV (retrodispersión) en pocas fechas o en pocos distritos. El HV sube cuando crece la cobertura vegetal y permite ver si la soja ya emergió (hipótesis física, S).
4. **Qué conviene hacer:** reglas por **cultivo + etapa del calendario + humedad + pronóstico de lluvia** → sembrar / esperar / precaución, con una explicación del porqué.

**App móvil = PWA** (web responsive instalable desde el navegador del celular). Con ~30 h restantes, una app nativa no da (S). Se despliega en Vercel igual que ahora.

## 2. Roles y carpetas (cada uno escribe SOLO en las suyas)
| Rol | Dueño de | Entrega |
|---|---|---|
| **Datos** (backend 2) | `pipeline/`, `data/processed/humedad/` | JSON de humedad por distrito y fecha, según el contrato |
| **Backend** | `backend/`, `config/`, `data/processed/recomendaciones/` | Calendario por cultivo, umbrales, POWER/Open-Meteo, motor de reglas → JSON de recomendaciones |
| **Frontend** | `app/` | PWA: mapa de distritos, selector de cultivo, gráfico, tarjeta de recomendación, aviso de datos provisionales |
| **Compartido** | `contracts/`, `docs/`, `README.md` | Solo se cambian por PR **aprobado por los 3** |

**Contrato primero:** en la primera hora se acuerdan los esquemas en `contracts/` (humedad, recomendación, distritos). A partir de ahí cada uno trabaja con **datos de ejemplo que respetan el contrato**, sin esperar a los demás.

## 3. Reglas de Git
- `main` protegida: nadie hace push directo; todo entra por **Pull Request** con squash merge.
- Ramas con prefijo de rol: `datos/descarga-sme2`, `back/reglas-soja`, `front/mapa-distritos`. Ramas cortas (de horas, no días).
- Antes de empezar y antes de abrir el PR: `git pull --rebase origin main`.
- Commits pequeños; nunca `git push --force` sobre ramas ajenas; nunca `git add -A` sin mirar antes `git status`.
- **Archivos generados**: solo los escribe el script de su dueño. Si te hace falta otro dato, se pide; no se edita a mano.
- Datos pesados (`.h5`) **nunca** van a Git (`data/raw/` está en `.gitignore`).
- Cada uno configura su propia identidad: `git config user.name` / `user.email`.

## 4. Claude Code sin pisarse
- `CLAUDE.md` (en la raíz) le dice a Claude qué carpetas son de cada rol. **Al empezar la sesión, decile tu rol**: "Soy Datos, solo podés tocar pipeline/ y data/processed/humedad/".
- Opcional (más seguro): en tu `.claude/settings.local.json` personal (no se commitea) agregá reglas `deny` de Edit/Write sobre las carpetas ajenas. Verificalo con `/permissions`.
- Cada uno en su propia rama: Claude nunca trabaja directo sobre `main`.

## 5. Datos NISAR para todo Itapúa (listado real del 2026-11-14, jun→nov)
| Producto | Archivos | Fechas | Total | Plan |
|---|---|---|---|---|
| SME2 | 105 (mediana 117 MB) | 53, del 18-jun al 21-oct | **10,7 GB** | Bajar todo (o empezar por las 5 fechas más recientes, ~0,6 GB) |
| GCOV | 127 (mediana 1,9 GB) | 63, hasta el 5-nov | **316 GB** | **NO bajar todo**: 2–4 escenas de un mismo track, o lectura parcial remota |
Se cubre con 11 combinaciones track/frame (asc. y desc.). Solo 4 archivos SME2 son de 5+5 MHz (SHSH, 400 m): decidir si se excluyen.

## 6. Orden sugerido (hoy → mañana)
1. **(Todos, 1 h)** Crear el repo, push inicial, acordar `contracts/` y lista de distritos.
2. **Datos:** credenciales Earthdata → bajar 2–3 SME2 → explorar la estructura del `.h5` → recortar Itapúa → promedio por distrito → JSON → recién ahí bajar el resto.
3. **Backend:** calendario por cultivo con fuente (MAG/CAPECO), umbrales, contexto de POWER y pronóstico de Open-Meteo, motor de reglas con tests.
4. **Frontend:** PWA (manifest + service worker), mapa por distritos, selector de cultivo, vistas para móvil.
5. **Mañana mediodía:** congelar funciones e integrar. **Tarde:** video de 30 s con subtítulos en inglés y formulario en inglés.
