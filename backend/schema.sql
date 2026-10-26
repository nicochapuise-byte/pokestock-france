-- Schéma communautaire de PokéStock France.
-- Créer sur la base dédiée Neon (aucune clé secrète ici).
CREATE TABLE IF NOT EXISTS public.stock_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  store_name varchar(140) NOT NULL,
  store_address varchar(240) NOT NULL,
  city varchar(120) NOT NULL,
  series_id varchar(60) NOT NULL,
  product_name varchar(200) NOT NULL,
  price_eur numeric(8,2) CHECK (price_eur IS NULL OR price_eur >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999),
  latitude double precision NOT NULL CHECK (latitude BETWEEN 41 AND 52),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -6 AND 10),
  photo_object_key text NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours')
);

-- Un seul vote par membre et par signalement. La modification du choix reste possible.
CREATE TABLE IF NOT EXISTS public.stock_votes (
  report_id uuid NOT NULL REFERENCES public.stock_reports(id) ON DELETE CASCADE,
  voter_user_id text NOT NULL,
  verdict varchar(15) NOT NULL CHECK (verdict IN ('available', 'unavailable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, voter_user_id)
);
CREATE INDEX IF NOT EXISTS stock_votes_voter_idx
  ON public.stock_votes (voter_user_id, updated_at DESC);
