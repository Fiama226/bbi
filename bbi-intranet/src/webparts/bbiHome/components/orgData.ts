import { SPHttpClient } from '@microsoft/sp-http';

/** Un poste de l'organigramme (une personne = un nœud). */
export interface IOrgNode {
  Id: number;
  Title: string;
  Role?: string;
  Pole?: string;
  ParentId?: number;
  ParentTitle?: string;
  PhotoUrl?: string;
  Email?: string;
  Phone?: string;
  Location?: string;
  Order?: number;
  DemoIndex?: number;
}

export interface IOrgTreeNode extends IOrgNode {
  children: IOrgTreeNode[];
  /** Profondeur dans l'arbre (0 = direction générale). */
  Depth: number;
}

export interface IOrgChartResult {
  nodes: IOrgNode[];
  isDemo: boolean;
}

const stripSlashes = (value: string): string => (value || '').replace(/\/+$/, '');

const textOf = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'object') {
    const candidate = value as {
      Url?: string;
      Description?: string;
      LookupValue?: string;
      Title?: string;
      Email?: string;
    };
    const resolved =
      candidate.LookupValue ||
      candidate.Title ||
      candidate.Url ||
      candidate.Email ||
      candidate.Description ||
      '';
    return String(resolved).trim() || undefined;
  }
  return String(value);
};

const numberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    const candidate = (value as { Id?: number }).Id;
    return typeof candidate === 'number' ? candidate : undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

/** Complète un nombre à deux chiffres (ES5 : pas de padStart dans la lib SPFx). */
const pad2 = (value: number): string => (value < 10 ? `0${value}` : String(value));

