// This workflow records a user request. It never claims that a queued account is erased.
const uuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const ownRequest=row=>row?{id:row.id,status:row.status,requestedAt:row.requested_at,updatedAt:row.updated_at}:null;
async function body(request){
 const raw=await request.text();if(raw.length>200)return null;
 try{const data=JSON.parse(raw);return data&&typeof data==='object'&&!Array.isArray(data)?data:null;}catch{return null;}
}
export async function handleAccountDeletion(request,url,{authenticate,isSiteAdmin,sql,json}){
 const own=url.pathname==='/me/account-deletion';
 const admin=url.pathname==='/admin/account-deletions';
 const match=/^\/admin\/account-deletions\/([^/]+)$/.exec(url.pathname);
 if(!own&&!admin&&!match)return null;
 const user=await authenticate(request);
 if(!user)return json({error:'Connexion nécessaire.'},401,request);
 if(!own&&!await isSiteAdmin(user))return json({error:'Accès administrateur uniquement.'},403,request);
 if(own&&request.method==='GET'){
  const rows=await sql('SELECT id,status,requested_at,updated_at FROM public.account_deletion_requests WHERE user_id=$1 LIMIT 1',[user]);
  return json({request:ownRequest(rows[0]),mode:'manual'},200,request);
 }
 if(own&&request.method==='POST'){
  const data=await body(request);
  if(!data||Object.keys(data).some(k=>k!=='confirmation')||data.confirmation!=='SUPPRIMER')return json({error:'Confirmez votre demande en saisissant SUPPRIMER.'},400,request);
  const rows=await sql("INSERT INTO public.account_deletion_requests(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET status=CASE WHEN account_deletion_requests.status='cancelled' THEN 'requested' ELSE account_deletion_requests.status END,requested_at=CASE WHEN account_deletion_requests.status='cancelled' THEN now() ELSE account_deletion_requests.requested_at END,updated_at=CASE WHEN account_deletion_requests.status='cancelled' THEN now() ELSE account_deletion_requests.updated_at END,reviewed_by=CASE WHEN account_deletion_requests.status='cancelled' THEN NULL ELSE account_deletion_requests.reviewed_by END,reviewed_at=CASE WHEN account_deletion_requests.status='cancelled' THEN NULL ELSE account_deletion_requests.reviewed_at END RETURNING id,status,requested_at,updated_at",[user]);
  return json({ok:true,request:ownRequest(rows[0]),mode:'manual'},200,request);
 }
 if(own&&request.method==='PATCH'){
  const data=await body(request);
  if(!data||Object.keys(data).some(k=>k!=='action')||data.action!=='cancel')return json({error:'Action invalide.'},400,request);
  const rows=await sql("UPDATE public.account_deletion_requests SET status='cancelled',updated_at=now() WHERE user_id=$1 AND status='requested' RETURNING id,status,requested_at,updated_at",[user]);
  if(!rows.length)return json({error:'Cette demande ne peut plus être annulée depuis cet écran. Actualisez son état.'},409,request);
  return json({ok:true,request:ownRequest(rows[0]),mode:'manual'},200,request);
 }
 if(admin&&request.method==='GET'){
  const offset=Number(url.searchParams.get('offset')||0);
  if(!Number.isInteger(offset)||offset<0||offset>100000)return json({error:'Pagination invalide.'},400,request);
  const counts=await sql("SELECT COUNT(*) FILTER(WHERE status='requested')::int AS requested,COUNT(*) FILTER(WHERE status='processing')::int AS processing FROM public.account_deletion_requests");
  const rows=await sql("SELECT d.id,d.user_id,d.status,d.requested_at,d.updated_at,d.reviewed_at,u.email,u.name FROM public.account_deletion_requests d LEFT JOIN neon_auth.\"user\" u ON u.id::text=d.user_id WHERE d.status IN ('requested','processing') ORDER BY d.requested_at,d.id LIMIT 26 OFFSET $1",[offset]);
  const hasMore=rows.length>25;
  return json({counts:counts[0]||{requested:0,processing:0},requests:rows.slice(0,25),hasMore,nextOffset:hasMore?offset+25:null},200,request);
 }
 if(match&&request.method==='PATCH'){
  if(!uuid(match[1]))return json({error:'Référence invalide.'},400,request);
  const data=await body(request);
  if(!data||Object.keys(data).some(k=>k!=='action')||data.action!=='start')return json({error:'Action invalide.'},400,request);
  const rows=await sql("UPDATE public.account_deletion_requests SET status='processing',reviewed_by=CASE WHEN status='requested' THEN $2 ELSE reviewed_by END,reviewed_at=CASE WHEN status='requested' THEN now() ELSE reviewed_at END,updated_at=CASE WHEN status='requested' THEN now() ELSE updated_at END WHERE id=$1::uuid AND status IN ('requested','processing') RETURNING id,status,requested_at,updated_at",[match[1],user]);
  if(!rows.length)return json({error:'Demande introuvable ou annulée.'},404,request);
  return json({ok:true,request:ownRequest(rows[0]),mode:'manual'},200,request);
 }
 return json({error:'Méthode non autorisée.'},405,request);
}
