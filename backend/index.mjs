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
  const r=await fetch("https://"+host+"/sql",{
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
export default {
  async fetch(request){
    const url=new URL(request.url),headers=cors(request);
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
    try{
      if(url.pathname==="/"&&request.method==="GET")return json({name:"PokéStock API",ok:true},200,request);
      if(url.pathname==="/reports"&&request.method==="GET"){
        const rows=await sql("SELECT id,store_name,store_address,city,series_id,product_name,price_eur,quantity,latitude,longitude,photo_object_key,status,created_at FROM public.stock_reports WHERE status IN ('approved','pending') AND expires_at>now() ORDER BY created_at DESC LIMIT 100");
        return json({reports:rows.map(r=>({id:r.id,store:r.store_name,address:r.store_address,city:r.city,series:r.series_id,product:r.product_name,price:r.price_eur,qty:r.quantity,lat:r.latitude,lng:r.longitude,status:r.status,createdAt:r.created_at,img:photoUrl(r.photo_object_key)}))},200,request);
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
