# POC final OwlGame

Ce troisième POC combine les deux recherches par code-barres avant de compléter la fiche avec IGDB. Il reprend les quatre étapes des POC séparés.

## Lancer sur Android

Depuis la racine du monorepo :

```sh
nvm use
npm install
```

Garder le serveur IGDB ouvert dans un terminal :

```sh
npm run start:igdb
```

Dans un autre terminal :

```sh
npm run start:final
```

Ouvrir le QR code avec Expo Go SDK 58. Ce POC utilise le port Expo **8083** et le même serveur IGDB que les deux autres applications. La configuration Twitch/IGDB et l’adresse à utiliser sur le téléphone sont expliquées dans le [README racine](../README.md).

## Parcours

1. **Code-barres** : scanner la boîte ou saisir son numéro. Configurer `SCANDEX_TOKEN` dans `server/.env` pour utiliser ScanDex en priorité ; le jeton n’est plus saisi dans l’application.
2. **Résultat source** : ScanDex est consulté en premier. S’il fournit un titre, il est retenu et UPCitemdb n’est pas appelé. Si le code est absent, connu sans jeu identifié ou si ScanDex est indisponible, le même numéro est recherché dans UPCitemdb. Si `SCANDEX_TOKEN` manque sur le serveur, le POC indique que ScanDex n’est pas configuré et passe à UPCitemdb.
3. **Choix du jeu** : vérifier ou corriger le titre obtenu, rechercher dans IGDB et sélectionner la fiche correspondante. Si aucun des deux fournisseurs n’a fourni de titre, saisir un terme de recherche pour continuer dans IGDB.
4. **Fiche enrichie** : vérifier la jaquette et les champs du catalogue, choisir explicitement la plateforme de la boîte, corriger les données si nécessaire, puis confirmer l’essai.

Les étapes restent consultables séparément : le résultat affiche la source retenue, l’ordre des tentatives et le JSON de chaque fournisseur ayant répondu. Une panne ou une limite de quota est distinguée d’un code inconnu. Les images UPCitemdb restent visibles lorsque ce fournisseur est retenu.

La plateforme proposée par ScanDex n’est jamais choisie automatiquement comme plateforme possédée. Le résultat IGDB reste à sélectionner et à vérifier, comme dans les deux autres POC.

## Résultat et limites

Le résultat peut être partagé en JSON avec la source retenue, les tentatives, la fiche IGDB choisie et les corrections. Le jeton ScanDex n’est pas inclus dans cet export. Les accès Twitch/IGDB et le jeton ScanDex restent sur le serveur local. Les changements dans `server/.env` sont pris en compte dès la recherche suivante.

Le résultat reste en mémoire pour cet essai ; ce POC n’est pas connecté à une base OwlGame. Les quotas des fournisseurs restent applicables. Un titre trouvé ne garantit pas que toutes les données ou la bonne jaquette seront disponibles.

Les sept codes des essais précédents sont disponibles dans l’application. Le tableau historique du README racine porte sur les deux fournisseurs séparés ; les résultats du parcours combiné doivent être relevés sur les boîtes physiques.
