import { Item, ModuleKey } from './models';
const future = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
};
export const demoItems = (key: ModuleKey): Item[] => {
  const sessions: Item[] = [
    {
      Id: 1,
      Title: "Management d'équipe · Cohorte 7",
      DateDebut: future(7),
      DateFin: future(8),
      Lieu: 'Ouagadougou',
      Modalite: 'Présentiel'
    },
    {
      Id: 2,
      Title: "Coaching d'entrepreneurs",
      DateDebut: future(14),
      DateFin: future(15),
      Lieu: 'Microsoft Teams',
      Modalite: 'Distanciel'
    },
    {
      Id: 3,
      Title: 'Vendre la valeur, pas le prix',
      DateDebut: future(21),
      DateFin: future(22),
      Lieu: 'Ouagadougou',
      Modalite: 'Présentiel'
    }
  ];
  const data: Record<ModuleKey, Item[]> = {
    hero: [],
    sessions,
    trainer: sessions.slice(0, 2),
    news: [
      {
        Id: 1,
        Title: 'Transmettre le savoir. Faire grandir les talents.',
        Categorie: 'Vie du réseau',
        Description:
          'Rencontres, partage de pratiques et nouvelles perspectives : la communauté des formateurs BBI se mobilise.',
        DatePublication: new Date().toISOString()
      },
      {
        Id: 2,
        Title: 'Une nouvelle saison pour développer vos compétences',
        Categorie: 'Formation',
        Description:
          'Découvrez les parcours en management, coaching et développement commercial.',
        DatePublication: new Date().toISOString()
      }
    ],
    links: [
      {
        Id: 1,
        Title: 'Nos formations',
        Description: 'Trouvez le parcours qui vous correspond.',
        Categorie: 'catalog'
      },
      {
        Id: 2,
        Title: 'Espace formateurs',
        Description: 'Préparez vos prochaines interventions.',
        Categorie: 'trainer'
      },
      {
        Id: 3,
        Title: 'Mon planning',
        Description: 'Anticipez vos rendez-vous.',
        Categorie: 'sessions'
      },
      {
        Id: 4,
        Title: 'Support & FAQ',
        Description: 'Une équipe pour vous accompagner.',
        Categorie: 'support'
      }
    ],
    catalog: [
      {
        Id: 1,
        Title: "Management d'équipe",
        CodeFormation: 'BBI-MGT-101',
        Filiere: 'Management',
        Modalite: 'Présentiel',
        DureeH: 14,
        Niveau: 'Confirmé',
        StatutCatalogue: 'Actif'
      },
      {
        Id: 2,
        Title: "Coaching d'entrepreneurs",
        CodeFormation: 'BBI-COA-201',
        Filiere: 'Coaching',
        Modalite: 'Hybride',
        DureeH: 28,
        Niveau: 'Expert',
        StatutCatalogue: 'Actif'
      },
      {
        Id: 3,
        Title: 'Vendre la valeur, pas le prix',
        CodeFormation: 'BBI-COM-110',
        Filiere: 'Commerce',
        Modalite: 'Présentiel',
        DureeH: 7,
        Niveau: 'Tous niveaux',
        StatutCatalogue: 'Actif'
      },
      {
        Id: 4,
        Title: 'Prospection digitale',
        CodeFormation: 'BBI-DIG-140',
        Filiere: 'Digital',
        Modalite: 'Distanciel',
        DureeH: 7,
        Niveau: 'Débutant',
        StatutCatalogue: 'Actif'
      }
    ],
    documents: [
      {
        Id: 1,
        Title: 'Management · Guide de l’animateur',
        FileLeafRef: 'Guide-animateur.pdf',
        Modified: new Date().toISOString()
      },
      {
        Id: 2,
        Title: 'Coaching · Manuel du participant',
        FileLeafRef: 'Manuel-participant.docx',
        Modified: new Date().toISOString()
      },
      {
        Id: 3,
        Title: 'Commerce · Exercices & cas pratiques',
        FileLeafRef: 'Exercices.pptx',
        Modified: new Date().toISOString()
      }
    ],
    directory: [
      {
        Id: 1,
        Title: 'Amélie Martin',
        Fonction: 'Responsable pédagogique',
        Categorie: 'Management & qualité'
      },
      {
        Id: 2,
        Title: 'Stéphane Laurent',
        Fonction: 'Coach certifié',
        Categorie: 'Coaching & leadership'
      },
      {
        Id: 3,
        Title: 'Khadija Diallo',
        Fonction: 'Formatrice',
        Categorie: 'Commerce & négociation'
      }
    ],
    metrics: [
      {
        Id: 1,
        Title: 'sessions animées',
        Valeur: '24',
        Periode: 'Exemple · ce trimestre'
      },
      {
        Id: 2,
        Title: 'de satisfaction',
        Valeur: '96 %',
        Periode: 'Exemple · enquête pédagogique'
      },
      {
        Id: 3,
        Title: 'talents accompagnés',
        Valeur: '137',
        Periode: 'Exemple · cette année'
      },
      {
        Id: 4,
        Title: 'parcours de formation',
        Valeur: '18',
        Periode: 'Exemple · catalogue'
      }
    ],
    resources: [
      {
        Id: 1,
        Title: 'Méthodes & outils d’animation',
        Categorie: 'Pédagogie',
        Description:
          'Kits, modèles et bonnes pratiques pour des sessions engageantes.'
      },
      {
        Id: 2,
        Title: 'Certification & qualité',
        Categorie: 'Qualité',
        Description:
          'Référentiels, évaluations et démarche d’amélioration continue.'
      }
    ],
    community: [
      {
        Id: 1,
        Title: 'Comment animer un groupe hétérogène ?',
        Categorie: 'Partage de pratiques',
        Description: 'Échangez vos expériences et vos conseils avec le réseau.'
      },
      {
        Id: 2,
        Title: 'Les rendez-vous de la communauté',
        Categorie: 'Rencontres',
        Description:
          'Retrouvez les discussions et les temps forts sur votre espace collaboratif.'
      }
    ],
    support: [
      {
        Id: 1,
        Title: 'Comment accéder à mes supports de formation ?',
        Description:
          'Ouvrez la rubrique Supports & documents. Les contenus visibles dépendent de vos autorisations SharePoint.',
        Categorie: 'Documents'
      },
      {
        Id: 2,
        Title: 'Comment retrouver mes prochaines interventions ?',
        Description:
          'Consultez Mon espace formateur. Votre adresse Microsoft 365 doit être renseignée dans le champ FormateurEmail de la session.',
        Categorie: 'Planning'
      }
    ]
  };
  return data[key];
};
