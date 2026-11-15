"""Recorta los bocetos del diseñador (public/diseño-dibujo/*.jpeg), les quita el fondo y los convierte a SVG
(public/dibujos/*.svg). Es vectorizado automático: cada dibujo se separa por colores y cada color se traza con potrace.

Pasos por boceto:
  1. El fondo (color liso de la hoja) se detecta desde los bordes; todo lo que no es fondo es dibujo.
  2. Los dibujos sueltos se separan (se agrandan un poco para que sol y rayos, nube y gotas queden juntos).
  3. Cada dibujo se reduce a pocos colores (k-means) y cada color se vectoriza a una capa SVG.
Uso:  .venv/bin/python scripts/vectorizar_dibujos.py <carpeta_temporal>   (o  --solo-nav  para rehacer solo los íconos de la barra)   (necesita ImageMagick y potrace)
Los nombres de cada dibujo están en DIBUJOS (por boceto, de arriba a abajo y de izquierda a derecha).
"""
import pathlib, re, subprocess, sys
import numpy as np

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIG = RAIZ / "public" / "diseño-dibujo"
SALIDA = RAIZ / "public" / "dibujos"

# Por boceto: archivo, {nombre: (x, y aproximados del centro del dibujo en la hoja, colores)}, unión, umbral de fondo,
# y (y_desde, unión) para una zona de abajo donde los dibujos están más juntos y hay que separarlos.
DIBUJOS = [
    ("WhatsApp Image 2026-11-15 at 09.58.42.jpeg",
     {"clima-nube": (130, 100, 4), "clima-lluvia": (490, 130, 5), "clima-tormenta": (800, 160, 5), "clima-parcial": (1150, 120, 6),
      "clima-sol": (150, 515, 3), "suelo-ondas": (110, 855, 3), "suelo-bueno": (100, 1050, 5), "suelo-seco": (265, 1060, 3), "suelo-mojado": (415, 1050, 6)},
     14, 38, (700, 4)),
    ("WhatsApp Image 2026-11-15 at 09.58.43.jpeg",
     {"cultivo-maiz": (300, 500, 7), "cultivo-mandioca": (1070, 1000, 7), "cultivo-espiga": (600, 1100, 6), "cultivo-soja": (170, 1140, 6)},
     16, 40, None),
    ("WhatsApp Image 2026-11-15 at 11.51.19.jpeg",
     {"brote-boceto": (250, 270, 4), "hoja": (230, 560, 5), "brote": (660, 320, 4), "arbusto": (210, 1150, 6), "arbolito": (520, 1140, 5),
      "pasto-claro": (790, 1130, 3), "pasto": (1060, 1110, 5)},
     14, 26, None),
]
LADO = 480  # lado mayor, en píxeles, con que se traza cada dibujo (más grande = más pesado, sin ganar nada a tamaño de ícono)



def leer(ruta):
    b = subprocess.run(["magick", str(ruta), "-depth", "8", "ppm:-"], capture_output=True, check=True).stdout
    m = re.match(rb"P6\s+(\d+)\s+(\d+)\s+255\s", b)
    w, h = int(m[1]), int(m[2])
    return np.frombuffer(b[m.end():], np.uint8).reshape(h, w, 3).astype(np.int16)


def escribir_pgm(ruta, a):
    ruta.write_bytes(b"P5\n%d %d\n255\n" % (a.shape[1], a.shape[0]) + (a.astype(np.uint8) * 255).tobytes())


def fondo_conectado(img, bg, umbral):
    """Píxeles parecidos al fondo y conectados con el borde de la hoja."""
    parecido = np.abs(img - bg).sum(axis=2) < umbral * 1.7
    alcanzado = np.zeros_like(parecido)
    alcanzado[0, :] = parecido[0, :]; alcanzado[-1, :] = parecido[-1, :]
    alcanzado[:, 0] |= parecido[:, 0]; alcanzado[:, -1] |= parecido[:, -1]
    while True:
        n = alcanzado.copy()
        n[1:] |= alcanzado[:-1]; n[:-1] |= alcanzado[1:]; n[:, 1:] |= alcanzado[:, :-1]; n[:, :-1] |= alcanzado[:, 1:]
        n &= parecido
        if (n == alcanzado).all():
            return alcanzado
        alcanzado = n


def componentes(mascara, union, tmp):
    """Cajas (x, y, w, h) de los dibujos sueltos."""
    p = tmp / "m.pgm"
    escribir_pgm(p, mascara)
    sal = subprocess.run(["magick", str(p), "-morphology", "Dilate", f"Disk:{union}", "-define", "connected-components:verbose=true",
                          "-define", "connected-components:area-threshold=1500", "-connected-components", "8", "null:"], capture_output=True, text=True).stdout
    cajas = []
    for l in sal.splitlines():
        m = re.match(r"\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) .* gray\(255\)", l) or re.match(r"\s*\d+: (\d+)x(\d+)\+(\d+)\+(\d+) .* srgb\(255,255,255\)", l)
        if m:
            w, h, x, y = map(int, m.groups())
            if w * h < 0.6 * mascara.size:
                cajas.append((x, y, w, h))
    return cajas


def todas_las_cajas(mascara, union, abajo, tmp):
    cajas = componentes(mascara, union, tmp)
    if abajo:  # zona de abajo: dibujos más juntos, se separan con una unión más chica
        y_desde, u2 = abajo
        cajas = [c for c in cajas if c[1] + c[3] / 2 < y_desde] + [c for c in componentes(mascara, u2, tmp) if c[1] + c[3] / 2 >= y_desde]
    return cajas


