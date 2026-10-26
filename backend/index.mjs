// PokéStock France — API communautaire, Node 24 / Neon Functions.
// Les identifiants Postgres et S3 sont injectés par Neon, jamais exposés au navigateur.
import { randomUUID, createHash, createHmac, createPublicKey, verify as verifySignature } from "node:crypto";

const SITE_ORIGIN="https://nicochapuise-byte.github.io";
const ALLOWED_SERIES=new Set(["ev","151","prism","paldea","blackwhite","mega"]);
const DB_URL=process.env.DATABASE_URL;
const AUTH_URL=process.env.NEON_AUTH_BASE_URL;
const JWKS_URL=process.env.NEON_AUTH_JWKS_URL;

function cors(request){
  const origin=request.headers.get("origin");
  const h={"Vary":"Origin","Cache-Control":"no-store"};
  if(origin===SITE_ORIGIN){
    h["Access-Control-Allow-Origin"]=SITE_ORIGIN;
    h["Access-Control-Allow-Methods"]="GET,POST,PATCH,DELETE,OPTIONS";
    h["Access-Control-Allow-Headers"]="Authorization,Content-Type";
  }
  return h;
}
function json(obj,status,request){return Response.json(obj,{status,headers:cors(request)});}
function sha(input){return createHash("sha256").update(input).digest("hex");}
function hmac(key,data){return createHmac("sha256",key).update(data).digest();}
function signKey(date,region){
  let key=hmac("AWS4"+process.env.AWS_SECRET_ACCESS_KEY,date);
  key=hmac(key,region);key=hmac(key,"s3");return hmac(key,"aws4_request");
}
function awsBucketUrl(key,bucket="proofs"){
  const base=new URL(process.env.AWS_ENDPOINT_URL_S3);
  base.pathname=base.pathname.replace(/\/$/,"")+"/"+encodeURIComponent(bucket)+"/"+key.split("/").map(encodeURIComponent).join("/");
  base.search="";return base;
}
function amzTime(date){return date.toISOString().replace(/[:-]|\.\d{3}/g,"");}
async function uploadPhoto(bytes,key,bucket="proofs"){
  const url=awsBucketUrl(key,bucket),date=amzTime(new Date()),day=date.slice(0,8),region=process.env.AWS_REGION;
  const hash=sha(bytes),scope=day+"/"+region+"/s3/aws4_request",signed="host;x-amz-content-sha256;x-amz-date";
  const canonical="PUT\n"+url.pathname+"\n\nhost:"+url.host+"\nx-amz-content-sha256:"+hash+"\nx-amz-date:"+date+"\n\n"+signed+"\n"+hash;
  const signature=createHmac("sha256",signKey(day,region)).update("AWS4-HMAC-SHA256\n"+date+"\n"+scope+"\n"+sha(canonical)).digest("hex");
  const authorization="AWS4-HMAC-SHA256 Credential="+process.env.AWS_ACCESS_KEY_ID+"/"+scope+", SignedHeaders="+signed+", Signature="+signature;
  const r=await fetch(url,{method:"PUT",headers:{"Content-Type":"image/jpeg","x-amz-date":date,"x-amz-content-sha256":hash,"Authorization":authorization},body:bytes});
  if(!r.ok)throw new Error("Le stockage de la photo a échoué ("+r.status+").");
}
function photoUrl(key,bucket="proofs"){
  if(!key)return null;
  const url=awsBucketUrl(key,bucket),date=amzTime(new Date()),day=date.slice(0,8),region=process.env.AWS_REGION;
  const scope=day+"/"+region+"/s3/aws4_request";
  const params=new URLSearchParams({
    "X-Amz-Algorithm":"AWS4-HMAC-SHA256","X-Amz-Credential":process.env.AWS_ACCESS_KEY_ID+"/"+scope,
    "X-Amz-Date":date,"X-Amz-Expires":"900","X-Amz-SignedHeaders":"host"
  });
  const query=[...params.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(v).replace(/%20/g,"%20")).join("&");
  const canonical="GET\n"+url.pathname+"\n"+query+"\nhost:"+url.host+"\n\nhost\nUNSIGNED-PAYLOAD";
  const signature=createHmac("sha256",signKey(day,region)).update("AWS4-HMAC-SHA256\n"+date+"\n"+scope+"\n"+sha(canonical)).digest("hex");
  url.search=query+"&X-Amz-Signature="+signature;
  return url.toString();
}
async function sql(query,params=[]){
  if(!DB_URL)throw Error("DATABASE_URL absent");
  const host=new URL(DB_URL).hostname;
  // Neon SQL-over-HTTP utilise le proxy api.<region>.neon.tech, pas le hostname PostgreSQL.
  const proxyHost=host.replace(/^[^.]+\./,"api.");
  const r=await fetch("https://"+proxyHost+"/sql",{
    method:"POST",
    headers:{"Content-Type":"application/json","Neon-Connection-String":DB_URL,"Neon-Raw-Text-Output":"false"},
    body:JSON.stringify({query,params})
  });
  const data=await r.json();
  if(!r.ok||data.message||data.error)throw Error("Échec de la requête Postgres");
  return data.rows||[];
}
const decode=b=>Buffer.from(b.replace(/-/g,"+").replace(/_/g,"/"),"base64");
let jwksCache={at:0,keys:[]};
async function currentKeys(){
  if(Date.now()-jwksCache.at<300000&&jwksCache.keys.length)return jwksCache.keys;
  const r=await fetch(JWKS_URL);
  if(!r.ok)throw Error("JWKS indisponible");
  const data=await r.json();
  if(!Array.isArray(data.keys))throw Error("JWKS invalide");
  jwksCache={at:Date.now(),keys:data.keys};
  return data.keys;
}
async function authenticate(request){
  const value=request.headers.get("authorization")||"";
  const match=/^Bearer\s+([a-zA-Z0-9._-]+)$/.exec(value);
  if(!match)return null;
  try{
    const parts=match[1].split(".");
    if(parts.length!==3)return null;
    const head=JSON.parse(decode(parts[0]).toString("utf8")),body=JSON.parse(decode(parts[1]).toString("utf8"));
    const now=Math.floor(Date.now()/1000);
    if(head.alg!=="EdDSA"||typeof body.sub!=="string"||!body.sub)return null;
    if(body.iss!==new URL(AUTH_URL).origin||!Number.isFinite(body.exp)||body.exp<=now||body.iat>now+60||body.nbf>now+60)return null;
    const keys=await currentKeys();
    const key=keys.find(k=>k.kid===head.kid&&k.kty==="OKP"&&k.crv==="Ed25519");
    if(!key)return null;
    const valid=verifySignature(null,Buffer.from(parts[0]+"."+parts[1]),createPublicKey({key,format:"jwk"}),decode(parts[2]));
    return valid?body.sub:null;
  }catch{return null;}
}
async function isSiteAdmin(userId){
  if(!userId)return false;
  const rows=await sql("SELECT 1 AS allowed FROM public.stock_admins WHERE user_id=$1 AND role='admin' LIMIT 1",[userId]);
  return rows.length>0;
}
function isReportId(str){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
function editedValues(input){
  if(!validText(input?.store,140)||!validText(input?.city,120)||!validText(input?.address,240)
     ||!validText(input?.product,200)||!ALLOWED_SERIES.has(input?.series))return null;
  const lat=Number(input.lat),lng=Number(input.lng);
  if(!validCoordinates(lat,lng))return null;
  const qty=Number(input.qty);
  if(!Number.isInteger(qty)||qty<1||qty>999)return null;
  const price=input.price===null||input.price===""?null:Number(input.price);
  if(price!==null&&(!Number.isFinite(price)||price<0||price>10000))return null;
  if(!["pending","approved","rejected"].includes(input.status))return null;
  return {store:input.store.trim(),city:input.city.trim(),address:input.address.trim(),product:input.product.trim(),
    series:input.series,lat,lng,qty,price,status:input.status};
}

function validText(v,max){return typeof v==="string"&&v.trim().length>=2&&v.trim().length<=max;}
function validCoordinates(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=41&&lat<=52&&lng>=-6&&lng<=10;}
async function validateAddress(address,city,lat,lng){
  const query=new URL("https://data.geopf.fr/geocodage/search/");
  query.searchParams.set("q",address+" "+city);query.searchParams.set("limit","3");
  const r=await fetch(query,{signal:AbortSignal.timeout(6000)});
  if(!r.ok)return false;
  const data=await r.json();
  return (data.features||[]).some(f=>{
    const [x,y]=f.geometry?.coordinates||[];
    const distance=Math.sqrt(Math.pow((lat-y)*111000,2)+Math.pow((lng-x)*111000*Math.cos(lat*Math.PI/180),2));
    return Number.isFinite(distance)&&distance<350;
  });
}
function voteSummary(a,b){
  const available=Number(a)||0,unavailable=Number(b)||0;
  const state=available>=2&&available>unavailable?"confirmed":unavailable>=2&&unavailable>available?"out_of_stock":"unverified";
  return {available,unavailable,state};
}

export default {
  async fetch(request){
    const url=new URL(request.url),headers=cors(request);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    try{
      if(url.pathname==="/"&&request.method==="GET")return json({name:"PokéStock API",ok:true},200,request);

      if(url.pathname==="/catalog"&&request.method==="GET"){
        const [seriesRows,productRows,variantRows]=await Promise.all([
          sql("SELECT id,name,color,block_name,set_code,release_date,source_url AS source_url FROM public.catalog_series WHERE is_active=true ORDER BY display_order,name"),
          sql("SELECT id,series_id,type_key,name,source_url,release_date FROM public.catalog_products WHERE is_active=true ORDER BY series_id,display_order,name"),
          sql("SELECT v.id,v.product_id,v.variant_name,v.image_object_key,v.image_url,v.image_approved,v.source_url FROM public.catalog_variants v JOIN public.catalog_products p ON p.id=v.product_id JOIN public.catalog_series s ON s.id=p.series_id WHERE v.is_active=true AND p.is_active=true AND s.is_active=true ORDER BY v.display_order,v.variant_name")
        ]);
        return json({
          series:seriesRows.map(r=>({id:r.id,name:r.name,color:r.color,block:r.block_name||'Autres séries',code:r.set_code||'',releaseDate:r.release_date||null,sourceUrl:r.source_url})),
          products:productRows.map(r=>({id:r.id,seriesId:r.series_id,type:r.type_key,name:r.name,releaseDate:r.release_date||null,sourceUrl:r.source_url})),
          variants:variantRows.map(r=>({id:r.id,productId:r.product_id,name:r.variant_name,image:!r.image_approved?null:r.image_object_key?photoUrl(r.image_object_key,"catalog-images"):r.image_url==="catalog-upc151-chat.svg"?r.image_url:null,sourceUrl:r.source_url}))
        },200,request);
      }

      if(url.pathname==="/catalog/photo-proposals"&&request.method==="POST"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connecte-toi pour proposer une photo."},401,request);
        if(Number(request.headers.get("content-length"))>1150000)return json({error:"Image trop volumineuse."},413,request);
        const raw=await request.text();
        if(raw.length>1150000)return json({error:"Image trop volumineuse."},413,request);
        let payload;
        try{payload=JSON.parse(raw)}catch{return json({error:"Données invalides."},400,request);}
        if(payload.rightsConfirmed!==true||typeof payload.variantId!=="string"||!/^[a-z0-9-]{2,120}$/.test(payload.variantId)
          ||!validText(payload.rightsNote,240))
          return json({error:"Choisis une variante et confirme les droits sur la photo."},400,request);
        if(typeof payload.photo!=="string"||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(payload.photo))
          return json({error:"Seules les photographies JPEG sont acceptées."},400,request);
        const bytes=Buffer.from(payload.photo.split(",")[1],"base64");
        if(bytes.length<1000||bytes.length>650000||bytes[0]!==0xff||bytes[1]!==0xd8)
          return json({error:"Photo illisible ou trop volumineuse après compression."},400,request);
        const refs=await sql("SELECT id,image_approved FROM public.catalog_variants WHERE id=$1 AND is_active=true LIMIT 1",[payload.variantId]);
        if(!refs.length)return json({error:"Référence inconnue."},404,request);
        if(refs[0].image_approved===true)return json({error:"Cette variante possède déjà une photo validée."},409,request);
        const limit=await sql("SELECT COUNT(*)::int AS n FROM public.catalog_photo_proposals WHERE proposed_by=$1 AND created_at>now()-interval '24 hours'",[user]);
        if(Number(limit[0]?.n)>=5)return json({error:"Limite de cinq propositions par jour atteinte."},429,request);
        const duplicate=await sql("SELECT id FROM public.catalog_photo_proposals WHERE proposed_by=$1 AND variant_id=$2 AND status='pending' LIMIT 1",[user,payload.variantId]);
        if(duplicate.length)return json({error:"Tu as déjà proposé une photo pour cette référence."},409,request);
        const key="proposals/"+randomUUID()+".jpg";
        await uploadPhoto(bytes,key,"catalog-images");
        const rows=await sql(
          "INSERT INTO public.catalog_photo_proposals(variant_id,proposed_by,photo_object_key,rights_note) VALUES($1,$2,$3,$4) RETURNING id",
          [payload.variantId,user,key,payload.rightsNote.trim()]
        );
        return json({ok:true,id:rows[0]?.id,message:"Photo proposée. Un administrateur doit la vérifier avant publication."},201,request);
      }
      if(url.pathname==="/admin/catalog/photo-proposals"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        if(!await isSiteAdmin(user))return json({error:"Accès administrateur uniquement."},403,request);
        const pending=await sql(
          "SELECT q.id,q.variant_id,q.photo_object_key,q.rights_note,q.created_at,p.name AS product_name,v.variant_name,s.name AS series_name FROM public.catalog_photo_proposals q JOIN public.catalog_variants v ON v.id=q.variant_id JOIN public.catalog_products p ON p.id=v.product_id JOIN public.catalog_series s ON s.id=p.series_id WHERE q.status='pending' ORDER BY q.created_at ASC LIMIT 100"
        );
        return json({pending:pending.map(({photo_object_key,...r})=>({...r,image:photoUrl(photo_object_key,"catalog-images")}))},200,request);
      }
      const reviewMatch=/^\/admin\/catalog\/photo-proposals\/([0-9a-f-]{36})\/review$/.exec(url.pathname);
      if(reviewMatch&&request.method==="POST"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        if(!await isSiteAdmin(user))return json({error:"Accès réservé aux administrateurs."},403,request);
        const raw=await request.text();
        if(raw.length>300)return json({error:"Requête trop longue."},413,request);
        let payload;
        try{payload=JSON.parse(raw)}catch{return json({error:"Données invalides."},400,request);}
        if(!["approved","rejected"].includes(payload.decision))return json({error:"Décision invalide."},400,request);
        if(payload.decision==="approved"&&payload.rightsConfirmed!==true)return json({error:"Confirme les droits de publication."},400,request);
        const id=reviewMatch[1];
        if(!isReportId(id))return json({error:"Référence de proposition incorrecte."},400,request);
        if(payload.decision==="approved"){
          const updated=await sql(
            "WITH review AS (UPDATE public.catalog_photo_proposals SET status='approved',reviewed_by=$2,reviewed_at=now() WHERE id=$1::uuid AND status='pending' RETURNING variant_id,photo_object_key,rights_note) UPDATE public.catalog_variants v SET image_object_key=review.photo_object_key,image_approved=true,image_license_note=review.rights_note,image_url=NULL FROM review WHERE v.id=review.variant_id RETURNING v.id",
            [id,user]
          );
          if(!updated.length)return json({error:"Photo déjà examinée ou référence introuvable."},409,request);
        }else{
          const updated=await sql("UPDATE public.catalog_photo_proposals SET status='rejected',reviewed_by=$2,reviewed_at=now() WHERE id=$1::uuid AND status='pending' RETURNING id",[id,user]);
          if(!updated.length)return json({error:"Photo déjà examinée."},409,request);
        }
        return json({ok:true,id,decision:payload.decision},200,request);
      }
      const catalogImageMatch=/^\/admin\/catalog\/variants\/([a-z0-9-]{2,120})\/image$/.exec(url.pathname);
      if(catalogImageMatch&&request.method==="POST"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        if(!await isSiteAdmin(user))return json({error:"Accès administrateur nécessaire."},403,request);
        const variantId=catalogImageMatch[1];
        const raw=await request.text();
        if(raw.length>1100000)return json({error:"Image trop volumineuse."},413,request);
        let payload;
        try{payload=JSON.parse(raw)}catch{return json({error:"Données invalides."},400,request);}
        if(payload.rightsConfirmed!==true||!validText(payload.rightsNote,240))
          return json({error:"Indique l'autorisation précise qui permet d'utiliser cette image."},400,request);
        if(typeof payload.photo!=="string"||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(payload.photo))
          return json({error:"Image JPEG obligatoire."},400,request);
        const bytes=Buffer.from(payload.photo.split(",")[1],"base64");
        if(bytes.length<1000||bytes.length>650000||bytes[0]!==0xff||bytes[1]!==0xd8)
          return json({error:"Image incorrecte (650 Ko après compression maximum)."},400,request);
        const variants=await sql("SELECT id FROM public.catalog_variants WHERE id=$1 AND is_active=true LIMIT 1",[variantId]);
        if(!variants.length)return json({error:"Variante inconnue."},404,request);
        const key="images/"+randomUUID()+".jpg";
        await uploadPhoto(bytes,key,"catalog-images");
        await sql("UPDATE public.catalog_variants SET image_object_key=$2,image_approved=true,image_license_note=$3 WHERE id=$1",
          [variantId,key,payload.rightsNote.trim()]);
        return json({ok:true,variantId,message:"Visuel ajouté au catalogue."},201,request);
      }

      if(url.pathname==="/me/role"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        return json({isAdmin:await isSiteAdmin(user)},200,request);
      }
      if(url.pathname==="/me/reports"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        const rows=await sql("SELECT r.id FROM public.stock_reports r WHERE r.user_id=$1 AND NOT EXISTS(SELECT 1 FROM public.stock_report_removals d WHERE d.report_id=r.id) ORDER BY r.created_at DESC LIMIT 250",[user]);
        return json({ids:rows.map(x=>x.id)},200,request);
      }
      if(url.pathname==="/admin/reports"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        if(!await isSiteAdmin(user))return json({error:"Accès réservé à l'administration."},403,request);
        const rows=await sql(
          "SELECT r.id,r.store_name AS store,r.store_address AS address,r.city,r.series_id AS series,r.product_name AS product,r.price_eur AS price,r.quantity AS qty,r.latitude AS lat,r.longitude AS lng,r.status,r.photo_object_key AS proof_key,r.created_at AS created_at, d.removed_at AS removed_at FROM public.stock_reports r LEFT JOIN public.stock_report_removals d ON d.report_id=r.id ORDER BY r.created_at DESC LIMIT 150"
        );
        return json({reports:rows.map(({proof_key,...row})=>({...row,proofImage:proof_key?photoUrl(proof_key,"proofs"):null}))},200,request);
      }
      const adminEdit=/^\/admin\/reports\/([0-9a-f-]{36})$/.exec(url.pathname);
      if(adminEdit&&request.method==="PATCH"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        if(!await isSiteAdmin(user))return json({error:"Accès réservé à l'administration."},403,request);
        const id=adminEdit[1];
        if(!isReportId(id))return json({error:"Identifiant invalide."},400,request);
        const before=await sql("SELECT store_name AS store,store_address AS address,city,series_id AS series,product_name AS product,price_eur AS price,quantity AS qty,latitude AS lat,longitude AS lng,status FROM public.stock_reports WHERE id=$1::uuid LIMIT 1",[id]);
        if(!before.length)return json({error:"Signalement introuvable."},404,request);
        const raw=await request.text();
        if(raw.length>5000)return json({error:"Requête trop volumineuse."},413,request);
        let payload;
        try{payload=JSON.parse(raw)}catch{return json({error:"Données incorrectes."},400,request);}
        const updated=editedValues(payload);
        if(!updated)return json({error:"Vérifie les champs, le statut et les coordonnées."},400,request);
        const verified=await validateAddress(updated.address,updated.city,updated.lat,updated.lng);
        if(!verified)return json({error:"Adresse invalide. Choisis une adresse vérifiée."},400,request);
        await sql(
          "UPDATE public.stock_reports SET catalog_variant_id=CASE WHEN series_id=$5 AND product_name=$6 THEN catalog_variant_id ELSE NULL END, store_name=$2,store_address=$3,city=$4,series_id=$5,product_name=$6,price_eur=$7,quantity=$8,latitude=$9,longitude=$10,status=$11 WHERE id=$1::uuid",
          [id,updated.store,updated.address,updated.city,updated.series,updated.product,updated.price,updated.qty,updated.lat,updated.lng,updated.status]
        );
        try{
          await sql("INSERT INTO public.stock_report_edits(report_id,edited_by,old_values,new_values) VALUES ($1::uuid,$2,$3::jsonb,$4::jsonb)",
            [id,user,JSON.stringify(before[0]),JSON.stringify(updated)]);
        }catch(error){console.error("Admin audit unavailable:",error?.message);}
        return json({ok:true,id,message:"Référencement modifié."},200,request);
      }
      const removeReport=/^\/reports\/([0-9a-f-]{36})$/.exec(url.pathname);
      if(removeReport&&request.method==="DELETE"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        const id=removeReport[1];
        if(!isReportId(id))return json({error:"Identifiant incorrect."},400,request);
        const found=await sql("SELECT user_id FROM public.stock_reports WHERE id=$1::uuid LIMIT 1",[id]);
        if(!found.length)return json({error:"Signalement introuvable."},404,request);
        const admin=await isSiteAdmin(user);
        if(found[0].user_id!==user&&!admin)return json({error:"Tu ne peux supprimer que tes propres signalements."},403,request);
        const reason=admin&&found[0].user_id!==user?"Suppression par administrateur":"Suppression par auteur";
        await sql(
          "INSERT INTO public.stock_report_removals(report_id,removed_by,reason) VALUES ($1::uuid,$2,$3) ON CONFLICT (report_id) DO NOTHING",
          [id,user,reason]
        );
        return json({ok:true,id,message:"Signalement supprimé de la carte et des disponibilités."},200,request);
      }
      if(url.pathname==="/reports"&&request.method==="GET"){
        const rows=await sql("SELECT r.id,r.store_name,r.store_address,r.city,r.series_id,r.product_name,r.price_eur,r.quantity,r.latitude,r.longitude,r.photo_object_key,r.catalog_variant_id,cv.variant_name,cv.image_object_key AS catalog_image_key,cv.image_approved,cp.source_url AS catalog_source_url,r.status,r.created_at,COALESCE(v.available_count,0)::int AS available_count,COALESCE(v.unavailable_count,0)::int AS unavailable_count FROM public.stock_reports r LEFT JOIN public.catalog_variants cv ON cv.id=r.catalog_variant_id LEFT JOIN public.catalog_products cp ON cp.id=cv.product_id LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE verdict='available') AS available_count,COUNT(*) FILTER (WHERE verdict='unavailable') AS unavailable_count FROM public.stock_votes WHERE report_id=r.id) v ON TRUE WHERE r.status IN ('approved','pending') AND r.expires_at>now() AND NOT EXISTS(SELECT 1 FROM public.stock_report_removals d WHERE d.report_id=r.id) ORDER BY r.created_at DESC LIMIT 100");
        return json({reports:rows.map(r=>({id:r.id,store:r.store_name,address:r.store_address,city:r.city,series:r.series_id,product:r.product_name,price:r.price_eur,qty:r.quantity,lat:r.latitude,lng:r.longitude,status:r.status,createdAt:r.created_at,img:r.catalog_image_key&&r.image_approved?photoUrl(r.catalog_image_key,"catalog-images"):null,catalogVariantId:r.catalog_variant_id,artSet:r.variant_name||null,catalogSourceUrl:r.catalog_source_url||null,proofProvided:!!r.photo_object_key,votes:voteSummary(r.available_count,r.unavailable_count)}))},200,request);
      }
      if(url.pathname==="/me/votes"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        const votes=await sql("SELECT v.report_id,v.verdict FROM public.stock_votes v JOIN public.stock_reports r ON r.id=v.report_id WHERE v.voter_user_id=$1 AND r.expires_at>now() AND NOT EXISTS(SELECT 1 FROM public.stock_report_removals d WHERE d.report_id=r.id) ORDER BY v.updated_at DESC LIMIT 100",[user]);
        return json({votes},200,request);
      }
      if(url.pathname==="/me/reputation"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        const submitted=await sql("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM public.stock_votes v WHERE v.report_id=r.id AND v.verdict='available') >= 2 AND (SELECT COUNT(*) FROM public.stock_votes v WHERE v.report_id=r.id AND v.verdict='available') > (SELECT COUNT(*) FROM public.stock_votes v WHERE v.report_id=r.id AND v.verdict='unavailable'))::int AS confirmed FROM public.stock_reports r WHERE r.user_id=$1 AND r.status IN ('approved','pending') AND r.created_at>now()-interval '90 days' AND NOT EXISTS(SELECT 1 FROM public.stock_report_removals d WHERE d.report_id=r.id)",[user]);
        const helpful=await sql("SELECT COUNT(*)::int AS total FROM public.stock_votes v JOIN public.stock_reports r ON r.id=v.report_id CROSS JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE other.verdict=v.verdict) AS agreeing,COUNT(*) FILTER (WHERE other.verdict<>v.verdict) AS disagreeing FROM public.stock_votes other WHERE other.report_id=v.report_id AND other.voter_user_id<>v.voter_user_id) peer WHERE v.voter_user_id=$1 AND r.created_at>now()-interval '90 days' AND r.status IN ('pending','approved') AND NOT EXISTS(SELECT 1 FROM public.stock_report_removals d WHERE d.report_id=r.id) AND peer.agreeing>=2 AND peer.agreeing>peer.disagreeing",[user]);
        const reports=Number(submitted[0]?.total)||0,confirmedReports=Number(submitted[0]?.confirmed)||0,helpfulVotes=Number(helpful[0]?.total)||0;
        const points=confirmedReports*10+helpfulVotes;
        const badge=points>=100?"Expert":points>=40?"Éclaireur":points>=10?"Explorateur":"Débutant";
        return json({points,badge,reports,confirmedReports,helpfulVotes,periodDays:90},200,request);
      }
      const voteMatch=/^\/reports\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/vote$/i.exec(url.pathname);
      if(voteMatch&&request.method==="POST"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connecte-toi pour confirmer un stock ou signaler une rupture."},401,request);
        const id=voteMatch[1],raw=await request.text();
        if(raw.length>300)return json({error:"Requête trop volumineuse."},413,request);
        let payload;
        try{payload=JSON.parse(raw)}catch{return json({error:"Données invalides."},400,request);}
        if(!["available","unavailable"].includes(payload?.verdict))return json({error:"Choix invalide."},400,request);
        const found=await sql("SELECT id,user_id FROM public.stock_reports WHERE id=$1::uuid AND status IN ('pending','approved') AND expires_at>now() AND NOT EXISTS(SELECT 1 FROM public.stock_report_removals d WHERE d.report_id=public.stock_reports.id) LIMIT 1",[id]);
        if(!found.length)return json({error:"Signalement introuvable ou expiré."},404,request);
        if(found[0].user_id===user)return json({error:"Tu ne peux pas voter sur ton propre signalement."},403,request);
        const existing=await sql("SELECT verdict FROM public.stock_votes WHERE report_id=$1::uuid AND voter_user_id=$2",[id,user]);
        if(!existing.length){
          const usage=await sql("SELECT COUNT(*)::int AS total FROM public.stock_votes WHERE voter_user_id=$1 AND created_at>now()-interval '24 hours'",[user]);
          if(Number(usage[0]?.total)>=30)return json({error:"Limite de 30 votes par jour atteinte."},429,request);
        }
        if(!existing.length||existing[0].verdict!==payload.verdict){
          await sql("INSERT INTO public.stock_votes(report_id,voter_user_id,verdict) VALUES ($1::uuid,$2,$3) ON CONFLICT(report_id,voter_user_id) DO UPDATE SET verdict=EXCLUDED.verdict,updated_at=now()",[id,user,payload.verdict]);
        }
        const tally=await sql("SELECT COUNT(*) FILTER (WHERE verdict='available')::int AS available_count,COUNT(*) FILTER (WHERE verdict='unavailable')::int AS unavailable_count FROM public.stock_votes WHERE report_id=$1::uuid",[id]);
        return json({ok:true,reportId:id,myVote:payload.verdict,votes:voteSummary(tally[0]?.available_count,tally[0]?.unavailable_count)},200,request);
      }
      if(url.pathname==="/reports"&&request.method==="POST"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connecte-toi pour signaler un stock."},401,request);
        if(Number(request.headers.get("content-length"))>1250000)return json({error:"Requête trop volumineuse."},413,request);
        const raw=await request.text();
        if(raw.length>1250000)return json({error:"Requête trop volumineuse."},413,request);
        let data;
        try{data=JSON.parse(raw)}catch{return json({error:"Données invalides."},400,request);}
        if(!validText(data.store,140)||!validText(data.address,240)||!validText(data.city,120)||!validCoordinates(Number(data.lat),Number(data.lng)))
          return json({error:"Vérifie les informations du magasin et son adresse."},400,request);
        if(typeof data.catalogVariantId!=="string"||!/^[a-z0-9-]{2,120}$/.test(data.catalogVariantId))
          return json({error:"Sélectionne une série, un produit puis son art set dans le catalogue."},400,request);
        const references=await sql(
          "SELECT v.id,p.name AS product_name,s.id AS series_id FROM public.catalog_variants v JOIN public.catalog_products p ON p.id=v.product_id JOIN public.catalog_series s ON s.id=p.series_id WHERE v.id=$1 AND v.is_active AND p.is_active AND s.is_active AND (s.release_date IS NULL OR s.release_date<=CURRENT_DATE) AND (p.release_date IS NULL OR p.release_date<=CURRENT_DATE) LIMIT 1",
          [data.catalogVariantId]
        );
        if(!references.length)return json({error:"Cette référence est indisponible ou sa date de sortie n'est pas encore passée."},400,request);
        const ref=references[0];
        if(data.price!==null&&(typeof data.price!=="number"||data.price<0||data.price>10000))
          return json({error:"Prix invalide."},400,request);
        if(!Number.isInteger(data.qty)||data.qty<1||data.qty>999)
          return json({error:"Quantité invalide."},400,request);
        let proof=null;
        if(data.photo!==undefined&&data.photo!==null&&data.photo!==""){
          if(typeof data.photo!=="string"||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.photo))
            return json({error:"La photo de preuve doit être un JPEG."},400,request);
          proof=Buffer.from(data.photo.split(",")[1],"base64");
          if(proof.length<1000||proof.length>700000||proof[0]!==0xff||proof[1]!==0xd8)
            return json({error:"Photo de preuve invalide ou trop volumineuse (700 Ko maximum)."},400,request);
        }
        const dup=await sql(
          "SELECT id FROM public.stock_reports r WHERE r.user_id=$1 AND lower(btrim(r.store_address))=lower(btrim($2)) AND r.catalog_variant_id=$3 AND r.created_at>now()-interval '24 hours' AND r.status IN ('pending','approved') AND NOT EXISTS (SELECT 1 FROM public.stock_report_removals d WHERE d.report_id=r.id) LIMIT 1",
          [user,data.address.trim(),ref.id]
        );
        if(dup.length)return json({error:"Tu as déjà signalé cette variante dans ce magasin aujourd'hui.",duplicate:true,existingId:dup[0].id},409,request);
        const count=await sql("SELECT count(*)::int AS n FROM public.stock_reports WHERE user_id=$1 AND created_at>now()-interval '24 hours'",[user]);
        if(Number(count[0]?.n)>=5)return json({error:"Maximum 5 signalements par jour pour ce compte."},429,request);
        const addressOk=await validateAddress(data.address,data.city,Number(data.lat),Number(data.lng));
        if(!addressOk)return json({error:"Adresse non confirmée : choisis une adresse exacte dans les résultats."},400,request);
        let key=null;
        if(proof){
          key="reports/"+randomUUID()+".jpg";
          await uploadPhoto(proof,key,"proofs");
        }
        const rows=await sql(
          "INSERT INTO public.stock_reports (user_id,store_name,store_address,city,series_id,product_name,price_eur,quantity,latitude,longitude,photo_object_key,catalog_variant_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending') RETURNING id,created_at",
          [user,data.store.trim(),data.address.trim(),data.city.trim(),ref.series_id,ref.product_name,data.price,data.qty,data.lat,data.lng,key,ref.id]
        );
        return json({ok:true,id:rows[0]?.id,status:"pending",message:"Signalement enregistré avec la référence du catalogue. Photo de preuve privée facultative."},201,request);
      }
      return json({error:"Route introuvable"},404,request);
    }catch(error){
      console.error("PokéStock backend:",error?.message||"erreur");
      return json({error:"Service momentanément indisponible."},503,request);
    }
  }
};
