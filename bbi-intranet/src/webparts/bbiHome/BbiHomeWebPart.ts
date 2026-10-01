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
  orgChartListTitle: string;
  announcementsListTitle: string;
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
}

const DEFAULT_NAV_LINKS: string = [
  '# Accueil | #accueil',
  '# Formations | #formations',
  '# Sessions | #sessions',
  '# Actualités | #actualites',
  '# Ressources | #ressources',
  '# Communauté | #communaute',
  '# Organigramme | #organigramme'
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
  ' | Réseau international | 9 pays, une même exigence de qualité. | Un référentiel pédagogique unique et des antennes locales dans chaque région. | Découvrir l\'organisation | #organigramme',
  ' | Qualité certifiée | Qualiopi, un gage de confiance. | Des process audités et une amélioration continue au service de vos financeurs. | Voir les certifications | #vie-equipe'
].join('\n');

const DEFAULT_QUICK_LINKS: string = [
  '▦ | Catalogue des formations | Parcours, modalités et durées | #formations',
  '▣ | Prochaines sessions | Planning et inscriptions | #sessions',
  '▤ | Supports & médias | Documents, photos et vidéos | #ressources',
  '◈ | Organigramme | Équipes, pôles et contacts | #organigramme',
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

const IMMERSIVE_HOME_STYLES: string = `
  /* ------------------------------------------------------------------
     Calque plein écran BBI : le portail est monté dans un conteneur fixe
     rattaché au <body>, qui couvre 100 % de la fenêtre et défile seul.
     Il ne dépend d'aucun sélecteur interne de SharePoint : barre de suite
     Microsoft, navigation gauche, barre de commandes, bandeau développeur
     et cadre d'édition du workbench passent tous derrière lui.
     ------------------------------------------------------------------ */
  html.bbi-portal-open,
  body.bbi-portal-open {
    overflow: hidden !important;
    height: 100% !important;
  }
  .bbi-portal-host {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    z-index: 2147483000 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow-x: hidden;
    overflow-y: auto;
    background: #ffffff;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  /* Tout ce qui n'est pas le portail BBI est retiré de l'écran quand le
     calque est ouvert : barres du workbench, barre de suite, volet latéral,
     barres d'outils flottantes des web parts. Le bouton ⚙ (ou Alt + Maj + E)
     ferme le calque et rend la page SharePoint pour la gérer. */
  body.bbi-portal-open > *:not(#bbi-portal-host):not([data-bbi-chrome-toggle]):not(script):not(style):not(link) {
    visibility: hidden !important;
    pointer-events: none !important;
  }

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

  /* ------------------------------------------------------------------
     Workbench hébergé (_layouts/15/workbench.aspx) : aucune barre native.
     Le workbench garde sa barre de commandes et son cadre d'édition même en
     lecture ; on les retire pour que le portail occupe réellement tout
     l'écran, à l'identique de la page publiée.
     Rappel : Alt + Maj + E rétablit le chrome SharePoint si l'on doit
     revenir à la page « normale » de SharePoint (voir BbiHomeWebPart).
     ------------------------------------------------------------------ */
  body.bbi-home-immersive.bbi-home-workbench #spCommandBar,
  body.bbi-home-immersive.bbi-home-workbench [data-automation-id="pageCommandBar"],
  body.bbi-home-immersive.bbi-home-workbench [data-automation-id="CommandBar"],
  body.bbi-home-immersive.bbi-home-workbench #workbenchTopBar,
  body.bbi-home-immersive.bbi-home-workbench #workbenchHeader,
  body.bbi-home-immersive.bbi-home-workbench #workbenchToolbox,
  body.bbi-home-immersive.bbi-home-workbench [data-automation-id="workbenchToolbox"],
  body.bbi-home-immersive.bbi-home-workbench [data-automation-id="addWebPartButton"],
  body.bbi-home-immersive.bbi-home-workbench .sp-workbench-chrome {
    display: none !important;
  }

  /* Le canevas et la web part occupent la totalité de la fenêtre. */
  body.bbi-home-immersive.bbi-home-workbench #workbenchPageContent,
  body.bbi-home-immersive.bbi-home-workbench #spPageCanvasContent,
  body.bbi-home-immersive.bbi-home-workbench #spPageCanvasContent > div,
  body.bbi-home-immersive.bbi-home-workbench .Canvas,
  body.bbi-home-immersive.bbi-home-workbench .CanvasComponent,
  body.bbi-home-immersive.bbi-home-workbench .CanvasZone,
  body.bbi-home-immersive.bbi-home-workbench .CanvasSection,
  body.bbi-home-immersive.bbi-home-workbench .CanvasZoneSectionContainer,
  body.bbi-home-immersive.bbi-home-workbench .ControlZone,
  body.bbi-home-immersive.bbi-home-workbench [data-automation-id="CanvasZone"],
  body.bbi-home-immersive.bbi-home-workbench .WebPart,
  body.bbi-home-immersive.bbi-home-workbench [data-control-type="webPart"] {
    box-sizing: border-box !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }

  body.bbi-home-immersive.bbi-home-workbench #spPageCanvasContent,
  body.bbi-home-immersive.bbi-home-workbench #workbenchPageContent,
  body.bbi-home-immersive.bbi-home-workbench .Canvas {
    padding-top: 0 !important;
    margin-top: 0 !important;
  }

  /* Aucun espace résiduel autour du canevas : le portail touche les quatre
     bords de la fenêtre, comme sur un site publié. */
  body.bbi-home-immersive.bbi-home-workbench {
    margin: 0 !important;
    padding: 0 !important;
    overflow-x: hidden;
  }
`;

/**
 * Le portail est-il ouvert dans le workbench hébergé ?
 *
 * L'URL est le seul indice fiable au premier rendu : l'élément
 * `#workbenchPageContent` n'existe pas encore quand la web part s'initialise.
 */
const isHostedWorkbench = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    /workbench\.aspx/i.test(window.location.href) ||
    !!document.getElementById('workbenchPageContent')
  );
};

