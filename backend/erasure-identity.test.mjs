import test from 'node:test';import assert from 'node:assert/strict';import {createErasureIdentity} from './erasure-identity.mjs';
const uid='10000000-0000-4000-8000-000000000001';
test('identity management is pinned to project/branch, rejects redirects and never exposes provider errors or credentials',async()=>{
 let calls=0;const remove=createErasureIdentity({apiKey:'private-fixture',projectId:'test-project',branchId:'br-test',fetcher:async(url,options)=>{calls++;assert.equal(url,'https://console.neon.tech/api/v2/projects/test-project/branches/br-test/auth/users/'+uid);assert.equal(options.headers.Authorization,'Bearer private-fixture');assert.equal(options.redirect,'error');return new Response(null,{status:204});}});await remove(uid);await assert.rejects(remove('other/path'));assert.equal(calls,1);
 for(const status of [301,401,403,429,503]){const failure=createErasureIdentity({apiKey:'private-fixture',projectId:'test-project',branchId:'br-test',fetcher:async()=>new Response('private-fixture',{status})});await assert.rejects(failure(uid),e=>!e.message.includes('private-fixture'));}
});
