import { SPHttpClient } from '@microsoft/sp-http';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

export interface IFicheFormationProps {
  siteUrl: string;
  formationsListTitle: string;
  sessionsListTitle: string;
  documentsLibraryTitle: string;
  trainersListTitle: string;
  /** Code formation attendu si l'URL ne porte pas de paramètre ?code= */
  defaultCode: string;
  showSessions: boolean;
  showDocuments: boolean;
  showTrainer: boolean;
  showDataNotices: boolean;
  spHttpClient: SPHttpClient;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  themeVariant?: IReadonlyTheme;
  strings: IBbiFicheFormationWebPartStrings;
}

export interface IFormationDetail {
  Id?: number;
  Title?: string;
  CodeFormation?: string;
  Filiere?: string;
  Modalite?: string;
  DureeH?: number | string;
  Niveau?: string;
  StatutCatalogue?: string;
  Description?: string;
  Objectifs?: string;
  Programme?: string;
  Prerequis?: string;
  PublicVise?: string;
  FormateursReferents?: string;
  ContactReferent?: string;
  LienInscription?: string;
}

export interface IFormationSession {
  Id: number;
  Title: string;
  StartDate?: string;
  Modality?: string;
  Location?: string;
  Status?: string;
  RegistrationUrl?: string;
}

export interface IFormationDocument {
  Id: number;
  Title?: string;
  FileRef: string;
  FileLeafRef: string;
  TypeSupport?: string;
  StatutSupport?: string;
  Modified?: string;
}

export interface IFormationTrainer {
  Id: number;
  Title: string;
  Role?: string;
  Filiere?: string;
  Initials?: string;
}

export interface IFicheFormationData {
  formation?: IFormationDetail;
  sessions: IFormationSession[];
  documents: IFormationDocument[];
  trainers: IFormationTrainer[];
  isDemo: boolean;
  /** Colonnes optionnelles effectivement présentes dans la liste. */
  availableFields: string[];
}
