import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle,
  PropertyPaneSlider
} from '@microsoft/sp-property-pane';
import { Portal } from './Portal';
import { PortalProps, PortalSettings, WebPartKind } from './models';
import { defaults } from './registry';
import { SharePointSource } from './SharePointSource';
import { parseSources } from './utils';
/** Thin SPFx host. Both the composite home and independent webparts render the same components. */
export abstract class BaseBbiWebPart extends BaseClientSideWebPart<PortalSettings> {
  protected abstract readonly kind: WebPartKind;
  private source!: SharePointSource;
  protected async onInit(): Promise<void> {
    await super.onInit();
    this.source = new SharePointSource(this.context.spHttpClient);
  }
  public render(): void {
    const settings = { ...defaults, ...this.properties };
    if (this.kind !== 'home' && !this.properties.title) settings.title = '';
    settings.siteUrl = (
      settings.siteUrl || this.context.pageContext.web.absoluteUrl
    ).replace(/\/$/, '');
    settings.maxItems = Math.min(
      48,
      Math.max(1, Number(settings.maxItems) || 6)
    );
    const element: React.ReactElement<PortalProps> = React.createElement(
      Portal,
      {
        kind: this.kind,
        settings,
        source: this.source,
        userName: this.context.pageContext.user.displayName,
        userEmail: this.context.pageContext.user.email,
        instanceId: `bbi-${this.instanceId}`
      }
    );
    ReactDom.render(element, this.domElement);
  }
  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }
  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }
  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const urlValidation = (value: string): string => {
      if (!value) return '';
      try {
        const url = new URL(value);
        return url.protocol === 'https:'
          ? ''
          : 'Utilisez une URL HTTPS absolue.';
      } catch {
        return 'Utilisez une URL HTTPS absolue.';
      }
    };
    return {
      pages: [
        {
          header: {
            description:
              'BBI · Design du réseau et sources SharePoint. Le mode démonstration ne modifie aucune donnée.'
          },
          groups: [
            {
              groupName: 'Affichage',
              groupFields: [
                PropertyPaneTextField('title', {
                  label:
                    this.kind === 'home'
                      ? 'Nom de l’intranet'
                      : 'Titre (vide = titre par défaut)'
                }),
                PropertyPaneToggle('demoMode', {
                  label: 'Données fictives de démonstration',
                  onText: 'Démo',
                  offText: 'SharePoint réel'
                }),
                PropertyPaneSlider('maxItems', {
                  label: 'Éléments affichés initialement par module',
                  min: 1,
                  max: 48,
                  value: this.properties.maxItems || 6,
                  showValue: true
                }),
                ...(this.kind === 'home'
                  ? [
                      PropertyPaneTextField('hiddenModules', {
                        label: 'Modules masqués (clés séparées par virgules)',
                        description:
                          'hero, links, news, sessions, catalog, documents, directory, metrics, resources, community, trainer, support'
                      })
                    ]
                  : [])
              ]
            },
            {
              groupName: 'Sources de données',
              groupFields: [
                PropertyPaneTextField('siteUrl', {
                  label: 'Site SharePoint source (vide = site courant)',
                  onGetErrorMessage: urlValidation
                }),
                ...(this.kind !== 'home' && this.kind !== 'hero'
                  ? [
                      PropertyPaneTextField(
                        this.kind === 'documents'
                          ? 'libraryTitle'
                          : 'listTitle',
                        { label: 'Nom de la liste ou bibliothèque' }
                      )
                    ]
                  : []),
                PropertyPaneTextField('sourcesJson', {
                  label: 'Sources par module (JSON)',
                  multiline: true,
                  rows: 5,
                  description:
                    'Exemple : {"news":"BBI Actualités","catalog":"Formations"}. Les clés du JSON priment sur le nom de liste individuel.',
                  onGetErrorMessage: (value) => {
                    try {
                      parseSources(value);
                      return '';
                    } catch (e) {
                      return (e as Error).message;
                    }
                  }
                })
              ]
            },
            {
              groupName: 'Identité & navigation',
              isCollapsed: true,
              groupFields: [
                PropertyPaneTextField('logoUrl', {
                  label: 'URL du logo (vide = logo BBI embarqué)',
                  onGetErrorMessage: urlValidation
                }),
                PropertyPaneTextField('heroImageUrl', {
                  label: 'URL du visuel de bienvenue (vide = visuel embarqué)',
                  onGetErrorMessage: urlValidation
                }),
                PropertyPaneTextField('heroTitle', {
                  label: 'Titre du bandeau de bienvenue'
                }),
                PropertyPaneTextField('heroDescription', {
                  label: 'Introduction',
                  multiline: true
                }),
                PropertyPaneTextField('catalogUrl', {
                  label: 'URL de la page Catalogue',
                  onGetErrorMessage: urlValidation
                }),
                PropertyPaneTextField('trainerUrl', {
                  label: 'URL de l’espace de travail des formateurs',
                  onGetErrorMessage: urlValidation
                }),
                PropertyPaneTextField('supportUrl', {
                  label: 'URL du formulaire de support',
                  onGetErrorMessage: urlValidation
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
