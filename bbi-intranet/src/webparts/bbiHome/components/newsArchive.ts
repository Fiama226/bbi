import { SPHttpClient } from '@microsoft/sp-http';
import {
  DEMO_NEWS,
  IHomeNews,
  IHomeNewsApiPage,
  loadHomeNews,
  loadHomeNewsById,
  loadHomeNewsPage
} from './homeData';

/** Nombre d'actualités par page (pagination du portail et de la vue dédiée). */
export const NEWS_PAGE_SIZE = 5;

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

/** Pagination locale pour données déjà chargées, et pour jeux de démonstration. */
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

interface INewsPageCache {
  pages: IHomeNewsPage[];
  nextUrls: (string | undefined)[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 1000;
const pageCache = new Map<string, INewsPageCache>();

const cacheKeyOf = (siteUrl: string, listTitle: string, pageSize: number): string =>
  `${siteUrl.replace(/\/+$/, '')}|${listTitle}|${pageSize}`;

const demoPage = (page: number, pageSize: number): IHomeNewsPage => {
  const result = paginate(DEMO_NEWS, page, pageSize);
  return {
    items: result.items,
    page: result.page,
    hasMore: result.page < result.totalPages - 1,
    isDemo: true
  };
};

/** Load exactly one SharePoint page at a time and follow the server continuation link. */
export const loadNewsPage = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  page: number,
  pageSize: number = NEWS_PAGE_SIZE
): Promise<IHomeNewsPage> => {
  const safePage = Math.max(0, Math.floor(page));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const key = cacheKeyOf(siteUrl, listTitle, safeSize);
  let cache = pageCache.get(key);
  if (!cache || cache.expiresAt < Date.now()) {
    cache = { pages: [], nextUrls: [undefined], expiresAt: Date.now() + CACHE_TTL_MS };
    pageCache.set(key, cache);
  }

  while (cache.pages.length <= safePage) {
    const currentPage = cache.pages.length;
    if (currentPage > 0 && !cache.nextUrls[currentPage]) {
      break;
    }
    const result: IHomeNewsApiPage = await loadHomeNewsPage(
      spHttpClient,
      siteUrl,
      listTitle,
      safeSize,
      cache.nextUrls[currentPage]
    );

    if (result.isDemo) {
      const totalDemoPages = Math.max(1, Math.ceil(DEMO_NEWS.length / safeSize));
      for (let index = 0; index < totalDemoPages; index += 1) {
        cache.pages[index] = demoPage(index, safeSize);
        cache.nextUrls[index + 1] = undefined;
      }
      break;
    }

    cache.pages[currentPage] = {
      items: result.items,
      page: currentPage,
      hasMore: !!result.nextUrl,
      isDemo: false
    };
    cache.nextUrls[currentPage + 1] = result.nextUrl;
    if (!result.nextUrl) {
      break;
    }
  }

  return cache.pages[safePage] || {
    items: [],
    page: safePage,
    hasMore: false,
    isDemo: cache.pages[0] ? cache.pages[0].isDemo : false
  };
};

/**
 * Load an article directly by ID. Recent items provide adjacent/related links,
 * but never determine whether an old, directly linked article can be opened.
 */
export const loadNewsItem = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  itemId: number,
  relatedCount: number = 4
): Promise<IHomeNewsBundle> => {
  const recentResult = await loadHomeNews(
    spHttpClient,
    siteUrl,
    listTitle,
    Math.max(10, relatedCount + 2)
  );
  const recent = recentResult.items;
  let article: IHomeNews | undefined;

  if (itemId > 0 && !recentResult.isDemo) {
    article = await loadHomeNewsById(spHttpClient, siteUrl, listTitle, itemId);
  } else if (itemId > 0) {
    article = recent.filter((item) => item.Id === itemId)[0];
  } else {
    article = recent[0];
  }

  if (!article) {
    return {
      others: recent.slice(0, Math.max(0, relatedCount)),
      isDemo: recentResult.isDemo
    };
  }

  const index = recent.map((item) => item.Id).indexOf(article.Id);
  const previous = index > 0 ? recent[index - 1] : undefined;
  const next = index >= 0 && index < recent.length - 1 ? recent[index + 1] : undefined;
  const others = recent
    .filter((item) => item.Id !== article.Id)
    .slice(0, Math.max(0, relatedCount));

  return {
    article,
    previous,
    next,
    others,
    isDemo: recentResult.isDemo
  };
};