export default class BbiHomeWebPart extends BaseClientSideWebPart<IBbiHomeWebPartProps> {
  private _themeVariant: IReadonlyTheme | undefined;
  private _immersiveStyle: HTMLStyleElement | undefined;
  private _chromeShortcut: ((event: KeyboardEvent) => void) | undefined;
  private _immersiveEnabled: boolean = true;
  /** Conteneur fixe plein écran rattaché au <body> (calque BBI). */
  private _portalHost: HTMLDivElement | undefined;
  /** Bouton discret : bascule entre plein écran BBI et écran SharePoint. */
  private _chromeToggle: HTMLButtonElement | undefined;
  /** Élément DOM dans lequel React est actuellement monté. */
  private _mountedIn: HTMLElement | undefined;

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
    if (!this.properties.orgChartListTitle) {
      this.properties.orgChartListTitle = 'Organigramme';
    }
    if (!this.properties.announcementsListTitle) {
      this.properties.announcementsListTitle = 'Annonces';
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
    this._syncImmersiveEditingClass();
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
      orgChartListTitle: properties.orgChartListTitle || 'Organigramme',
      announcementsListTitle: properties.announcementsListTitle || 'Annonces',
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
    const overlay = this._shouldUseOverlay();
    const target: HTMLElement = overlay ? this._ensurePortalHost() : this.domElement;
    if (this._mountedIn && this._mountedIn !== target) {
      ReactDom.unmountComponentAtNode(this._mountedIn);
    }
    if (!overlay) {
      this._removePortalHost();
    }
    ReactDom.render(element, target);
    this._mountedIn = target;
    document.documentElement.classList.toggle('bbi-portal-open', overlay);
    document.body.classList.toggle('bbi-portal-open', overlay);
    this._renderChromeToggle(overlay);
  }

  protected onDisplayModeChanged(_oldDisplayMode: DisplayMode): void {
    this._syncImmersiveEditingClass();
    // Page publiée → calque plein écran ; édition d'une page → intégré à la page.
    this.render();
  }

  /**
   * Le portail doit-il couvrir toute la fenêtre ?
   *
   * · workbench hébergé (lecture comme édition) : oui — c'est lui qui
   *   affiche en permanence les barres natives SharePoint ;
   * · page publiée (mode lecture) : oui ;
   * · édition d'une page : non, sinon on ne pourrait plus la modifier ;
   * · Teams / Viva Connections : non, l'hôte est déjà sans chrome ;
   * · `?bbiChrome=1` dans l'URL ou Alt + Maj + E : retour à l'écran SharePoint.
   */
  private _shouldUseOverlay(): boolean {
    if (!this._immersiveEnabled || typeof document === 'undefined') {
      return false;
    }
    if (/[?&]bbiChrome=1\b/i.test(window.location.search)) {
      return false;
    }
    if (this.context.sdks && this.context.sdks.microsoftTeams) {
      return false;
    }
    return isHostedWorkbench() || this.displayMode === DisplayMode.Read;
  }

  private _ensurePortalHost(): HTMLDivElement {
    if (!this._portalHost) {
      const host = document.createElement('div');
      host.className = 'bbi-portal-host';
      host.id = 'bbi-portal-host';
      host.setAttribute('data-bbi-scroller', 'true');
      document.body.appendChild(host);
      this._portalHost = host;
    }
    return this._portalHost;
  }

  private _removePortalHost(): void {
    if (this._portalHost) {
      ReactDom.unmountComponentAtNode(this._portalHost);
      if (this._portalHost.parentElement) {
        this._portalHost.parentElement.removeChild(this._portalHost);
      }
      this._portalHost = undefined;
    }
  }

