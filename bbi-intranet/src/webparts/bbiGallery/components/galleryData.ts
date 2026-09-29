import { SPHttpClient } from '@microsoft/sp-http';
import { IGalleryItem, IGalleryResult, IGallerySchema } from './IBbiGalleryProps';

/** Colonnes optionnelles recherchées dans la bibliothèque, par ordre de préférence. */
const OPTIONAL_FIELDS: { [key: string]: string[] } = {
  Album: ['Album', 'AlbumPhoto', 'Categorie', 'Category'],
  Lieu: ['Lieu', 'Location', 'Ville'],
  Credit: ['Credit', 'Credits', 'Auteur', 'Photographe'],
  DatePhoto: ['DatePhoto', 'DatePrise', 'Date_x0020_de_x0020_prise'],
  VideoUrl: ['VideoUrl', 'LienVideo', 'Lien_x0020_vid_x00e9_o'],
  ThumbUrl: ['Vignette', 'ThumbUrl', 'Miniature'],
  Description: ['Description', 'Legende', 'Commentaire']
};

const IMAGE_EXTENSIONS: string[] = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic'];
const VIDEO_EXTENSIONS: string[] = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'wmv'];

const stripSlashes = (value: string): string => value.replace(/\/+$/, '');

const extensionOf = (value?: string): string => {
  if (!value) {
    return '';
  }
  const clean = value.split('?')[0];
  const parts = clean.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/** Lit un champ SharePoint potentiellement Hyperlink ({ Url, Description }) ou texte. */
export const textOf = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'object') {
    const candidate = value as { Url?: string; Description?: string };
    return (candidate.Url || candidate.Description || '').trim() || undefined;
  }
  return String(value);
};

export const isVideo = (item: IGalleryItem): boolean => {
  if (!item) {
    return false;
  }
  if (item.VideoUrl) {
    return true;
  }
  const ext = extensionOf(item.FileLeafRef || item.FileRef);
  if (VIDEO_EXTENSIONS.indexOf(ext) !== -1) {
    return true;
  }
  return !!item.FileType && VIDEO_EXTENSIONS.indexOf(item.FileType.toLowerCase()) !== -1;
};

export const isImage = (item: IGalleryItem): boolean => {
  const ext = extensionOf(item.FileLeafRef || item.FileRef);
  if (item.FileType) {
    return IMAGE_EXTENSIONS.indexOf(item.FileType.toLowerCase()) !== -1;
  }
  return IMAGE_EXTENSIONS.indexOf(ext) !== -1;
};

/** Élément de démonstration : la photo est embarquée dans la web part, pas de fichier à charger. */
export const isDemoItem = (item: IGalleryItem): boolean =>
  (item.FileRef || '').indexOf('demo:') === 0;

/**
 * Vignette : utilise la miniature fournie si elle existe, sinon la redimension
 * dynamique SharePoint Online (`?width=`), servie par le cache BLOB.
 */
export const thumbUrlOf = (item: IGalleryItem, width: number): string => {
  if (item.ThumbUrl) {
    return item.ThumbUrl;
  }
  if (isDemoItem(item) || !isImage(item)) {
    return '';
  }
  return `${item.FileRef}${item.FileRef.indexOf('?') === -1 ? '?' : '&'}width=${width}`;
};

export const previewUrlOf = (item: IGalleryItem): string => {
  if (isDemoItem(item) || !isImage(item)) {
    return '';
  }
  const separator = item.FileRef.indexOf('?') === -1 ? '?' : '&';
  return `${item.FileRef}${separator}width=1600`;
};

export const formatDateFr = (value?: string): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

const pickField = (available: string[], candidates: string[]): string | undefined => {
  for (let i = 0; i < candidates.length; i += 1) {
    if (available.indexOf(candidates[i]) !== -1) {
      return candidates[i];
    }
  }
  return undefined;
};

const buildMapping = (available: string[]): { [key: string]: string } => {
  const mapping: { [key: string]: string } = {};
  Object.keys(OPTIONAL_FIELDS).forEach((key) => {
    const field = pickField(available, OPTIONAL_FIELDS[key]);
    if (field) {
      mapping[key] = field;
    }
  });
  return mapping;
};

const readFields = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  libraryTitle: string
): Promise<string[]> => {
  const endpoint =
    `${stripSlashes(siteUrl)}/_api/web/lists/getbytitle('${encodeURIComponent(libraryTitle)}')/fields` +
    `?$select=InternalName,TypeAsString&$top=500`;
  const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = (await response.json()) as { value?: { InternalName: string }[] };
  return (json.value || []).map((field) => field.InternalName);
};

/** Dates de démonstration relatives à aujourd'hui : jamais périmées. */
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
};

interface IDemoSeed {
  Title: string;
  Album: string;
  Lieu: string;
  Credit: string;
  Days: number;
}

