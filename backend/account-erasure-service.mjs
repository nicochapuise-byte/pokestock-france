import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readErasurePlan,executeErasure,purgeAccountRows,verifyAccountEmpty} from './account-erasure.mjs';
import {acquireErasureBarrier} from './account-operations.mjs';
import {createErasureStorage} from './erasure-storage.mjs';
import {createErasureIdentity} from './erasure-identity.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
const branches={
 'https://ep-morning-bonus-b92tax88.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth':'br-morning-lab-b9mavkej',
 'https://ep-dark-bread-b9bd8cco.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth':'br-nameless-math-b9dyokxp'
};
async function body(request){const raw=await request.text();if(raw.length>300)return null;try{return JSON.parse(raw);}catch{return null;}}
export function createErasureService({sql,authenticate,isSiteAdmin,json,env,fetcher=fetch}){
 const branchId=branches[env.NEON_AUTH_BASE_URL?.replace(/\/$/,'')];
 const enabled=env.ACCOUNT_ERASURE_ENABLED==='true'&&!!env.NEON_ERASURE_API_KEY&&branchId==='br-morning-lab-b9mavkej';
 const identity=enabled?createErasureIdentity({apiKey:env.NEON_ERASURE_API_KEY,projectId:'sparkling-bread-53722880',branchId,fetcher}):null;
 const storage=enabled?createErasureStorage({endpoint:env.AWS_ENDPOINT_URL_S3,region:env.AWS_REGION,accessKeyId:env.AWS_ACCESS_KEY_ID,secretAccessKey:env.AWS_SECRET_ACCESS_KEY,fetcher}):null;
 async function unlock(requestId){await sql('UPDATE public.account_erasure_control SET blocked=false,request_id=NULL,blocked_at=NULL WHERE singleton=true AND request_id=$1::uuid',[requestId]);}
 async function complete(job,worker){
  const rows=await sql("UPDATE public.account_erasure_jobs SET state='completed',stage='completed',user_id=NULL,worker_id=NULL,completed_at=now(),updated_at=now() WHERE request_id=$1::uuid AND worker_id=$2::uuid RETURNING request_id",[job.request_id,worker]);
  if(rows.length!==1)throw Error('Reçu de fin non confirmé.');
  await unlock(job.request_id);
 }
 async function run(job){
  const worker=randomUUID();
  const claim=await sql("UPDATE public.account_erasure_jobs SET worker_id=$2::uuid,state='running',updated_at=now() WHERE request_id=$1::uuid AND worker_id IS NULL AND state IN ('prepared','failed') AND receipt_hash=$3 RETURNING request_id",[job.request_id,worker,job.receipt_hash]);
  if(!claim.length)return {state:'running'};
  let completed=false;
  const stage=value=>sql('UPDATE public.account_erasure_jobs SET stage=$3,updated_at=now() WHERE request_id=$1::uuid AND worker_id=$2::uuid',[job.request_id,worker,value]);
  try{
   // A successful row purge can precede a lost completion response. Only a
   // persisted files_verified checkpoint permits finishing without the request.
   const requests=await sql('SELECT id FROM public.account_deletion_requests WHERE id=$1::uuid AND user_id=$2',[job.request_id,job.user_id]);
   if(!requests.length){
    if(job.stage!=='files_verified'||!await verifyAccountEmpty(sql,job.user_id))throw Error('Traitement à vérifier manuellement.');
    await complete(job,worker);return {state:'completed'};
   }
   const plan=await readErasurePlan(sql,job.request_id);
   if(plan.userId!==job.user_id||plan.objects.length>30)throw Error('Inventaire à vérifier manuellement.');
   await executeErasure(plan,{
    lock:current=>acquireErasureBarrier(sql,current),
    refresh:()=>readErasurePlan(sql,job.request_id),
    removeIdentity:async userId=>{await stage('identity_attempted');await identity(userId);},
    identityExists:async userId=>(await sql('SELECT 1 FROM neon_auth."user" WHERE id::text=$1 LIMIT 1',[userId])).length>0,
    deleteObject:storage.deleteObject,
    objectExists:storage.objectExists,
    purgeRows:async current=>{await stage('files_verified');return purgeAccountRows(sql,current);},
    verifyEmpty:current=>verifyAccountEmpty(sql,current.userId),
    complete:async()=>{await complete(job,worker);completed=true;},
    failure:async()=>{},
    release:async(lease,state)=>{if(completed||!state.keepBlocked)await unlock(job.request_id);}
   },{confirmation:'EFFACER '+job.request_id,fingerprint:plan.fingerprint});
   return {state:'completed'};
  }catch{
   // No timeout lease stealing: an interrupted worker requires operator review.
   await sql("UPDATE public.account_erasure_jobs SET state='failed',worker_id=NULL,updated_at=now() WHERE request_id=$1::uuid AND worker_id=$2::uuid",[job.request_id,worker]);
   return {state:'failed'};
  }
 }
 return async function handle(request,url){
  if(url.pathname==='/account-erasure/capabilities'&&request.method==='GET')return json({enabled},200,request);
  if(url.pathname==='/me/account-erasure/prepare'&&request.method==='POST'){
   if(!enabled)return json({error:'L’effacement automatique n’est pas encore activé.'},503,request);
   const user=await authenticate(request);if(!user)return json({error:'Connexion nécessaire.'},401,request);
   if(await isSiteAdmin(user))return json({error:'Un compte administrateur nécessite un transfert de responsabilités avant suppression.'},409,request);
   const data=await body(request);if(!data||data.confirmation!=='SUPPRIMER'||Object.keys(data).length!==1)return json({error:'Confirmation invalide.'},400,request);
   // One statement prevents cancelled/new requests and receipts diverging.
   const receiptToken=randomBytes(32).toString('hex');
   const rows=await sql(`WITH request AS (
    INSERT INTO public.account_deletion_requests(user_id,status) VALUES($1,'processing')
    ON CONFLICT(user_id) DO UPDATE SET status='processing',updated_at=now() RETURNING id
   ) INSERT INTO public.account_erasure_jobs(request_id,user_id,receipt_hash)
    SELECT id,$1,$2 FROM request ON CONFLICT(request_id) DO UPDATE SET receipt_hash=EXCLUDED.receipt_hash,updated_at=now()
    WHERE account_erasure_jobs.worker_id IS NULL AND account_erasure_jobs.state IN ('prepared','failed') RETURNING request_id`,[user,hash(receiptToken)]);
   if(!rows.length)return json({error:'Un effacement est déjà en cours.'},409,request);
   return json({requestId:rows[0].request_id,receiptToken,state:'prepared'},201,request);
  }
  const match=/^\/account-erasure\/([a-f0-9-]+)\/(status|execute)$/.exec(url.pathname);
  if(!match)return null;
  if(!enabled)return json({error:'Service indisponible.'},503,request);
  if(!uuid(match[1]))return json({error:'Référence invalide.'},400,request);
  const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
  if(!token)return json({error:'Reçu invalide.'},401,request);
  const rows=await sql('SELECT request_id,user_id,state,stage,worker_id,receipt_hash FROM public.account_erasure_jobs WHERE request_id=$1::uuid AND receipt_hash=$2',[match[1],hash(token)]);
  if(!rows.length)return json({error:'Reçu invalide.'},401,request);
  const job=rows[0];
  if(match[2]==='status'&&request.method==='GET'){
   // Status is read-only. A completed POST may repair a lost unlock response.
   return json({state:job.state},200,request);
  }
  if(match[2]!=='execute'||request.method!=='POST')return json({error:'Méthode invalide.'},405,request);
  const data=await body(request);if(data?.confirmation!=='SUPPRIMER'||Object.keys(data).length!==1)return json({error:'Confirmation invalide.'},400,request);
  if(job.state==='completed'){await unlock(job.request_id);return json({state:'completed'},200,request);}
  const result=await run(job);return json(result,result.state==='completed'?200:result.state==='running'?202:409,request);
 };
}
