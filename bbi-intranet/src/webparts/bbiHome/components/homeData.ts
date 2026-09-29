import { SPHttpClient } from '@microsoft/sp-http';

export interface IHomeNews {
  Id: number;
  Title: string;
  Summary?: string;
  Category?: string;
  Published?: string;
  AuthorName?: string;
  ImageUrl?: string;
  LinkUrl?: string;
  Body?: string;
  /** Visuel embarqué utilisé pour les contenus de démonstration (0 à 3). */
  DemoIndex?: number;
}

export interface IHomeSession {
  Id: number;
  Title: string;
  StartDate?: string;
  EndDate?: string;
  Modality?: string;
  Location?: string;
  Status?: string;
  RegistrationUrl?: string;
  Trainer?: string;
}

export interface IHomeTrainer {
  Id: number;
  Title: string;
  Role?: string;
  Filiere?: string;
  Initials?: string;
  PhotoUrl?: string;
  Phone?: string;
  Email?: string;
  WhatsApp?: string;
  Location?: string;
  Bio?: string;
  Specialites?: string;
  Certifications?: string;
  LinkedIn?: string;
  DemoIndex?: number;
}

/** Collaborateur mis à l'honneur (Employé du mois). */
export interface IHomeEmployee {
  Id: number;
  Title: string;
  Role?: string;
  Pole?: string;
  Month?: string;
  Message?: string;
  Highlights?: string;
  PhotoUrl?: string;
  DemoIndex?: number;
}

/** Certification ou agrément de l'organisme. */
export interface IHomeCertification {
  Id: number;
  Title: string;
  Issuer?: string;
  Scope?: string;
  ValidUntil?: string;
  Status?: string;
  DemoIndex?: number;
}

export interface IHomeListResult<T> {
  items: T[];
  isDemo: boolean;
}

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const stripSlashes = (value: string): string => (value || '').replace(/\/+$/, '');

/** Lit un champ SharePoint potentiellement Hyperlink ({ Url, Description }) ou texte. */
export const textOf = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'object') {
    const candidate = value as {
      Url?: string;
      Description?: string;
      Email?: string;
      LookupValue?: string;
      Title?: string;
    };
    const resolved =
      candidate.Url ||
      candidate.Email ||
      candidate.LookupValue ||
      candidate.Title ||
      candidate.Description ||
      '';
    return String(resolved).trim() || undefined;
  }
  return String(value);
};

const dateInDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
};

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
};

/** Numéro exploitable par WhatsApp (indicatif inclus, sans « + » ni espaces). */
export const digitsOf = (value?: string): string => {
  const digits = (value || '').replace(/[^\d]/g, '');
  return digits.replace(/^00/, '');
};

export const whatsAppUrl = (value?: string): string => {
  const digits = digitsOf(value);
  return digits.length >= 8 ? `https://wa.me/${digits}` : '';
};

export const telUrl = (value?: string): string => {
  const clean = (value || '').trim();
  if (!clean) {
    return '';
  }
  const normalized = clean.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '';
};

export const mailtoUrl = (email?: string): string => {
  const clean = (email || '').trim();
  return clean.indexOf('@') !== -1 ? `mailto:${clean}` : '';
};

/** Conversation Teams directe avec le collaborateur (aucune donnée côté serveur). */
export const teamsChatUrl = (email?: string): string => {
  const clean = (email || '').trim();
  return clean.indexOf('@') !== -1
    ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(clean)}`
    : '';
};

/** Profil LinkedIn / réseau social : conservé tel quel s'il est renseigné. */
export const externalUrl = (value?: string): string => {
  const clean = (value || '').trim();
  if (!clean) {
    return '';
  }
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  return `https://${clean.replace(/^\/+/, '')}`;
};

