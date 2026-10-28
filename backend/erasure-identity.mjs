const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
export function createErasureIdentity({apiKey,projectId,branchId,fetcher=fetch}){
 if(typeof apiKey!=='string'||!apiKey||! /^[a-z0-9-]+$/.test(projectId)||! /^br-[a-z0-9-]+$/.test(branchId))throw Error('Configuration d’identité indisponible.');
 return async userId=>{
  if(!uuid(userId))throw Error('Identité invalide.');
  const url='https://console.neon.tech/api/v2/projects/'+projectId+'/branches/'+branchId+'/auth/users/'+userId;
  try{
   const response=await fetcher(url,{method:'DELETE',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+apiKey}});
   await response.body?.cancel();
   // 404 is only accepted as idempotent here; the executor still independently
   // checks the branch's identity table before touching files or rows.
   if(!response.ok&&response.status!==404)throw Error('Identity API rejected deletion');
  }catch{throw Error('La suppression de l’identité doit être vérifiée avant de poursuivre.');}
 };
}
