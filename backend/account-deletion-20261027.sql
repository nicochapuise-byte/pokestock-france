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
