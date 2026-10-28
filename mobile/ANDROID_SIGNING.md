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

La signature permanente concerne ici l’application de test `.dev`, toujours connectée à la branche de développement. Elle ne configure pas Play App Signing ni la signature de production, qui restent à préparer séparément. Les mises à jour sans désinstallation ne sont pas encore vérifiées sur appareil : le premier APK signé ne peut être compilé qu’après l’ajout du secret GitHub.

Validation locale : 34 tests réussis, deux restaurations réelles de la même clé avec contrôle du certificat et des paramètres identiques. Aucun secret de signature n’a encore été ajouté via le connecteur GitHub, qui n’expose pas cette opération.
