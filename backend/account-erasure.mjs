import {createHash} from 'node:crypto';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const ERASURE_COUNTS_SQL=`SELECT
 (SELECT COUNT(*)::int FROM public.stock_reports WHERE user_id=$1) AS reports,
 (SELECT COUNT(DISTINCT photo_object_key)::int FROM public.stock_reports WHERE user_id=$1 AND photo_object_key IS NOT NULL) AS proof_photos,
 (SELECT COUNT(*)::int FROM public.stock_votes v WHERE voter_user_id=$1 OR EXISTS(SELECT 1 FROM public.stock_reports r WHERE r.id=v.report_id AND r.user_id=$1)) AS votes,
 (SELECT COUNT(*)::int FROM public.stock_watches WHERE user_id=$1) AS watches,
 (SELECT COUNT(*)::int FROM public.catalog_photo_proposals WHERE proposed_by=$1) AS proposals,
 (SELECT COUNT(*)::int FROM public.catalog_variants WHERE image_object_key IN(SELECT photo_object_key FROM public.catalog_photo_proposals WHERE proposed_by=$1)) AS catalogue_references,
 (SELECT COUNT(*)::int FROM public.stock_report_edits e WHERE edited_by=$1 OR EXISTS(SELECT 1 FROM public.stock_reports r WHERE r.id=e.report_id AND r.user_id=$1) OR POSITION($1 IN old_values::text)>0 OR POSITION($1 IN new_values::text)>0) AS edit_records,
 (SELECT COUNT(*)::int FROM public.stock_report_removals d WHERE removed_by=$1 OR EXISTS(SELECT 1 FROM public.stock_reports r WHERE r.id=d.report_id AND r.user_id=$1)) AS removal_records,
 (SELECT COUNT(*)::int FROM public.catalog_photo_proposals WHERE reviewed_by=$1 AND proposed_by<>$1) AS review_attributions,
 (SELECT COUNT(*)::int FROM public.account_deletion_requests WHERE user_id=$1) AS deletion_requests,
 (SELECT COUNT(*)::int FROM public.stock_admins WHERE user_id=$1) AS admin_roles,
 (SELECT COUNT(*)::int FROM public.account_operations WHERE user_id=$1) AS operation_records,
 (SELECT COUNT(*)::int FROM public.account_operations WHERE user_id=$1 AND finished_at IS NULL) AS active_operations,
 (SELECT COUNT(*)::int FROM public.account_uploads WHERE user_id=$1) AS upload_records`;
export const ERASURE_OBJECTS_SQL=`SELECT objects.bucket,objects.key,
 EXISTS(SELECT 1 FROM public.account_uploads u WHERE u.bucket=objects.bucket AND u.object_key=objects.key AND u.user_id<>$1)
 OR (objects.bucket='proofs' AND EXISTS(SELECT 1 FROM public.stock_reports r WHERE r.photo_object_key=objects.key AND r.user_id<>$1))
 OR (objects.bucket='catalog-images' AND EXISTS(SELECT 1 FROM public.catalog_photo_proposals p WHERE p.photo_object_key=objects.key AND p.proposed_by<>$1))
 OR (objects.bucket='catalog-images' AND EXISTS(SELECT 1 FROM public.catalog_variants v WHERE v.image_object_key=objects.key) AND NOT EXISTS(SELECT 1 FROM public.catalog_photo_proposals p WHERE p.photo_object_key=objects.key AND p.proposed_by=$1)) AS shared
 FROM (
 SELECT 'proofs'::text AS bucket,photo_object_key AS key FROM public.stock_reports WHERE user_id=$1 AND photo_object_key IS NOT NULL
 UNION SELECT 'catalog-images'::text AS bucket,photo_object_key AS key FROM public.catalog_photo_proposals WHERE proposed_by=$1
 UNION SELECT bucket,object_key AS key FROM public.account_uploads WHERE user_id=$1
 ) objects ORDER BY objects.bucket,objects.key`;
