import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export async function stageErasureProduction({apiKey,execute=execFileSync,request=fetch}){
 if(typeof apiKey!=='string'||apiKey.length<16||/\s/.test(apiKey))throw Error('Clé serveur manquante ou invalide.');
 // Fixed production target. Stage code only; never activate account erasure.
 execute('npx',['--yes','neonctl@8.13.1','functions','deploy','pokestock',
  '--project-id','sparkling-bread-53722880','--branch','br-nameless-math-b9dyokxp',
  '--src','backend/index.mjs','--runtime','nodejs24','--wait',
  '--env','ACCOUNT_ERASURE_ENABLED=false'],
  {env:{...process.env,NEON_API_KEY:apiKey},stdio:['ignore','pipe','pipe'],maxBuffer:10*1024*1024});
 const url='https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech/account-erasure/capabilities';
 const response=await request(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok||(await response.json()).enabled!==false)throw Error('Préparation non confirmée.');
 return {branch:'production',enabled:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await stageErasureProduction({apiKey:process.env.NEON_ERASURE_API_KEY});console.log('Serveur de production préparé ; effacement automatique désactivé.');}
 catch{console.error('Préparation non confirmée. Vérifiez le secret NEON_ERASURE_API_KEY et ses droits sur le projet PokéStock. Aucun détail de clé ou de réponse privée n’est journalisé.');process.exitCode=1;}
}
