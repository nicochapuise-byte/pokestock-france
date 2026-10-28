import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';import {createNativeAuthClient} from '../src/auth-adapter.mjs';
const root=new URL('../../',import.meta.url),tick=()=>new Promise(r=>setTimeout(r,10));
test('Google uses the native OAuth plugin and fixed HTTPS callback without returning secrets',async()=>{
 let received;const client=createNativeAuthClient({signInWithOAuth:async options=>{received=options;}},Promise.resolve(),'https://example.com/android-auth-dev.html');
 assert.deepEqual(await client.signIn.social({provider:'google',callbackURL:'https://untrusted.example'}),{data:{pending:true}});assert.deepEqual(received,{provider:'google',redirectTo:'https://example.com/android-auth-dev.html'});await assert.rejects(client.signIn.social({provider:'github'}));
});
test('web Google button invokes Managed Auth and hides after authenticated refresh',async()=>{
 const dom=new JSDOM(await readFile(new URL('index.html',root),'utf8'),{url:'https://nicochapuise-byte.github.io/pokestock-france/index.html',runScripts:'outside-only'}),w=dom.window;let user=null,options;
 w.fixtureAuth=()=>({getSession:async()=>({data:{user}}),signIn:{social:async input=>{options=input;user={name:'Test',email:'test@example.invalid'};return{data:{}};}}});
 const source=(await readFile(new URL('auth-ui.js',root),'utf8')).replace('const {createAuthClient}=await import("https://esm.sh/@neondatabase/auth?bundle");','const createAuthClient=window.fixtureAuth;');
 w.eval(source);await tick();const button=w.document.getElementById('googleSignIn');assert(!button.disabled);button.click();await tick();assert.equal(options.provider,'google');assert.equal(options.callbackURL,'https://nicochapuise-byte.github.io/pokestock-france/index.html');assert(button.hidden);w.close();
});
test('Android callback removes query and forwards only the verifier to a fixed scheme',async()=>{
 const source=await readFile(new URL('android-auth.js',root),'utf8');
 for(const suffix of ['','-dev']){const dom=new JSDOM('<p id="callbackStatus"></p><a id="returnToApp" hidden></a>',{url:'https://nicochapuise-byte.github.io/pokestock-france/android-auth'+suffix+'.html?neon_auth_session_verifier=fixture&redirect=https://evil.example',runScripts:'outside-only'});dom.window.eval(source);assert.equal(dom.window.location.search,'');const link=dom.window.document.getElementById('returnToApp');assert.equal(link.hidden,false);assert.equal(link.href,'fr.pokestock.app'+(suffix?'.dev':'')+'://auth/callback?neon_auth_session_verifier=fixture');dom.window.close();}
});
