/* Shared page state the animated pieces read: scroll progress, pointer
   position and the reduced-motion preference. One set of listeners for the
   whole page rather than one per module. */

const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

export const env = {
  /** 0 at the top of the document, 1 at the bottom. */
  scrollP: 0,
  /** Pointer position normalised to the viewport; the hero's own resting spot. */
  mx: 0.72,
  my: 0.44,
  reduce: reduceQuery.matches,
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
    env.scrollP = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
    listeners.forEach((fn) => fn(env.scrollP));
  };

  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener(
    "pointermove",
    (e) => {
      env.mx = e.clientX / window.innerWidth;
      env.my = e.clientY / window.innerHeight;
    },
    { passive: true }
  );
  reduceQuery.addEventListener("change", (e) => {
    env.reduce = e.matches;
  });

  readScroll();
}
