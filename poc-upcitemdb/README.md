# POC OwlGame × UPCitemdb + IGDB

Ce POC cherche un produit dans UPCitemdb à partir d’un code-barres, puis complète le jeu avec IGDB. La configuration Twitch/IGDB et les commandes communes sont détaillées dans le [README du monorepo](../README.md).

## Lancer le POC

1. À la racine du monorepo, utiliser `nvm use` puis `npm install`.
2. Configurer `server/.env` avec les identifiants Twitch/IGDB et lancer `npm run start:igdb`.
3. Dans un autre terminal, lancer `npm run start:upcitemdb` et ouvrir le QR code avec Expo Go SDK 58 sur Android.
4. Dans l’application, vérifier l’adresse avec **Configurer le serveur local**. La recherche UPCitemdb ne demande pas de jeton ; le serveur utilise les accès du projet pour IGDB.

## Parcours

1. Scanner une boîte ou utiliser un des sept codes proposés.
2. Vérifier le produit UPCitemdb et consulter son JSON complet. S’il y a plusieurs résultats, retenir celui qui correspond à la boîte. La marque n’est pas interprétée automatiquement comme un éditeur.
3. Corriger le titre pour enlever les mentions commerciales si besoin, rechercher dans IGDB et choisir la fiche correspondante.
4. Vérifier la jaquette et les champs enrichis, choisir la plateforme possédée puis confirmer. Le résultat peut être partagé en JSON pour garder une trace de l’essai.

Si le code est absent ou si le fournisseur refuse la requête, saisir un titre pour poursuivre la recherche IGDB.

## Données reçues

Le POC consulte `GET https://api.upcitemdb.com/prod/trial/lookup?upc=…`. Le titre, la marque, la description et les images sont des informations produit, pas nécessairement une fiche de jeu complète. La plateforme peut être dans le titre, sans champ dédié.

Le panneau JSON montre aussi les données non reprises dans la carte : offres, prix, poids, références, etc. Toutes les URL d’images sont affichées avec une tentative de chargement dans le POC, y compris celles en HTTP. Si une image ne se charge pas, son erreur et son lien d’origine restent accessibles. Une URL peut être périmée ou ne pas correspondre à la jaquette de la boîte.

La fiche finale utilise les données et la jaquette d’IGDB, avec ses éditeurs et ses plateformes, puis les corrections de l’utilisateur. Les JSON des deux services sont consultables séparément.

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

La [formule gratuite UPCitemdb](https://www.upcitemdb.com/wp/docs/main/development/plan/) autorise 100 requêtes combinées par jour et jusqu’à 6 recherches par minute. Espacer les essais d’environ 10 secondes évite la limite de rythme soutenu. L’application distingue un code absent d’une limite de rythme ou de quota.

IGDB a ses propres accès et limites, présentés dans le README racine. Sa fiche peut rester incomplète ; la description conserve la langue reçue et la jaquette peut différer de l’édition physique.

Le résultat du POC reste en mémoire. Les résultats historiques ci-dessus concernent UPCitemdb, pas la qualité de l’enrichissement IGDB.
