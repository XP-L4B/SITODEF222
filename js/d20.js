/* The hero d20.

   A real icosahedron drawn in lines, its twenty numbers laid into the plane of
   their own triangle so they turn, tilt and foreshorten with the face and
   travel with it when the die comes apart. Opposite faces sum to 21, as on a
   physical die.

   Rolling: the faces separate along their normals, the die spins, then it
   reassembles and slows to bring the rolled face to the camera — upright, not
   at a random tilt, because the final orientation composes a spin about the
   view axis from the face's own "towards the apex" direction. Under
   prefers-reduced-motion the same thing happens in a quarter of a second with
   no idle rotation. */

import { keepCanvasAlive, onSurfaceChange, startFrameLoop } from "./canvas-health.js";
import { env } from "./env.js";
import { award } from "./gamification.js";
import { t } from "./i18n.js";

// One line per face: the number rolled decides which one you get.
const QUOTES = [
  { it: "Nessuno legge il manuale, tutti leggono la classifica. Progetta la classifica.",
    en: "Nobody reads the manual, everybody reads the leaderboard. Design the leaderboard." },
  { it: "Se il corso è obbligatorio, hai già perso. La presenza non è attenzione.",
    en: "If the course is mandatory, you have already lost. Attendance is not attention." },
  { it: "Le riunioni si allungano fino a riempire il tempo disponibile. Accorcia il tempo disponibile.",
    en: "Meetings stretch to fill the time available. Shorten the time available." },
  { it: "Il feedback dato una volta l'anno non è feedback: è un verbale.",
    en: "Feedback given once a year is not feedback: it is minutes." },
  { it: "Chi non sbaglia mai in formazione, sbaglierà in produzione.",
    en: "Whoever never gets it wrong in training will get it wrong in production." },
  { it: "Un obiettivo che nessuno sa misurare è un desiderio con una scadenza.",
    en: "A target nobody can measure is a wish with a deadline." },
  { it: "Le persone non resistono al cambiamento. Resistono a subirlo.",
    en: "People do not resist change. They resist having it done to them." },
  { it: "L'onboarding finisce quando il nuovo assunto sa a chi chiedere, non quando ha firmato.",
    en: "Onboarding ends when the new hire knows who to ask, not when they have signed." },
  { it: "Il team building non crea fiducia. La crea vedere qualcuno mantenere una promessa.",
    en: "Team building does not create trust. Watching someone keep a promise does." },
  { it: "Se il processo funziona solo con la persona giusta, non è un processo.",
    en: "If the process only works with the right person, it is not a process." },
  { it: "Il talento smette di cercare formazione e inizia a cercare offerte di lavoro.",
    en: "Talent stops looking for training and starts looking for job ads." },
  { it: "Delegare senza dare il potere di decidere si chiama scaricare.",
    en: "Delegating without handing over the decision is called dumping." },
  { it: "Le competenze soft si allenano con esercizi, non con presentazioni sulle competenze soft.",
    en: "Soft skills are trained with exercises, not with slide decks about soft skills." },
  { it: "Un dipendente che non fa domande non ha capito. O ha capito che è meglio non chiederle.",
    en: "An employee who asks no questions has not understood. Or has understood that it is better not to ask." },
  { it: "La riunione che poteva essere una mail costa più della mail che nessuno leggerà.",
    en: "The meeting that could have been an email costs more than the email nobody will read." },
  { it: "Chi misura solo l'output ottiene output. Chi misura anche il come, ottiene un metodo.",
    en: "Measure only the output and you get output. Measure the how as well and you get a method." },
  { it: "Il turnover non è un problema di stipendi. Lo scopri quando alzi gli stipendi.",
    en: "Turnover is not a pay problem. You find that out when you raise the pay." },
  { it: "Premiare i risultati e ignorare i comportamenti insegna che il come non conta.",
    en: "Rewarding results and ignoring behaviour teaches that the how does not count." },
  { it: "Un errore raccontato in pubblico vale dieci corsi. Se chi lo racconta resta al suo posto.",
    en: "A mistake told in public is worth ten courses. As long as whoever tells it keeps their job." },
  { it: "La motivazione dura una settimana. L'abitudine dura un trimestre. Progetta abitudini.",
    en: "Motivation lasts a week. A habit lasts a quarter. Design habits." },
];

const IDLE_QUOTE = {
  it: "Venti facce, venti formati possibili. Provane uno.",
  en: "Twenty faces, twenty possible formats. Try one.",
};

/* ── quaternion helpers ─────────────────────────────────────────────────── */

const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];

const qnorm = (q) => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};

