import { SPHttpClient } from '@microsoft/sp-http';
import DOMPurify from 'dompurify';
import { IArticleRelated, IArticleResult, IArticleDetail } from './IArticleActualiteProps';
import { safeHref, safeImageUrl } from '../../../shared/safeUrl';
import { listApiUrl } from '../../../shared/sharePointRest';

const stripSlashes = (value: string): string => value.replace(/\/+$/, '');

/** Colonnes optionnelles : selon que la liste a été enrichie ou non. */
const OPTIONAL_FIELDS: { [key: string]: string[] } = {
  Body: ['Body', 'Corps', 'Contenu', 'Article', 'CorpsDeLAarticle'],
  ImageUrl: ['ImageUrl', 'Image', 'Visuel', 'Image_x0020_'],
  LinkUrl: ['LinkUrl', 'Lien', 'LienArticle']
};

const textOf = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'object') {
    const html = value as { Url?: string; Description?: string };
    return (html.Url || html.Description || '').trim() || undefined;
  }
  return String(value);
};

const readingMinutes = (html: string): number => {
  const words = html
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1).length;
  return Math.max(1, Math.round(words / 200));
};

export const readingTimeOf = (body?: string, fallbackText?: string): number =>
  readingMinutes(body || fallbackText || '');

const demoTemplate = (): IArticleResult => {
  const published = new Date();
  published.setDate(published.getDate() - 3);
  return {
    article: {
      Id: 1,
      Title: '12 nouveaux formateurs certifiés',
      Summary:
        "La session de certification de septembre s'est achevée avec 100 % de réussite. Retour sur trois jours d'apprentissage collectif et sur ce que cela change pour nos clients.",
      Category: 'Certification',
      AuthorName: 'Direction pédagogique',
      Published: published.toISOString(),
      Body:
        "<p>Trois jours, douze formateurs, un seul objectif : garantir la même qualité d'animation sur l'ensemble du réseau BBI.</p>" +
        "<h2>Un parcours exigeant</h2><p>La certification BBI repose sur trois piliers : la maîtrise du contenu pédagogique, la posture d'animation et l'évaluation continue des acquis. Chaque candidat a animé une séquence filmée en conditions réelles, puis reçu un retour structuré de ses pairs.</p>" +
        "<p>Cette promotion affiche 100 % de réussite au premier passage — un niveau jamais atteint depuis la création du parcours. Les évaluations à chaud attribuent une note de <strong>4,8 sur 5</strong> à l'accompagnement des tuteurs.</p>" +
        "<h2>Et maintenant ?</h2><p>Douze nouvelles signatures de qualité pour les prochains trimestres, et une prochaine cohorte annoncée pour février. Les candidatures internes sont ouvertes dans l'espace formateurs.</p>"
    },
    related: [
      { Id: 2, Title: 'Le catalogue des formations évolue', Category: 'Formations', Published: new Date(Date.now() - 10 * 86400000).toISOString() },
      { Id: 3, Title: "Retour sur les ateliers de rentrée", Category: 'Vie BBI', Published: new Date(Date.now() - 18 * 86400000).toISOString() },
      { Id: 4, Title: 'Qualiopi : notre audit blanc est une réussite', Category: 'Certification', Published: new Date(Date.now() - 26 * 86400000).toISOString() }
    ],
    isDemo: true
  };
};

/**
 * Charge l'article et les actualités associées.
 * L'identifiant est lu dans l'URL (?itemid=12) : rien à configurer côté éditeur.
 */
