# Diagnostic BBI — workbench SPFx 1.22.2 / Docker

## Ce que signifie l’erreur

`Error: Script error for "https://localhost:4321/temp/build/manifests.js"` est le message générique de RequireJS : le navigateur n’a pas réussi à charger/exécuter le script. Il ne permet pas, à lui seul, de choisir entre panne réseau, certificat, blocage navigateur, compilation ou mauvais chemin.

Dans la configuration initiale du dépôt, le hostname non renseigné conduisait SPFx à écouter sur **localhost à l’intérieur de Docker**. Le mapping de port de Docker ne rend pas ce loopback interne accessible depuis l’hôte. La correction est dans `config/spfx-customize-webpack.js` :

```js
if (config.devServer) {
  config.devServer.host = '0.0.0.0';
  config.devServer.open = false;
}
```

`config/serve.json` conserve `hostname: "localhost"` : les URLs des bundles et du WebSocket doivent viser **le navigateur**, et non `0.0.0.0`. Changer uniquement le hostname en `0.0.0.0` peut produire des URL de debug incorrectes. Le serveur est publié **sur le loopback de l’hôte uniquement** : `127.0.0.1:4321:4321`. Il n’est pas destiné à une exposition publique.

## 1. Vérifier que le serveur tourne et compile

Depuis `bbi-intranet` :

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=150 spfx
```

Attendu : `Started Webpack Dev Server at https://0.0.0.0:4321/`, puis `compiled successfully` / `build finished`. Le démarrage exécute `npm ci` pour éviter les dépendances périmées du volume `node_modules` après une mise à jour du lockfile. Attendre cette installation puis la compilation ; un simple conteneur « running » n’est pas une preuve que le manifeste est prêt.

Test **dans le conteneur**, sans valider TLS :

```bash
docker compose exec spfx node scripts/doctor.cjs --container --allow-untrusted
```

Attendu : HTTP 200, type JavaScript, CORS `*`. Le contrôle santé Docker utilise ce test. Il vérifie le serveur interne, **pas** la connexion depuis le navigateur.

Test **sur l’ordinateur du navigateur** (si Node est installé) :

```bash
npm run doctor -- --allow-untrusted
```

Ce contournement TLS n’est autorisé que pour ce diagnostic ponctuel. Il ne corrige pas le certificat du navigateur. Ne pas définir globalement `NODE_TLS_REJECT_UNAUTHORIZED=0`, ne pas désactiver la sécurité du navigateur.

## 2. Installer le certificat public de développement sur l’hôte

Le conteneur fonctionne en root ; ses certificats se trouvent dans **`/root/.rushstack`**, pas `/home/user/.rushstack`. Un volume nommé les conserve entre les redémarrages. Ils sont différents des certificats éventuellement créés par `heft trust-dev-cert` sur l’hôte.

Depuis le dossier projet, après le premier démarrage :

```bash
mkdir -p certs
docker compose cp spfx:/root/.rushstack/rushstack-ca.pem ./certs/rushstack-ca.pem
```

PowerShell Windows : remplacer au besoin `mkdir -p certs` par `New-Item -ItemType Directory -Force certs`. Importer **uniquement ce CA de développement public**, dont vous maîtrisez l’origine :

- **Windows (utilisateur courant)** :
  ```powershell
  certutil -user -addstore Root .\certs\rushstack-ca.pem
  ```
- **macOS** : importer le fichier dans Trousseaux d’accès → session ; définir « Toujours approuver » pour SSL, puis redémarrer le navigateur.
- **Linux** : importer le CA dans le magasin d’autorités de votre navigateur. Si la politique du navigateur utilise le magasin système, installer le CA local selon les règles de votre distribution (par exemple fichier `.crt` sous `/usr/local/share/ca-certificates`, puis `update-ca-certificates`). Firefox peut utiliser son propre magasin : importer dans Paramètres → Certificats → Autorités.

Ne jamais exporter/publier `rushstack-serve.key`. Le dossier `certs/` est ignoré par Git. Retirer le CA de développement du magasin de confiance lorsqu’il n’est plus nécessaire.

Vérification Node **avec** validation TLS :

```bash
npm run doctor -- --ca ./certs/rushstack-ca.pem
```

Puis dans **le même navigateur que SharePoint**, ouvrir :

```text
https://localhost:4321/temp/build/manifests.js
```

