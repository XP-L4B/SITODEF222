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

  foldCatalogues(remeasure);
}

/* Below the width where the two catalogues stop sitting side by side, they are
   seventeen entries in a single column and everything after them is a long way
   down. So each one folds to its heading and a toggle.

   The fold is put on by script, and only at that width: with scripting off the
   button stays hidden and both lists are open, exactly as on a wide screen.
   Once open the height goes back to `none`, so an entry opened inside a folded
   catalogue grows it instead of being cut off by a number measured before. */
function foldCatalogues(remeasure) {
  const narrow = window.matchMedia("(max-width: 719px)");

  document.querySelectorAll(".catalogue").forEach((catalogue) => {
    const toggle = catalogue.querySelector(".catalogue__toggle");
    const body = catalogue.querySelector(".catalogue__body");
    if (!toggle || !body) return;

    const tick = toggle.querySelector(".catalogue__toggle-tick");

    const setOpen = (open, animate) => {
      toggle.setAttribute("aria-expanded", String(open));
      if (tick) tick.textContent = open ? "−" : "+";

      if (!animate) {
        body.style.maxHeight = open ? "none" : "0px";
        return;
      }
      if (open) {
        body.style.maxHeight = `${body.scrollHeight}px`;
        body.addEventListener(
          "transitionend",
          () => {
            if (toggle.getAttribute("aria-expanded") === "true") body.style.maxHeight = "none";
          },
          { once: true }
        );
      } else {
        // from `none` there is nothing to animate away from, so the current
        // height is written first and the collapse starts on the next frame
        body.style.maxHeight = `${body.scrollHeight}px`;
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
        });
      }
    };

    const apply = () => {
      if (narrow.matches) {
        catalogue.classList.add("is-folded");
        toggle.hidden = false;
        setOpen(false, false);
      } else {
        catalogue.classList.remove("is-folded");
        toggle.hidden = true;
        body.style.maxHeight = "";
        remeasure();
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true", true);
    });

    narrow.addEventListener("change", apply);
    apply();
  });
}
