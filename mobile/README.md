# PokéStock — préparation Android et iOS (0.1.0)

État : socle natif généré avec Capacitor 8.5.3, **pas encore une version distribuable**. Le site public et les accès de production sont inchangés. Identifiant provisoire `fr.pokestock.app` : vérifier et réserver les identifiants définitifs avant la première soumission.

## Ce qui est créé

- Projet Android Studio `android/` et projet Xcode SPM `ios/App/App.xcodeproj`.
- Interface du site copiée dans l’application à chaque build, carte Leaflet embarquée ; pas de `server.url` pointant vers le site distant.
- Pont GPS à la demande pour « Autour de moi », sans suivi en arrière-plan.
- Liens de boutiques et administration ouverts dans le navigateur du système ; profil vendeur et navigation restent dans l’app.
- Message hors connexion, bouton retour Android, zones de sécurité iPhone et champs sans zoom automatique.
- Icône provisoire originale (repère de carte étoilé), écrans de lancement ; aucun personnage ou logo Pokémon dans l’icône.
- Photos : sélecteur HTML existant conservé. Prise de vue et choix depuis la photothèque à valider sur appareils ; pas encore de plugin Camera.
- Aucun push, paiement, suivi publicitaire ou stockage hors ligne de données privées ajouté.

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

Une action GitHub `Mobile Android - development build` prépare aussi un APK debug à chaque modification de `mobile/`. Un artefact n’est téléchargeable qu’après une compilation réussie ; aucune signature de publication n’est présente. Un APK debug ne valide pas les parcours réseau/authentifiés.

## Points bloquants avant de tester les comptes et de distribuer

1. **API/CORS** : l’API actuelle n’autorise que `https://nicochapuise-byte.github.io`. Le bundle local utilise `capacitor://localhost` (iOS) / `https://localhost` (Android). Les lectures et écritures API ne sont donc pas validées dans l’app. Tester une liste d’origines explicites sur une branche Neon de développement, avec JWT et contrôles propriétaires inchangés ; aucune autorisation globale `*`.
2. **Neon Auth** : le SDK web et `/token` utilisent des cookies tiers. Vérifier le support officiel de l’origine native et la persistance de session WKWebView/Android. Ne pas déplacer les tokens dans localStorage ou activer un contournement CORS/HTTP pour masquer ce problème. Envisager un flux natif pris en charge par l’authentification si les cookies échouent. L’import SDK distant actuel nécessite Internet.
3. **Parcours de bout en bout** : inscription, connexion, déconnexion, expiration, photo, signalement, correction/rupture, favoris, retour Android, liens, GPS refusé/approximatif et appareils avec encoche. Tester avec un compte administrateur et un compte classique.
4. **Fonctions requises avant les stores** : suppression de compte et des données associées dans l’app + chemin web pour Google ; politique de confidentialité/contact réels ; signalement de contenu abusif et blocage des utilisateurs pour le contenu communautaire. Les contrôles de modération existants ne constituent pas à eux seuls une validation de toutes ces exigences.
5. **Préparation éditeur** : comptes développeur Apple/Google, identité/contact de l’éditeur, disponibilité du nom, identifiants définitifs, signature, classement d’âge, déclarations de données et permissions, justificatifs des droits sur les visuels. Aucun compte payant créé, aucune condition acceptée et aucune soumission effectuée.
6. **Recette stores** : captures provenant des applications réellement compilées, installation sur appareils, test fermé Android et TestFlight, compte de démonstration pour la revue. Voir `store/preparation-fr.md`.

Les permissions sont demandées par les actions de l’utilisateur, pas au démarrage. La localisation des particuliers doit continuer à être limitée au centre de la commune côté serveur.

## Sources officielles vérifiées le 27 octobre 2026

- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/updating/8-0
- https://capacitorjs.com/docs/config
- https://capacitorjs.com/docs/apis/geolocation
- https://developer.apple.com/app-store/review/guidelines/ (1.2, 4.2, 5.1.1)
- https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/
- https://support.google.com/googleplay/android-developer/answer/13327111

La génération de fichiers natifs n’est pas une compilation Android/iOS réussie, et ne garantit pas l’acceptation des stores.
