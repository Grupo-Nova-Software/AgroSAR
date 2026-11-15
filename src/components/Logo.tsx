// Logo de AgroSAR: una hoja que recibe las ondas del radar del satélite (SAR).
// `sobreVerde`: versión para usar encima del verde principal (hoja blanca, ondas doradas).

export function MarcaAgroSAR({ className = "h-8 w-8", sobreVerde = false }: { className?: string; sobreVerde?: boolean }) {
  const hoja = sobreVerde ? "#ffffff" : "var(--primario)";
  const vena = sobreVerde ? "var(--primario)" : "var(--fondo)";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M5 45C5 28 14 19 28 17c0 15-8 26-23 28Z" fill={hoja} />
      <path d="M5 45 21 27" stroke={vena} strokeWidth="2.5" strokeLinecap="round" />
      <g fill="none" stroke="var(--dorado)" strokeWidth="3.2" strokeLinecap="round">
        <path d="M33 5a9 9 0 0 0 9 9" />
        <path d="M24 5a18 18 0 0 0 18 18" opacity=".65" />
      </g>
      <circle cx="42" cy="5" r="3.4" fill="var(--dorado)" />
    </svg>
  );
}

export default function Logo({ grande = false }: { grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl bg-primario text-sobre-primario shadow-suave ${
        grande ? "px-5 py-2.5 md:px-7 md:py-3" : "px-3.5 py-1.5"
      }`}
    >
      <MarcaAgroSAR sobreVerde className={grande ? "h-9 w-9 md:h-11 md:w-11" : "h-7 w-7"} />
      <span className={`font-display leading-none tracking-tight ${grande ? "text-[2rem] md:text-[2.6rem]" : "text-2xl"}`}>
        <span className="font-medium">Agro</span>
        <span className="font-extrabold">SAR</span>
      </span>
    </span>
  );
}