def kmeans(px, k, it=12):
    rng = np.random.default_rng(1)
    c = px[rng.choice(len(px), k, replace=False)].astype(np.float32)
    for _ in range(it):
        d = ((px[:, None, :] - c[None]) ** 2).sum(2)
        a = d.argmin(1)
        for i in range(k):
            if (a == i).any():
                c[i] = px[a == i].mean(0)
    return c


def capa_svg(mascara, color, tmp, escala, crecer=1):
    """Vectoriza una máscara y devuelve (ancho del lienzo, alto, <g> del SVG)."""
    p = tmp / "c.pgm"
    escribir_pgm(p, mascara)
    q = tmp / "c_up.pbm"
    cmd = ["magick", str(p), "-filter", "Lanczos", "-resize", f"{escala * 100:.1f}%", "-blur", "0x1.0", "-threshold", "50%"]
    if crecer:
        cmd += ["-morphology", "Dilate", f"Disk:{crecer}"]
    cmd += ["-negate"]
    subprocess.run(cmd + [str(q)], check=True)
    out = tmp / "c.svg"
    subprocess.run(["potrace", "-s", "-r", "72", "-t", "25", "-a", "1.2", "-O", "1.6", "-C", color, "-o", str(out), str(q)], check=True)
    s = out.read_text()
    vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s)
    g = re.search(r"<g .*?</g>", s, re.S)
    return float(vb[1]), float(vb[2]), g[0] if g else ""


def hexa(c):
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in c)


def vectorizar(img, mascara, caja, k, tmp, pad=10):
    x, y, w, h = caja
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(img.shape[1], x + w + pad), min(img.shape[0], y + h + pad)
    rgb = img[y0:y1, x0:x1]
    m = mascara[y0:y1, x0:x1]
    # Nos quedamos con el dibujo de esta caja (si otro dibujo asoma por el borde de la caja, queda afuera)
    px = rgb[m].astype(np.float32)
    c = kmeans(px, k)
    etiqueta = np.full(m.shape, -1)
    etiqueta[m] = ((px[:, None, :] - c[None]) ** 2).sum(2).argmin(1)
    orden = sorted(range(k), key=lambda i: (c[i].mean() < 70, -(etiqueta == i).sum()))  # primero rellenos grandes, al final los oscuros
    escala = (LADO * 1.6 if max(m.shape) > 800 else LADO) / max(m.shape)
    capas, W, H = [], 0, 0
    for i in orden:
        mi = etiqueta == i
        if mi.sum() < 40:
            continue
        W, H, g = capa_svg(mi, hexa(c[i]), tmp, escala)
        if g:
            capas.append(g)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:g} {H:g}">' + "".join(capas) + "</svg>", (x0, y0, x1, y1)


# Íconos de la barra de abajo: el mismo dibujo, centrado en un cuadrado para que todos pesen parecido
ICONOS_NAV = {"nav-inicio": "brote", "nav-suelo": "suelo-bueno", "nav-chacras": "cultivo-espiga", "nav-clima": "clima-parcial"}


def iconos_nav(margen=4):
    for destino, origen in ICONOS_NAV.items():
        svg = (SALIDA / f"{origen}.svg").read_text()
        vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
        w, h = float(vb[1]), float(vb[2])
        lado = 100 - 2 * margen
        k = min(lado / w, lado / h)
        dw, dh = w * k, h * k
        interior = svg[svg.index(">") + 1: svg.rindex("</svg>")]
        (SALIDA / f"{destino}.svg").write_text(
            # el halo gris suave contornea los dibujos claros (la nube blanca) para que se vean sobre fondo blanco
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><filter id="halo" x="-10%" y="-10%" width="120%" height="120%">'
            f'<feDropShadow dx="0" dy="0" stdDeviation="0.9" flood-color="#3a4a40" flood-opacity="0.55"/></filter></defs>'
            f'<svg x="{(100 - dw) / 2:.2f}" y="{(100 - dh) / 2:.2f}" width="{dw:.2f}" height="{dh:.2f}" viewBox="0 0 {w:g} {h:g}" filter="url(#halo)">{interior}</svg></svg>')


def main():
    if "--solo-nav" in sys.argv:
        iconos_nav()
        return
    tmp = pathlib.Path(sys.argv[1]); tmp.mkdir(parents=True, exist_ok=True)
    SALIDA.mkdir(parents=True, exist_ok=True)
    for archivo, nombres, union, umbral, abajo in DIBUJOS:
        img = leer(ORIG / archivo)
        q = (img // 8).reshape(-1, 3)
        valores, cuentas = np.unique(q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2], return_counts=True)
        v = valores[cuentas.argmax()]
        bg = np.array([v // 1024, (v // 32) % 32, v % 32]) * 8 + 4
        mascara = ~fondo_conectado(img, bg, umbral)
        cajas = todas_las_cajas(mascara, union, abajo, tmp)
        print(f"{archivo}: fondo {bg.tolist()}, {len(cajas)} dibujos (se esperaban {len(nombres)})")
        for nombre, (cx, cy, k) in nombres.items():
            # el dibujo cuyo centro está más cerca del punto indicado
            caja = min(cajas, key=lambda c: (c[0] + c[2] / 2 - cx) ** 2 + (c[1] + c[3] / 2 - cy) ** 2)
            svg, rec = vectorizar(img, mascara, caja, k, tmp)
            (SALIDA / f"{nombre}.svg").write_text(svg)
            print(f"  {nombre:14s} caja {caja} → {len(svg)//1024} KB")
    iconos_nav()


if __name__ == "__main__":
    main()
