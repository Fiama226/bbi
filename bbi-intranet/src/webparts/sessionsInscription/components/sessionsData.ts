import { SPHttpClient } from '@microsoft/sp-http';
import { ISessionItem, ISessionsResult } from './ISessionsInscriptionProps';

const stripSlashes = (value: string): string => value.replace(/\/+$/, '');

/** Détecte un code formation du type BBI-MGT-101 dans un titre de session. */
export const codeFromTitle = (title: string): string | undefined => {
  const match = /\b([A-Z]{2,5}-[A-Z]{2,5}-\d{2,4})\b/.exec((title || '').toUpperCase());
  return match ? match[1] : undefined;
};

const demoItem = (
  id: number,
  title: string,
  days: number,
  modality: string,
  location: string,
  status: string,
  code: string,
  filiere: string
): ISessionItem => {
  const start = new Date();
  start.setDate(start.getDate() + days);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 2);
  end.setHours(17, 0, 0, 0);
  return {
    Id: id,
    Title: title,
    StartDate: start.toISOString(),
    EndDate: end.toISOString(),
    Modality: modality,
    Location: location,
    Status: status,
    CodeFormation: code,
    Filiere: filiere
  };
};

export const demoResult = (): ISessionsResult => ({
  items: [
    demoItem(1, "Management d'équipe — Cohorte 7", 7, 'Présentiel', 'Paris', 'Inscriptions ouvertes', 'BBI-MGT-101', 'Management'),
    demoItem(2, "Coaching d'entrepreneurs — Module 1", 14, 'Distanciel', 'Teams', 'Webinaire', 'BBI-COA-201', 'Coaching'),
    demoItem(3, 'Atelier « Traiter les objections »', 21, 'Présentiel', 'Lyon', '3 places', 'BBI-COM-110', 'Commerce'),
    demoItem(4, 'Prospection digitale — promo 12', 30, 'Distanciel', 'Teams', 'Inscriptions ouvertes', 'BBI-DIG-140', 'Digital'),
    demoItem(5, 'Fondamentaux Qualiopi — revue annuelle', 45, 'Distanciel', 'Teams', 'Complet', 'BBI-QUA-301', 'Qualité & Certification')
  ],
  isDemo: true,
  empty: false
});

/**
 * Charge le planning : sessions de la liste, enrichies de la filière de leur formation
 * (résolue via le code contenu dans le titre de la session).
 */
export const loadSessions = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  sessionsListTitle: string,
  formationsListTitle: string,
  maxItems: number,
  showPast: boolean
): Promise<ISessionsResult> => {
  const web = stripSlashes(siteUrl);
  try {
    const select = 'Id,Title,StartDate,Modality,Location,Status,RegistrationUrl';
    const sessionEndpoint =
      `${web}/_api/web/lists/getbytitle('${encodeURIComponent(sessionsListTitle)}')/items` +
      `?$select=${select},EndDate&$orderby=StartDate&$top=${Math.max(maxItems * 4, 60)}`;
    let response = await spHttpClient.get(sessionEndpoint, SPHttpClient.configurations.v1);
    let usedEndDate = true;
    if (!response.ok) {
      // La colonne EndDate n'existe peut-être pas : on réessaie sans.
      usedEndDate = false;
      response = await spHttpClient.get(
        `${web}/_api/web/lists/getbytitle('${encodeURIComponent(sessionsListTitle)}')/items` +
          `?$select=${select}&$orderby=StartDate&$top=${Math.max(maxItems * 4, 60)}`,
        SPHttpClient.configurations.v1
      );
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { value?: { [key: string]: unknown }[] };
    const rawItems = json.value || [];
    if (rawItems.length === 0) {
      // Liste créée mais encore vide : le planning reste servi pour que la page soit présentable.
      return demoResult();
    }

    // Filières : on mappe code formation → filière depuis la liste Formations.
    const filiereByCode: { [code: string]: string } = {};
    try {
      const formationResponse = await spHttpClient.get(
        `${web}/_api/web/lists/getbytitle('${encodeURIComponent(formationsListTitle)}')/items` +
          `?$select=CodeFormation,Filiere&$top=500`,
        SPHttpClient.configurations.v1
      );
      if (formationResponse.ok) {
        const formationJson = (await formationResponse.json()) as {
          value?: { CodeFormation?: string; Filiere?: string }[];
        };
        (formationJson.value || []).forEach((formation) => {
          if (formation.CodeFormation && formation.Filiere) {
            filiereByCode[formation.CodeFormation.toUpperCase()] = formation.Filiere;
          }
        });
      }
    } catch {
      /* la filière est optionnelle */
    }

    const now = Date.now();
    const items: ISessionItem[] = rawItems
      .map((raw) => {
        const title = String(raw.Title || '');
        const code = codeFromTitle(title);
        const item: ISessionItem = {
          Id: Number(raw.Id),
          Title: title,
          StartDate: raw.StartDate ? String(raw.StartDate) : undefined,
          EndDate: usedEndDate && raw.EndDate ? String(raw.EndDate) : undefined,
          Modality: raw.Modality ? String(raw.Modality) : undefined,
          Location: raw.Location ? String(raw.Location) : undefined,
          Status: raw.Status ? String(raw.Status) : undefined,
          RegistrationUrl: raw.RegistrationUrl
            ? String((raw.RegistrationUrl as { Url?: string }).Url || raw.RegistrationUrl)
            : undefined,
          CodeFormation: code,
          Filiere: code ? filiereByCode[code] : undefined
        };
        return item;
      })
      .filter((item) => {
        if (showPast || !item.StartDate) {
          return true;
        }
        return new Date(item.StartDate).getTime() >= now - 86400000;
      })
      .slice(0, maxItems);

    return { items, isDemo: false, empty: items.length === 0 };
  } catch {
    return demoResult();
  }
};
