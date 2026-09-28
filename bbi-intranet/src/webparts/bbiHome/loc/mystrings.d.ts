declare interface IBbiHomeWebPartStrings {
  PropertyPaneDescription: string;
  SourceGroupName: string;
  SiteUrlFieldLabel: string;
  SiteUrlFieldDescription: string;
  NewsListFieldLabel: string;
  SessionsListFieldLabel: string;
  TrainersListFieldLabel: string;
  FormationsListFieldLabel: string;
  DocumentsLibraryFieldLabel: string;
  MaxItemsFieldLabel: string;
  PageTitle: string;
  LoadingMessage: string;
}

declare module 'BbiHomeWebPartStrings' {
  const strings: IBbiHomeWebPartStrings;
  export = strings;
}