const qaxis = (axis, angle) => {
  const s = Math.sin(angle / 2);
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  return [Math.cos(angle / 2), (axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s];
};

const qslerp = (a, b, t) => {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b.slice();
  if (dot < 0) {
    bb = b.map((x) => -x);
    dot = -dot;
  }
  if (dot > 0.9995) return qnorm(a.map((x, i) => x + (bb[i] - x) * t));
  const th = Math.acos(dot);
  const s = Math.sin(th);
  const w1 = Math.sin((1 - t) * th) / s;
  const w2 = Math.sin(t * th) / s;
  return [
    a[0] * w1 + bb[0] * w2,
    a[1] * w1 + bb[1] * w2,
    a[2] * w1 + bb[2] * w2,
    a[3] * w1 + bb[3] * w2,
  ];
};

const qrot = (q, v) => {
  const [w, x, y, z] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
};

/** The rotation that brings a face normal to the camera. */
const qToFace = (n) => {
  const dot = n[2];
  if (dot > 0.99999) return [1, 0, 0, 0];
  if (dot < -0.99999) return [0, 1, 0, 0];
  const axis = [n[1], -n[0], 0]; // n × (0,0,1)
  return qnorm([1 + dot, axis[0], axis[1], axis[2]]);
};

/* ── geometry ───────────────────────────────────────────────────────────── */

function buildIcosahedron() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const V = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map((v) => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  });

  const dist = (a, b) => Math.hypot(V[a][0] - V[b][0], V[a][1] - V[b][1], V[a][2] - V[b][2]);
  const edge = dist(0, 1);

  const faces = [];
  for (let i = 0; i < 12; i++) {
    for (let j = i + 1; j < 12; j++) {
      for (let k = j + 1; k < 12; k++) {
        if (
          Math.abs(dist(i, j) - edge) < 1e-6 &&
          Math.abs(dist(j, k) - edge) < 1e-6 &&
          Math.abs(dist(i, k) - edge) < 1e-6
        ) {
          faces.push([i, j, k]);
        }
      }
    }
  }

  const normals = faces.map((f) => {
    const p = [0, 0, 0];
    f.forEach((i) => {
      p[0] += V[i][0] / 3;
      p[1] += V[i][1] / 3;
      p[2] += V[i][2] / 3;
    });
    const l = Math.hypot(p[0], p[1], p[2]);
    return [p[0] / l, p[1] / l, p[2] / l];
  });

  // number the faces so opposite ones sum to 21, as on a real d20
  const num = new Array(faces.length).fill(0);
  let next = 1;
  for (let i = 0; i < faces.length; i++) {
    if (num[i]) continue;
    let opposite = -1;
    let best = -2;
    for (let j = 0; j < faces.length; j++) {
      const dp = -(normals[i][0] * normals[j][0] + normals[i][1] * normals[j][1] + normals[i][2] * normals[j][2]);
      if (dp > best) {
        best = dp;
        opposite = j;
      }
    }
    num[i] = next;
    num[opposite] = 21 - next;
    next++;
  }

  return { V, faces, normals, num };
}

/** In-plane basis of a face: `u` along an edge, `v` towards the opposite vertex. */
function faceBasis(a, b, c, n) {
  let u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ul = Math.hypot(u[0], u[1], u[2]) || 1;
  u = [u[0] / ul, u[1] / ul, u[2] / ul];

  let v = [
    n[1] * u[2] - n[2] * u[1],
    n[2] * u[0] - n[0] * u[2],
    n[0] * u[1] - n[1] * u[0],
  ];

  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const toApex = [c[0] - mid[0], c[1] - mid[1], c[2] - mid[2]];
  if (v[0] * toApex[0] + v[1] * toApex[1] + v[2] * toApex[2] < 0) {
    u = [-u[0], -u[1], -u[2]];
    v = [-v[0], -v[1], -v[2]];
  }
  return { u, v };
}

/* ── the component ──────────────────────────────────────────────────────── */

