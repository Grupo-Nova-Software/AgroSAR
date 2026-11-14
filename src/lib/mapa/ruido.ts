// Ruido determinista para generar DATOS FICTICIOS reproducibles (misma celda + misma fecha → mismo valor).
// Se reemplaza por los productos NISAR reales cuando el rol Datos los procese.

export function hash(x: number, y: number, semilla: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(semilla | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296; // 0..1
}

const suave = (t: number) => t * t * (3 - 2 * t);

// Ruido de valor interpolado en una grilla; x e y en "unidades de ruido".
export function ruidoValor(x: number, y: number, semilla: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = suave(x - x0), ty = suave(y - y0);
  const a = hash(x0, y0, semilla), b = hash(x0 + 1, y0, semilla);
  const c = hash(x0, y0 + 1, semilla), d = hash(x0 + 1, y0 + 1, semilla);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// Suma de octavas: textura con parches grandes y detalle fino. Devuelve 0..1 aprox.
export function fbm(x: number, y: number, semilla: number, octavas = 4): number {
  let v = 0, amp = 0.5, f = 1, total = 0;
  for (let o = 0; o < octavas; o++) {
    v += amp * ruidoValor(x * f, y * f, semilla + o * 101);
    total += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / total;
}
