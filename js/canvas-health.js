/* Keeping a canvas alive on iOS.

   WebKit reclaims 2D canvas backing stores under memory pressure. When it
   does, the context is lost, every later draw call is silently ignored, and
   the canvas stays blank for good — the page carries on working, the
   animation loop carries on running, and nothing ever appears again. This is
   the usual reason a canvas background "disappears and does not come back" on
   an iPhone.

   Since iOS 16.4 WebKit announces it with contextlost / contextrestored, but
   it only restores a context whose loss event was cancelled. Older WebKit
   announces nothing at all, so a watchdog checks the loop is still producing
   frames and restarts it when it is not — whatever stopped it.

   Between them these cover the failure without needing to know which flavour
   of it a given device has. */

/* Counters the debug overlay reads, so a phone can report what happened
   instead of the person holding it having to describe it. */
export const health = { lost: 0, restored: 0, revives: 0 };

/** Cancels context loss so the browser restores it, and redraws after. */
export function keepCanvasAlive(canvas, onRestore) {
  if (!canvas) return;
  // Cancelling is what asks for a restore; without it the loss is permanent.
  canvas.addEventListener("contextlost", (e) => {
    health.lost++;
    e.preventDefault();
  });
  canvas.addEventListener("contextrestored", () => {
    health.restored++;
    onRestore();
  });
}

/**
 * Runs `draw` every frame and keeps it running.
 *
 * The next frame is asked for before the drawing, so an exception cannot end
 * the loop; a generation counter means a restart never leaves two loops
 * running; and a watchdog restarts it if frames stop arriving while the page
 * is on screen — which is what a lost context, a suspended tab or a hostile
 * compositor all look like from here.
 *
 * @param {() => void} draw  paints one frame
 * @param {() => void} reset re-sizes and re-prepares the surface
 */
export function startFrameLoop(draw, reset) {
  let generation = 0;
  let lastFrameAt = performance.now();

  const start = () => {
    const mine = ++generation;
    const frame = () => {
      if (mine !== generation) return; // a newer loop has taken over
      requestAnimationFrame(frame);
      lastFrameAt = performance.now();
      draw();
    };
    requestAnimationFrame(frame);
  };

  const revive = () => {
    health.revives++;
    reset();
    start();
  };

  // Frames legitimately stop while the page is hidden, so only the visible
  // case counts as stalled.
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (performance.now() - lastFrameAt < 1500) return;
    revive();
  }, 2000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") revive();
  });
  // coming back from the back/forward cache
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) revive();
  });

  start();
  return revive;
}

/**
 * Re-sizes on everything that can change the drawing surface underneath us.
 * On iOS the visual viewport moves independently of the layout viewport as
 * the address bar collapses and during overscroll, and plain `resize` does
 * not always fire for it.
 */
export function onSurfaceChange(handler) {
  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handler);
  }
}
