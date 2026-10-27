// No personal address or client coordinates are used for a private seller.
export function normalizeWebsite(value){
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||value.length>2048)return false;
  try{const u=new URL(value.trim());
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.'))return false;
    return u.href;
  }catch{return false;}
}
export async function resolveCommune(code,fetcher=fetch){
  if(typeof code!=='string'||!/^[0-9AB]{5}$/.test(code))return null;
  const response=await fetcher('https://geo.api.gouv.fr/communes?code='+encodeURIComponent(code)+'&fields=nom,code,centre',{signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw Error('Service des communes indisponible');
  const list=await response.json();
  const c=Array.isArray(list)?list.find(c=>c.code===code):null;
  const [lng,lat]=c?.centre?.coordinates||[];
  if(!c||typeof c.nom!=='string'||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<41||lat>52||lng< -6||lng>10)return null;
  return {city:c.nom,address:c.nom,store:'Particulier',lat,lng,communeCode:c.code};
}
