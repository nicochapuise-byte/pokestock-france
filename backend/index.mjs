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
    h["Access-Control-Allow-Methods"]="GET,POST,OPTIONS";
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
function awsBucketUrl(key){
  const base=new URL(process.env.AWS_ENDPOINT_URL_S3);
  base.pathname=base.pathname.replace(/\/$/,"")+"/proofs/"+key.split("/").map(encodeURIComponent).join("/");
  base.search="";return base;
}
function amzTime(date){return date.toISOString().replace(/[:-]|\.\d{3}/g,"");}
async function uploadPhoto(bytes,key){
  const url=awsBucketUrl(key),date=amzTime(new Date()),day=date.slice(0,8),region=process.env.AWS_REGION;
  const hash=sha(bytes),scope=day+"/"+region+"/s3/aws4_request",signed="host;x-amz-content-sha256;x-amz-date";
  const canonical="PUT\n"+url.pathname+"\n\nhost:"+url.host+"\nx-amz-content-sha256:"+hash+"\nx-amz-date:"+date+"\n\n"+signed+"\n"+hash;
  const signature=createHmac("sha256",signKey(day,region)).update("AWS4-HMAC-SHA256\n"+date+"\n"+scope+"\n"+sha(canonical)).digest("hex");
  const authorization="AWS4-HMAC-SHA256 Credential="+process.env.AWS_ACCESS_KEY_ID+"/"+scope+", SignedHeaders="+signed+", Signature="+signature;
  const r=await fetch(url,{method:"PUT",headers:{"Content-Type":"image/jpeg","x-amz-date":date,"x-amz-content-sha256":hash,"Authorization":authorization},body:bytes});
  if(!r.ok)throw new Error("Le stockage de la photo a échoué ("+r.status+").");
}
function photoUrl(key){
  const url=awsBucketUrl(key),date=amzTime(new Date()),day=date.slice(0,8),region=process.env.AWS_REGION;
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
      if(url.pathname==="/reports"&&request.method==="GET"){
        const rows=await sql("SELECT r.id,r.store_name,r.store_address,r.city,r.series_id,r.product_name,r.price_eur,r.quantity,r.latitude,r.longitude,r.photo_object_key,r.status,r.created_at,COALESCE(v.available_count,0)::int AS available_count,COALESCE(v.unavailable_count,0)::int AS unavailable_count FROM public.stock_reports r LEFT JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE verdict='available') AS available_count,COUNT(*) FILTER (WHERE verdict='unavailable') AS unavailable_count FROM public.stock_votes WHERE report_id=r.id) v ON TRUE WHERE r.status IN ('approved','pending') AND r.expires_at>now() ORDER BY r.created_at DESC LIMIT 100");
        return json({reports:rows.map(r=>({id:r.id,store:r.store_name,address:r.store_address,city:r.city,series:r.series_id,product:r.product_name,price:r.price_eur,qty:r.quantity,lat:r.latitude,lng:r.longitude,status:r.status,createdAt:r.created_at,img:photoUrl(r.photo_object_key),votes:voteSummary(r.available_count,r.unavailable_count)}))},200,request);
      }
      if(url.pathname==="/me/votes"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        const votes=await sql("SELECT v.report_id,v.verdict FROM public.stock_votes v JOIN public.stock_reports r ON r.id=v.report_id WHERE v.voter_user_id=$1 AND r.expires_at>now() ORDER BY v.updated_at DESC LIMIT 100",[user]);
        return json({votes},200,request);
      }
      if(url.pathname==="/me/reputation"&&request.method==="GET"){
        const user=await authenticate(request);
        if(!user)return json({error:"Connexion nécessaire."},401,request);
        const submitted=await sql("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM public.stock_votes v WHERE v.report_id=r.id AND v.verdict='available') >= 2 AND (SELECT COUNT(*) FROM public.stock_votes v WHERE v.report_id=r.id AND v.verdict='available') > (SELECT COUNT(*) FROM public.stock_votes v WHERE v.report_id=r.id AND v.verdict='unavailable'))::int AS confirmed FROM public.stock_reports r WHERE r.user_id=$1 AND r.status IN ('approved','pending') AND r.created_at>now()-interval '90 days'",[user]);
        const helpful=await sql("SELECT COUNT(*)::int AS total FROM public.stock_votes v JOIN public.stock_reports r ON r.id=v.report_id CROSS JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE other.verdict=v.verdict) AS agreeing,COUNT(*) FILTER (WHERE other.verdict<>v.verdict) AS disagreeing FROM public.stock_votes other WHERE other.report_id=v.report_id AND other.voter_user_id<>v.voter_user_id) peer WHERE v.voter_user_id=$1 AND r.created_at>now()-interval '90 days' AND r.status IN ('pending','approved') AND peer.agreeing>=2 AND peer.agreeing>peer.disagreeing",[user]);
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
        const found=await sql("SELECT id,user_id FROM public.stock_reports WHERE id=$1::uuid AND status IN ('pending','approved') AND expires_at>now() LIMIT 1",[id]);
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
        if(Number(request.headers.get("content-length"))>1250000)return json({error:"Photo trop volumineuse."},413,request);
        const raw=await request.text();
        if(raw.length>1250000)return json({error:"Photo trop volumineuse."},413,request);
        let data;
        try{data=JSON.parse(raw)}catch{return json({error:"Données invalides."},400,request);}
        if(!validText(data.store,140)||!validText(data.address,240)||!validText(data.city,120)||!validText(data.product,200)||!ALLOWED_SERIES.has(data.series)||!validCoordinates(Number(data.lat),Number(data.lng)))
          return json({error:"Vérifie les informations du magasin et du produit."},400,request);
        if(data.price!==null&&(typeof data.price!=="number"||data.price<0||data.price>10000))
          return json({error:"Prix invalide."},400,request);
        if(!Number.isInteger(data.qty)||data.qty<1||data.qty>999)return json({error:"Quantité invalide."},400,request);
        if(typeof data.photo!=="string"||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.photo))return json({error:"Photo JPEG obligatoire."},400,request);
        const bytes=Buffer.from(data.photo.split(",")[1],"base64");
        if(bytes.length<1000||bytes.length>700000||bytes[0]!==0xff||bytes[1]!==0xd8)return json({error:"Photo JPEG invalide ou trop volumineuse (700 Ko maximum après compression)."},400,request);
        // Même membre + même adresse + même produit + même série : éviter les renvois
        // involontaires pendant 24 h (sans bloquer les confirmations d'autres membres).
        const duplicates=await sql(
          "SELECT id FROM public.stock_reports WHERE user_id=$1 AND lower(btrim(store_address))=lower(btrim($2)) AND lower(btrim(product_name))=lower(btrim($3)) AND series_id=$4 AND created_at > now() - interval '24 hours' AND status IN ('pending','approved') ORDER BY created_at DESC LIMIT 1",
          [user,data.address.trim(),data.product.trim(),data.series]
        );
        if(duplicates.length){
          return json({error:"Tu as déjà signalé ce produit dans ce magasin au cours des dernières 24 heures.",duplicate:true,existingId:duplicates[0].id},409,request);
        }
        const count=await sql("SELECT count(*)::int AS n FROM public.stock_reports WHERE user_id=$1 AND created_at>now()-interval '24 hours'",[user]);
        if(Number(count[0]?.n)>=5)return json({error:"Maximum 5 signalements par jour pour ce compte."},429,request);
        const addressOk=await validateAddress(data.address,data.city,Number(data.lat),Number(data.lng));
        if(!addressOk)return json({error:"Adresse non confirmée : sélectionne une adresse exacte dans les résultats."},400,request);
        const key="reports/"+randomUUID()+".jpg";
        await uploadPhoto(bytes,key);
        const rows=await sql("INSERT INTO public.stock_reports (user_id,store_name,store_address,city,series_id,product_name,price_eur,quantity,latitude,longitude,photo_object_key,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending') RETURNING id,created_at",[user,data.store.trim(),data.address.trim(),data.city.trim(),data.series,data.product.trim(),data.price,data.qty,data.lat,data.lng,key]);
        return json({ok:true,id:rows[0]?.id,status:"pending",message:"Signalement communautaire envoyé. Il sera affiché comme non vérifié."},201,request);
      }
      return json({error:"Route introuvable"},404,request);
    }catch(error){
      console.error("PokéStock backend:",error?.message||"erreur");
      return json({error:"Service momentanément indisponible."},503,request);
    }
  }
};