export const COUNT_KEYS=['reports','proof_photos','votes','watches','proposals','catalogue_references','edit_records','removal_records','review_attributions','deletion_requests','admin_roles','operation_records','active_operations','upload_records'];
function checkedCounts(row){
 if(!row||COUNT_KEYS.some(key=>!Object.hasOwn(row,key)||row[key]===null||row[key]===''||typeof row[key]==='boolean'||!Number.isSafeInteger(Number(row[key]))||Number(row[key])<0))throw Error('Inventaire incomplet.');
 return Object.fromEntries(COUNT_KEYS.map(key=>[key,Number(row[key])]));
}
function digestPlan(plan){const {fingerprint,...data}=plan;return createHash('sha256').update(JSON.stringify(data)).digest('hex');}
export async function readErasurePlan(sql,requestId){
 if(!uuid(requestId))throw Object.assign(Error('Référence de demande invalide.'),{status:400});
 const rows=await sql('SELECT d.id,d.user_id,d.status,EXISTS(SELECT 1 FROM neon_auth."user" u WHERE u.id::text=d.user_id) AS identity_present FROM public.account_deletion_requests d WHERE d.id=$1::uuid LIMIT 1',[requestId]);
 const request=rows[0];if(!request)throw Object.assign(Error('Demande introuvable.'),{status:404});
 if(!uuid(request.user_id))throw Object.assign(Error('Identifiant de compte à vérifier manuellement.'),{status:409});
 const countsRows=await sql(ERASURE_COUNTS_SQL,[request.user_id]);
 const objects=await sql(ERASURE_OBJECTS_SQL,[request.user_id]);
 const counts=checkedCounts(countsRows[0]);
 if(typeof request.identity_present!=='boolean')throw Error('État d’identité indisponible.');
 const blocked=[];
 if(request.status!=='processing')blocked.push('La demande doit être prise en charge avant tout effacement.');
 if(counts.active_operations)blocked.push('Des écritures du compte sont encore en cours. Actualisez après leur fin.');
 if(counts.admin_roles)blocked.push('Compte administrateur : transfert des responsabilités et vérification manuelle nécessaires.');
 for(const object of objects){
  if(!['proofs','catalog-images'].includes(object.bucket)||typeof object.key!=='string'||! /^[A-Za-z0-9_./-]{1,512}$/.test(object.key)||object.key.startsWith('/')||object.key.includes('..'))blocked.push('Une référence de fichier doit être vérifiée manuellement.');
  if(object.shared)blocked.push('Un fichier possède une référence attribuée à un autre compte.');
 }
 const plan={requestId:request.id,userId:request.user_id,status:request.status,identityPresent:request.identity_present===true,counts,objects,blocked:[...new Set(blocked)]};
 plan.fingerprint=digestPlan(plan);
 return plan;
}
export function publicErasurePreview(plan){
 return {requestId:plan.requestId,mode:'preview-only',identityPresent:plan.identityPresent,counts:plan.counts,files:plan.objects.length,blocked:plan.blocked,fingerprint:plan.fingerprint,executable:false};
}
// Execution is intentionally not connected to an HTTP route. Real adapters must be
// reviewed, configured and tested with a disposable identity before activation.
// The lock must quiesce existing writes and prevent new writes for this identity;
// release must preserve retirement after identity removal, including old JWTs.
export async function executeErasure(plan,adapters,{confirmation,fingerprint}={}){
 if(confirmation!==`EFFACER ${plan.requestId}`||fingerprint!==plan.fingerprint||digestPlan(plan)!==plan.fingerprint)throw Error('Confirmation ou inventaire périmé.');
 if(plan.blocked.length)throw Error('Une vérification manuelle bloque cet effacement.');
 const required=['lock','refresh','removeIdentity','identityExists','deleteObject','objectExists','purgeRows','verifyEmpty','complete','release','failure'];
 for(const name of required)if(typeof adapters[name]!=='function')throw Error('Exécution non configurée : '+name);
 let lease=null,identityRemoved=false,identityRemovalAttempted=false,keepBlocked=false;
 try{
  lease=await adapters.lock(plan);
  if(!lease?.quiescent)throw Error('Les écritures du compte ne sont pas bloquées.');
  const current=await adapters.refresh(plan,lease);
  if(current.userId!==plan.userId||current.requestId!==plan.requestId||current.fingerprint!==plan.fingerprint)throw Error('Les données ont changé. Recalculer l’inventaire.');
  keepBlocked=current.identityPresent===false;
  if(current.identityPresent){identityRemovalAttempted=true;keepBlocked=true;await adapters.removeIdentity(current.userId,lease);}
  if(await adapters.identityExists(current.userId)!==false)throw Error('La suppression de l’identité n’est pas confirmée.');
  identityRemoved=true;
  for(const object of current.objects){
   await adapters.deleteObject(object,lease);
   if(await adapters.objectExists(object,lease)!==false)throw Error('Un fichier reste présent. Le traitement doit être repris.');
  }
  await adapters.purgeRows(current,lease);
  if(await adapters.verifyEmpty(current,lease)!==true)throw Error('Des données du compte restent présentes.');
  // Persist only a non-identifying receipt once finished, not user IDs or keys.
  await adapters.complete({requestId:current.requestId},lease);
  return {ok:true,requestId:current.requestId};
 }catch(error){if(lease)await adapters.failure({requestId:plan.requestId,identityRemoved,identityRemovalAttempted},lease);throw error;}
 finally{if(lease)await adapters.release(lease,{identityRemoved,identityRemovalAttempted,keepBlocked});}
}

