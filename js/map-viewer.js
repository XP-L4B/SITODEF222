/* Custom game maps.

   Clicking a game opens a small window under the cards and the map materialises
   in it: first blocks of data light up in scattered order behind a scanline,
   then the picture resolves tile by tile with the leading edge of the front
   still glowing. The window only exists once something has been asked for.

   The animation waits for the image rather than finishing into an empty frame,
   and the three maps are prefetched shortly after load so the first click is
   already warm. */

import { env } from "./env.js";
import { award } from "./gamification.js";
import { t } from "./i18n.js";

const HUE = ["#65BFB0", "#2F92B3", "#9184d9"];

const CUES = {
  idle: { it: "▸ VEDI LA MAPPA", en: "▸ VIEW THE MAP" },
  loaded: { it: "▸ CARICATA", en: "▸ LOADED" },
  talk: { it: "▸ PARLIAMONE", en: "▸ LET'S TALK" },
};

const STATUS = {
  idle: { it: "IN ATTESA", en: "IDLE" },
  ready: { it: "PRONTA", en: "READY" },
  custom: { it: "SU MISURA", en: "CUSTOM" },
  decoding: { it: "DECODIFICA", en: "DECODING" },
};

export function initMapViewer() {
  const cards = Array.from(document.querySelectorAll(".map-card"));
  const viewer = document.getElementById("map-viewer");
  const canvas = document.getElementById("map-canvas");
  const pathEl = document.getElementById("viewer-path");
  const statusEl = document.getElementById("viewer-status");
  const askEl = document.getElementById("viewer-ask");
  if (!cards.length || !viewer || !canvas) return;

  const images = {};
  let selected = null;
  let decoding = false;
  let decodePct = 0;
  let raf = 0;
  let pendingSrc = null;

  /* ── chrome ───────────────────────────────────────────────────────────── */

  function paint() {
    cards.forEach((card) => {
      const active = card === selected;
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-expanded", String(active));
      const cue = card.querySelector(".map-card__cue");
      if (!cue) return;
      if (active) cue.textContent = t(card.dataset.image ? CUES.loaded : CUES.talk);
      else cue.textContent = t(card.dataset.image ? CUES.idle : CUES.talk);
    });

    if (!selected) {
      viewer.hidden = true;
      viewer.classList.remove("is-loaded", "is-ready");
      pathEl.textContent = "xpl4b://maps/";
      statusEl.textContent = t(STATUS.idle);
      askEl.hidden = true;
      return;
    }

    const hasImage = !!selected.dataset.image;

    viewer.hidden = false;
    viewer.classList.add("is-loaded");
    viewer.classList.toggle("is-ready", hasImage && !decoding);
    pathEl.textContent = `xpl4b://maps/${selected.dataset.path}/${selected.dataset.file}`;
    askEl.hidden = hasImage;

    if (!hasImage) statusEl.textContent = t(STATUS.custom);
    else if (decoding) statusEl.textContent = `${t(STATUS.decoding)} ${decodePct}%`;
    else statusEl.textContent = t(STATUS.ready);
  }

  /* ── the decode animation ─────────────────────────────────────────────── */

  function stopDecode() {
    cancelAnimationFrame(raf);
    raf = 0;
    pendingSrc = null;
    decoding = false;
    decodePct = 0;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function decode(src) {
    cancelAnimationFrame(raf);

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight));
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const cell = Math.max(10, Math.round(w / 44));
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    const total = cols * rows;

    // the order the tiles resolve in
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = total - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j], order[i]];
    }
    const noise = Array.from({ length: total }, () => Math.random());

    let img = images[src];
    if (!img) {
      img = new Image();
      img.src = src;
      images[src] = img;
    }
    const isReady = () => img.complete && img.naturalWidth > 0;

    const drawFinal = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#9184d9";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      ctx.globalAlpha = 1;
      decoding = false;
      decodePct = 100;
      paint();
    };

    pendingSrc = src;
    img.addEventListener("load", () => {
      if (pendingSrc === src && !raf) drawFinal();
    });

    decoding = true;
    decodePct = 0;
    paint();

    const T_SCAN = env.reduce ? 0 : 620;
    const T_FILL = env.reduce ? 1 : 1180;
    const t0 = performance.now();
    let lastPct = -1;

    const frame = (now) => {
      const elapsed = now - t0;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(22,24,38,.96)";
      ctx.fillRect(0, 0, w, h);

      if (elapsed < T_SCAN) {
        // phase 1 — data blocks aggregating behind a scanline
        const p = elapsed / T_SCAN;
        const lit = Math.round(total * p * 0.55);
        for (let i = 0; i < lit; i++) {
          const idx = order[i];
          const x = (idx % cols) * cell;
          const y = ((idx - (idx % cols)) / cols) * cell;
          const n = noise[idx];
          ctx.globalAlpha = 0.12 + n * 0.5 * (0.4 + Math.sin(elapsed / 90 + n * 9) * 0.6);
          ctx.fillStyle = HUE[idx % 3];
          ctx.fillRect(x, y, cell - 1, cell - 1);
        }
        ctx.globalAlpha = 1;

        const sy = p * h;
        const g = ctx.createLinearGradient(0, sy - 40, 0, sy + 4);
        g.addColorStop(0, "rgba(101,191,176,0)");
        g.addColorStop(1, "rgba(101,191,176,.5)");
        ctx.fillStyle = g;
        ctx.fillRect(0, sy - 40, w, 44);
      } else {
        // phase 2 — image tiles resolving in
        const p = Math.min(1, (elapsed - T_SCAN) / T_FILL);
        const shown = Math.round(total * p);
        const ready = isReady();

        if (ready) {
          const sw = img.width / cols;
          const sh = img.height / rows;
          for (let i = 0; i < shown; i++) {
            const idx = order[i];
            const gx = idx % cols;
            const gy = (idx - gx) / cols;
            ctx.drawImage(img, gx * sw, gy * sh, sw, sh, gx * cell, gy * cell, cell, cell);
          }
        }

        // the leading edge of the front still glows
        for (let i = shown; i < Math.min(total, shown + Math.round(total * 0.09)); i++) {
          const idx = order[i];
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          ctx.globalAlpha = 0.2 + noise[idx] * 0.55;
          ctx.fillStyle = HUE[idx % 3];
          ctx.fillRect(gx * cell, gy * cell, cell - 1, cell - 1);
        }
        ctx.globalAlpha = 1;

        if (p >= 1) {
          if (ready) {
            raf = 0;
            drawFinal();
            return;
          }
          // the image has not arrived — hold the front rather than finish empty
          raf = requestAnimationFrame(frame);
          return;
        }
      }

      const pct = Math.min(99, Math.round((elapsed / (T_SCAN + T_FILL)) * 100));
      if (pct !== lastPct) {
        lastPct = pct;
        decodePct = pct;
        paint();
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
  }

  /* ── wiring ───────────────────────────────────────────────────────────── */

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      selected = card;
      // paint first: the window has to be on the page before the canvas can be
      // sized from it, otherwise the decode runs into a 0×0 surface
      paint();
      if (card.dataset.image) decode(card.dataset.image);
      else stopDecode();
      paint();
      award("open");
    });
  });

  document.addEventListener("languagechange", paint);
  paint();

  // Warm the maps up so the first click has the picture in hand — but only
  // once the section is on screen, rather than spending the best part of a
  // megabyte on every visitor, most of whom never get this far.
  const prefetch = () => {
    cards.forEach((card) => {
      const src = card.dataset.image;
      if (src && !images[src]) {
        const img = new Image();
        img.src = src;
        images[src] = img;
      }
    });
  };

  const section = document.getElementById("mappe");
  if (section && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        prefetch();
      },
      { rootMargin: "400px" }
    );
    observer.observe(section);
  } else {
    setTimeout(prefetch, 1200);
  }
}
