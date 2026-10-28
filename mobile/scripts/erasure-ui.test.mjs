import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
const root=new URL('../../',import.meta.url),tick=()=>new Promise(r=>setTimeout(r,20));
test('automatic erasure requires typed confirmation and receipt-confirmed completion before clearing session',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'https://test.example/index.html',runScripts:'outside-only'}),w=dom.window,d=w.document;w.AbortSignal=AbortSignal;
 let user={id:'10000000-0000-4000-8000-000000000001',email:'fixture@example.invalid'},cleared=0;const calls=[],receipt='a'.repeat(64),rid='20000000-0000-4000-8000-000000000002';
 w.pokestockApi={getUser:()=>user,getToken:async()=> 'jwt',clearDeletedSession:async()=>{user=null;cleared++;d.dispatchEvent(new w.Event('pokestock:authchanged'));}};
 w.fetch=async(url,options={})=>{calls.push({url:String(url),options});let data={};if(String(url).endsWith('/capabilities'))data={enabled:true};else if(String(url).endsWith('/me/account-deletion'))data={request:null};else if(String(url).endsWith('/prepare'))data={requestId:rid,receiptToken:receipt,state:'prepared'};else if(String(url).endsWith('/status'))data={state:'prepared'};else if(String(url).endsWith('/execute')){assert.equal(options.headers.Authorization,'Bearer '+receipt);data={state:'completed'};}else throw Error('Unexpected URL');return Response.json(data);};
 w.eval(await readFile(new URL('account-deletion.js',root),'utf8'));await tick();d.getElementById('accountDeletionBtn').click();await tick();
 const submit=()=>d.getElementById('accountDeletionForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));submit();await tick();assert(!calls.some(c=>c.url.endsWith('/prepare')));
 d.getElementById('accountDeletionWord').value='SUPPRIMER';d.getElementById('accountDeletionConfirm').checked=true;submit();await tick();await tick();assert.equal(cleared,1);assert.equal(w.localStorage.getItem('pokestock-erasure-receipt'),null);assert.match(d.getElementById('accountDeletionState').textContent,/Compte supprimé/);assert(d.getElementById('accountDeletionForm').hidden);assert(calls.filter(c=>c.url.endsWith('/execute')).length===2);w.close();
});

test('a saved completion receipt recovers after identity disappearance without requesting another login',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'https://test.example/index.html',runScripts:'outside-only'}),w=dom.window,d=w.document;w.AbortSignal=AbortSignal;let login=0;
 const receipt={requestId:'20000000-0000-4000-8000-000000000002',receiptToken:'a'.repeat(64),accountId:'10000000-0000-4000-8000-000000000001'};w.localStorage.setItem('pokestock-erasure-receipt',JSON.stringify(receipt));
 w.pokestockApi={getUser:()=>null,getToken:async()=>{throw Error('No JWT after erasure');},openLogin:()=>login++,clearDeletedSession:async()=>d.dispatchEvent(new w.Event('pokestock:authchanged'))};
 w.fetch=async(url,options={})=>{if(String(url).endsWith('/capabilities'))return Response.json({enabled:true});assert.equal(options.headers.Authorization,'Bearer '+receipt.receiptToken);return Response.json({state:'completed'});};
 w.eval(await readFile(new URL('account-deletion.js',root),'utf8'));await tick();await tick();assert.equal(login,0);assert.equal(w.localStorage.getItem('pokestock-erasure-receipt'),null);assert.match(d.getElementById('accountDeletionState').textContent,/Compte supprimé/);w.close();
});
