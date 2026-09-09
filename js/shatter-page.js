/* The rest of the page comes apart too.

   The same idea as the hero title in hero-title.js: text does not animate, it
   holds a position, read from the scroll. Here every block of writing on the
   page gets one, and breaks up as it leaves the top of the screen —
   recomposing, whole, on the way back down.

   Two techniques, chosen by type size, because one does not survive both jobs:

   - **Headings** — anything set at 22px or more — break letter by letter into
     clipped shards, exactly as the hero does, with the wave running left to
     right through the line. It is the effect you actually see, and it is only
     affordable on short text.
   - **Body text** breaks by word: each word keeps its own direction, spin and
     distance, but the whole block shares one progress value. At 13 to 15px a
     shattered letter is a smudge — you cannot see the pieces, only the
     movement — so the pieces buy nothing and would cost four elements per
     character. A paragraph is 1367 words on this page; per letter with shards
     it would have been tens of thousands of boxes to repaint every frame.

   That split is also what makes the whole thing cheap: a heading writes one
   custom property per letter per frame, a paragraph writes exactly one, and
   CSS multiplies out the rest.

   What is left alone: the header and its logo, the form's own inputs, the
   error line — an alert that scatters is an alert nobody reads — the toast,
   and text meant only for screen readers.

   Nothing here is decoration bolted over the words: every glyph stays a real
   text node in the markup, so the page reads, indexes and copies exactly as
   before. With prefers-reduced-motion none of it is split at all. */

import { env, onScroll } from "./env.js";

/* Type this size or larger comes apart letter by letter; below it, word by
   word. It is the line between "you can see the pieces move" and "you cannot".
   Either way each piece is one span: the hero title's clipped shards are the
   showpiece and stay its alone — three clipped copies of every glyph cost two
   thirds of the frame rate when applied to the whole page, measured, and at
   subheading size nobody can see them anyway. */
const DISPLAY_SIZE = 22;

/* Where a block is whole, and where it has finished coming apart, as
   fractions of the viewport height measured from the top. Nothing is touched
   until it has left the comfortable reading band and is on its way off the
   screen; it is gone before it reaches the header. */
const START = 0.34;
const END = 0.05;

const REACH = [22, 68];
const LIFT = 0.4;
const SPIN = 95;
const WAVE = 0.34;

