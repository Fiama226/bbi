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
}

export interface IHomeSession {
  Id: number;
  Title: string;
  StartDate?: string;
  Modality?: string;
  Location?: string;
  Status?: string;
  RegistrationUrl?: string;
}

export interface IHomeTrainer {
  Id: number;
  Title: string;
  Role?: string;
  Filiere?: string;
  Initials?: string;
}

export interface IHomeListResult<T> {
  items: T[];
  isDemo: boolean;
}

const dateInDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
};

const hyperlinkUrlOf = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (value && typeof value === 'object') {
    const url = (value as { Url?: unknown }).Url;
    return typeof url === 'string' ? url.trim() || undefined : undefined;
  }
  return undefined;
};

export const DEMO_NEWS: IHomeNews[] = [
  {
    Id: 1,
    Title: '12 nouveaux formateurs certifiés',
    Summary: "La session de certification de septembre s'est achevée avec 100 % de réussite. Retour sur trois jours d'apprentissage collectif et sur ce que cela change pour nos clients.",
    Category: 'Certification',
    Published: '2026-09-25T09:00:00Z',
    AuthorName: 'Direction pédagogique'
  },
  {
    Id: 2,
    Title: 'Le catalogue des formations évolue',
    Summary: 'Deux nouveaux parcours de management, un module e-learning de prospection digitale et une formation Qualiopi renforcée arrivent au catalogue.',
    Category: 'Formations',
    Published: '2026-09-18T09:00:00Z',
    AuthorName: 'Équipe BBI'
  },
  {
    Id: 3,
    Title: 'Qualiopi : notre audit blanc est une réussite',
    Summary: "Quatorze indicateurs sur quatorze validés. La direction qualité fait le point sur les dernières actions correctives engagées.",
    Category: 'Qualité',
    Published: '2026-09-12T09:00:00Z',
    AuthorName: 'Qualité BBI'
  },
  {
    Id: 4,
    Title: 'Trois nouvelles antennes BBI en Afrique de l’Ouest',
    Summary: "Abidjan, Dakar et Bamako rejoignent le réseau. Les premières cohortes locales démarrent au premier trimestre.",
    Category: 'Réseau',
    Published: '2026-08-28T09:00:00Z',
    AuthorName: 'Direction générale'
  },
  {
    Id: 5,
    Title: 'Retour sur les ateliers de rentrée',
    Summary: 'Les équipes se sont retrouvées autour de nouvelles méthodes pédagogiques et de la refonte de nos grilles d’évaluation.',
    Category: 'Vie BBI',
    Published: '2026-08-15T09:00:00Z',
    AuthorName: 'Communication BBI'
  },
  {
    Id: 6,
    Title: 'Lancement du module e-learning « Prospection digitale »',
    Summary: "Cinq micro-séquences, des cas réels et une mise en situation filmée : le nouveau parcours est disponible pour tous les adhérents.",
    Category: 'Formations',
    Published: '2026-07-30T09:00:00Z',
    AuthorName: 'Digital BBI'
  }
];

export const DEMO_SESSIONS: IHomeSession[] = [
  { Id: 1, Title: "Management d'équipe — Cohorte 7", StartDate: dateInDays(7), Modality: 'Présentiel', Location: 'Paris', Status: 'Inscriptions ouvertes' },
  { Id: 2, Title: "Coaching d'entrepreneurs — Module 1", StartDate: dateInDays(14), Modality: 'Distanciel', Location: 'Teams', Status: 'Webinaire' },
  { Id: 3, Title: 'Atelier « Traiter les objections »', StartDate: dateInDays(21), Modality: 'Présentiel', Location: 'Lyon', Status: '3 places' },
  { Id: 4, Title: 'Prospection digitale — promo 12', StartDate: dateInDays(30), Modality: 'Distanciel', Location: 'Teams', Status: 'Inscriptions ouvertes' },
  { Id: 5, Title: 'Fondamentaux Qualiopi — revue annuelle', StartDate: dateInDays(35), Modality: 'Distanciel', Location: 'Teams', Status: 'Webinaire' },
  { Id: 6, Title: 'Négociation commerciale avancée', StartDate: dateInDays(48), Modality: 'Présentiel', Location: 'Dakar', Status: 'Inscriptions ouvertes' },
  { Id: 7, Title: 'Leadership & gestion du changement', StartDate: dateInDays(62), Modality: 'Hybride', Location: 'Paris / Teams', Status: 'Liste d’attente' },
  { Id: 8, Title: 'Atelier « Prise de parole en public »', StartDate: dateInDays(75), Modality: 'Présentiel', Location: 'Abidjan', Status: '5 places' }
];

