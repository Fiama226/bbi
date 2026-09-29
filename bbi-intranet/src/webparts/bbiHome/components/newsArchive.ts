import { SPHttpClient } from '@microsoft/sp-http';
import { IHomeNews, loadHomeNews } from './homeData';

/** Nombre d'actualités par page (pagination du portail et de la vue dédiée). */
export const NEWS_PAGE_SIZE = 5;

/** Nombre maximum d'actualités chargées d'un coup (au-delà : pagination serveur). */
const NEWS_MAX_LOADED = 200;

export interface IHomeNewsPage {
  items: IHomeNews[];
  page: number;
  hasMore: boolean;
  isDemo: boolean;
}

export interface IHomeNewsBundle {
  article?: IHomeNews;
  previous?: IHomeNews;
  next?: IHomeNews;
  others: IHomeNews[];
  isDemo: boolean;
}

/** Pagination locale, sans dépendance : renvoie la tranche demandée. */
export const paginate = <T,>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; totalPages: number; page: number } => {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  return {
    items: items.slice(safePage * safeSize, safePage * safeSize + safeSize),
    totalPages,
    page: safePage
  };
};

/**
 * Charge une page d'actualités, de la plus récente à la plus ancienne.
 * Aucune source disponible → repli sur les actualités de démonstration.
 */
export const loadNewsPage = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  page: number,
  pageSize: number = NEWS_PAGE_SIZE
): Promise<IHomeNewsPage> => {
  const safePage = Math.max(0, page);
  const safeSize = Math.max(1, pageSize);
  // On demande un élément de plus que nécessaire pour savoir s'il reste des pages.
  const upTo = (safePage + 1) * safeSize + 1;
  const result = await loadHomeNews(spHttpClient, siteUrl, listTitle, upTo);
  const bucket = paginate(result.items, safePage, safeSize);
  return {
    items: bucket.items,
    page: bucket.page,
    hasMore: result.items.length > (bucket.page + 1) * safeSize,
    isDemo: result.isDemo
  };
};

/**
 * Charge une actualité et son contexte éditorial :
 * actualité précédente / suivante et autres actualités du réseau.
 */
export const loadNewsItem = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  itemId: number,
  relatedCount: number = 4
): Promise<IHomeNewsBundle> => {
  const result = await loadHomeNews(spHttpClient, siteUrl, listTitle, NEWS_MAX_LOADED);
  const items = result.items;
  if (items.length === 0) {
    return { others: [], isDemo: result.isDemo };
  }
  const foundIndex = itemId ? items.map((item) => item.Id).indexOf(itemId) : 0;
  const index = foundIndex === -1 ? 0 : foundIndex;
  const article = items[index];
  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index < items.length - 1 ? items[index + 1] : undefined;
  const others = items
    .filter((item) => item.Id !== article.Id)
    .slice(0, Math.max(0, relatedCount));
  return {
    article,
    previous,
    next,
    others,
    isDemo: result.isDemo
  };
};
