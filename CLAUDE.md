# Instrucciones para Claude Code (AgroSAR Itapúa)

Equipo de 3 personas, cada una con su propia sesión de Claude Code. **Antes de editar, preguntá o confirmá el rol del usuario** y respetá la tabla de abajo. Plan completo: `docs/plan-equipo.md`.

| Rol | Puede editar | NO toca |
|---|---|---|
| Datos | `pipeline/`, `data/processed/humedad/` | `app/`, `backend/`, `config/` |
| Backend | `backend/`, `config/`, `data/processed/recomendaciones/` | `app/`, `pipeline/` |
| Frontend | `app/` | `pipeline/`, `backend/`, `config/`, `data/` |

Reglas:
- `contracts/`, `docs/` y `README.md` son compartidos: proponé el cambio y que se haga por PR revisado por el equipo. No los modifiques por tu cuenta.
- Trabajá siempre en una rama con prefijo de rol (`datos/…`, `back/…`, `front/…`). Nunca hagas commit ni push a `main`, ni `push --force`.
- Antes de commitear: `git status` y agregá solo los archivos propios (nada de `git add -A` a ciegas).
- Nunca escribas credenciales en archivos. Earthdata va por `~/.netrc` o por `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD`.
- No descargues archivos grandes (GCOV ~2 GB c/u) sin confirmación explícita.
- No inventes datos. Todo dato de ejemplo debe decir "EJEMPLO FICTICIO". Los supuestos se marcan "SUPUESTO".
- Idioma del proyecto: español (el formulario y el pitch de Space Apps, en inglés).
