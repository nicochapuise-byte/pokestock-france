-- Historique de création conservé ; les nouvelles observations ont leur propre date.
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
UPDATE public.stock_reports SET last_seen_at=created_at WHERE last_seen_at IS NULL;
ALTER TABLE public.stock_reports ALTER COLUMN last_seen_at SET DEFAULT now();
ALTER TABLE public.stock_reports ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS owner_stock_state varchar(16) NOT NULL DEFAULT 'available' CHECK (owner_stock_state IN ('available','unavailable'));
