import { override } from '@microsoft/decorators';
import { Log } from '@microsoft/sp-core-library';
import {
  BaseApplicationCustomizer,
  PlaceholderContent,
  PlaceholderName
} from '@microsoft/sp-application-base';
import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { listApiUrl } from '../../shared/sharePointRest';

import strings from 'BbiFullScreenApplicationCustomizerStrings';

const LOG_SOURCE: string = 'BbiFullScreenApplicationCustomizer';

/** Styles injectés : uniquement des marges de mise en page, jamais le ruban Microsoft. */
const BASE_STYLES: string = `
  /* --- Mise en page plein écran (page applicative / SingleWebPartAppPage) --- */
  body.bbi-immersive #spPageCanvasContent > div,
  body.bbi-immersive .CanvasZone,
  body.bbi-immersive .CanvasSection,
  body.bbi-immersive .ControlZone,
  body.bbi-immersive .Canvas > div {
    max-width: 100% !important;
    width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  body.bbi-immersive .CanvasComponent,
  body.bbi-immersive #spPageCanvasContent {
    padding: 0 !important;
    margin: 0 !important;
  }
  body.bbi-immersive #workbenchPageContent,
  body.bbi-immersive .Canvas {
    max-width: 100% !important;
  }
  body.bbi-immersive .CanvasZoneSectionContainer {
    padding: 0 !important;
  }
  body.bbi-immersive .ms-Stack,
  body.bbi-immersive [data-automation-id="CanvasZone"] {
    margin-top: 0 !important;
  }

  /* --- Variables de marque exposées aux web parts BBI --- */
  body.bbi-immersive {
    --bbi-chrome-height: 0px;
    --bbi-navy: #0e265c;
    --bbi-navy-2: #1f3a70;
    --bbi-red: #d21419;
    --bbi-soft: #f4f6fa;
    --bbi-line: #e1e4ea;
  }

  /* --- Défilement fluide et ancrages sous barre collante --- */
  html.bbi-immersive-html {
    scroll-behavior: smooth;
  }
  body.bbi-immersive [id] {
    scroll-margin-top: 88px;
  }
`;

const HIDE_COMMAND_BAR_STYLES: string = `
  body.bbi-immersive #spCommandBar,
  body.bbi-immersive [data-automation-id="pageCommandBar"],
  body.bbi-immersive [data-automation-id="SiteHeader"],
  body.bbi-immersive #spSiteHeader {
    display: none !important;
  }
  body.bbi-immersive .sp-appBar {
    display: none !important;
  }
`;

const HIDE_TITLE_STYLES: string = `
  body.bbi-immersive [data-automation-id="pageTitle"],
  body.bbi-immersive .pageTitle,
  body.bbi-immersive [data-automation-id="pageHeader"],
  body.bbi-immersive #pageHeader {
    display: none !important;
  }
`;

/**
 * Placeholders d'en-tête et de pied de page : utile lorsque la page garde
 * l'en-tête SharePoint mais qu'on veut un bandeau BBI (mode « always »).
 */
export interface IBbiFullScreenProperties {
  /** 'appPage' : ne s'active que sur les pages applicatives · 'always' : sur toutes les pages. */
  mode?: string;
  /** Supprime les marges du canevas SharePoint (bord à bord réel). */
  edgeToEdge?: boolean;
  /** Masque la barre de commandes (Attention : pensez au bouton « Modifier » de la page). */
  hideCommandBar?: boolean;
  /** Masque le titre de page et l'en-tête de page. */
  hidePageTitle?: boolean;
  /** Bandeau d'information affiché en haut de page (vide = aucun bandeau). */
  topBannerText?: string;
  /** Applique la couleur de marque à l'en-tête SharePoint (mode « always »). */
  applyThemeToChrome?: boolean;
  /** CSS complémentaire avancé (injecté tel quel). */
  customCss?: string;
}

export default class BbiFullScreenApplicationCustomizer extends BaseApplicationCustomizer<IBbiFullScreenProperties> {
  private _styleElement: HTMLStyleElement | undefined;
  private _topPlaceholder: PlaceholderContent | undefined;

  @override
  public onInit(): Promise<void> {
    Log.info(LOG_SOURCE, `${strings.InitMessage}`);

    const properties: IBbiFullScreenProperties = {
      mode: this.properties.mode || 'appPage',
      edgeToEdge: this.properties.edgeToEdge !== false,
      hideCommandBar: this.properties.hideCommandBar === true,
      hidePageTitle: this.properties.hidePageTitle !== false,
      customCss: this.properties.customCss || ''
    };

    // Application immédiate si le mode « always » est demandé.
    if (properties.mode === 'always') {
      this._apply(properties);
    } else {
      // Sinon, on vérifie le type de mise en page de la page courante.
      this._isSinglePartAppPage()
        .then((isAppPage) => {
          if (isAppPage) {
            this._apply(properties);
          }
        })
        .catch(() => {
          /* page non identifiable : on ne touche à rien */
        });
    }

    this.context.placeholderProvider.changedEvent.add(this, this._renderPlaceholders);
    this._renderPlaceholders();

    return Promise.resolve();
  }

