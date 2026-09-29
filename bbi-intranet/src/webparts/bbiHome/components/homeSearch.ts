import { SPHttpClient } from '@microsoft/sp-http';
import { safeHref } from '../../../shared/safeUrl';

export interface IHomeSearchResult {
  title: string;
  description: string;
  category: string;
  href: string;
}

interface ISearchCell {
  Key?: string;
  Value?: unknown;
}

const cellValue = (cells: ISearchCell[], key: string): string => {
  const cell = cells.filter((candidate) => candidate.Key === key)[0];
  return cell && cell.Value !== undefined ? String(cell.Value) : '';
};

/** Search SharePoint content with SharePoint's current-user security trimming. */
export const searchPortal = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  searchText: string,
  maxResults: number = 30
): Promise<IHomeSearchResult[]> => {
  const words = (searchText || '')
    .replace(/[^a-zA-Z0-9À-ÖØ-öø-ÿ ._-]/g, ' ')
    .split(/\s+/)
    .filter((word) => !!word)
    .slice(0, 8);
  if (words.length === 0) {
    return [];
  }

  const web = (siteUrl || '').replace(/\/+$/, '');
  const queryText = `Path:"${web}" AND ${words.map((word) => `"${word}"`).join(' AND ')}`;
  const endpoint = new URL(`${web}/_api/search/query`);
  endpoint.searchParams.set('querytext', queryText);
  endpoint.searchParams.set('selectproperties', 'Title,Path,Description,ContentType,FileExtension');
  endpoint.searchParams.set('rowlimit', String(Math.max(1, Math.min(50, maxResults))));
  endpoint.searchParams.set('trimduplicates', 'true');
  endpoint.searchParams.set('enablequeryrules', 'false');

  const response = await spHttpClient.get(endpoint.href, SPHttpClient.configurations.v1);
  if (!response.ok) {
    throw new Error(`SharePoint search failed (${response.status})`);
  }
  const json = (await response.json()) as {
    PrimaryQueryResult?: {
      RelevantResults?: {
        Table?: { Rows?: { results?: { Cells?: { results?: ISearchCell[] } | ISearchCell[] }[] } };
      };
    };
  };
  const rows = json.PrimaryQueryResult?.RelevantResults?.Table?.Rows?.results || [];
  return rows
    .map((row) => {
      const rawCells = row.Cells;
      const cells = Array.isArray(rawCells)
        ? rawCells
        : (rawCells && 'results' in rawCells ? rawCells.results || [] : []);
      const title = cellValue(cells, 'Title').trim();
      const href = safeHref(cellValue(cells, 'Path'));
      if (!title || !href) {
        return undefined;
      }
      const description = cellValue(cells, 'Description').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const category = cellValue(cells, 'ContentType') || cellValue(cells, 'FileExtension') || 'Contenu BBI';
      return { title, description, category, href };
    })
    .filter((result): result is IHomeSearchResult => !!result);
};
