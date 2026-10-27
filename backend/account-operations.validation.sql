DO $$
DECLARE v_user text:='00000000-0000-4000-8000-000000000083'; v_request uuid:='00000000-0000-4000-8000-000000000084'; v_operation uuid:='00000000-0000-4000-8000-000000000085'; v_ok boolean; v_active integer;
BEGIN
 BEGIN
  IF EXISTS(SELECT 1 FROM neon_auth."user" WHERE id::text=v_user) OR EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE user_id=v_user) OR EXISTS(SELECT 1 FROM public.account_operations) OR EXISTS(SELECT 1 FROM public.account_erasure_control WHERE blocked) THEN RAISE EXCEPTION 'Fixture isolation unavailable'; END IF;
  INSERT INTO public.account_deletion_requests(id,user_id,status) VALUES(v_request,v_user,'processing');
  INSERT INTO public.account_operations(id,user_id) VALUES(v_operation,v_user);
  SELECT acquired,active_operations INTO v_ok,v_active FROM public.block_account_erasure(v_user,v_request);
  IF v_ok IS DISTINCT FROM true OR v_active<>1 THEN RAISE EXCEPTION 'Active writer not detected'; END IF;
  IF public.begin_account_operation(v_user,gen_random_uuid()) THEN RAISE EXCEPTION 'Blocked writer admitted'; END IF;
  IF NOT public.register_account_upload(v_user,v_operation,'proofs','reports/rollback-fixture.jpg') THEN RAISE EXCEPTION 'Existing writer upload not inventoried'; END IF;
  IF public.register_account_upload('other',v_operation,'proofs','reports/unowned.jpg') THEN RAISE EXCEPTION 'Ownership was not checked'; END IF;
  UPDATE public.account_operations SET finished_at=now() WHERE id=v_operation;
  SELECT acquired,active_operations INTO v_ok,v_active FROM public.block_account_erasure(v_user,v_request);
  IF v_ok IS DISTINCT FROM true OR v_active<>0 THEN RAISE EXCEPTION 'Finished writer not drained'; END IF;
  IF public.register_account_upload(v_user,v_operation,'proofs','reports/late.jpg') THEN RAISE EXCEPTION 'Finished writer uploaded'; END IF;
  UPDATE public.account_erasure_control SET blocked=false,request_id=NULL,blocked_at=NULL WHERE singleton;
  IF public.begin_account_operation(v_user,gen_random_uuid()) THEN RAISE EXCEPTION 'Missing identity admitted'; END IF;
  RAISE SQLSTATE 'ZX001' USING MESSAGE='Rollback synthetic fixture';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE id=v_request) OR EXISTS(SELECT 1 FROM public.account_operations WHERE id=v_operation) OR EXISTS(SELECT 1 FROM public.account_uploads WHERE user_id=v_user) OR EXISTS(SELECT 1 FROM public.account_erasure_control WHERE blocked) THEN RAISE EXCEPTION 'Fixture was retained'; END IF;
END $$;
