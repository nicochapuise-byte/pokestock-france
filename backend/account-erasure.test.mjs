import test from 'node:test';import assert from 'node:assert/strict';
import {readErasurePlan,publicErasurePreview,executeErasure,COUNT_KEYS,purgeAccountRows,verifyAccountEmpty} from './account-erasure.mjs';
import {createErasureStorage} from './erasure-storage.mjs';
const uid='10000000-0000-4000-8000-000000000001',rid='20000000-0000-4000-8000-000000000002';
async function fixture({admin=false,shared=false,status='processing',identity=true}={}){
 const counts=Object.fromEntries(COUNT_KEYS.map(key=>[key,0]));Object.assign(counts,{reports:1,proof_photos:1,proposals:1,deletion_requests:1,admin_roles:admin?1:0});
 const objects=[{bucket:'proofs',key:'reports/erasure-fixture.jpg',shared},{bucket:'catalog-images',key:'proposals/erasure-fixture.jpg',shared:false}];
 const sql=async(query,params)=>{assert.equal(params[0],query.startsWith('SELECT d.id')?rid:uid);if(query.startsWith('SELECT d.id'))return[{id:rid,user_id:uid,status,identity_present:identity}];if(query.startsWith('SELECT\n'))return[counts];return objects;};
 return {plan:await readErasurePlan(sql,rid),sql};
}
function adaptersFor(plan,changes={}){
 const calls=[];const files=new Set(plan.objects.map(o=>o.bucket+'/'+o.key));let identity=plan.identityPresent;
 const adapters={lock:async()=>{calls.push('lock');return{quiescent:true};},refresh:async()=>plan,removeIdentity:async id=>{assert.equal(id,uid);calls.push('identity');identity=false;},identityExists:async()=>identity,deleteObject:async object=>{calls.push('object');files.delete(object.bucket+'/'+object.key);},objectExists:async object=>files.has(object.bucket+'/'+object.key),purgeRows:async current=>{assert.equal(current.userId,uid);calls.push('rows');},verifyEmpty:async()=>true,complete:async receipt=>{assert.deepEqual(receipt,{requestId:rid});calls.push('complete');},failure:async()=>calls.push('failure'),release:async(_,state)=>{calls.push({release:state});},...changes};
 return {adapters,calls};
}
const confirmation=plan=>({confirmation:'EFFACER '+rid,fingerprint:plan.fingerprint});
test('preview is read-only and omits private object keys and identity identifiers',async()=>{
 const {plan}=await fixture();const preview=publicErasurePreview(plan);assert.equal(preview.executable,false);assert.equal(preview.files,2);assert.equal(preview.counts.reports,1);assert(!JSON.stringify(preview).includes(uid));assert(!JSON.stringify(preview).includes('erasure-fixture.jpg'));
 for(const opts of [{admin:true},{shared:true},{status:'requested'}])assert((await fixture(opts)).plan.blocked.length>0);
});
test('explicit confirmation, unchanged target and a quiescent account are required before erasure',async()=>{
 const {plan}=await fixture();const {adapters,calls}=adaptersFor(plan);
 await assert.rejects(executeErasure(plan,adapters,{confirmation:'wrong',fingerprint:plan.fingerprint}));assert.equal(calls.length,0);
 await assert.rejects(executeErasure({...plan,userId:'30000000-0000-4000-8000-000000000003'},adapters,confirmation(plan)));assert.equal(calls.length,0);
 const stopped=adaptersFor(plan,{lock:async()=>({quiescent:false})});await assert.rejects(executeErasure(plan,stopped.adapters,confirmation(plan)));assert(!stopped.calls.includes('identity'));assert(!stopped.calls.includes('rows'));
});
test('identity and file absence must be confirmed before rows and completion',async()=>{
 const {plan}=await fixture();const {adapters,calls}=adaptersFor(plan);assert.deepEqual(await executeErasure(plan,adapters,confirmation(plan)),{ok:true,requestId:rid});assert.deepEqual(calls.slice(0,6),['lock','identity','object','object','rows','complete']);assert.equal(calls.at(-1).release.keepBlocked,true);
 const uncertain=adaptersFor(plan,{identityExists:async()=>undefined});await assert.rejects(executeErasure(plan,uncertain.adapters,confirmation(plan)));assert(!uncertain.calls.includes('object'));assert(!uncertain.calls.includes('complete'));assert.equal(uncertain.calls.at(-1).release.keepBlocked,true);
});
test('partial failures never report completion or release an identity with an uncertain deletion',async()=>{
 const {plan}=await fixture();for(const changes of [{removeIdentity:async()=>{throw Error('Network failure');}},{deleteObject:async()=>{throw Error('Storage unavailable');}},{verifyEmpty:async()=>false}]){
  const {adapters,calls}=adaptersFor(plan,changes);await assert.rejects(executeErasure(plan,adapters,confirmation(plan)));assert(!calls.includes('complete'));assert(calls.includes('failure'));assert.equal(calls.at(-1).release.keepBlocked,true);
 }
 const retry=(await fixture({identity:false})).plan;const next=adaptersFor(retry);await executeErasure(retry,next.adapters,confirmation(retry));assert(!next.calls.includes('identity'));assert(next.calls.includes('complete'));
});
test('rows cleanup is owner and request scoped, and verification fails closed for incomplete counts',async()=>{
 const {plan}=await fixture();let params;await purgeAccountRows(async(query,p)=>{params=p;return[{executed:true}];},plan);assert.deepEqual(params,[uid,rid]);
 await assert.rejects(purgeAccountRows(async()=>[{executed:false}],plan));
 await assert.rejects(verifyAccountEmpty(async query=>query.startsWith('SELECT\n')?[{}]:[],uid));
});
test('a refused storage verification preserves database references for retry',async()=>{
 const {plan}=await fixture();const methods=[];
 const storage=createErasureStorage({endpoint:'https://storage.example/dev',region:'eu-central-1',accessKeyId:'test',secretAccessKey:'test',fetcher:async(url,options)=>{methods.push(options.method);return new Response(null,{status:options.method==='DELETE'?204:403});}});
 const {adapters,calls}=adaptersFor(plan,storage);
 await assert.rejects(executeErasure(plan,adapters,confirmation(plan)));
 assert.deepEqual(methods,['DELETE','HEAD']);assert(!calls.includes('rows'));assert(!calls.includes('complete'));assert(calls.includes('failure'));assert.equal(calls.at(-1).release.keepBlocked,true);
});
