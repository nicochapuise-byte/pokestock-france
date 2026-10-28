# Accueil et connexion Google — version 0.6.0

L’application Android démarre sur l’accueil avec Google, e-mail et accès libre à la carte. Le site propose Google dans sa fenêtre de connexion. Les sessions et permissions restent gérées par Neon Auth ; aucun rôle administrateur n’est attribué par le bouton Google.

Le web utilise `signIn.social` du client Managed Neon Auth. Android utilise `signInWithOAuth` de @capgo/capacitor-neon, le navigateur système et un retour HTTPS vers la page statique de rebond. Celle-ci ne transmet que le vérificateur au schéma fixe de l’application. Le plugin l’échange contre sa preuve détenue sur l’appareil. Aucun jeton de session n’est placé dans le stockage web. La navigation vers une adresse de retour arbitraire est interdite.

## Environnements

- Android de test : page `https://nicochapuise-byte.github.io/pokestock-france/android-auth-dev.html`, schéma `fr.pokestock.app.dev://auth/callback`.
- Android de production : page `https://nicochapuise-byte.github.io/pokestock-france/android-auth.html`, schéma `fr.pokestock.app://auth/callback`.
- Web : retour `https://nicochapuise-byte.github.io/pokestock-france/index.html`.

L’origine du site figure déjà dans les domaines de confiance de l’environnement de développement. Les deux environnements utilisent actuellement le fournisseur Google partagé de Neon, destiné aux tests. Le démarrage réel des flux social a renvoyé HTTP 200 pour le développement Android et pour le web. La connexion complète avec consentement Google, le retour sur appareil et les comptes Google déjà associés à un compte e-mail restent à valider avec un testeur. Les 33 tests locaux incluent des simulations du bouton web, de l’adaptateur natif et du retour de vérification. iOS est en pause ; son schéma de retour n’est pas configuré par ce changement.

## Avant ouverture publique

Configurer un client OAuth Web appartenant à PokéStock dans Google Cloud (nom, contact et domaine de consentement), puis renseigner ses identifiants directement dans les réglages OAuth de Neon, jamais dans le dépôt ni dans le JavaScript. Autoriser les redirections exactes suivantes :

- Développement : `https://ep-morning-bonus-b92tax88.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth/callback/google`
- Production : `https://ep-dark-bread-b9bd8cco.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth/callback/google`

Vérifier aussi le domaine de confiance du site sur la branche de production. Tester une réussite, une annulation, un retour à froid, une reprise après mise en arrière-plan, une déconnexion puis reconnexion, et la connexion e-mail conservée. Les comptes de l’APK de développement sont distincts des comptes du site de production.

Documentation : https://neon.com/docs/auth/guides/setup-oauth
