/* "Possibile formato" — five questions, then a proposal.

   The answers narrow towards one of a handful of formats; the fifth completes
   it and the panel becomes the contact form. What it returns is a starting
   point, not a catalogue item, which is what the copy above it says.

   Submission goes to FORM_ENDPOINT when one is configured; with none set it
   falls back to opening a prefilled mail to CONTACT_EMAIL, so the form is
   useful from the first deploy. */

import { CONTACT_EMAIL, FORM_ENDPOINT, PRIVACY_URL } from "./config.js";
import { award } from "./gamification.js";
import { getLang, t } from "./i18n.js";

const IDLE = {
  title: { it: "Rispondi per vedere la proposta", en: "Answer to see the proposal" },
  body: {
    it: "Ogni risposta restringe il campo. Alla quinta ti diciamo quale formato useremmo e perché.",
    en: "Each answer narrows it down. At the fifth we tell you which format we would use and why.",
  },
};

const SUBMIT = {
  idle: { it: "VOGLIO RICEVERE INFORMAZIONI", en: "I WANT MORE INFORMATION" },
  sending: { it: "INVIO IN CORSO…", en: "SENDING…" },
  sent: { it: "RICHIESTA INVIATA", en: "REQUEST SENT" },
};

const ERRORS = {
  email: {
    it: "Inserisci un indirizzo email valido.",
    en: "Enter a valid email address.",
  },
  consent: {
    it: "Per inviare la richiesta devi accettare l'informativa sulla privacy.",
    en: "To send the request you have to accept the privacy policy.",
  },
  network: {
    it: "Invio non riuscito. Riprova, oppure scrivici a " + CONTACT_EMAIL + ".",
    en: "The request did not go through. Try again, or write to " + CONTACT_EMAIL + ".",
  },
};

/** Picks the format from the five answers. Mirrors how we actually reason. */
function recommend(answers) {
  const need = answers["02"];

  if (need === "Lead" || need === "Visibilità") {
    return {
      title: { it: "Campagna marketing gamificata", en: "Gamified marketing campaign" },
      body: {
        it: "Meccanica a punti e obiettivi su una landing dedicata, con raccolta lead qualificati. Se il pubblico è già in una community, la abbiniamo a un torneo eSports con NOVO.",
        en: "Points and objectives on a dedicated landing page, collecting qualified leads. If the audience already sits in a community, we pair it with a NOVO eSports tournament.",
      },
    };
  }

  if (need === "Coinvolgimento") {
    const remote = answers["03"] === "Da remoto";
    return {
      title: remote
        ? { it: "Torneo interno e mappa personalizzata", en: "Internal tournament and custom map" }
        : { it: "Teambuilding con giochi di ruolo", en: "Role-play team building" },
      body: remote
        ? {
            it: "Format competitivo giocabile da casa su una mappa costruita su misura, con classifica visibile e sessioni brevi ripetute nel tempo.",
            en: "A competitive format playable from home on a purpose-built map, with a visible leaderboard and short repeated sessions.",
          }
        : {
            it: "Sessione in presenza dove il gruppo vince o perde insieme. Emergono i ruoli reali, non quelli dell'organigramma.",
            en: "An on-site session where the group wins or loses together. Real roles surface, not the ones on the org chart.",
          },
    };
  }

  const school = answers["01"] === "Scuola o università";
  return {
    title: school
      ? { it: "Serious game didattico", en: "Educational serious game" }
      : { it: "Percorso di upskilling gamificato", en: "Gamified upskilling path" },
    body:
      answers["04"] === "Oltre 80"
        ? {
            it: "Percorso a moduli con facilitatori multipli e Achivia come piattaforma di progressione condivisa, così i numeri grandi restano gestibili.",
            en: "A modular path with several facilitators and Achivia as the shared progression platform, so large numbers stay manageable.",
          }
        : {
            it: "Ciclo di sessioni su una competenza alla volta, con simulazioni sul vostro settore e un report finale per la direzione.",
            en: "A cycle of sessions on one competence at a time, with simulations built on your sector and a final report for management.",
          },
  };
}

const URGENT_NOTE = {
  it: " Con questi tempi partiamo da un format già collaudato e lo adattiamo.",
  en: " On this timeline we start from a proven format and adapt it.",
};

