import { SPHttpClient } from '@microsoft/sp-http';

export interface IBbiHomeProps {
  siteUrl: string;
  newsListTitle: string;
  sessionsListTitle: string;
  trainersListTitle: string;
  formationsListTitle: string;
  documentsLibraryTitle: string;
  maxItems: number;
  spHttpClient: SPHttpClient;
  strings: IBbiHomeWebPartStrings;
}