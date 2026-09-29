import { DisplayMode, Version } from '@microsoft/sp-core-library';
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
  galleryLibraryTitle: string;
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
  '# Formations | #formations',
  '# Sessions | #sessions',
  '# Actualités | #actualites',
  '# Ressources | #ressources',
  '# Communauté | #communaute'
].join('\n');

const DEFAULT_QUICK_LINKS: string = [
  '▦ | Catalogue des formations | Parcours, modalités et durées | #formations',
  '▣ | Prochaines sessions | Planning et inscriptions | #sessions',
  '▤ | Supports & médias | Documents, photos et vidéos | #ressources',
  '◎ | Communauté BBI | Formateurs et experts | #communaute',
  '✦ | Actualités BBI | Les nouvelles du réseau | #actualites'
].join('\n');

const DEFAULT_KPIS: string = [
  '# Une ligne par chiffre : valeur | libellé',
  '# ex. 1 500 | Professionnels formés depuis 2012'
].join('\n');

const IMMERSIVE_HOME_STYLES: string = `
  /* Chrome SharePoint / Microsoft 365 : rendu comme un site autonome. */
  body.bbi-home-immersive #SuiteNavWrapper,
  body.bbi-home-immersive #O365_NavHeader,
  body.bbi-home-immersive #spSiteHeader,
  body.bbi-home-immersive [data-automation-id="SiteHeader"],
  body.bbi-home-immersive [data-automation-id="SuiteNav"],
  body.bbi-home-immersive #sp-appBar,
  body.bbi-home-immersive .sp-appBar,
  body.bbi-home-immersive #spLeftNav,
  body.bbi-home-immersive .spLeftNav,
  body.bbi-home-immersive [data-automation-id="LeftNav"],
  body.bbi-home-immersive [data-automation-id="pageHeader"],
  body.bbi-home-immersive [data-automation-id="pageTitle"],
  body.bbi-home-immersive #pageHeader,
  body.bbi-home-immersive .pageTitle {
    display: none !important;
  }

  /* Les commandes restent disponibles lors de l'édition / dans le workbench. */
  body.bbi-home-immersive:not(.bbi-home-editing) #spCommandBar,
  body.bbi-home-immersive:not(.bbi-home-editing) [data-automation-id="pageCommandBar"] {
    display: none !important;
  }

  /* Canevas sans marges, sur la page publiée comme dans le workbench hébergé. */
  body.bbi-home-immersive #workbenchPageContent,
  body.bbi-home-immersive #spPageCanvasContent,
  body.bbi-home-immersive #spPageCanvasContent > div,
  body.bbi-home-immersive .Canvas,
  body.bbi-home-immersive .CanvasZone,
  body.bbi-home-immersive .CanvasSection,
  body.bbi-home-immersive .ControlZone,
  body.bbi-home-immersive [data-automation-id="CanvasZone"] {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  body.bbi-home-immersive #spPageCanvasContent,
  body.bbi-home-immersive .CanvasComponent,
  body.bbi-home-immersive .CanvasZoneSectionContainer {
    margin-top: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
  }
`;

export default class BbiHomeWebPart extends BaseClientSideWebPart<IBbiHomeWebPartProps> {
  private _themeVariant: IReadonlyTheme | undefined;
  private _immersiveStyle: HTMLStyleElement | undefined;

  protected onInit(): Promise<void> {
    if (!this.properties) {
      return Promise.resolve();
    }
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
    if (!this.properties.galleryLibraryTitle) {
      this.properties.galleryLibraryTitle = 'Galerie médias';
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
    this._enableImmersiveHome();
    console.info('[BBI-HOME] webpart render entered');
    console.info('[BBI-HOME] properties', typeof this.properties, Object.keys(this.properties || {}));
    console.info('[BBI-HOME] context', !!this.context, !!this.context?.spHttpClient);
    const properties = this.properties || ({} as IBbiHomeWebPartProps);
    const element: React.ReactElement<IBbiHomeProps> = React.createElement(BbiHome, {
      siteUrl: properties.siteUrl || this.context.pageContext.web.absoluteUrl,
      newsListTitle: properties.newsListTitle || 'Actualites',
      sessionsListTitle: properties.sessionsListTitle || 'Sessions',
      trainersListTitle: properties.trainersListTitle || 'Formateurs',
      formationsListTitle: properties.formationsListTitle || 'Formations',
      documentsLibraryTitle: properties.documentsLibraryTitle || 'Supports publiés',
      galleryLibraryTitle: properties.galleryLibraryTitle || 'Galerie médias',
      maxItems: properties.maxItems || 5,
      heroEyebrow: properties.heroEyebrow || '',
      heroTitle: properties.heroTitle || '',
      heroSubtitle: properties.heroSubtitle || '',
      heroImageUrl: properties.heroImageUrl || '',
      primaryCtaLabel: properties.primaryCtaLabel || '',
      primaryCtaUrl: properties.primaryCtaUrl || '',
      secondaryCtaLabel: properties.secondaryCtaLabel || '',
      secondaryCtaUrl: properties.secondaryCtaUrl || '',
      navLinks: properties.navLinks || '',
      quickLinks: properties.quickLinks || '',
      kpis: properties.kpis || '',
      announcementText: properties.announcementText || '',
      footerNote: properties.footerNote || '',
      showDataNotices: properties.showDataNotices === true,
      enableAnnouncement: properties.enableAnnouncement !== false,
      layoutCompact: properties.layoutCompact === true,
      spHttpClient: this.context.spHttpClient,
      isDarkTheme: this._themeVariant ? !!this._themeVariant.isInverted : false,
      hasTeamsContext: !!this.context.sdks.microsoftTeams,
      themeVariant: this._themeVariant,
      strings
    });
    console.info('[BBI-HOME] React element created');
    ReactDom.render(element, this.domElement);
    console.info('[BBI-HOME] ReactDOM render returned');
  }

  protected onDisplayModeChanged(_oldDisplayMode: DisplayMode): void {
    this._syncImmersiveEditingClass();
  }

  private _enableImmersiveHome(): void {
    document.body.classList.add('bbi-home-immersive');
    if (!this._immersiveStyle) {
      this._immersiveStyle = document.createElement('style');
      this._immersiveStyle.setAttribute('data-bbi-home-immersive', 'true');
      this._immersiveStyle.appendChild(document.createTextNode(IMMERSIVE_HOME_STYLES));
      document.head.appendChild(this._immersiveStyle);
    }
    this._syncImmersiveEditingClass();
  }

  private _syncImmersiveEditingClass(): void {
    document.body.classList.toggle('bbi-home-editing', this.displayMode === DisplayMode.Edit);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
    document.body.classList.remove('bbi-home-immersive', 'bbi-home-editing');
    if (this._immersiveStyle && this._immersiveStyle.parentElement) {
      this._immersiveStyle.parentElement.removeChild(this._immersiveStyle);
    }
    this._immersiveStyle = undefined;
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
              PropertyPaneTextField('galleryLibraryTitle', { label: strings.GalleryLibraryFieldLabel }),
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
