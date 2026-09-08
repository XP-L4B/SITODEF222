#!/usr/bin/env python3
"""Cut the pixel-art figures out of a strip and save them with transparency.

    python3 tools/crop-people.py source.png --flip 2,4,7

The source is a row of characters on a flat light background. Transparency is
made by flooding in from the borders rather than by deleting every light pixel,
because plenty of light pixels belong to the figures themselves — a chef's hat,
a lab coat, a nurse's uniform — and a global "remove white" would punch holes
straight through them.

Figures are then split on the fully empty columns between them, trimmed to
their own bounds, optionally mirrored, and written to assets/people/ as PNG
plus WebP.
"""

import argparse
import pathlib
import sys
from collections import deque

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is needed: pip install pillow")


def flood_background(px, w, h, tolerance):
    """Alpha mask: 0 for background reachable from the border, 255 elsewhere."""
    seed = px[0, 0][:3]

    def is_bg(p):
        return all(abs(p[i] - seed[i]) <= tolerance for i in range(3))

    alpha = [[255] * w for _ in range(h)]
    seen = [[False] * w for _ in range(h)]
    queue = deque()

    for x in range(w):
        for y in (0, h - 1):
            if not seen[y][x] and is_bg(px[x, y]):
                seen[y][x] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y][x] and is_bg(px[x, y]):
                seen[y][x] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        alpha[y][x] = 0
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and is_bg(px[nx, ny]):
                seen[ny][nx] = True
                queue.append((nx, ny))

    return alpha


def drop_ground_shadow(px, alpha, w, h, tolerance):
    """Clear the pale ellipse each figure stands on.

    It survives the flood because it is not the background colour, but on a
    dark page it reads as a glowing puddle rather than a shadow. Only the
    bottom sixth is considered, and only pixels that are pale and close to
    neutral, so shoes and trouser hems are left alone.
    """
    for y in range(int(h * 0.84), h):
        for x in range(w):
            if alpha[y][x] == 0:
                continue
            r, g, b = px[x, y][:3]
            light = min(r, g, b) > 150
            neutral = max(r, g, b) - min(r, g, b) < 40
            if light and neutral:
                alpha[y][x] = 0


def columns_with_content(alpha, w, h):
    return [any(alpha[y][x] for y in range(h)) for x in range(w)]


def segments(filled, min_gap):
    """Runs of filled columns, split where the gap between them is wide enough."""
    out = []
    start = None
    gap = 0
    for x, on in enumerate(filled):
        if on:
            if start is None:
                start = x
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, x - gap))
                start = None
                gap = 0
    if start is not None:
        out.append((start, len(filled) - 1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--out", default="assets/people")
    ap.add_argument("--flip", default="", help="1-based indices to mirror, e.g. 2,4,7")
    ap.add_argument("--tolerance", type=int, default=26)
    ap.add_argument("--min-gap", type=int, default=12, help="empty columns that separate two figures")
    ap.add_argument("--keep-shadow", action="store_true")
    ap.add_argument("--height", type=int, default=320, help="output height in px")
    args = ap.parse_args()

    img = Image.open(args.source).convert("RGBA")
    w, h = img.size
    px = img.load()

    alpha = flood_background(px, w, h, args.tolerance)
    if not args.keep_shadow:
        drop_ground_shadow(px, alpha, w, h, args.tolerance)

    for y in range(h):
        for x in range(w):
            if alpha[y][x] == 0:
                px[x, y] = (0, 0, 0, 0)

    found = segments(columns_with_content(alpha, w, h), args.min_gap)
    flip = {int(n) for n in args.flip.split(",") if n.strip()}

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"{len(found)} figures in {args.source} ({w}x{h})")
    for i, (x0, x1) in enumerate(found, start=1):
        piece = img.crop((x0, 0, x1 + 1, h))
        piece = piece.crop(piece.getbbox())          # trim to the figure itself
        scale = args.height / piece.height
        piece = piece.resize(
            (max(1, round(piece.width * scale)), args.height), Image.NEAREST  # pixel art: no smoothing
        )
        if i in flip:
            piece = piece.transpose(Image.FLIP_LEFT_RIGHT)

        name = f"person-{i:02d}"
        piece.save(out_dir / f"{name}.png")
        piece.save(out_dir / f"{name}.webp", quality=90, method=6)
        print(
            f"  {name}  {piece.width}x{piece.height}"
            f"{'  mirrored' if i in flip else ''}"
        )


if __name__ == "__main__":
    main()
