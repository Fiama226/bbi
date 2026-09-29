import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface IBbiHomeProps {
  /* --- Sources de données --- */
  siteUrl: string;
  newsListTitle: string;
  sessionsListTitle: string;
  trainersListTitle: string;
  formationsListTitle: string;
  documentsLibraryTitle: string;
  galleryLibraryTitle: string;
  maxItems: number;

  /* --- Héros --- */
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;

  /* --- Blocs de contenu (texte multilingue, une ligne = un élément) --- */
  navLinks: string;
  quickLinks: string;
  kpis: string;
  announcementText: string;
  footerNote: string;

  /* --- Options d'affichage --- */
  showDataNotices: boolean;
  enableAnnouncement: boolean;
  layoutCompact: boolean;

  /* --- Contexte SPFx --- */
  spHttpClient: SPHttpClient;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  strings: IBbiHomeWebPartStrings;
}
