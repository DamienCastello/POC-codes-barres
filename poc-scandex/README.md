# POC OwlGame × ScanDex + IGDB

Ce POC cherche un titre dans ScanDex à partir d’un code-barres, puis complète le jeu avec IGDB. La configuration Twitch/IGDB et les commandes communes sont détaillées dans le [README du monorepo](../README.md).

## Lancer le POC

1. Obtenir un jeton sur [ScanDex](https://scandex.gamery.app/documentation/api/) et le renseigner dans `SCANDEX_TOKEN`, dans `server/.env`.
2. À la racine du monorepo, utiliser `nvm use` puis `npm install`.
3. Configurer `server/.env` avec les identifiants Twitch/IGDB, puis lancer `npm run start:igdb`.
4. Dans un autre terminal, lancer `npm run start:scandex` et ouvrir le QR code avec Expo Go SDK 58 sur Android.
5. Dans l’application, vérifier l’adresse avec **Configurer le serveur local**. Le serveur charge le jeton ScanDex depuis `server/.env` ; aucune saisie du jeton n’est nécessaire sur le téléphone.

## Parcours

1. Scanner une boîte ou utiliser un des sept codes proposés.
2. Vérifier le titre et consulter le JSON complet de ScanDex. La plateforme annoncée reste une indication à contrôler sur la boîte.
3. Corriger le titre si besoin, lancer la recherche IGDB et choisir la fiche correspondante.
4. Vérifier la jaquette et les données enrichies, choisir la plateforme possédée et compléter les champs si nécessaire. Confirmer puis partager le résultat pour garder une trace de l’essai.

Un code absent, connu sans jeu associé, ou une erreur fournisseur permettent de poursuivre en saisissant un titre. La saisie du code à la main permet aussi de vérifier la recherche sans utiliser la caméra.

## Données reçues

Le téléphone appelle le serveur local via `GET /barcodes/scandex?value=…`. Le serveur consulte ensuite ScanDex avec `GET /api/v2/lookup?value=…` et le jeton du fichier `.env` dans l’en-tête `Authorization`. Le jeton n’est jamais envoyé au téléphone. Le code reste du texte pour préserver les zéros initiaux. Le JSON complet est consultable à l’étape 2 ; l’affichage principal reprend le titre et la plateforme proposée.

La recherche IGDB se fait par titre, sans reprendre automatiquement l’identifiant ni la plateforme de ScanDex. Après choix de la fiche, le serveur demande les données de catalogue et la jaquette. La plateforme possédée reste vide jusqu’au choix de l’utilisateur. Les JSON ScanDex et IGDB sont séparés pour voir l’origine des informations.

## Résultats des scans du 27 octobre 2026

| Jeu | Code scanné | ScanDex |
| --- | --- | --- |
| Dragon Ball Z: Budokai 2 (PS2) | `3546430108154` | Reconnu |
| Final Fantasy X (PS2) | `711719468622` | Code absent |
| Legacy of Kain: Soul Reaver (PS1) | `5032921005685` | Reconnu |
| Diablo III (PC) | `5030917102608` | Code absent |
| Half-Life 2 (PC) | `3348542180352` | Code absent |
| Street Fighter II: Special Champion Collection (Mega Drive) | `4974365610906` | Reconnu |
| Shinobi III: Return of the Ninja Master (Mega Drive) | `4974365611361` | Reconnu |

ScanDex reconnaît le titre pour 4 des 7 codes testés. Un nouvel essai de Shinobi III a renvoyé Nintendo 3DS pour une boîte Mega Drive : ce résultat ne confirme donc pas la plateforme.

## Limites

Un titre trouvé ne garantit pas une correspondance correcte avec la boîte ou sa plateforme. Une jaquette IGDB peut être différente de l’édition physique. Les champs manquants restent vides et la description conserve la langue reçue.

Les [conditions ScanDex](https://scandex.gamery.app/terms/) encadrent l’usage des identifiants IGDB et l’enrichissement séparé. Le serveur utilise donc les accès Twitch/IGDB du projet. Le jeton ScanDex du fichier `server/.env` ne sert qu’à ScanDex. Il est relu à chaque recherche pour prendre en compte une modification sans redémarrage.

Le résultat reste en mémoire ; ce POC ne publie pas encore de jeu dans OwlGame. Pour la comparaison avec UPCitemdb, voir le README racine.