const normalize = (value: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/* ------------------------------------------------------------------ */
/* Organigramme de démonstration                                       */
/* ------------------------------------------------------------------ */

interface IOrgSeed {
  Id: number;
  Name: string;
  Role: string;
  Pole: string;
  Parent?: string;
  Location: string;
}

const ORG_SEED: IOrgSeed[] = [
  { Id: 1, Name: 'Jean-Marc Okafor', Role: 'Directeur général', Pole: 'Direction générale', Location: 'Paris — Siège' },
  { Id: 2, Name: 'Amélie Martin', Role: 'Directrice pédagogique', Pole: 'Pédagogie & ingénierie', Parent: 'Jean-Marc Okafor', Location: 'Paris — Siège' },
  { Id: 3, Name: 'Khadija Diallo', Role: 'Directrice commerciale & réseau', Pole: 'Développement', Parent: 'Jean-Marc Okafor', Location: 'Dakar — Antenne' },
  { Id: 4, Name: 'Marie-Claire Ngoma', Role: 'Directrice qualité & conformité', Pole: 'Qualité', Parent: 'Jean-Marc Okafor', Location: 'Abidjan — Antenne' },
  { Id: 5, Name: 'Thomas Bernard', Role: 'Directeur opérations & digital', Pole: 'Opérations', Parent: 'Jean-Marc Okafor', Location: 'Paris — Siège' },
  { Id: 6, Name: 'Stéphane Laurent', Role: 'Responsable coaching & leadership', Pole: 'Pédagogie & ingénierie', Parent: 'Amélie Martin', Location: 'Lyon' },
  { Id: 7, Name: 'Claire Fontaine', Role: 'Responsable certification', Pole: 'Pédagogie & ingénierie', Parent: 'Amélie Martin', Location: 'Paris — Siège' },
  { Id: 8, Name: 'Youssef El Amrani', Role: 'Responsable parcours management', Pole: 'Pédagogie & ingénierie', Parent: 'Amélie Martin', Location: 'Distanciel' },
  { Id: 9, Name: 'Awa Traoré', Role: 'Responsable antenne Bamako', Pole: 'Développement', Parent: 'Khadija Diallo', Location: 'Bamako — Antenne' },
  { Id: 10, Name: 'Samuel Kouassi', Role: 'Responsable antenne Abidjan', Pole: 'Développement', Parent: 'Khadija Diallo', Location: 'Abidjan — Antenne' },
  { Id: 11, Name: 'Fatou Ndiaye', Role: 'Auditrice qualité', Pole: 'Qualité', Parent: 'Marie-Claire Ngoma', Location: 'Dakar — Antenne' },
  { Id: 12, Name: 'Léa Marchand', Role: 'Cheffe de projet e-learning', Pole: 'Opérations', Parent: 'Thomas Bernard', Location: 'Paris — Siège' }
];

const slug = (value: string): string =>
  normalize(value).replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

export const DEMO_ORG_NODES: IOrgNode[] = ORG_SEED.map((seed, index) => ({
  Id: seed.Id,
  Title: seed.Name,
  Role: seed.Role,
  Pole: seed.Pole,
  ParentTitle: seed.Parent,
  Email: `${slug(seed.Name)}@businessbuilders.fr`,
  Phone: `+33 1 84 20 ${pad2(10 + index)} ${pad2(20 + index)}`,
  Location: seed.Location,
  Order: index,
  DemoIndex: index % 4
}));

/* ------------------------------------------------------------------ */
/* Lecture + construction de l'arbre                                   */
/* ------------------------------------------------------------------ */

const ORG_FIELDS: { [key: string]: string[] } = {
  Role: ['Role', 'Rôle', 'Fonction', 'Poste'],
  Pole: ['Pole', 'Pôle', 'Direction', 'Departement'],
  Parent: ['Parent', 'Manager', 'Responsable', 'Rattachement'],
  ParentId: ['ParentId', 'ParentID', 'ManagerId'],
  PhotoUrl: ['PhotoUrl', 'Photo', 'Portrait', 'Avatar', 'Image'],
  Email: ['Email', 'Mail', 'Courriel'],
  Phone: ['Phone', 'Telephone', 'Téléphone', 'Numero', 'Mobile'],
  Location: ['Location', 'Localisation', 'Ville', 'Site', 'Bureau'],
  Order: ['Ordre', 'Order', 'Tri']
};

const pickField = (available: string[], candidates: string[]): string | undefined => {
  for (let i = 0; i < candidates.length; i += 1) {
    if (available.indexOf(candidates[i]) !== -1) {
      return candidates[i];
    }
  }
  return undefined;
};

export const loadOrgChart = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string
): Promise<IOrgChartResult> => {
  try {
    const fieldsEndpoint =
      `${stripSlashes(siteUrl)}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields` +
      `?$select=InternalName&$top=500`;
    const fieldsResponse = await spHttpClient.get(fieldsEndpoint, SPHttpClient.configurations.v1);
    if (!fieldsResponse.ok) {
      throw new Error(`HTTP ${fieldsResponse.status}`);
    }
    const fieldsJson = (await fieldsResponse.json()) as { value?: { InternalName: string }[] };
    const fields = (fieldsJson.value || []).map((field) => field.InternalName);
    const mapping: { [key: string]: string } = {};
    Object.keys(ORG_FIELDS).forEach((key) => {
      const field = pickField(fields, ORG_FIELDS[key]);
      if (field) {
        mapping[key] = field;
      }
    });
    const select = ['Id', 'Title']
      .concat(Object.keys(mapping).map((key) => mapping[key]))
      .filter((value, index, all) => all.indexOf(value) === index);
    const endpoint =
      `${stripSlashes(siteUrl)}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items` +
      `?$select=${select.join(',')}&$top=300`;
    const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const json = (await response.json()) as { value?: { [key: string]: unknown }[] };
    const nodes: IOrgNode[] = (json.value || [])
      .map((raw, index) => ({
        Id: Number(raw.Id) || index + 1,
        Title: textOf(raw.Title) || '',
        Role: mapping.Role ? textOf(raw[mapping.Role]) : undefined,
        Pole: mapping.Pole ? textOf(raw[mapping.Pole]) : undefined,
        ParentId: mapping.ParentId ? numberOrUndefined(raw[mapping.ParentId]) : undefined,
        ParentTitle: mapping.Parent ? textOf(raw[mapping.Parent]) : undefined,
        PhotoUrl: mapping.PhotoUrl ? textOf(raw[mapping.PhotoUrl]) : undefined,
        Email: mapping.Email ? textOf(raw[mapping.Email]) : undefined,
        Phone: mapping.Phone ? textOf(raw[mapping.Phone]) : undefined,
        Location: mapping.Location ? textOf(raw[mapping.Location]) : undefined,
        Order: mapping.Order ? numberOrUndefined(raw[mapping.Order]) : index,
        DemoIndex: index % 4
      }))
      .filter((node) => !!node.Title);
    if (nodes.length === 0) {
      return { nodes: DEMO_ORG_NODES, isDemo: true };
    }
    return { nodes, isDemo: false };
  } catch {
    return { nodes: DEMO_ORG_NODES, isDemo: true };
  }
};

