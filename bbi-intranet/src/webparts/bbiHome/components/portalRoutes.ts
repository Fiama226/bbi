import { parsePortalRoute } from "./homeLayout";

/**
 * BBI — routage du portail.
 *
 * Tout ce qui traduit une URL (`#organigramme`, `#actualite?id=12`, anciennes
 * pages .aspx) en vue applicative vit ici, sous forme de fonctions pures :
 * le comportement de navigation est ainsi vérifiable sans navigateur
 * (voir `tools/verify-fallback.js`, suite « Héros & navigation »).
 */

export type PortalView =
  | "accueil"
  | "formations"
  | "sessions"
  | "actualites"
  | "actualite"
  | "annonce"
  | "ressources"
  | "communaute"
  | "organigramme"
  | "recherche";

/** Alias d'URL acceptés : français, anglais et intitulés historiques. */
export const VIEW_FROM_HASH: { [key: string]: PortalView } = {
  accueil: "accueil", home: "accueil", acces: "accueil",
  "vie-equipe": "accueil",
  formations: "formations", catalogue: "formations",
  sessions: "sessions", agenda: "sessions",
  actualites: "actualites", news: "actualites", "vie-bbi": "actualites",
  actualite: "actualite", article: "actualite", newsitem: "actualite",
  annonce: "annonce", annonces: "annonce",
  ressources: "ressources", documents: "ressources", galerie: "ressources",
  communaute: "communaute", formateurs: "communaute", support: "communaute",
  "espace-formateurs": "communaute", equipe: "communaute",
  organigramme: "organigramme", organisation: "organigramme", equipes: "organigramme",
  recherche: "recherche",
};

/**
 * Ancres internes de la page d'accueil : elles ne changent pas de vue, elles
 * font défiler la page jusqu'à la section correspondante. Sans cette table,
 * un lien comme `#vie-equipe` ramenait l'utilisateur en haut de l'accueil.
 */
export const HOME_ANCHORS: { [key: string]: string } = {
  "vie-equipe": "vie-equipe",
  acces: "acces",
};
// Remarque : `vie-bbi` reste l'alias de la vue « actualités » (ancienne page
// vie-bbi.aspx) ; la section `#vie-bbi` de l'accueil n'est donc pas une ancre
// de défilement, pour éviter toute ambiguïté entre les deux usages.

/** Vue visée par un lien (interne `#...` ou ancienne page SharePoint). */
export const viewFromHref = (href: string): PortalView | undefined => {
  if (!href) {
    return undefined;
  }
  if (href.charAt(0) === "#") {
    return VIEW_FROM_HASH[parsePortalRoute(href).view];
  }
  // Anciennes propriétés SharePoint (déjà enregistrées sur des instances en place)
  // continuent d'ouvrir la vue correspondante au lieu de quitter le portail.
  const legacyUrl = href.toLowerCase();
  if (legacyUrl.indexOf("catalogue.aspx") !== -1) { return "formations"; }
  if (legacyUrl.indexOf("sessions.aspx") !== -1) { return "sessions"; }
  if (legacyUrl.indexOf("vie-bbi.aspx") !== -1 || legacyUrl.indexOf("article.aspx") !== -1) { return "actualites"; }
  if (legacyUrl.indexOf("galerie.aspx") !== -1 || legacyUrl.indexOf("supports publiés") !== -1) { return "ressources"; }
  if (legacyUrl.indexOf("organigramme") !== -1) { return "organigramme"; }
  if (legacyUrl.indexOf("espace-formateurs") !== -1 || legacyUrl.indexOf("formation.aspx") !== -1) { return "communaute"; }
  return undefined;
};

/** Vue à afficher pour un hash donné : tout hash inconnu ramène à l'accueil. */
export const viewFromHash = (hash: string): PortalView => {
  return VIEW_FROM_HASH[parsePortalRoute(hash || "").view] || "accueil";
};

/** Identifiant d'actualité porté par l'URL (`#actualite?id=12`, `#actualite/7`). */
export const newsIdFromHash = (hash: string): number => {
  const parsed = parseInt(parsePortalRoute(hash || "").params.id || "", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Section de l'accueil visée par un hash (`#vie-equipe` → `vie-equipe`),
 * ou chaîne vide si le hash désigne une vue et non une section.
 */
export const anchorIdFromHash = (hash: string): string => {
  return HOME_ANCHORS[parsePortalRoute(hash || "").view] || "";
};
