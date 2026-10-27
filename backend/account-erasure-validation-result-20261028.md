# Compte rendu de validation manuelle — 28 octobre 2026

**Résultat : réussi.** Test destructif explicitement autorisé par l’utilisateur, limité à un nouveau compte jetable et à ses seules données techniques sur la branche de développement `br-morning-lab-b9mavkej`, projet `sparkling-bread-53722880`.

## Vérifications réellement exécutées

| Contrôle | Résultat |
| --- | --- |
| Collision avant création du compte et des deux clés | Aucune |
| Création de l’identité via l’API officielle Neon Auth | Réussie |
| Admission d’une opération réelle et enregistrement préalable des deux fichiers | Réussis |
| Téléversements des deux JPEG techniques | HTTP 200, 644 octets chacun |
| Inventaire avant effacement | 1 signalement non public, 1 proposition en attente, 1 favori, 1 demande, 1 opération terminée, 2 intentions de téléversement, 2 fichiers |
| Rôle administrateur / référence partagée / photo publique à détacher | Aucun |
| Acquisition du verrou et drainage | Réussis, zéro opération active |
| Nouvelle écriture pendant le gel | Refusée par la fonction d’admission |
| Inventaire après gel | Identique à celui avant gel, sans blocage de cible |
| Suppression de la seule identité nouvellement créée | Réussie via le connecteur Neon ; absence vérifiée dans l’annuaire |
| Suppression des deux seules clés de test | Réussie via le connecteur Neon ; listes vides et téléchargements signés HTTP 404 |
| Nettoyage SQL limité au compte et à sa demande | Exécuté : 1 signalement, 1 proposition, 1 favori et 1 demande retirés ; opérations et intentions également retirées |
| Contrôle final des données | Les 14 compteurs de l’inventaire sont à zéro ; aucune référence de fichier restante |
| Catalogue de développement | Empreintes complètes avant/après identiques pour les séries, produits et variantes |
| Fin du traitement | Verrou levé, aucune demande liée au verrou et zéro opération active |

Aucune donnée de production n’a été modifiée pour ce test. Aucun compte ou fichier préexistant n’a été supprimé. Aucun identifiant de la personne de test, secret ou lien signé n’est conservé dans ce reçu.

## Portée et limites

Le test a utilisé manuellement les API de gestion du connecteur Neon et le SQL préparé. Il valide les primitives réelles et le nettoyage du cas nominal. Il ne constitue pas une validation de la route automatique de suppression, qui reste désactivée, ni du parcours connecté Android/iOS. Les reprises après incident restent couvertes par les simulations existantes, pas par une panne réelle injectée pendant ce test.

Les téléchargements en 404 confirment l’absence des objets dans la branche active. Ils ne démontrent pas une purge physique instantanée des sauvegardes ou de l’historique du fournisseur. Les anciennes photos orphelines antérieures à l’instrumentation ne sont pas couvertes.

Avant ouverture aux utilisateurs : raccorder et tester les adaptateurs automatiques, le reçu de fin et la reprise du verrou ; définir la rétention, les coordonnées de confidentialité et la confirmation utilisateur ; vérifier le parcours sur appareils réels.
