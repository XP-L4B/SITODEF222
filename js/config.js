/* Site configuration — the values a deploy needs to change. */

/* Bumped on each deploy. Shown by the ?debug overlay, so there is never any
   doubt about which version a device has in front of it. */
export const BUILD = "2026-09-08.11";

/* Where the "Possibile formato" request is posted. Any URL that accepts a
   JSON POST — a form service or your own handler. Left empty, the form falls
   back to opening a prefilled mail to CONTACT_EMAIL instead, so the page is
   still useful with no backend at all.

   This is the line to edit: a value written into the comment above changes
   nothing, and the form goes on falling back to mail without saying so. */
export const FORM_ENDPOINT = "https://formspree.io/f/xoeqppow";

/* Where requests land: the address the page promises under the form, the
   one the failure message points at, and the mailto fallback recipient. It
   must match the recipient configured at the form service. */
export const CONTACT_EMAIL = "riccardo@xpl4b.com";

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
