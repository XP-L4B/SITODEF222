/* XP-L4B homepage — wiring.

   Each piece of the page is its own module; this file starts them and owns the
   two things that cut across everything: the shared scroll/pointer state and
   the Esploratore badge, which is the page noticing you have read half of it. */

import { initAccordion } from "./accordion.js";
import { initAsteroids } from "./asteroids.js";
import { initBackground } from "./background.js";
import { initDie } from "./d20.js";
import { initDebug } from "./debug.js";
import { env, initEnv, onScroll } from "./env.js";
import { initFormatForm } from "./format.js";
import { award, initGamification } from "./gamification.js";
import { initI18n } from "./i18n.js";
import { initMapViewer } from "./map-viewer.js";
import { initPeopleBand } from "./people-band.js";

/* The header wraps to two or three rows on narrow screens, and English text
   changes where it wraps, so its height is measured rather than assumed.
   Everything that has to clear it — the hero's top padding, section anchors,
   the sticky recommendation panel — reads --header-height. */
function trackHeaderHeight() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  const measure = () => {
    document.documentElement.style.setProperty("--header-height", `${header.offsetHeight}px`);
  };

  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(header);
  else window.addEventListener("resize", measure);

  document.addEventListener("languagechange", measure);
  document.fonts?.ready.then(measure);
  measure();
}

function start() {
  initEnv();
  initDebug();
  trackHeaderHeight();
  initGamification();
  initI18n(document.getElementById("lang-toggle"));

  initBackground(document.getElementById("bg-canvas"));
  initAsteroids(document.getElementById("asteroid-layer"));
  initDie(
    document.getElementById("die-canvas"),
    document.getElementById("die-button"),
    document.getElementById("die-quote")
  );
  initAccordion();
  initMapViewer();
  initPeopleBand();
  initFormatForm();

  onScroll((p) => {
    if (p > 0.45) award("scout");
  });

  // the design tool's own anchor, kept working for anyone holding an old link
  if (window.location.hash === "#configuratore") {
    document.getElementById("formato")?.scrollIntoView({
      behavior: env.reduce ? "auto" : "smooth",
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
