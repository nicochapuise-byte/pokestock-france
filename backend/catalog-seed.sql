-- Références produit documentées à partir des galeries officielles.
-- Les images produit protégées ne sont PAS copiées ni affichées sans autorisation.
-- image_url est volontairement NULL, image_approved=false par défaut.

INSERT INTO public.catalog_series (id,name,color,source_url,display_order) VALUES
('ev','Écarlate et Violet','#ef3340','https://www.pokemon.com/fr/jcc-pokemon/cartes-pokemon','1'),
('151','Écarlate et Violet – 151','#7357e6','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','2'),
('prism','Évolutions Prismatiques','#2968e8','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','3'),
('paldea','Destinées de Paldea','#27b36a','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/boite-ecarlate-et-violet-destinees-de-paldea','4'),
('blackwhite','Foudre Noire / Flamme Blanche','#222a3d','https://www.pokemon.com/fr/jcc-pokemon/cartes-pokemon','5'),
('mega','Méga-Évolution','#ff9f2f','https://www.pokemon.com/fr/actualites/presentation-des-produits-mega-evolution-du-jcc-pokemon','6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.catalog_products (id,series_id,type_key,name,source_url,display_order) VALUES
('ev-booster','ev','booster','Booster Écarlate et Violet',NULL,'1'),
('151-booster','151','booster','Booster 151','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','1'),
('151-etb','151','etb','Coffret Dresseur d’élite 151','https://www.pokemon.com/us/pokemon-tcg/scarlet-violet-151','2'),
('151-bundle','151','bundle','Lot de 6 boosters 151','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','3'),
('151-upc','151','upc','Collection Ultra-Premium 151','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','4'),
('151-minitin','151','mini_tin','Mini-boîte 151','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','5'),
('151-poster','151','collection','Collection poster 151','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','6'),
('151-alakazam','151','collection','Collection Alakazam-ex 151','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','7'),
('151-zapdos','151','collection','Collection Électhor-ex 151','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','8'),
('prism-etb','prism','etb','Coffret Dresseur d’élite Évolutions Prismatiques','https://www.pokemon.com/uk/pokemon-tcg/product-gallery/scarlet-violet-prismatic-evolutions-elite-trainer-box','1'),
('prism-minitin','prism','mini_tin','Mini-boîte Évolutions Prismatiques','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','2'),
('prism-sticker','prism','collection','Collection autocollant réajustable','https://the-pokemon-company-international.prezly.com/lextension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-est-disponible-maintenant-et-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal','3'),
('prism-bundle','prism','bundle','Lot de 6 boosters Évolutions Prismatiques','https://the-pokemon-company-international.prezly.com/la-nouvelle-extension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal-stellaire','4'),
('prism-surprise','prism','tin','Boîte surprise Évolutions Prismatiques','https://the-pokemon-company-international.prezly.com/la-nouvelle-extension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal-stellaire','5'),
('paldea-tin','paldea','tin','Boîte Destinées de Paldea','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/boite-ecarlate-et-violet-destinees-de-paldea','1'),
('mega-etb','mega','etb','Coffret Dresseur d’élite Méga-Évolution','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/coffret-dresseur-delite-mega-evolution','1'),
('mega-bundle','mega','bundle','Lot de 6 boosters Méga-Évolution','https://www.pokemon.com/fr/actualites/presentation-des-produits-mega-evolution-du-jcc-pokemon','2'),
('mega-booster','mega','booster','Booster Méga-Évolution','https://www.pokemon.com/fr/actualites/presentation-des-produits-mega-evolution-du-jcc-pokemon','3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.catalog_variants (id,product_id,variant_name,source_url,display_order) VALUES
('ev-booster-standard','ev-booster','Visuel à préciser',NULL,'1'),
('151-booster-mew','151-booster','Mew','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','2'),
('151-etb-snorlax','151-etb','Ronflex (standard)','https://www.pokemon.com/us/pokemon-tcg/scarlet-violet-151','3'),
('151-bundle-standard','151-bundle','Standard','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','4'),
('151-upc-mew','151-upc','Mew','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','5'),
('151-minitin-variable','151-minitin','Modèle à préciser','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','6'),
('151-poster-standard','151-poster','Standard','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','7'),
('151-alakazam-standard','151-alakazam','Alakazam-ex','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','8'),
('151-zapdos-standard','151-zapdos','Électhor-ex','https://www.pokemon.com/fr/jcc-pokemon/ecarlate-et-violet-151/','9'),
('prism-etb-eevee','prism-etb','Évoli (standard)','https://www.pokemon.com/uk/pokemon-tcg/product-gallery/scarlet-violet-prismatic-evolutions-elite-trainer-box','10'),
('prism-minitin-aquali','prism-minitin','Aquali','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','11'),
('prism-minitin-voltali','prism-minitin','Voltali','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','12'),
('prism-minitin-pyroli','prism-minitin','Pyroli','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','13'),
('prism-minitin-mentali','prism-minitin','Mentali','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','14'),
('prism-minitin-noctali','prism-minitin','Noctali','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','15'),
('prism-minitin-phyllali','prism-minitin','Phyllali','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','16'),
('prism-minitin-givrali','prism-minitin','Givrali','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','17'),
('prism-minitin-nymphali','prism-minitin','Nymphali','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/mini-boite-ecarlate-et-violet-evolutions-prismatiques','18'),
('prism-sticker-phyllali','prism-sticker','Phyllali','https://the-pokemon-company-international.prezly.com/lextension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-est-disponible-maintenant-et-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal','19'),
('prism-sticker-givrali','prism-sticker','Givrali','https://the-pokemon-company-international.prezly.com/lextension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-est-disponible-maintenant-et-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal','20'),
('prism-sticker-nymphali','prism-sticker','Nymphali','https://the-pokemon-company-international.prezly.com/lextension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-est-disponible-maintenant-et-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal','21'),
('prism-bundle-standard','prism-bundle','Standard','https://the-pokemon-company-international.prezly.com/la-nouvelle-extension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal-stellaire','22'),
('prism-surprise-mystere','prism-surprise','Promo aléatoire (non garantie)','https://the-pokemon-company-international.prezly.com/la-nouvelle-extension-du-jeu-de-cartes-a-collectionner-pokemon-ecarlate-et-violet-evolutions-prismatiques-met-a-lhonneur-evoli-et-ses-evolutions-en-tant-que-pokemon-ex-teracristal-stellaire','23'),
('paldea-tin-fort-ivoire','paldea-tin','Fort-Ivoire-ex chromatique','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/boite-ecarlate-et-violet-destinees-de-paldea','24'),
('paldea-tin-roue-de-fer','paldea-tin','Roue-de-Fer-ex chromatique','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/boite-ecarlate-et-violet-destinees-de-paldea','25'),
('paldea-tin-dracaufeu','paldea-tin','Dracaufeu-ex chromatique','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/boite-ecarlate-et-violet-destinees-de-paldea','26'),
('mega-etb-riolu','mega-etb','Riolu','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/coffret-dresseur-delite-mega-evolution','27'),
('mega-etb-alakazam','mega-etb','Alakazam','https://www.pokemon.com/fr/jcc-pokemon/galerie-produits/coffret-dresseur-delite-mega-evolution','28'),
('mega-bundle-standard','mega-bundle','Standard','https://www.pokemon.com/fr/actualites/presentation-des-produits-mega-evolution-du-jcc-pokemon','29'),
('mega-booster-variable','mega-booster','Visuel à préciser','https://www.pokemon.com/fr/actualites/presentation-des-produits-mega-evolution-du-jcc-pokemon','30')
ON CONFLICT (id) DO NOTHING;