Attendu : le JavaScript est affiché, sans erreur de certificat. Une simple visite à `/` peut renvoyer 404 (il n’y a pas de page d’accueil à cette URL) ; c’est pourquoi il faut tester le chemin du manifeste lui-même.

## 3. Autoriser la requête depuis SharePoint

Ouvrir le workbench **sur le site contenant les listes**, pas forcément à la racine du tenant :

```text
https://TENANT.sharepoint.com/sites/bbi/_layouts/15/workbench.aspx?debug=true&noredir=true&loadSPFX=true&debugManifestsFile=https://localhost:4321/temp/build/manifests.js
```

1. Accepter **Load debug scripts / Charger les scripts de débogage**, si demandé.
2. Si Edge/Chrome demande l’accès au **réseau local**, l’autoriser pour votre domaine SharePoint. Le serveur fournit aussi les en-têtes CORS/Private Network Access, mais ils ne remplacent pas l’autorisation utilisateur ou une politique d’entreprise.
3. F12 → Réseau → désactiver le cache pendant le diagnostic → recharger.
4. Filtrer sur `manifests.js`, puis sur le bundle `home-web-part`. Les deux doivent répondre en 200 avec du JavaScript, pas du HTML.
5. Dans la boîte à outils, rechercher **BBI Accueil**. Pour visualiser le design sans listes, activer le mode démonstration dans les propriétés.

Si votre tenant n’autorise pas le workbench, utiliser une page moderne dédiée de développement avec la même query string. Garder les pages de production sans paramètres de debug.

## Lecture rapide de l’onglet Réseau

| Symptôme | Vérification / remède |
|---|---|
| `ERR_CONNECTION_REFUSED` | Conteneur arrêté, compilation avortée, port 4321 occupé, écoute sur localhost interne. Vérifier logs, ports et le fichier de personnalisation Webpack. |
| `ERR_CERT_AUTHORITY_INVALID`, certificat expiré | Importer le CA réellement utilisé par le conteneur ; redémarrer le navigateur. Un certificat approuvé uniquement dans Docker n’est pas approuvé sur l’hôte. |
| `ERR_CERT_COMMON_NAME_INVALID` | Accéder via `localhost`, pas l’IP Docker ou une URL publique non couverte par le certificat. |
| HTTP 404 sur le manifeste | Attendre la compilation, vérifier `/temp/build/manifests.js`. Ne pas substituer l’ancien chemin `/temp/manifests.js`. |
| HTTP 200 mais `text/html` | Mauvaise URL ou proxy qui renvoie une page HTML. Vérifier la réponse réelle, pas seulement le statut. |
| Blocage « local network », CORS/PNA | Autorisation réseau local du navigateur, politiques d’entreprise, extensions de sécurité ; vérifier les en-têtes de la réponse. Ne pas désactiver globalement la sécurité. |
| Manifeste OK mais bundle KO | Lire l’URL du bundle dans Réseau : elle doit viser `https://localhost:4321/dist/...`. Vérifier compilation, nom du serveur, cache et antivirus/proxy. |
| Erreur de syntaxe après un 200 | Inspecter la console et la première erreur, puis les logs de compilation ; ne pas traiter cela comme un problème de certificat. |
| `HTTP 403` dans un module BBI | Le manifeste fonctionne : c’est un problème d’autorisation sur la liste/site, afficher l’ID de requête au support. |
| `HTTP 400` dans un module BBI | Contrat de colonnes incompatible : comparer les noms internes avec `scripts/lists.schema.json`. |
| `HTTP 404` dans un module BBI | Nom de liste/site incorrect, objet absent ou non visible au compte. Vérifier le provisioning et les droits. |

## Nettoyage sans perte de certificat

```bash
docker compose down
docker compose up --build -d
```

**Éviter `docker compose down -v`** : supprime aussi le volume de certificats ; un nouveau CA sera généré et devra être approuvé à nouveau. Ne pas supprimer de volumes ni de données de site pour corriger une erreur RequireJS.

## Si le navigateur est sur une autre machine

`localhost` désigne toujours **la machine du navigateur**, pas Docker distant, ni Arena. Cette configuration est destinée à Docker et au navigateur sur le même ordinateur. Ne pas remplacer au hasard les URL par une IP : il faut alors un endpoint HTTPS réellement joignable, un certificat approprié et des URL de bundles cohérentes. L’aperçu interactif Arena sur le port 3000 est un aperçu React autonome ; **ce n’est pas un serveur de manifestes pour votre tenant**.
