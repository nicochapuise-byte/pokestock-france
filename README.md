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

## Administration et sécurité

Ne **jamais** enregistrer de mot de passe PostgreSQL, de secret S3 ou de clé API Neon dans le dépôt GitHub ou dans du JavaScript côté navigateur. Neon les fournit uniquement à la fonction serveur. L'administrateur devra ajouter une interface de modération, une politique d'abus et de confidentialité avant un lancement public à grande échelle.

Projet indépendant et non affilié à Nintendo, Game Freak ou The Pokémon Company.
