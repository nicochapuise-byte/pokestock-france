# PokéStock France — carte communautaire Pokémon

**Site public :** https://nicochapuise-byte.github.io/pokestock-france/

## Architecture

- `index.html`, `styles.css`, `script.js` : interface statique compatible iPhone / Safari.
- `auth-ui.js` : comptes e-mail via Neon Auth, chargé comme module navigateur.
- `backend/index.mjs` : API Node.js 24 déployée sur Neon Functions.
- Neon PostgreSQL : table `public.stock_reports`.
- Neon Object Storage : bucket privé `proofs` pour les photographies.

Il n'y a pas de Next.js, npm, React ou Tailwind à installer pour afficher le site.
Une connexion Internet est nécessaire (fonds OpenStreetMap, adresses IGN, authentification et stocks communautaires).

## Catalogue de références et art sets (octobre 2026)

Catalogue structuré dans PostgreSQL : 125 séries, 271 références / types de produits scellés et 333 variantes et art sets (dont certaines références provisoires indiquées « illustration non précisée ») avec liens vers les fiches sources. Le contenu de démarrage se trouve dans `backend/catalog-seed.sql` et le schéma dans `backend/schema.sql`.

- `GET /catalog` donne les séries, produits, types et art sets actifs.
- Le formulaire choisit successivement **série → type d'article → référence → art set**. Le serveur déduit le nom et la série à partir de la variante sélectionnée et enregistre `stock_reports.catalog_variant_id` ; l'utilisateur ne peut pas injecter un produit inexistant par texte libre.
- Le visuel public est celui du catalogue ; **les photos de preuve envoyées par les utilisateurs restent privées** et ne sont consultables que par les administrateurs via des liens temporaires.
- Une preuve photographique prise en magasin est facultative, mais l'adresse du magasin reste vérifiée et le déclarant doit confirmer avoir vu le produit.
- Les variantes sans photo autorisée affichent `catalog-placeholder.svg`, une illustration neutre créée pour le projet. **Aucune photographie Pokémon protégée n'a été copiée depuis les galeries commerciales sans autorisation**.
- L'administrateur peut ajouter un vrai visuel dans « 🛡️ Admin → Images du catalogue » en attestant disposer du droit de publication et en précisant son origine. Les images sont stockées dans un bucket privé séparé `catalog-images`, et exposées avec des liens de consultation temporaires. Le référentiel offre des liens sortants vers les fiches produit pour vérification.
- Le catalogue est volontairement partiel : art sets additionnels, EAN, langues d'édition, dates et éventuelles autorisations de reproduction restent à compléter.

**Références officielles utilisées pour la sélection** : galeries produits Pokémon en français, annonces éditeur Évolutions Prismatiques (mini-boîtes Aquali, Voltali, Pyroli, Mentali, Noctali, Phyllali, Givrali, Nymphali) et présentation Méga-Évolution. Les liens sont conservés produit par produit.


Les variantes de boosters supplémentaires (Écarlate et Violet, Méga-Évolution, Évolutions Prismatiques, Destinées de Paldea, Foudre Noire et Flamme Blanche) ont été complétées d'après une galerie de référence de visuels de boosters. Aucune image de ces pages n'est réhébergée sans licence.

## Extension historique du catalogue (26 octobre 2026)

