import { Suspense } from "react";
import VistaSuelo from "@/components/suelo/VistaSuelo";

// /suelo?cultivo=soja&area=natalio
// Los parámetros se leen en el servidor y se pasan como props, así el HTML ya llega con contenido
// (sin pantalla en blanco mientras carga JavaScript). Mientras tanto se muestra la vista con valores por defecto.
export default function Page({ searchParams }: PageProps<"/suelo">) {
  return (
    <Suspense fallback={<VistaSuelo />}>
      <ConParametros searchParams={searchParams} />
    </Suspense>
  );
}

async function ConParametros({ searchParams }: { searchParams: PageProps<"/suelo">["searchParams"] }) {
  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <VistaSuelo cultivo={uno(sp.cultivo)} area={uno(sp.area)} />;
}
