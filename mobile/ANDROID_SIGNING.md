# Signature permanente des APK Android de test

La version 0.6.1 conserve le paquet `fr.pokestock.app.dev` et utilise une clé PKCS12 permanente propre à PokéStock. La clé privée n’est jamais enregistrée dans le dépôt. Seul son certificat SHA-256 public est versionné dans `android/signing-certificate.sha256`.

## Activation unique par le propriétaire GitHub

1. Ouvrir les réglages du dépôt → Secrets and variables → Actions → New repository secret.
2. Nom exact : `ANDROID_SIGNING_BUNDLE`.
3. Valeur : contenu intégral du fichier privé `PokeStock-Android-signature-privee.json` remis au propriétaire. Ne pas le coller dans un fichier du dépôt, une issue, un commentaire ou les logs.
4. Ajouter le secret, puis relancer le workflow Android en échec via Actions → Mobile Android - development build → Re-run all jobs, ou lancer ce workflow manuellement sur `main`.

Le fichier privé contient la clé chiffrée et son mot de passe. Il est aussi la sauvegarde nécessaire pour restaurer le secret : conserver une copie confidentielle durable. Ne pas régénérer une clé en cas de secret manquant ; restaurer la même sauvegarde.

## Contrôles imposés

- La restauration s’arrête si le secret manque, est invalide ou ne correspond pas à l’empreinte publique.
- Gradle utilise la clé restaurée pour le type debug. En CI, l’absence de clé interdit la compilation avec une clé temporaire.
- Avant livraison, `apksigner verify --print-certs` doit confirmer la signature de l’APK et son empreinte attendue.
- Les valeurs sensibles sont masquées et le fichier temporaire est retiré en fin de job. Aucun artefact privé n’est téléversé par le workflow.
- Chaque nouvelle livraison doit conserver le paquet, la clé et augmenter `versionCode`.

## Migration et portée

Une dernière désinstallation de l’APK 0.6.0 sera nécessaire : son certificat temporaire diffère. Les APK permanents suivants pourront être installés par-dessus la première version permanente, avec conservation du stockage local. Cela ne crée pas un système de mises à jour automatiques : le nouvel APK doit toujours être téléchargé puis installé.

La signature permanente concerne ici l’application de test `.dev`, toujours connectée à la branche de développement. Elle ne configure pas Play App Signing ni la signature de production, qui restent à préparer séparément. Le premier APK permanent 0.6.1 est compilé et son certificat vérifié. Le passage de 0.6.0 à 0.6.1 nécessite encore une désinstallation ; une installation par-dessus 0.6.1 sera à confirmer sur appareil lors de la prochaine livraison.

Activation du 28 octobre 2026 : le propriétaire a ajouté le secret dans GitHub. La compilation 40681854474 a réussi : restauration de la clé, 35 tests, compilation, validation cryptographique par apksigner, comparaison indépendante du certificat v2 avec l’empreinte publique et livraison de l’artefact. Le certificat a aussi été recontrôlé après téléchargement. Deux restaurations locales de la même clé avaient confirmé des paramètres identiques. La clé privée n’a pas changé lors de la correction du contrôle de certificat.

Le script lit directement le certificat du bloc v2 pour éviter de dépendre du format d’affichage variable d’apksigner. La validation cryptographique complète par apksigner reste obligatoire avant cette comparaison.
