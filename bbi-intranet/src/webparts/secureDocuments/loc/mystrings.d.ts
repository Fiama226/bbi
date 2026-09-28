declare interface ISecureDocumentsWebPartStrings {
  PropertyPaneDescription: string;
  BasicGroupName: string;
  SiteUrlFieldLabel: string;
  SiteUrlFieldDescription: string;
  LibraryFieldLabel: string;
  LibraryFieldDescription: string;
  MaxItemsFieldLabel: string;
  ShowDataNoticesFieldLabel: string;
  DemoOpenDisabled: string;
  WebPartTitle: string;
  ProtectionBanner: string;
  ReadOnlyBadge: string;
  OpenInBrowser: string;
  DemoBanner: string;
  EmptyStateTitle: string;
  EmptyStateHint: string;
}

declare module 'SecureDocumentsWebPartStrings' {
  const strings: ISecureDocumentsWebPartStrings;
  export = strings;
}
