import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface IBbiGalleryProps {
  siteUrl: string;
  libraryTitle: string;
  maxItems: number;
  columns: number;
  showCaptions: boolean;
  allowDownload: boolean;
  showDataNotices: boolean;
  albumFilter: string;
  spHttpClient: SPHttpClient;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  /** true : intégré dans un portail (la page fournit déjà le titre). */
  embedded?: boolean;
  strings: IBbiGalleryWebPartStrings;
}

/** Élément de la galerie, tolérant aux colonnes absentes. */
export interface IGalleryItem {
  Id: number;
  Title?: string;
  Description?: string;
  FileRef: string;
  FileLeafRef?: string;
  FileType?: string;
  Album?: string;
  Lieu?: string;
  Credit?: string;
  DatePhoto?: string;
  VideoUrl?: string;
  ThumbUrl?: string;
  /** Champs bruts renvoyés par l'API (lecture défensive). */
  [key: string]: unknown;
}

export interface IGallerySchema {
  exists: boolean;
  fields: string[];
}

/**
 * 'live'  : contenus réels de la bibliothèque
 * 'demo'  : bibliothèque absente, non créée ou encore vide → visuels embarqués
 */
export type GalleryDataState = 'live' | 'demo';

export interface IGalleryResult {
  items: IGalleryItem[];
  schema: IGallerySchema;
  isDemo: boolean;
  state: GalleryDataState;
}
