import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../../associer-google-beta.html',import.meta.url),'utf8');
const callback='https://nicochapuise-byte.github.io/pokestock-france/associer-google-beta.html';
const user={id:'existing-user',email:'fixture@example.invalid'};
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function setup({signedIn=false,accounts=[],expected,query='',accountsError=false,completeLink=false,linkError=null}={}){
 const dom=new JSDOM(html,{url:callback+query,runScripts:'outside-only'}),w=dom.window;
 let current=signedIn?user:null;const calls=[];let googleOptions;
 w.google={accounts:{id:{initialize:options=>{googleOptions=options;},renderButton:element=>{element.textContent='Google';}}}};
 w.fixtureAuth=()=>({getSession:async()=>({data:{user:current}}),listAccounts:async()=>accountsError?{error:{}}:{data:accounts},
  signIn:{email:async options=>{calls.push(['email',options]);current=user;return{data:{user}};}},
  linkSocial:async options=>{calls.push(['link',options]);if(linkError)return{error:{code:linkError}};if(completeLink)accounts.push({providerId:'google',userId:user.id});return{data:{status:true,redirect:false}};},
  signOut:async()=>{current=null;return{data:{}};}});
 if(expected)w.sessionStorage.setItem('pokestock-google-link-user',expected);
 const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace("const {createAuthClient}=await import('https://esm.sh/@neondatabase/auth?bundle');",'const createAuthClient=window.fixtureAuth;');
 await w.eval('(async()=>{'+source+'})()');
 return{w,calls,google:()=>googleOptions,get:id=>w.document.getElementById(id),changeSession:value=>{current=value;}};
}
test('existing password login precedes explicit linking and password is cleared',async()=>{
 const {w,calls,get,google}=await setup();
 try{
  assert(get('link').disabled);get('link').click();assert.equal(calls.length,0);
  get('email').value=user.email;get('password').value='fixture-password';
  get('login').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
  assert.equal(get('password').value,'');assert.equal(calls.length,1);assert.equal(calls[0][0],'email');
  assert(!get('link').disabled);get('link').click();await tick();
  assert.equal(calls.length,1);assert.equal(google().ux_mode,'popup');assert.equal(google().auto_select,false);
  assert.match(google().nonce,/^[a-f0-9]{64}$/);
  const response={credential:'fixture-google-token'};await google().callback(response);
  assert.equal(response.credential,'');assert.equal(calls[1][0],'link');const input=calls[1][1];
  assert.equal(input.provider,'google');assert.equal(input.idToken.token,'fixture-google-token');assert.equal(input.idToken.nonce,google().nonce);
  assert.equal(input.callbackURL,undefined);assert.equal(input.errorCallbackURL,undefined);
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

test('Google proof is linked once and success requires server account confirmation',async()=>{
 const {w,get,calls,google}=await setup({signedIn:true,completeLink:true});
 try{
  get('link').click();await tick();const config=google();await config.callback({credential:'fixture-token'});
  assert.equal(get('done').hidden,false);assert.equal(get('return').hidden,false);
  await config.callback({credential:'fixture-token'});assert.equal(calls.length,1);
  assert(!w.sessionStorage.getItem('pokestock-google-link-user'));
  assert(!w.document.body.textContent.includes('fixture-token'));assert.equal(w.location.search,'');
 }finally{w.close();}
});
test('stale Google consent cannot associate after switching or signing out',async()=>{
 for(const signOut of [false,true]){
  const {w,get,calls,google,changeSession}=await setup({signedIn:true});
  try{
   get('link').click();await tick();const config=google();
   if(signOut){get('logout').click();await tick();}else changeSession({id:'other-user'});
   await config.callback({credential:'fixture-token'});assert.equal(calls.length,0);assert(get('done').hidden);
  }finally{w.close();}
 }
});
test('server rejection remains a failure and the token is never displayed',async()=>{
 const {w,get,google}=await setup({signedIn:true,linkError:'LINKING_DIFFERENT_EMAILS_NOT_ALLOWED'});
 try{
  get('link').click();await tick();await google().callback({credential:'fixture-token'});
  assert(get('done').hidden);assert.equal(get('diagnostic').textContent,'Diagnostic : linking_different_emails_not_allowed');
  assert(!w.document.body.textContent.includes('fixture-token'));
 }finally{w.close();}
});
