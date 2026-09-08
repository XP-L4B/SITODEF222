/* Site configuration — the values a deploy needs to change. */

/* Bumped on each deploy. Shown by the ?debug overlay, so there is never any
   doubt about which version a device has in front of it. */
export const BUILD = "2026-09-08.10";

/* Where the "Possibile formato" request is posted.
   export const FORM_ENDPOINT = "https://formspree.io/f/xyzabcde";
   CONTACT_EMAIL, so the page is useful before any backend exists.
   Set it to a form endpoint (your own handler, Formspree, Basin, …) that
   accepts a JSON POST and the form submits there instead. */
export const FORM_ENDPOINT = "";

/* Where requests should land, and the mailto fallback recipient. */
export const CONTACT_EMAIL = "info@xpl4b.com";

/* Gamification: XP awarded per badge — the six add up to a full bar. */
export const XP = {
  scout: 10,
  roll: 15,
  ast: 10,
  open: 15,
  conf: 30,
  send: 20,
};

/* Asteroids: milliseconds between passes, picked at random in this range. */
export const ASTEROID_INTERVAL = [10000, 15000];

/* How long after load the first asteroid appears. */
export const ASTEROID_FIRST_DELAY = 6000;
