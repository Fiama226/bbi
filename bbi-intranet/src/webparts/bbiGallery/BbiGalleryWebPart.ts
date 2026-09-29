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

import strings from 'BbiGalleryWebPartStrings';
import BbiGallery from './components/BbiGallery';
import { IBbiGalleryProps } from './components/IBbiGalleryProps';

export interface IBbiGalleryWebPartProps {
  siteUrl: string;
  libraryTitle: string;
  maxItems: number;
  columns: number;
  showCaptions: boolean;
  allowDownload: boolean;
  showDataNotices: boolean;
  albumFilter: string;
}

export default class BbiGalleryWebPart extends BaseClientSideWebPart<IBbiGalleryWebPartProps> {
  private _themeVariant: IReadonlyTheme | undefined;

  protected onInit(): Promise<void> {
    if (!this.properties.siteUrl) {
      this.properties.siteUrl = this.context.pageContext.web.absoluteUrl;
    }
    if (!this.properties.libraryTitle) {
      this.properties.libraryTitle = 'Galerie médias';
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
    const element: React.ReactElement<IBbiGalleryProps> = React.createElement(BbiGallery, {
      siteUrl: this.properties.siteUrl,
      libraryTitle: this.properties.libraryTitle,
      maxItems: this.properties.maxItems || 24,
      columns: this.properties.columns || 3,
      showCaptions: this.properties.showCaptions !== false,
      allowDownload: this.properties.allowDownload !== false,
      showDataNotices: this.properties.showDataNotices === true,
      albumFilter: this.properties.albumFilter || '',
      spHttpClient: this.context.spHttpClient,
      isDarkTheme: this._isDarkTheme,
      hasTeamsContext: !!(this.context.sdks && this.context.sdks.microsoftTeams),
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

  private get _isDarkTheme(): boolean {
    return this._themeVariant ? !!this._themeVariant.isInverted : false;
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
                PropertyPaneTextField('libraryTitle', {
                  label: strings.LibraryTitleFieldLabel,
                  description: strings.LibraryTitleFieldDescription
                }),
                PropertyPaneTextField('albumFilter', {
                  label: strings.AlbumFilterFieldLabel,
                  description: strings.AlbumFilterFieldDescription
                }),
                PropertyPaneSlider('maxItems', {
                  label: strings.MaxItemsFieldLabel,
                  min: 6,
                  max: 60,
                  step: 6,
                  showValue: true,
                  value: this.properties.maxItems || 24
                })
              ]
            },
            {
              groupName: strings.DisplayGroupName,
              groupFields: [
                PropertyPaneSlider('columns', {
                  label: strings.ColumnsFieldLabel,
                  min: 1,
                  max: 5,
                  step: 1,
                  showValue: true,
                  value: this.properties.columns || 3
                }),
                PropertyPaneToggle('showCaptions', {
                  label: strings.ShowCaptionsFieldLabel,
                  checked: this.properties.showCaptions !== false
                }),
                PropertyPaneToggle('allowDownload', {
                  label: strings.AllowDownloadFieldLabel,
                  checked: this.properties.allowDownload !== false
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