const slug = (value: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');

const initialsOfName = (value: string): string =>
  (value || '')
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

/* ------------------------------------------------------------------ */
/* Données de démonstration (aucune source SharePoint requise)          */
/* ------------------------------------------------------------------ */

const body = (paragraphs: string[]): string =>
  paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');

export const DEMO_NEWS: IHomeNews[] = [
  {
    Id: 1,
    Title: '12 nouveaux formateurs certifiés',
    Summary: "La session de certification de septembre s'est achevée avec 100 % de réussite. Retour sur trois jours d'apprentissage collectif et sur ce que cela change pour nos clients.",
    Category: 'Certification',
    Published: daysAgo(4),
    AuthorName: 'Direction pédagogique',
    DemoIndex: 0,
    Body: body([
      "Trois jours, douze formateurs, un seul objectif : garantir la même qualité d'animation sur l'ensemble du réseau BBI.",
      "La certification BBI repose sur trois piliers : la maîtrise du contenu pédagogique, la posture d'animation et l'évaluation continue des acquis. Chaque candidat a animé une séquence filmée en conditions réelles, puis reçu un retour structuré de ses pairs.",
      "Cette promotion affiche 100 % de réussite au premier passage — un niveau jamais atteint depuis la création du parcours. Les évaluations à chaud attribuent une note de <strong>4,8 sur 5</strong> à l'accompagnement des tuteurs."
    ])
  },
  {
    Id: 2,
    Title: 'Le catalogue des formations évolue',
    Summary: 'Deux nouveaux parcours de management, un module e-learning de prospection digitale et une formation Qualiopi renforcée arrivent au catalogue.',
    Category: 'Formations',
    Published: daysAgo(11),
    AuthorName: 'Équipe BBI',
    DemoIndex: 1,
    Body: body([
      "Le catalogue 2026 s'enrichit de six parcours, dont deux entièrement nouveaux, pensés à partir des besoins remontés par les clients et les formateurs du réseau.",
      "Les parcours « Management de proximité » et « Conduite du changement » sont proposés en présentiel et en hybride, avec un module d'ancrage à 30 jours pour sécuriser les acquis."
    ])
  },
  {
    Id: 3,
    Title: 'Qualiopi : notre audit blanc est une réussite',
    Summary: "Quatorze indicateurs sur quatorze validés. La direction qualité fait le point sur les dernières actions correctives engagées.",
    Category: 'Qualité',
    Published: daysAgo(18),
    AuthorName: 'Qualité BBI',
    DemoIndex: 2,
    Body: body([
      "L'audit blanc a mobilisé l'ensemble des équipes pendant deux semaines : revue des preuves, entretiens avec les formateurs et observation de sessions en conditions réelles.",
      "Les quatorze indicateurs du référentiel national qualité sont validés. Trois axes de progrès ont été identifiés et font déjà l'objet d'un plan d'action suivi en revue mensuelle."
    ])
  },
  {
    Id: 4,
    Title: 'Trois nouvelles antennes BBI en Afrique de l’Ouest',
    Summary: "Abidjan, Dakar et Bamako rejoignent le réseau. Les premières cohortes locales démarrent au premier trimestre.",
    Category: 'Réseau',
    Published: daysAgo(25),
    AuthorName: 'Direction générale',
    DemoIndex: 3,
    Body: body([
      "Abidjan, Dakar et Bamako rejoignent officiellement le réseau BBI, portant à neuf le nombre de pays couverts par nos parcours.",
      "Chaque antenne s'appuie sur un formateur référent local, certifié selon le même référentiel que le reste du réseau, et sur les supports pédagogiques harmonisés."
    ])
  },
  {
    Id: 5,
    Title: 'Retour sur les ateliers de rentrée',
    Summary: 'Les équipes se sont retrouvées autour de nouvelles méthodes pédagogiques et de la refonte de nos grilles d’évaluation.',
    Category: 'Vie BBI',
    Published: daysAgo(32),
    AuthorName: 'Communication BBI',
    DemoIndex: 1,
    Body: body([
      "Deux jours de travail collectif pour réinterroger nos pratiques : alternance des rythmes, évaluation par les pairs et place du digital dans les séquences présentelles.",
      "La nouvelle grille d'évaluation à froid sera généralisée à toutes les cohortes dès le prochain trimestre."
    ])
  },
  {
    Id: 6,
    Title: 'Lancement du module e-learning « Prospection digitale »',
    Summary: "Cinq micro-séquences, des cas réels et une mise en situation filmée : le nouveau parcours est disponible pour tous les adhérents.",
    Category: 'Formations',
    Published: daysAgo(40),
    AuthorName: 'Digital BBI',
    DemoIndex: 2,
    Body: body([
      "Cinq micro-séquences de huit minutes, conçues pour être suivies entre deux rendez-vous clients : c'est le nouveau format e-learning BBI.",
      "Un cas réel filmé, des modèles de messages prêts à l'emploi et un quiz de validation complètent le parcours."
    ])
  },
  {
    Id: 7,
    Title: 'Séminaire annuel des formateurs : cap sur 2026',
    Summary: "Deux jours à Dakar pour partager les pratiques, préparer la montée en charge du réseau et fêter les dix ans de BBI.",
    Category: 'Vie BBI',
    Published: daysAgo(48),
    AuthorName: 'Direction pédagogique',
    DemoIndex: 3,
    Body: body([
      "Le séminaire annuel réunira l'ensemble des formateurs du réseau autour d'un fil rouge : « transmettre utile ».",
      "Au programme : ateliers de co-animation, retour d'expérience des antennes et présentation des nouveaux parcours."
    ])
  },
  {
    Id: 8,
    Title: 'Nouveau partenariat avec la CCI pour l’alternance',
    Summary: "BBI accompagne désormais les entreprises dans l'intégration de leurs apprentis : parcours tuteur et outils d'évaluation inclus.",
    Category: 'Partenariats',
    Published: daysAgo(55),
    AuthorName: 'Direction générale',
    DemoIndex: 0,
    Body: body([
      "Le partenariat couvre trois régions et prévoit la formation de 200 tuteurs d'apprentis sur l'année.",
      "Un parcours dédié « Tuteur d'apprenti » (deux journées + un suivi à 90 jours) est d'ores et déjà disponible au catalogue."
    ])
  },
  {
    Id: 9,
    Title: 'Les évaluations à froid progressent de 9 points',
    Summary: "Mesuré à 90 jours, l'impact des formations BBI progresse nettement sur les indicateurs de mise en pratique.",
    Category: 'Qualité',
    Published: daysAgo(63),
    AuthorName: 'Qualité BBI',
    DemoIndex: 1,
    Body: body([
      "L'évaluation à 90 jours mesure ce qui reste réellement en place : les gestes professionnels, les rituels d'équipe et les livrables produits.",
      "La hausse de 9 points s'explique notamment par la généralisation des plans d'ancrage et des rendez-vous de suivi avec le manager."
    ])
  },
  {
    Id: 10,
    Title: 'Programme « Femmes dirigeantes » : appel à candidatures',
    Summary: "Dix places pour un parcours de six mois mêlant coaching individuel, pairs et mise en relation avec des mentors.",
    Category: 'Programmes',
    Published: daysAgo(70),
    AuthorName: 'Équipe BBI',
    DemoIndex: 2,
    Body: body([
      "Le programme combine six mois d'accompagnement : coaching individuel, ateliers entre pairs et mise en relation avec un mentor du réseau.",
      "Les candidatures sont ouvertes jusqu'au 30 du mois ; les prérequis sont détaillés dans l'espace ressources."
    ])
  },
  {
    Id: 11,
    Title: 'Le studio BBI ouvre ses portes aux antennes',
    Summary: 'Les antennes peuvent désormais produire leurs propres capsules vidéo avec les équipes du studio.',
    Category: 'Digital',
    Published: daysAgo(78),
    AuthorName: 'Digital BBI',
    DemoIndex: 3,
    Body: body([
      "Tournage, montage, sous-titrage : le studio accompagne les antennes de la conception à la publication des capsules.",
      "Un protocole simplifié et un template de lancement permettront de produire une capsule en une demi-journée."
    ])
  },
  {
    Id: 12,
    Title: 'Restauration de la plateforme d’inscription en ligne',
    Summary: "Une nouvelle interface d'inscription, plus rapide, disponible depuis les prochaines sessions du portail.",
    Category: 'Vie BBI',
    Published: daysAgo(86),
    AuthorName: 'Communication BBI',
    DemoIndex: 0,
    Body: body([
      "La nouvelle interface d'inscription tient en un écran : choix de la session, informations du participant et confirmation immédiate.",
      "Les inscriptions déjà enregistrées sont conservées et l'accès au suivi reste identique."
    ])
  }
];

export const DEMO_SESSIONS: IHomeSession[] = [
  { Id: 1, Title: "Management d'équipe — Cohorte 7", StartDate: dateInDays(7), Modality: 'Présentiel', Location: 'Paris', Status: 'Inscriptions ouvertes', Trainer: 'Amélie Martin' },
  { Id: 2, Title: "Coaching d'entrepreneurs — Module 1", StartDate: dateInDays(14), Modality: 'Distanciel', Location: 'Teams', Status: 'Webinaire', Trainer: 'Claire Fontaine' },
  { Id: 3, Title: 'Atelier « Traiter les objections »', StartDate: dateInDays(21), Modality: 'Présentiel', Location: 'Lyon', Status: '3 places', Trainer: 'Khadija Diallo' },
  { Id: 4, Title: 'Prospection digitale — promo 12', StartDate: dateInDays(30), Modality: 'Distanciel', Location: 'Teams', Status: 'Inscriptions ouvertes', Trainer: 'Thomas Bernard' },
  { Id: 5, Title: 'Fondamentaux Qualiopi — revue annuelle', StartDate: dateInDays(35), Modality: 'Distanciel', Location: 'Teams', Status: 'Webinaire', Trainer: 'Marie-Claire Ngoma' },
  { Id: 6, Title: 'Négociation commerciale avancée', StartDate: dateInDays(48), Modality: 'Présentiel', Location: 'Dakar', Status: 'Inscriptions ouvertes', Trainer: 'Khadija Diallo' },
  { Id: 7, Title: 'Leadership & gestion du changement', StartDate: dateInDays(62), Modality: 'Hybride', Location: 'Paris / Teams', Status: 'Liste d’attente', Trainer: 'Youssef El Amrani' },
  { Id: 8, Title: 'Atelier « Prise de parole en public »', StartDate: dateInDays(75), Modality: 'Présentiel', Location: 'Abidjan', Status: '5 places', Trainer: 'Stéphane Laurent' }
];

interface ITrainerSeed {
  Name: string;
  Role: string;
  Filiere: string;
  Location: string;
  Phone: string;
  Bio: string;
  Specialites: string;
  Certifications: string;
}

const TRAINER_SEED: ITrainerSeed[] = [
  {
    Name: 'Amélie Martin',
    Role: 'Responsable pédagogique',
    Filiere: 'Management & Qualité',
    Location: 'Paris — Siège',
    Phone: '+33 6 12 45 78 90',
    Bio: "Pilote l'ingénierie pédagogique du réseau depuis 2018. Elle conçoit les parcours managériaux et accompagne la montée en compétences des formateurs BBI.",
    Specialites: 'Management de proximité · Ingénierie pédagogique',
    Certifications: 'Qualiopi · Coach professionnel (RNCP)'
  },
  {
    Name: 'Stéphane Laurent',
    Role: 'Coach certifié',
    Filiere: 'Coaching & leadership',
    Location: 'Lyon',
    Phone: '+33 6 23 56 89 01',
    Bio: "Coach certifié et ancien directeur commercial : il travaille la posture, la prise de parole et la relation client auprès des dirigeants et managers.",
    Specialites: 'Coaching de dirigeants · Prise de parole',
    Certifications: 'Coach certifié ICF · Process Communication'
  },
  {
    Name: 'Khadija Diallo',
    Role: 'Formatrice',
    Filiere: 'Commerce & négociation',
    Location: 'Dakar — Antenne',
    Phone: '+221 77 456 78 90',
    Bio: "Spécialiste de la négociation complexe, elle anime depuis six ans les parcours commerciaux et accompagne les équipes de vente sur le terrain.",
    Specialites: 'Négociation · Prospection terrain',
    Certifications: 'Méthode BBI Vente · TOSA'
  },
  {
    Name: 'Thomas Bernard',
    Role: 'Formateur',
    Filiere: 'Digital & prospection',
    Location: 'Paris — Siège',
    Phone: '+33 6 34 67 90 12',
    Bio: "Ancien responsable growth : il outille les équipes commerciales et anime le module « Prospection digitale » du catalogue.",
    Specialites: 'Prospection digitale · Outils CRM',
    Certifications: 'Google Ads · HubSpot Academy'
  },
  {
    Name: 'Marie-Claire Ngoma',
    Role: 'Consultante qualité',
    Filiere: 'Qualité & certification',
    Location: 'Abidjan — Antenne',
    Phone: '+225 07 12 34 56 78',
    Bio: "Accompagne les organismes de formation dans leur mise en conformité et prépare les formateurs aux audits qualité.",
    Specialites: 'Qualiopi · Audit interne',
    Certifications: 'Auditeur qualité certifié · Qualiopi'
  },
  {
    Name: 'Youssef El Amrani',
    Role: 'Formateur',
    Filiere: 'Leadership & changement',
    Location: 'Distanciel',
    Phone: '+33 6 45 78 01 23',
    Bio: "Spécialiste de la conduite du changement, il intervient sur les transformations d'organisation et les fusions d'équipes.",
    Specialites: 'Conduite du changement · Leadership',
    Certifications: 'Méthode BBI Leadership · Prosci (notions)'
  },
  {
    Name: 'Claire Fontaine',
    Role: 'Coach certifiée',
    Filiere: 'Coaching d’entrepreneurs',
    Location: 'Paris — Siège',
    Phone: '+33 6 56 89 12 34',
    Bio: "Accompagne les créateurs et repreneurs : structuration du projet, posture de dirigeant et prise de décision sous incertitude.",
    Specialites: 'Coaching entrepreneurial · Codéveloppement',
    Certifications: 'Coach certifiée · Green Belt Lean'
  },
  {
    Name: 'Jean-Marc Okafor',
    Role: 'Directeur pédagogique',
    Filiere: 'Management',
    Location: 'Paris — Siège',
    Phone: '+33 6 67 90 23 45',
    Bio: "Fixe les orientations pédagogiques du réseau et garantit l'homogénéité des parcours entre les neuf pays couverts.",
    Specialites: "Stratégie pédagogique · Management d'équipe",
    Certifications: 'Qualiopi · MBA ESSEC'
  },
  {
    Name: 'Awa Traoré',
    Role: 'Formatrice',
    Filiere: 'Relation client',
    Location: 'Bamako — Antenne',
    Phone: '+223 76 12 34 56',
    Bio: "Forme les équipes aux standards de service et à la gestion des réclamations clients.",
    Specialites: 'Relation client · Qualité de service',
    Certifications: 'Méthode BBI Service · Qualiopi (sensibilisation)'
  },
  {
    Name: 'Samuel Kouassi',
    Role: 'Formateur',
    Filiere: 'Vente & management',
    Location: 'Abidjan — Antenne',
    Phone: '+225 05 98 76 54 32',
    Bio: "Accompagne les équipes de vente et les managers de proximité en Afrique de l'Ouest.",
    Specialites: 'Management de proximité · Vente',
    Certifications: 'Méthode BBI Vente · Coach en cours de certification'
  }
];

export const DEMO_TRAINERS: IHomeTrainer[] = TRAINER_SEED.map((seed, index) => ({
  Id: index + 1,
  Title: seed.Name,
  Role: seed.Role,
  Filiere: seed.Filiere,
  Initials: initialsOfName(seed.Name),
  Email: `${slug(seed.Name)}@businessbuilders.fr`,
  Phone: seed.Phone,
  WhatsApp: seed.Phone,
  Location: seed.Location,
  Bio: seed.Bio,
  Specialites: seed.Specialites,
  Certifications: seed.Certifications,
  DemoIndex: index % 4
}));

export const DEMO_EMPLOYEES: IHomeEmployee[] = [
  {
    Id: 1,
    Title: 'Léa Marchand',
    Role: 'Cheffe de projet e-learning',
    Pole: 'Opérations & digital',
    Month: '',
    Message:
      "Léa a piloté la refonte complète des modules e-learning et la mise en ligne des capsules du studio en un trimestre. Un travail d'orfèvre sur la qualité pédagogique et l'accessibilité, salué par les formateurs comme par les apprenants.",
    Highlights: '5 modules repensés · 100 % des vidéos sous-titrées · 4,9/5 auprès des apprenants',
    DemoIndex: 3
  }
];

export const DEMO_CERTIFICATIONS: IHomeCertification[] = [
  {
    Id: 1,
    Title: 'Qualiopi — Actions de formation',
    Issuer: 'Cofrac / Marque Qualité',
    Scope: "Certification qualité des actions de formation, obligatoire pour les financeurs publics.",
    ValidUntil: dateInDays(210),
    Status: 'Certifié',
    DemoIndex: 0
  },
  {
    Id: 2,
    Title: 'Datadock',
    Issuer: 'Uniformation',
    Scope: 'Référencement des organismes de formation auprès des OPCO.',
    ValidUntil: dateInDays(120),
    Status: 'Référencé',
    DemoIndex: 1
  },
  {
    Id: 3,
    Title: 'Certification BBI Formateur référent',
    Issuer: 'Business Builders International',
    Scope: 'Référentiel interne : ingénierie, animation, évaluation et posture.',
    ValidUntil: '',
    Status: '42 formateurs certifiés',
    DemoIndex: 2
  },
  {
    Id: 4,
    Title: 'Préparation TOSA / ICDL',
    Issuer: 'Centre agréé',
    Scope: 'Compétences numériques certifiées, éligibles au CPF.',
    ValidUntil: dateInDays(300),
    Status: 'Centre agréé',
    DemoIndex: 3
  }
];

/* ------------------------------------------------------------------ */
/* Lecture SharePoint avec repli systématique                          */
/* ------------------------------------------------------------------ */

export interface IFieldMapping {
  [key: string]: string;
}

/**
 * Découvre les colonnes réellement présentes dans la liste : les colonnes
 * métier absentes sont simplement ignorées, jamais bloquantes.
 */
const readFields = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string
): Promise<string[]> => {
  const endpoint =
    `${stripSlashes(siteUrl)}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields` +
    `?$select=InternalName&$top=500`;
  const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = (await response.json()) as { value?: { InternalName: string }[] };
  return (json.value || []).map((field) => field.InternalName);
};

