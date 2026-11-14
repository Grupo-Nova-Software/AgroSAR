// Utilidades de fechas en UTC con formato ISO AAAA-MM-DD (sin zona horaria para evitar corrimientos).

const DIA_MS = 86_400_000;

export function parseISO(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`fecha inválida: '${s}' (se espera AAAA-MM-DD)`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`fecha inválida: '${s}'`);
  return d;
}

export function esFechaISO(s: string | null | undefined): s is string {
  if (!s) return false;
  try {
    parseISO(s);
    return true;
  } catch {
    return false;
  }
}

export function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return aISO(new Date(parseISO(fecha).getTime() + Math.round(dias) * DIA_MS));
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((parseISO(hasta).getTime() - parseISO(desde).getTime()) / DIA_MS);
}

// "MM-DD" de un año dado → AAAA-MM-DD. Febrero 29 en años no bisiestos cae en 28.
export function mmddEnAnio(mmdd: string, anio: number): string {
  const [m, d] = mmdd.split("-").map(Number);
  const ultimo = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return aISO(new Date(Date.UTC(anio, m - 1, Math.min(d, ultimo))));
}

// Ocurrencias de un período anual "MM-DD"→"MM-DD" (puede cruzar el fin de año) cercanas a una fecha.
export function ocurrencias(inicio: string, fin: string, cerca: string): { inicio: string; fin: string }[] {
  const anio = parseISO(cerca).getUTCFullYear();
  const cruza = fin < inicio;
  const out: { inicio: string; fin: string }[] = [];
  for (const a of [anio - 1, anio, anio + 1]) {
    out.push({ inicio: mmddEnAnio(inicio, a), fin: mmddEnAnio(fin, cruza ? a + 1 : a) });
  }
  return out;
}

// ¿Los intervalos [a1,a2] y [b1,b2] se superponen? Devuelve la intersección o null.
export function interseccion(a1: string, a2: string, b1: string, b2: string): { desde: string; hasta: string } | null {
  const desde = a1 > b1 ? a1 : b1;
  const hasta = a2 < b2 ? a2 : b2;
  return desde <= hasta ? { desde, hasta } : null;
}
