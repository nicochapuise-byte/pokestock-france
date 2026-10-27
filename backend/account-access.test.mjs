import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';

test('a valid old JWT cannot access the API after identity deletion; database failures fail closed',async()=>{
 process.env.DATABASE_URL='postgres://test:test@ep-test.eu-central-1.aws.neon.tech/neondb';
 process.env.NEON_AUTH_BASE_URL='https://auth.example/neondb/auth';
 process.env.NEON_AUTH_JWKS_URL='https://auth.example/jwks';
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const jwk={...publicKey.export({format:'jwk'}),kid:'fixture'};
 const user='10000000-0000-4000-8000-000000000001';
 const now=Math.floor(Date.now()/1000),encoded=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const payload=encoded({alg:'EdDSA',kid:'fixture'})+'.'+encoded({sub:user,iss:'https://auth.example',iat:now,exp:now+600});
 const token=payload+'.'+sign(null,Buffer.from(payload),privateKey).toString('base64url');
 let present=true,unavailable=false,blocked=false,existenceReads=0,roleReads=0,starts=0,finishes=0;
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  if(String(url)==='https://auth.example/jwks')return Response.json({keys:[jwk]});
  assert.equal(String(url),'https://api.eu-central-1.aws.neon.tech/sql');
  const body=JSON.parse(options.body);
  if(body.query.includes('begin_account_operation')){assert.equal(body.params[0],user);starts++;return Response.json({rows:[{allowed:!blocked}]});}
  if(body.query.startsWith('UPDATE public.account_operations')){assert.equal(body.params[1],user);finishes++;return Response.json({rows:[{id:body.params[0]}]});}
  assert.deepEqual(body.params,[user]);
  if(body.query.startsWith('INSERT INTO public.account_deletion_requests'))throw Error('Ambiguous database response');
  if(body.query.includes('AS present')){existenceReads++;if(unavailable)return Response.json({error:'unavailable'},{status:503});return Response.json({rows:[{present}]});}
  assert.match(body.query,/stock_admins/);roleReads++;return Response.json({rows:[]});
 };
 try{
  const {default:api}=await import('./index.mjs');
  const request=()=>new Request('https://api.example/me/role',{headers:{authorization:'Bearer '+token}});
  assert.equal((await api.fetch(request())).status,200);assert.equal(roleReads,1);
  // Exactly the same signed, unexpired token is now refused, without a cache.
  present=false;assert.equal((await api.fetch(request())).status,401);assert.equal(roleReads,1);assert.equal(existenceReads,2);
  unavailable=true;assert.equal((await api.fetch(request())).status,503);assert.equal(roleReads,1);
  const before=existenceReads;assert.equal((await api.fetch(new Request('https://api.example/me/role',{headers:{authorization:'Bearer invalid'}}))).status,401);assert.equal(existenceReads,before);
  present=true;unavailable=false;
  const write=()=>new Request('https://api.example/me/account-deletion',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({confirmation:'wrong'})});
  assert.equal((await api.fetch(write())).status,400);assert.equal(starts,1);assert.equal(finishes,1);
  blocked=true;assert.equal((await api.fetch(write())).status,423);assert.equal(starts,2);assert.equal(finishes,1);
  blocked=false;
  const uncertain=new Request('https://api.example/me/account-deletion',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({confirmation:'SUPPRIMER'})});
  assert.equal((await api.fetch(uncertain)).status,503);assert.equal(starts,3);assert.equal(finishes,1);

 }finally{globalThis.fetch=original;}
});
