import { SPHttpClient } from '@microsoft/sp-http';
import {
  IFicheFormationData,
  IFormationDetail,
  IFormationDocument,
  IFormationSession,
  IFormationTrainer
} from './IFicheFormationProps';

const stripSlashes = (value: string): string => value.replace(/\/+$/, '');

/** Colonnes optionnelles : présentes ou non selon le provisionnement. */
const OPTIONAL_FIELDS: { [key: string]: string[] } = {
  Description: ['Description', 'Resume', 'Résumé', 'Presentation'],
  Objectifs: ['Objectifs', 'ObjectifsPedagogiques', 'Objectifs_x0020_p_x00e9_dagogiques'],
  Programme: ['Programme', 'Contenu', 'ProgrammeDetaille'],
  Prerequis: ['Prerequis', 'Prérequis', 'Prerequis_x0020_'],
  PublicVise: ['PublicVise', 'Public', 'PublicCible'],
  FormateursReferents: ['FormateursReferents', 'Formateurs', 'FormateurReferent'],
  ContactReferent: ['ContactReferent', 'Contact'],
  LienInscription: ['LienInscription', 'Inscription', 'RegistrationUrl']
};

/** Colonnes « cœur » attendues par le catalogue : on les ajoute si elles existent. */
const CORE_FIELDS: string[] = [
  'Title',
  'CodeFormation',
  'Filiere',
  'Modalite',
  'DureeH',
  'Niveau',
  'StatutCatalogue'
];

const DEMO_FORMATION: IFormationDetail = {
  Id: 1,
  Title: "Management d'équipe",
  CodeFormation: 'BBI-MGT-101',
  Filiere: 'Management',
  Modalite: 'Présentiel',
  DureeH: 14,
  Niveau: 'Confirmé',
  StatutCatalogue: 'Actif',
  Description:
    "Un parcours intensif de deux jours pour structurer son rôle de manager, gagner en clarté dans la délégation et installer un cadre de confiance avec son équipe.",
  Objectifs:
    "Poser un cadre de fonctionnement lisible\nAdapter son style de management à chaque collaborateur\nConduire un entretien de recadrage sans conflit\nFixer des objectifs mesurables et suivre leur atteinte",
  Programme:
    "Jour 1 — Les fondamentaux du leadership ; cartographie de son style ; la délégation progressive\nJour 2 — Entretiens difficiles ; feedback structuré ; plan d'action individuel à 90 jours",
  Prerequis: "Aucun prérequis. Exercer une responsabilité d'encadrement ou la préparer.",
  PublicVise: 'Managers de proximité, chefs de projet, futurs encadrants',
  FormateursReferents: 'Amélie Martin',
  ContactReferent: 'pedagogie@bbi.example'
};

const DEMO_SESSIONS: IFormationSession[] = [
  { Id: 1, Title: "Management d'équipe — Cohorte 7", StartDate: '', Modality: 'Présentiel', Location: 'Paris', Status: 'Inscriptions ouvertes' },
  { Id: 2, Title: "Management d'équipe — Cohorte 8", StartDate: '', Modality: 'Hybride', Location: 'Lyon', Status: '3 places' }
];

const DEMO_DOCUMENTS: IFormationDocument[] = [
  { Id: 1, Title: 'MGT-101 · Slides animateur', FileRef: '#', FileLeafRef: 'MGT-101 Slides animateur v2026.2.pptx', TypeSupport: 'Slides animateur', StatutSupport: 'Publié' },
  { Id: 2, Title: 'MGT-101 · Manuel participant', FileRef: '#', FileLeafRef: 'MGT-101 Manuel participant v2026.1.docx', TypeSupport: 'Manuel participant', StatutSupport: 'Publié' },
  { Id: 3, Title: 'MGT-101 · Grille d’évaluation à chaud', FileRef: '#', FileLeafRef: 'MGT-101 Evaluation v2026.1.pdf', TypeSupport: 'Évaluation', StatutSupport: 'Publié' }
];

