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

export const DEMO_NEWS: IHomeNews[] = [
  {
    Id: 1,
    Title: '12 nouveaux formateurs certifiés',
    Summary: "La session de certification de septembre s'est achevée avec 100 % de réussite. Retour sur trois jours d'apprentissage collectif.",
    Category: 'Certification',
    Published: '2026-09-25T09:00:00Z',
    AuthorName: 'Direction pédagogique'
  },
  {
    Id: 2,
    Title: 'Le catalogue des formations évolue',
    Summary: 'Découvrez les nouveaux parcours de management et de développement commercial.',
    Category: 'Formations',
    Published: '2026-09-18T09:00:00Z',
    AuthorName: 'Équipe BBI'
  },
  {
    Id: 3,
    Title: 'Retour sur les ateliers de rentrée',
    Summary: 'Les équipes se sont retrouvées autour de nouvelles méthodes pédagogiques.',
    Category: 'Vie BBI',
    Published: '2026-09-10T09:00:00Z',
    AuthorName: 'Communication BBI'
  }
];

export const DEMO_SESSIONS: IHomeSession[] = [
  { Id: 1, Title: "Management d'équipe — Cohorte 7", StartDate: dateInDays(7), Modality: 'Présentiel', Location: 'Paris', Status: 'Inscriptions ouvertes' },
  { Id: 2, Title: "Coaching d'entrepreneurs — Module 1", StartDate: dateInDays(14), Modality: 'Distanciel', Location: 'Teams', Status: 'Webinaire' },
  { Id: 3, Title: 'Atelier « Traiter les objections »', StartDate: dateInDays(21), Modality: 'Présentiel', Location: 'Lyon', Status: '3 places' },
  { Id: 4, Title: 'Fondamentaux Qualiopi — revue', StartDate: dateInDays(35), Modality: 'Distanciel', Location: 'Teams', Status: 'Webinaire' }
];

export const DEMO_TRAINERS: IHomeTrainer[] = [
  { Id: 1, Title: 'Amélie Martin', Role: 'Responsable pédagogique', Filiere: 'Management & Qualité', Initials: 'AM' },
  { Id: 2, Title: 'Stéphane Laurent', Role: 'Coach certifié', Filiere: 'Coaching & leadership', Initials: 'SL' },
  { Id: 3, Title: 'Khadija Diallo', Role: 'Formatrice', Filiere: 'Commerce & négociation', Initials: 'KD' },
  { Id: 4, Title: 'Thomas Bernard', Role: 'Formateur', Filiere: 'Digital & prospection', Initials: 'TB' }
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
    return { items: json.value || [], isDemo: false };
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
);

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