  /**
   * Petit bouton d'accès aux barres SharePoint (supprimer / modifier la
   * web part, ouvrir le volet de propriétés). Quasi invisible sur une page
   * publiée, plus visible dans le workbench où l'on édite en permanence.
   */
  private _renderChromeToggle(overlay: boolean): void {
    const workbench = isHostedWorkbench();
    if (!this._chromeToggle) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('data-bbi-chrome-toggle', 'true');
      button.style.cssText = [
        'position:fixed',
        'left:14px',
        'bottom:14px',
        'z-index:2147483001',
        'width:34px',
        'height:34px',
        'border-radius:50%',
        'border:1px solid rgba(255,255,255,.55)',
        'background:#0e265c',
        'color:#fff',
        'font:600 15px "Segoe UI",sans-serif',
        'line-height:1',
        'cursor:pointer',
        'box-shadow:0 4px 14px rgba(9,20,48,.35)',
        'transition:opacity .2s ease'
      ].join(';');
      button.addEventListener('mouseenter', () => { button.style.opacity = '1'; });
      button.addEventListener('mouseleave', () => {
        button.style.opacity = button.getAttribute('data-rest-opacity') || '0';
      });
      button.addEventListener('focus', () => { button.style.opacity = '1'; });
      button.addEventListener('blur', () => {
        button.style.opacity = button.getAttribute('data-rest-opacity') || '0';
      });
      button.addEventListener('click', () => { this._toggleChrome(); });
      document.body.appendChild(button);
      this._chromeToggle = button;
    }
    const rest = workbench ? '0.5' : '0';
    this._chromeToggle.setAttribute('data-rest-opacity', rest);
    this._chromeToggle.style.opacity = rest;
    this._chromeToggle.textContent = overlay ? '⚙' : '⤢';
    const label = overlay
      ? 'Afficher les barres SharePoint pour modifier ou supprimer la web part (Alt + Maj + E)'
      : 'Revenir au plein écran BBI (Alt + Maj + E)';
    this._chromeToggle.title = label;
    this._chromeToggle.setAttribute('aria-label', label);
    // Hors workbench et hors calque : l'écran SharePoint est déjà visible,
    // le bouton ne sert que si l'on a quitté le plein écran.
    this._chromeToggle.style.display = overlay || !this._immersiveEnabled ? 'block' : 'none';
  }

  private _toggleChrome(): void {
    this._applyImmersive(!this._immersiveEnabled);
    this._syncImmersiveEditingClass();
    this.render();
    window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 120);
  }

  private _enableImmersiveHome(): void {
    if (!this._immersiveStyle) {
      this._immersiveStyle = document.createElement('style');
      this._immersiveStyle.setAttribute('data-bbi-home-immersive', 'true');
      this._immersiveStyle.appendChild(document.createTextNode(IMMERSIVE_HOME_STYLES));
    }
    // L'état choisi par l'utilisateur (Alt + Maj + E) survit aux re-rendus.
    this._applyImmersive(this._immersiveEnabled);
    this._registerChromeShortcut();
  }

  /**
   * Active ou retire la feuille de style « plein écran ».
   *
   * L'état est mémorisé : un simple re-rendu de la web part ne doit pas
   * réappliquer une mise en page que l'utilisateur vient d'annuler.
   */
  private _applyImmersive(active: boolean): void {
    this._immersiveEnabled = active;
    const node = this._immersiveStyle;
    if (!node) {
      return;
    }
    if (active && !node.parentElement) {
      document.head.appendChild(node);
    } else if (!active && node.parentElement) {
      node.parentElement.removeChild(node);
    }
    document.body.classList.toggle('bbi-home-immersive', active);
    // Workbench hébergé : on masque aussi la barre de commandes et le cadre
    // d'édition, sinon le portail reste coincé dans une page SharePoint.
    document.body.classList.toggle('bbi-home-workbench', active && isHostedWorkbench());
  }

  /**
   * Alt + Maj + E : rétablit (ou masque) le chrome SharePoint.
   *
   * Le portail occupe toute la page, y compris dans le workbench ; cette
   * combinaison de touches laisse la porte de sortie pour revenir à l'écran
   * SharePoint classique et gérer la page (supprimer une web part, notamment)
   * sans avoir à modifier le code.
   */
  private _registerChromeShortcut(): void {
    if (this._chromeShortcut) {
      return;
    }
    this._chromeShortcut = (event: KeyboardEvent): void => {
      if (!event.altKey || !event.shiftKey || (event.key !== 'E' && event.key !== 'e')) {
        return;
      }
      event.preventDefault();
      this._toggleChrome();
    };
    document.addEventListener('keydown', this._chromeShortcut, true);
  }

  private _syncImmersiveEditingClass(): void {
    document.body.classList.toggle('bbi-home-editing', this.displayMode === DisplayMode.Edit);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
    this._removePortalHost();
    this._mountedIn = undefined;
    document.documentElement.classList.remove('bbi-portal-open');
    document.body.classList.remove('bbi-portal-open');
    if (this._chromeToggle && this._chromeToggle.parentElement) {
      this._chromeToggle.parentElement.removeChild(this._chromeToggle);
    }
    this._chromeToggle = undefined;
    document.body.classList.remove(
      'bbi-home-immersive',
      'bbi-home-editing',
      'bbi-home-workbench'
    );
    if (this._chromeShortcut) {
      document.removeEventListener('keydown', this._chromeShortcut, true);
      this._chromeShortcut = undefined;
    }
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
              PropertyPaneTextField('orgChartListTitle', { label: strings.OrgChartListFieldLabel }),
              PropertyPaneTextField('announcementsListTitle', { label: strings.AnnouncementsListFieldLabel }),
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