export const loadArticle = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  newsListTitle: string,
  itemId: number,
  maxRelated: number
): Promise<IArticleResult> => {
  const web = stripSlashes(siteUrl);
  try {
    const fieldEndpoint = listApiUrl(
      web,
      newsListTitle,
      'fields',
      '?$select=InternalName&$top=500'
    );
    const fieldResponse = await spHttpClient.get(fieldEndpoint, SPHttpClient.configurations.v1);
    if (!fieldResponse.ok) {
      throw new Error(`HTTP ${fieldResponse.status}`);
    }
    const fieldJson = (await fieldResponse.json()) as { value?: { InternalName: string }[] };
    const fields = (fieldJson.value || []).map((field) => field.InternalName);

    const mapping: { [key: string]: string | undefined } = {};
    Object.keys(OPTIONAL_FIELDS).forEach((key) => {
      mapping[key] = OPTIONAL_FIELDS[key].filter((candidate) => fields.indexOf(candidate) !== -1)[0];
    });

    const select: string[] = ['Id', 'Title', 'Summary', 'Category', 'Published', 'AuthorName'];
    ['Summary', 'Category', 'Published', 'AuthorName'].forEach((field) => {
      if (fields.indexOf(field) === -1 && select.indexOf(field) !== -1) {
        select.splice(select.indexOf(field), 1);
      }
    });
    Object.keys(mapping).forEach((key) => {
      if (mapping[key]) {
        select.push(mapping[key] as string);
      }
    });

    const itemEndpoint = itemId
      ? listApiUrl(web, newsListTitle, `items(${itemId})`, `?$select=${select.join(',')}`)
      : listApiUrl(
          web,
          newsListTitle,
          'items',
          `?$select=${select.join(',')}&$orderby=Published desc&$top=1`
        );

    const itemResponse = await spHttpClient.get(itemEndpoint, SPHttpClient.configurations.v1);
    if (!itemResponse.ok) {
      throw new Error(`HTTP ${itemResponse.status}`);
    }
    const itemJson = (await itemResponse.json()) as
      | { value?: { [key: string]: unknown }[] }
      | { [key: string]: unknown };
    const raw = (itemJson as { value?: { [key: string]: unknown }[] }).value
      ? ((itemJson as { value?: { [key: string]: unknown }[] }).value || [])[0]
      : (itemJson as { [key: string]: unknown });
    if (!raw || !raw.Id) {
      return demoTemplate();
    }

    const article: IArticleDetail = {
      Id: Number(raw.Id),
      Title: textOf(raw.Title),
      Summary: textOf(raw.Summary),
      Category: textOf(raw.Category),
      AuthorName: textOf(raw.AuthorName),
      Published: textOf(raw.Published),
      ImageUrl: mapping.ImageUrl ? safeImageUrl(textOf(raw[mapping.ImageUrl])) : undefined,
      LinkUrl: mapping.LinkUrl ? safeHref(textOf(raw[mapping.LinkUrl])) : undefined,
      Body: mapping.Body ? textOf(raw[mapping.Body]) : undefined
    };

    let related: IArticleRelated[] = [];
    try {
      const relatedEndpoint = listApiUrl(
        web,
        newsListTitle,
        'items',
        `?$select=Id,Title,Category,Published&$orderby=Published desc&$top=${maxRelated + 1}`
      );
      const relatedResponse = await spHttpClient.get(relatedEndpoint, SPHttpClient.configurations.v1);
      if (relatedResponse.ok) {
        const relatedJson = (await relatedResponse.json()) as { value?: IArticleRelated[] };
        related = (relatedJson.value || [])
          .filter((entry) => entry.Id !== article.Id)
          .slice(0, maxRelated);
      }
    } catch {
      related = [];
    }

    return { article, related, isDemo: false };
  } catch {
    return demoTemplate();
  }
};

/**
 * Allowlist sanitizer for SharePoint-authored article HTML. Keep semantic
 * editorial markup, but no scripts, styles, embeds, event handlers or unsafe URLs.
 */
export const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: [
      'a', 'blockquote', 'br', 'caption', 'code', 'del', 'em', 'figcaption',
      'figure', 'h2', 'h3', 'h4', 'hr', 'img', 'ins', 'li', 'mark', 'ol',
      'p', 'pre', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th',
      'thead', 'tr', 'u', 'ul'
    ],
    ALLOWED_ATTR: ['alt', 'colspan', 'height', 'href', 'rowspan', 'src', 'title', 'width'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?:|mailto:|tel:)|(?:\/|#|\.\.?\/))/i,
    FORBID_TAGS: ['embed', 'form', 'iframe', 'input', 'object', 'script', 'style', 'svg', 'math'],
    FORBID_ATTR: ['style']
  });
