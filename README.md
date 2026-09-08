# XP-L4B — homepage

The XP-L4B homepage, built from the Claude Design handoff in `project/`.

A static site: HTML, CSS and ES modules, no build step and no dependencies.
Open `index.html` over any web server and it runs.

```sh
npx serve .          # or: python3 -m http.server
```

Deploy by copying the repository root — everything except `project/` — to any
static host.

## What is here

```
index.html              the page: every word of copy lives here, Italian in the
                        markup with English beside it in data-en attributes
css/
  fonts.css             self-hosted Inter and Orbitron
  nocturne.css          the Nocturne design system — tokens and components,
                        taken from the handoff and treated as read-only
  site.css              everything this page adds on top
js/
  config.js             the values a deploy changes: form endpoint, addresses
  main.js               wiring
  env.js                shared scroll / pointer / reduced-motion state
  i18n.js               the Italian ⇄ English switch
  gamification.js       XP, level, badges, asteroid score, toasts
  background.js         the fixed animated background
  asteroids.js          the asteroids that cross the page
  d20.js                the hero d20 and its twenty lines
  map-viewer.js         the game-map cards and their decode animation
  people-band.js        the row of workers that walks with the scroll
  accordion.js          the two service catalogues
  format.js             the five questions, the recommendation and the form
  canvas-health.js      keeps the canvases alive when iOS reclaims them
  debug.js              the ?debug readout, inert without the parameter
assets/                 images, fonts, and the cut-out people
art/                    source artwork — not shipped, kept so the cut can be redone
tools/                  crop-people.py, which cuts the people out of the strip
project/                the original Claude Design handoff — design reference,
                        not part of the deployed site (its own instructions are
                        in project/HANDOFF.md)
```

## Things you will want to change

**Where the request form goes.** `js/config.js` → `FORM_ENDPOINT`. It is empty,
so today the form validates the address and then opens a prefilled mail to
`info@xpl4b.com` with the five answers and the recommended format in the body.
Set `FORM_ENDPOINT` to any handler that accepts a JSON `POST` and the form
submits there instead, with real sending / error states. The payload is:

```json
{
  "email": "nome@azienda.it",
  "lang": "it",
  "answers": { "01": "PMI", "02": "Coinvolgimento", "03": "Da remoto",
               "04": "20-80", "05": "Entro un mese" },
  "recommendation": "Torneo interno e mappa personalizzata",
  "page": "https://www.xpl4b.com/",
  "sentAt": "2026-09-08T12:00:00.000Z"
}
```

**Copy.** All of it is in `index.html`. Italian is the text in the element;
English is the `data-en` attribute next to it. Text the page generates —
the d20's twenty lines, the recommendations, the map viewer's status line,
the badge toasts — sits in the module that owns it, as `{ it, en }` pairs.

**Gamification.** `js/config.js` carries the XP each badge is worth (the six add
up to a full bar) and how often asteroids come round.

**The walking people.** To recut them from a new strip:

```sh
python3 tools/crop-people.py art/personaggi-lavoro.png --expect 8 --flip 2,4,7
```

`--expect` is how many figures the strip holds — they touch each other in the
source, so the tool finds them as connected blobs and cuts the merged ones at
their thinnest column rather than looking for empty gaps. `--flip` mirrors
those figures so the procession is not all facing one way. Then list the files
in `PEOPLE` in `js/people-band.js`; an empty list hides the band.

## How the page behaves

- **Background.** One environment across the whole page rather than per-section
  treatments: a wireframe d20 that assembles as you scroll, star dust pushed
  around by the pointer, and a palette walking from the brand purple through
  blue to teal. Scroll-driven, so it runs backwards as readily as forwards.
- **Gamification.** Six badges, each tied to something actually done on the
  page. Progress, score and language are kept in `localStorage`, so a returning
  visitor picks up where they left off.
- **Reduced motion.** `prefers-reduced-motion: reduce` stops the idle rotation,
  turns off the asteroids entirely, and shortens the die roll and the map
  decode to near-instant state changes. Everything stays usable.
- **Without JavaScript.** Every word of copy, all sixteen partner logos and all
  seventeen service entries are in the markup, so the page reads and indexes
  with scripting off. The interactive parts simply do not run.
- **Keyboard.** Everything interactive is a real button, link or input, with the
  design system's focus ring and a skip link ahead of the header.
- **Diagnostics.** Add `?debug` to the URL for a readout of the build stamp,
  frame rate, canvas sizes, context-loss counters and the last error — how a
  fault on a phone gets reported in numbers rather than impressions.

## Deploying a change

`main` is the published branch: GitHub Pages builds it from the repository
root, so a push to `main` is a deploy. It is the only branch.

**`.nojekyll` must stay.** GitHub Pages runs every `.html` file through
Jekyll's Liquid templating when it publishes from a branch, and `project/`
holds three files from the design handoff with 55 `{{ … }}` placeholders each.
Jekyll fails on them, and a failed Pages build leaves the previous deploy
online — which is how a site can sit at its first version while every later
commit lands correctly in git. The empty `.nojekyll` at the root turns that
step off and the files are served as they are. It also skips rebuilding the
81MB of reference material in `project/` on every deploy.

The page also checks `version.txt` on load and, if the build it was served is
older, replaces itself with a URL the cache has never seen. That closes the
last hole: the `?v=` on the links only helps once the new HTML has arrived, and
a device holding a stale `index.html` never gets that far. It tries once per
session, recorded before the reload rather than compared against the build —
comparing would loop forever whenever the reload still returns a cached page,
which is exactly the case it exists for.

`version.txt` carries the same build stamp. Opening it on the live site
answers "did the deploy actually happen" without depending on the page's HTML,
CSS or JavaScript being fresh.

Asset URLs carry a version — `css/site.css?v=2026-09-08.6` — so a browser
cannot serve a stale stylesheet after a deploy. Bump it in two places when you
ship: the `?v=` on the links in `index.html`, and `BUILD` in `js/config.js`,
which is what `?debug` reports. They should match, so the readout on a device
tells you exactly which version that device is running.

Static imports inside the JS modules do not carry the version, so a change to
a module other than `main.js` can still be served from cache for as long as
the host's max-age (ten minutes on GitHub Pages).

## Notes for review

- **English.** The English half of the site — including the twenty d20 lines —
  is a translation that has not been reviewed by a native speaker.
- **The statistics** (+50%, +60%, 72%) are attributed to Salesforce in the page,
  as in the design. The specific report is not cited.
- **The `#configuratore` anchor** from the prototype now reads `#formato`, to
  match the section's name. Old links still land in the right place —
  `js/main.js` catches the old hash.