const pickField = (available: string[], candidates: string[]): string | undefined => {
  for (let i = 0; i < candidates.length; i += 1) {
    if (available.indexOf(candidates[i]) !== -1) {
      return candidates[i];
    }
  }
  return undefined;
};

const buildMapping = (
  available: string[],
  fields: { [key: string]: string[] }
): IFieldMapping => {
  const mapping: IFieldMapping = {};
  Object.keys(fields).forEach((key) => {
    const field = pickField(available, fields[key]);
    if (field) {
      mapping[key] = field;
    }
  });
  return mapping;
};

const baseSelect = (available: string[], names: string[]): string[] =>
  names.filter((name) => available.indexOf(name) !== -1);

const queryItems = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  query: string
): Promise<{ [key: string]: unknown }[]> => {
  const endpoint =
    `${stripSlashes(siteUrl)}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?${query}`;
  const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = (await response.json()) as { value?: { [key: string]: unknown }[] };
  return json.value || [];
};

const NEWS_FIELDS: { [key: string]: string[] } = {
  Summary: ['Summary', 'Resume', 'Résumé', 'Chapo'],
  Category: ['Category', 'Rubrique', 'Categorie'],
  Published: ['Published', 'DatePublication', 'Date'],
  AuthorName: ['AuthorName', 'Auteur'],
  ImageUrl: ['ImageUrl', 'Image', 'Visuel'],
  LinkUrl: ['LinkUrl', 'Lien', 'LienArticle'],
  Body: ['Body', 'Corps', 'Contenu', 'Article']
};

