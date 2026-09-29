import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import strings from 'BbiFicheFormationWebPartStrings';
import FicheFormation from './components/FicheFormation';
import { IFicheFormationProps } from './components/IFicheFormationProps';

export interface IFicheFormationWebPartProps {
  siteUrl: string;
  formationsListTitle: string;
  sessionsListTitle: string;
  documentsLibraryTitle: string;
  trainersListTitle: string;
  defaultCode: string;
  showSessions: boolean;
  showDocuments: boolean;
  showTrainer: boolean;
  showDataNotices: boolean;
}

export default class FicheFormationWebPart extends BaseClientSideWebPart<IFicheFormationWebPartProps> {
  private _themeVariant: IReadonlyTheme | undefined;

  protected onInit(): Promise<void> {
    if (!this.properties.siteUrl) {
      this.properties.siteUrl = this.context.pageContext.web.absoluteUrl;
    }
    if (!this.properties.formationsListTitle) {
      this.properties.formationsListTitle = 'Formations';
    }
    if (this.properties.showSessions === undefined) {
      this.properties.showSessions = true;
    }
    if (this.properties.showDocuments === undefined) {
      this.properties.showDocuments = true;
    }
    if (this.properties.showTrainer === undefined) {
      this.properties.showTrainer = true;
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
    const element: React.ReactElement<IFicheFormationProps> = React.createElement(FicheFormation, {
      siteUrl: this.properties.siteUrl,
      formationsListTitle: this.properties.formationsListTitle,
      sessionsListTitle: this.properties.sessionsListTitle,
      documentsLibraryTitle: this.properties.documentsLibraryTitle,
      trainersListTitle: this.properties.trainersListTitle,
      defaultCode: this.properties.defaultCode || '',
      showSessions: this.properties.showSessions !== false,
      showDocuments: this.properties.showDocuments !== false,
      showTrainer: this.properties.showTrainer !== false,
      showDataNotices: this.properties.showDataNotices === true,
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
                PropertyPaneTextField('formationsListTitle', { label: strings.FormationsListFieldLabel }),
                PropertyPaneTextField('sessionsListTitle', { label: strings.SessionsListFieldLabel }),
                PropertyPaneTextField('documentsLibraryTitle', { label: strings.DocumentsLibraryFieldLabel }),
                PropertyPaneTextField('trainersListTitle', { label: strings.TrainersListFieldLabel }),
                PropertyPaneTextField('defaultCode', {
                  label: strings.DefaultCodeFieldLabel,
                  description: strings.DefaultCodeFieldDescription
                })
              ]
            },
            {
              groupName: strings.DisplayGroupName,
              groupFields: [
                PropertyPaneToggle('showSessions', {
                  label: strings.ShowSessionsFieldLabel,
                  checked: this.properties.showSessions !== false
                }),
                PropertyPaneToggle('showDocuments', {
                  label: strings.ShowDocumentsFieldLabel,
                  checked: this.properties.showDocuments !== false
                }),
                PropertyPaneToggle('showTrainer', {
                  label: strings.ShowTrainerFieldLabel,
                  checked: this.properties.showTrainer !== false
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
