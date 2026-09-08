/* Shared page state the animated pieces read: scroll progress, pointer
   position and the reduced-motion preference. One set of listeners for the
   whole page rather than one per module. */

const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/* Does this device have a mouse or a trackpad? A phone does not, so nothing
   ever moves the pointer and anything following it would sit still forever —
   the background drifts on its own instead. */
const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

export const env = {
  /** 0 at the top of the document, 1 at the bottom. */
  scrollP: 0,
  /** Pointer position normalised to the viewport; the hero's own resting spot. */
  mx: 0.72,
  my: 0.44,
  /** When the pointer last moved. 0 means it never has. */
  pointerAt: 0,
  reduce: reduceQuery.matches,
  finePointer: fineQuery.matches,
};

const listeners = new Set();

/** Called with the scroll progress on every scroll. */
export function onScroll(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initEnv() {
  const readScroll = () => {
    const doc = document.documentElement;
    const p = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
    // Rubber-band overscroll reports past both ends — negative at the top on
    // iOS, over 1 at the bottom. Progress is 0..1 by definition, and consumers
    // index palettes with it, so it is clamped here rather than in each of them.
    env.scrollP = Math.min(1, Math.max(0, p));
    listeners.forEach((fn) => fn(env.scrollP));
  };

  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener(
    "pointermove",
    (e) => {
      env.mx = e.clientX / window.innerWidth;
      env.my = e.clientY / window.innerHeight;
      env.pointerAt = performance.now();
    },
    { passive: true }
  );
  reduceQuery.addEventListener("change", (e) => {
    env.reduce = e.matches;
  });
  fineQuery.addEventListener("change", (e) => {
    env.finePointer = e.matches;
  });

  readScroll();
}
