import { Suspense } from "react";
import VistaSuelo from "@/components/suelo/VistaSuelo";

// /suelo?cultivo=soja&area=natalio — VistaSuelo lee los parámetros de la URL (useSearchParams necesita Suspense).
export default function Page() {
  return (
    <Suspense>
      <VistaSuelo />
    </Suspense>
  );
}