const SESSION_FIELDS: { [key: string]: string[] } = {
  StartDate: ['StartDate', 'DateDebut', 'Debut'],
  EndDate: ['EndDate', 'DateFin', 'Fin'],
  Modality: ['Modality', 'Modalite', 'Modalité'],
  Location: ['Location', 'Lieu', 'Localisation', 'Ville'],
  Status: ['Status', 'Statut', 'Etat'],
  RegistrationUrl: ['RegistrationUrl', 'InscriptionUrl', 'LienInscription'],
  Trainer: ['Trainer', 'Formateur', 'Intervenant', 'FormateursReferents']
};

const TRAINER_FIELDS: { [key: string]: string[] } = {
  Role: ['Role', 'Rôle', 'Fonction', 'Poste'],
  Filiere: ['Filiere', 'Filière', 'Domaine', 'Pole', 'Pôle'],
  Initials: ['Initials', 'Initiales'],
  PhotoUrl: ['PhotoUrl', 'Photo', 'Portrait', 'Avatar', 'Image', 'Visuel'],
  Phone: ['Phone', 'Telephone', 'Téléphone', 'Numero', 'Numéro', 'Tel', 'Mobile'],
  Email: ['Email', 'Mail', 'Courriel', 'EmailPro'],
  WhatsApp: ['WhatsApp', 'Whatsapp', 'WhatsappNumber', 'NumeroWhatsApp'],
  Location: ['Location', 'Localisation', 'Ville', 'Site', 'Bureau'],
  Bio: ['Bio', 'Biographie', 'Presentation', 'Description', 'Parcours'],
  Specialites: ['Specialites', 'Spécialités', 'Expertise', 'Specialite'],
  Certifications: ['Certifications', 'Titres', 'Habilitations'],
  LinkedIn: ['LinkedIn', 'Linkedin', 'LinkedInUrl', 'Profil']
};

