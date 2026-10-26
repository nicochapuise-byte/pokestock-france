# PokéStock France — carte communautaire Pokémon

**Site public :** https://nicochapuise-byte.github.io/pokestock-france/

## Architecture

- `index.html`, `styles.css`, `script.js` : interface statique compatible iPhone / Safari.
- `auth-ui.js` : comptes e-mail via Neon Auth, chargé comme module navigateur.
- `backend/index.mjs` : API Node.js 24 déployée sur Neon Functions.
- Neon PostgreSQL : table `public.stock_reports`.
- Neon Object Storage : bucket privé `proofs` pour les photographies.

Il n'y a pas de Next.js, npm, React ou Tailwind à installer pour afficher le site.
Une connexion Internet est nécessaire (fonds OpenStreetMap, adresses IGN, authentification et stocks communautaires).

## Signalement d'un stock

1. Ouvrir `+ Signaler`, puis renseigner le magasin, la ville, la série, le produit et la quantité.
2. Indiquer l'adresse complète, cliquer `Rechercher l'adresse`, puis **sélectionner une adresse proposée par l'IGN**.
3. Ajouter une photo obligatoire, de 10 Mo maximum avant compression automatique.
4. Confirmer disposer de l'autorisation de partager cette photo (ne pas inclure de personnes).
5. Se connecter ou créer un compte et publier.

L'API revalide les données et les coordonnées, exige un JWT et plafonne le nombre d'envois par compte. Les photos sont conservées dans un bucket privé et sont consultables depuis des liens temporaires. Les signalements nouveaux sont marqués **Non vérifié**, ne garantissent pas le stock, et expirent après 72 heures.

## Démonstration

Les six points préchargés sont fictifs et clairement signalés. Les signalements éventuellement sauvegardés dans les anciennes versions demeurent sur leur navigateur d'origine. La version communautaire utilise une base de données partagée.

## Confirmations de stock et réputation (version communautaire)

- Chaque compte connecté peut voter **une fois par signalement** : `✅ Disponible` ou `❌ Rupture de stock`. Le choix peut ensuite être modifié et remplace le précédent, sans ajouter de second vote.
- Le créateur ne peut pas voter sur son propre signalement. Une limite de 30 nouveaux votes par jour est appliquée par compte.
- Un signalement reste **non vérifié** tant qu'il n'y a pas de majorité et **au moins deux voix indépendantes** du même côté. Les états sont dérivés des votes, non d'une garantie réelle d'inventaire.
- Le statut « rupture signalée » n'efface pas la fiche : il rend l'information visible aux visiteurs pendant la validité du signalement (72 heures).
- L'espace « Mon compte » affiche une réputation indicative calculée sur 90 jours : **10 points par signalement soutenu par au moins 2 confirmations majoritaires** et **1 point par avis concordant avec au moins deux autres membres**. Les scores ne prouvent pas la fiabilité.
- Les votes de test sont à réaliser depuis un **autre compte légitime**, car un auteur ne peut pas confirmer sa propre publication.
- Les données sont stockées dans `public.stock_votes`, avec une contrainte `PRIMARY KEY(report_id,voter_user_id)`. Le script de structure est dans `backend/schema.sql`.

## État des tests

La migration SQL, la syntaxe du JavaScript et le déploiement Neon Function ont été vérifiés. Les appels HTTP authentifiés de vote et l'ergonomie Safari nécessitent encore une validation réelle avec des comptes distincts. Les deux signalements de test préexistants ont été conservés sans suppression.

## Suppression par l'auteur et modération administrateur (octobre 2026)

- `moderation.js` ajoute **Supprimer mon signalement** sous les référencements de l'utilisateur connecté. Après confirmation, le serveur vérifie que le JWT appartient réellement à l'auteur ; une personne ne peut pas supprimer les fiches d'un autre utilisateur.
- Un administrateur, nommé via la table privée `public.stock_admins`, dispose d'un bouton **🛡️ Admin** en haut du site. Le rôle n'est jamais attribuable depuis le navigateur.
- L'administrateur peut voir les 150 derniers référencements, rechercher par magasin/produit/ville, **modifier** magasin, produit, série, prix, quantité, adresse vérifiée, statut (non vérifié, approuvé, refusé), et **retirer** n'importe quelle annonce.
- Des vérifications d'autorisation côté serveur sont effectuées pour `GET /me/role`, `GET /me/reports`, `GET /admin/reports`, `PATCH /admin/reports/:id` et `DELETE /reports/:id`.
- Les suppressions sont **logiques** : elles font disparaître immédiatement une fiche de la carte et de la recherche, mais gardent son enregistrement et sa photo dans le stockage privé pour permettre un contrôle de modération. Il reste à ajouter une politique de conservation et une purge de données/photos pour les demandes d'effacement définitif.
- Les corrections d'administrateur disposent d'un historique `public.stock_report_edits`.
- Les signalements existants n'ont pas été supprimés lors de la mise en place.
- Contrôles effectués : migration SQL, attribution du rôle au compte déjà utilisé pour le test, validation statique des scripts et déploiement Neon. Il reste à tester l'expérience de suppression et de modification de bout en bout sur iPhone.

## Administration et sécurité

Ne **jamais** enregistrer de mot de passe PostgreSQL, de secret S3 ou de clé API Neon dans le dépôt GitHub ou dans du JavaScript côté navigateur. Neon les fournit uniquement à la fonction serveur. L'administrateur devra ajouter une interface de modération, une politique d'abus et de confidentialité avant un lancement public à grande échelle.

Projet indépendant et non affilié à Nintendo, Game Freak ou The Pokémon Company.
