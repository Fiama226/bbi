import { SPHttpClient } from '@microsoft/sp-http';
import { safeImageUrl } from '../../../shared/safeUrl';
import { listApiUrl } from '../../../shared/sharePointRest';

/**
 * Annonces internes BBI (mariage, naissance, anniversaire, arrivée, départ…).
 *
 * Elles sont distinctes des actualités : elles proviennent d'une liste
 * SharePoint dédiée, « Annonces » par défaut, avec les colonnes :
 *   Title (texte) · AnnonceType (choix) · Body (texte multiligne / HTML)
 *   EventDate (date) · Image (lien image ou URL) · ExpiresOn (date, facultatif)
 *   Author/Created (automatiques)
 * Toutes les colonnes autres que Title sont facultatives.
 */
export interface IAnnouncementItem {
  Id: number;
  Title: string;
  Type: string;
  Body: string;
  EventDate?: string;
  ImageUrl?: string;
  Author?: string;
  Created?: string;
}

export interface IAnnouncementResult {
  items: IAnnouncementItem[];
  isDemo: boolean;
}

const daysFromNow = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

export const DEMO_ANNOUNCEMENTS: IAnnouncementItem[] = [
  {
    Id: 1,
    Title: 'Félicitations à Aïcha et Moussa pour leur mariage !',
    Type: 'Mariage',
    Body:
      "<p>Toute l'équipe BBI adresse ses plus chaleureuses félicitations à Aïcha (pôle Formation) et Moussa pour leur mariage célébré ce week-end à Ouagadougou.</p><p>Nous leur souhaitons beaucoup de bonheur dans cette nouvelle aventure.</p>",
    EventDate: daysFromNow(-2),
    Author: 'Ressources humaines',
  },
  {
    Id: 2,
    Title: 'Joyeux anniversaire à Jean-Baptiste !',
    Type: 'Anniversaire',
    Body:
      "<p>Jean-Baptiste, formateur référent en management, fête son anniversaire aujourd'hui. Un gâteau l'attend à 16 h en salle de pause !</p>",
    EventDate: daysFromNow(0),
    Author: 'Ressources humaines',
  },
  {
    Id: 3,
    Title: 'Bienvenue à Fatimata, nouvelle chargée de clientèle',
    Type: 'Arrivée',
    Body:
      "<p>Fatimata rejoint le pôle Commercial à compter de ce lundi. N'hésitez pas à passer la saluer au 2e étage.</p>",
    EventDate: daysFromNow(-5),
    Author: 'Direction',
  },
  {
    Id: 4,
    Title: 'Naissance : bienvenue au petit Ismaël',
    Type: 'Naissance',
    Body:
      '<p>Nous avons la joie de vous annoncer la naissance du petit Ismaël, fils de notre collègue Paul. La maman et le bébé se portent bien.</p>',
    EventDate: daysFromNow(-8),
    Author: 'Ressources humaines',
  },
];

const FIELD_CANDIDATES: { [key: string]: string[] } = {
  Type: ['AnnonceType', 'TypeAnnonce', 'Category', 'Categorie', 'Type'],
  Body: ['Body', 'Description', 'Contenu', 'Corps', 'Details'],
  EventDate: ['EventDate', 'DateEvenement', 'DateAnnonce', 'Date'],
  ImageUrl: ['Image', 'ImageUrl', 'Photo', 'Visuel'],
  ExpiresOn: ['ExpiresOn', 'Expires', 'DateFin', 'Expiration'],
};

const readFields = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
): Promise<string[]> => {
  const response = await spHttpClient.get(
    listApiUrl(siteUrl, listTitle, 'fields', '?$select=InternalName&$top=500'),
    SPHttpClient.configurations.v1,
  );
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = (await response.json()) as { value?: { InternalName: string }[] };
  return (json.value || []).map((field) => field.InternalName);
};

const asText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'object') {
    const record = value as { Url?: string; serverRelativeUrl?: string; serverUrl?: string };
    if (record.serverRelativeUrl) {
      return `${record.serverUrl || ''}${record.serverRelativeUrl}`;
    }
    return record.Url || '';
  }
  return String(value);
};