const EMPLOYEE_FIELDS: { [key: string]: string[] } = {
  Role: ['Role', 'Rôle', 'Fonction', 'Poste'],
  Pole: ['Pole', 'Pôle', 'Direction', 'Departement'],
  Month: ['Month', 'Mois', 'Periode', 'Période'],
  Message: ['Message', 'Citation', 'Motivation', 'Description'],
  Highlights: ['Highlights', 'Faits', 'Points', 'Realisations'],
  PhotoUrl: ['PhotoUrl', 'Photo', 'Portrait', 'Avatar', 'Image']
};

const CERTIFICATION_FIELDS: { [key: string]: string[] } = {
  Issuer: ['Issuer', 'Organisme', 'Certificateur'],
  Scope: ['Scope', 'Perimetre', 'Périmètre', 'Description', 'Objet'],
  ValidUntil: ['ValidUntil', 'Validite', 'Échéance', 'Echeance', 'DateFin'],
  Status: ['Status', 'Statut', 'Etat']
};

/** Visuel fourni par la liste : conservé tel quel (URL absolue ou relative au site). */
const relativeImage = (value?: string): string | undefined => {
  const clean = (value || '').trim();
  return clean || undefined;
};

/* ------------------------------------------------------------------ */
/* Actualités                                                          */
/* ------------------------------------------------------------------ */

