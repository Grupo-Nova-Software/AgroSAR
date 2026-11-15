"""Dibuja a mano (en código) los íconos ilustrados de AgroSAR → public/dibujos/*.svg

Son dibujos propios, limpios y con un mismo estilo (contorno oscuro de trazo parejo, puntas redondeadas, relleno plano con
una sola sombra). Se basan en los bocetos del diseñador (public/diseño-dibujo/), que quedan como referencia.
Todos usan un lienzo de 64 × 64. Uso:  python3 scripts/dibujar_iconos.py
"""
import math, pathlib

SALIDA = pathlib.Path(__file__).resolve().parent.parent / "public" / "dibujos"

# Paleta
OUT = "#254a35"                                   # contorno de plantas y tierra
VERDE, VERDE_O, VERDE_C = "#43b049", "#2b8a3a", "#93df6c"
TIERRA, TIERRA_O, TIERRA_C = "#8a5a3c", "#5c3a25", "#b98456"
SOL, SOL_O, SOL_R = "#ffd23d", "#d98a00", "#ffb400"
NUBE_O, NUBE, NUBE_S = "#5f7d99", "#ffffff", "#dce8f4"
AGUA, AGUA_O, AGUA_C = "#2f88f0", "#1a5fb4", "#a9d3ff"

def svg(contenido, defs=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke-linejoin="round" stroke-linecap="round">{"<defs>" + defs + "</defs>" if defs else ""}{contenido}</svg>\n'

def rayos(cx, cy, r1, r2, n=8, ancho=4.2, color=SOL_R, giro=0):
    s = ""
    for i in range(n):
        a = math.radians(giro + i * 360 / n)
        s += f'<path d="M{cx + r1 * math.cos(a):.2f} {cy + r1 * math.sin(a):.2f}L{cx + r2 * math.cos(a):.2f} {cy + r2 * math.sin(a):.2f}" stroke="{color}" stroke-width="{ancho}"/>'
    return s

def sol(cx, cy, r, escala_rayos=1.0):
    return (rayos(cx, cy, r + 5 * escala_rayos, r + 11 * escala_rayos, ancho=4 * escala_rayos)
            + f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{SOL}" stroke="{SOL_O}" stroke-width="2.4"/>'
            + f'<path d="M{cx - r * .55:.1f} {cy - r * .1:.1f}A{r * .6:.1f} {r * .6:.1f} 0 0 1 {cx - r * .1:.1f} {cy - r * .6:.1f}" stroke="#fff" stroke-opacity=".75" stroke-width="2.4"/>')

NUBE_D = "M17 47C9 47 5 41 6 36C7 30 12 27 17 28C18 20 25 15 33 16C40 16 46 21 47 27C54 27 59 32 58 38C57 43 53 47 46 47Z"

def nube(relleno=NUBE, sombra=NUBE_S, contorno=NUBE_O, tr="", id_="n"):
    return (f'<g transform="{tr}"><clipPath id="{id_}"><path d="{NUBE_D}"/></clipPath>'
            f'<path d="{NUBE_D}" fill="{relleno}"/><rect x="0" y="39" width="64" height="12" fill="{sombra}" clip-path="url(#{id_})"/>'
            f'<path d="{NUBE_D}" stroke="{contorno}" stroke-width="2.6"/></g>')

# Brote: origen en la base del tallo; mide ~27 de alto
BROTE = (f'<path d="M0 0V-13" stroke="{OUT}" stroke-width="5.4"/><path d="M0 0V-13" stroke="{VERDE}" stroke-width="2.4"/>'
         f'<path d="M0 -11C-2 -20 -10 -25 -19 -23C-19 -14 -11 -8 0 -11Z" fill="{VERDE}" stroke="{OUT}" stroke-width="2.2"/>'
         f'<path d="M0 -13C2 -22 10 -27 19 -25C19 -16 11 -10 0 -13Z" fill="{VERDE_C}" stroke="{OUT}" stroke-width="2.2"/>'
         f'<path d="M-1 -12Q-9 -15 -16 -21M1 -14Q9 -17 16 -23" stroke="{VERDE_O}" stroke-width="1.4"/>')

def bloque_tierra(y_arriba, relleno=TIERRA, puntos=True):
    d = f"M5 {y_arriba}C14 {y_arriba - 5} 22 {y_arriba + 5} 32 {y_arriba}C42 {y_arriba - 5} 50 {y_arriba + 5} 59 {y_arriba}V54a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5Z"
    s = f'<path d="{d}" fill="{relleno}" stroke="{OUT}" stroke-width="2.4"/>'
    if puntos:
        s += "".join(f'<circle cx="{x}" cy="{y}" r="1.5" fill="{TIERRA_O}" stroke="none"/>' for x, y in [(15, 50), (28, 54), (42, 51), (52, 55), (22, 46)])
    return s

ICONOS = {}

ICONOS["brote"] = svg(
    f'<g transform="translate(32 53) scale(1.5)">{BROTE}</g>'
    f'<path d="M11 58C18 48 46 48 53 58Z" fill="{TIERRA}" stroke="{OUT}" stroke-width="2.4"/>'
    f'<path d="M20 55C27 52 37 52 44 55" stroke="{TIERRA_C}" stroke-width="1.6"/>')

ICONOS["suelo-bueno"] = svg(
    f'<g transform="translate(20 42) scale(.78)">{BROTE}</g><g transform="translate(44 40) scale(.9)">{BROTE}</g>' + bloque_tierra(38))

ICONOS["suelo-seco"] = svg(
    f'<g>{sol(50, 17, 5.5, .8)}</g>'
    + bloque_tierra(36, relleno="#d9a066", puntos=False)
    + f'<path d="M22 35L25 43L20 48L24 58M40 34L37 42L43 48L39 59M25 43L37 42M43 48L55 46M20 48L11 47" stroke="{TIERRA_O}" stroke-width="2.2"/>')

ICONOS["suelo-mojado"] = svg(
    bloque_tierra(38, puntos=False)
    + f'<path d="M5 41Q11 36 17 41T29 41T41 41T53 41T59 41V52H5Z" fill="{AGUA}" stroke="{AGUA_O}" stroke-width="2.2"/>'
    + f'<path d="M11 47Q15 44 19 47M30 48Q34 45 38 48M47 46Q50 44 54 46" stroke="{AGUA_C}" stroke-width="2"/>'
    + f'<path d="M32 4C32 4 22 15 22 21A10 10 0 0 0 42 21C42 15 32 4 32 4Z" fill="{AGUA}" stroke="{AGUA_O}" stroke-width="2.4"/>'
    + f'<path d="M26.5 21A5.6 5.6 0 0 0 31 26.6" stroke="#fff" stroke-opacity=".85" stroke-width="2"/>')

ICONOS["campo"] = svg(
    f'<g>{sol(49, 15, 6, .8)}</g>'
    + f'<path d="M3 55L17 28H47L61 55Z" fill="{VERDE_C}" stroke="{OUT}" stroke-width="2.4"/>'
    + f'<path d="M25 28L15 55M32 28V55M39 28L49 55" stroke="{VERDE_O}" stroke-width="2.4"/>'
    + f'<path d="M27 38L29.4 40.6M30 44L28 46M36 38L34.6 41M34 46L36 48" stroke="{VERDE_O}" stroke-width="0"/>'
    + f'<path d="M20 45H44M13 52H51" stroke="{VERDE}" stroke-width="1.6" stroke-opacity=".9"/>')

ICONOS["clima-sol"] = svg(sol(32, 32, 12.5, 1.15))
ICONOS["clima-nube"] = svg(nube(tr="translate(0 2)"), "")
ICONOS["clima-parcial"] = svg(sol(43, 22, 9.5, .95) + nube(tr="translate(-1.5 14) scale(.82)", id_="p"))

def gota(x, y, color=AGUA):
    return f'<path d="M{x} {y}L{x - 3.2} {y + 9}" stroke="{AGUA_O}" stroke-width="5.4"/><path d="M{x} {y}L{x - 3.2} {y + 9}" stroke="{color}" stroke-width="2.6"/>'

ICONOS["clima-lluvia"] = svg(
    nube("#9db0c5", "#7f95ad", "#475f78", tr="translate(5 -3) scale(.9)", id_="l")
    + gota(19, 45) + gota(29, 48) + gota(39, 45) + gota(49, 48))

ICONOS["clima-tormenta"] = svg(
    nube("#6a7a8e", "#4f5e73", "#2b3646", tr="translate(5 -5) scale(.9)", id_="t")
    + f'<path d="M35 36L23 53H31L27 63L43 44H35L40 36Z" fill="{SOL}" stroke="{SOL_O}" stroke-width="2.2"/>'
    + gota(15, 45) + gota(51, 45))

# Maíz: choclo con sus hojas
ICONOS["cultivo-maiz"] = svg(
    '<clipPath id="c"><ellipse cx="32" cy="32" rx="10.5" ry="21"/></clipPath>'
    f'<ellipse cx="32" cy="32" rx="10.5" ry="21" fill="{SOL}"/>'
    '<g clip-path="url(#c)" stroke="#e3a800" stroke-width="1.5">'
    '<path d="M26.5 8V58M32 8V58M37.5 8V58"/><path d="M20 17H44M20 23.5H44M20 30H44M20 36.5H44M20 43H44M20 49.5H44"/></g>'
    f'<ellipse cx="32" cy="32" rx="10.5" ry="21" stroke="#b07d00" stroke-width="2.4"/>'
    f'<path d="M30 11L27 5M32 11V4M34 11L37 5" stroke="{TIERRA}" stroke-width="2"/>'
    f'<path d="M32 60C14 56 9 38 17 21C22 35 27 47 32 60Z" fill="{VERDE}" stroke="{OUT}" stroke-width="2.4"/>'
    f'<path d="M32 60C50 56 55 38 47 21C42 35 37 47 32 60Z" fill="{VERDE_C}" stroke="{OUT}" stroke-width="2.4"/>'
    f'<path d="M32 58C25 52 20 42 18 32M32 58C39 52 44 42 46 32" stroke="{VERDE_O}" stroke-width="1.4"/>')

# Soja: vaina con sus granos y una hoja
ICONOS["cultivo-soja"] = svg(
    f'<g transform="rotate(-28 32 36)"><rect x="5" y="26" width="54" height="20" rx="10" fill="#79c64f" stroke="{OUT}" stroke-width="2.4"/>'
    f'<circle cx="19" cy="36" r="6.4" fill="#aee684" stroke="#3f8a35" stroke-width="1.6"/><circle cx="32" cy="36" r="6.4" fill="#aee684" stroke="#3f8a35" stroke-width="1.6"/>'
    f'<circle cx="45" cy="36" r="6.4" fill="#aee684" stroke="#3f8a35" stroke-width="1.6"/>'
    f'<path d="M59 36Q63 36 63 31" stroke="{OUT}" stroke-width="3.2"/></g>'
    f'<path d="M7 24C1 14 8 6 18 7C19 16 15 23 7 24Z" fill="{VERDE}" stroke="{OUT}" stroke-width="2.2"/><path d="M8 22Q11 15 16 10" stroke="{VERDE_O}" stroke-width="1.4"/>')

# Mandioca: raíces y brotes
def hoja_palmada(x, y, giro):
    s = f'<g transform="translate({x} {y}) rotate({giro})">'
    for a in (-62, -31, 0, 31, 62):
        s += f'<ellipse cx="0" cy="-7" rx="2.7" ry="7" transform="rotate({a})" fill="{VERDE_C}" stroke="{OUT}" stroke-width="1.6"/>'
    return s + "</g>"

ICONOS["cultivo-mandioca"] = svg(
    f'<path d="M30 33C29 43 30 52 32 61C35 52 36 43 34 33Z" fill="{TIERRA_C}" stroke="{OUT}" stroke-width="2.4"/>'
    f'<path d="M34 32C43 36 53 47 54 59C45 61 35 51 30 38Z" fill="{TIERRA}" stroke="{OUT}" stroke-width="2.4"/>'
    f'<path d="M30 32C21 36 11 47 10 59C19 61 29 51 34 38Z" fill="{TIERRA}" stroke="{OUT}" stroke-width="2.4"/>'
    f'<path d="M20 47L24 50M44 47L40 50M32 46V51M15 54L19 55M49 54L45 55" stroke="{TIERRA_O}" stroke-width="1.8"/>'
    f'<path d="M32 34L24 19M32 34L40 18" stroke="{OUT}" stroke-width="5.6"/><path d="M32 34L24 19M32 34L40 18" stroke="#c4a35a" stroke-width="2.6"/>'
    + hoja_palmada(23, 17, -20) + hoja_palmada(41, 15, 20))

def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    for f in SALIDA.glob("*.svg"):
        f.unlink()
    for nombre, contenido in ICONOS.items():
        (SALIDA / f"{nombre}.svg").write_text(contenido)
        print(f"{nombre:18s} {len(contenido)} bytes")

if __name__ == "__main__":
    main()
