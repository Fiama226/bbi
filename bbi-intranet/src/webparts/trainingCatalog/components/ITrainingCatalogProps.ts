import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface ITrainingCatalogProps {
  siteUrl: string;
  listTitle: string;
  maxItems: number;
  initialQuery?: string;
  spHttpClient: SPHttpClient;
  showDataNotices: boolean;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  /** true : intégré dans un portail (la page fournit déjà le titre). */
  embedded?: boolean;
  strings: ITrainingCatalogWebPartStrings;
}

export interface IFormation {
  Id: number;
  Title: string;
  CodeFormation?: string;
  Filiere?: string;
  Modalite?: string;
  DureeH?: number | string;
  Niveau?: string;
  StatutCatalogue?: string;
}