/**
 * Construit la forêt hiérarchique : parents résolus par identifiant, par nom,
 * ou racine si le rattachement est inconnu. Les boucles éventuelles sont
 * cassées pour ne jamais perdre de personne à l'affichage.
 */
export const buildOrgTree = (nodes: IOrgNode[]): IOrgTreeNode[] => {
  const treeNodes: IOrgTreeNode[] = nodes.map((node) => ({
    ...node,
    children: [],
    Depth: 0
  }));
  const byId: { [key: number]: IOrgTreeNode } = {};
  const byName: { [key: string]: IOrgTreeNode } = {};
  treeNodes.forEach((node) => {
    byId[node.Id] = node;
    byName[normalize(node.Title)] = node;
  });

  // 1) Rattachement : identifiant du manager, sinon nom du manager.
  const parents: (IOrgTreeNode | undefined)[] = treeNodes.map((node) => {
    if (node.ParentId !== undefined && byId[node.ParentId] && byId[node.ParentId] !== node) {
      return byId[node.ParentId];
    }
    if (node.ParentTitle) {
      const candidate = byName[normalize(node.ParentTitle)];
      if (candidate && candidate !== node) {
        return candidate;
      }
    }
    return undefined;
  });

  // 2) Boucles éventuelles : le nœud fautif remonte à la racine, personne n'est perdu.
  const roots: IOrgTreeNode[] = [];
  treeNodes.forEach((node, index) => {
    const parent = parents[index];
    if (!parent) {
      roots.push(node);
      return;
    }
    const seen: IOrgTreeNode[] = [node];
    let cursor: IOrgTreeNode | undefined = parent;
    while (cursor) {
      if (seen.indexOf(cursor) !== -1) {
        roots.push(node);
        return;
      }
      seen.push(cursor);
      cursor = parents[treeNodes.indexOf(cursor)];
    }
    parent.children.push(node);
  });

  // 3) Profondeur + ordre d'affichage (ordre de la liste, puis alphabétique).
  const walk = (list: IOrgTreeNode[], depth: number): void => {
    list
      .slice()
      .sort((a, b) => (a.Order || 0) - (b.Order || 0) || a.Title.localeCompare(b.Title, 'fr'))
      .forEach((node) => {
        node.Depth = depth;
        node.children = node.children
          .slice()
          .sort((a, b) => (a.Order || 0) - (b.Order || 0) || a.Title.localeCompare(b.Title, 'fr'));
        walk(node.children, depth + 1);
      });
  };
  walk(roots, 0);
  return roots;
};

/** Liste ordonnée des pôles présents dans l'organigramme. */
export const orgPoles = (nodes: IOrgNode[]): string[] => {
  const unique: { [key: string]: boolean } = {};
  nodes.forEach((node) => {
    const value = (node.Pole || '').trim();
    if (value) {
      unique[value] = true;
    }
  });
  return Object.keys(unique).sort((a, b) => a.localeCompare(b, 'fr'));
};
