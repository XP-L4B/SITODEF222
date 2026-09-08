/* The crowd walking under the Salesforce band.

   A row of pixel-art workers that slides sideways as the page scrolls: down
   moves them left, up moves them back, and because the offset is taken modulo
   the width of one set, the row never runs out — the same set re-enters as the
   previous one leaves, so it reads as one continuous procession.

   The set is repeated until the track is wider than the viewport plus one full
   set, which is what makes the wrap invisible: at any offset there is always
   another set already in place behind the one leaving.

   Spacing comes from CSS, so desktop can hold them far apart and a phone can
   pull them close without either needing its own copy of this logic. The band
   is decorative, so it is hidden from assistive technology, and it stands
   still under prefers-reduced-motion. */

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

/** How far the row travels per pixel scrolled. */
const SPEED = 0.35;

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
      img.loading = "lazy";
      img.decoding = "async";
      img.className = "crowd__person";
      picture.append(webp, img);
      set.appendChild(picture);
    });
    return set;
  };

  track.replaceChildren(buildSet());

  let setWidth = 0;

  /* Enough copies that the track always covers the viewport plus one whole
     set, so translating by up to one set width can never expose the end. */
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
    const offset = env.reduce ? 0 : (window.scrollY * SPEED) % setWidth;
    track.style.transform = `translate3d(${-offset}px,0,0)`;
  };

  const relayout = () => {
    fill();
    place();
  };

  window.addEventListener("scroll", place, { passive: true });
  window.addEventListener("resize", relayout);
  // sprite sizes come from CSS, but the set is only measurable once decoded
  track.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", relayout, { once: true });
  });
  document.fonts?.ready.then(relayout);

  relayout();
}
