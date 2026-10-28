import test from 'node:test';
import assert from 'node:assert/strict';
import {stageErasureProduction} from './deploy-erasure-production.mjs';
test('production staging requires credentials but never installs a management key or enables erasure',async()=>{
 let calls=0;
 await assert.rejects(stageErasureProduction({apiKey:'',execute:()=>calls++}));
 assert.equal(calls,0);
 const key='fixture-private-project-key';
 const result=await stageErasureProduction({apiKey:key,execute:(binary,args,options)=>{
  calls++;assert.equal(binary,'npx');
  assert.equal(args[args.indexOf('--branch')+1],'br-nameless-math-b9dyokxp');
  assert.equal(args[args.indexOf('--project-id')+1],'sparkling-bread-53722880');
  assert(args.includes('ACCOUNT_ERASURE_ENABLED=false'));
  assert(!args.some(value=>value.includes(key)||value.includes('ENABLED=true')));
  assert.equal(options.env.NEON_API_KEY,key);
  assert.deepEqual(options.stdio,['ignore','pipe','pipe']);
 },request:async url=>{assert(url.includes('br-nameless-math-b9dyokxp'));return Response.json({enabled:false});}});
 assert.equal(calls,1);assert.deepEqual(result,{branch:'production',enabled:false});
});
test('production staging refuses an enabled or unavailable service',async()=>{
 for(const response of [Response.json({enabled:true}),Response.json({enabled:false},{status:503})]){
  await assert.rejects(stageErasureProduction({apiKey:'fixture-private-project-key',execute:()=>{},request:async()=>response}));
 }
});
