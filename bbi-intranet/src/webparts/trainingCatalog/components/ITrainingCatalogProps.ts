import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface ITrainingCatalogProps {
  siteUrl: string;
  listTitle: string;
  maxItems: number;
  spHttpClient: SPHttpClient;
  showDataNotices: boolean;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
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
