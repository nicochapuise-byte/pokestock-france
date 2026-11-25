-- PokéStock France — contrôle de catalogue, lecture seule.
-- À exécuter manuellement sur la branche Neon voulue.
-- IMPORTANT : aucun INSERT / UPDATE / DELETE ; aucune donnée de compte.
-- Auditer séparément development et production avant chaque publication.

-- 1. Vue synthétique (séries, références, images, signalements).
SELECT
  (SELECT count(*) FROM public.catalog_series) AS series_total,
  (SELECT count(*) FROM public.catalog_series WHERE is_active) AS series_active,
  (SELECT count(*) FROM public.catalog_products) AS products_total,
  (SELECT count(*) FROM public.catalog_products WHERE is_active) AS products_active,
  (SELECT count(*) FROM public.catalog_variants) AS variants_total,
  (SELECT count(*) FROM public.catalog_variants WHERE is_active) AS variants_active,
  (SELECT count(*) FROM public.catalog_variants v
       JOIN public.catalog_products p ON p.id=v.product_id
       JOIN public.catalog_series s ON s.id=p.series_id
       WHERE v.is_active AND p.is_active AND s.is_active) AS live_variants,
  (SELECT count(*) FROM public.catalog_variants v
       JOIN public.catalog_products p ON p.id=v.product_id
       JOIN public.catalog_series s ON s.id=p.series_id
       WHERE v.is_active AND p.is_active AND s.is_active
         AND v.image_approved IS TRUE
         AND (v.image_object_key IS NOT NULL OR v.image_url IS NOT NULL)) AS live_variants_with_image_approved,
  (SELECT count(*) FROM public.stock_reports) AS stock_reports_total,
  (SELECT count(*) FROM public.stock_reports
       WHERE status IN ('pending', 'approved') AND expires_at > now()) AS reports_unexpired;

-- 2. Photo réellement manquante, selon l'activation des trois niveaux.
SELECT s.id AS series_id, s.name AS series_name, p.type_key,
       count(*) AS missing_variants
FROM public.catalog_variants v
JOIN public.catalog_products p ON p.id=v.product_id
JOIN public.catalog_series s ON s.id=p.series_id
WHERE v.is_active AND p.is_active AND s.is_active
  AND (v.image_approved IS NOT TRUE
       OR (v.image_object_key IS NULL AND v.image_url IS NULL))
GROUP BY s.id,s.name,p.type_key
ORDER BY missing_variants DESC,s.name,p.type_key;

-- 3. Dates de sortie connues / inconnues.
SELECT count(*) AS series_active,
       count(*) FILTER (WHERE release_date IS NULL) AS series_missing_date,
       count(*) FILTER (WHERE release_date IS NOT NULL) AS series_dated
FROM public.catalog_series WHERE is_active;

-- 4. Photos approuvées par origine déclarée et notes de droits.
SELECT CASE
         WHEN image_object_key LIKE 'pokecardex/%' THEN 'pokecardex'
         WHEN image_object_key LIKE 'external/%' THEN 'external'
         WHEN image_object_key LIKE 'user-uploads/%' THEN 'user-upload'
         WHEN image_object_key IS NOT NULL THEN 'other-storage'
         WHEN image_url IS NOT NULL THEN 'url-only'
         ELSE 'missing'
       END AS storage_origin,
       count(*) AS approved_variants,
       count(*) FILTER (WHERE image_license_note ILIKE '%non vérifi%') AS explicitly_unverified_rights,
       count(*) FILTER (WHERE image_source_url IS NULL) AS missing_image_source_url
FROM public.catalog_variants
WHERE image_approved IS TRUE
GROUP BY 1 ORDER BY approved_variants DESC;

-- 5. Series tests demandées (30e anniversaire / Bienvenue à Kalos).
SELECT s.id, s.name,
       count(DISTINCT p.id) FILTER (WHERE p.is_active) AS products_active,
       count(v.id) FILTER (WHERE v.is_active AND p.is_active) AS variants_active,
       count(v.id) FILTER (
         WHERE v.is_active AND p.is_active
         AND v.image_approved IS TRUE
         AND (v.image_object_key IS NOT NULL OR v.image_url IS NOT NULL)
       ) AS variants_with_approved_images
FROM public.catalog_series s
LEFT JOIN public.catalog_products p ON p.series_id=s.id
LEFT JOIN public.catalog_variants v ON v.product_id=p.id
WHERE s.id IN ('me30','xy0')
GROUP BY s.id,s.name ORDER BY s.name;

-- 6. Volume des signalements par statut et type, sans identité ni localisation.
SELECT status, seller_type,
       count(*) AS reports_total,
       count(*) FILTER (WHERE expires_at > now()) AS reports_unexpired
FROM public.stock_reports
GROUP BY status,seller_type
ORDER BY reports_total DESC,status,seller_type;
