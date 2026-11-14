// Permite correr los tests del motor con Node puro (sin dependencias nuevas):
//   node --import ./src/lib/agro/__tests__/registro.mjs --test "src/lib/**/__tests__/*.test.mjs"
// Resuelve "@/..." a src/, imports relativos sin extensión a .ts, JSON sin atributo y carga TypeScript
// con el type stripping de Node ≥ 22.18.
import { register } from "node:module";

const srcUrl = new URL("../../../", import.meta.url).href; // .../src/

register(
  "data:text/javascript," +
    encodeURIComponent(`
      let src = "";
      export function initialize(data) { src = data.src; }
      export async function resolve(spec, ctx, next) {
        if (spec.startsWith("@/")) spec = src + spec.slice(2);
        const relativo = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:");
        if (relativo && !/\\.[cm]?[jt]s$|\\.json$/.test(spec)) {
          try { return await next(spec + ".ts", ctx); } catch {}
        }
        return next(spec, ctx);
      }
      export async function load(url, ctx, next) {
        if (url.endsWith(".ts")) return next(url, { ...ctx, format: "module-typescript" });
        if (url.endsWith(".json")) return next(url, { ...ctx, format: "json", importAttributes: { type: "json" } });
        return next(url, ctx);
      }
    `),
  { data: { src: srcUrl } },
);
