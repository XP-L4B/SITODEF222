/* The crowd walking under the Salesforce band.

   A row of pixel-art workers that drifts slowly to the right on its own, and
   that you can spin by hand — drag with the cursor or a finger, either way —
   like turning a wheel. Let go and it keeps its momentum, then eases back to
   its own slow drift.

   One velocity does all of that. The frame loop moves the row by whatever the
   current velocity is; dragging sets that velocity from the pointer, and
   whenever nobody is dragging it relaxes back towards the drift speed. A flick
   therefore coasts and settles without any separate momentum machinery.

   The offset is taken modulo the width of one set, and the track holds enough
   sets to cover the viewport plus one, so the row never runs out and the point
   where it repeats cannot be seen — in either direction.

   Spacing comes from CSS, so desktop can hold them far apart and a phone can
   pull them close. The band is decorative, so it is hidden from assistive
   technology; under prefers-reduced-motion it does not drift, though it can
   still be pushed by hand. */

import { env } from "./env.js";

/* The sprites, in the order they walk. `flipped` ones were mirrored at crop
   time and face back along the row, which keeps the procession from looking
   like everyone marching in lockstep.

   Cut from art/personaggi-lavoro.png by tools/crop-people.py. An empty list
   leaves the band hidden and the page exactly as it was. */
const PEOPLE = [
  { file: "person-01" },                  // studente col portatile
  { file: "person-02", flipped: true },   // infermiera
  { file: "person-03" },                  // impiegato in giacca
  { file: "person-04", flipped: true },   // operaia col caschetto
  { file: "person-05" },                  // progettista col tablet
  { file: "person-06" },                  // chef
  { file: "person-07", flipped: true },   // agente di polizia
  { file: "person-08" },                  // barista
];

/** Drift, in pixels per second. Positive is to the right. */
const DRIFT = 16;

/** How quickly a hand-thrown speed relaxes back to the drift, in ms. */
const SETTLE = 700;

/** Below this, a press counts as a tap and the row is not nudged. */
const DRAG_SLOP = 3;

export function initPeopleBand() {
  const section = document.getElementById("crowd");
  const track = document.getElementById("crowd-track");
  if (!section || !track || PEOPLE.length === 0) return;

  section.hidden = false;

  const buildSet = () => {
    const set = document.createElement("div");
    set.className = "crowd__set";
    PEOPLE.forEach((p) => {
      // webp is a quarter of the png here; the png stays as the fallback
      const picture = document.createElement("picture");
      const webp = document.createElement("source");
      webp.srcset = `assets/people/${p.file}.webp`;
      webp.type = "image/webp";
      const img = document.createElement("img");
      img.src = `assets/people/${p.file}.png`;
      img.alt = "";
      // Not lazy: the row moves by transform, and a transformed element that
      // starts outside the viewport horizontally may never trip a lazy load,
      // which would leave holes in the procession. Low priority instead, so
      // 87KB of sprites do not compete with what is above the fold.
      img.decoding = "async";
      img.fetchPriority = "low";
      img.className = "crowd__person";
      picture.append(webp, img);
      set.appendChild(picture);
    });
    return set;
  };

  track.replaceChildren(buildSet());

  let setWidth = 0;
  let offset = 0;          // how far the row has travelled, always within one set
  let velocity = DRIFT;    // px per second, positive to the right
  let dragging = false;

  /* Enough copies that the track always covers the viewport plus one whole
     set, so an offset of up to one set width can never expose the end. */
  const fill = () => {
    const first = track.firstElementChild;
    if (!first) return;
    setWidth = first.offsetWidth;
    if (!setWidth) return; // images have not laid out yet

    const needed = Math.ceil((window.innerWidth + setWidth) / setWidth) + 1;
    while (track.children.length > needed) track.lastElementChild.remove();
    while (track.children.length < needed) track.appendChild(buildSet());
  };

  const place = () => {
    if (!setWidth) return;
    offset = ((offset % setWidth) + setWidth) % setWidth;
    track.style.transform = `translate3d(${-offset}px,0,0)`;
  };

  /* ── the frame loop ───────────────────────────────────────────────────── */

  let visible = true;
  let last = performance.now();

  const frame = (now) => {
    requestAnimationFrame(frame);

    const dt = Math.min(64, now - last); // a tab that was hidden must not lurch
    last = now;

    if (!setWidth || !visible) return;

    if (!dragging) {
      // ease towards the drift: this is both the settle after a flick and the
      // ordinary state, so there is only one path to keep right
      const target = env.reduce ? 0 : DRIFT;
      velocity += (target - velocity) * (1 - Math.exp(-dt / SETTLE));
      offset -= (velocity * dt) / 1000;
      place();
    }
  };
  requestAnimationFrame(frame);

  if ("IntersectionObserver" in window) {
    // no need to move a row nobody can see
    new IntersectionObserver(
      (entries) => entries.forEach((e) => (visible = e.isIntersecting)),
      { rootMargin: "120px" }
    ).observe(section);
  }

  /* ── turning it by hand ───────────────────────────────────────────────── */

  let pointerId = null;
  let startX = 0;
  let startOffset = 0;
  let lastX = 0;
  let lastMoveAt = 0;
  let moved = false;

  section.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    pointerId = e.pointerId;
    dragging = true;
    moved = false;
    startX = lastX = e.clientX;
    startOffset = offset;
    lastMoveAt = performance.now();
    velocity = 0;
    section.classList.add("is-grabbing");
    section.setPointerCapture?.(e.pointerId);
  });

  section.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;

    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) < DRAG_SLOP) return;
    moved = true;

    // dragging right carries the row right, which is a smaller offset
    offset = startOffset - dx;
    place();

    // remember the recent speed, so letting go hands it on as momentum
    const now = performance.now();
    const elapsed = now - lastMoveAt;
    if (elapsed > 0) {
      const instant = ((e.clientX - lastX) / elapsed) * 1000;
      velocity = velocity * 0.7 + instant * 0.3; // smoothed, so one jittery
      lastX = e.clientX;                          // sample cannot fling it
      lastMoveAt = now;
    }
  });

  const release = (e) => {
    if (!dragging || (e && e.pointerId !== pointerId)) return;
    dragging = false;
    pointerId = null;
    section.classList.remove("is-grabbing");
    if (!moved) velocity = env.reduce ? 0 : DRIFT; // a tap should not fling it
    // whatever the velocity is now, the frame loop eases it back to the drift
  };

  section.addEventListener("pointerup", release);
  section.addEventListener("pointercancel", release);
  section.addEventListener("lostpointercapture", release);

  // a dragged sprite must not turn into a browser image-drag
  section.addEventListener("dragstart", (e) => e.preventDefault());

  /* ── layout ───────────────────────────────────────────────────────────── */

  const relayout = () => {
    fill();
    place();
  };

  window.addEventListener("resize", relayout);
  track.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", relayout, { once: true });
  });
  document.fonts?.ready.then(relayout);

  relayout();
}
