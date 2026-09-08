/* Italian / English switch.
   Italian is the page's source text, sitting in the markup where crawlers and
   readers without JavaScript find it. English lives beside it in data-*
   attributes:

     data-en                text content
     data-en-alt            alt
     data-en-placeholder    placeholder
     data-en-aria-label     aria-label
     data-en-title          title

   Text this file cannot own — the d20 quote, the recommendation, the map
   viewer's status line, toasts — is re-rendered by its own module when the
   `languagechange` event fires below. */

const ATTRS = [
  { attr: "alt", selector: "[data-en-alt]", en: "enAlt", it: "itAlt" },
  { attr: "placeholder", selector: "[data-en-placeholder]", en: "enPlaceholder", it: "itPlaceholder" },
  { attr: "aria-label", selector: "[data-en-aria-label]", en: "enAriaLabel", it: "itAriaLabel" },
  { attr: "title", selector: "[data-en-title]", en: "enTitle", it: "itTitle" },
];

const STORAGE_KEY = "xpl4b_lang";

let current = "it";

export function getLang() {
  return current;
}

/** Picks the right half of an { it, en } pair. */
export function t(pair) {
  return current === "it" ? pair.it : pair.en;
}

function apply(lang) {
  const toEnglish = lang === "en";

  document.querySelectorAll("[data-en]").forEach((node) => {
    if (node.dataset.it === undefined) node.dataset.it = node.textContent;
    node.textContent = toEnglish ? node.dataset.en : node.dataset.it;
  });

  ATTRS.forEach(({ attr, selector, en, it }) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node.dataset[it] === undefined) node.dataset[it] = node.getAttribute(attr) ?? "";
      node.setAttribute(attr, toEnglish ? node.dataset[en] : node.dataset[it]);
    });
  });

  document.documentElement.lang = lang;
  current = lang;
  document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang } }));
}

export function setLang(lang) {
  if (lang === current) return;
  apply(lang);
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    /* private mode — the choice just does not persist */
  }
}

export function initI18n(toggleButton) {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
  if (stored === "en") apply("en");

  const paint = () => {
    // The button offers the other language, so it is labelled in that language.
    toggleButton.textContent = current === "it" ? "EN" : "IT";
    toggleButton.lang = current === "it" ? "en" : "it";
    toggleButton.setAttribute(
      "aria-label",
      current === "it" ? "Switch to English" : "Passa all'italiano"
    );
  };

  toggleButton.addEventListener("click", () => setLang(current === "it" ? "en" : "it"));
  document.addEventListener("languagechange", paint);
  paint();
}
