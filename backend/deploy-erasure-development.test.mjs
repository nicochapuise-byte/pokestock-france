import test from 'node:test';import assert from 'node:assert/strict';
import {deployErasureDevelopment} from './deploy-erasure-development.mjs';
test('activation deployment is pinned to development and requires a private management credential',async()=>{
 let calls=0;await assert.rejects(deployErasureDevelopment({apiKey:'',execute:()=>calls++}));assert.equal(calls,0);
 const key='fixture-private-api-key';
 const result=await deployErasureDevelopment({apiKey:key,execute:(binary,args,options)=>{calls++;assert.equal(binary,'npx');assert.equal(args[args.indexOf('--project-id')+1],'sparkling-bread-53722880');assert.equal(args[args.indexOf('--branch')+1],'br-morning-lab-b9mavkej');assert(args.includes('NEON_ERASURE_API_KEY='+key));assert.equal(options.env.NEON_API_KEY,key);assert.deepEqual(options.stdio,['ignore','pipe','pipe']);},request:async url=>{assert(!url.includes(key));assert(url.includes('br-morning-lab-b9mavkej'));return Response.json({enabled:true});}});
 assert.deepEqual(result,{branch:'development',enabled:true});assert.equal(calls,1);
 await assert.rejects(deployErasureDevelopment({apiKey:key,execute:()=>{},request:async()=>Response.json({enabled:false})}));
});