export function initFormatForm() {
  const form = document.getElementById("format-form");
  if (!form) return;

  const panel = form.querySelector(".recommendation");
  const titleEl = document.getElementById("rec-title");
  const bodyEl = document.getElementById("rec-body");
  const emailEl = document.getElementById("email");
  const errorEl = document.getElementById("form-error");
  const submitEl = document.getElementById("format-submit");
  const consentEl = document.getElementById("privacy-consent");
  const privacyLink = document.getElementById("privacy-link");

  /* The link appears only once there is a policy to point at. */
  if (privacyLink && PRIVACY_URL) {
    privacyLink.href = PRIVACY_URL;
    privacyLink.hidden = false;
  }

  const answers = {};
  let sent = false;

  function paint() {
    const complete = Object.keys(answers).length >= 5;
    panel.classList.toggle("is-resolved", complete);

    if (!complete) {
      titleEl.textContent = t(IDLE.title);
      bodyEl.textContent = t(IDLE.body);
    } else {
      const rec = recommend(answers);
      titleEl.textContent = t(rec.title);
      bodyEl.textContent = t(rec.body) + (answers["05"] === "Entro un mese" ? t(URGENT_NOTE) : "");
    }

    submitEl.textContent = sent ? t(SUBMIT.sent) : t(SUBMIT.idle);
    submitEl.disabled = sent;
    if (!errorEl.hidden) errorEl.textContent = errorEl.dataset.key ? t(ERRORS[errorEl.dataset.key]) : "";
  }

  function showError(key) {
    errorEl.dataset.key = key;
    errorEl.textContent = t(ERRORS[key]);
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    delete errorEl.dataset.key;
  }

  /* ── the five questions ───────────────────────────────────────────────── */

  form.querySelectorAll(".question").forEach((fieldset) => {
    const key = fieldset.dataset.question;
    fieldset.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        answers[key] = chip.dataset.value;
        fieldset.querySelectorAll(".chip").forEach((other) => {
          other.setAttribute("aria-pressed", String(other === chip));
        });
        paint();
        if (Object.keys(answers).length >= 5) award("conf");
      });
    });
  });

  /* ── submission ───────────────────────────────────────────────────────── */

  /* The five questions, in the order they are asked, with the label that will
     head each line in the email. */
  const FIELDS = [
    ["01", "Chi sono"],
    ["02", "Cosa manca"],
    ["03", "Dove"],
    ["04", "Quante persone"],
    ["05", "Quando"],
  ];

  /* Flat, and in Italian, because whoever opens this reads it in an inbox.
     Most form services turn each key into a line of the email and print a
     nested object as [object Object], so the answers are spelled out as
     fields rather than handed over as a structure. `_subject` is the
     convention Formspree and its like use for the subject line. */
  function payload() {
    const complete = Object.keys(answers).length >= 5;
    const rec = complete ? recommend(answers) : null;
    const format = rec ? rec.title.it : "non completato";

    const data = {
      email: emailEl.value.trim(),
      _subject: `Richiesta dal sito — ${format}`,
      "Formato consigliato": format,
    };
    FIELDS.forEach(([key, label]) => {
      data[label] = answers[key] || "—";
    });
    data["Lingua del sito"] = getLang() === "it" ? "italiano" : "inglese";
    data["Pagina"] = window.location.href;
    /* Consent has to be demonstrable, which means recording what was agreed
       to and not just that something was: the policy it pointed at travels
       with the request, and "Inviato" below is when it was given. */
    data["Consenso privacy"] = "accettato";
    data["Informativa"] = PRIVACY_URL || "non configurata";
    data["Inviato"] = new Date().toISOString();

    return data;
  }

  function mailtoFallback(data) {
    const body = Object.entries(data)
      .filter(([k]) => k !== "_subject")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    window.location.href =
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(data._subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sent) return;

    if (!emailEl.checkValidity() || !emailEl.value.trim()) {
      showError("email");
      emailEl.focus();
      return;
    }
    if (consentEl && !consentEl.checked) {
      showError("consent");
      consentEl.focus();
      return;
    }
    clearError();

    const data = payload();

    if (!FORM_ENDPOINT) {
      mailtoFallback(data);
      sent = true;
      paint();
      award("send");
      return;
    }

    submitEl.disabled = true;
    submitEl.textContent = t(SUBMIT.sending);

    try {
      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sent = true;
      paint();
      award("send");
    } catch (err) {
      submitEl.disabled = false;
      showError("network");
      paint();
    }
  });

  emailEl.addEventListener("input", clearError);
  consentEl?.addEventListener("change", clearError);
  document.addEventListener("languagechange", paint);
  paint();
}
