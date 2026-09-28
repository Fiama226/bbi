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

import * as strings from 'BbiArticleActualiteWebPartStrings';
import ArticleActualite from './components/ArticleActualite';
import { IArticleActualiteProps } from './components/IArticleActualiteProps';

export interface IArticleActualiteWebPartProps {
  siteUrl: string;
  newsListTitle: string;
  defaultItemId: number;
  maxRelated: number;
  shareUrl: string;
  showDataNotices: boolean;
}

export default class ArticleActualiteWebPart extends BaseClientSideWebPart<IArticleActualiteWebPartProps> {
  private _themeVariant: IReadonlyTheme | undefined;

  protected onInit(): Promise<void> {
    if (!this.properties.siteUrl) {
      this.properties.siteUrl = this.context.pageContext.web.absoluteUrl;
    }
    if (!this.properties.newsListTitle) {
      this.properties.newsListTitle = 'Actualites';
    }
    if (!this.properties.maxRelated) {
      this.properties.maxRelated = 3;
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
    const element: React.ReactElement<IArticleActualiteProps> = React.createElement(ArticleActualite, {
      siteUrl: this.properties.siteUrl,
      newsListTitle: this.properties.newsListTitle,
      defaultItemId: this.properties.defaultItemId || 0,
      maxRelated: this.properties.maxRelated || 3,
      showDataNotices: this.properties.showDataNotices === true,
      shareUrl: this.properties.shareUrl || '',
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
                PropertyPaneTextField('newsListTitle', { label: strings.NewsListFieldLabel }),
                PropertyPaneSlider('defaultItemId', {
                  label: strings.DefaultItemIdFieldLabel,
                  min: 0,
                  max: 5000,
                  step: 1,
                  showValue: true,
                  value: this.properties.defaultItemId || 0
                })
              ]
            },
            {
              groupName: strings.DisplayGroupName,
              groupFields: [
                PropertyPaneSlider('maxRelated', {
                  label: strings.MaxRelatedFieldLabel,
                  min: 0,
                  max: 6,
                  step: 1,
                  showValue: true,
                  value: this.properties.maxRelated || 3
                }),
                PropertyPaneTextField('shareUrl', {
                  label: strings.ShareUrlFieldLabel,
                  description: strings.ShareUrlFieldDescription
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
