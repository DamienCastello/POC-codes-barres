# POC codes-barres OwlGame

Ce monorepo contient trois applications Expo pour lire le code-barres d’une boîte, retrouver un titre et compléter sa fiche avec IGDB. Elles utilisent `expo-camera` et le SDK 58.

| Application | Recherche par code-barres | Enrichissement |
| --- | --- | --- |
| [POC ScanDex](poc-scandex/README.md) | ScanDex, avec le jeton configuré sur le serveur | IGDB |
| [POC UPCitemdb](poc-upcitemdb/README.md) | UPCitemdb, sans jeton pour l’essai gratuit | IGDB |
| [POC final](poc-final/README.md) | ScanDex en priorité, puis UPCitemdb | IGDB |

Les deux premiers POC permettent de tester les fournisseurs séparément. Le POC final les combine : un titre trouvé dans ScanDex est retenu sans appel UPCitemdb. Si ScanDex ne trouve pas de jeu ou est indisponible, UPCitemdb est consulté. Si aucun titre n’est obtenu, la recherche IGDB se poursuit par saisie manuelle. Le parcours et le serveur IGDB sont communs aux trois applications.

Le POC final affiche la source retenue et le détail des tentatives. Un service indisponible est distingué d’un code inconnu. Le jeton ScanDex est lu dans `SCANDEX_TOKEN`, dans `server/.env`. S’il manque, cette étape est indiquée comme non configurée et le POC final poursuit avec UPCitemdb.

## Parcours en quatre étapes

1. **Code-barres** : scanner une boîte ou saisir son numéro. Les sept codes de nos essais sont proposés comme raccourcis.
2. **Résultat source** : lire les données ScanDex ou UPCitemdb, consulter le JSON complet et corriger le titre à rechercher. Si le code est absent ou le fournisseur indisponible, saisir le titre manuellement.
3. **Choix du jeu** : rechercher dans IGDB puis choisir une fiche en comparant le nom, les plateformes, la première sortie et la jaquette. Aucun résultat IGDB n’est choisi automatiquement.
4. **Fiche enrichie** : vérifier les données, choisir explicitement la plateforme de la boîte, compléter les champs manquants et confirmer l’essai. Le résultat peut être partagé en JSON depuis le téléphone.

L’enrichissement demande le nom, la description, la jaquette, les genres, les éditeurs, la première sortie, les plateformes et le PEGI. Chaque fiche peut rester incomplète. Le compteur distingue les champs reçus d’IGDB des champs renseignés après correction. Les réponses JSON source et IGDB restent consultables séparément.

La plateforme annoncée par ScanDex n’est pas retenue automatiquement : un essai de Shinobi III a donné le bon titre mais Nintendo 3DS pour une boîte Mega Drive. Toutes les images reçues d’UPCitemdb sont présentées avec leur URL d’origine, y compris les liens HTTP. Le POC tente de les charger et affiche l’erreur reçue si une image est inaccessible. La fiche enrichie utilise la jaquette HTTPS d’IGDB.

## Préparer les essais sur Android

Installer Expo Go compatible avec le SDK 58. Le téléphone et l’ordinateur doivent être sur le même Wi-Fi. Depuis la racine du monorepo :

```sh
nvm use
npm install
```

### Configurer les accès sur le serveur

