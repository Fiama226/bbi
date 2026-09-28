import { SPHttpClient } from '@microsoft/sp-http';
import { DataRequest, DataResult, DataSource, Item } from './models';
import { modules } from './registry';
import { odataLiteral } from './utils';
export class SharePointSource implements DataSource {
  public constructor(private readonly client: SPHttpClient) {}
  public async load(request: DataRequest): Promise<DataResult> {
    const { key, listTitle, userEmail } = request;
    const siteUrl = request.siteUrl.replace(/\/$/, '');
    const definition = modules[key];
    const clauses: string[] = [];
    if (key === 'catalog') clauses.push("StatutCatalogue eq 'Actif'");
    if (key === 'documents') clauses.push('FSObjType eq 0');
    if (key === 'sessions' || key === 'trainer')
      clauses.push(`DateFin ge datetime'${new Date().toISOString()}'`);
    if (key === 'trainer') {
      if (!userEmail)
        throw new Error(
          'Votre adresse utilisateur est indisponible. Le planning personnel ne peut pas être chargé.'
        );
      clauses.push(`FormateurEmail eq '${userEmail.replace(/'/g, "''")}'`);
    }
    const filter = clauses.length
      ? `&$filter=${encodeURIComponent(clauses.join(' and ')).replace(/'/g, '%27')}`
      : '';
    let next: string | undefined =
      `${siteUrl}/_api/web/lists/getbytitle('${odataLiteral(listTitle)}')/items?$select=Id,Title,${definition.fields}&$orderby=${encodeURIComponent(definition.order)}&$top=100${filter}`;
    let displayForm: string | undefined;
    if (['catalog', 'sessions', 'trainer', 'news'].indexOf(key) !== -1) {
      const metadata = await this.client.get(
        `${siteUrl}/_api/web/lists/getbytitle('${odataLiteral(listTitle)}')?$select=DefaultDisplayFormUrl`,
        SPHttpClient.configurations.v1
      );
      if (metadata.ok) {
        displayForm = (
          (await metadata.json()) as { DefaultDisplayFormUrl?: string }
        ).DefaultDisplayFormUrl;
      }
    }
    const items: Item[] = [];
    const visited = new Set<string>();
    while (next && items.length < 500 && visited.size < 25) {
      // Never forward an authenticated request to an unexpected host or outside this site's API.
      const url = new URL(next, siteUrl);
      if (
        url.origin !== new URL(siteUrl).origin ||
        !url.pathname.startsWith(
          `${new URL(siteUrl).pathname.replace(/\/$/, '')}/_api/`
        )
      )
        throw new Error('URL de pagination SharePoint non valide.');
      if (visited.has(url.href))
        throw new Error('Boucle de pagination SharePoint détectée.');
      visited.add(url.href);
      const response = await this.client.get(
        url.href,
        SPHttpClient.configurations.v1
      );
      if (!response.ok) {
        const correlation = response.headers.get('SPRequestGuid');
        const reason =
          response.status === 403
            ? 'Accès refusé : vérifiez vos autorisations.'
            : response.status === 404
              ? 'Liste introuvable : vérifiez le nom et le site source.'
              : response.status === 400
                ? 'Schéma de liste incompatible : vérifiez les noms internes des colonnes.'
                : 'La requête SharePoint a échoué.';
        throw new Error(
          `${reason} HTTP ${response.status}${correlation ? ` · ID de requête ${correlation}` : ''}`
        );
      }
      const json = (await response.json()) as {
        value?: Item[];
        '@odata.nextLink'?: string;
        'odata.nextLink'?: string;
      };
      if (!Array.isArray(json.value))
        throw new Error('Réponse SharePoint inattendue.');
      items.push(...json.value);
      next = json['@odata.nextLink'] || json['odata.nextLink'];
    }
    if (displayForm)
      items.forEach((item) => {
        if (!item.Lien) {
          const form = new URL(displayForm as string, siteUrl);
          form.searchParams.set('ID', String(item.Id));
          item.Lien = form.href;
        }
      });
    return {
      items: items.slice(0, 500),
      truncated: !!next || items.length > 500
    };
  }
}
