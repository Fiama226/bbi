# Formulaire de satisfaction BBI

Après chaque séance (formation, conseil, coaching), le formateur ou le coach envoie ce formulaire au client. Les réponses arrivent dans la liste SharePoint **Avis clients** du portail, où l'équipe les lit, les trie par pôle et suit la recommandation.

Ce document donne les questions à reprendre telles quelles, la façon de créer le formulaire, le message à envoyer et le branchement vers la liste.

## 1. Les questions

Les questions sont courtes : un client y répond en moins de deux minutes, y compris sur téléphone.

| # | Question | Type dans Microsoft Forms | Obligatoire | Colonne de la liste « Avis clients » |
|---|---|---|---|---|
| 1 | Votre nom ou celui de votre entreprise | Texte | Non | `Client` |
| 2 | Quel type d'accompagnement avez-vous suivi ? | Choix : Formation, Conseil, Coaching | Oui | `Pole` |
| 3 | Intitulé de la séance ou de la mission | Texte | Oui | `Seance` |
| 4 | Date de la séance | Date | Oui | `DateSeance` |
| 5 | Nom du formateur ou du coach | Texte | Non | `Formateur` |
| 6 | Note globale | Évaluation, 5 étoiles | Oui | `NoteGlobale` |
| 7 | Qualité du contenu | Évaluation, 5 étoiles | Oui | `NoteContenu` |
| 8 | Qualité de l'animation ou de l'accompagnement | Évaluation, 5 étoiles | Oui | `NoteAnimation` |
| 9 | Organisation (lieu, horaires, supports) | Évaluation, 5 étoiles | Oui | `NoteOrganisation` |
| 10 | Quelle est la probabilité que vous recommandiez BBI à un collègue ou à un partenaire ? (0 = pas du tout, 10 = certainement) | Net Promoter Score, de 0 à 10 | Oui | `Recommandation` |
| 11 | Ce qui vous a le plus plu | Texte long | Non | `PointsForts` |
| 12 | Ce que nous pourrions améliorer | Texte long | Non | `Ameliorations` |
| 13 | Un commentaire libre | Texte long | Non | `Commentaire` |
| 14 | Acceptez-vous que nous citions votre avis, sans vous identifier si vous le souhaitez ? | Choix : Oui, Non | Oui | `AutoriseTemoignage` |

## 2. Créer le formulaire dans Microsoft Forms

Microsoft Forms ne se crée pas par script : c'est une étape manuelle, à faire une seule fois.

1. Ouvrez [forms.office.com](https://forms.office.com) avec un compte de l'organisation, puis **Nouveau formulaire**.
2. Titre : « Votre avis sur votre séance avec Business Builders International ». Ajoutez les 14 questions du tableau ci-dessus.
3. Dans **Paramètres du formulaire**, choisissez **Tout le monde peut répondre** : vos clients n'ont pas de compte chez vous. Si l'option est grisée, l'administrateur du tenant l'interdit : demandez-lui de l'autoriser pour Forms.
4. Décochez **Enregistrer le nom et l'adresse e-mail** si vous voulez des réponses anonymes. La question 1 permet quand même d'indiquer l'entreprise.
5. Message de remerciement : « Merci pour votre retour. Il nous aide à progresser. »
6. **Partager** : copiez l'adresse du formulaire, et téléchargez son **code QR** pour l'afficher en fin de séance.
7. Collez l'adresse dans `deploy/organisation.json`, champ `organisation.formulaireSatisfaction`, puis relancez `New-BbiOrganization.ps1`. Un lien « Formulaire de satisfaction » apparaît alors dans « Vos espaces » du portail.

## 3. Envoyer le formulaire après chaque séance

Message type, par e-mail ou par WhatsApp :

> Bonjour,
>
> Merci d'avoir participé à « [intitulé de la séance] ». Votre avis compte : il nous aide à améliorer nos accompagnements, et il prend moins de deux minutes.
>
> [adresse du formulaire]
>
> Bien cordialement,
> [Prénom Nom], Business Builders International

Pour ne rien oublier, la liste **Sessions** du portail porte deux colonnes :

- **Formulaire de satisfaction (URL)** : l'adresse du formulaire envoyé pour cette séance ;
- **Formulaire envoyé** : à cocher une fois le message parti.

Une vue filtrée sur « Formulaire envoyé = Non » donne au responsable la liste des séances sans retour demandé.

## 4. Brancher les réponses sur la liste « Avis clients »

Sans cette étape, les réponses restent dans Forms. Avec Power Automate, chaque réponse devient une ligne de la liste, visible dans le portail.

1. Dans [make.powerautomate.com](https://make.powerautomate.com), **Créer** puis **Flux cloud automatisé**.
2. Déclencheur : **Microsoft Forms, Lorsqu'une nouvelle réponse est envoyée**, en choisissant votre formulaire.
3. Action : **Microsoft Forms, Obtenir les détails de la réponse**.
4. Action : **SharePoint, Créer un élément**, site du siège, liste **Avis clients**.
5. Associez chaque champ de la liste à la question correspondante du tableau de la partie 1. Pour `Source`, saisissez « Microsoft Forms ». Pour `Title`, utilisez par exemple l'intitulé de la séance suivi de la date.
6. Pour `AutoriseTemoignage`, utilisez l'expression `equals(<réponse à la question 14>, 'Oui')`.
7. Enregistrez, puis envoyez une réponse d'essai et vérifiez qu'une ligne apparaît dans la liste.

## 5. Lire les résultats

- La liste **Avis clients** propose les vues **Tous les avis** (du plus récent au plus ancien) et **Par pôle**.
- **Note moyenne** : la moyenne de `NoteGlobale`, par pôle ou par formateur.
- **Recommandation (Net Promoter Score)** : la part des réponses à 9 ou 10 (promoteurs) moins la part des réponses de 0 à 6 (détracteurs). Un score positif est bon, au-dessus de 50 il est excellent.
- **Témoignages** : les lignes où `AutoriseTemoignage` vaut Oui peuvent être reprises dans les actualités, les références ou une proposition commerciale.

Le portail contient déjà cinq avis d'exemple (si les données de démonstration sont activées), pour montrer à quoi ressemble la liste remplie.

## Limites

- Le kit crée la liste, les colonnes, les vues et les liens. Il ne peut pas créer le formulaire Forms ni le flux Power Automate : ce sont les deux étapes manuelles des parties 2 et 4.
- Le portail n'affiche pas encore de tableau de bord des notes (moyenne, score de recommandation) : c'est une évolution possible de la page d'accueil.
