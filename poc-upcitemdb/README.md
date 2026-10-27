# POC OwlGame × UPCitemdb

Application Expo qui lit un code-barres avec `expo-camera`, puis cherche ce numéro dans l’API généraliste [UPCitemdb](https://www.upcitemdb.com/api/). Aucun compte ni jeton n’est nécessaire pour la formule gratuite. Le [README du monorepo](../README.md) contient la comparaison avec ScanDex.

## Essai sur Android

1. Utiliser Expo Go compatible avec le **SDK 58**. Le téléphone et l’ordinateur doivent être sur le même réseau Wi-Fi.
2. À la racine du monorepo, lancer `nvm use`, `npm install`, puis `npm run start:upcitemdb`.
3. Ouvrir le QR code avec Expo Go, puis scanner une boîte de jeu. Vérifier le code affiché, le titre retourné et la présence éventuelle d’une plateforme dans le texte.
4. Si la caméra ne lit pas le code, saisir manuellement les chiffres imprimés sous les barres.

Le bouton de code d’exemple utilise `0711719546658` (God of War Ragnarök, PS5), vérifié dans UPCitemdb. Il sert uniquement à contrôler que l’API répond.

## Résultats du 27 octobre 2026

Recherches faites avec les codes exacts des sept boîtes testées. La réponse d’UPCitemdb était HTTP 200 pour chaque code ; `total: 0` signifie qu’aucune fiche n’a été trouvée.

| Jeu | Code scanné | Résultat UPCitemdb |
| --- | --- | --- |
| Dragon Ball Z: Budokai 2 (PS2) | `3546430108154` | Aucune fiche |
| Final Fantasy X (PS2) | `711719468622` | « Ff Final Fantasy X 10 PS2 sony PLAYSTATION 2 Complete VF » |
| Legacy of Kain: Soul Reaver (PS1) | `5032921005685` | Aucune fiche |
| Diablo III (PC) | `5030917102608` | « Diablo III pour PC (français) » |
| Half-Life 2 (PC) | `3348542180352` | Aucune fiche |
| Street Fighter II: Special Champion Collection (Mega Drive) | `4974365610906` | « Street Fighter 2 - SEGA Mega Drive / MD Game - TOP » ; édition non précisée |
| Shinobi III: Return of the Ninja Master (Mega Drive) | `4974365611361` | Aucune fiche |

UPCitemdb renvoie trois fiches pour les sept codes. Les titres de Final Fantasy X et Diablo III indiquent le bon jeu et le bon support, sous réserve d’une vérification visuelle sur les boîtes.

La fiche UPCitemdb de Street Fighter II correspond au jeu et au support, mais ne précise pas « Special Champion Collection » et classe le produit dans « Video Game Consoles ». Elle ne suffit donc pas à confirmer l’édition. Les autres fiches doivent également être vérifiées visuellement sur les boîtes avant d’être utilisées comme données produit.

UPCitemdb peut renvoyer un produit sans fournir de plateforme dans un champ distinct. Vérifier que la fiche correspond **à la bonne édition et au bon support** avant de compter un résultat comme utile.

## Limites

La [formule gratuite](https://www.upcitemdb.com/wp/docs/main/development/plan/) autorise 100 requêtes combinées par jour et jusqu’à 6 recherches par minute. Espacer les essais d’environ 10 secondes évite la limite de rythme soutenu. Un code absent peut renvoyer `200` avec `total: 0` (comme dans cet essai) ou `404` ; une limite atteinte renvoie `429`. L’application distingue ces situations.

Ce POC vérifie la couverture et la qualité des fiches. UPCitemdb est une **API de produits**, et non une bibliothèque spécialisée dans les jeux vidéo. Les fiches peuvent être incomplètes ou ambiguës.