const DEMO_TRAINERS: IFormationTrainer[] = [
  { Id: 1, Title: 'Amélie Martin', Role: 'Responsable pédagogique', Filiere: 'Management & Qualité', Initials: 'AM' }
];

/** Ajoute des dates de démonstration relatives à aujourd'hui (le jour même n'expire jamais). */
export const demoResult = (): IFicheFormationData => {
  const demoDays = [7, 21];
  return {
    formation: DEMO_FORMATION,
    sessions: DEMO_SESSIONS.map((session, index) => {
      const date = new Date();
      date.setDate(date.getDate() + demoDays[index]);
      date.setHours(9, 0, 0, 0);
      return { ...session, StartDate: date.toISOString() };
    }),
    documents: DEMO_DOCUMENTS,
    trainers: DEMO_TRAINERS,
    isDemo: true,
    availableFields: Object.keys(OPTIONAL_FIELDS).concat(CORE_FIELDS)
  };
};

const readFields = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string
): Promise<string[]> => {
  const endpoint =
    `${stripSlashes(siteUrl)}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/fields` +
    `?$select=InternalName,TypeAsString&$top=500`;
  const response = await spHttpClient.get(endpoint, SPHttpClient.configurations.v1);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const json = (await response.json()) as { value?: { InternalName: string }[] };
  return (json.value || []).map((field) => field.InternalName);
};

const pick = (available: string[], candidates: string[]): string | undefined => {
  for (let i = 0; i < candidates.length; i += 1) {
    if (available.indexOf(candidates[i]) !== -1) {
      return candidates[i];
    }
  }
  return undefined;
};

const textOf = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }
  if (typeof value === 'object') {
    const link = value as { Url?: string; Description?: string };
    return (link.Url || link.Description || '').trim() || undefined;
  }
  return String(value);
};

/**
 * Charge la fiche formation : la formation elle-même (par code ou par identifiant),
 * ses prochaines sessions, ses supports publiés et ses formateurs référents.
 */
