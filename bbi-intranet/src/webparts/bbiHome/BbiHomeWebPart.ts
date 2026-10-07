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
import { parseKpis } from './components/homeLayout';

export interface IBbiHomeWebPartProps {
  siteUrl: string;
  newsListTitle: string;
  sessionsListTitle: string;
  trainersListTitle: string;
  formationsListTitle: string;
  documentsLibraryTitle: string;
  galleryLibraryTitle: string;
  employeeListTitle: string;
  certificationsListTitle: string;
  announcementsListTitle: string;
  thoughtsListTitle: string;
  birthdaysListTitle: string;
  officesListTitle: string;
  clientReferencesListTitle: string;
  pedagogicalReferencesListTitle: string;
  adminDocumentsLibraryTitle: string;
  maxItems: number;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroSlides: string;
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
  visionText: string;
  missionText: string;
  objectivesText: string;
  supportEmail: string;
  supportPhone: string;
}

const DEFAULT_NAV_LINKS: string = [
  '# Accueil | #accueil',
  '# Formations | #formations',
  '# Sessions | #sessions',
  '# Actualités | #actualites',
  '# Ressources | #ressources',
  '# Communauté | #communaute'
].join('\n');

/**
 * Diaporama du héros. Une ligne = une diapositive :
 *   image | sur-titre | titre | accroche | libellé du bouton | lien du bouton
 * Une ligne qui commence par « | » (donc sans image) reste entièrement
 * textuelle : le texte s'affiche alors sur le fond bleu nuit BBI.
 * Le raccourci « titre | accroche | bouton | lien » est également accepté.
 */
const DEFAULT_HERO_SLIDES: string = [
  '# Une ligne par diapositive du héros (les lignes # sont des commentaires)',
  '# image | sur-titre | titre | accroche | bouton | lien',
  ' | Business Builders International | L\'expertise qui fait grandir les dirigeants. | Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables. | Explorer les formations | #formations',
  ' | Notre méthode | Des parcours conçus pour le terrain. | Des mises en situation concrètes, des formateurs certifiés et un ancrage à 30 jours. | Voir les prochaines sessions | #sessions',
  ' | Réseau international | 9 pays, une même exigence de qualité. | Un référentiel pédagogique unique et des antennes locales dans chaque région. | Découvrir la communauté | #communaute',
  ' | Qualité certifiée | Qualiopi, un gage de confiance. | Des process audités et une amélioration continue au service de vos financeurs. | Voir les certifications | #vie-equipe'
].join('\n');

const DEFAULT_QUICK_LINKS: string = [
  '▦ | Catalogue des formations | Parcours, modalités et durées | #formations',
  '▣ | Prochaines sessions | Planning et inscriptions | #sessions',
  '▤ | Supports & médias | Documents, photos et vidéos | #ressources',
  '◎ | Communauté BBI | Formateurs et experts | #communaute',
  '✦ | Actualités BBI | Les nouvelles du réseau | #actualites'
].join('\n');

const DEFAULT_KPIS: string = [
  '# Une ligne par chiffre : valeur | libellé (modifiez librement ci-dessous)',
  '1 500+ | Professionnels accompagnés',
  '10+ | Formations au catalogue',
  '9 | Pays couverts par le réseau',
  '96 % | De satisfaction constatée'
].join('\n');

/**
 * Plein écran autonome : le web part ne dépend ni de l'extension
 * BbiFullScreenApplicationCustomizer ni du type de page (page de site,
 * SingleWebPartAppPage ou workbench hébergé).
 *
 * - Lecture seule uniquement (`:not(.bbi-home-editing)`) : en édition, le
 *   chrome reste visible pour que les éditeurs gardent leur barre de commandes.
 * - La barre de suite Microsoft 365 (#SuiteNavWrapper) n'est JAMAIS masquée :
 *   ce n'est pas supporté par Microsoft et les utilisateurs doivent y accéder.
 * - Lecture seule : le web part est épinglé sous la barre de suite et défile
 *   lui-même (`data-bbi-scroll-root`, comme Intranet-Coris) ; le composant lit
 *   ce défilement via getScrollRoot() dans homeLayout.ts. En édition, il reste
 *   dans le flux de la page et c'est la fenêtre qui défile.
 */
