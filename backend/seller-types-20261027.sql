-- Vendeur professionnel ou particulier. Les anciens signalements restent professionnels.
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS seller_type varchar(16) NOT NULL DEFAULT 'professional' CHECK (seller_type IN ('professional','private'));
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS website_url varchar(2048) CHECK (website_url IS NULL OR website_url ~* '^https?://');
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS commune_code varchar(5);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_reports_private_location_only' AND conrelid='public.stock_reports'::regclass) THEN
    ALTER TABLE public.stock_reports ADD CONSTRAINT stock_reports_private_location_only CHECK (seller_type<>'private' OR (store_name='Particulier' AND store_address=city AND website_url IS NULL AND commune_code IS NOT NULL AND commune_code ~ '^[0-9AB]{5}$'));
  END IF;
END $$;
