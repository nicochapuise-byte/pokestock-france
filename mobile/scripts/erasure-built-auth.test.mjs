import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
const root=new URL('../www/',import.meta.url),tick=()=>new Promise(resolve=>setTimeout(resolve,20));
test('compiled Android auth retains session proof and reauthentication without storing session secrets',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'https://localhost/',runScripts:'outside-only'}),w=dom.window,d=w.document;
 let user={id:'fixture-owner',email:'fixture@example.invalid'},signOuts=0;
 w.pokestockNative={createAuthClient:()=>({getSession:async()=>({data:{user}}),token:async()=>({data:{token:'fixture-jwt'}}),deletionSessionProof:async()=>'fixture-private-session-proof',signOut:async()=>{signOuts++;user=null;return{data:{}};}})};
 w.eval(await readFile(new URL('auth-ui.js',root),'utf8'));await tick();
 const api=w.pokestockApi;
 assert.equal(await api.getToken(),'fixture-jwt');
 assert.equal(typeof api.getDeletionSessionProof,'function');assert.equal(typeof api.reauthenticateForDeletion,'function');
 assert.equal(await api.getDeletionSessionProof(),'fixture-private-session-proof');
 assert(!JSON.stringify({...w.localStorage,...w.sessionStorage}).includes('fixture-private-session-proof'));
 let prepares=0,executes=0;w.AbortSignal=AbortSignal;
 w.fetch=async(url,options={})=>{
  if(String(url).endsWith('/capabilities'))return Response.json({enabled:true});
  if(String(url).endsWith('/prepare')){prepares++;assert.equal(options.headers['X-Pokestock-Session'],'fixture-private-session-proof');return Response.json({code:'REAUTH_REQUIRED'},{status:403});}
  if(String(url).endsWith('/execute'))executes++;
  return Response.json({request:null});
 };
 w.eval(await readFile(new URL('account-deletion.js',root),'utf8'));await tick();
 d.getElementById('accountDeletionBtn').click();await tick();
 d.getElementById('accountDeletionWord').value='SUPPRIMER';d.getElementById('accountDeletionConfirm').checked=true;
 d.getElementById('accountDeletionForm').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(prepares,1);assert.equal(executes,0);assert.equal(w.localStorage.getItem('pokestock-erasure-receipt'),null);
 assert.equal(signOuts,1);assert.equal(api.getUser(),null);assert(d.getElementById('authModal').classList.contains('open'));
 assert.match(d.getElementById('authStatus').textContent,/Reconnectez-vous/);w.close();
});
