import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface ISecureDocumentsProps {
  siteUrl: string;
  libraryTitle: string;
  maxItems: number;
  spHttpClient: SPHttpClient;
  showDataNotices: boolean;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  strings: ISecureDocumentsWebPartStrings;
}

export interface ISecureDocument {
  Id: number;
  Title?: string;
  FileRef: string;
  FileLeafRef: string;
  Modified?: string;
}
