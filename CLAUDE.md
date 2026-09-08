# XP-L4B — note per Claude

## Git

Riccardo ha chiesto di **committare e pushare sempre direttamente su `main`**,
senza aprire branch di lavoro e senza chiedere conferma ogni volta.

- Lavora su `main`, committa lì e fai `git push -u origin main`.
- Niente branch `feature/…`, niente pull request, a meno che non sia lui a
  chiederle esplicitamente.
- Remote: `origin` → https://github.com/XP-L4B/SITODEF222.git

**Il sito però viene pubblicato dal branch `implement-homepage`, non da
`main`.** Finché è così, ogni push va portato anche lì, altrimenti Riccardo
non vede nulla di quello che hai fatto:

```sh
git push origin main && git push origin main:implement-homepage
```

È un fast-forward: `implement-homepage` non ha commit propri, segue `main`.
Questa cosa è già costata undici commit invisibili — le correzioni c'erano su
`main` e il telefono continuava a caricare la prima versione. Se un giorno la
pubblicazione passa a `main`, togli questa nota e il secondo push.

Resta valido il resto: prima di pushare verifica che il sito funzioni davvero
(vedi sotto), e descrivi nel messaggio di commit cosa cambia e perché.

## Il progetto

Sito statico: HTML, CSS e moduli ES. **Nessun build step, nessuna dipendenza** —
si serve la cartella e funziona. Non introdurre bundler, framework o
`package.json` senza che sia stato chiesto.

- `index.html` — la pagina e tutti i testi. L'italiano sta nell'elemento,
  l'inglese nell'attributo `data-en` accanto. Il contenuto deve restare nel
  markup: la pagina si legge e si indicizza anche senza JavaScript.
- `css/nocturne.css` — il design system Nocturne arrivato con l'handoff.
  Trattalo come sola lettura: colori, raggi, ombre e componenti si prendono da
  lì con `var(--color-*)`, `var(--radius-*)`, `.btn`, `.input`.
- `css/site.css` — tutto ciò che la pagina aggiunge. Gli unici override di brand
  sono `--brand-mint` (#65BFB0), `--brand-blue` (#2F92B3) e Orbitron.
- `js/` — un modulo per pezzo (sfondo, asteroidi, d20, mappe, gamification,
  modulo di richiesta). `js/config.js` tiene i valori che cambiano in deploy.
- `project/` — l'handoff originale di Claude Design. È il riferimento di
  progetto, **non** fa parte del sito pubblicato: non modificarlo.

## Come verificare prima di pushare

```sh
npx serve .          # poi apri la pagina in un browser
```

Le cose che si rompono più facilmente, da ricontrollare quando tocchi la
pagina: nessun errore in console, niente scroll orizzontale su mobile, gli
anchor che scavalcano l'header fisso (l'altezza è misurata a runtime in
`--header-height`), e il comportamento con `prefers-reduced-motion` attivo.

## Cose ancora aperte

- `FORM_ENDPOINT` in `js/config.js` è vuoto: il modulo di richiesta apre una
  mail precompilata a info@xpl4b.com. Va sostituito con un endpoint vero.
- La traduzione inglese, incluse le venti frasi del d20, non è stata revisionata
  da un madrelingua.
