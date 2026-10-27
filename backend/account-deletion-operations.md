# Traitement manuel des demandes de suppression — préparation 0.4.0

Les routes de cette version enregistrent, annulent et prennent en charge une demande. **Elles ne réalisent pas l’effacement définitif.** Le statut `processing` ne signifie jamais « supprimé ». Aucun contrôle de l’écran administrateur ne doit laisser entendre le contraire.

## Avant une ouverture sur les stores

Finaliser et tester le processus complet d’effacement, l’éditeur/contact de confidentialité, le délai annoncé de traitement, les éventuelles rétentions et la confirmation de fin. L’enregistrement d’une demande ne suffit pas à déclarer ces exigences satisfaites. La politique de confidentialité et les formulaires des stores doivent correspondre au traitement réellement opérationnel.

## Lors de la prise en charge

1. Vérifier la branche : les APK de test utilisent `br-morning-lab-b9mavkej`, alors que le Dashboard du site public utilise la production `br-nameless-math-b9dyokxp`. Ne pas mélanger ces files.
2. Vérifier le UUID de demande, le `user_id` authentifié enregistré et l’identité de connexion. Ne jamais exécuter un effacement sur le seul nom/pseudo ou à partir d’un lien transmis sans vérification.
3. Passer de « À traiter » à « Prise en charge » uniquement lorsque le traitement commence. La demande ne peut ensuite plus être annulée par l’utilisateur dans cette version ; un opérateur doit traiter les changements de décision avant toute action irréversible.
4. Inventorier les données du compte et les fichiers concernés avant de supprimer quoi que ce soit. Le schéma peut évoluer : vérifier les références réelles.

## Inventaire à couvrir pour l’effacement définitif

- Identité Neon Auth, sessions et moyens de connexion, avec les API de gestion prises en charge par Neon. Retirer un rôle de `stock_admins` exige de vérifier qu’une autre administration reste opérationnelle.
- `stock_reports.user_id`, preuves du bucket `proofs` référencées par `photo_object_key`, votes et historiques rattachés aux signalements.
- Votes du membre via `stock_votes.voter_user_id`, favoris et alertes via `stock_watches.user_id`.
- Photographies proposées via `catalog_photo_proposals.proposed_by`, y compris celles approuvées et réutilisées comme images du catalogue. Vérifier leurs fichiers dans `catalog-images` et leurs références partagées avant de les retirer ou de remplacer le visuel public.
- Identifiants personnels dans `removed_by`, `edited_by`, `reviewed_by` et les champs JSON d’historique. Les modifier/supprimer conformément à la politique de rétention réellement applicable ; ne pas prétendre qu’un simple retrait de fiche publique les efface.
- Demande `account_deletion_requests` et informations d’identité qu’elle contient. Ne pas conserver indéfiniment un identifiant personnel au titre d’un journal « supprimé ».
- Éventuels fichiers temporaires, copies, exports et sauvegardes : documenter leur cycle de rétention et les limites réelles, sans promettre un effacement instantané de tous les supports.

Une suppression de ligne ne supprime pas son objet S3. Une suppression d’identité n’efface pas automatiquement les tables applicatives `public`. Prévoir les échecs partiels, leur reprise et une vérification finale sur l’identité, les données et les fichiers.

## Ce que cette version interdit par conception

- Marquer une demande « terminée » sans effacement : ce statut et cette action n’existent pas.
- Envoyer un `user_id` arbitraire à la route personnelle : le serveur utilise uniquement l’identité du JWT.
- Annuler une demande déjà prise en charge ou accéder à la file avec un compte non administrateur.

Les tests ne doivent produire aucun effacement réel ni demande fictive durable en production. Tester les changements d’état dans un environnement isolé ou dans une transaction entièrement annulée.

## Inventaire administrateur et moteur préparé

Le bouton « Vérifier les données à effacer » appelle `GET /admin/account-deletions/:id/preview`. Il ne fait que des lectures et reste réservé aux administrateurs. Les clés de fichiers et URL privées ne sont pas retournées. Les comptes administrateurs, références de fichiers partagées et demandes non prises en charge sont signalés comme bloqués.

`account-erasure.mjs` prépare un moteur sans route HTTP d’exécution. Ses adaptateurs réels ne sont pas encore branchés : API de suppression Neon Auth, verrou durable empêchant les nouvelles écritures et drainant celles en cours, suppression S3 avec vérification d’absence, reprise et reçu de fin. Un simple verrou en mémoire ne suffit pas. Les anciens JWT et les téléversements en cours doivent être traités avant activation.

Le nettoyage SQL est limité au compte et à une demande en cours, refuse une identité encore présente ou un rôle administrateur. Les retraits effectués sur les signalements d’autres membres sont anonymisés pour conserver leur retrait. Les références de photos du catalogue sont détachées sans supprimer les produits.

Validation actuelle : tests simulés des échecs partiels et reprises, inventaire SQL en lecture seule et planification SQL sans exécution. Aucun compte ni fichier réellement effacé. La validation de bout en bout doit utiliser uniquement un compte jetable dédié sur la branche de développement, après autorisation explicite de sa suppression irréversible. Les rétentions de sauvegardes restent à documenter.
