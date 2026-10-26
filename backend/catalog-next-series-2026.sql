-- Extension des références PokéCardex au-delà de la série anniversaire :
-- Collection Classeur 151, Boîtier Stratégies et Combats ME01, blisters ME06.
-- Les images seront importées séparément uniquement après vérification de leur attribution.

INSERT INTO public.catalog_products(id,series_id,type_key,name,source_url,release_date) VALUES
('151-binder','151','collection','Collection Classeur 151','https://www.pokecardex.com/forums/viewtopic.php?t=47481','2023-09-22'),
('mega-buildbattle','mega','collection','Boîtier Stratégies et Combats Méga-Évolution','https://www.pokecardex.com/produits/details/996-boitier-strategies-et-combats-mega-evolution','2025-09-26'),
('me06-blister-rayquaza','me06','blister','Blister Booster Règne Delta – Méga-Rayquaza','https://www.pokecardex.com/','2026-11-06'),
('me06-blister-golurk','me06','blister','Blister Booster Règne Delta – Méga-Golemastoc','https://www.pokecardex.com/','2026-11-06'),
('me06-blister-malamar','me06','blister','Blister Booster Règne Delta – Méga-Sépiatroce','https://www.pokecardex.com/','2026-11-06'),
('me06-blister-golisopod','me06','blister','Blister Booster Règne Delta – Méga-Sarmuraï','https://www.pokecardex.com/','2026-11-06')
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.catalog_variants(id,product_id,variant_name,source_url) VALUES
('151-binder-standard','151-binder','Classeur collection 151','https://www.pokecardex.com/forums/viewtopic.php?t=47481'),
('mega-buildbattle-nopromo','mega-buildbattle','Carte promo aléatoire','https://www.pokecardex.com/produits/details/996-boitier-strategies-et-combats-mega-evolution'),
('me06-blister-rayquaza','me06-blister-rayquaza','Méga-Rayquaza','https://www.pokecardex.com/'),
('me06-blister-golurk','me06-blister-golurk','Méga-Golemastoc','https://www.pokecardex.com/'),
('me06-blister-malamar','me06-blister-malamar','Méga-Sépiatroce','https://www.pokecardex.com/'),
('me06-blister-golisopod','me06-blister-golisopod','Méga-Sarmuraï','https://www.pokecardex.com/')
ON CONFLICT(id) DO NOTHING;
