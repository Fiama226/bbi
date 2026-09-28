import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface ISessionsInscriptionProps {
  siteUrl: string;
  sessionsListTitle: string;
  formationsListTitle: string;
  defaultFiliere: string;
  maxItems: number;
  showPast: boolean;
  showDataNotices: boolean;
  spHttpClient: SPHttpClient;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  strings: IBbiSessionsInscriptionWebPartStrings;
}

export interface ISessionItem {
  Id: number;
  Title: string;
  StartDate?: string;
  EndDate?: string;
  Modality?: string;
  Location?: string;
  Status?: string;
  RegistrationUrl?: string;
  /** Code formation extrait du titre (ex. « BBI-MGT-101 »). */
  CodeFormation?: string;
  /** Filière résolue via la liste Formations. */
  Filiere?: string;
}

export interface ISessionsResult {
  items: ISessionItem[];
  isDemo: boolean;
  /** true si la liste ne contient aucune session (à distinguer d'une absence de filtre correspondant). */
  empty: boolean;
}