// Prepared statement only: this module never executes it from a public route.
// Own-report children are removed by FK cascade. Actor references on other
// reports are anonymised so an old removal cannot accidentally become public.
export const ERASURE_ROWS_SQL=`WITH target AS MATERIALIZED (
 SELECT $1::text AS user_id WHERE NOT EXISTS(SELECT 1 FROM neon_auth."user" WHERE id::text=$1)
 AND NOT EXISTS(SELECT 1 FROM public.stock_admins WHERE user_id=$1)
 AND EXISTS(SELECT 1 FROM public.account_erasure_control WHERE singleton=true AND blocked=true AND request_id=$2::uuid)
 AND NOT EXISTS(SELECT 1 FROM public.account_operations WHERE finished_at IS NULL)
 AND EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE user_id=$1 AND id=$2::uuid AND status='processing')
), owned_reports AS MATERIALIZED (
 SELECT id FROM public.stock_reports WHERE user_id IN(SELECT user_id FROM target)
), owned_photos AS MATERIALIZED (
 SELECT photo_object_key FROM public.catalog_photo_proposals WHERE proposed_by IN(SELECT user_id FROM target)
), detached AS (
 UPDATE public.catalog_variants SET image_object_key=NULL,image_approved=false,image_license_note=NULL,image_url=NULL,image_source_url=NULL,image_imported_at=NULL
 WHERE image_object_key IN(SELECT photo_object_key FROM owned_photos) RETURNING id
), anonymous_reviews AS (
 UPDATE public.catalog_photo_proposals SET reviewed_by=NULL WHERE reviewed_by IN(SELECT user_id FROM target) AND proposed_by<>$1 RETURNING id
), anonymous_removals AS (
 UPDATE public.stock_report_removals SET removed_by='deleted-account',reason='Signalement retiré' WHERE removed_by IN(SELECT user_id FROM target) AND report_id NOT IN(SELECT id FROM owned_reports) RETURNING report_id
), erased_edits AS (
 DELETE FROM public.stock_report_edits WHERE EXISTS(SELECT 1 FROM target) AND report_id NOT IN(SELECT id FROM owned_reports)
 AND (edited_by=$1 OR POSITION($1 IN old_values::text)>0 OR POSITION($1 IN new_values::text)>0) RETURNING id
), erased_votes AS (
 DELETE FROM public.stock_votes WHERE voter_user_id IN(SELECT user_id FROM target) AND report_id NOT IN(SELECT id FROM owned_reports) RETURNING report_id
), erased_watches AS (
 DELETE FROM public.stock_watches WHERE user_id IN(SELECT user_id FROM target) RETURNING id
), erased_photos AS (
 DELETE FROM public.catalog_photo_proposals WHERE proposed_by IN(SELECT user_id FROM target) RETURNING id
), erased_reports AS (
 DELETE FROM public.stock_reports WHERE user_id IN(SELECT user_id FROM target) RETURNING id
), erased_uploads AS (
 DELETE FROM public.account_uploads WHERE user_id IN(SELECT user_id FROM target) RETURNING operation_id
), erased_operations AS (
 DELETE FROM public.account_operations WHERE user_id IN(SELECT user_id FROM target) AND (SELECT COUNT(*) FROM erased_uploads)>=0 RETURNING id
), erased_requests AS (
 DELETE FROM public.account_deletion_requests WHERE user_id IN(SELECT user_id FROM target) RETURNING id
) SELECT EXISTS(SELECT 1 FROM target) AS executed,
 (SELECT COUNT(*) FROM erased_reports)::int AS reports,(SELECT COUNT(*) FROM erased_photos)::int AS proposals,
 (SELECT COUNT(*) FROM erased_watches)::int AS watches,(SELECT COUNT(*) FROM detached)::int AS detached_images,
 (SELECT COUNT(*) FROM anonymous_removals)::int AS anonymised_removals,(SELECT COUNT(*) FROM erased_requests)::int AS requests`;
export async function purgeAccountRows(sql,plan){
 if(!uuid(plan.userId)||!uuid(plan.requestId)||plan.status!=='processing'||plan.blocked.length)throw Error('Cible non autorisée.');
 const rows=await sql(ERASURE_ROWS_SQL,[plan.userId,plan.requestId]);
 if(!rows[0]?.executed)throw Error('Identité encore présente ou compte administrateur : effacement bloqué.');
 return rows[0];
}
export async function verifyAccountEmpty(sql,userId){
 if(!uuid(userId))return false;
 const identities=await sql('SELECT 1 FROM neon_auth."user" WHERE id::text=$1 LIMIT 1',[userId]);
 const counts=await sql(ERASURE_COUNTS_SQL,[userId]);
 const objects=await sql(ERASURE_OBJECTS_SQL,[userId]);
 return identities.length===0&&objects.length===0&&Object.values(checkedCounts(counts[0])).every(value=>value===0);
}
