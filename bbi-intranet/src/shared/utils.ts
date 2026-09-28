import { Item, ModuleKey } from './models';
/** OData string escaping must happen before URL encoding (encodeURIComponent leaves apostrophes intact). */
export const odataLiteral = (value: string): string =>
  encodeURIComponent(value.replace(/'/g, "''")).replace(/'/g, '%27');
export const safeUrl = (
  value: string | undefined,
  base: string
): string | undefined => {
  if (!value || !value.trim() || value.trim() === '#') return undefined;
  try {
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};
export const documentUrl = (
  value: string | undefined,
  base: string
): string | undefined => {
  const safe = safeUrl(value, base);
  if (!safe) return undefined;
  const url = new URL(safe);
  url.searchParams.set('web', '1');
  return url.href;
};
export const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
export const filterItems = (
  items: Item[],
  query: string,
  category: string
): Item[] =>
  items.filter(
    (item) =>
      (!category || (item.Filiere || item.Categorie || '') === category) &&
      normalize(
        [item.Title, item.Description, item.CodeFormation, item.Fonction].join(
          ' '
        )
      ).indexOf(normalize(query.trim())) >= 0
  );
export const dateLabel = (value?: string): string =>
  value && !isNaN(Date.parse(value))
    ? new Date(value).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : 'Date à préciser';
export const parseSources = (
  value: string
): Partial<Record<ModuleKey, string>> => {
  const parsed: unknown = JSON.parse(value || '{}');
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    Object.values(parsed).some((v) => typeof v !== 'string')
  ) {
    throw new Error(
      'Les sources doivent être un objet JSON avec des noms de listes en texte.'
    );
  }
  return parsed as Partial<Record<ModuleKey, string>>;
};
export const emailUrl = (value?: string): string | undefined =>
  value && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value)
    ? `mailto:${encodeURIComponent(value).replace('%40', '@')}`
    : undefined;