const asNews = (raw: { [key: string]: unknown }, mapping: IFieldMapping): IHomeNews => ({
  Id: Number(raw.Id),
  Title: textOf(raw.Title) || '',
  Summary: mapping.Summary ? textOf(raw[mapping.Summary]) : undefined,
  Category: mapping.Category ? textOf(raw[mapping.Category]) : undefined,
  Published: mapping.Published ? textOf(raw[mapping.Published]) : undefined,
  AuthorName: mapping.AuthorName ? textOf(raw[mapping.AuthorName]) : undefined,
  ImageUrl: mapping.ImageUrl ? textOf(raw[mapping.ImageUrl]) : undefined,
  LinkUrl: mapping.LinkUrl ? textOf(raw[mapping.LinkUrl]) : undefined,
  Body: mapping.Body ? textOf(raw[mapping.Body]) : undefined
});

const asSession = (raw: { [key: string]: unknown }, mapping: IFieldMapping): IHomeSession => ({
  Id: Number(raw.Id),
  Title: textOf(raw.Title) || '',
  StartDate: mapping.StartDate ? textOf(raw[mapping.StartDate]) : undefined,
  EndDate: mapping.EndDate ? textOf(raw[mapping.EndDate]) : undefined,
  Modality: mapping.Modality ? textOf(raw[mapping.Modality]) : undefined,
  Location: mapping.Location ? textOf(raw[mapping.Location]) : undefined,
  Status: mapping.Status ? textOf(raw[mapping.Status]) : undefined,
  RegistrationUrl: mapping.RegistrationUrl ? textOf(raw[mapping.RegistrationUrl]) : undefined,
  Trainer: mapping.Trainer ? textOf(raw[mapping.Trainer]) : undefined
});

