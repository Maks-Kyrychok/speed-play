"""Renders the SpeedyPlay icon to src/icons/ at the three sizes the manifest
declares. Pure stdlib: the shapes are geometric, so a supersampled coverage
test is enough and needs no image libraries.

    python3 assets/make-icons.py

The vector master is assets/icon.svg; keep the two in step if you edit either.
"""
import struct, zlib

def write_png(path, size, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(t, d):
        c = t + d
        return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    open(path, "wb").write(png)

def in_rounded_rect(x, y, r):
    """x, y in 0..1. Full-bleed square, corner radius r (also 0..1)."""
    px, py = abs(x - 0.5), abs(y - 0.5)
    dx, dy = px - (0.5 - r), py - (0.5 - r)
    if dx <= 0 or dy <= 0:
        return px <= 0.5 and py <= 0.5
    return dx * dx + dy * dy <= r * r

def in_triangle(x, y, a, b, c):
    def side(p, q, r_):
        return (q[0] - p[0]) * (r_[1] - p[1]) - (q[1] - p[1]) * (r_[0] - p[0])
    d1, d2, d3 = side(a, b, (x, y)), side(b, c, (x, y)), side(c, a, (x, y))
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)

def render(size, bg, fg, radius=0.22, chevrons=None, ss=8):
    if chevrons is None:
        chevrons = DEFAULT_CHEVRONS
    rows = []
    step = 1.0 / (size * ss)
    for py in range(size):
        row = bytearray()
        for px in range(size):
            bg_hits = fg_hits = 0
            for sy in range(ss):
                y = (py * ss + sy + 0.5) * step
                for sx in range(ss):
                    x = (px * ss + sx + 0.5) * step
                    if in_rounded_rect(x, y, radius):
                        bg_hits += 1
                        if any(in_triangle(x, y, *t) for t in chevrons):
                            fg_hits += 1
            total = ss * ss
            if bg_hits == 0:
                row += bytes((0, 0, 0, 0))
                continue
            # Composite glyph over tile, then the tile over transparency.
            cover = fg_hits / bg_hits
            colour = tuple(round(bg[i] + (fg[i] - bg[i]) * cover) for i in range(3))
            row += bytes((*colour, round(255 * bg_hits / total)))
        rows.append(row)
    return rows

# Two arrowheads meeting at the centre, the same glyph the in-player button
# uses. Sized to fill the tile: a smaller glyph turns to mush at 16px.
DEFAULT_CHEVRONS = [
    [(0.17, 0.20), (0.50, 0.50), (0.17, 0.80)],
    [(0.50, 0.20), (0.83, 0.50), (0.50, 0.80)],
]

# YouTube red, matching the accent the popup and the in-player button use, so
# the extension reads as one thing. Balanced on both toolbars: white chevrons
# at 4.00:1, tile against a light toolbar 3.59:1 and a dark one 3.59:1.
TILE = (0xFF, 0x00, 0x00)
GLYPH = (255, 255, 255)

# A red tile with white play arrows is close to YouTube's own trade dress. If
# the store ever objects, swap TILE for this indigo, which was the runner-up
# and is stronger still on contrast (glyph 4.47:1, toolbars 4.01:1 / 3.21:1).
ALTERNATIVE_TILE = (0x63, 0x66, 0xF1)

if __name__ == "__main__":
    import pathlib
    out = pathlib.Path(__file__).resolve().parent.parent / "src" / "icons"
    for size in (16, 48, 128):
        path = out / f"icon_{size}.png"
        write_png(path, size, render(size, TILE, GLYPH))
        print(f"{path.relative_to(path.parents[2])}  {size}x{size}")
