# Dossier de préparation des stores — brouillon non soumis

## Proposition de fiche

Nom : **PokéStock France**

Sous-titre Apple : **Les stocks près de chez vous**

Description courte Google : **Repérez les produits Pokémon signalés disponibles près de chez vous.**

Description :

Retrouvez les produits Pokémon signalés disponibles par la communauté. Consultez la carte, filtrez par série et découvrez les observations récentes autour d’une commune.

Partagez une disponibilité avec une photo, précisez le prix et la quantité observée, puis actualisez votre signalement lorsque le stock change. Professionnels et particuliers disposent de profils distincts ; pour les particuliers, seule la commune est affichée.

Enregistrez vos références favorites et consultez, dans l’application, les signalements qui correspondent à votre recherche. Une disponibilité peut changer : vérifiez auprès du vendeur avant de vous déplacer.

PokéStock est un projet communautaire indépendant. Les droits sur les marques et illustrations doivent être vérifiés avant diffusion. Ne pas publier cette fiche avant validation des fonctions sur téléphone.

## Champs à finaliser avec l’éditeur

- Identité légale et coordonnées de support réelles.
- URL publique de confidentialité et chemin de suppression de compte fonctionnels.
- Identifiants définitifs iOS/Android, droits et nom disponibles.
- Déclarations Apple App Privacy / Google Data Safety : compte (e-mail/pseudo), position à la demande, commune et localisation du point de vente, contenus/photos des signalements, favoris et votes. Vérifier le traitement exact des SDK et des métadonnées de photo avant de répondre aux formulaires. Aucune déclaration « aucune donnée collectée » par défaut.
- Classement d’âge et modalités de modération, signalement d’abus et blocage.
- Compte de test pour la revue (à créer séparément, sans credentials dans Git).
- Visuels de boutique réalisés à partir des builds réels : carte, signalement, favoris, profil vendeur. Pas de captures de navigateur présentées comme des captures natives.

## Photo native — ajout 0.3.0

Les boutons caméra/photothèque et le retrait de la preuve sont intégrés. La caméra est sollicitée après un appui volontaire ; pas de sauvegarde automatique en photothèque ni de permission de stockage Android étendue. La preuve reste envoyée uniquement lors de la publication explicite, vers le stockage privé existant. Ces éléments sont couverts par des tests simulés ; ils doivent encore être vérifiés sur appareils réels.

## Critères pour passer de préparation à test privé

- [ ] Authentification native fonctionnelle et session persistante ; déconnexion complète.
- [ ] API de développement vérifiée depuis les origines natives, sans modification globale des accès.
- [ ] GPS accepté/refusé et localisation approximative testés.
- [ ] Photo caméra/photothèque, compression et preuve privée testées.
- [ ] Signalement créé, relu, modifié et expiré correctement.
- [ ] Adresse privée jamais publiée, même après édition/modération.
- [ ] Favoris et correspondances retrouvés après reconnexion.
- [ ] Suppression de compte et des données associées disponible.
- [ ] Confidentialité, support, abus et blocage disponibles.
- [ ] Compilations Android et iOS exécutées, puis installations sur appareils.
- [ ] Signature et comptes développeur configurés par l’éditeur.

Aucun élément ci-dessus n’est présumé validé par la seule création des projets natifs.
