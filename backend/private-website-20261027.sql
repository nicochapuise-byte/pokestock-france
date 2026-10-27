-- Autoriser un lien web pour les particuliers sans modifier leur localisation.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_reports_private_location_only_v2' AND conrelid='public.stock_reports'::regclass) THEN
    ALTER TABLE public.stock_reports ADD CONSTRAINT stock_reports_private_location_only_v2 CHECK (seller_type<>'private' OR (store_name='Particulier' AND store_address=city AND commune_code IS NOT NULL AND commune_code ~ '^[0-9AB]{5}$'));
  END IF;
  ALTER TABLE public.stock_reports DROP CONSTRAINT IF EXISTS stock_reports_private_location_only;
END $$;
