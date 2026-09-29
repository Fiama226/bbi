import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneSlider,
  PropertyPaneTextField,
  PropertyPaneToggle
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import strings from 'BbiSessionsInscriptionWebPartStrings';
import SessionsInscription from './components/SessionsInscription';
import { ISessionsInscriptionProps } from './components/ISessionsInscriptionProps';

export interface ISessionsInscriptionWebPartProps {
  siteUrl: string;
  sessionsListTitle: string;
  formationsListTitle: string;
  defaultFiliere: string;
  maxItems: number;
  showPast: boolean;
  showDataNotices: boolean;
}

export default class SessionsInscriptionWebPart extends BaseClientSideWebPart<ISessionsInscriptionWebPartProps> {
  private _themeVariant: IReadonlyTheme | undefined;

  protected onInit(): Promise<void> {
    if (!this.properties.siteUrl) {
      this.properties.siteUrl = this.context.pageContext.web.absoluteUrl;
    }
    if (!this.properties.sessionsListTitle) {
      this.properties.sessionsListTitle = 'Sessions';
    }
    if (!this.properties.formationsListTitle) {
      this.properties.formationsListTitle = 'Formations';
    }
    if (!this.properties.maxItems) {
      this.properties.maxItems = 30;
    }
    if (this.properties.showPast === undefined) {
      this.properties.showPast = false;
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
    const element: React.ReactElement<ISessionsInscriptionProps> = React.createElement(
      SessionsInscription,
      {
        siteUrl: this.properties.siteUrl,
        sessionsListTitle: this.properties.sessionsListTitle,
        formationsListTitle: this.properties.formationsListTitle,
        defaultFiliere: this.properties.defaultFiliere || '',
        maxItems: this.properties.maxItems || 30,
        showPast: this.properties.showPast === true,
        showDataNotices: this.properties.showDataNotices === true,
        spHttpClient: this.context.spHttpClient,
        isDarkTheme: this._themeVariant ? !!this._themeVariant.isInverted : false,
        hasTeamsContext: !!(this.context.sdks && this.context.sdks.microsoftTeams),
        themeVariant: this._themeVariant,
        strings
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
    return {
      pages: [
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
                PropertyPaneTextField('sessionsListTitle', { label: strings.SessionsListFieldLabel }),
                PropertyPaneTextField('formationsListTitle', { label: strings.FormationsListFieldLabel }),
                PropertyPaneTextField('defaultFiliere', {
                  label: strings.DefaultFiliereFieldLabel,
                  description: strings.DefaultFiliereFieldDescription
                })
              ]
            },
            {
              groupName: strings.DisplayGroupName,
              groupFields: [
                PropertyPaneSlider('maxItems', {
                  label: strings.MaxItemsFieldLabel,
                  min: 6,
                  max: 60,
                  step: 6,
                  showValue: true,
                  value: this.properties.maxItems || 30
                }),
                PropertyPaneToggle('showPast', {
                  label: strings.ShowPastFieldLabel,
                  checked: this.properties.showPast === true
                }),
                PropertyPaneToggle('showDataNotices', {
                  label: strings.ShowDataNoticesFieldLabel,
                  checked: this.properties.showDataNotices === true
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
