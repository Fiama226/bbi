/**
 * Drapeaux des implantations : correspondance Pays (texte libre de la liste
 * « Implantations ») → code ISO 3166-1 alpha-2 des drapeaux SVG embarqués
 * dans `assets/flags/`. Module pur, sans DOM, testé par tools/verify-fallback.js.
 */

/** Pays couverts par un drapeau embarqué (code → libellé affiché). */
export const FLAG_COUNTRIES: { [code: string]: string } = {
  fr: "France",
  ci: "Côte d'Ivoire",
  ml: "Mali",
  sn: "Sénégal",
  bf: "Burkina Faso",
  bj: "Bénin",
  tg: "Togo",
  ne: "Niger",
  gn: "Guinée",
  cm: "Cameroun",
  ga: "Gabon",
  cd: "RD Congo",
  ma: "Maroc",
  tn: "Tunisie",
  dz: "Algérie",
  be: "Belgique"
};

/** Libellés alternatifs acceptés (déjà normalisés : minuscules, sans accents ni ponctuation). */
const ALIASES: { [normalized: string]: string } = {
  "cote d ivoire": "ci",
  "cote divoire": "ci",
  "ivory coast": "ci",
  senegal: "sn",
  benin: "bj",
  guinee: "gn",
  "guinee conakry": "gn",
  cameroon: "cm",
  "rd congo": "cd",
  rdc: "cd",
  "congo kinshasa": "cd",
  "republique democratique du congo": "cd",
  "democratic republic of the congo": "cd",
  morocco: "ma",
  tunisia: "tn",
  algeria: "dz",
  algerie: "dz",
  belgium: "be",
  belgique: "be"
};

/** Minuscules, sans accents, apostrophes et tirets remplacés par des espaces, espaces normalisés. */
const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’'`\-_/.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const BY_NAME: { [normalized: string]: string } = (() => {
  const index: { [normalized: string]: string } = {};
  Object.keys(FLAG_COUNTRIES).forEach((code) => {
    index[normalize(FLAG_COUNTRIES[code])] = code;
  });
  Object.keys(ALIASES).forEach((alias) => {
    index[alias] = ALIASES[alias];
  });
  return index;
})();

/** Code ISO du drapeau pour un libellé de pays, ou undefined si inconnu (la carte garde alors ses initiales). */
export const flagCodeOf = (country?: string): string | undefined => {
  const key = normalize(country || "");
  return key ? BY_NAME[key] : undefined;
};