Source principale : **PokéCardex**, [catalogue des séries](https://www.pokecardex.com/series) et [catalogue des produits](https://www.pokecardex.com/produits), complétés par son [calendrier des sorties 2026](https://www.pokecardex.com/forums/viewtopic.php?t=49894).

- Séries regroupées par bloc : Méga-Évolution, Écarlate et Violet, Épée et Bouclier, Soleil et Lune, XY, Noir et Blanc, HeartGold SoulSilver, Platine, Diamant et Perle, EX et classiques Wizards.
- Une **série de cartes n'est pas un article scellé** : chaque série est une entité distincte, associée à ses références de booster, ETB, display et coffrets lorsqu'elles ont été documentées ; une catégorie générique peut présenter « modèle / illustration non précisé(e) » pour éviter d'inventer un art set précis.
- Variantes identifiées avec leur illustration exacte pour les boosters ME03, ME04, ME05, ME06 ; mini-boîtes Héros Transcendants et Illumis ; collections spéciales et packs documentés en 2026.
- Filtres de carte repliables par bloc, recherche par nom ou code, formulaire série → type → article → variante avec recherche de série. Les nouveautés non sorties sont visibles comme **🔜** mais ne peuvent pas être signalées ; date contrôlée par le serveur, par exemple **Règne Delta** annoncé pour le 6 novembre 2026.
- Les **333 variantes** incluent des choix génériques « Art set non précisé » quand aucune donnée sûre n'a été recensée. Ce nombre ne signifie pas que 333 photographies sont disponibles.
- PokéCardex n'annonce pas d'API publique pour son catalogue : il ne s'agit **pas d'une synchronisation officielle automatique**, mais d'une première importation documentée. Ne pas réhéberger leurs visuels ou images Pokémon sans autorisation.
- Scripts idempotents : `backend/catalog-expanded-series-2026.sql`, `backend/catalog-expanded-products-2026.sql`, `backend/catalog-expanded-artsets-2026.sql`, `backend/catalog-confirmed-products-2026.sql`. Les six séries initiales et les signalements existants ont été préservés.

## Gestion des images pour toutes les séries (26 octobre 2026)

Le travail sur les images n'est **pas limité à 30ᵉ Anniversaire** : l'administration compte les références dans **tous les blocs d'extensions** et permet de traiter les 125 séries présentes en base.

- **Photothèque → Avancement des photos pour toutes les séries** : 125 extensions, progression par série, compteur de visuels enregistrés, filtre pour retrouver directement les références sans photo, 30ᵉ Anniversaire épinglé en premier.
- **Depuis PokéCardex → Traiter plusieurs fiches** : 1 à 6 URL PokéCardex par analyse, extraction côté serveur des visuels candidats. L'administrateur vérifie chaque fiche et choisit explicitement l'**art set correspondant** avant importation dans le stockage privé Neon.
- L'accès aux outils d'inspection et au tableau de couverture est protégé côté serveur par une session valide et un rôle administrateur : `GET /admin/catalog/coverage` et `POST /admin/catalog/pokecardex/bulk-candidates`. Les photos déjà validées ne sont jamais écrasées par l'inspection.
- Références scellées supplémentaires intégrées hors série anniversaire : **Collection Classeur 151**, **Boîtier Stratégies et Combats Méga-Évolution**, et **quatre blisters distincts Règne Delta** (les dernières références sont à venir et ne sont pas signalables avant leur date).
- En date de cette modification : **125 séries, 286 produits et 350 variantes**, dont **8 avec images approuvées**. Les 342 autres variantes restent à illustrer. Les données préexistantes et la liste des photos déjà enregistrées sont préservées.

**Limite réelle :** PokéCardex a confirmé qu'il ne met pas à disposition d'API officielle. Sa page produit peut charger des images dynamiquement et refuser les robots. La fonction de découverte est donc volontairement bornée à 6 fiches explicites par requête ; ce n'est pas un système qui a déjà photographié, téléchargé ou validé les milliers de produits de PokéCardex. Ne jamais promettre une couverture intégrale sans vérifier dans `catalog_variants.image_approved`.

## Importer des photographies depuis PokéCardex

L'onglet **« 🌐 Depuis PokéCardex »** de `admin.html` permet, pour un art set précis, de récupérer les images d'une page de **produit** de PokéCardex (`https://www.pokecardex.com/produits`) ou de son URL image directe. Les images des cartes de `/series` ne représentent pas nécessairement les produits scellés (booster, coffret, ETB).

1. Choisir la variante PokéStock, puis coller l'URL HTTPS de sa fiche produit PokéCardex.
2. Le serveur (compte administrateur vérifié) examine les balises images de la page et propose des vignettes. La source ne fournit pas nécessairement de vignettes si les images sont chargées dynamiquement ou si le site refuse les requêtes automatiques.
3. Vérifier visuellement la correspondance **produit / art set**, sélectionner une vignette, indiquer la provenance et confirmer les droits de réutilisation.
4. Le serveur importe les octets (JPEG, PNG, WebP, GIF, max 2,6 Mo), les stocke dans `catalog-images` et inscrit l'image principale, la page source et l'horodatage dans `catalog_variants` (`image_object_key`, `image_source_url`, `image_imported_at`).
5. Cette même photo validée est alors utilisée automatiquement dans le formulaire, les fiches et les popups de la carte.

**Important :** le catalogue PokéCardex n'est pas une API publique documentée et ses pages `/series` et `/produits` ne sont pas toutes accessibles par les outils de consultation de cet environnement. Il n'a pas été possible de recopier automatiquement le catalogue photographique complet. L'importation doit être effectuée via l'interface admin, image par image, après vérification de chaque association et des droits. Ne pas annoncer de photos supplémentaires tant que la colonne `image_source_url` est vide.

Le serveur limite les URL aux domaines contrôlés de PokéCardex et bloque les redirections hors domaine, les formats inattendus et les images trop volumineuses. Les justificatifs de droits sont renseignés par l'administrateur.

## Photographies manquantes : ajout par lots et modération (26 octobre 2026)

Couverture actuelle contrôlée en base : **1 photographie réelle validée pour 333 variantes**, celle du coffret Ultra-Premium 151 transmise par le responsable du projet (`catalog-upc151-chat.svg`). Les autres références affichent un visuel générique clairement signalé ; elles ne doivent pas être annoncées comme photographiées.

- **Administration → Images du catalogue → Couverture** : compteur, progression, filtres « manquantes / toutes / avec photo » et recherche. Chaque art set donne accès à son bouton « Ajouter ».
- **Import groupé** : sélection de 25 photographies maximum, identification automatique lorsque le nom du fichier **correspond exactement à l'identifiant de l'art set** (ex. `151-upc-mew.jpg`), association manuelle si le nom ne correspond pas, avertissement sur les doublons et possibilité explicite de remplacer un visuel déjà validé.
- L'import groupé demande une **attestation de droits pour tout le lot**, compresse les images avant envoi et utilise l'API administrateur protégée. Les images approuvées s'affichent automatiquement sur le catalogue, la carte et les fiches de disponibilité.
- **Contributions communautaires** : lorsqu'un membre sélectionne une référence sans photo, il peut proposer une photographie de l'article accompagnée de son origine/autorisation. Elle reste privée jusqu'à vérification. Le contributeur ne peut publier directement dans le catalogue.
- **Modération** : sous « Photos proposées par la communauté », un administrateur peut voir les photos et informations fournies, les refuser ou les approuver. Une photo approuvée remplace la vignette indicative.
- Endpoint public `GET /catalog` et contrôles d'accès serveur sur `POST /catalog/photo-proposals`, `GET /admin/catalog/photo-proposals`, `POST /admin/catalog/photo-proposals/:id/review` et `POST /admin/catalog/variants/:id/image`. Les propositions sont plafonnées à 5 par compte et par 24 heures.
- La proposition et la preuve photo de stock sont **deux fichiers distincts** ; une preuve privée ne devient jamais publique sans nouvelle autorisation explicite. Les images provenant de PokéCardex ou d'autres magasins ne sont pas aspirées sans droit de réutilisation.
- Le schéma table `public.catalog_photo_proposals` est conservé dans `backend/schema.sql`.

La syntaxe JS, la base de données et le déploiement backend ont été vérifiés. Il reste à valider le parcours d'import groupé et la modération depuis Safari/iPhone avec de vraies images autorisées.

## Signalement d'un stock

1. Choisir la série, le type de produit, le produit et la variante/art set.
2. Renseigner magasin, ville, prix, quantité et adresse complète, puis **sélectionner une adresse validée**.
3. Si souhaité, ajouter une photo du rayon qui sera **visible uniquement par l'équipe de modération**.
4. Confirmer l'observation en magasin, se connecter et publier.
5. La fiche du site affiche la référence canonique, son art set, le visuel approuvé du catalogue (ou une illustration indicative) et le statut « non vérifié ». Les signalements expirent après 72 heures.


## Démonstration

Les six points préchargés sont fictifs et clairement signalés. Les signalements éventuellement sauvegardés dans les anciennes versions demeurent sur leur navigateur d'origine. La version communautaire utilise une base de données partagée.

## Confirmations de stock et réputation (version communautaire)

- Chaque compte connecté peut voter **une fois par signalement** : `✅ Disponible` ou `❌ Rupture de stock`. Le choix peut ensuite être modifié et remplace le précédent, sans ajouter de second vote.
- Le créateur ne peut pas voter sur son propre signalement. Une limite de 30 nouveaux votes par jour est appliquée par compte.
- Un signalement reste **non vérifié** tant qu'il n'y a pas de majorité et **au moins deux voix indépendantes** du même côté. Les états sont dérivés des votes, non d'une garantie réelle d'inventaire.
- Le statut « rupture signalée » n'efface pas la fiche : il rend l'information visible aux visiteurs pendant la validité du signalement (72 heures).
- L'espace « Mon compte » affiche une réputation indicative calculée sur 90 jours : **10 points par signalement soutenu par au moins 2 confirmations majoritaires** et **1 point par avis concordant avec au moins deux autres membres**. Les scores ne prouvent pas la fiabilité.
- Les votes de test sont à réaliser depuis un **autre compte légitime**, car un auteur ne peut pas confirmer sa propre publication.
- Les données sont stockées dans `public.stock_votes`, avec une contrainte `PRIMARY KEY(report_id,voter_user_id)`. Le script de structure est dans `backend/schema.sql`.

## État des tests

La migration SQL, la syntaxe du JavaScript et le déploiement Neon Function ont été vérifiés. Les appels HTTP authentifiés de vote et l'ergonomie Safari nécessitent encore une validation réelle avec des comptes distincts. Les deux signalements de test préexistants ont été conservés sans suppression.

## Nouvel espace administrateur dédié (26 octobre 2026)

L'administrateur est désormais accessible depuis le bouton **🛡️ Admin** et ouvre la **page séparée `admin.html`** plutôt que le grand panneau multifonction :

- **Photothèque** : galerie responsive de toutes les références, recherche, filtre par série et par état « avec/sans photo », sélection directe d'un art set, progression des images enregistrées.
- **Ajouter une photo** : série → article → art set, aperçu comparatif actuel/nouvel article, ajout ou remplacement du visuel principal avec attestation des droits.
- **Import multiple** : jusqu'à 25 fichiers, reconnaissance possible du nom de fichier `id-de-la-variante.jpg`, confirmation visuelle des associations, contrôle des doublons, limitation des remplacements accidentels.
- **Photos proposées** : modération des images soumises par les membres, avec autorisation et référence à vérifier.
- **Signalements** : lien de retour vers `index.html#administration` pour l'ancien écran de gestion des magasins, désormais allégé de la photothèque.

Le serveur contrôle les JWT et le rôle depuis `public.stock_admins` pour chaque opération. Le JavaScript côté navigateur n'accorde aucun privilège.

## Classement par sortie des séries Pokémon

Depuis le 26 octobre 2026, l'API `GET /catalog` renvoie les séries **par date de sortie décroissante**, avec **30ᵉ Anniversaire (16 septembre 2026) en première position**, comme demandé. Les sorties non encore disponibles (par exemple Règne Delta, sortie générale prévue le 6 novembre 2026) se placent à la fin et restent non signalables avant leur date.

La date connue figure dans le menu de sélection des extensions et les filtres. Les anciennes séries dont nous ne disposons pas encore de date fiable sont classées en utilisant leur ordre historique déjà enregistré (`display_order`) et non à partir de dates inventées.

## Suppression par l'auteur et modération administrateur (octobre 2026)

- `moderation.js` ajoute **Supprimer mon signalement** sous les référencements de l'utilisateur connecté. Après confirmation, le serveur vérifie que le JWT appartient réellement à l'auteur ; une personne ne peut pas supprimer les fiches d'un autre utilisateur.
- Un administrateur, nommé via la table privée `public.stock_admins`, dispose d'un bouton **🛡️ Admin** en haut du site. Le rôle n'est jamais attribuable depuis le navigateur.
- L'administrateur peut voir les 150 derniers référencements, rechercher par magasin/produit/ville, **modifier** magasin, produit, série, prix, quantité, adresse vérifiée, statut (non vérifié, approuvé, refusé), et **retirer** n'importe quelle annonce.
- Des vérifications d'autorisation côté serveur sont effectuées pour `GET /me/role`, `GET /me/reports`, `GET /admin/reports`, `PATCH /admin/reports/:id` et `DELETE /reports/:id`.
- Les suppressions sont **logiques** : elles font disparaître immédiatement une fiche de la carte et de la recherche, mais gardent son enregistrement et sa photo dans le stockage privé pour permettre un contrôle de modération. Il reste à ajouter une politique de conservation et une purge de données/photos pour les demandes d'effacement définitif.
- Les corrections d'administrateur disposent d'un historique `public.stock_report_edits`.
- Les signalements existants n'ont pas été supprimés lors de la mise en place.
- Contrôles effectués : migration SQL, attribution du rôle au compte déjà utilisé pour le test, validation statique des scripts et déploiement Neon. Il reste à tester l'expérience de suppression et de modification de bout en bout sur iPhone.

## Administration et sécurité

Ne **jamais** enregistrer de mot de passe PostgreSQL, de secret S3 ou de clé API Neon dans le dépôt GitHub ou dans du JavaScript côté navigateur. Neon les fournit uniquement à la fonction serveur. L'administrateur devra ajouter une interface de modération, une politique d'abus et de confidentialité avant un lancement public à grande échelle.

Projet indépendant et non affilié à Nintendo, Game Freak ou The Pokémon Company.
