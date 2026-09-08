/* The hero title, and how it comes apart.

   The heading is split into words, letters, and then each letter into a few
   clipped shards that together redraw the glyph exactly. Scrolling away from
   the top drives one progress value: the shards fly out, turn, shrink and
   fade, in a wave that runs left to right through the sentence. Scrolling back
   up runs the same value backwards, so the title reassembles — nothing here is
   a one-shot animation, it is a position, which is how the background already
   behaves.

   Two details are worth knowing:

   - At rest the shards are hidden and a single intact glyph is shown instead.
     Three clipped copies tiling a letter leave a hairline where their edges
     meet, and the top of the page is exactly where that would be noticed. The
     swap happens in the first few percent of the travel, while everything is
     already moving.
   - Only one custom property is written per letter per frame (`--e`); the
     shards' own direction, spin and clip are static, and CSS multiplies them
     out. The glyphs are in the markup either way, so the title reads and
     indexes with scripting off. */

import { env, onScroll } from "./env.js";

/* How far the shards travel, in pixels, and how much of the sentence's own
   length the left-to-right wave takes up. Horizontal reach stays modest: the
   page must not grow a sideways scrollbar because a letter flew off it. */
const REACH = [26, 78];
const LIFT = 0.45;
const SPIN = 105;
const WAVE = 0.38;

/* How much of the scroll the title has before it is behind the header is what
   the shatter gets to use — measured, not guessed. On a phone the header is
   three rows tall and the heading passes under it after a couple of hundred
   pixels, so a span set as a fraction of the viewport spent most of its length
   animating something already out of sight. Four fifths of the real distance
   leaves the last letters finishing just before the last line goes under. */
const USE = 0.8;
const SPAN_MAX = 0.5;
const SPAN_MIN = 170;

/* Pieces per letter. Phones get fewer — every shard is a text box the browser
   repaints each frame, and the difference is invisible at that size. */
const pieces = () => (window.innerWidth < 720 ? 2 : 3);

