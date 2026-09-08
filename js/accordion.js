/* The two service catalogues.

   A button per activity, its description in the panel below. The panel is
   measured before it opens rather than capped at a guessed height, so the long
   entries — team building, eSports — never clip, at any column width or in
   either language. */

import { award } from "./gamification.js";

export function initAccordion() {
  const triggers = Array.from(document.querySelectorAll(".accordion__trigger"));
  if (!triggers.length) return;

  const panels = new Map();

  triggers.forEach((trigger) => {
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    panels.set(trigger, panel);

    // the panel starts collapsed; `hidden` comes off so it can animate
    panel.hidden = false;
    panel.style.maxHeight = "0px";

    trigger.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!open));
      trigger.querySelector(".accordion__tick").textContent = open ? "+" : "−";
      panel.style.maxHeight = open ? "0px" : `${panel.scrollHeight}px`;
      if (!open) award("open");
    });
  });

  // an open panel keeps fitting its text when the column or the language changes
  const remeasure = () => {
    panels.forEach((panel, trigger) => {
      if (trigger.getAttribute("aria-expanded") === "true") {
        panel.style.maxHeight = `${panel.scrollHeight}px`;
      }
    });
  };

  window.addEventListener("resize", remeasure);
  document.addEventListener("languagechange", () => requestAnimationFrame(remeasure));
}
