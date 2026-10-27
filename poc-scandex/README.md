# POC OwlGame × ScanDex

Application React Native/Expo pour lire un code-barres EAN/UPC avec la caméra, puis retrouver le jeu correspondant dans ScanDex. Le [README du monorepo](../README.md) contient la comparaison avec UPCitemdb.

## Essai sur téléphone

1. Créer un compte et obtenir un jeton sur [ScanDex](https://scandex.gamery.app/documentation/api/).
2. Sur Android, utiliser Expo Go compatible avec le **SDK 58** (la version installée peut être vérifiée ou téléchargée sur [expo.dev/go](https://expo.dev/go)). Connecter le téléphone et l’ordinateur au même réseau Wi-Fi.
3. À la racine du monorepo, lancer `nvm use`, `npm install`, puis `npm run start:scandex`. Scanner le QR code affiché avec Expo Go.
4. Saisir le jeton dans le champ prévu. Il reste en mémoire uniquement pendant cette session et n’est pas écrit dans les fichiers du projet.
5. Appuyer sur **Ouvrir la caméra**, autoriser son accès, puis viser le code-barres d’une boîte de jeu.
6. Noter le numéro affiché et vérifier le titre et la plateforme renvoyés. Faire un second essai en saisissant le même numéro manuellement pour isoler un éventuel problème de caméra.

Le bouton **Utiliser le code d’exemple de ScanDex** renseigne `0711719577966`, publié dans la [documentation de l’API](https://scandex.gamery.app/documentation/api/). Il permet de tester la recherche sans boîte physique.

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

ScanDex reconnaît 4 des 7 codes testés sur ces boîtes.

## Interprétation du résultat

| Affichage | Ce que cela vérifie |
| --- | --- |
| Jeu reconnu | Le code a été lu et ScanDex a trouvé un titre et une plateforme. |
| Code connu, jeu non identifié | ScanDex connaît le code, mais n’a pas de correspondance de jeu. |
| Code inconnu | L’API a renvoyé 404 pour ce code. |
| Accès refusé | Le jeton est absent, invalide ou ne donne pas accès à l’API. |

La caméra utilise `expo-camera` pour les formats EAN-13, EAN-8, UPC-A, UPC-E et ITF-14. ScanDex est consulté via `GET /api/v2/lookup?value=…` avec le jeton dans l’en-tête `Authorization`. Le code reste une chaîne de caractères pour préserver les zéros initiaux.

## Limites de cet essai

Le résultat de ScanDex renseigne principalement le titre et la plateforme. Une jaquette, une description ou d’autres données demanderaient une autre source et les droits correspondants. Les [conditions de ScanDex](https://scandex.gamery.app/terms/) autorisent l’affichage du titre et de la plateforme, mais encadrent l’usage des identifiants IGDB pour un enrichissement séparé.

Pour une intégration de production, faire passer la requête par le serveur OwlGame afin que le jeton ScanDex ne soit pas exposé dans l’application mobile. Ce POC le demande à l’utilisateur uniquement pour un essai local.
