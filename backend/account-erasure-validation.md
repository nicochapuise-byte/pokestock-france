# Validation destructive proposée — compte jetable uniquement

Ce protocole n’a pas encore été exécuté. Il exige l’autorisation explicite de supprimer définitivement l’identité et les données fictives créées pour ce test. Le suivi des opérations et les tests SQL annulés sont déjà distinctement testables sans cet effacement.

## Périmètre fermé

- Projet : `sparkling-bread-53722880`.
- Branche exclusivement : `br-morning-lab-b9mavkej` (`dev-seller-types-20261027`).
- Nouveau compte : `pokestock-erasure-validation-20261027@example.invalid`, nommé « Validation technique effacement ». Obtenir son nouvel UUID via l’API officielle de création Neon Auth ; ne jamais reprendre une identité déjà existante si cet email est occupé.
- Fichiers nouveaux uniquement : `proofs/reports/erasure-validation-20261027.jpg` et `catalog-images/proposals/erasure-validation-20261027.jpg`. Vérifier leur absence avant tout téléversement et arrêter en cas de collision. Aucun effacement par préfixe.
- Données du seul nouveau compte : un signalement fictif non public, une proposition photo en attente non approuvée, un favori, une demande de suppression, les opérations et intentions de téléversement associées. Utiliser une référence de catalogue existante sans modifier sa fiche ni sa photo publique. Aucun rôle administrateur.
- Aucun compte ou fichier existant, aucune ligne du catalogue et aucune donnée de production dans le périmètre.

## Déroulement contrôlé

1. Vérifier le projet/la branche sur chaque appel, l’absence de collision, le verrou ouvert et l’absence d’opération active antérieure non résolue. Vérifier que toutes les instances servant la branche utilisent la version qui suit les écritures.
2. Créer le compte par l’API de gestion Neon Auth, pas par écriture dans les tables gérées. Conserver son UUID dans le manifeste temporaire du test, sans secret dans les logs. Enregistrer les intentions avant de téléverser deux JPEG techniques sans données personnelles, puis ajouter les seules données fictives listées ci-dessus.
3. Préparer la demande en statut `processing`. Produire l’inventaire exact et vérifier que ses clés/compteurs correspondent seulement à ce manifeste. Vérifier l’absence de partage et de rôle administrateur.
4. Acquérir le verrou global de cette branche pour cette demande. Confirmer zéro opération active ; si une opération reste active, arrêter avant toute suppression d’identité. Recalculer l’inventaire après gel et revalider son empreinte.
5. Après l’autorisation explicite, supprimer uniquement le nouvel UUID via `delete_auth_user`. Vérifier sa disparition. Supprimer uniquement les deux clés listées via `delete_storage_object`, puis vérifier l’absence de ces clés et un téléchargement signé absent. Un 403/5xx n’est pas une preuve d’absence.
6. Exécuter le nettoyage SQL préparé avec les seuls UUID de ce compte et de cette demande. Vérifier tous les compteurs à zéro et l’absence de référence de fichier, ainsi que l’absence de l’identité. Les tables du catalogue restent inchangées.
7. Après une réussite vérifiée, enregistrer un reçu non identifiant et rouvrir les écritures de développement en libérant le verrou de cette demande. Vérifier le contrôle et l’accès public. En cas de résultat ambigu, arrêter et examiner l’état avant de libérer le verrou ou de reprendre.

Ce test manuel validera les primitives réelles. Il ne suffit pas à activer automatiquement une route de suppression pour les utilisateurs : le raccordement des adaptateurs, la gestion des reprises, la confirmation finale utilisateur et la politique de rétention restent à vérifier séparément. Une absence dans la branche active ne certifie pas une purge physique de toutes les sauvegardes.
