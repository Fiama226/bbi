import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface IArticleActualiteProps {
  siteUrl: string;
  newsListTitle: string;
  /** Identifiant d'actualité utilisé si l'URL ne porte pas ?itemid= */
  defaultItemId: number;
  maxRelated: number;
  showDataNotices: boolean;
  shareUrl: string;
  spHttpClient: SPHttpClient;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  strings: IBbiArticleActualiteWebPartStrings;
}

export interface IArticleDetail {
  Id?: number;
  Title?: string;
  Summary?: string;
  Category?: string;
  AuthorName?: string;
  Published?: string;
  ImageUrl?: string;
  LinkUrl?: string;
  /** Corps de l'article : champ « Corps » (multi-lignes enrichi) si présent. */
  Body?: string;
}

export interface IArticleRelated {
  Id: number;
  Title: string;
  Category?: string;
  Published?: string;
  ImageUrl?: string;
}

export interface IArticleResult {
  article?: IArticleDetail;
  related: IArticleRelated[];
  isDemo: boolean;
}
