import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneSlider
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import * as React from 'react';
import * as ReactDom from 'react-dom';

import * as strings from 'BbiHomeWebPartStrings';
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
}

export default class BbiHomeWebPart extends BaseClientSideWebPart<IBbiHomeWebPartProps> {
  protected onInit(): Promise<void> {
    if (!this.properties.siteUrl) {
      this.properties.siteUrl = this.context.pageContext.web.absoluteUrl;
    }
    return Promise.resolve();
  }

  public render(): void {
    const element: React.ReactElement<IBbiHomeProps> = React.createElement(BbiHome, {
      siteUrl: this.properties.siteUrl,
      newsListTitle: this.properties.newsListTitle,
      sessionsListTitle: this.properties.sessionsListTitle,
      trainersListTitle: this.properties.trainersListTitle,
      formationsListTitle: this.properties.formationsListTitle,
      documentsLibraryTitle: this.properties.documentsLibraryTitle,
      maxItems: this.properties.maxItems,
      spHttpClient: this.context.spHttpClient,
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
      pages: [{
        header: { description: strings.PropertyPaneDescription },
        groups: [{
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
              value: this.properties.maxItems
            })
          ]
        }]
      }]
    };
  }
}