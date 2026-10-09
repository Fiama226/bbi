import { SPHttpClient } from '@microsoft/sp-http';
import { listApiUrl } from '../../../shared/sharePointRest';
import { parsePortalRoute } from './homeLayout';

/**
 * BBI : offres (Formation, Conseil, Coaching).
 *
 * Source : liste SharePoint « Offres ». Contrat de repli à trois états :
 * liste absente (404), liste vide, liste alimentée. Les fonctions de ce
 * fichier sont pures (hors loadOffers) et vérifiées par tools/verify-fallback.js.
 */

export type OfferPole = 'Formation' | 'Conseil' | 'Coaching';

export const OFFER_POLES: OfferPole[] = ['Formation', 'Conseil', 'Coaching'];

export interface IOffer {
  Id: number;
  Title: string;
  Pole: OfferPole;
  CodeOffre?: string;
  Filiere?: string;
  Format?: string;
  Duree?: string;
  PublicCible?: string;
  Niveau?: string;
  StatutCatalogue?: string;
}

export interface IOffersResult {
  items: IOffer[];
  isDemo: boolean;
}

export interface IOfferFilter {
  pole?: OfferPole | '';
  filiere?: string;
  query?: string;
}

/** Les trois cartes du bandeau de l'accueil. */
export const OFFER_PILLARS: { pole: OfferPole; icon: string; promise: string }[] = [
  { pole: 'Formation', icon: '▦', promise: 'Des parcours pratiques pour monter en compétences.' },
  { pole: 'Conseil', icon: '◈', promise: 'Un regard expert pour structurer et faire évoluer votre organisation.' },
  { pole: 'Coaching', icon: '◎', promise: 'Un accompagnement individuel et collectif pour franchir les caps.' }
];

const OFFER_COLUMNS: string[] = [
  'Title', 'Pole', 'CodeOffre', 'Filiere', 'Format', 'Duree', 'PublicCible', 'Niveau', 'StatutCatalogue'
];

const text = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const out = String(value).trim();
  return out ? out : undefined;
};

/** Pôle d'une ligne de liste : insensible à la casse, « Formation » par défaut. */
export const normalizePole = (value: unknown): OfferPole => {
  const key = (text(value) || '').toLowerCase();
  for (let i = 0; i < OFFER_POLES.length; i += 1) {
    if (OFFER_POLES[i].toLowerCase() === key) {
      return OFFER_POLES[i];
    }
  }
  return 'Formation';
};

/** Pôle d'un paramètre d'URL : strict, chaîne vide si inconnu (= aucun filtre). */
export const poleFromParam = (value: string | undefined): OfferPole | '' => {
  const key = (value || '').trim().toLowerCase();
  for (let i = 0; i < OFFER_POLES.length; i += 1) {
    if (OFFER_POLES[i].toLowerCase() === key) {
      return OFFER_POLES[i];
    }
  }
  return '';
};

export const poleFromHash = (hash: string): OfferPole | '' =>
  poleFromParam(parsePortalRoute(hash).params.pole);

const normalizeOffer = (raw: { [key: string]: unknown }): IOffer => ({
  Id: Number(raw.Id) || 0,
  Title: text(raw.Title) || '',
  Pole: normalizePole(raw.Pole),
  CodeOffre: text(raw.CodeOffre),
  Filiere: text(raw.Filiere),
  Format: text(raw.Format),
  Duree: text(raw.Duree),
  PublicCible: text(raw.PublicCible),
  Niveau: text(raw.Niveau),
  StatutCatalogue: text(raw.StatutCatalogue)
});

const DEMO_OFFERS: IOffer[] = [
  { Id: 1, Title: "Management d'équipe", Pole: 'Formation', CodeOffre: 'BBI-FOR-101', Filiere: 'Management', Format: 'Présentiel', Duree: '2 jours', Niveau: 'Confirmé', PublicCible: 'Managers de proximité', StatutCatalogue: 'Actif' },
  { Id: 2, Title: 'Vendre la valeur, pas le prix', Pole: 'Formation', CodeOffre: 'BBI-FOR-110', Filiere: 'Commerce', Format: 'Présentiel', Duree: '1 jour', Niveau: 'Débutant', PublicCible: 'Équipes commerciales', StatutCatalogue: 'Actif' },
  { Id: 3, Title: 'Prospection digitale', Pole: 'Formation', CodeOffre: 'BBI-FOR-140', Filiere: 'Digital', Format: 'Distanciel', Duree: '½ journée', Niveau: 'Débutant', PublicCible: 'Commerciaux et indépendants', StatutCatalogue: 'Actif' },
  { Id: 4, Title: 'Fondamentaux Qualiopi', Pole: 'Formation', CodeOffre: 'BBI-FOR-301', Filiere: 'Qualité & Certification', Format: 'Distanciel', Duree: '1 jour', Niveau: 'Intermédiaire', PublicCible: 'Responsables qualité', StatutCatalogue: 'Actif' },
  { Id: 5, Title: 'Leadership & gestion du changement', Pole: 'Formation', CodeOffre: 'BBI-FOR-210', Filiere: 'Management', Format: 'Hybride', Duree: '3 jours', Niveau: 'Confirmé', PublicCible: 'Cadres dirigeants', StatutCatalogue: 'Actif' },
  { Id: 6, Title: 'Diagnostic organisationnel', Pole: 'Conseil', CodeOffre: 'BBI-CON-101', Filiere: 'Organisation', Format: 'Sur site client', Duree: '3 à 6 semaines', Niveau: 'Confirmé', PublicCible: 'Directions générales', StatutCatalogue: 'Actif' },
  { Id: 7, Title: "Structuration d'un dispositif de formation", Pole: 'Conseil', CodeOffre: 'BBI-CON-120', Filiere: 'Ingénierie de formation', Format: 'Hybride', Duree: '2 à 4 mois', Niveau: 'Confirmé', PublicCible: 'Organismes et directions RH', StatutCatalogue: 'Actif' },
  { Id: 8, Title: 'Accompagnement au changement', Pole: 'Conseil', CodeOffre: 'BBI-CON-210', Filiere: 'Organisation', Format: 'Sur site client', Duree: '3 à 9 mois', Niveau: 'Expert', PublicCible: 'Comités de direction', StatutCatalogue: 'Actif' },
  { Id: 9, Title: 'Mise en conformité qualité (Qualiopi, ISO 21001)', Pole: 'Conseil', CodeOffre: 'BBI-CON-301', Filiere: 'Qualité & Certification', Format: 'Hybride', Duree: '6 à 10 semaines', Niveau: 'Confirmé', PublicCible: 'Organismes de formation', StatutCatalogue: 'Actif' },
  { Id: 10, Title: 'Coaching de dirigeants', Pole: 'Coaching', CodeOffre: 'BBI-COA-101', Filiere: 'Leadership', Format: 'Hybride', Duree: '6 mois', Niveau: 'Expert', PublicCible: 'Dirigeants et cadres supérieurs', StatutCatalogue: 'Actif' },
  { Id: 11, Title: "Coaching d'équipe", Pole: 'Coaching', CodeOffre: 'BBI-COA-120', Filiere: 'Management', Format: 'Présentiel', Duree: '4 mois', Niveau: 'Confirmé', PublicCible: 'Équipes de direction', StatutCatalogue: 'Actif' },
  { Id: 12, Title: "Cycle d'accompagnement d'entrepreneurs", Pole: 'Coaching', CodeOffre: 'BBI-COA-201', Filiere: 'Entrepreneuriat', Format: 'Hybride', Duree: '6 mois', Niveau: 'Intermédiaire', PublicCible: 'Porteurs de projet', StatutCatalogue: 'Actif' }
];

