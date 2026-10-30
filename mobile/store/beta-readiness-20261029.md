# Préparation bêta — 29 octobre 2026

État : préparation, aucune soumission aux stores. Les pages ajoutées sont des brouillons signalés comme tels. Les informations de conservation manquantes empêchent de présenter la confidentialité comme finalisée.

## Livré dans cette modification

- Pages statiques `confidentialite.html` et `assistance.html`, accessibles sans compte, reliées depuis l’accueil et intégrées au bundle mobile.
- Page de suppression mise à jour pour distinguer effacement automatique et demande manuelle selon l’environnement, avec reconnexion récente éventuelle.
- Aucune modification des clients OAuth, identifiants de connexion, données de production ou signatures Android.

## Éléments de recette connus

L’utilisateur a confirmé le parcours Android de suppression avec reconnexion en 0.7.2 et le retour après inscription. Cette validation ne vaut pas recette iOS ni validation de production. Le reçu backend du 28 octobre documente un test manuel distinct et doit être lu avec ses limites.

## Configuration Google à exécuter dans le compte du projet

Préparer un projet de test distinct du projet de production. Nom affiché : **PokéStock France**. Adresse d’assistance et de confidentialité confirmée : **nico.chapuise@gmail.com**. La renseigner dans la console Google avec les contacts du projet. Ne jamais stocker le secret OAuth dans le dépôt, les pages ou le bundle mobile.

URLs candidates après publication effective des pages :

- Accueil : https://nicochapuise-byte.github.io/pokestock-france/
- Confidentialité : https://nicochapuise-byte.github.io/pokestock-france/confidentialite.html
- Assistance : https://nicochapuise-byte.github.io/pokestock-france/assistance.html
- Suppression : https://nicochapuise-byte.github.io/pokestock-france/suppression-compte.html

Ces URL ne sont pas considérées publiées par l’ajout à cette branche. Les pages de préparation ne doivent pas être soumises comme politique finalisée.

Vérifier les domaines autorisés et leur vérification avec Google ; la propriété du dépôt GitHub ne démontre pas la vérification du domaine exigée pour la marque OAuth. Relever l’URI de redirection exacte affichée dans la configuration du fournisseur Google de Neon Auth pour chaque environnement ; ne pas la remplacer par l’URL de retour Android. Les pages `android-auth.html` et `android-auth-dev.html` sont les retours utilisés par le pont mobile, pas une preuve de callback OAuth Google. Limiter les scopes aux besoins de connexion après vérification de la configuration effective.

Application Android actuellement configurée : `fr.pokestock.app`. Aucun changement d’identifiant nécessaire à cette étape. Si un client Android est demandé, relever le certificat de signature réel avec l’outil existant `mobile/scripts/apk-certificate.mjs` ; ne pas inventer d’empreinte et distinguer signature de test et signature de distribution.

Après configuration, tester avec un compte de test : connexion, inscription, annulation dans le navigateur, retour automatique et manuel, redémarrage, expiration de session et reconnexion avant suppression. Ne pas réutiliser un compte personnel pour un test d’effacement.

## Points restant à finaliser avant ouverture

- Éditeur confirmé par l’utilisateur : Sébastien PASQUET ; contact : nico.chapuise@gmail.com.
- Bases légales par finalité, durées de conservation et sauvegardes, inventaire des SDK et prestataires, transferts et modalités d’exercice des droits.
- Canal permanent de support, signalement d’abus et blocage ; recette des autorisations GPS/caméra et de l’adresse privée.
- Configuration Google effective, domaines et contacts ; comptes développeur et recette de distribution.
- Déclarations Data Safety / App Privacy alignées sur le fonctionnement vérifié ; ne pas déclarer « aucune donnée ».
- Droits des images et visuels de boutique, captures issues de vrais builds.

## Références officielles consultées le 29 octobre 2026

- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/9859455
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance

## Mise à jour opérationnelle du 29 octobre

- Identité et contact confirmés : Sébastien PASQUET, nico.chapuise@gmail.com.
- Lecture des réglages Neon : région aws-eu-central-1 ; fenêtre historique de la base 21 600 secondes (6 h). Ce n’est pas un délai de purge garanti pour tous les objets et sauvegardes.
- Google sur la branche de développement : fournisseur `shared` (identifiants de test Neon). Nom de l’intégration mis à jour vers PokéStock France ; ceci ne change pas la marque affichée par Google.
- Console Google Cloud inaccessible depuis le navigateur de travail : identifiants propres au projet non créés. Ne pas désactiver le fournisseur fonctionnel en attendant.
- Build Android de test préparé en 0.7.3, versionCode 11, même identifiant et même mécanisme de signature.
- Pages publiables comme informations de préparation ; les points inconnus restent visibles. La politique n’est pas déclarée finalisée pour les stores.