export const DEMO_TRAINERS: IHomeTrainer[] = [
  { Id: 1, Title: 'Amélie Martin', Role: 'Responsable pédagogique', Filiere: 'Management & Qualité', Initials: 'AM' },
  { Id: 2, Title: 'Stéphane Laurent', Role: 'Coach certifié', Filiere: 'Coaching & leadership', Initials: 'SL' },
  { Id: 3, Title: 'Khadija Diallo', Role: 'Formatrice', Filiere: 'Commerce & négociation', Initials: 'KD' },
  { Id: 4, Title: 'Thomas Bernard', Role: 'Formateur', Filiere: 'Digital & prospection', Initials: 'TB' },
  { Id: 5, Title: 'Marie-Claire Ngoma', Role: 'Consultante qualité', Filiere: 'Qualité & certification', Initials: 'MN' },
  { Id: 6, Title: 'Youssef El Amrani', Role: 'Formateur', Filiere: 'Leadership & changement', Initials: 'YA' },
  { Id: 7, Title: 'Claire Fontaine', Role: 'Coach certifiée', Filiere: 'Coaching d’entrepreneurs', Initials: 'CF' },
  { Id: 8, Title: 'Jean-Marc Okafor', Role: 'Directeur pédagogique', Filiere: 'Management', Initials: 'JO' }
];

async function loadList<T>(
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  select: string,
  orderBy: string,
  maxItems: number,
  demoItems: T[]
): Promise<IHomeListResult<T>> {
  const escapedTitle = encodeURIComponent(listTitle);
  const endpoint = `${siteUrl.replace(/\/+$/, '')}/_api/web/lists/getbytitle('${escapedTitle}')/items` +
    `?$select=${select}&$orderby=${orderBy}&$top=${maxItems}`;

  try {
    const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = await response.json() as { value?: T[] };
    const items = json.value || [];
    if (items.length === 0) {
      // Liste créée mais encore vide : la page d'accueil reste complète et crédible.
      return { items: demoItems, isDemo: true };
    }
    return { items, isDemo: false };
  } catch {
    return { items: demoItems, isDemo: true };
  }
}

export const loadHomeNews = (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number
): Promise<IHomeListResult<IHomeNews>> => loadList(
  spHttpClient,
  siteUrl,
  listTitle,
  'Id,Title,Summary,Category,Published,AuthorName,ImageUrl,LinkUrl',
  'Published desc',
  maxItems,
  DEMO_NEWS
).then((result) => ({
  ...result,
  items: result.items.map((item) => ({
    ...item,
    ImageUrl: hyperlinkUrlOf(item.ImageUrl),
    LinkUrl: hyperlinkUrlOf(item.LinkUrl)
  }))
}));

export const loadHomeSessions = (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number
): Promise<IHomeListResult<IHomeSession>> => loadList(
  spHttpClient,
  siteUrl,
  listTitle,
  'Id,Title,StartDate,Modality,Location,Status,RegistrationUrl',
  'StartDate asc',
  maxItems,
  DEMO_SESSIONS
);

export const loadHomeTrainers = (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number
): Promise<IHomeListResult<IHomeTrainer>> => loadList(
  spHttpClient,
  siteUrl,
  listTitle,
  'Id,Title,Role,Filiere,Initials',
  'Title asc',
  maxItems,
  DEMO_TRAINERS
);