const demoOffers = (): IOffer[] => DEMO_OFFERS.map((offer) => ({ ...offer }));

/**
 * Charge la liste « Offres ». Les colonnes absentes de la liste ne sont pas
 * demandées (pas d'erreur HTTP 400) ; liste absente ou vide → offres de repli.
 */
export const loadOffers = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number = 300
): Promise<IOffersResult> => {
  try {
    const fieldsUrl = listApiUrl(siteUrl, listTitle, 'fields', '?$select=InternalName&$top=500');
    const fieldsResponse = await spHttpClient.get(fieldsUrl, SPHttpClient.configurations.v1);
    if (!fieldsResponse.ok) {
      throw new Error(`HTTP ${fieldsResponse.status}`);
    }
    const fieldsJson = (await fieldsResponse.json()) as { value?: { InternalName: string }[] };
    const available = (fieldsJson.value || []).map((field) => field.InternalName);
    const select = ['Id'].concat(OFFER_COLUMNS.filter((column) => available.indexOf(column) !== -1));
    const itemsUrl = listApiUrl(
      siteUrl,
      listTitle,
      'items',
      `?$select=${select.join(',')}&$orderby=Title&$top=${Math.max(1, maxItems)}`
    );
    const response = await spHttpClient.get(itemsUrl, SPHttpClient.configurations.v1);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { value?: { [key: string]: unknown }[] };
    const items = (json.value || []).map(normalizeOffer).filter((offer) => !!offer.Title);
    if (items.length === 0) {
      return { items: demoOffers(), isDemo: true };
    }
    return { items, isDemo: false };
  } catch {
    return { items: demoOffers(), isDemo: true };
  }
};

export const activeOffers = (items: IOffer[]): IOffer[] =>
  items.filter((offer) => !offer.StatutCatalogue || offer.StatutCatalogue === 'Actif');

export const countByPole = (items: IOffer[]): { [pole: string]: number } => {
  const counts: { [pole: string]: number } = { Formation: 0, Conseil: 0, Coaching: 0 };
  items.forEach((offer) => {
    counts[offer.Pole] += 1;
  });
  return counts;
};

export const filieresOf = (items: IOffer[]): string[] => {
  const set: { [key: string]: boolean } = {};
  items.forEach((offer) => {
    const filiere = (offer.Filiere || '').trim();
    if (filiere) {
      set[filiere] = true;
    }
  });
  return Object.keys(set).sort((a, b) => a.localeCompare(b, 'fr'));
};

export const filterOffers = (items: IOffer[], filter: IOfferFilter): IOffer[] => {
  const query = (filter.query || '').trim().toLowerCase();
  return activeOffers(items).filter((offer) => {
    const matchPole = !filter.pole || offer.Pole === filter.pole;
    const matchFiliere = !filter.filiere || (offer.Filiere || '') === filter.filiere;
    const matchQuery =
      !query ||
      offer.Title.toLowerCase().indexOf(query) !== -1 ||
      (offer.CodeOffre || '').toLowerCase().indexOf(query) !== -1 ||
      (offer.PublicCible || '').toLowerCase().indexOf(query) !== -1;
    return matchPole && matchFiliere && matchQuery;
  });
};

/** Aperçu de l'accueil : jusqu'à `perPole` offres par pôle, dans l'ordre des pôles. */
export const previewOffers = (items: IOffer[], perPole: number): IOffer[] => {
  const active = activeOffers(items);
  return OFFER_POLES.reduce<IOffer[]>(
    (all, pole) => all.concat(active.filter((offer) => offer.Pole === pole).slice(0, perPole)),
    []
  );
};