1. Suivre la [création d’accès IGDB](https://api-docs.igdb.com/#account-creation) : compte Twitch avec double authentification et application dans la [console Twitch](https://dev.twitch.tv/console/apps). Choisir le type **Confidential**, indiquer `http://localhost` comme URL de redirection, puis générer un Client Secret.
2. Copier le fichier d’exemple :

```sh
cp server/.env.example server/.env
```

3. Renseigner `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` et `SCANDEX_TOKEN` dans `server/.env`. Ce fichier est ignoré par Git. Ces valeurs restent sur l’ordinateur ; elles ne doivent pas être placées dans le code mobile ni dans une variable `EXPO_PUBLIC_…`.
4. Lancer le serveur depuis la racine et garder ce terminal ouvert :

```sh
npm run start:igdb
```

Le serveur affiche l’adresse à utiliser sur le téléphone, par exemple `http://192.168.1.20:3001`. Il peut démarrer sans identifiants pour vérifier la connexion ; les recherches demanderont ensuite de les renseigner. Les accès modifiés dans `server/.env`, y compris le jeton ScanDex, sont pris en compte à la prochaine requête, sans redémarrage. La recherche ScanDex passe par ce serveur local ; le téléphone ne reçoit pas le jeton.

### Lancer une application

Dans un autre terminal, lancer l’un des POC :

```sh
npm run start:scandex
```

ou :

```sh
npm run start:upcitemdb
```

ou le parcours combiné :

```sh
npm run start:final
```

Les trois peuvent tourner en même temps dans des terminaux distincts. ScanDex utilise le port Expo 8081, UPCitemdb le port 8082 et le POC final le port 8083. Scanner le QR code correspondant avec Expo Go. Le serveur local doit rester ouvert pour ScanDex et pour IGDB. Le jeton ScanDex n’a plus à être saisi dans les applications ; UPCitemdb ne demande pas de jeton.

Dans chaque application, la section **Configurer le serveur local** est visible au démarrage. Vérifier l’adresse et utiliser **Vérifier la connexion**. L’adresse de l’ordinateur est proposée à partir du serveur Expo lorsqu’elle est disponible. Sur le téléphone, `localhost` désignerait le téléphone lui-même : utiliser l’adresse réseau affichée par le serveur.

Avant une recherche, le POC contrôle le serveur local : un serveur absent, une mauvaise adresse et des identifiants manquants ont des messages distincts. Si la connexion échoue, vérifier que le serveur est lancé, puis l’adresse, le réseau Wi-Fi et l’accès au port 3001 dans le pare-feu local. Ce serveur est prévu pour des essais sur un réseau de confiance. Il conserve les accès Twitch et ScanDex sur l’ordinateur et espace les requêtes IGDB des trois POC.

## Portée de l’essai

Le résultat reste en mémoire ; ce POC n’est pas encore connecté à une base OwlGame. Le partage permet de garder le code, la source, la fiche IGDB choisie et les corrections. Les secrets ne sont pas inclus dans l’export.

L’accès gratuit à IGDB et les conditions d’une intégration commerciale sont décrits dans leur [FAQ](https://api-docs.igdb.com/#business-related-faq). Des accès Twitch/IGDB propres au projet sont nécessaires : le jeton ScanDex n’accorde pas d’accès à IGDB. Les quotas des fournisseurs de codes-barres continuent de s’appliquer.

## Vérifier le code

```sh
npm run typecheck
npm run lint
npm test
```

Les tests utilisent des réponses simulées. Ils vérifient les recherches et détails, les jetons, les quotas, les champs manquants, le JSON source, le choix obligatoire de la plateforme et le passage de ScanDex à UPCitemdb. Ils vérifient aussi qu’UPCitemdb n’est pas appelé lorsqu’un titre est trouvé dans ScanDex. Ils ne lisent pas les accès du fichier `.env` du projet et ne consomment pas les quotas externes.

Les résultats historiques ci-dessous concernent l’identification par code-barres. Ils ne mesurent pas encore le remplissage par IGDB : les sept jeux devront être repris avec les nouveaux écrans pour compléter ce bilan.

## Résultats croisés du 27 octobre 2026

Les statuts ScanDex viennent des scans des boîtes sur Android. UPCitemdb a été interrogé avec **les mêmes numéros**. « Fiche » signifie qu’un produit a été renvoyé ; la justesse de l’édition doit encore être vérifiée sur la boîte.

| Jeu et support | Code scanné | ScanDex | UPCitemdb |
| --- | --- | --- | --- |
| Dragon Ball Z: Budokai 2 — PS2 | `3546430108154` | Reconnu | Aucune fiche |
| Final Fantasy X — PS2 | `711719468622` | Absent | Fiche « Final Fantasy X 10 PS2… Complete VF » |
| Legacy of Kain: Soul Reaver — PS1 | `5032921005685` | Reconnu | Aucune fiche |
| Diablo III — PC | `5030917102608` | Absent | Fiche « Diablo III pour PC (français) » |
| Half-Life 2 — PC | `3348542180352` | Absent | Aucune fiche |
| Street Fighter II: Special Champion Collection — Mega Drive | `4974365610906` | Reconnu | Fiche « Street Fighter 2 - SEGA Mega Drive / MD Game - TOP » ; édition non précisée |
| Shinobi III: Return of the Ninja Master — Mega Drive | `4974365611361` | Reconnu | Aucune fiche |

ScanDex reconnaît **4 codes sur 7**. UPCitemdb renvoie **3 fiches sur 7**, dont celle de Street Fighter II qui reste trop vague pour confirmer l’édition. Les deux sources réunies apportent une correspondance possible pour **6 boîtes sur 7** ; Half-Life 2 reste absent des deux. UPCitemdb apporte les deux résultats de Final Fantasy X et Diablo III que ScanDex ne possède pas dans cet essai.

Pour Final Fantasy X, le code scanné à 12 chiffres (`711719468622`) apparaît dans UPCitemdb comme EAN-13 (`0711719468622`) : le zéro initial est la représentation EAN du même UPC. [UPCitemdb documente ce cas](https://www.upcitemdb.com/wp/docs/main/development/responses/).

## Ce que suggère le croisement

1. Chercher d’abord dans ScanDex pour obtenir un titre et une indication de plateforme à confirmer.
2. Si le code y est absent, consulter UPCitemdb comme piste supplémentaire. Vérifier le titre, le support et l’édition avant de proposer une fiche à l’utilisateur.
3. Si les deux sources répondent, garder leurs informations séparées tant que leur cohérence n’a pas été vérifiée. Street Fighter II montre qu’un code trouvé dans UPCitemdb peut mener à une fiche trop générale.
4. Si aucune source ne trouve le code, permettre une recherche ou une saisie manuelle du jeu.

Ces sept boîtes forment un petit échantillon pratique, pas une mesure générale de couverture. Les contraintes de jeton, de quotas et de qualité des données sont détaillées dans les README de chaque POC.
