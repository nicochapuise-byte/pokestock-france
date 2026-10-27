-- Short, database-serialized admission of API writes. No account erasure here.
CREATE TABLE IF NOT EXISTS public.account_erasure_control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 blocked boolean NOT NULL DEFAULT false,
 request_id uuid,
 blocked_at timestamptz,
 CHECK ((blocked AND request_id IS NOT NULL) OR (NOT blocked AND request_id IS NULL))
);
INSERT INTO public.account_erasure_control(singleton) VALUES(true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.account_operations (
 id uuid PRIMARY KEY,
 user_id text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS account_operations_active_idx ON public.account_operations(started_at) WHERE finished_at IS NULL;
CREATE INDEX IF NOT EXISTS account_operations_owner_idx ON public.account_operations(user_id);
CREATE TABLE IF NOT EXISTS public.account_uploads (
 bucket text NOT NULL CHECK(bucket IN ('proofs','catalog-images')),
 object_key text NOT NULL CHECK(length(object_key) BETWEEN 1 AND 512),
 user_id text NOT NULL,
 operation_id uuid NOT NULL REFERENCES public.account_operations(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(bucket,object_key)
);
CREATE INDEX IF NOT EXISTS account_uploads_owner_idx ON public.account_uploads(user_id);

CREATE OR REPLACE FUNCTION public.begin_account_operation(p_user text,p_operation uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE AS $$
DECLARE v_blocked boolean;
BEGIN
 SELECT blocked INTO v_blocked FROM public.account_erasure_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR v_blocked THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM neon_auth."user" WHERE id::text=p_user) THEN RETURN false; END IF;
 INSERT INTO public.account_operations(id,user_id) VALUES(p_operation,p_user);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.register_account_upload(p_user text,p_operation uuid,p_bucket text,p_key text) RETURNS boolean
LANGUAGE plpgsql VOLATILE AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.account_operations WHERE id=p_operation AND user_id=p_user AND finished_at IS NULL) THEN RETURN false; END IF;
 INSERT INTO public.account_uploads(bucket,object_key,user_id,operation_id) VALUES(p_bucket,p_key,p_user,p_operation) ON CONFLICT DO NOTHING;
 RETURN EXISTS(SELECT 1 FROM public.account_uploads WHERE bucket=p_bucket AND object_key=p_key AND user_id=p_user AND operation_id=p_operation);
END $$;

-- Blocks admission before counting every writer, including other members/admins
-- who might validate a proposal or modify a report belonging to the target.
CREATE OR REPLACE FUNCTION public.block_account_erasure(p_user text,p_request uuid)
RETURNS TABLE(acquired boolean,active_operations integer) LANGUAGE plpgsql VOLATILE AS $$
DECLARE v_control public.account_erasure_control%ROWTYPE;
BEGIN
 SELECT * INTO v_control FROM public.account_erasure_control WHERE singleton=true FOR UPDATE;
 IF NOT FOUND OR (v_control.blocked AND v_control.request_id<>p_request)
 OR NOT EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE id=p_request AND user_id=p_user AND status='processing')
 OR EXISTS(SELECT 1 FROM public.stock_admins WHERE user_id=p_user) THEN
  RETURN QUERY SELECT false,0; RETURN;
 END IF;
 UPDATE public.account_erasure_control SET blocked=true,request_id=p_request,blocked_at=COALESCE(blocked_at,now()) WHERE singleton=true;
 RETURN QUERY SELECT true,COUNT(*)::integer FROM public.account_operations WHERE finished_at IS NULL;
END $$;

-- Only the backend role uses these functions. No anonymous SQL RPC surface.
REVOKE ALL ON FUNCTION public.begin_account_operation(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_account_upload(text,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_account_erasure(text,uuid) FROM PUBLIC;