const asTrainer = (raw: { [key: string]: unknown }, mapping: IFieldMapping): IHomeTrainer => ({
  Id: Number(raw.Id),
  Title: textOf(raw.Title) || '',
  Role: mapping.Role ? textOf(raw[mapping.Role]) : undefined,
  Filiere: mapping.Filiere ? textOf(raw[mapping.Filiere]) : undefined,
  Initials: mapping.Initials ? textOf(raw[mapping.Initials]) : undefined,
  PhotoUrl: mapping.PhotoUrl ? relativeImage(textOf(raw[mapping.PhotoUrl])) : undefined,
  Phone: mapping.Phone ? textOf(raw[mapping.Phone]) : undefined,
  Email: mapping.Email ? textOf(raw[mapping.Email]) : undefined,
  WhatsApp: mapping.WhatsApp ? textOf(raw[mapping.WhatsApp]) : undefined,
  Location: mapping.Location ? textOf(raw[mapping.Location]) : undefined,
  Bio: mapping.Bio ? textOf(raw[mapping.Bio]) : undefined,
  Specialites: mapping.Specialites ? textOf(raw[mapping.Specialites]) : undefined,
  Certifications: mapping.Certifications ? textOf(raw[mapping.Certifications]) : undefined,
  LinkedIn: mapping.LinkedIn ? textOf(raw[mapping.LinkedIn]) : undefined
});

const asEmployee = (raw: { [key: string]: unknown }, mapping: IFieldMapping): IHomeEmployee => ({
  Id: Number(raw.Id),
  Title: textOf(raw.Title) || '',
  Role: mapping.Role ? textOf(raw[mapping.Role]) : undefined,
  Pole: mapping.Pole ? textOf(raw[mapping.Pole]) : undefined,
  Month: mapping.Month ? textOf(raw[mapping.Month]) : undefined,
  Message: mapping.Message ? textOf(raw[mapping.Message]) : undefined,
  Highlights: mapping.Highlights ? textOf(raw[mapping.Highlights]) : undefined,
  PhotoUrl: mapping.PhotoUrl ? relativeImage(textOf(raw[mapping.PhotoUrl])) : undefined
});

const asCertification = (
  raw: { [key: string]: unknown },
  mapping: IFieldMapping
): IHomeCertification => ({
  Id: Number(raw.Id),
  Title: textOf(raw.Title) || '',
  Issuer: mapping.Issuer ? textOf(raw[mapping.Issuer]) : undefined,
  Scope: mapping.Scope ? textOf(raw[mapping.Scope]) : undefined,
  ValidUntil: mapping.ValidUntil ? textOf(raw[mapping.ValidUntil]) : undefined,
  Status: mapping.Status ? textOf(raw[mapping.Status]) : undefined
});

export const loadHomeNews = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number
): Promise<IHomeListResult<IHomeNews>> => {
  try {
    const fields = await readFields(spHttpClient, siteUrl, listTitle);
    const mapping = buildMapping(fields, NEWS_FIELDS);
    const select = baseSelect(fields, ['Id', 'Title', 'Created'])
      .concat(Object.keys(mapping).map((key) => mapping[key]))
      .filter((value, index, all) => all.indexOf(value) === index);
    const orderBy = mapping.Published ? `${mapping.Published} desc` : 'Created desc';
    const items = await queryItems(
      spHttpClient,
      siteUrl,
      listTitle,
      `$select=${select.join(',')}&$orderby=${orderBy}&$top=${Math.max(1, maxItems)}`
    );
    const news = items.map((raw) => asNews(raw, mapping));
    if (news.length === 0) {
      return { items: DEMO_NEWS, isDemo: true };
    }
    return { items: news, isDemo: false };
  } catch {
    return { items: DEMO_NEWS, isDemo: true };
  }
};

