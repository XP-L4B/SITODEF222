/* The fixed background.

   One continuous environment rather than a stack of section treatments: a
   wireframe icosahedron whose twelve vertices start scattered and assemble as
   the page scrolls, star dust that drifts with the scroll and is pushed away
   from the pointer — the grains inside its reach wire themselves into
   temporary constellations — and a palette that walks from the brand purple
   through blue to teal over the length of the document.

   Everything is driven by scroll position, so it runs backwards as readily as
   forwards. With prefers-reduced-motion the idle drift stops and the scene
   only answers the scroll. */

import { env } from "./env.js";

const RESTING_X = 0.72;
const RESTING_Y = 0.44;

// purple → blue → teal, the accent and the two brand colours
const PALETTE = [
  [145, 132, 217],
  [47, 146, 179],
  [101, 191, 176],
];

const lerp = (a, b, m) => a + (b - a) * m;

function mixPalette(p) {
  const scaled = p * 2;
  const i = Math.min(1, Math.floor(scaled));
  const f = scaled - i;
  const a = PALETTE[i];
  const b = PALETTE[Math.min(2, i + 1)];
  return [
    Math.round(lerp(a[0], b[0], f)),
    Math.round(lerp(a[1], b[1], f)),
    Math.round(lerp(a[2], b[2], f)),
  ];
}

export function initBackground(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const phi = (1 + Math.sqrt(5)) / 2;
  const V = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ];

  const E = [];
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      const d = Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
      if (d < 2.1) E.push([i, j]);
    }
  }

  // where each vertex sits before the shape has assembled
  const scatter = V.map(() => [
    (Math.random() - 0.5) * 7,
    (Math.random() - 0.5) * 7,
    (Math.random() - 0.5) * 7,
  ]);

  const dust = Array.from({ length: 110 }, () => ({
    bx: Math.random(),
    by: Math.random(),
    z: 0.3 + Math.random(),
    r: Math.random() * 1.6 + 0.4,
    ox: 0,
    oy: 0,
  }));

  let w = 0;
  let h = 0;
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  let time = 0;
  let smx = RESTING_X;
  let smy = RESTING_Y;

  const draw = () => {
    const interactive = !env.reduce;
    time += env.reduce ? 0 : 0.004;

    const p = env.scrollP || 0;
    const targetX = interactive ? env.mx : RESTING_X;
    const targetY = interactive ? env.my : RESTING_Y;
    smx += (targetX - smx) * 0.06;
    smy += (targetY - smy) * 0.06;

    ctx.clearRect(0, 0, w, h);

    const col = mixPalette(p);
    const rgb = col.join(",");

    // the glow follows the pointer
    const glow = ctx.createRadialGradient(smx * w, smy * h, 0, smx * w, smy * h, Math.max(w, h) * 0.8);
    glow.addColorStop(0, `rgba(${rgb},0.16)`);
    glow.addColorStop(1, "rgba(22,24,38,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // ── the d20 wireframe ──
    const cx = w * 0.72 + (smx - 0.5) * w * 0.06;
    const cy = h * 0.44 + (smy - 0.5) * h * 0.08;
    const R = Math.min(w, h) * (0.19 + Math.sin(p * Math.PI) * 0.09);
    const ax = p * 3.2 + time + (smy - 0.5) * 1.2;
    const ay = p * 2.1 + time * 0.7 + (smx - 0.5) * 1.6;
    const assembly = Math.min(1, Math.max(0, (p - 0.02) * 3.4));

    const pts = V.map((v, i) => {
      const sx = lerp(v[0] + scatter[i][0], v[0], assembly);
      const sy = lerp(v[1] + scatter[i][1], v[1], assembly);
      const sz = lerp(v[2] + scatter[i][2], v[2], assembly);
      let x = sx * Math.cos(ay) - sz * Math.sin(ay);
      let z = sx * Math.sin(ay) + sz * Math.cos(ay);
      const y = sy * Math.cos(ax) - z * Math.sin(ax);
      z = sy * Math.sin(ax) + z * Math.cos(ax);
      const k = 3.4 / (3.4 + z * 0.42);
      return [cx + x * R * k * 0.5, cy + y * R * k * 0.5, k];
    });

    ctx.lineWidth = 1;
    E.forEach(([i, j]) => {
      const a = pts[i];
      const b = pts[j];
      ctx.strokeStyle = `rgba(${rgb},${0.05 + 0.28 * assembly * ((a[2] + b[2]) / 2 - 0.7)})`;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });

    pts.forEach((a) => {
      ctx.fillStyle = `rgba(${rgb},${0.15 + 0.5 * (a[2] - 0.7)})`;
      ctx.beginPath();
      ctx.arc(a[0], a[1], 1.8 * a[2], 0, Math.PI * 2);
      ctx.fill();
    });

    // ── star dust, repelled by the pointer ──
    const px = smx * w;
    const py = smy * h;
    const reach = interactive ? Math.min(w, h) * 0.26 : 0;
    const near = [];

    dust.forEach((d) => {
      const bx = d.bx * w;
      const by = ((((d.by - p * d.z * 0.55) % 1) + 1) % 1) * h;
      const dx = bx - px;
      const dy = by - py;
      const dist = Math.hypot(dx, dy) || 1;
      const push = dist < reach ? (1 - dist / reach) * 46 * d.z : 0;

      d.ox += ((dx / dist) * push - d.ox) * 0.09;
      d.oy += ((dy / dist) * push - d.oy) * 0.09;

      const x = bx + d.ox;
      const y = by + d.oy;
      ctx.fillStyle = `rgba(${rgb},${0.1 + d.z * 0.16 + (push > 0 ? 0.2 : 0)})`;
      ctx.beginPath();
      ctx.arc(x, y, d.r * d.z * (push > 0 ? 1.5 : 1), 0, Math.PI * 2);
      ctx.fill();

      if (dist < reach) near.push([x, y, 1 - dist / reach]);
    });

    // grains within reach of each other wire up
    near.forEach(([x, y, s], i) => {
      for (let j = i + 1; j < near.length; j++) {
        const o = near[j];
        const dd = Math.hypot(x - o[0], y - o[1]);
        if (dd < 110) {
          ctx.strokeStyle = `rgba(${rgb},${0.16 * s * o[2] * (1 - dd / 110)})`;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(o[0], o[1]);
          ctx.stroke();
        }
      }
    });

    requestAnimationFrame(draw);
  };

  requestAnimationFrame(draw);
}
