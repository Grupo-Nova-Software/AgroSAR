import { Suspense } from "react";
import VistaSuelo from "@/components/suelo/VistaSuelo";

// /suelo?cultivo=soja&area=natalio · /suelo?chacra=<id> · /suelo?cultivo=soja&nueva=1 (empieza a marcar una chacra)
// Los parámetros se leen en el servidor y se pasan como props, así el HTML ya llega con contenido.
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
  return <VistaSuelo cultivo={uno(sp.cultivo)} area={uno(sp.area)} chacra={uno(sp.chacra)} nueva={uno(sp.nueva) === "1"} />;
}
