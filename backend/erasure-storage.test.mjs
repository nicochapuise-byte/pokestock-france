import test from 'node:test';
import assert from 'node:assert/strict';
import {createErasureStorage} from './erasure-storage.mjs';
const object={bucket:'proofs',key:'reports/test-fixture.jpg'};
function fixture(status=204){const calls=[];return {calls,storage:createErasureStorage({endpoint:'https://storage.example/branch',region:'eu-central-1',accessKeyId:'test-key',secretAccessKey:'test-secret',clock:()=>new Date('2026-10-27T00:00:00Z'),fetcher:async(url,options)=>{calls.push({url:String(url),...options});return new Response(null,{status});}})};}
test('storage erasure signs branch-scoped requests, prevents redirects and verifies absence separately',async()=>{
 const {storage,calls}=fixture();await storage.deleteObject(object);assert.equal(await storage.objectExists(object),true);
 assert.deepEqual(calls.map(x=>x.method),['DELETE','HEAD']);assert.equal(calls[0].url,'https://storage.example/branch/proofs/reports/test-fixture.jpg');assert.equal(calls[0].redirect,'error');assert(calls[0].signal instanceof AbortSignal);
 assert.match(calls[0].headers.Authorization,/Credential=test-key\/20261027\/eu-central-1\/s3\/aws4_request/);assert.match(calls[0].headers.Authorization,/Signature=[a-f0-9]{64}$/);assert.notEqual(calls[0].headers.Authorization,calls[1].headers.Authorization);
 const retry=fixture(404).storage;await retry.deleteObject(object);assert.equal(await retry.objectExists(object),false);
});
test('access errors and service failures cannot be mistaken for missing files',async()=>{
 for(const status of [301,400,401,403,429,500,503]){const {storage}=fixture(status);await assert.rejects(storage.objectExists(object),/Impossible/);await assert.rejects(storage.deleteObject(object),/Impossible/);}
 const storage=createErasureStorage({endpoint:'https://storage.example',region:'eu-central-1',accessKeyId:'test',secretAccessKey:'test',fetcher:async()=>{throw Error('secret signed URL');}});
 await assert.rejects(storage.objectExists(object),error=>!error.message.includes('secret'));
});
test('storage erasure refuses unexpected buckets, path traversal and credential-bearing endpoints before network access',async()=>{
 const {storage,calls}=fixture();for(const value of [{bucket:'other',key:'x'},{bucket:'proofs',key:'../x'},{bucket:'proofs',key:'/x'},{bucket:'proofs',key:'x?token=secret'}])await assert.rejects(storage.deleteObject(value));assert.equal(calls.length,0);
 for(const endpoint of ['http://example.com','https://user:pass@example.com','https://example.com?token=secret'])assert.throws(()=>createErasureStorage({endpoint,region:'x',accessKeyId:'x',secretAccessKey:'x'}));
});
