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
  employeeListTitle: string;
  certificationsListTitle: string;
  announcementsListTitle: string;
  maxItems: number;

  /* --- Héros --- */
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  /** Diaporama du héros : une ligne par diapositive (voir HomeHero). */
  heroSlides: string;
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

  /* --- Identité (vision, mission, objectifs) --- */
  visionText: string;
  missionText: string;
  /** Une ligne = un objectif. */
  objectivesText: string;

  /* --- Contact support --- */
  supportEmail: string;
  supportPhone: string;

  /* --- Options d'affichage --- */
  showDataNotices: boolean;
  enableAnnouncement: boolean;
  layoutCompact: boolean;

  /* --- Utilisateur connecté (salutation) --- */
  userName?: string;

  /* --- Contexte SPFx --- */
  spHttpClient: SPHttpClient;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  strings: IBbiHomeWebPartStrings;
}