/** L'image peut être une colonne Lien, une colonne Image (JSON) ou du texte. */
const imageOf = (value: unknown): string | undefined => {
  let raw = asText(value);
  if (raw.charAt(0) === '{') {
    try {
      const parsed = JSON.parse(raw) as { serverUrl?: string; serverRelativeUrl?: string };
      raw = `${parsed.serverUrl || ''}${parsed.serverRelativeUrl || ''}`;
    } catch {
      raw = '';
    }
  }
  return safeImageUrl(raw);
};

const cache = new Map<string, { expiresAt: number; result: IAnnouncementResult }>();

export const loadAnnouncements = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  maxItems: number,
  itemId?: number,
): Promise<IAnnouncementResult> => {
  if (itemId !== undefined && (!Number.isInteger(itemId) || itemId < 1)) {
    return { items: [], isDemo: false };
  }
  const pageSize = Number.isFinite(maxItems) ? Math.max(1, Math.floor(maxItems)) : 8;
  const title = (listTitle || "").trim() || "Annonces";
  const key = JSON.stringify([siteUrl.replace(/\/+$/, ""), title, pageSize, itemId]);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.result;
  }
  let result: IAnnouncementResult;
  try {
    const fields = await readFields(spHttpClient, siteUrl, title);
    const map: { [key: string]: string } = {};
    Object.keys(FIELD_CANDIDATES).forEach((name) => {
      const found = FIELD_CANDIDATES[name].filter((candidate) => fields.indexOf(candidate) !== -1)[0];
      if (found) {
        map[name] = found;
      }
    });
    const select = ['Id', 'Title', 'Created', 'Author/Title']
      .concat(Object.keys(map).map((name) => map[name]))
      .join(',');
    const nowIso = new Date().toISOString();
    const filter = itemId
      ? `&$filter=Id eq ${itemId}`
      : map.ExpiresOn
      ? `&$filter=(${map.ExpiresOn} eq null) or (${map.ExpiresOn} ge datetime'${nowIso}')`
      : '';
    const response = await spHttpClient.get(
      listApiUrl(
        siteUrl,
        title,
        'items',
        `?$select=${select}&$expand=Author${filter}&$orderby=Created desc&$top=${itemId ? 1 : pageSize}`,
      ),
      SPHttpClient.configurations.v1,
    );
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { value?: { [key: string]: unknown }[] };
    const items = (json.value || [])
      .map((raw) => ({
        Id: Number(raw.Id),
        Title: asText(raw.Title),
        Type: map.Type ? asText(raw[map.Type]) : '',
        Body: map.Body ? asText(raw[map.Body]) : '',
        EventDate: map.EventDate ? asText(raw[map.EventDate]) || undefined : undefined,
        ImageUrl: map.ImageUrl ? imageOf(raw[map.ImageUrl]) : undefined,
        Author: asText((raw.Author as { Title?: string } | undefined)?.Title),
        Created: asText(raw.Created),
      }))
      .filter((item) => Number.isInteger(item.Id) && item.Id > 0 && !!item.Title);
    // A provisioned list with no announcements (or only expired ones) is
    // genuinely empty: never fabricate weddings or birthdays in production.
    result = { items, isDemo: false };
  } catch {
    result = {
      items: itemId ? DEMO_ANNOUNCEMENTS.filter((item) => item.Id === itemId) : DEMO_ANNOUNCEMENTS,
      isDemo: true,
    };
  }
  cache.set(key, { expiresAt: Date.now() + 60 * 1000, result });
  return result;
};

/** Pictogramme associé au type d'annonce. */
export const iconForAnnouncement = (type: string): string => {
  const value = (type || '').toLowerCase();
  if (value.indexOf('mariage') !== -1) { return '💍'; }
  if (value.indexOf('anniv') !== -1) { return '🎂'; }
  if (value.indexOf('naiss') !== -1) { return '👶'; }
  if (value.indexOf('arriv') !== -1 || value.indexOf('bienvenue') !== -1) { return '👋'; }
  if (value.indexOf('départ') !== -1 || value.indexOf('depart') !== -1 || value.indexOf('retraite') !== -1) { return '🌅'; }
  if (value.indexOf('décès') !== -1 || value.indexOf('deces') !== -1 || value.indexOf('condol') !== -1) { return '🕊️'; }
  if (value.indexOf('promo') !== -1 || value.indexOf('félic') !== -1) { return '🏆'; }
  return '📣';
};
