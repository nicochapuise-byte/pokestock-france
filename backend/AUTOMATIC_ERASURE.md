# Effacement automatique — bêta Android 0.7.0

## État réel

Le service et l’interface sont raccordés et testés avec des adaptateurs simulés. Le schéma des reçus est installé sur la branche de développement. Le service y est déployé mais désactivé tant que sa clé de gestion n’est pas configurée. Aucun compte n’a été supprimé pendant ce raccordement. Le test manuel réel antérieur ne valide pas ce nouveau parcours automatique.

L’activation est volontairement limitée à `br-morning-lab-b9mavkej` dans `sparkling-bread-53722880`. La production est refusée par le code, même si son indicateur est activé par erreur. La version web conserve le traitement manuel en attendant une validation séparée.

## Configuration privée restant à fournir par le propriétaire

Parcours préparé pour le propriétaire : créer une clé de gestion Neon dédiée au projet, puis l’ajouter dans GitHub Actions comme secret de dépôt `NEON_ERASURE_API_KEY`. Le workflow `Backend - development account erasure` utilise le CLI officiel `neonctl@8.13.1`, cible explicitement le projet et la branche de développement, ajoute les deux variables privées ci-dessous par mise à jour ciblée et attend le déploiement. Il vérifie ensuite que le service annonce enabled:true. Il ne lance aucune suppression. Sans secret, il échoue sans activer le service. Après l’ajout, relancer son job en échec. Ne jamais utiliser la clé de signature Android comme clé Neon.

Variables de la fonction `pokestock`, branche `dev-seller-types-20261027` :

- `NEON_ERASURE_API_KEY` : clé de l’API de gestion Neon autorisée sur le seul projet PokéStock, avec les droits nécessaires à la suppression des utilisateurs Auth. Préférer une clé dédiée limitée au projet ; ne pas réutiliser une clé globale personnelle si une restriction de projet est disponible.
- `ACCOUNT_ERASURE_ENABLED` : `true`, uniquement au moment du test prévu.

La clé ne doit figurer ni dans le dépôt, ni dans l’APK, ni dans le navigateur, ni dans le chat. Les variables DB, Auth et AWS sont injectées par Neon et doivent être conservées. Le connecteur expose la suppression d’un utilisateur mais ne fournit pas automatiquement un secret de gestion réutilisable à la fonction. Les credentials de stockage ne permettent pas de gérer les identités Auth. La clé de signature Android est également sans rapport avec cette API.

L’endpoint `GET /account-erasure/capabilities` renvoie `enabled:false` avant cette configuration. L’utilisateur ne doit pas être invité à tester l’effacement automatique tant que cet état n’est pas passé à `true` et que la version Android correspondante n’est pas installée. Le script de déploiement capture la sortie du CLI et n’en journalise pas les réponses privées. Les autres variables sont conservées par la mise à jour ciblée. Ne pas publier la clé dans une commande ou une capture partagée.

## Parcours et contrôles

1. L’utilisateur connecté saisit SUPPRIMER et coche la confirmation. La préparation refuse un compte administrateur et tout identifiant de cible fourni par le client.
2. Le serveur crée une demande processing et un reçu aléatoire de 256 bits ; seule son empreinte est stockée en base. Le client conserve temporairement le reçu et l’UUID du compte dans son stockage local pour reprendre après disparition de la session.
3. L’exécution utilise ce reçu uniquement pour cette demande. Un seul worker persistant est admis. Le verrou global gèle les nouvelles écritures et exige le drainage des opérations existantes.
4. L’inventaire figé doit être inchangé, sans partage ni rôle administrateur, avec au plus 30 fichiers. Sinon une vérification opérateur est nécessaire.
5. L’API de gestion supprime l’identité, puis son absence est contrôlée directement dans la branche. Chaque fichier est retiré puis son absence active confirmée. Une erreur 403/5xx ou un résultat ambigu bloque le nettoyage suivant.
6. Un checkpoint files_verified précède le nettoyage SQL. Les données et références sont vérifiées avant de produire le reçu completed, d’effacer l’identifiant personnel du job et de lever le verrou.
7. Le client n’annonce la réussite qu’après un reçu completed ; il nettoie la session et le reçu local. Une coupure conserve le reçu pour consulter l’état ou reprendre. Un autre compte connecté sur l’appareil ne doit pas être déconnecté par un ancien reçu.

Les routes de statut ne renvoient ni identité, ni adresse e-mail, ni clé de fichier. Un POST completed peut reprendre une réponse perdue de libération du verrou. Le GET de statut reste sans effet de bord.

## Reprise opérateur

Un worker interrompu n’expire pas automatiquement. Vérifier son arrêt effectif avant de remettre `worker_id` à NULL. Contrôler l’identité, les opérations actives et le stockage avant de modifier le verrou global. Un échec ambigu après la tentative de suppression d’identité conserve le verrou ; la reprise par le reçu reste possible quand le worker a terminé et a enregistré failed. Ne jamais débloquer un worker encore actif ou déclarer completed sans les contrôles de fin.

Si le SQL a réussi mais que le reçu final n’a pas été enregistré, la reprise sans demande n’est permise qu’avec le checkpoint files_verified et la vérification complète des données vides. La perte du reçu côté appareil nécessite une prise en charge opérateur ; ce reçu n’est pas un jeton de session et ne donne accès à aucune donnée du compte.

## Validation et limites avant ouverture publique

48 tests locaux réussis : contrôles d’accès, arrêt sur erreur, reprise après disparition d’identité, fin interrompue, concurrence des workers, interface de confirmation et restauration du reçu sans reconnexion. Migration et planification SQL vérifiées en développement, sans effacement réel supplémentaire. Il reste à valider le parcours complet avec la clé serveur et un compte jetable identifié, puis sur appareil.

La réauthentification récente n’est pas encore imposée au-delà du JWT courant ; la définir avant exposition publique. Les anciens objets orphelins antérieurs à l’instrumentation et la rétention physique des sauvegardes nécessitent une politique distincte. Les reçus terminés ne contiennent plus d’identifiant de compte, mais leur durée de conservation et leur nettoyage restent à définir avant production. Le service n’est donc pas déclaré prêt pour les stores à ce stade.

Sources : https://neon.com/docs/reference/api/auth/delete-branch-neon-auth-user et https://neon.com/docs/compute/functions/environment-variables
