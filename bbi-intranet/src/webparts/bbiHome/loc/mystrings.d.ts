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

  HeroPageDescription: string;
  HeroGroupName: string;
  HeroEyebrowFieldLabel: string;
  HeroTitleFieldLabel: string;
  HeroTitleFieldDescription: string;
  HeroSubtitleFieldLabel: string;
  HeroImageFieldLabel: string;
  HeroImageFieldDescription: string;
  CtaGroupName: string;
  PrimaryCtaLabelFieldLabel: string;
  SecondaryCtaLabelFieldLabel: string;
  CtaUrlFieldLabel: string;
  NavGroupName: string;
  NavLinksFieldLabel: string;
  NavLinksFieldDescription: string;
  AnnouncementFieldLabel: string;
  AnnouncementFieldDescription: string;

  ContentPageDescription: string;
  QuickLinksGroupName: string;
  QuickLinksFieldLabel: string;
  QuickLinksFieldDescription: string;
  KpisFieldLabel: string;
  KpisFieldDescription: string;
  OptionsGroupName: string;
  EnableAnnouncementFieldLabel: string;
  ShowDataNoticesFieldLabel: string;
  LayoutCompactFieldLabel: string;
  FooterNoteFieldLabel: string;

  PageTitle: string;
  LoadingMessage: string;
}

declare module 'BbiHomeWebPartStrings' {
  const strings: IBbiHomeWebPartStrings;
  export = strings;
}
