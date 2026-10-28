import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
const root=new URL('../../',import.meta.url),tick=()=>new Promise(r=>setTimeout(r,10));
test('a delayed session refresh cannot restore a deleted local identity',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'https://test.example/index.html',runScripts:'outside-only'}),w=dom.window;let resolve;
 const pending=new Promise(r=>{resolve=r;});w.fixtureAuth=()=>({getSession:()=>pending,signOut:async()=>{}});
 const source=(await readFile(new URL('auth-ui.js',root),'utf8')).replace('const {createAuthClient}=await import("https://esm.sh/@neondatabase/auth?bundle");','const createAuthClient=window.fixtureAuth;');
 w.eval(source);await tick();await w.pokestockApi.clearDeletedSession();resolve({data:{user:{id:'old',email:'old@example.invalid'}}});await tick();assert.equal(w.pokestockApi.getUser(),null);w.close();
});
