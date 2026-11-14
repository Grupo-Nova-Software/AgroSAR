# Limitaciones conocidas

## Datos
- **NISAR SME2 es provisional** (C, metadatos CMR): parcialmente validado; meta de precisión 0,06 m³/m³; sin estimación en zonas urbanas, en agua o con lluvia excesiva; las zonas con vegetación densa (>5 kg/m² de agua en la vegetación) se marcan con bandera.
- **Mide solo la superficie** (primeros cm): no es la humedad de la zona de raíces.
- **Latencia real mayor que la nominal:** el catálogo promete 72 h para SME2, pero el 14-nov el último dato era del 21-oct (GCOV: 29-oct) (C).
- **Huecos de hasta 16 días** entre pasadas por zona (C). La zona Obligado/Hohenau/Miranda tiene menos fechas (19 vs 24).
- Hay productos de **dos anchos de banda** (DHDH y SHSH; los 5+5 MHz se agregan a 400 m). Hay que decidir si se mezclan (pendiente).
- **GCOV pesa ~2 GB por archivo** (C): no es viable bajar la serie completa (~84 GB).
- **Fuentes que no coinciden:** el 7-nov en Natalio, POWER dio 18,8 mm de lluvia y Open-Meteo 6,4 mm (C). No son intercambiables.
- POWER `GWETTOP` es una **fracción relativa 0–1**, no m³/m³; no se puede comparar directamente con SME2.
- Open-Meteo **no es dato NASA** (es un modelo meteorológico). Sirve solo como contexto o pronóstico.
- Todavía no se abrió ningún `.h5`: las rutas internas de las variables **no están verificadas**.

## Zonas
- Los centros de las localidades se verificaron con OpenStreetMap (C). Las **bbox son rectángulos aproximados** (S) y no los límites distritales ni las parcelas reales.
- El promedio por zona mezcla cultivos, monte, pasturas y poblados. Mejora pendiente: enmascarar con una capa de uso del suelo.

## Recomendación
- Los umbrales de `config/umbrales.json` son **SUPUESTOS**, sin validación agronómica.
- No considera cultivo, tipo de suelo, pronóstico ni precios. Es una **orientación**, no una prescripción.
- Debe acompañarse siempre de la consulta a técnicos locales (MAG, cooperativas).

## Técnicas
- Web estática: los JSON se generan antes de desplegar y no se actualizan solos.
- Requiere internet para los mapas base (OpenStreetMap) y las librerías (CDN).

## Actualización del 14-nov (noche)
- **Serie real:** 10 pasadas del track 82 (19-jun → 17-oct-2026). La última tiene **28 días** al 14-nov: la app lo dice en el cartel ("dato viejo") y no reemplaza mirar el suelo.
- **Análisis de la chacra:** usa las celdas NISAR de 200 m solo dentro de las 5 áreas con grilla publicada. Fuera de ellas no hay dato real y la app muestra la zona más cercana.
- **Mapa "Agua en el suelo":** imagen a ~300 m de todo Itapúa; el borde oeste queda sin dato porque ahí termina la pasada del track 82.
- **Cobertura del suelo y pendiente** de la grilla del backend siguen siendo ficticias; la app ya no las muestra al agricultor.
- **Textos de consejos del motor** (alertas) están solo en español; en inglés se muestran solo los textos propios de la interfaz.
- **Límites de zonas y distritos:** rectángulos aproximados (Hohenau cae dentro del rectángulo de "Bella Vista").
