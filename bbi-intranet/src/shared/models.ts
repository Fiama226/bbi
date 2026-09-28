export type ModuleKey =
  | 'hero'
  | 'news'
  | 'sessions'
  | 'links'
  | 'catalog'
  | 'documents'
  | 'directory'
  | 'metrics'
  | 'resources'
  | 'community'
  | 'trainer'
  | 'support';
export type WebPartKind = ModuleKey | 'home';
export interface Item {
  Id: number;
  Title: string;
  Description?: string;
  Categorie?: string;
  Lien?: string;
  ImageUrl?: string;
  DatePublication?: string;
  DateDebut?: string;
  DateFin?: string;
  Lieu?: string;
  Modalite?: string;
  FormateurEmail?: string;
  Filiere?: string;
  CodeFormation?: string;
  DureeH?: number;
  Niveau?: string;
  StatutCatalogue?: string;
  FileRef?: string;
  FileLeafRef?: string;
  Modified?: string;
  Email?: string;
  Fonction?: string;
  Valeur?: string;
  Periode?: string;
  Ordre?: number;
}
export interface ModuleDefinition {
  title: string;
  eyebrow: string;
  list: string;
  fields: string;
  order: string;
}
export interface DataRequest {
  key: ModuleKey;
  siteUrl: string;
  listTitle: string;
  userEmail: string;
}
export interface DataResult {
  items: Item[];
  truncated: boolean;
}
export interface DataSource {
  load(request: DataRequest): Promise<DataResult>;
}
export interface PortalSettings {
  siteUrl: string;
  demoMode: boolean;
  maxItems: number;
  title: string;
  heroTitle: string;
  heroDescription: string;
  logoUrl: string;
  heroImageUrl: string;
  catalogUrl: string;
  trainerUrl: string;
  supportUrl: string;
  listTitle: string;
  libraryTitle: string;
  sourcesJson: string;
  hiddenModules: string;
}
export interface PortalProps {
  kind: WebPartKind;
  settings: PortalSettings;
  source: DataSource;
  userName: string;
  userEmail: string;
  instanceId: string;
}