const DEMO_SEED: IDemoSeed[] = [
  { Title: 'Atelier « Prise de parole en public » — Paris', Album: 'Sessions de formation', Lieu: 'Paris', Credit: 'Communication BBI', Days: 6 },
  { Title: 'Séminaire annuel des formateurs — Dakar', Album: 'Vie BBI', Lieu: 'Dakar', Credit: 'Équipe BBI', Days: 14 },
  { Title: 'Remise des attestations — promotion de septembre', Album: 'Certifications', Lieu: 'Paris', Credit: 'Direction pédagogique', Days: 22 },
  { Title: 'Tournage du module e-learning — plateau BBI', Album: 'Coulisses', Lieu: 'Studio', Credit: 'Communication BBI', Days: 31 },
  { Title: "Coaching d'entrepreneurs — promotion 12", Album: 'Sessions de formation', Lieu: 'Lyon', Credit: 'Équipe BBI', Days: 44 },
  { Title: "Atelier d'idéation : refonte du catalogue", Album: 'Vie BBI', Lieu: 'Abidjan', Credit: 'Direction pédagogique', Days: 58 },
  { Title: 'Qualiopi : audit blanc réussi', Album: 'Certifications', Lieu: 'Paris', Credit: 'Qualité BBI', Days: 72 },
  { Title: 'Coulisses du module « Traiter les objections »', Album: 'Coulisses', Lieu: 'Studio', Credit: 'Communication BBI', Days: 88 },
  { Title: 'Table ronde « Recruter et fidéliser ses talents »', Album: 'Vie BBI', Lieu: 'Paris', Credit: 'Communication BBI', Days: 96 },
  { Title: 'Management d’équipe — cohorte 7, module 2', Album: 'Sessions de formation', Lieu: 'Paris', Credit: 'Équipe BBI', Days: 104 },
  { Title: 'Formation des formateurs — immersion terrain', Album: 'Certifications', Lieu: 'Lyon', Credit: 'Direction pédagogique', Days: 118 },
  { Title: 'Afterwork réseau BBI — antenne Abidjan', Album: 'Vie BBI', Lieu: 'Abidjan', Credit: 'Équipe BBI', Days: 132 }
];

const demoItems = (): IGalleryItem[] =>
  DEMO_SEED.map((seed, index) => ({
    Id: -1 * (index + 1),
    Title: seed.Title,
    Album: seed.Album,
    Lieu: seed.Lieu,
    Credit: seed.Credit,
    DatePhoto: daysAgo(seed.Days),
    FileRef: `demo:${index}`,
    FileLeafRef: `demo-${index + 1}.jpg`,
    FileType: 'jpg',
    Description: 'Visuel de démonstration livré avec la web part.',
    DemoIndex: index % 4
  }));

const emptySchema: IGallerySchema = { exists: false, fields: [] };

const asDemo = (): IGalleryResult => ({
  items: demoItems(),
  schema: emptySchema,
  isDemo: true,
  state: 'demo'
});

/**
 * Charge la galerie : lecture du schéma réel de la bibliothèque puis des éléments.
 *
 * · bibliothèque absente ou non encore créée  → contenu de démonstration (visuels embarqués)
 * · bibliothèque présente mais vide           → contenu de démonstration également, pour que
 *                                               la page reste impeccable dès le premier jour
 * · bibliothèque alimentée                     → vos contenus réels, sans aucune mention technique
 *
 * Les colonnes métier absentes sont simplement ignorées : jamais d'erreur bloquante.
 */
export const loadGallery = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  libraryTitle: string,
  maxItems: number,
  albumFilter: string
): Promise<IGalleryResult> => {
  try {
    const fields = await readFields(spHttpClient, siteUrl, libraryTitle);
    const mapping = buildMapping(fields);
    const selectFields = ['Id', 'Title', 'FileRef', 'FileLeafRef', 'File_x0020_Type', 'Created'];
    Object.keys(mapping).forEach((key) => {
      if (selectFields.indexOf(mapping[key]) === -1) {
        selectFields.push(mapping[key]);
      }
    });
    const orderBy = mapping.DatePhoto ? `${mapping.DatePhoto} desc` : 'Created desc';
    const filter =
      albumFilter && mapping.Album
        ? `&$filter=${mapping.Album} eq '${albumFilter.replace(/'/g, "''")}'`
        : '';
    const endpoint =
      `${stripSlashes(siteUrl)}/_api/web/lists/getbytitle('${encodeURIComponent(libraryTitle)}')/items` +
      `?$select=${selectFields.join(',')}${filter}&$orderby=${orderBy}&$top=${maxItems * 3}`;

    const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { value?: { [key: string]: unknown }[] };
    const raw = json.value || [];
    const items: IGalleryItem[] = raw.map((entry) => ({
      Id: Number(entry.Id),
      Title: textOf(entry.Title),
      Description: mapping.Description ? textOf(entry[mapping.Description]) : undefined,
      FileRef: textOf(entry.FileRef) || '',
      FileLeafRef: textOf(entry.FileLeafRef),
      FileType: textOf(entry.File_x0020_Type),
      Album: mapping.Album ? textOf(entry[mapping.Album]) : undefined,
      Lieu: mapping.Lieu ? textOf(entry[mapping.Lieu]) : undefined,
      Credit: mapping.Credit ? textOf(entry[mapping.Credit]) : undefined,
      DatePhoto: mapping.DatePhoto ? textOf(entry[mapping.DatePhoto]) : textOf(entry.Created),
      VideoUrl: mapping.VideoUrl ? textOf(entry[mapping.VideoUrl]) : undefined,
      ThumbUrl: mapping.ThumbUrl ? textOf(entry[mapping.ThumbUrl]) : undefined
    }));

    const visible = items
      .filter((item) => item.FileRef && (isImage(item) || isVideo(item)))
      .slice(0, maxItems);

    if (visible.length === 0) {
      // Bibliothèque prête mais encore vide : on sert les visuels de démonstration.
      return asDemo();
    }

    return {
      items: visible,
      schema: { exists: true, fields },
      isDemo: false,
      state: 'live'
    };
  } catch {
    // Bibliothèque absente ou inaccessible : contenu de démonstration.
    return asDemo();
  }
};
