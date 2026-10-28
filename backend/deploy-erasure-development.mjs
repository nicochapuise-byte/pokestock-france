import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export async function deployErasureDevelopment({apiKey,execute=execFileSync,request=fetch}){
 if(typeof apiKey!=='string'||apiKey.length<16||/\s/.test(apiKey))throw Error('Clé serveur manquante ou invalide.');
 // Fixed project and development branch; no target comes from workflow inputs.
 execute('npx',['--yes','neonctl@8.13.1','functions','deploy','pokestock',
  '--project-id','sparkling-bread-53722880','--branch','br-morning-lab-b9mavkej',
  '--src','backend/index.mjs','--runtime','nodejs24','--wait',
  '--env','NEON_ERASURE_API_KEY='+apiKey,'--env','ACCOUNT_ERASURE_ENABLED=true'],
  {env:{...process.env,NEON_API_KEY:apiKey},stdio:['ignore','pipe','pipe'],maxBuffer:10*1024*1024});
 const url='https://br-morning-lab-b9mavkej-pokestock.compute.c-7.eu-central-1.aws.neon.tech/account-erasure/capabilities';
 const response=await request(url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok||(await response.json()).enabled!==true)throw Error('Activation non confirmée.');
 return {branch:'development',enabled:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await deployErasureDevelopment({apiKey:process.env.NEON_ERASURE_API_KEY});console.log('Effacement automatique activé uniquement en développement.');}
 catch{console.error('Activation non confirmée. Vérifiez le secret NEON_ERASURE_API_KEY et ses droits sur le projet PokéStock. Aucun détail de clé ou de réponse privée n’est journalisé.');process.exitCode=1;}
}