const IMMERSIVE_HOME_STYLES: string = `
  /* Chrome SharePoint masqué en lecture : en-tête, barre d'applis, navigation, titre, commandes, pied. */
  body.bbi-home-immersive:not(.bbi-home-editing) #spSiteHeader,
  body.bbi-home-immersive:not(.bbi-home-editing) [data-automation-id="SiteHeader"],
  body.bbi-home-immersive:not(.bbi-home-editing) .sp-appBar,
  body.bbi-home-immersive:not(.bbi-home-editing) #sp-appBar,
  body.bbi-home-immersive:not(.bbi-home-editing) #spLeftNav,
  body.bbi-home-immersive:not(.bbi-home-editing) .sp-pageLayout-leftNav,
  body.bbi-home-immersive:not(.bbi-home-editing) [data-automation-id="pageHeader"],
  body.bbi-home-immersive:not(.bbi-home-editing) [data-automation-id="pageTitle"],
  body.bbi-home-immersive:not(.bbi-home-editing) #pageHeader,
  body.bbi-home-immersive:not(.bbi-home-editing) #spCommandBar,
  body.bbi-home-immersive:not(.bbi-home-editing) [data-automation-id="pageCommandBar"],
  body.bbi-home-immersive:not(.bbi-home-editing) [data-automation-id="pageFooter"],
  body.bbi-home-immersive:not(.bbi-home-editing) .sp-pageLayout-pageFooter,
  body.bbi-home-immersive:not(.bbi-home-editing) #CommentsWrapper {
    display: none !important;
  }
  /* Épinglage à la Coris : le web part occupe tout l'écran sous la barre de suite M365
     et défile lui-même ; la page SharePoint en dessous ne défile plus. */
  [data-bbi-scroll-root="true"] {
    position: fixed !important;
    top: var(--bbi-suite-offset, 48px) !important;
    left: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    height: calc(100vh - var(--bbi-suite-offset, 48px)) !important;
    max-height: calc(100vh - var(--bbi-suite-offset, 48px)) !important;
    margin: 0 !important;
    padding: 0 !important;
    z-index: 10 !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    background: #fff !important;
  }
  html:has(body.bbi-home-immersive:not(.bbi-home-editing)),
  body.bbi-home-immersive:not(.bbi-home-editing),
  body.bbi-home-immersive:not(.bbi-home-editing) [data-automation-id="contentScrollRegion"] {
    overflow: hidden !important;
  }
  /* Une transformation sur un ancêtre ferait de lui le repère du position: fixed. */
  body.bbi-home-immersive #spPageCanvasContent,
  body.bbi-home-immersive .CanvasZone,
  body.bbi-home-immersive .CanvasSection,
  body.bbi-home-immersive .ControlZone {
    transform: none !important;
    filter: none !important;
    contain: none !important;
  }
  /* Zone de contenu : aucune marge latérale résiduelle de la mise en page SharePoint. */
  body.bbi-home-immersive #contentBox,
  body.bbi-home-immersive #DeltaSPPageContentArea,
  body.bbi-home-immersive [data-automation-id="contentScrollRegion"] > div {
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    max-width: none !important;
    width: 100% !important;
  }

  /* Canevas sans marges, sur la page publiée comme dans le workbench hébergé. */
  body.bbi-home-immersive #workbenchPageContent,
  body.bbi-home-immersive #spPageCanvasContent,
  body.bbi-home-immersive #spPageCanvasContent > div,
  body.bbi-home-immersive .Canvas,
  body.bbi-home-immersive .CanvasZone,
  body.bbi-home-immersive .CanvasSection,
  body.bbi-home-immersive .ControlZone,
  body.bbi-home-immersive [data-automation-id="CanvasZone"],
  body.bbi-home-immersive .WebPart,
  body.bbi-home-immersive [data-control-type="webPart"] {
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
    // Migration : les anciennes instances n'avaient que des lignes de
    // commentaire dans « kpis » → bandeau de chiffres clés vide et vide
    // sous le héros. On réhydrate la valeur par défaut.
    if (!this.properties.kpis || parseKpis(this.properties.kpis).length === 0) {
      this.properties.kpis = DEFAULT_KPIS;
    }
    if (!this.properties.galleryLibraryTitle) {
      this.properties.galleryLibraryTitle = 'Galerie médias';
    }
    if (!this.properties.employeeListTitle) {
      this.properties.employeeListTitle = 'Employés du mois';
    }
    if (!this.properties.certificationsListTitle) {
      this.properties.certificationsListTitle = 'Certifications';
    }
    if (!this.properties.heroSlides) {
      this.properties.heroSlides = DEFAULT_HERO_SLIDES;
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
    const properties = this.properties || ({} as IBbiHomeWebPartProps);
    const connectedUser = this.context.pageContext.user;
    const element: React.ReactElement<IBbiHomeProps> = React.createElement(BbiHome, {
      siteUrl: properties.siteUrl || this.context.pageContext.web.absoluteUrl,
      newsListTitle: properties.newsListTitle || 'Actualites',
      sessionsListTitle: properties.sessionsListTitle || 'Sessions',
      trainersListTitle: properties.trainersListTitle || 'Formateurs',
      formationsListTitle: properties.formationsListTitle || 'Formations',
      documentsLibraryTitle: properties.documentsLibraryTitle || 'Supports publiés',
      galleryLibraryTitle: properties.galleryLibraryTitle || 'Galerie médias',
      employeeListTitle: properties.employeeListTitle || 'Employés du mois',
      certificationsListTitle: properties.certificationsListTitle || 'Certifications',
      announcementsListTitle: properties.announcementsListTitle || 'Annonces',
      thoughtsListTitle: properties.thoughtsListTitle || 'Pensées du jour',
      birthdaysListTitle: properties.birthdaysListTitle || 'Anniversaires',
      officesListTitle: properties.officesListTitle || 'Implantations',
      clientReferencesListTitle: properties.clientReferencesListTitle || 'Nos références',
      pedagogicalReferencesListTitle: properties.pedagogicalReferencesListTitle || 'Références pédagogiques',
      adminDocumentsLibraryTitle: properties.adminDocumentsLibraryTitle || 'Documents administratifs',
      maxItems: properties.maxItems || 5,
      heroEyebrow: properties.heroEyebrow || '',
      heroTitle: properties.heroTitle || '',
      heroSubtitle: properties.heroSubtitle || '',
      heroImageUrl: properties.heroImageUrl || '',
      heroSlides: properties.heroSlides || '',
      primaryCtaLabel: properties.primaryCtaLabel || '',
      primaryCtaUrl: properties.primaryCtaUrl || '',
      secondaryCtaLabel: properties.secondaryCtaLabel || '',
      secondaryCtaUrl: properties.secondaryCtaUrl || '',
      navLinks: properties.navLinks || '',
      quickLinks: properties.quickLinks || '',
      kpis: properties.kpis || '',
      announcementText: properties.announcementText || '',
      footerNote: properties.footerNote || '',
      visionText: properties.visionText || '',
      missionText: properties.missionText || '',
      objectivesText: properties.objectivesText || '',
      supportEmail: properties.supportEmail || '',
      supportPhone: properties.supportPhone || '',
      showDataNotices: properties.showDataNotices === true,
      enableAnnouncement: properties.enableAnnouncement !== false,
      layoutCompact: properties.layoutCompact === true,
      userName:
        (connectedUser &&
          (connectedUser.displayName || connectedUser.loginName || connectedUser.email)) ||
        "",
      spHttpClient: this.context.spHttpClient,
      isDarkTheme: this._themeVariant ? !!this._themeVariant.isInverted : false,
      hasTeamsContext: !!this.context.sdks.microsoftTeams,
      themeVariant: this._themeVariant,
      strings
    });
    ReactDom.render(element, this.domElement);
  }

  private _enableImmersiveHome(): void {
    document.body.classList.add('bbi-home-immersive');
    const editing = this.displayMode === DisplayMode.Edit;
    document.body.classList.toggle('bbi-home-editing', editing);
    if (editing) {
      // Édition : le web part reste dans le flux de la page, la fenêtre défile.
      this.domElement.removeAttribute('data-bbi-scroll-root');
    } else {
      const suiteBar = document.getElementById('SuiteNavWrapper') || document.getElementById('suiteBarDelta');
      const suiteHeight = suiteBar && suiteBar.offsetHeight > 0 ? suiteBar.offsetHeight : 48;
      this.domElement.style.setProperty('--bbi-suite-offset', `${suiteHeight}px`);
      this.domElement.setAttribute('data-bbi-scroll-root', 'true');
    }
    if (!this._immersiveStyle) {
      this._immersiveStyle = document.createElement('style');
      this._immersiveStyle.setAttribute('data-bbi-home-immersive', 'true');
      this._immersiveStyle.appendChild(document.createTextNode(IMMERSIVE_HOME_STYLES));
      document.head.appendChild(this._immersiveStyle);
    }
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
              PropertyPaneTextField('employeeListTitle', { label: strings.EmployeeListFieldLabel }),
              PropertyPaneTextField('certificationsListTitle', { label: strings.CertificationsListFieldLabel }),
              PropertyPaneTextField('announcementsListTitle', { label: strings.AnnouncementsListFieldLabel }),
              PropertyPaneTextField('thoughtsListTitle', { label: strings.ThoughtsListFieldLabel }),
              PropertyPaneTextField('birthdaysListTitle', { label: strings.BirthdaysListFieldLabel }),
              PropertyPaneTextField('officesListTitle', { label: strings.OfficesListFieldLabel }),
              PropertyPaneTextField('clientReferencesListTitle', { label: strings.ClientReferencesListFieldLabel }),
              PropertyPaneTextField('pedagogicalReferencesListTitle', { label: strings.PedagogicalReferencesListFieldLabel }),
              PropertyPaneTextField('adminDocumentsLibraryTitle', { label: strings.AdminDocumentsLibraryFieldLabel }),
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
              }),
              PropertyPaneTextField('heroSlides', {
                label: strings.HeroSlidesFieldLabel,
                multiline: true,
                rows: 6,
                description: strings.HeroSlidesFieldDescription
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
            groupName: strings.IdentityGroupName,
            groupFields: [
              PropertyPaneTextField('visionText', {
                label: strings.VisionFieldLabel,
                multiline: true,
                rows: 2
              }),
              PropertyPaneTextField('missionText', {
                label: strings.MissionFieldLabel,
                multiline: true,
                rows: 2
              }),
              PropertyPaneTextField('objectivesText', {
                label: strings.ObjectivesFieldLabel,
                description: strings.ObjectivesFieldDescription,
                multiline: true,
                rows: 4
              }),
              PropertyPaneTextField('supportEmail', { label: strings.SupportEmailFieldLabel }),
              PropertyPaneTextField('supportPhone', { label: strings.SupportPhoneFieldLabel })
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
