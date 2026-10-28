import test from 'node:test';import assert from 'node:assert/strict';
import {hasRecentErasureSession} from './erasure-session.mjs';
test('recent login requires a live session secret scoped to the JWT owner and immutable creation time',async()=>{
 const request=token=>new Request('https://api.example',{headers:token?{'x-pokestock-session':token}:{}});
 let calls=0;
 const sql=async(query,params)=>{calls++;assert.deepEqual(params,['fixture-session-secret','owner']);assert.match(query,/token=\$1 AND "userId"::text=\$2/);assert.match(query,/"expiresAt">now\(\)/);assert.match(query,/"createdAt">now\(\)-interval '5 minutes'/);assert.match(query,/"createdAt"<=now\(\)/);return[{fresh:true}];};
 for(const token of [null,'short','invalid session secret'])assert.equal(await hasRecentErasureSession(sql,request(token),'owner'),false);
 assert.equal(calls,0);
 assert.equal(await hasRecentErasureSession(sql,request('fixture-session-secret'),'owner'),true);
 for(const rows of [[],[{fresh:false}],[{fresh:'true'}]])assert.equal(await hasRecentErasureSession(async()=>rows,request('fixture-session-secret'),'owner'),false);
 await assert.rejects(hasRecentErasureSession(async()=>{throw Error('database unavailable');},request('fixture-session-secret'),'owner'));
});
