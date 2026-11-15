import { Suspense } from "react";
import VistaClima from "@/components/VistaClima";

// /clima?cultivo=soja&area=natalio
// Igual que /suelo: los parámetros se leen en el servidor y se pasan como props; mientras tanto se muestra
// la vista con valores por defecto (sin pantalla en blanco).
export default function Page({ searchParams }: PageProps<"/clima">) {
  return (
    <Suspense fallback={<VistaClima />}>
      <ConParametros searchParams={searchParams} />
    </Suspense>
  );
}

async function ConParametros({ searchParams }: { searchParams: PageProps<"/clima">["searchParams"] }) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <VistaClima cultivo={uno(sp.cultivo)} area={uno(sp.area)} />;
}