export function initDie(canvas, button, quoteEl) {
  if (!canvas || !button) return;

  const ctx = canvas.getContext("2d");
  const { V, faces, normals, num } = buildIcosahedron();

  const die = { q: qnorm([1, 0.22, 0.38, 0.1]), roll: null };
  let rolled = null; // the last number rolled, for the quote

  let w = 0;
  let h = 0;
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth || 268;
    h = canvas.clientHeight || 268;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  onSurfaceChange(resize);
  keepCanvasAlive(canvas, () => resize());

  let last = performance.now();

  const draw = () => {
    const now = performance.now();
    const dt = Math.min(48, now - last);
    last = now;

    let expl = 0;
    let glow = 0;

    if (die.roll) {
      const t01 = (now - die.roll.t0) / die.roll.dur;
      if (t01 >= 1) {
        die.q = die.roll.to;
        die.roll = null;
      } else {
        const e = t01 < 0.34 ? t01 / 0.34 : 1 - (t01 - 0.34) / 0.66;
        expl = Math.sin(Math.min(1, Math.max(0, e)) * (Math.PI / 2));
        const st = t01 < 0.28 ? 0 : (t01 - 0.28) / 0.72;
        const ease = 1 - Math.pow(1 - st, 3);
        die.q = die.roll.spin
          ? qmul(qslerp(die.roll.from, die.roll.to, ease), qaxis([0, 0, 1], (1 - ease) * die.roll.spin))
          : qslerp(die.roll.from, die.roll.to, ease);
        glow = 1 - st;
      }
    } else if (!env.reduce) {
      die.q = qmul(die.q, qaxis([0.35, 1, 0.18], dt * 0.00042));
    }

    ctx.clearRect(0, 0, w, h);

    const R = Math.min(w, h) * 0.31;
    const cx = w / 2;
    const cy = h / 2 - 6;

    const rv = V.map((v) => qrot(die.q, v));
    const rn = normals.map((n) => qrot(die.q, n));

    const project = (p, off) => {
      const x = p[0] + off[0];
      const y = p[1] + off[1];
      const z = p[2] + off[2];
      const k = 3.6 / (3.6 - z * 0.7);
      return [cx + x * R * k, cy - y * R * k, z, k];
    };

    // paint back to front
    const order = faces.map((_, i) => i).sort((a, b) => rn[a][2] - rn[b][2]);
    let frontIdx = 0;
    for (let i = 1; i < rn.length; i++) if (rn[i][2] > rn[frontIdx][2]) frontIdx = i;

    order.forEach((fi) => {
      const n = rn[fi];
      const off = [n[0] * expl * 1.15, n[1] * expl * 1.15, n[2] * expl * 1.15];
      const pts = faces[fi].map((vi) => project(rv[vi], off));
      const front = n[2] > 0;
      const depth = (n[2] + 1) / 2;
      const isResult = fi === frontIdx && !die.roll;

      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();

      if (front) {
        ctx.fillStyle = isResult
          ? `rgba(101,191,176,${0.16 + glow * 0.2})`
          : `rgba(145,132,217,${0.03 + depth * 0.05})`;
        ctx.fill();
      }

      ctx.lineWidth = isResult ? 1.6 : 1;
      ctx.strokeStyle = isResult
        ? "rgba(101,191,176,.9)"
        : `rgba(145,132,217,${front ? 0.2 + depth * 0.55 : 0.06 + depth * 0.12})`;
      ctx.stroke();

      if (!front) return;

      // the number, drawn in the plane of its own face
      const f = faces[fi];
      const a = rv[f[0]];
      const b = rv[f[1]];
      const c = rv[f[2]];
      const { u, v } = faceBasis(a, b, c, n);

      const centre = [
        (a[0] + b[0] + c[0]) / 3 + n[0] * 0.012,
        (a[1] + b[1] + c[1]) / 3 + n[1] * 0.012,
        (a[2] + b[2] + c[2]) / 3 + n[2] * 0.012,
      ];
      const s = 0.26;
      const pc = project(centre, off);
      const pu = project([centre[0] + u[0] * s, centre[1] + u[1] * s, centre[2] + u[2] * s], off);
      const pv = project([centre[0] + v[0] * s, centre[1] + v[1] * s, centre[2] + v[2] * s], off);
      const k = (isResult ? 0.4 : 0.26) / s / 100;

      ctx.save();
      ctx.transform(
        (pu[0] - pc[0]) * k, (pu[1] - pc[1]) * k,
        -(pv[0] - pc[0]) * k, -(pv[1] - pc[1]) * k,
        pc[0], pc[1]
      );
      ctx.font = "500 100px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isResult
        ? "rgba(233,233,237,.98)"
        : `rgba(233,233,237,${0.1 + Math.pow(depth, 2.4) * 0.6})`;
      ctx.fillText(String(num[fi]), 0, 8);
      ctx.restore();
    });
  };
  startFrameLoop(draw, resize);

  function roll(n) {
    const fi = num.indexOf(n);
    if (fi < 0) return;

    // bring the face to the camera, then spin about z so the digit lands upright
    const f = faces[fi];
    const nrm = normals[fi];
    const { v: up } = faceBasis(V[f[0]], V[f[1]], V[f[2]], nrm);
    const q0 = qToFace(nrm);
    const su = qrot(q0, up);
    const to = qmul(qaxis([0, 0, 1], -Math.atan2(su[0], su[1])), q0);

    die.roll = {
      t0: performance.now(),
      dur: env.reduce ? 260 : 1500,
      from: die.q.slice(),
      to,
      spin: Math.PI * 4,
      n,
    };
  }

  function paintQuote() {
    quoteEl.textContent = rolled === null ? t(IDLE_QUOTE) : t(QUOTES[rolled - 1]);
  }

  button.addEventListener("click", () => {
    const n = 1 + Math.floor(Math.random() * 20);
    rolled = n;
    roll(n);
    paintQuote();
    award("roll");
  });

  document.addEventListener("languagechange", paintQuote);
}
