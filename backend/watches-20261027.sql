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
