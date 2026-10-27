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

-- Rôles serveur uniquement : ne JAMAIS accorder de rôle via le JavaScript public.
CREATE TABLE IF NOT EXISTS public.stock_admins (
  user_id text PRIMARY KEY,
  role text NOT NULL DEFAULT 'admin' CHECK (role='admin'),
  granted_at timestamptz NOT NULL DEFAULT now()
);

-- Suppression logique : fiche invisible au public, traçabilité conservée en privé.
CREATE TABLE IF NOT EXISTS public.stock_report_removals (
  report_id uuid PRIMARY KEY REFERENCES public.stock_reports(id) ON DELETE CASCADE,
  removed_by text NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now(),
  reason varchar(240) NOT NULL DEFAULT 'Suppression demandée'
);

-- Historique des corrections par un administrateur.
CREATE TABLE IF NOT EXISTS public.stock_report_edits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.stock_reports(id) ON DELETE CASCADE,
  edited_by text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now(),
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS stock_report_edits_report_idx
  ON public.stock_report_edits (report_id,edited_at DESC);

-- Référentiel produits ; références & art sets indépendants des signalements.
CREATE TABLE IF NOT EXISTS public.catalog_series (
  id varchar(60) PRIMARY KEY,
  name varchar(150) NOT NULL,
  color varchar(9) NOT NULL DEFAULT '#5467A2',
  source_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  block_name varchar(90),
  set_code varchar(25),
  release_date date
);
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id varchar(90) PRIMARY KEY,
  series_id varchar(60) NOT NULL REFERENCES public.catalog_series(id),
  type_key varchar(50) NOT NULL,
  name varchar(180) NOT NULL,
  source_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  release_date date
);
CREATE TABLE IF NOT EXISTS public.catalog_variants (
  id varchar(120) PRIMARY KEY,
  product_id varchar(90) NOT NULL REFERENCES public.catalog_products(id),
  variant_name varchar(120) NOT NULL DEFAULT 'Standard',
  image_url text,
  image_license_note text,
  image_approved boolean NOT NULL DEFAULT false,
  image_object_key text,
  source_url text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0
);
-- Photo de preuve facultative : privée et non publiée dans les fiches.
ALTER TABLE public.stock_reports ALTER COLUMN photo_object_key DROP NOT NULL;
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS catalog_variant_id varchar(120) REFERENCES public.catalog_variants(id);
CREATE INDEX IF NOT EXISTS catalog_products_series_idx ON public.catalog_products(series_id);
CREATE INDEX IF NOT EXISTS catalog_variants_product_idx ON public.catalog_variants(product_id);
CREATE INDEX IF NOT EXISTS stock_reports_catalog_variant_idx ON public.stock_reports(catalog_variant_id);

-- Migration évolutive des bases ayant déjà le catalogue initial.
ALTER TABLE public.catalog_series ADD COLUMN IF NOT EXISTS block_name varchar(90);
ALTER TABLE public.catalog_series ADD COLUMN IF NOT EXISTS set_code varchar(25);
ALTER TABLE public.catalog_series ADD COLUMN IF NOT EXISTS release_date date;
ALTER TABLE public.catalog_products ADD COLUMN IF NOT EXISTS release_date date;
CREATE INDEX IF NOT EXISTS catalog_series_block_idx ON public.catalog_series(block_name,display_order);
CREATE INDEX IF NOT EXISTS catalog_series_release_idx ON public.catalog_series(release_date DESC);

-- Photos de catalogue offertes par les membres : privées en attendant la vérification.
-- La photo de preuve d'un stock reste toujours distincte et privée.
CREATE TABLE IF NOT EXISTS public.catalog_photo_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id varchar(120) NOT NULL REFERENCES public.catalog_variants(id),
  proposed_by text NOT NULL,
  photo_object_key text NOT NULL UNIQUE,
  rights_note varchar(240) NOT NULL,
  status varchar(18) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_photo_proposals_pending_idx
  ON public.catalog_photo_proposals(status,created_at);

-- Traçabilité des images importées depuis des fiches PokéCardex.
-- image_source_url est l'URL de la fiche source, tandis que l'image
-- binaire est hébergée dans le stockage privé 'catalog-images'.
ALTER TABLE public.catalog_variants ADD COLUMN IF NOT EXISTS image_source_url text;
ALTER TABLE public.catalog_variants ADD COLUMN IF NOT EXISTS image_imported_at timestamptz;

-- Vendeur professionnel ou particulier. Les anciens signalements restent professionnels.
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS seller_type varchar(16) NOT NULL DEFAULT 'professional' CHECK (seller_type IN ('professional','private'));
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS website_url varchar(2048) CHECK (website_url IS NULL OR website_url ~* '^https?://');
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS commune_code varchar(5);

-- Autoriser un lien web pour les particuliers sans modifier leur localisation.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='stock_reports_private_location_only_v2' AND conrelid='public.stock_reports'::regclass) THEN
    ALTER TABLE public.stock_reports ADD CONSTRAINT stock_reports_private_location_only_v2 CHECK (seller_type<>'private' OR (store_name='Particulier' AND store_address=city AND commune_code IS NOT NULL AND commune_code ~ '^[0-9AB]{5}$'));
  END IF;
  ALTER TABLE public.stock_reports DROP CONSTRAINT IF EXISTS stock_reports_private_location_only;
END $$;

-- Historique de création conservé ; les nouvelles observations ont leur propre date.
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
UPDATE public.stock_reports SET last_seen_at=created_at WHERE last_seen_at IS NULL;
ALTER TABLE public.stock_reports ALTER COLUMN last_seen_at SET DEFAULT now();
ALTER TABLE public.stock_reports ALTER COLUMN last_seen_at SET NOT NULL;
ALTER TABLE public.stock_reports ADD COLUMN IF NOT EXISTS owner_stock_state varchar(16) NOT NULL DEFAULT 'available' CHECK (owner_stock_state IN ('available','unavailable'));

-- Favoris privés et alertes consultables dans le compte.
CREATE TABLE IF NOT EXISTS public.stock_watches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL,
 variant_id varchar(120) NOT NULL REFERENCES public.catalog_variants(id),
 is_active boolean NOT NULL DEFAULT true,
 alerts_enabled boolean NOT NULL DEFAULT false,
 commune_code varchar(5),city varchar(120),latitude double precision,longitude double precision,
 radius_km integer NOT NULL DEFAULT 50 CHECK(radius_km IN (10,25,50,100,200)),
 created_at timestamptz NOT NULL DEFAULT now(),last_viewed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,variant_id),
 CHECK(NOT alerts_enabled OR (commune_code IS NOT NULL AND city IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS stock_watches_user_active_idx ON public.stock_watches(user_id) WHERE is_active;

-- Demandes de suppression authentifiées, traitement manuel distinct de l’effacement.
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','processing','cancelled')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by text,
 reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS account_deletion_active_idx ON public.account_deletion_requests(requested_at) WHERE status IN ('requested','processing');
