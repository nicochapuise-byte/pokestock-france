-- Références 2026 établies d'après le calendrier détaillé PokéCardex ; datées et avec art sets exacts.
INSERT INTO public.catalog_products (id,series_id,type_key,name,release_date,source_url) VALUES
('art-me025-etb','me025','etb','Coffret Dresseur d''élite Héros Transcendants','2026-02-20','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-minitin','me025','mini_tin','Mini-boîte Héros Transcendants','2026-02-20','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-premium-poster','me025','collection','Collection poster Premium Héros Transcendants','2026-03-20','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-pins','me025','collection','Collection avec pin''s Deluxe Premiers Partenaires','2026-03-20','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-tripack','me04','tripack','Tripack Chaos Ascendant – Reptinciel','2026-05-22','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-bundle','me04','bundle','Lot de 6 boosters Chaos Ascendant','2026-05-22','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-moonlight-tin','me04','tin','Boîte Méga Clair de Lune','2026-06-05','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me05-bundle','me05','bundle','Lot de 6 boosters Nuit Noire','2026-07-17','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me03-halfdisplay','me03','display','Demi-display 18 boosters Équilibre Parfait','2026-03-27','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-halfdisplay','me04','display','Demi-display 18 boosters Chaos Ascendant','2026-05-22','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me05-halfdisplay','me05','display','Demi-display 18 boosters Nuit Noire','2026-07-17','https://www.pokecardex.com/forums/viewtopic.php?t=49894')
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.catalog_variants (id,product_id,variant_name,source_url) VALUES
('art-me025-etb-1','art-me025-etb','Méga-Dracolosse','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-minitin-1','art-me025-minitin','Riolu / Darumarond','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-minitin-2','art-me025-minitin','Mélofée / Germignon','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-minitin-3','art-me025-minitin','Pikachu / Gruikui','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-minitin-4','art-me025-minitin','Togepi / Kaiminus','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-minitin-5','art-me025-minitin','Zorua / Nigosier','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-premium-poster-1','art-me025-premium-poster','Méga-Gardevoir','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-premium-poster-2','art-me025-premium-poster','Méga-Lucario','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me025-pins-1','art-me025-pins','Germignon / Gruikui / Kaiminus','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-tripack-1','art-me04-tripack','Reptinciel','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-bundle-1','art-me04-bundle','Standard','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-moonlight-tin-1','art-me04-moonlight-tin','Méga-Mélodelfe','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-moonlight-tin-2','art-me04-moonlight-tin','Méga-Ectoplasma','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me05-bundle-1','art-me05-bundle','Standard','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me03-halfdisplay-1','art-me03-halfdisplay','Standard','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me04-halfdisplay-1','art-me04-halfdisplay','Standard','https://www.pokecardex.com/forums/viewtopic.php?t=49894'),
('art-me05-halfdisplay-1','art-me05-halfdisplay','Standard','https://www.pokecardex.com/forums/viewtopic.php?t=49894')
ON CONFLICT(id) DO NOTHING;
