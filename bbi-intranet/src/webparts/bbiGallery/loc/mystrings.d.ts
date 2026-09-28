declare interface IBbiGalleryWebPartStrings {
  PropertyPaneDescription: string;
  SourceGroupName: string;
  DisplayGroupName: string;
  SiteUrlFieldLabel: string;
  SiteUrlFieldDescription: string;
  LibraryTitleFieldLabel: string;
  LibraryTitleFieldDescription: string;
  MaxItemsFieldLabel: string;
  ColumnsFieldLabel: string;
  ShowCaptionsFieldLabel: string;
  AllowDownloadFieldLabel: string;
  ShowDataNoticesFieldLabel: string;
  AlbumFilterFieldLabel: string;
  AlbumFilterFieldDescription: string;
  WebPartTitle: string;
  AllAlbums: string;
  DemoBanner: string;
  DemoBadge: string;
  EmptyStateTitle: string;
  EmptyStateHint: string;
  VideoBadge: string;
  CloseLabel: string;
  PreviousLabel: string;
  NextLabel: string;
  CounterLabel: string;
  OpenLabel: string;
  LoadingMessage: string;
}

declare module 'BbiGalleryWebPartStrings' {
  const strings: IBbiGalleryWebPartStrings;
  export = strings;
}