## Reprise après la version 0.7.5

- Version Android livrée : 0.7.5 (versionCode 13). Compilation et signature vérifiées ; 55 tests passent.
- 0.7.4 : l’accueil respecte la navigation et ne reste plus au-dessus de la carte.
- 0.7.5 : navigation directe depuis Compte et Favoris, avec fermeture par les gestionnaires existants. Les dialogues de publication et de confirmation conservent leur fonctionnement modal.
- L’utilisateur a confirmé la connexion par e-mail et le fonctionnement de la carte. Ne pas lui redemander toute la recette déjà effectuée. La persistance de session après redémarrage n’est pas explicitement confirmée dans cet échange.
- Configuration relue : Google shared et SMTP shared sur la branche de développement ; vérification e-mail désactivée. Aucun changement de configuration effectué à cette étape.

### Google : deux chantiers séparés

1. Identifiants propres à PokéStock : créer/configurer l’application OAuth dans Google Cloud, puis enregistrer ses identifiants dans Neon. Ceci concerne l’identité du service et la préparation à la diffusion, pas la liaison des comptes.
2. Rattachement explicite : le module natif installé (@capgo/capacitor-neon 8.1.0) n’expose pas de méthode de liaison dans son interface publique. Le client Neon web documente des fonctions de liaison, mais leur existence ne valide pas le parcours natif. Garder le compte existant et son accès par e-mail. Ne pas modifier les identités par SQL ni considérer une adresse identique comme une autorisation de fusion. Implémentation et recette authentifiée encore nécessaires.

### Configuration Google de test à préparer

- Console : https://console.cloud.google.com/auth/overview
- Nom : PokéStock France ; assistance et contact éditeur : nico.chapuise@gmail.com.
- Créer ou sélectionner un projet de test appartenant à l’éditeur. Conserver le mode test pendant la préparation ; ajouter individuellement les comptes testeurs autorisés.
- Type du client OAuth : Application Web, puisque Google revient vers Neon avant de revenir dans Android.
- Dans Neon, projet sparkling-bread-53722880, branche dev-seller-types-20261027, ouvrir Auth et la configuration Google. Copier l’URI exacte affichée dans ce dialogue dans les URI de redirection autorisées Google.
- Valeur attendue d’après la base URL relue et la documentation officielle : https://ep-morning-bonus-b92tax88.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth/callback/google ; à comparer au dialogue avant enregistrement.
- Origine web de l’application : https://nicochapuise-byte.github.io (sans chemin).
- Le retour Android android-auth-dev.html n’est PAS l’URI OAuth à enregistrer chez Google.
- Saisir Client ID et Client Secret directement dans la configuration Google de Neon ; ne pas envoyer le secret en conversation et ne pas le committer.
- Les pages publiques de confidentialité restent des brouillons : ne pas les présenter comme finalisées, ne pas publier l’écran de consentement ni soumettre aux stores à cette étape.

Documentation vérifiée : https://neon.com/docs/auth/guides/setup-oauth et interface publique du module natif installé.

## Mise à jour du 30 octobre 2026 — 0.7.6

Cette section remplace les anciens constats Google shared et association non implémentée ci-dessus.

- Google utilise désormais les identifiants propres au projet sur la branche bêta ; l’écran de consentement reste en mode test.
- Association explicite via Google Identity Services et `linkSocial` avec preuve d’identité Google, vérifiée par Neon. Ce parcours remplace la redirection d’association qui échouait avec `state_mismatch`. Aucun changement d’identité par SQL.
- Le 29 octobre, la capture de l’utilisateur confirme l’association réussie au compte existant. La connexion Google dans l’APK et la persistance après fermeture restent à confirmer ; ne pas les présenter comme déjà validées.
- Version 0.7.6, versionCode 14 : raccourci vers l’association dans Compte, visible seulement après connexion et seulement dans la bêta. Aucun identifiant, e-mail ou jeton n’est ajouté à l’URL. La page est ouverte par le gestionnaire natif de liens existant.
- L’APK de test doit conserver `fr.pokestock.app.dev` et le certificat permanent pour permettre la mise à jour sans désinstallation.
- Aucune soumission Google Play ou App Store, aucun passage en production. Les points de confidentialité et de diffusion encore ouverts restent à finaliser.
