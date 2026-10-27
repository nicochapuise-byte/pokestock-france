import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountOperations,acquireErasureBarrier} from './account-operations.mjs';
const alice='10000000-0000-4000-8000-000000000001',bob='20000000-0000-4000-8000-000000000002',rid='30000000-0000-4000-8000-000000000003';
test('concurrent requests keep separate ownership, register before upload and finish even on failure',async()=>{
 const calls=[];
 const sql=async(query,params)=>{calls.push({query,params});await Promise.resolve();if(query.includes('begin_account_operation'))return[{allowed:true}];if(query.includes('register_account_upload'))return[{registered:true}];return[{id:params[0]}];};
 const operations=createAccountOperations(sql);
 await Promise.all([alice,bob].map(user=>{const request=new Request('https://test/report',{method:'POST'});return operations.run(request,async()=>{await operations.begin(request,user);await operations.begin(request,user);await operations.registerUpload('proofs','reports/'+user+'.jpg');});}));
 const starts=calls.filter(c=>c.query.includes('begin_account_operation')),uploads=calls.filter(c=>c.query.includes('register_account_upload')),finishes=calls.filter(c=>c.query.startsWith('UPDATE'));
 assert.equal(starts.length,2);assert.equal(finishes.length,2);assert.notEqual(starts[0].params[1],starts[1].params[1]);
 for(const start of starts){const upload=uploads.find(c=>c.params[0]===start.params[0]);assert.equal(upload.params[1],start.params[1]);assert(finishes.some(c=>c.params[0]===start.params[1]&&c.params[1]===start.params[0]));}
 const request=new Request('https://test/report',{method:'PATCH'});await assert.rejects(operations.run(request,async()=>{await operations.begin(request,alice);throw Error('validation failure');}));assert.equal(calls.filter(c=>c.query.startsWith('UPDATE')).length,3);
});
test('denied admission and missing request context cannot upload; read-only calls create no lease',async()=>{
 const calls=[];const operations=createAccountOperations(async(query,params)=>{calls.push(query);return[{allowed:false}];});
 const write=new Request('https://test',{method:'POST'});await assert.rejects(operations.begin(write,alice));
 await assert.rejects(operations.run(write,()=>operations.begin(write,alice)),error=>error.status===423);
 await assert.rejects(operations.registerUpload('proofs','reports/test.jpg'));assert.equal(calls.length,1);
 const read=new Request('https://test');await operations.run(read,()=>operations.begin(read,alice));assert.equal(calls.length,1);
});
test('unconfirmed request completion fails closed and a stale writer is never expired automatically',async()=>{
 const operations=createAccountOperations(async query=>query.includes('begin_account_operation')?[{allowed:true}]:[]);
 const request=new Request('https://test',{method:'POST'});await assert.rejects(operations.run(request,()=>operations.begin(request,alice)),/Fin d’opération/);
 for(const active of [1,20])assert.equal((await acquireErasureBarrier(async()=>[{acquired:true,active_operations:active}],{userId:alice,requestId:rid})).quiescent,false);
 assert.equal((await acquireErasureBarrier(async()=>[{acquired:true,active_operations:0}],{userId:alice,requestId:rid})).quiescent,true);
 for(const row of [{acquired:false,active_operations:0},{acquired:true},{acquired:true,active_operations:-1}])await assert.rejects(acquireErasureBarrier(async()=>[row],{userId:alice,requestId:rid}));
});
test('an ambiguous database or storage result retains the active operation instead of declaring it drained',async()=>{
 const calls=[];const operations=createAccountOperations(async(query)=>{calls.push(query);if(query.includes('register_account_upload'))throw Error('Network lost after send');return[{allowed:true}];});
 const request=new Request('https://test',{method:'POST'});
 await assert.rejects(operations.run(request,async()=>{await operations.begin(request,alice);await operations.registerUpload('proofs','reports/unknown.jpg');}));
 assert(!calls.some(query=>query.startsWith('UPDATE')));
 await operations.run(request,async()=>{await operations.begin(request,alice);operations.markUncertain();});
 assert(!calls.some(query=>query.startsWith('UPDATE')));
});
