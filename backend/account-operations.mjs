import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);

export function createAccountOperations(sql){
 const context=new AsyncLocalStorage();
 return {
  async run(request,task){
   const state={request,operation:null,uncertain:false};
   return context.run(state,async()=>{
    try{return await task();}
    finally{
     if(state.operation&&!state.uncertain){
      const {id,user}=state.operation;
      const rows=await sql('UPDATE public.account_operations SET finished_at=COALESCE(finished_at,now()) WHERE id=$1::uuid AND user_id=$2 RETURNING id',[id,user]);
      if(rows.length!==1)throw Error('Fin d’opération non confirmée.');
     }
    }
   });
  },
  async begin(request,user){
   if(!['POST','PATCH','DELETE','PUT'].includes(request.method))return;
   const state=context.getStore();
   if(!state||state.request!==request||!uuid(user))throw Error('Contexte d’écriture absent.');
   if(state.operation){if(state.operation.user!==user)throw Error('Compte de l’opération incohérent.');return;}
   const id=randomUUID();
   let rows;
   try{rows=await sql('SELECT public.begin_account_operation($1,$2::uuid) AS allowed',[user,id]);}
   catch(error){state.uncertain=true;throw error;}
   if(rows[0]?.allowed!==true)throw Object.assign(Error('Les écritures sont temporairement suspendues. Réessayez dans quelques instants.'),{status:423});
   state.operation={id,user};
  },
  async registerUpload(bucket,key){
   const operation=context.getStore()?.operation;
   if(!operation)throw Error('Téléversement sans opération active.');
   let rows;
   try{rows=await sql('SELECT public.register_account_upload($1,$2::uuid,$3,$4) AS registered',[operation.user,operation.id,bucket,key]);}
   catch(error){context.getStore().uncertain=true;throw error;}
   if(rows[0]?.registered!==true)throw Error('Enregistrement préalable du fichier impossible.');
  },
  markUncertain(){const state=context.getStore();if(state)state.uncertain=true;}
 };
}

// Operator adapter preparation only, not exposed as an API action.
// A failed/abandoned writer is NEVER expired automatically: investigate before
// permitting erasure. A successful lock requires all API versions to track writes.
export async function acquireErasureBarrier(sql,plan){
 if(!uuid(plan.userId)||!uuid(plan.requestId))throw Error('Cible invalide.');
 const rows=await sql('SELECT * FROM public.block_account_erasure($1,$2::uuid)',[plan.userId,plan.requestId]);
 const row=rows[0];
 if(row?.acquired!==true)throw Error('Verrou d’effacement indisponible.');
 if(!Number.isInteger(row.active_operations)||row.active_operations<0)throw Error('État des écritures indisponible.');
 return {requestId:plan.requestId,quiescent:row.active_operations===0,activeOperations:row.active_operations};
}
