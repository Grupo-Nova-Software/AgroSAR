import { notFound } from "next/navigation";
import { CULTIVOS } from "@/components/cultivos";
import PaginaCultivo from "@/components/PaginaCultivo";

// Página de cada cultivo (provisional, falta el diseño). Rutas: /cultivo/soja, /cultivo/mandioca, /cultivo/maiz
export function generateStaticParams() {
  return CULTIVOS.map((c) => ({ id: c.id }));
}

export default async function Page({ params }: PageProps<"/cultivo/[id]">) {
  const { id } = await params;
  if (!CULTIVOS.some((c) => c.id === id)) notFound();
  return <PaginaCultivo id={id} />;
}
