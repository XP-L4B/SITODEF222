#!/usr/bin/env python3
"""Cut the pixel-art figures out of a strip and save them with transparency.

    python3 tools/crop-people.py art/personaggi-lavoro.png --expect 8 --flip 2,4,7

Two kinds of source are handled. One that already carries an alpha channel is
used as it is — it must not be flooded, because the seed would be whatever sits
behind the transparency (usually black) and the fill would eat every dark suit
and shoe it touches. One on a flat light background is flooded from the borders
instead of by deleting light pixels, because a chef's hat and a lab coat are
light too and a global cut would punch holes through them.

Figures are then found as connected blobs rather than by looking for empty
columns: in a real strip they stand shoulder to shoulder, hold wide props, and
carry a soft halo, so the columns between them are rarely empty. Blobs that
share a horizontal span are one figure in pieces and get merged; a blob far
wider than its neighbours is two figures touching and is cut at the thinnest
column near its middle.
"""

import argparse
import pathlib
import sys
from collections import deque

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is needed: pip install pillow")

SOLID = 128  # alpha at or above this counts as the figure, not its halo


def flood_background(px, w, h, tolerance):
    """Alpha mask for a flat-background source: 0 where the border colour reaches."""
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


def blob_spans(alpha, w, h, min_area):
    """Horizontal spans of the connected blobs, largest first."""
    seen = [[False] * w for _ in range(h)]
    spans = []

    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or alpha[sy][sx] < SOLID:
                continue
            queue = deque([(sx, sy)])
            seen[sy][sx] = True
            area = 0
            x0 = x1 = sx
            while queue:
                x, y = queue.popleft()
                area += 1
                x0 = min(x0, x)
                x1 = max(x1, x)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and alpha[ny][nx] >= SOLID:
                        seen[ny][nx] = True
                        queue.append((nx, ny))
            if area >= min_area:
                spans.append([x0, x1])

    return sorted(spans)


def merge_overlapping(spans):
    """One figure can arrive as several blobs; anything overlapping in x is one."""
    merged = []
    for span in spans:
        if merged and span[0] <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], span[1])
        else:
            merged.append(list(span))
    return merged


def split_widest(spans, alpha, h, expect):
    """Cut over-wide spans — two figures touching — at their thinnest column."""
    while len(spans) < expect:
        widths = [s[1] - s[0] for s in spans]
        i = widths.index(max(widths))
        x0, x1 = spans[i]

        counts = [sum(1 for y in range(h) if alpha[y][x] >= SOLID) for x in range(x0, x1 + 1)]
        lo = int(len(counts) * 0.3)
        hi = int(len(counts) * 0.7)
        if hi <= lo:
            break
        cut = min(range(lo, hi), key=lambda k: counts[k])

        spans[i : i + 1] = [[x0, x0 + cut - 1], [x0 + cut + 1, x1]]
        spans.sort()
    return spans


# The slab each figure stands on: a mid grey-lavender, sampled off the artwork.
SLAB = (110, 103, 122)
SLAB_TOLERANCE = 34


def drop_ground_shadow(piece):
    """Clear the slab each figure stands on.

    It belongs to the artwork, but on a dark page it reads as a floating
    pedestal rather than a shadow. Only the bottom eighth of the figure is
    considered, and the match is against the slab's own colour rather than
    "anything pale" — it is a mid grey, darker than the white trainers just
    above it and lighter than every shoe, so both survive. The soft edge of
    the slab goes with it.
    """
    px = piece.load()
    w, h = piece.size
    band = int(h * 0.875)
    for y in range(band, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            near_slab = all(abs(v - s) <= SLAB_TOLERANCE for v, s in zip((r, g, b), SLAB))
            if near_slab or (a < 200 and y > int(h * 0.93)):
                px[x, y] = (0, 0, 0, 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--out", default="assets/people")
    ap.add_argument("--flip", default="", help="1-based indices to mirror, e.g. 2,4,7")
    ap.add_argument("--expect", type=int, default=0, help="how many figures the strip holds")
    ap.add_argument("--tolerance", type=int, default=26)
    ap.add_argument("--min-area", type=int, default=2000)
    ap.add_argument("--keep-shadow", action="store_true")
    ap.add_argument("--height", type=int, default=320)
    args = ap.parse_args()

    img = Image.open(args.source).convert("RGBA")
    w, h = img.size
    px = img.load()

    if px[0, 0][3] == 0:
        print("source already carries an alpha channel — using it")
        alpha = [[px[x, y][3] for x in range(w)] for y in range(h)]
    else:
        alpha = flood_background(px, w, h, args.tolerance)
        for y in range(h):
            for x in range(w):
                if alpha[y][x] == 0:
                    px[x, y] = (0, 0, 0, 0)

    spans = merge_overlapping(blob_spans(alpha, w, h, args.min_area))
    if args.expect:
        spans = split_widest(spans, alpha, h, args.expect)

    flip = {int(n) for n in args.flip.split(",") if n.strip()}
    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"{len(spans)} figures in {args.source} ({w}x{h})")
    for i, (x0, x1) in enumerate(spans, start=1):
        piece = img.crop((x0, 0, x1 + 1, h))
        piece = piece.crop(piece.getbbox())
        if not args.keep_shadow:
            drop_ground_shadow(piece)
            piece = piece.crop(piece.getbbox())

        scale = args.height / piece.height
        piece = piece.resize(
            (max(1, round(piece.width * scale)), args.height), Image.NEAREST
        )
        if i in flip:
            piece = piece.transpose(Image.FLIP_LEFT_RIGHT)

        name = f"person-{i:02d}"
        piece.save(out_dir / f"{name}.png")
        piece.save(out_dir / f"{name}.webp", quality=90, method=6)
        print(f"  {name}  {piece.width}x{piece.height}{'  mirrored' if i in flip else ''}")


if __name__ == "__main__":
    main()
