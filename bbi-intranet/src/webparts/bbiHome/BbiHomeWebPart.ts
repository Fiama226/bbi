import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  IPropertyPanePage,
  PropertyPaneSlider,
  PropertyPaneTextField,
  PropertyPaneToggle
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import strings from 'BbiHomeWebPartStrings';
import BbiHome from './components/BbiHome';
import { IBbiHomeProps } from './components/IBbiHomeProps';

export interface IBbiHomeWebPartProps {
  siteUrl: string;
  newsListTitle: string;
  sessionsListTitle: string;
  trainersListTitle: string;
  formationsListTitle: string;
  documentsLibraryTitle: string;
  maxItems: number;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  navLinks: string;
  quickLinks: string;
  kpis: string;
  announcementText: string;
  footerNote: string;
  showDataNotices: boolean;
  enableAnnouncement: boolean;
  layoutCompact: boolean;
}

const DEFAULT_NAV_LINKS: string = [
  '# Accueil | #accueil',
  '# Accès directs | #acces',
  '# Actualités | #actualites',
  '# Catalogue | #formations',
  '# Ressources | #ressources',
  '# Espace formateurs* | #formateurs'
].join('\n');

const DEFAULT_QUICK_LINKS: string = [
  '▦ | Catalogue des formations | Parcours, modalités et durées | #formations',
  '▣ | Prochaines sessions | Planning et inscriptions | #actualites',
  '▤ | Supports publiés | Consultation en lecture seule | #ressources',
  '◎ | Formateurs référents | Votre réseau d’experts | #formateurs',
  '✆ | Support & FAQ | Une question, une demande | #support'
].join('\n');

const DEFAULT_KPIS: string = [
  '# Une ligne par chiffre : valeur | libellé',
  '# ex. 1 500 | Professionnels formés depuis 2012'
].join('\n');

export default class BbiHomeWebPart extends BaseClientSideWebPart<IBbiHomeWebPartProps> {
  private _themeVariant: IReadonlyTheme | undefined;

