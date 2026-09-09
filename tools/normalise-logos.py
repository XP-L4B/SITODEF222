#!/usr/bin/env python3
"""Give every partner logo the same ink density.

The logos are white silhouettes: the artwork is carried entirely by the alpha
channel, and every pixel of every file is pure white underneath. But they were
exported at different opacities — the alpha ceiling across the set ran from 136
to 255 — so the one `opacity: .7` the stylesheet applies to the row landed on
an uneven base. UniCredit came out at 0.70 and ManpowerGroup at 0.38, which is
why some looked whiter than others however the CSS was written.

This lifts each file's own ceiling back to fully opaque, scaling the whole
alpha channel by the same factor so anti-aliased edges keep their softness.
The colour is never touched — there is nothing to touch, it is white
throughout — so nothing can shift hue. A file already at 255 is left alone.

    python3 tools/normalise-logos.py --check      # report, change nothing
    python3 tools/normalise-logos.py              # normalise in place

Run it after adding a logo to assets/, then check the row still looks even:
equal density is not equal *presence*, and a hairline mark will always read
lighter than a solid one however the alpha is scaled.
"""

import argparse
import glob
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("serve Pillow:  pip install Pillow")

PATTERN = "assets/partner-*mono*.png"

# Below this the file is treated as already normalised: a one- or two-step
# difference is invisible and not worth a rewrite in git.
TOLERANCE = 2


def ceiling(image):
    """The highest alpha in the file — how solid its solid strokes actually are."""
    channel = image.getchannel("A")
    data = channel.get_flattened_data() if hasattr(channel, "get_flattened_data") else channel.getdata()
    return max(data)


def normalise(path, dry_run):
    image = Image.open(path).convert("RGBA")
    top = ceiling(image)
    if top == 0:
        return path, top, None, "vuoto"
    if top >= 255 - TOLERANCE:
        return path, top, top, "già a posto"

    gain = 255 / top
    alpha = image.getchannel("A").point(lambda a: min(255, round(a * gain)))
    if not dry_run:
        image.putalpha(alpha)
        image.save(path, optimize=True)
    return path, top, 255, f"×{gain:.2f}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report without writing")
    parser.add_argument("--glob", default=PATTERN, help=f"which files (default: {PATTERN})")
    args = parser.parse_args()

    files = sorted(glob.glob(args.glob))
    if not files:
        sys.exit(f"nessun file per {args.glob}")

    changed = 0
    print(f"{'file':32} {'prima':>6} {'dopo':>6}  guadagno")
    for path in files:
        name, before, after, note = normalise(path, args.check)
        if note not in ("già a posto", "vuoto"):
            changed += 1
        print(f"{os.path.basename(name):32} {before:6} {str(after or '-'):>6}  {note}")

    verb = "da normalizzare" if args.check else "normalizzati"
    print(f"\n{changed} file su {len(files)} {verb}.")


if __name__ == "__main__":
    main()
