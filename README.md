# POC codes-barres OwlGame

Ce monorepo contient deux applications Expo distinctes pour lire le code-barres d’une boîte de jeu, puis chercher des informations sur ce code. La lecture par caméra fonctionne dans le POC ScanDex sur Android ; les deux applications utilisent `expo-camera` et le SDK 58.

| Application | Source consultée | Informations principales |
| --- | --- | --- |
| [POC ScanDex](poc-scandex/README.md) | Base spécialisée jeux vidéo, avec jeton | Titre et plateforme |
| [POC UPCitemdb](poc-upcitemdb/README.md) | Base de produits généraliste, sans jeton pour l’essai gratuit | Titre produit, marque, description et parfois image |

## Lancer les POC sur Android

Installer Expo Go compatible avec le SDK 58 et connecter le téléphone au même Wi-Fi que l’ordinateur. Depuis la racine du monorepo :

```sh
nvm use
npm install
```

Dans deux terminaux différents, si les deux POC doivent tourner en même temps :

```sh
npm run start:scandex
npm run start:upcitemdb
```

Chaque commande affiche son propre QR code pour Expo Go. ScanDex utilise le port 8081 et UPCitemdb le port 8082. Le premier demande un jeton ScanDex dans l’application ; le second n’en demande pas.

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

1. Chercher d’abord dans ScanDex pour obtenir un titre et une plateforme structurés.
2. Si le code y est absent, consulter UPCitemdb comme piste supplémentaire. Vérifier le titre, le support et l’édition avant de proposer une fiche à l’utilisateur.
3. Si les deux sources répondent, garder leurs informations séparées tant que leur cohérence n’a pas été vérifiée. Street Fighter II montre qu’un code trouvé dans UPCitemdb peut mener à une fiche trop générale.
4. Si aucune source ne trouve le code, permettre une recherche ou une saisie manuelle du jeu.

Ces sept boîtes forment un petit échantillon pratique, pas une mesure générale de couverture. Les contraintes de jeton, de quotas et de qualité des données sont détaillées dans les README de chaque POC.
