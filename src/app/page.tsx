import DemoAreas from "@/components/DemoAreas";

// Página provisional (rol Frontend: reemplazar). La UI entregable va en inglés (regla de Space Apps);
// el español para los agricultores se agrega como segundo idioma.
export default function Home() {
  return (
    <div className="flex-1">
      <div role="alert" className="sticky top-0 z-10 border-b-2 border-amber-500 bg-amber-100 px-4 py-2 text-sm text-black">
        ⚠️ <strong>Sample / provisional data.</strong> Values shown are FICTITIOUS until NISAR processing is complete.
        Do not use for real decisions. · <em>Datos de ejemplo / provisionales.</em>
      </div>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10">
        <h1 className="font-display text-4xl sm:text-5xl">AgroSAR Itapúa</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Soil moisture from NASA-ISRO NISAR radar to help farmers in Itapúa, Paraguay decide when to sow.
        </p>
        <DemoAreas />
        <footer className="mt-16 border-t border-line pt-4 text-xs text-muted">
          Data: NASA-ISRO NISAR (ASF DAAC), NASA POWER. Community project, not affiliated with or endorsed by NASA.
        </footer>
      </main>
    </div>
  );
}