/* Subtrees the effect never enters. */
const SKIP = [
  ".site-header",
  ".hero__text h1", // hero-title.js owns this one, and tunes it differently
  "#toast",
  "#form-error",
  ".visually-hidden",
  ".shatter",
  "script",
  "style",
  "noscript",
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function noise(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** One piece: a span that carries its own direction, distance and spin. */
function piece(text, seed) {
  const node = document.createElement("span");
  node.className = "shatter__wp";
  node.textContent = text;

  const angle = noise(seed) * Math.PI * 2;
  const reach = REACH[0] + noise(seed + 3) * (REACH[1] - REACH[0]);
  // sideways travel is halved: it is the one direction where overshoot would
  // cost the page a horizontal scrollbar
  node.style.setProperty("--dx", (Math.cos(angle) * reach * 0.5).toFixed(1));
  node.style.setProperty("--dy", (Math.sin(angle) * reach - reach * LIFT).toFixed(1));
  node.style.setProperty("--rot", ((noise(seed + 7) - 0.5) * 2 * SPIN).toFixed(1));
  return node;
}

/* ── the two ways of taking a block apart ───────────────────────────────── */

/** Letters, each with its own progress, so the break runs along the line.
    Letter-sized inline-blocks make some screen readers spell the word out, so
    the sentence is handed over whole in aria-label and the pieces are hidden
    from the accessibility tree — the glyphs are still real text in the markup
    for everything else that reads the page. */
function splitToLetters(el, text) {
  el.setAttribute("aria-label", text);

  const wrap = document.createElement("span");
  wrap.className = "shatter";
  wrap.setAttribute("aria-hidden", "true");

  const letters = [];
  let n = 0;

  text.split(" ").forEach((word, wi) => {
    if (wi) wrap.append(" ");
    if (!word) return;
    const w = document.createElement("span");
    w.className = "shatter__w";
    for (const ch of word) {
      const letter = piece(ch, (n + 1) * 97);
      w.append(letter);
      letters.push(letter);
      n += 1;
    }
    wrap.append(w);
  });

  el.replaceChildren(wrap);
  el.classList.add("shatter-block");
  return letters;
}

/** Words. The block keeps one progress value and every word reads it, so a
    paragraph costs a single style write per frame however long it is. */
function splitToWords(el, text) {
  const frag = document.createDocumentFragment();
  text.split(/(\s+)/).forEach((part, i) => {
    if (!part) return;
    // real whitespace between the words, so wrapping and copying still work
    if (/^\s+$/.test(part)) frag.append(part);
    else frag.append(piece(part, i * 61 + part.length * 7 + 1));
  });
  el.replaceChildren(frag);
  el.classList.add("shatter-block");
}

/* ── the page ───────────────────────────────────────────────────────────── */

export function initPageShatter() {
  /* Reduced motion leaves every word of the page exactly as written. */
  if (env.reduce) return;
  if (!("IntersectionObserver" in window)) return;

  const skipSelector = SKIP.join(",");
  const roots = [document.querySelector("main"), document.querySelector(".site-footer")].filter(Boolean);

  /** Every leaf of writing, found once. */
  const blocks = [];
  roots.forEach((root) => {
    root.querySelectorAll("*").forEach((el) => {
      if (el.closest(skipSelector)) return;
      // only leaves: a paragraph holding a link is handled as its parts
      if (Array.prototype.some.call(el.childNodes, (n) => n.nodeType === Node.ELEMENT_NODE)) return;
      const text = el.textContent.trim();
      if (!text) return;

      blocks.push({
        el,
        display: parseFloat(getComputedStyle(el).fontSize) >= DISPLAY_SIZE,
        built: false,
        letters: null,
        delays: null,
        last: null,
        value: -1,
      });
    });
  });

  if (!blocks.length) return;

  function build(entry) {
    const el = entry.el;
    /* Every glyph appears exactly once, so textContent still reads as the
       sentence it was — which is what the language switch stores as the
       Italian, and what a crawler sees. */
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text) return false;

    if (entry.display) {
      entry.letters = splitToLetters(el, text);
      entry.delays = entry.letters.map((_, i) =>
        entry.letters.length < 2 ? 0 : (i / (entry.letters.length - 1)) * WAVE
      );
      entry.last = entry.letters.map(() => -1);
    } else {
      splitToWords(el, text);
    }
    entry.built = true;
    entry.value = -1;
    return true;
  }

  /** Has something replaced this element's text since it was split? */
  function intact(entry) {
    return entry.el.firstElementChild?.classList.contains(entry.display ? "shatter" : "shatter__wp");
  }

  /* Two observers, doing two different jobs.

     The first splits a block while it is still well below the screen, so the
     hundreds of spans a section costs are built in ones and twos on the way up
     rather than all at once in the frame where the shatter starts — which is
     what was dropping frames.

     The second is the one that matters for the frame budget: it reports only
     the blocks overlapping the top band, where the effect actually happens.
     Everything else on screen is sitting at nought and does not need its
     position read, let alone written, sixty times a second. On a full page
     that is a handful of blocks in play instead of every paragraph in view. */
  const driving = new Set();

  const builder = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const entry = e.target.__shatter;
        builder.unobserve(e.target);
        if (entry && !entry.built) build(entry);
      });
    },
    { rootMargin: "600px 0px 600px 0px" }
  );

  const band = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const entry = e.target.__shatter;
        if (!entry) return;
        if (e.isIntersecting) {
          driving.add(entry);
        } else {
          driving.delete(entry);
          // held at whichever end it left by: gone if it went up, whole if down
          if (entry.built) write(entry, e.boundingClientRect.top < window.innerHeight * START ? 1 : 0);
        }
      });
      schedule();
    },
    { rootMargin: `0px 0px -${Math.round((1 - START) * 100)}% 0px` }
  );

  blocks.forEach((entry) => {
    entry.el.__shatter = entry;
    builder.observe(entry.el);
    band.observe(entry.el);
  });

  function write(entry, p) {
    if (entry.value === p) return;
    entry.value = p;

    if (!entry.display) {
      entry.el.style.setProperty("--e", p.toFixed(4));
      return;
    }

    for (let i = 0; i < entry.letters.length; i += 1) {
      const lp = clamp01((p - entry.delays[i]) / (1 - WAVE));
      const e = lp * lp * (0.4 + 0.6 * lp);
      if (e === entry.last[i] || (Math.abs(e - entry.last[i]) < 0.002 && e > 0 && e < 1)) continue;
      entry.last[i] = e;
      entry.letters[i].style.setProperty("--e", e.toFixed(4));
    }
  }

  let frame = 0;

  function tick() {
    frame = 0;
    const vh = window.innerHeight;
    const start = vh * START;
    const end = Math.max(0, vh * END);
    const span = Math.max(60, start - end);

    /* Read every position first, then write every value. Interleaving them
       would make the browser re-do layout for each block in turn. */
    const reads = [];
    driving.forEach((entry) => {
      reads.push([entry, entry.el.getBoundingClientRect().top]);
    });

    reads.forEach(([entry, top]) => {
      const p = clamp01((start - top) / span);
      if (p === 0 && !entry.built) return; // nothing to do until it starts
      if (!entry.built && !build(entry)) return;
      if (!intact(entry)) {
        // its text was replaced by the module that owns it — split it again
        entry.built = false;
        if (!build(entry)) return;
      }
      write(entry, p);
    });
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  onScroll(schedule);
  window.addEventListener("resize", schedule, { passive: true });
  document.addEventListener("languagechange", () => {
    // the switch rewrites textContent; everything on screen is split again
    blocks.forEach((entry) => {
      entry.built = false;
      entry.value = -1;
      entry.el.style.removeProperty("--e");
    });
    schedule();
  });

  schedule();
}