/** Deterministic noise, so a letter shatters the same way on every visit. */
function noise(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The clip polygons for one letter: slanted bands that tile the whole box. */
function shards(count, seed) {
  const cuts = [0];
  for (let i = 1; i < count; i += 1) {
    // an uneven cut, so no two letters break along the same line
    cuts.push((i + noise(seed * 31 + i) * 0.6 - 0.3) / count);
  }
  cuts.push(1);

  const slant = cuts.map((c, i) => (i === 0 || i === count ? c : c + (noise(seed * 71 + i) - 0.5) * 0.5));

  return Array.from({ length: count }, (_, i) => {
    // the outer edges reach past the box, the inner ones overlap a little, so
    // the reassembled glyph has no seam and no missing sliver
    const l = i === 0 ? -0.12 : cuts[i] - 0.02;
    const r = i === count - 1 ? 1.12 : cuts[i + 1] + 0.02;
    const bl = i === 0 ? -0.12 : slant[i] - 0.02;
    const br = i === count - 1 ? 1.12 : slant[i + 1] + 0.02;
    const pct = (v) => `${(v * 100).toFixed(1)}%`;
    return `polygon(${pct(l)} -12%, ${pct(r)} -12%, ${pct(br)} 112%, ${pct(bl)} 112%)`;
  });
}

export function initHeroTitle(h1) {
  if (!h1) return;

  /* The sentence as it stands in the markup, before anything is done to it —
     and again after each language switch, which replaces the heading's text. */
  let letters = [];
  let delays = [];
  let last = [];

  /* A letter is one glyph drawn several times over, so once the heading is
     split its textContent is that many copies of the sentence. The language
     switch reads textContent to remember the Italian, and would remember the
     copies. So the pristine line is handed to it here, before anything is
     taken apart; after that the switch always writes clean text back and
     build() reads it fresh. */
  if (h1.dataset.it === undefined) h1.dataset.it = h1.textContent;

  function build() {
    const text = h1.textContent;
    if (!text.trim()) return;

    // the shards are decoration; the sentence is what a screen reader gets
    h1.setAttribute("aria-label", text);

    const wrap = document.createElement("span");
    wrap.className = "shatter";
    wrap.setAttribute("aria-hidden", "true");

    letters = [];
    const count = pieces();
    let n = 0;

    text.split(" ").forEach((word, wi) => {
      if (wi) wrap.append(" ");
      if (!word) return;
      const w = document.createElement("span");
      w.className = "shatter__w";

      for (const ch of word) {
        const letter = document.createElement("span");
        letter.className = "shatter__l";

        const ghost = document.createElement("span");
        ghost.className = "shatter__g";
        ghost.textContent = ch;
        letter.append(ghost);

        const clips = shards(count, n + 1);
        for (let p = 0; p < count; p += 1) {
          const seed = (n + 1) * 97 + p * 13;
          const angle = noise(seed) * Math.PI * 2;
          const reach = REACH[0] + noise(seed + 3) * (REACH[1] - REACH[0]);

          const shard = document.createElement("span");
          shard.className = `shatter__p shatter__p--${p % 3}`;
          shard.textContent = ch;
          shard.style.clipPath = clips[p];
          // horizontal reach is halved: sideways is the one direction where
          // overshoot would cost the page a scrollbar
          shard.style.setProperty("--dx", (Math.cos(angle) * reach * 0.5).toFixed(1));
          shard.style.setProperty("--dy", (Math.sin(angle) * reach - reach * LIFT).toFixed(1));
          shard.style.setProperty("--rot", ((noise(seed + 7) - 0.5) * 2 * SPIN).toFixed(1));
          letter.append(shard);
        }

        w.append(letter);
        letters.push(letter);
        n += 1;
      }

      wrap.append(w);
    });

    h1.replaceChildren(wrap);

    // the wave: each letter starts a little after the one before it
    delays = letters.map((_, i) => (letters.length < 2 ? 0 : (i / (letters.length - 1)) * WAVE));
    last = letters.map(() => -1);
  }

  /* ── the one value that drives all of it ───────────────────────────────── */

  let target = 0;
  let value = 0;
  let frame = 0;
  let stamp = 0;

  function paint() {
    for (let i = 0; i < letters.length; i += 1) {
      const lp = clamp01((value - delays[i]) / (1 - WAVE));
      // accelerating: the letter hangs, then goes
      const e = lp * lp * (0.4 + 0.6 * lp);
      if (e === last[i] || (Math.abs(e - last[i]) < 0.0015 && e > 0 && e < 1)) continue;
      last[i] = e;
      letters[i].style.setProperty("--e", e.toFixed(4));
    }
  }

  function tick(now) {
    frame = 0;
    const dt = Math.min(64, stamp ? now - stamp : 16);
    stamp = now;

    const diff = target - value;
    if (Math.abs(diff) < 0.0006) value = target;
    // eased towards the scroll position rather than pinned to it: the pieces
    // keep drifting for a moment after the finger stops
    else value += diff * (1 - Math.exp(-dt / 110));

    paint();
    if (value !== target) schedule();
    else stamp = 0;
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  /* The scroll distance the shatter is given. Remeasured rather than kept: the
     header changes height with the language and with the width, and so does
     where the heading wraps. */
  let span = 400;

  function measure() {
    const box = h1.getBoundingClientRect();
    const header =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 0;
    // how far the page scrolls before the heading's last line is under the header
    const room = box.bottom + window.scrollY - header;
    span = Math.max(SPAN_MIN, Math.min(window.innerHeight * SPAN_MAX, room * USE));
  }

  function read() {
    const next = clamp01(window.scrollY / span);
    if (next === target) return;
    target = next;
    schedule();
  }

  function remeasure() {
    measure();
    read();
  }

  /* Reduced motion keeps the heading exactly as written: no split, no shards,
     nothing that moves when the page does. */
  if (env.reduce) return;

  build();
  measure();
  read();
  value = target;
  paint();

  onScroll(read);
  window.addEventListener("resize", remeasure, { passive: true });
  // the header is measured into --header-height after the fonts land, and the
  // heading wraps differently once they do
  document.fonts?.ready.then(remeasure);
  document.addEventListener("languagechange", () => {
    build();
    remeasure();
    paint();
  });
}
