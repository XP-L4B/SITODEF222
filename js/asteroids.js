/* Asteroids.

   Every ten to fifteen seconds a wireframe rock crosses the viewport — in from
   any of the four edges, out at an independent point, so most routes are
   diagonal. Click it and it bursts: a floating "+N", points added to the
   counter in the header, and the Artigliere badge the first time.

   The layer sits above the page but is transparent to the pointer; only the
   rocks themselves take clicks. Off entirely under prefers-reduced-motion. */

import { ASTEROID_FIRST_DELAY, ASTEROID_INTERVAL } from "./config.js";
import { env } from "./env.js";
import { addScore, award } from "./gamification.js";

const STROKE = "#9184d9";

function rockShape() {
  const points = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 38 + Math.random() * 12;
    points.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`);
  }
  return points.join(" ");
}

function spawn(layer) {
  if (!layer || document.hidden || env.reduce) return;

  const size = 32 + Math.round(Math.random() * 22);
  const shape = rockShape();

  const el = document.createElement("div");
  el.className = "asteroid";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.innerHTML =
    `<svg viewBox="0 0 100 100" width="100%" height="100%">` +
    `<polygon points="${shape}" fill="none" stroke="${STROKE}" stroke-width="2.2" opacity=".85"></polygon>` +
    `<polygon points="${shape}" fill="${STROKE}" opacity=".07"></polygon>` +
    `<circle cx="38" cy="42" r="6" fill="none" stroke="${STROKE}" stroke-width="1.6" opacity=".5"></circle>` +
    `<circle cx="62" cy="60" r="3.4" fill="none" stroke="${STROKE}" stroke-width="1.6" opacity=".4"></circle>` +
    `<g style="transform-origin:50px 50px"><line x1="-76" y1="50" x2="-8" y2="50" stroke="${STROKE}" stroke-width="1.4" opacity=".22"></line></g>` +
    `</svg>`;

  const trail = el.querySelector("g");
  layer.appendChild(el);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const off = size + 110;
  const edge = Math.floor(Math.random() * 4);
  const span = (n) => (0.1 + Math.random() * 0.8) * n;

  let x0;
  let y0;
  let x1;
  let y1;
  if (edge === 0) {
    x0 = -off; y0 = span(H); x1 = W + off; y1 = span(H);
  } else if (edge === 1) {
    x0 = W + off; y0 = span(H); x1 = -off; y1 = span(H);
  } else if (edge === 2) {
    x0 = span(W); y0 = -off; x1 = span(W); y1 = H + off;
  } else {
    x0 = span(W); y0 = H + off; x1 = span(W); y1 = -off;
  }

  const dir = x1 >= x0 ? 1 : -1;
  const dur = 11000 + Math.random() * 4000;
  const spin = (Math.random() < 0.5 ? -1 : 1) * (420 + Math.random() * 560);
  const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
  const trailAngle = dir > 0 ? ang : ang - 180;
  const drift = (Math.random() - 0.5) * 2;
  const t0 = performance.now();
  let alive = true;

  const step = (now) => {
    if (!alive) return;
    const p = (now - t0) / dur;
    if (p >= 1) {
      el.remove();
      return;
    }
    const wobble = Math.sin(p * 5) * 14;
    const x = x0 + (x1 - x0) * p - Math.sin((ang * Math.PI) / 180) * wobble * drift;
    const y = y0 + (y1 - y0) * p + Math.cos((ang * Math.PI) / 180) * wobble * drift;
    el.style.transform = `translate(${x}px,${y}px) rotate(${spin * p}deg) scaleX(${dir})`;
    trail.style.transform = `rotate(${trailAngle - spin * p}deg)`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);

  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    alive = false;
    el.style.pointerEvents = "none";

    const points = 10 + Math.round((80 - size) / 8);
    addScore(points);

    const at = el.style.transform;
    el.animate(
      [
        { transform: `${at} scale(1)`, opacity: 1 },
        { transform: `${at} scale(1.9)`, opacity: 0 },
      ],
      { duration: 420, easing: "ease-out" }
    ).onfinish = () => el.remove();

    const float = document.createElement("div");
    float.className = "asteroid__score";
    float.textContent = `+${points}`;
    float.style.left = `${e.clientX}px`;
    float.style.top = `${e.clientY}px`;
    layer.appendChild(float);
    setTimeout(() => float.remove(), 950);

    award("ast");
  });
}

export function initAsteroids(layer) {
  if (!layer) return;
  const [min, max] = ASTEROID_INTERVAL;

  const schedule = (delay) =>
    setTimeout(() => {
      spawn(layer);
      schedule(min + Math.random() * (max - min));
    }, delay);

  schedule(ASTEROID_FIRST_DELAY);
}