export const loadFicheFormation = async (
  spHttpClient: SPHttpClient,
  siteUrl: string,
  listTitle: string,
  sessionsListTitle: string,
  documentsLibraryTitle: string,
  trainersListTitle: string,
  code: string,
  options: { sessions: boolean; documents: boolean; trainer: boolean }
): Promise<IFicheFormationData> => {
  const web = stripSlashes(siteUrl);
  try {
    const fields = await readFields(spHttpClient, siteUrl, listTitle);
    const mapping: { [key: string]: string | undefined } = {};
    Object.keys(OPTIONAL_FIELDS).forEach((key) => {
      mapping[key] = pick(fields, OPTIONAL_FIELDS[key]);
    });
    const select: string[] = ['Id'];
    CORE_FIELDS.forEach((field) => {
      if (fields.indexOf(field) !== -1) {
        select.push(field);
      }
    });
    Object.keys(mapping).forEach((key) => {
      const field = mapping[key];
      if (field && select.indexOf(field) === -1) {
        select.push(field);
      }
    });

    const filter = code
      ? `&$filter=CodeFormation eq '${code.replace(/'/g, "''")}'`
      : '';
    const formationEndpoint =
      `${web}/_api/web/lists/getbytitle('${encodeURIComponent(listTitle)}')/items` +
      `?$select=${select.join(',')}${filter}&$orderby=Title&$top=1`;
    const formationResponse = await spHttpClient.get(formationEndpoint, SPHttpClient.configurations.v1);
    if (!formationResponse.ok) {
      throw new Error(`HTTP ${formationResponse.status}`);
    }
    const formationJson = (await formationResponse.json()) as { value?: { [key: string]: unknown }[] };
    const raw = (formationJson.value || [])[0];
    if (!raw) {
      return demoResult();
    }

    const formation: IFormationDetail = {
      Id: Number(raw.Id),
      Title: textOf(raw.Title),
      CodeFormation: textOf(raw.CodeFormation) || code,
      Filiere: textOf(raw.Filiere),
      Modalite: textOf(raw.Modalite),
      DureeH: raw.DureeH as number | string | undefined,
      Niveau: textOf(raw.Niveau),
      StatutCatalogue: textOf(raw.StatutCatalogue),
      Description: mapping.Description ? textOf(raw[mapping.Description]) : undefined,
      Objectifs: mapping.Objectifs ? textOf(raw[mapping.Objectifs]) : undefined,
      Programme: mapping.Programme ? textOf(raw[mapping.Programme]) : undefined,
      Prerequis: mapping.Prerequis ? textOf(raw[mapping.Prerequis]) : undefined,
      PublicVise: mapping.PublicVise ? textOf(raw[mapping.PublicVise]) : undefined,
      FormateursReferents: mapping.FormateursReferents
        ? textOf(raw[mapping.FormateursReferents])
        : undefined,
      ContactReferent: mapping.ContactReferent ? textOf(raw[mapping.ContactReferent]) : undefined,
      LienInscription: mapping.LienInscription ? textOf(raw[mapping.LienInscription]) : undefined
    };
    const formationCode = formation.CodeFormation || code;

    let sessions: IFormationSession[] = [];
    if (options.sessions && formationCode) {
      try {
        const sessionEndpoint =
          `${web}/_api/web/lists/getbytitle('${encodeURIComponent(sessionsListTitle)}')/items` +
          `?$select=Id,Title,StartDate,Modality,Location,Status,RegistrationUrl` +
          `&$filter=substringof('${formationCode.replace(/'/g, "''")}',Title)` +
          `&$orderby=StartDate&$top=6`;
        const sessionResponse = await spHttpClient.get(sessionEndpoint, SPHttpClient.configurations.v1);
        if (sessionResponse.ok) {
          const json = (await sessionResponse.json()) as { value?: IFormationSession[] };
          const now = Date.now();
          sessions = (json.value || [])
            .filter((session) => !session.StartDate || new Date(session.StartDate).getTime() >= now)
            .slice(0, 4);
        }
      } catch {
        sessions = [];
      }
    }

    let documents: IFormationDocument[] = [];
    if (options.documents && formationCode) {
      try {
        const documentEndpoint =
          `${web}/_api/web/lists/getbytitle('${encodeURIComponent(documentsLibraryTitle)}')/items` +
          `?$select=Id,Title,FileRef,FileLeafRef,TypeSupport,StatutSupport,Modified` +
          `&$filter=CodeFormation eq '${formationCode.replace(/'/g, "''")}'` +
          `&$orderby=TypeSupport&$top=10`;
        const documentResponse = await spHttpClient.get(documentEndpoint, SPHttpClient.configurations.v1);
        if (documentResponse.ok) {
          const json = (await documentResponse.json()) as { value?: IFormationDocument[] };
          documents = json.value || [];
        }
      } catch {
        documents = [];
      }
    }

    let trainers: IFormationTrainer[] = [];
    if (options.trainer && formation.FormateursReferents) {
      const names = formation.FormateursReferents
        .split(/[;,]/)
        .map((name) => name.trim())
        .filter((name) => !!name);
      if (names.length > 0) {
        try {
          const trainerEndpoint =
            `${web}/_api/web/lists/getbytitle('${encodeURIComponent(trainersListTitle)}')/items` +
            `?$select=Id,Title,Role,Filiere,Initials&$orderby=Title&$top=200`;
          const trainerResponse = await spHttpClient.get(trainerEndpoint, SPHttpClient.configurations.v1);
          if (trainerResponse.ok) {
            const json = (await trainerResponse.json()) as { value?: IFormationTrainer[] };
            trainers = (json.value || []).filter(
              (trainer) => names.indexOf(trainer.Title.trim()) !== -1
            );
          }
        } catch {
          trainers = [];
        }
      }
    }

    return {
      formation,
      sessions,
      documents,
      trainers,
      isDemo: false,
      availableFields: fields
    };
  } catch {
    return demoResult();
  }
};
