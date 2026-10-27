# PokéStock — préparation Android et iOS (0.3.0)

État : socle natif et intégration d’authentification native générés avec Capacitor 8.5.3, **pas encore une version validée sur téléphone**. Le site public et les accès de production sont inchangés. Identifiant provisoire `fr.pokestock.app` : vérifier et réserver les identifiants définitifs avant la première soumission.

## Ce qui est créé

- Projet Android Studio `android/` et projet Xcode SPM `ios/App/App.xcodeproj`.
- Interface du site copiée dans l’application à chaque build, carte Leaflet embarquée ; pas de `server.url` pointant vers le site distant.
- Pont GPS à la demande pour « Autour de moi », sans suivi en arrière-plan.
- Liens de boutiques et administration ouverts dans le navigateur du système ; profil vendeur et navigation restent dans l’app.
- Message hors connexion, bouton retour Android, zones de sécurité iPhone et champs sans zoom automatique.
- Icône provisoire originale (repère de carte étoilé), écrans de lancement ; aucun personnage ou logo Pokémon dans l’icône.
- Photos : module officiel `@capacitor/camera` 8.2.6, boutons Prendre une photo / Choisir une photo, prévisualisation et retrait, refus/annulation, limite de 10 Mo. Aucun envoi automatique ni sauvegarde dans la photothèque. Le sélecteur de fichier reste disponible en secours.
- Photo récupérée après interruption Android : proposition explicite de réutilisation, reprise des étapes du formulaire et confirmation avant publication. Aucun brouillon de compte ou d’adresse privée n’est écrit dans le stockage web.
- Les préparations photo tardives sont ignorées après fermeture du formulaire, retrait ou changement de compte. La publication est bloquée pendant la préparation. La compression JPEG existante reste commune au site et à l’application.
- Connexion e-mail/mot de passe native via `@capgo/capacitor-neon` 8.1.0 (module communautaire présenté dans le guide Neon). Persistance de session gérée par le module, pas par localStorage.
- Transport HTTP natif limité à l’hôte exact de l’API PokéStock, avec JWT et réponses/statuts conservés, redirections désactivées. Les images et requêtes tierces conservent leur transport habituel.
- Aucun push, paiement ou suivi publicitaire ajouté.

## Préparer et vérifier

Node 22+ ; les versions des dépendances sont verrouillées.

```sh
cd mobile
npm ci
npm run build
npm run check
npx cap sync
```

Android : Android Studio 2025.2.1+, JDK 21, SDK Android 36. Ouvrir avec `npx cap open android`. Le minimum généré est Android API 24. Pour un APK de développement sur une machine équipée :

```sh
cd android
./gradlew assembleDebug
```

iOS : un Mac avec Xcode 26+ et ses SDK est nécessaire. Ouvrir `ios/App/App.xcodeproj`, laisser SPM résoudre les dépendances, sélectionner une équipe Apple puis lancer sur simulateur/appareil. Cible minimale iOS 15. Les certificats et clés de signature restent hors du dépôt.

La version 0.2.0 a compilé sur Android (run 40550548743) et sur simulateur iOS (run 40550548734). Cela ne valide pas les ajouts 0.3.0 ni le fonctionnement sur un téléphone.

Une action GitHub `Mobile Android - development build` prépare aussi un APK debug à chaque modification de `mobile/`. Un artefact n’est téléchargeable qu’après une compilation réussie ; aucune signature de publication n’est présente. Un APK debug ne valide pas les parcours réseau/authentifiés.

Une seconde action `Mobile iOS - simulator build` compile sur macOS 26 avec Xcode, sans certificat de distribution. L’artefact simulateur ne s’installe pas sur un iPhone ; TestFlight exige une version signée et le compte développeur de l’éditeur.

## Points bloquants avant de tester les comptes et de distribuer

1. **Environnement de test par défaut** : `npm run build` utilise l’API et l’Auth de la branche Neon `br-morning-lab-b9mavkej`. Le bandeau « Version de test » le signale. L’APK debug utilise l’identifiant `fr.pokestock.app.dev`, le nom PokéStock Test et ne partage pas son stockage avec la future version de production. Les comptes de développement sont distincts ; les comptes de production existants n’y sont pas automatiquement ajoutés après la création de la branche. Ne pas utiliser cet APK comme version publique.
2. **Connexion intégrée, recette encore requise** : le client web de l’interface est adapté au module natif (connexion, inscription, session, JWT, déconnexion). Démarrage ordonné : ponts natifs avant les scripts du site. Les règles CORS/trusted domains de production sont inchangées : les appels à l’API passent par le client HTTP natif pour ce seul hôte. Vérifier sur Android et iOS la restauration réelle, le renouvellement et les erreurs réseau. Aucune connexion réelle d’utilisateur ni création de compte n’a été simulée sur le serveur pour ces tests. Le module communautaire doit rester versionné et revu à chaque mise à jour.
3. **Parcours de bout en bout** : inscription, connexion, déconnexion, expiration, photo, signalement, correction/rupture, favoris, retour Android, liens, GPS refusé/approximatif et appareils avec encoche. Tester avec un compte administrateur et un compte classique.
4. **Fonctions requises avant les stores** : suppression de compte et des données associées dans l’app + chemin web pour Google ; politique de confidentialité/contact réels ; signalement de contenu abusif et blocage des utilisateurs pour le contenu communautaire. Les contrôles de modération existants ne constituent pas à eux seuls une validation de toutes ces exigences.
5. **Préparation éditeur** : comptes développeur Apple/Google, identité/contact de l’éditeur, disponibilité du nom, identifiants définitifs, signature, classement d’âge, déclarations de données et permissions, justificatifs des droits sur les visuels. Aucun compte payant créé, aucune condition acceptée et aucune soumission effectuée.
6. **Recette stores** : captures provenant des applications réellement compilées, installation sur appareils, test fermé Android et TestFlight, compte de démonstration pour la revue. Voir `store/preparation-fr.md`.

Pour préparer explicitement un paquet utilisant la production après recette : `POKESTOCK_MOBILE_ENV=production npm run build`, puis `npx cap sync`. Ne pas distribuer ce paquet avant la recette et la signature. Ne jamais ajouter de clé de serveur aux configurations publiques.

Les permissions sont demandées par les actions de l’utilisateur, pas au démarrage. La localisation des particuliers doit continuer à être limitée au centre de la commune côté serveur.

## Sources officielles vérifiées le 27 octobre 2026

- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/updating/8-0
- https://neon.com/guides/capgo-capacitor-neon
- https://capgo.app/docs/plugins/neon/getting-started/
- https://capacitorjs.com/docs/apis/http
- https://capacitorjs.com/docs/config
- https://capacitorjs.com/docs/apis/camera
- https://capacitorjs.com/docs/apis/geolocation
- https://developer.apple.com/app-store/review/guidelines/ (1.2, 4.2, 5.1.1)
- https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/
- https://support.google.com/googleplay/android-developer/answer/13327111

La génération de fichiers natifs n’est pas une compilation Android/iOS réussie, et ne garantit pas l’acceptation des stores.
