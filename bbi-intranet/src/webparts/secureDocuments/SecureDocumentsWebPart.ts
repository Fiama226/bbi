import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneSlider
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import * as strings from 'SecureDocumentsWebPartStrings';
import SecureDocuments from './components/SecureDocuments';
import { ISecureDocumentsProps } from './components/ISecureDocumentsProps';

export interface ISecureDocumentsWebPartProps {
  siteUrl: string;
  libraryTitle: string;
  maxItems: number;
}

export default class SecureDocumentsWebPart extends BaseClientSideWebPart<ISecureDocumentsWebPartProps> {

  private _isDarkTheme: boolean = false;

  protected onInit(): Promise<void> {
    if (!this.properties.siteUrl) {
      this.properties.siteUrl = this.context.pageContext.web.absoluteUrl;
    }
    return Promise.resolve();
  }

  public render(): void {
    const element: React.ReactElement<ISecureDocumentsProps> = React.createElement(
      SecureDocuments,
      {
        siteUrl: this.properties.siteUrl,
        libraryTitle: this.properties.libraryTitle,
        maxItems: this.properties.maxItems,
        spHttpClient: this.context.spHttpClient,
        isDarkTheme: this._isDarkTheme,
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        strings: strings
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme): void {
    if (!currentTheme) {
      return;
    }
    this._isDarkTheme = !!currentTheme.isInverted;
    const { semanticColors } = currentTheme;
    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
    }
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
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('siteUrl', {
                  label: strings.SiteUrlFieldLabel,
                  description: strings.SiteUrlFieldDescription
                }),
                PropertyPaneTextField('libraryTitle', {
                  label: strings.LibraryFieldLabel,
                  description: strings.LibraryFieldDescription
                }),
                PropertyPaneSlider('maxItems', {
                  label: strings.MaxItemsFieldLabel,
                  min: 3,
                  max: 24,
                  step: 3,
                  showValue: true,
                  value: this.properties.maxItems
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
