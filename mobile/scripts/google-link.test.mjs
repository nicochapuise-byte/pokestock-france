import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../../associer-google-beta.html',import.meta.url),'utf8');
const callback='https://nicochapuise-byte.github.io/pokestock-france/associer-google-beta.html';
const user={id:'existing-user',email:'fixture@example.invalid'};
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function setup({signedIn=false,accounts=[],expected,query='',accountsError=false}={}){
 const dom=new JSDOM(html,{url:callback+query,runScripts:'outside-only'}),w=dom.window;
 let current=signedIn?user:null;const calls=[];
 w.fixtureAuth=()=>({getSession:async()=>({data:{user:current}}),listAccounts:async()=>accountsError?{error:{}}:{data:accounts},
  signIn:{email:async options=>{calls.push(['email',options]);current=user;return{data:{user}};}},
  linkSocial:async options=>{calls.push(['link',options]);return{data:{url:'https://accounts.google.com/'}};},
  signOut:async()=>{current=null;return{data:{}};}});
 if(expected)w.sessionStorage.setItem('pokestock-google-link-user',expected);
 const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("const {createAuthClient}=await import('https://esm.sh/@neondatabase/auth?bundle');",'const createAuthClient=window.fixtureAuth;');
 await w.eval('(async()=>{'+source+'})()');
 return{w,calls,get:id=>w.document.getElementById(id),changeSession:value=>{current=value;}};
}
test('existing password login precedes explicit linking and password is cleared',async()=>{
 const {w,calls,get}=await setup();
 try{
  assert(get('link').disabled);get('link').click();assert.equal(calls.length,0);
  get('email').value=user.email;get('password').value='fixture-password';
  get('login').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(get('password').value,'');assert.equal(calls.length,1);assert.equal(calls[0][0],'email');
  assert(!get('link').disabled);get('link').click();await tick();
  assert.equal(calls[1][0],'link');const input=calls[1][1];
  assert.equal(input.provider,'google');assert.equal(input.loginHint,user.email);
  assert.equal(input.callbackURL,callback);assert.equal(input.errorCallbackURL,callback);
  assert.equal(w.sessionStorage.getItem('pokestock-google-link-user'),user.id);
  assert(get('return').hidden);assert(get('done').hidden);
 }finally{w.close();}
});
test('only server accounts belonging to the existing user confirm association',async()=>{
 for(const owner of [user.id,'other-user']){
  const {w,get}=await setup({signedIn:true,accounts:[{providerId:'google',userId:owner}],expected:user.id});
  try{assert.equal(get('done').hidden,owner!==user.id);assert.equal(get('return').hidden,owner!==user.id);}
  finally{w.close();}
 }
});
test('changed session or failed account verification blocks linking',async()=>{
 for(const options of [{expected:'other-user'},{accountsError:true}]){
  const {w,get,calls}=await setup({signedIn:true,...options});
  try{assert(get('link').disabled);get('link').click();await tick();assert.equal(calls.length,0);assert(get('done').hidden);}
  finally{w.close();}
 }
 const {w,get,calls,changeSession}=await setup({signedIn:true});
 try{changeSession({id:'other-user'});get('link').click();await tick();assert.equal(calls.length,0);assert(get('done').hidden);}
 finally{w.close();}
});
test('callback error cannot imply success or expose raw diagnostics',async()=>{
 const {w,get}=await setup({signedIn:true,query:'?error=private-detail&error_description=private-secret'});
 try{assert(get('done').hidden);assert.match(get('status').textContent,/pas abouti/);assert(!w.document.body.textContent.includes('private-secret'));assert.equal(get('diagnostic').textContent,'Diagnostic : unclassified_error');assert.equal(w.location.search,'');}
 finally{w.close();}
});
test('known OAuth failure stays visible after the URL is cleaned',async()=>{
 const {w,get}=await setup({signedIn:true,query:'?error=unable_to_link_account&error_description=private-detail'});
 try{assert.equal(get('diagnostic').hidden,false);assert.equal(get('diagnostic').textContent,'Diagnostic : unable_to_link_account');assert.equal(w.location.search,'');assert(!w.document.body.textContent.includes('private-detail'));}
 finally{w.close();}
});
