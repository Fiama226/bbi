import { ModuleDefinition, ModuleKey, PortalSettings } from './models';
export const modules: Record<ModuleKey, ModuleDefinition> = {
  hero: {
    title: 'Bienvenue chez BBI',
    eyebrow: 'Notre ambition, votre réussite',
    list: '',
    fields: '',
    order: ''
  },
  news: {
    title: 'À la une',
    eyebrow: 'La vie du réseau',
    list: 'BBI Actualités',
    fields: 'Description,Categorie,Lien,ImageUrl,DatePublication',
    order: 'DatePublication desc'
  },
  sessions: {
    title: 'Prochaines sessions',
    eyebrow: 'À vos agendas',
    list: 'Sessions',
    fields: 'DateDebut,DateFin,Lieu,Modalite,Lien,FormateurEmail',
    order: 'DateDebut'
  },
  links: {
    title: 'Vos accès essentiels',
    eyebrow: 'Votre quotidien, simplifié',
    list: 'BBI Liens',
    fields: 'Description,Categorie,Lien,Ordre',
    order: 'Ordre'
  },
  catalog: {
    title: 'Développez vos compétences',
    eyebrow: 'Le catalogue des formations',
    list: 'Formations',
    fields: 'CodeFormation,Filiere,Modalite,DureeH,Niveau,StatutCatalogue',
    order: 'Title'
  },
  documents: {
    title: 'Supports & documents',
    eyebrow: 'La bibliothèque pédagogique',
    list: 'Supports publiés',
    fields: 'FileRef,FileLeafRef,Modified',
    order: 'Modified desc'
  },
  directory: {
    title: 'Vos formateurs référents',
    eyebrow: 'Les visages de BBI',
    list: 'BBI Annuaire',
    fields: 'Fonction,Email,Categorie,Ordre',
    order: 'Ordre'
  },
  metrics: {
    title: 'Ensemble, nous avançons',
    eyebrow: 'Nos indicateurs',
    list: 'BBI Indicateurs',
    fields: 'Valeur,Periode,Ordre',
    order: 'Ordre'
  },
  resources: {
    title: 'Des ressources pour aller plus loin',
    eyebrow: 'Méthodes, outils & qualité',
    list: 'BBI Ressources',
    fields: 'Description,Categorie,Lien,Ordre',
    order: 'Ordre'
  },
  community: {
    title: 'La communauté BBI',
    eyebrow: 'Partageons nos expériences',
    list: 'BBI Communauté',
    fields: 'Description,Categorie,Lien,DatePublication',
    order: 'DatePublication desc'
  },
  trainer: {
    title: 'Mon espace formateur',
    eyebrow: 'Préparer. Animer. Transmettre.',
    list: 'Sessions',
    fields: 'DateDebut,DateFin,Lieu,Modalite,Lien,FormateurEmail',
    order: 'DateDebut'
  },
  support: {
    title: 'Comment pouvons-nous vous aider ?',
    eyebrow: 'Support & questions fréquentes',
    list: 'BBI FAQ',
    fields: 'Description,Categorie,Ordre',
    order: 'Ordre'
  }
};
export const moduleKeys: ModuleKey[] = [
  'hero',
  'links',
  'news',
  'sessions',
  'catalog',
  'documents',
  'directory',
  'metrics',
  'resources',
  'community',
  'trainer',
  'support'
];
export const defaults: PortalSettings = {
  siteUrl: '',
  demoMode: false,
  maxItems: 6,
  title: 'BBI Intranet',
  heroTitle: 'Faites grandir vos talents, propulsez vos projets.',
  heroDescription:
    'Un même réseau, une ambition partagée. Retrouvez vos formations, vos ressources et les talents qui font avancer BBI.',
  logoUrl: '',
  heroImageUrl: '',
  catalogUrl: '',
  trainerUrl: '',
  supportUrl: '',
  listTitle: '',
  libraryTitle: '',
  sourcesJson: '{}',
  hiddenModules: ''
};
