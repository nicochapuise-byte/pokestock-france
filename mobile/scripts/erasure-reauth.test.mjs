import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
import {createNativeAuthClient} from '../src/auth-adapter.mjs';
const root=new URL('../../',import.meta.url),tick=()=>new Promise(resolve=>setTimeout(resolve,20));
test('native erasure proof uses the session secret rather than the renewable access JWT',async()=>{
 const client=createNativeAuthClient({getSession:async()=>({session:{accessToken:'jwt',refreshToken:'fixture-secret.signature%3D'}})});
 assert.equal(await client.deletionSessionProof(),'fixture-secret');
});
test('stale login opens reauthentication and returning to the same account requires a new confirmation',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'https://test.example/',runScripts:'outside-only'}),w=dom.window,d=w.document;w.AbortSignal=AbortSignal;
 let user={id:'owner'},reauth=0,prepares=0,executes=0;
 w.pokestockApi={getUser:()=>user,getToken:async()=>'jwt',getDeletionSessionProof:async()=>'proof',reauthenticateForDeletion:async()=>{reauth++;user=null;d.dispatchEvent(new w.Event('pokestock:authchanged'));}};
 w.fetch=async url=>{if(String(url).endsWith('/capabilities'))return Response.json({enabled:true});if(String(url).endsWith('/prepare')){prepares++;return Response.json({code:'REAUTH_REQUIRED'},{status:403});}if(String(url).endsWith('/execute'))executes++;return Response.json({request:null});};
 w.eval(await readFile(new URL('account-deletion.js',root),'utf8'));await tick();d.getElementById('accountDeletionBtn').click();await tick();
 d.getElementById('accountDeletionWord').value='SUPPRIMER';d.getElementById('accountDeletionConfirm').checked=true;d.getElementById('accountDeletionForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(reauth,1);assert.equal(prepares,1);assert.equal(executes,0);assert.equal(w.localStorage.getItem('pokestock-erasure-receipt'),null);
 user={id:'owner'};d.dispatchEvent(new w.Event('pokestock:authchanged'));await tick();
 assert(d.getElementById('accountDeletionModal').classList.contains('open'));assert.equal(d.getElementById('accountDeletionWord').value,'');assert.equal(d.getElementById('accountDeletionConfirm').checked,false);assert.equal(prepares,1);assert.equal(executes,0);
 w.sessionStorage.setItem('pokestock-deletion-reauth-owner','owner');user={id:'different-owner'};d.dispatchEvent(new w.Event('pokestock:authchanged'));await tick();assert.match(d.getElementById('authStatus').textContent,/différent/);assert.equal(executes,0);w.close();
});