  protected onInit(): Promise<void> {
    if (!this.properties.siteUrl) {
      this.properties.siteUrl = this.context.pageContext.web.absoluteUrl;
    }
    if (!this.properties.navLinks) {
      this.properties.navLinks = DEFAULT_NAV_LINKS;
    }
    if (!this.properties.quickLinks) {
      this.properties.quickLinks = DEFAULT_QUICK_LINKS;
    }
    if (!this.properties.kpis) {
      this.properties.kpis = DEFAULT_KPIS;
    }
    return Promise.resolve();
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }
    this._themeVariant = currentTheme;
    if (this.domElement) {
      this.render();
    }
  }

  public render(): void {
    const element: React.ReactElement<IBbiHomeProps> = React.createElement(BbiHome, {
      siteUrl: this.properties.siteUrl,
      newsListTitle: this.properties.newsListTitle,
      sessionsListTitle: this.properties.sessionsListTitle,
      trainersListTitle: this.properties.trainersListTitle,
      formationsListTitle: this.properties.formationsListTitle,
      documentsLibraryTitle: this.properties.documentsLibraryTitle,
      maxItems: this.properties.maxItems || 5,
      heroEyebrow: this.properties.heroEyebrow || '',
      heroTitle: this.properties.heroTitle || '',
      heroSubtitle: this.properties.heroSubtitle || '',
      heroImageUrl: this.properties.heroImageUrl || '',
      primaryCtaLabel: this.properties.primaryCtaLabel || '',
      primaryCtaUrl: this.properties.primaryCtaUrl || '',
      secondaryCtaLabel: this.properties.secondaryCtaLabel || '',
      secondaryCtaUrl: this.properties.secondaryCtaUrl || '',
      navLinks: this.properties.navLinks || '',
      quickLinks: this.properties.quickLinks || '',
      kpis: this.properties.kpis || '',
      announcementText: this.properties.announcementText || '',
      footerNote: this.properties.footerNote || '',
      showDataNotices: this.properties.showDataNotices === true,
      enableAnnouncement: this.properties.enableAnnouncement !== false,
      layoutCompact: this.properties.layoutCompact === true,
      spHttpClient: this.context.spHttpClient,
      isDarkTheme: this._themeVariant ? !!this._themeVariant.isInverted : false,
      hasTeamsContext: !!this.context.sdks.microsoftTeams,
      themeVariant: this._themeVariant,
      strings
    });
    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const pages: IPropertyPanePage[] = [
      {
        header: { description: strings.PropertyPaneDescription },
        groups: [
          {
            groupName: strings.SourceGroupName,
            groupFields: [
              PropertyPaneTextField('siteUrl', {
                label: strings.SiteUrlFieldLabel,
                description: strings.SiteUrlFieldDescription
              }),
              PropertyPaneTextField('newsListTitle', { label: strings.NewsListFieldLabel }),
              PropertyPaneTextField('sessionsListTitle', { label: strings.SessionsListFieldLabel }),
              PropertyPaneTextField('trainersListTitle', { label: strings.TrainersListFieldLabel }),
              PropertyPaneTextField('formationsListTitle', { label: strings.FormationsListFieldLabel }),
              PropertyPaneTextField('documentsLibraryTitle', { label: strings.DocumentsLibraryFieldLabel }),
              PropertyPaneSlider('maxItems', {
                label: strings.MaxItemsFieldLabel,
                min: 3,
                max: 12,
                step: 1,
                showValue: true,
                value: this.properties.maxItems || 5
              })
            ]
          }
        ]
      },
      {
        header: { description: strings.HeroPageDescription },
        groups: [
          {
            groupName: strings.HeroGroupName,
            groupFields: [
              PropertyPaneTextField('heroEyebrow', { label: strings.HeroEyebrowFieldLabel }),
              PropertyPaneTextField('heroTitle', {
                label: strings.HeroTitleFieldLabel,
                multiline: true,
                rows: 2,
                description: strings.HeroTitleFieldDescription
              }),
              PropertyPaneTextField('heroSubtitle', {
                label: strings.HeroSubtitleFieldLabel,
                multiline: true,
                rows: 3
              }),
              PropertyPaneTextField('heroImageUrl', {
                label: strings.HeroImageFieldLabel,
                description: strings.HeroImageFieldDescription
              })
            ]
          },
          {
            groupName: strings.CtaGroupName,
            groupFields: [
              PropertyPaneTextField('primaryCtaLabel', { label: strings.PrimaryCtaLabelFieldLabel }),
              PropertyPaneTextField('primaryCtaUrl', { label: strings.CtaUrlFieldLabel }),
              PropertyPaneTextField('secondaryCtaLabel', { label: strings.SecondaryCtaLabelFieldLabel }),
              PropertyPaneTextField('secondaryCtaUrl', { label: strings.CtaUrlFieldLabel })
            ]
          },
          {
            groupName: strings.NavGroupName,
            groupFields: [
              PropertyPaneTextField('navLinks', {
                label: strings.NavLinksFieldLabel,
                multiline: true,
                rows: 7,
                description: strings.NavLinksFieldDescription
              }),
              PropertyPaneTextField('announcementText', {
                label: strings.AnnouncementFieldLabel,
                description: strings.AnnouncementFieldDescription
              })
            ]
          }
        ]
      },
      {
        header: { description: strings.ContentPageDescription },
        groups: [
          {
            groupName: strings.QuickLinksGroupName,
            groupFields: [
              PropertyPaneTextField('quickLinks', {
                label: strings.QuickLinksFieldLabel,
                multiline: true,
                rows: 6,
                description: strings.QuickLinksFieldDescription
              }),
              PropertyPaneTextField('kpis', {
                label: strings.KpisFieldLabel,
                multiline: true,
                rows: 4,
                description: strings.KpisFieldDescription
              })
            ]
          },
          {
            groupName: strings.OptionsGroupName,
            groupFields: [
              PropertyPaneToggle('enableAnnouncement', {
                label: strings.EnableAnnouncementFieldLabel,
                checked: this.properties.enableAnnouncement !== false
              }),
              PropertyPaneToggle('showDataNotices', {
                label: strings.ShowDataNoticesFieldLabel,
                checked: this.properties.showDataNotices === true
              }),
              PropertyPaneToggle('layoutCompact', {
                label: strings.LayoutCompactFieldLabel,
                checked: this.properties.layoutCompact === true
              }),
              PropertyPaneTextField('footerNote', { label: strings.FooterNoteFieldLabel })
            ]
          }
        ]
      }
    ];

    return { pages };
  }
}