  /** Bandeau facultatif affiché quand la page conserve l'en-tête SharePoint. */
  private _renderPlaceholders(): void {
    if (!this.properties.topBannerText) {
      return;
    }
    if (!this._topPlaceholder) {
      this._topPlaceholder = this.context.placeholderProvider.tryCreateContent(
        PlaceholderName.Top,
        { onDispose: this._onDispose }
      );
      if (this._topPlaceholder && this._topPlaceholder.domElement) {
        const banner = document.createElement('div');
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Bandeau d’information BBI');
        banner.style.cssText = [
          'background:#0E265C',
          'color:#fff',
          'font:600 13px "Segoe UI",sans-serif',
          'padding:8px 18px',
          'letter-spacing:.01em',
          'display:flex',
          'gap:10px',
          'align-items:center'
        ].join(';');
        const dot = document.createElement('span');
        dot.textContent = '●';
        dot.style.color = '#D21419';
        const text = document.createElement('span');
        text.textContent = this.properties.topBannerText;
        banner.appendChild(dot);
        banner.appendChild(text);
        this._topPlaceholder.domElement.appendChild(banner);
      }
    }
  }

  private _onDispose(): void {
    // Aucun nettoyage nécessaire : SharePoint retire le placeholder.
  }

  private async _isSinglePartAppPage(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageContext = (window as any)._spPageContextInfo;
    const pageItemId: number | undefined = pageContext && pageContext.pageItemId;
    if (!pageItemId) {
      return false;
    }
    const webUrl: string = (pageContext.webAbsoluteUrl as string) || this.context.pageContext.web.absoluteUrl;
    const listId: string = (pageContext.listId as string) || '';
    const endpoint: string = listId
      ? `${webUrl}/_api/web/lists(guid'${listId}')/items(${pageItemId})?$select=PageLayoutType`
      : listApiUrl(webUrl, 'Pages du site', `items(${pageItemId})`, '?$select=PageLayoutType');

    try {
      const response = await this.context.spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
      if (!response.ok) {
        return false;
      }
      const json = (await response.json()) as { PageLayoutType?: string };
      return (json.PageLayoutType || '').toLowerCase() === 'singlewebpartapppage';
    } catch {
      return false;
    }
  }

  private _apply(properties: IBbiFullScreenProperties): void {
    document.body.classList.add('bbi-immersive');
    document.documentElement.classList.add('bbi-immersive-html');

    const parts: string[] = [];
    if (properties.edgeToEdge) {
      parts.push(BASE_STYLES);
    }
    if (properties.hidePageTitle) {
      parts.push(HIDE_TITLE_STYLES);
    }
    if (properties.hideCommandBar) {
      parts.push(HIDE_COMMAND_BAR_STYLES);
    }
    if (properties.customCss) {
      parts.push(properties.customCss);
    }

    this._styleElement = document.createElement('style');
    this._styleElement.setAttribute('data-bbi-fullscreen', 'true');
    this._styleElement.appendChild(document.createTextNode(parts.join('\n')));
    document.head.appendChild(this._styleElement);

    // Certaines web parts (dont la page d'accueil BBI) recalculent leur hauteur.
    window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 400);
  }

  @override
  public onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme || !currentTheme.semanticColors) {
      return;
    }
    const palette = currentTheme.palette || {};
    const root = document.documentElement;
    if (palette.themePrimary) {
      root.style.setProperty('--bbi-navy', palette.themePrimary);
    }
    if (palette.themeSecondary) {
      root.style.setProperty('--bbi-navy-2', palette.themeSecondary);
    }
    if (palette.themeTertiary) {
      root.style.setProperty('--bbi-red', palette.themeTertiary);
    }

    if (this._styleElement && this._styleElement.parentElement && this.properties.applyThemeToChrome) {
      const headerStyle = document.createElement('style');
      headerStyle.setAttribute('data-bbi-theme', 'true');
      headerStyle.appendChild(
        document.createTextNode(
          `body.bbi-immersive #spSiteHeader, body.bbi-immersive [data-automation-id="SiteHeader"] { background-color: ${palette.themePrimary || '#0E265C'} !important; }`
        )
      );
      document.head.appendChild(headerStyle);
    }
  }
}