export const loadHomeSessions = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number
): Promise<IHomeListResult<IHomeSession>> => {
  try {
    const fields = await readFields(spHttpClient, siteUrl, listTitle);
    const mapping = buildMapping(fields, SESSION_FIELDS);
    const select = baseSelect(fields, ['Id', 'Title', 'Created'])
      .concat(Object.keys(mapping).map((key) => mapping[key]))
      .filter((value, index, all) => all.indexOf(value) === index);
    const orderBy = mapping.StartDate ? `${mapping.StartDate} asc` : 'Created desc';
    const items = await queryItems(
      spHttpClient,
      siteUrl,
      listTitle,
      `$select=${select.join(',')}&$orderby=${orderBy}&$top=${Math.max(1, maxItems)}`
    );
    const sessions = items.map((raw) => asSession(raw, mapping));
    if (sessions.length === 0) {
      return { items: DEMO_SESSIONS, isDemo: true };
    }
    return { items: sessions, isDemo: false };
  } catch {
    return { items: DEMO_SESSIONS, isDemo: true };
  }
};

export const loadHomeTrainers = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number
): Promise<IHomeListResult<IHomeTrainer>> => {
  try {
    const fields = await readFields(spHttpClient, siteUrl, listTitle);
    const mapping = buildMapping(fields, TRAINER_FIELDS);
    const select = baseSelect(fields, ['Id', 'Title', 'Created'])
      .concat(Object.keys(mapping).map((key) => mapping[key]))
      .filter((value, index, all) => all.indexOf(value) === index);
    const items = await queryItems(
      spHttpClient,
      siteUrl,
      listTitle,
      `$select=${select.join(',')}&$orderby=Title asc&$top=${Math.max(1, maxItems)}`
    );
    const trainers = items
      .map((raw, index) => ({
        ...asTrainer(raw, mapping),
        DemoIndex: index % 4
      }))
      .filter((trainer) => !!trainer.Title);
    if (trainers.length === 0) {
      return { items: DEMO_TRAINERS, isDemo: true };
    }
    return { items: trainers, isDemo: false };
  } catch {
    return { items: DEMO_TRAINERS, isDemo: true };
  }
};

export const loadEmployeeOfMonth = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string
): Promise<IHomeListResult<IHomeEmployee>> => {
  try {
    const fields = await readFields(spHttpClient, siteUrl, listTitle);
    const mapping = buildMapping(fields, EMPLOYEE_FIELDS);
    const select = baseSelect(fields, ['Id', 'Title', 'Created'])
      .concat(Object.keys(mapping).map((key) => mapping[key]))
      .filter((value, index, all) => all.indexOf(value) === index);
    const items = await queryItems(
      spHttpClient,
      siteUrl,
      listTitle,
      `$select=${select.join(',')}&$orderby=Created desc&$top=1`
    );
    const employees = items.map((raw, index) => ({
      ...asEmployee(raw, mapping),
      DemoIndex: index % 4
    }));
    if (employees.length === 0 || !employees[0].Title) {
      return { items: DEMO_EMPLOYEES, isDemo: true };
    }
    return { items: employees, isDemo: false };
  } catch {
    return { items: DEMO_EMPLOYEES, isDemo: true };
  }
};

export const loadHomeCertifications = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number
): Promise<IHomeListResult<IHomeCertification>> => {
  try {
    const fields = await readFields(spHttpClient, siteUrl, listTitle);
    const mapping = buildMapping(fields, CERTIFICATION_FIELDS);
    const select = baseSelect(fields, ['Id', 'Title', 'Created'])
      .concat(Object.keys(mapping).map((key) => mapping[key]))
      .filter((value, index, all) => all.indexOf(value) === index);
    const items = await queryItems(
      spHttpClient,
      siteUrl,
      listTitle,
      `$select=${select.join(',')}&$orderby=Created asc&$top=${Math.max(1, maxItems)}`
    );
    const certifications = items
      .map((raw, index) => ({
        ...asCertification(raw, mapping),
        DemoIndex: index % 4
      }))
      .filter((item) => !!item.Title);
    if (certifications.length === 0) {
      return { items: DEMO_CERTIFICATIONS, isDemo: true };
    }
    return { items: certifications, isDemo: false };
  } catch {
    return { items: DEMO_CERTIFICATIONS, isDemo: true };
  }
};
