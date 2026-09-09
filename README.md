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
  hero-title.js         the hero heading and its shatter
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

**Where the request form goes.** `js/config.js` → `FORM_ENDPOINT`. Empty, the
form validates the address and opens a prefilled mail to `CONTACT_EMAIL`. Set
it to any URL that accepts a JSON `POST` — a form service or your own handler —
and the form posts there instead, with real sending and error states.

The body is flat and in Italian, because whoever opens it reads it in an
inbox: most form services turn each key into a line of the email, and a nested
object arrives as `[object Object]`.

```json
{
  "email": "laura.bianchi@aziendaesempio.it",
  "_subject": "Richiesta dal sito — Percorso di upskilling gamificato",
  "Formato consigliato": "Percorso di upskilling gamificato",
  "Chi sono": "PMI",
  "Cosa manca": "Competenze",
  "Dove": "Ibrido",
  "Quante persone": "20-80",
  "Quando": "Entro un mese",
  "Lingua del sito": "italiano",
  "Pagina": "https://www.xpl4b.com/",
  "Inviato": "2026-09-08T20:36:00.500Z"
}
```

`_subject` is the convention Formspree and similar services use for the
subject line; a service that does not know it just treats it as one more
field. `email` first is deliberate too — that is the field those services read
to set the reply-to, so hitting reply answers the person who wrote in.

`CONTACT_EMAIL` beside it is the address the page promises under the form, the
one the failure message names, and the mailto fallback recipient. Keep it equal
to the recipient configured at the form service: otherwise the page promises
one inbox while the requests arrive at another.

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
- **The title.** The hero heading is split into letters and each letter into
  clipped shards. One value drives them, read from how far the page has
  scrolled: the pieces fly apart on the way down and reassemble on the way
  back, because it is a position and not a one-shot animation. At the very top
  the shards are hidden and an intact glyph is shown in their place — three
  clipped copies tiling a letter leave a hairline seam, and the top of the page
  is where that would be seen. With reduced motion the heading is never split
  at all.
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

## What the page is served with

A `<meta>` Content-Security-Policy in the head sets three restrictions the
page does not need and should not leave open: `object-src 'none'`,
`base-uri 'none'` and `form-action 'none'`.

`form-action` is the one that does real work. The request form carries no
`action`, because JavaScript sends it with `fetch`; without JavaScript,
pressing enter in the email field submits it natively to the page itself and
the visitor's address lands in the URL, in their history, and in the Referer
of every request the page makes afterwards — including the ones to the shop.
Blocking form submission means nothing leaves at all, and the real send is a
`fetch`, which `form-action` does not govern.

Two things this cannot do. `frame-ancestors`, which is what stops the site
being framed by someone else, is ignored in a meta tag and needs a response
header — GitHub Pages does not let you set one, so it would take a proxy in
front (a custom domain behind Cloudflare, say). And a full policy —
`script-src 'self'` and the rest — would mean allow-listing the form endpoint
in the markup as well as setting it in `js/config.js`: two places that have to
agree, in a project where the endpoint has already been lost once. It is worth
doing the day this page grows a third-party script; today it would buy little
and cost a trap.

**Everything in the repository root is published.** Pages serves the branch as
it is and `.nojekyll` turns off the only step that could exclude anything, so
`project/`, `chats/`, `art/`, `tools/`, `CLAUDE.md` and this file are all
reachable on the live domain. Nothing there is a credential, but the design
handoff, the working notes and the PDFs under `project/uploads/` are internal
material. To publish only the site, Pages has to move from "deploy from a
branch" to a GitHub Actions workflow that copies the site files and nothing
else — a change to how deploys work, and worth making deliberately.

## Notes for review

- **English.** The English half of the site — including the twenty d20 lines —
  is a translation that has not been reviewed by a native speaker.
- **The statistics** (+50%, +60%, 72%) are attributed to Salesforce in the page,
  as in the design. The specific report is not cited.
- **The `#configuratore` anchor** from the prototype now reads `#formato`, to
  match the section's name. Old links still land in the right place —
  `js/main.js` catches the old hash.
