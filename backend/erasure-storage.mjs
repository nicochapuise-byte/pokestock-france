import {createHash,createHmac} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const hmac=(key,value)=>createHmac('sha256',key).update(value).digest();

// Not exposed over HTTP. Inject credentials for the selected branch only.
// DELETE removes the current branch's live object; it does not certify backup erasure.
export function createErasureStorage({endpoint,region,accessKeyId,secretAccessKey,fetcher=fetch,clock=()=>new Date()}){
 const base=new URL(endpoint);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash||!region||!accessKeyId||!secretAccessKey)throw Error('Configuration de stockage invalide.');
 async function send(method,object){
  if(!['proofs','catalog-images'].includes(object?.bucket)||typeof object.key!=='string'||! /^[A-Za-z0-9_./-]{1,512}$/.test(object.key)||object.key.startsWith('/')||object.key.includes('..'))throw Error('Référence de fichier invalide.');
  const url=new URL(base);
  url.pathname=url.pathname.replace(/\/$/,'')+'/'+object.bucket+'/'+object.key.split('/').map(encodeURIComponent).join('/');
  const date=clock().toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=day+'/'+region+'/s3/aws4_request';
  const payload=hash(''),signed='host;x-amz-content-sha256;x-amz-date';
  const canonical=method+'\n'+url.pathname+'\n\nhost:'+url.host+'\nx-amz-content-sha256:'+payload+'\nx-amz-date:'+date+'\n\n'+signed+'\n'+payload;
  const key=hmac(hmac(hmac(hmac('AWS4'+secretAccessKey,day),region),'s3'),'aws4_request');
  const signature=createHmac('sha256',key).update('AWS4-HMAC-SHA256\n'+date+'\n'+scope+'\n'+hash(canonical)).digest('hex');
  try{
   const response=await fetcher(url,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{'x-amz-date':date,'x-amz-content-sha256':payload,Authorization:'AWS4-HMAC-SHA256 Credential='+accessKeyId+'/'+scope+', SignedHeaders='+signed+', Signature='+signature}});
   // Drain/cancel the response without exposing a key, signed URL or provider body.
   await response.body?.cancel();
   if(response.status===404)return false;
   if(response.status>=200&&response.status<300)return true;
   throw Error('Stockage indisponible ('+response.status+').');
  }catch{throw Error('Impossible de confirmer l’état du fichier.');}
 }
 return {
  deleteObject:async object=>{await send('DELETE',object);},
  objectExists:object=>send('HEAD',object)
 };
}
