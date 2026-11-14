// Permite correr los tests del motor con Node puro (sin dependencias nuevas):
//   node --import ./src/lib/agro/__tests__/registro.mjs --test "src/lib/agro/__tests__/*.test.mjs"
// Resuelve imports relativos sin extensión a .ts y los carga como TypeScript (type stripping de Node ≥ 22.18).
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        if ((spec.startsWith("./") || spec.startsWith("../")) && !/\\.[cm]?[jt]s$|\\.json$/.test(spec)) {
          try { return await next(spec + ".ts", ctx); } catch {}
        }
        return next(spec, ctx);
      }
      export async function load(url, ctx, next) {
        if (url.endsWith(".ts")) return next(url, { ...ctx, format: "module-typescript" });
        return next(url, ctx);
      }
    `),
);
