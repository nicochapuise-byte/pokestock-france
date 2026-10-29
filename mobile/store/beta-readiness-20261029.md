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
