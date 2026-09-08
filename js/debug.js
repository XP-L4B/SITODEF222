/* On-device diagnostics.

   Dormant unless the URL carries ?debug — then a small readout sits in the
   corner reporting what the background is actually doing. A phone has no
   console you can open, so this is how a fault on a real device gets
   described in numbers rather than impressions.

   Everything it shows is read-only; it changes nothing about how the page
   behaves. */

import { health } from "./canvas-health.js";
import { BUILD } from "./config.js";
import { env } from "./env.js";

export function initDebug() {
  if (!/[?&]debug\b/.test(window.location.search)) return;

  const box = document.createElement("div");
  box.style.cssText = [
    "position:fixed",
    "left:6px",
    "bottom:6px",
    "z-index:9999",
    "max-width:calc(100vw - 12px)",
    "padding:7px 9px",
    "border-radius:6px",
    "background:rgba(0,0,0,.82)",
    "color:#65BFB0",
    "font:11px/1.45 ui-monospace,Menlo,monospace",
    "white-space:pre",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(box);

  let lastError = "—";
  window.addEventListener("error", (e) => {
    lastError = `${e.message} @ ${String(e.filename).split("/").pop()}:${e.lineno}`;
  });
  window.addEventListener("unhandledrejection", (e) => {
    lastError = `promise: ${e.reason}`;
  });

  // frames per second, measured independently of the background's own loop —
  // if this reads 0 the loop is not running; if it reads 60 and the screen is
  // still dark, the loop is fine and something else is hiding the canvas
  let frames = 0;
  let fps = 0;
  const tick = () => {
    frames++;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setInterval(() => {
    fps = frames;
    frames = 0;
  }, 1000);

  const size = (id) => {
    const c = document.getElementById(id);
    if (!c) return "missing";
    const r = c.getBoundingClientRect();
    return `${c.width}x${c.height} css ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.top)}`;
  };

  // how much of the background canvas is actually painted right now
  const painted = () => {
    const c = document.getElementById("bg-canvas");
    if (!c || !c.width) return "n/a";
    try {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 997) {
        n++;
        if (d[i] > 0) lit++;
      }
      return `${Math.round((100 * lit) / n)}%`;
    } catch (e) {
      return "unreadable";
    }
  };

  setInterval(() => {
    const c = document.getElementById("bg-canvas");
    const vis = c ? getComputedStyle(c) : null;
    box.textContent = [
      `build ${BUILD}`,
      `fps ${fps}  painted ${painted()}`,
      `bg  ${size("bg-canvas")}`,
      `die ${size("die-canvas")}`,
      vis ? `vis ${vis.visibility}/${vis.display}/op${vis.opacity}/z${vis.zIndex}` : "vis n/a",
      `lost ${health.lost} restored ${health.restored} revives ${health.revives}`,
      `scrollP ${env.scrollP.toFixed(2)}  scrollY ${Math.round(window.scrollY)}`,
      `vh ${window.innerHeight}  vv ${Math.round(window.visualViewport?.height || 0)}`,
      `reduce ${env.reduce}  coarse ${!env.finePointer}`,
      `err ${lastError}`,
    ].join("\n");
  }, 500);
}
