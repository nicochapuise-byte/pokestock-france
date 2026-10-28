-- Durable, private receipts. User identity is cleared on verified completion.
CREATE TABLE IF NOT EXISTS public.account_erasure_jobs (
 request_id uuid PRIMARY KEY,
 user_id text UNIQUE,
 receipt_hash text NOT NULL CHECK(receipt_hash ~ '^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','running','failed','completed')),
 stage text NOT NULL DEFAULT 'prepared' CHECK(stage IN ('prepared','identity_attempted','identity_removed','files_verified','completed')),
 worker_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK ((state='completed' AND user_id IS NULL AND completed_at IS NOT NULL) OR (state<>'completed' AND user_id IS NOT NULL))
);
