-- Produits et variantes du 30e anniversaire documentés par l'inventaire public PokéCardex.
-- Tous les art sets non explicitement connus restent marqués à identifier.
-- Ne pas prétendre que leurs photographies sont déjà importées.
INSERT INTO public.catalog_products(id,series_id,type_key,name,release_date,source_url) VALUES
('me30-etb','me30','etb','Coffret Dresseur d''élite 30ᵉ Anniversaire','2026-09-16','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-blister-eevee','me30','blister','Blister de 2 boosters Évoli – 30ᵉ Anniversaire','2026-09-16','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-poster','me30','collection','Collection Poster 30ᵉ Anniversaire','2026-09-16','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-coffret-duo','me30','collection','Coffret 30ᵉ Anniversaire – Amphinobi-ex / Nymphali-ex','2026-09-16','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-pokebox-duo','me30','tin','Pokébox 30ᵉ Anniversaire – Amphinobi-ex / Nymphali-ex','2026-09-16','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-bundle','me30','bundle','Lot de 6 boosters 30ᵉ Anniversaire','2026-10-02','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-minitin','me30','mini_tin','Mini-boîtes 30ᵉ Anniversaire','2026-10-02','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-classeur','me30','collection','Collection Classeur 30ᵉ Anniversaire',NULL,'https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-ko','me30','collection','Pack Collection K.O. 30ᵉ Anniversaire',NULL,'https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316')
ON CONFLICT(id) DO NOTHING;

INSERT INTO public.catalog_variants(id,product_id,variant_name,source_url) VALUES
('me30-etb-regular','me30-etb','Standard','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-blister-eevee','me30-blister-eevee','Évoli','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-poster-birds','me30-poster','Artikodin / Électhor / Sulfura','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-coffret-amphinobi','me30-coffret-duo','Amphinobi-ex','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-coffret-nymphali','me30-coffret-duo','Nymphali-ex','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-pokebox-amphinobi','me30-pokebox-duo','Amphinobi-ex','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-pokebox-nymphali','me30-pokebox-duo','Nymphali-ex','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-bundle-standard','me30-bundle','Standard','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-minitin-unspecified','me30-minitin','Art set à identifier','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-classeur-standard','me30-classeur','Standard','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316'),
('me30-ko-unspecified','me30-ko','Art set à vérifier','https://www.pokecardex.com/forums/viewtopic.php?f=64&t=50316')
ON CONFLICT(id) DO NOTHING;
