# Plan del equipo — AgroSAR Itapúa (desafío A, NISAR)

> Fecha límite: **dom 15-nov 23:59, hora local**. Reglas para Claude Code: `CLAUDE.md`.

## 1. Mapa del repo: qué es cada cosa
```
AgroSAR/
├── CLAUDE.md, AGENTS.md     Instrucciones para Claude Code (proyecto + reglas del evento)   [compartido]
├── README.md                Presentación del proyecto, EN INGLÉS (es entregable)          [compartido]
├── contracts/               Formato acordado de los datos entre roles (JSON Schema)       [compartido]
├── docs/                    Decisión, plan, limitaciones, calendario, pitch, uso de IA    [compartido]
│   ├── challenges/          Los 14 desafíos con sus links oficiales (del template)
│   ├── resources/           Reglas, entrega, jurado, free tiers (del template)
│   ├── deploy/              Guía de deploy Vercel + Supabase
│   └── SI_USAGE.md          Registro de uso de IA (lo pide el formulario)
├── pipeline/                Python: listar, descargar y procesar NISAR y POWER           [Datos]
│   └── notebooks/           Exploración en Jupyter
├── data/raw/                Descargas crudas (.h5). IGNORADO por git                      [Datos, local]
├── public/data/humedad/     Salida liviana del pipeline que consume la app (JSON)         [Datos]
├── config/umbrales.json     Umbrales de la recomendación (SUPUESTOS)                      [Backend]
├── src/lib/                 Lógica: motor de recomendación, clientes de Supabase          [Backend]
├── src/app/api/             Endpoints: /api/recomendacion, /api/health…                   [Backend]
├── supabase/migrations/     Tablas SQL, si se usa Supabase                                [Backend]
├── src/types/contratos.ts   Tipos TypeScript de los contratos                             [compartido]
├── src/app/                 Páginas, layout, manifest PWA                                 [Frontend]
├── src/components/          Componentes React (mapa, gráfico, tarjeta)                    [Frontend]
├── public/ (resto)          Íconos, service worker                                        [Frontend]
└── .claude/skills/          Skills del template (NASA, geo, mapas, deploy, pitch…)
```

## 2. Quién hace qué
### Datos (backend 2) — dueño de `pipeline/`, `public/data/humedad/`
1. Crear la cuenta Earthdata y `~/.netrc`.
2. Bajar **2–3 archivos SME2** (~350 MB) → explorar el `.h5` (variables, banderas de calidad, grilla) → documentarlo en `pipeline/notebooks/`.
3. Definir las áreas con el equipo (¿zonas o distritos?) y la máscara agrícola o de cultivo.
4. Implementar `03_procesar_nisar.py`: recorte → máscara → promedio por área y fecha → JSON según `contracts/humedad.schema.json`.
5. Recién ahí bajar el resto de SME2 (10,7 GB en total) y, si hay tiempo, unas pocas escenas GCOV.

### Backend — dueño de `src/lib/`, `src/app/api/`, `config/`, `supabase/`
1. Calendario agrícola por cultivo **con fuente** (MAG/CAPECO) → `config/`.
2. Reglas por cultivo + etapa + humedad + pronóstico (Open-Meteo/POWER) en `src/lib/recomendacion.ts`, con tests.
3. Mantener `/api/recomendacion` según `contracts/recomendacion.schema.json`.
4. Decidir si se usa Supabase (por ejemplo, para guardar las series). Si no hace falta, archivos estáticos.
5. Deploy en Vercel desde el primer momento (`docs/deploy/vercel-supabase.md`).

### Frontend — dueño de `src/app/` (menos `api/`), `src/components/`, `public/` (menos `data/`)
1. Pensar primero en el celular: mapa de áreas (Leaflet), selector de cultivo, gráfico de la serie, tarjeta de recomendación.
2. Aviso visible de datos provisionales (ya está en la página provisional).
3. PWA: íconos de 192 y 512 px, service worker, prueba de "Instalar app".
4. UI en inglés + español (toggle).
5. Mañana: capturas y video de la demo.

## 3. Cómo no pisarse
- **Contrato primero:** en la primera reunión se confirma `contracts/` (está como PROPUESTA v0). Mientras tanto, cada uno usa los datos de ejemplo de `public/data/humedad/`.
- **Una rama por persona:** `datos`, `backend`, `frontend`. Nadie escribe en la rama de otro.
- **PR a `main` cada 1–2 h** (lo que esté andando), con *squash merge*. Si una rama vive mucho sin mergearse, los conflictos crecen.
- Después de cada merge, todos actualizan su rama:
  ```bash
  git fetch origin && git rebase origin/main
  git push --force-with-lease      # solo en TU rama
  ```
- Cada uno toca solo sus carpetas, así que el rebase casi nunca da conflicto. Lo compartido, solo por PR aprobado por los 3.
- **Claude Code:** al abrir la sesión, decile tu rol. `CLAUDE.md` le dice qué puede tocar. Opcional: reglas `deny` en tu `.claude/settings.local.json` (no se sube); verificalas con `/permissions`.

## 4. Configuración inicial de GitHub (hacelo vos, como dueño del repo)
1. Settings → **Rules → Rulesets → New branch ruleset** (o Settings → Branches → *Add classic branch protection rule*):
   - Target: `main` · Enforcement: **Active**
   - ✅ *Restrict deletions* · ✅ *Block force pushes*
   - ✅ *Require a pull request before merging* → Required approvals: **1** (otra persona revisa; en un apuro, el admin puede saltearlo)
   - Opcional: *Require linear history* (combina bien con squash merge)
   - Settings → General → Pull Requests: dejar solo **Allow squash merging** y activar *Automatically delete head branches* **desactivado** (las ramas personales se reutilizan).
2. Settings → Collaborators/Teams: dar rol **Write** a los otros 2.
3. Cada integrante:
   ```bash
   git clone git@github.com:Grupo-Nova-Software/AgroSAR.git && cd AgroSAR
   git config user.name "Nombre" && git config user.email "tu@mail"
   npx pnpm@11.20.0 install && cp .env.example .env.local
   git switch frontend          # o backend / datos (ya existen en el remoto)
   ```

## 5. Cronograma
| Cuándo | Qué |
|---|---|
| Sáb, primera hora | Confirmar el contrato, las áreas (zonas o distritos) y los cultivos; protección de rama; primer deploy |
| Sáb, tarde/noche | Cada rol en lo suyo, con datos de ejemplo; Datos explora SME2 |
| Dom, mediodía | **Congelar funciones**: datos reales en `public/data/humedad/`, integrar |
| Dom, tarde | Pruebas en celular, README final en inglés, video de 30 s, formulario, `SI_USAGE.md` |
| Dom, antes de las 23:59 | **Submit for Judging** |
