/* XP bar, level, badges and the asteroid score.

   Every badge is tied to something the visitor actually did on the page —
   reading half of it, rolling the die, opening an activity, answering the five
   questions, sending the request — and the state survives a reload, so a
   returning visitor picks up where they left off. */

import { XP } from "./config.js";
import { t } from "./i18n.js";

const STORAGE_KEY = "xpl4b_progress";
const MAX_XP = 100;

const BADGES = {
  scout: { glyph: "◇", name: { it: "Esploratore", en: "Explorer" } },
  roll: { glyph: "◆", name: { it: "Giocatore", en: "Player" } },
  ast: { glyph: "✦", name: { it: "Artigliere", en: "Gunner" } },
  open: { glyph: "▲", name: { it: "Stratega", en: "Strategist" } },
  conf: { glyph: "◈", name: { it: "Architetto", en: "Architect" } },
  send: { glyph: "★", name: { it: "Player One", en: "Player One" } },
};

const state = { xp: 0, score: 0, done: {} };

let els = {};
let toastTimer = 0;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return;

    /* Storage holds whatever it holds: an older shape of this state, another
       page on the same domain, a value half written when a tab was closed.
       Taken as read, a string where the badges belong throws on the next
       award — "cannot create property on string" — and leaves the header at
       LV NaN with the bar empty and no way back, because the code that would
       save a good value never runs. So each field is used only if it is the
       right kind of thing, and anything else starts again from zero. */
    const xp = Number(saved.xp);
    const score = Number(saved.score);
    state.xp = Number.isFinite(xp) ? Math.min(MAX_XP, Math.max(0, xp)) : 0;
    state.score = Number.isFinite(score) ? Math.max(0, score) : 0;
    state.done = saved.done && typeof saved.done === "object" ? saved.done : {};
  } catch (e) {
    /* corrupt or unavailable storage — start fresh */
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* private mode — progress just does not persist */
  }
}

function paint() {
  const level = Math.max(1, Math.ceil(state.xp / 20));

  els.level.textContent = `LV ${level}`;
  els.barFill.style.width = `${state.xp}%`;
  els.bar.setAttribute("aria-valuenow", String(state.xp));
  els.scoreValue.textContent = String(state.score);
  els.score.classList.toggle("is-scoring", state.score > 0);

  els.badges.forEach((el) => {
    const unlocked = !!state.done[el.dataset.badge];
    el.classList.toggle("is-unlocked", unlocked);
    const stateLabel = el.querySelector(".badge__state");
    if (stateLabel) {
      stateLabel.textContent = unlocked
        ? t({ it: "sbloccato", en: "unlocked" })
        : t({ it: "bloccato", en: "locked" });
    }
  });
}

export function toast(glyph, kicker, text) {
  const el = els.toast;
  el.hidden = false;
  els.toastGlyph.textContent = glyph;
  els.toastKicker.textContent = kicker;
  els.toastText.textContent = text;

  // restart the pop animation even if a toast is already on screen
  el.style.animation = "none";
  void el.offsetWidth;
  el.style.animation = "";

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3000);
}

/** Unlocks a badge once. Repeat calls for the same key do nothing. */
export function award(key) {
  if (state.done[key]) return;
  const badge = BADGES[key];
  if (!badge) return;

  state.done[key] = 1;
  state.xp = Math.min(MAX_XP, state.xp + (XP[key] || 0));
  save();
  paint();

  toast(
    badge.glyph,
    `+${XP[key] || 0} XP`,
    `${t({ it: "Badge sbloccato: ", en: "Badge unlocked: " })}${t(badge.name)}`
  );
}

/** Adds asteroid points to the header counter. */
export function addScore(points) {
  state.score += points;
  save();
  paint();
}

export function initGamification() {
  els = {
    level: document.getElementById("hud-level"),
    bar: document.querySelector(".hud__bar"),
    barFill: document.getElementById("hud-bar-fill"),
    score: document.getElementById("hud-score"),
    scoreValue: document.getElementById("hud-score-value"),
    badges: Array.from(document.querySelectorAll(".badge")),
    toast: document.getElementById("toast"),
    toastGlyph: document.getElementById("toast-glyph"),
    toastKicker: document.getElementById("toast-kicker"),
    toastText: document.getElementById("toast-text"),
  };

  load();
  paint();
  document.addEventListener("languagechange", paint);
}
