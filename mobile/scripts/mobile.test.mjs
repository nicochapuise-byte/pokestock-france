import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {externalDestination,backDestination} from '../src/navigation.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('external URLs stay out of the app WebView, local navigation stays inside',()=>{
  for(const base of ['capacitor://localhost/index.html','https://localhost/index.html']){
    assert.equal(externalDestination('seller.html?id=abc',base),null);
    assert.equal(externalDestination('#carte',base),null);
    assert.equal(externalDestination('https://shop.example/product',base),'https://shop.example/product');
    for(const unsafe of ['javascript:alert(1)','data:text/html,hi','file:///etc/passwd','https://user:pass@example.com'])assert.equal(externalDestination(unsafe,base),null);
  }
});
test('back goes from seller to home, then home tab, then minimizes',()=>{
  assert.equal(backDestination('/seller.html','#foo'),'index.html');
  assert.equal(backDestination('/index.html','#carte'),'#accueil');
  assert.equal(backDestination('/index.html','#accueil'),null);
});
test('native bundle ships local pages and map library, and uses explicit GPS hook',async()=>{
  const html=await readFile(resolve(root,'www/index.html'),'utf8');
  assert.match(html,/viewport-fit=cover/);assert.match(html,/src="native.js"/);assert.match(html,/vendor\/leaflet\/leaflet.js/);
  assert.doesNotMatch(html,/src="https:[^"]*leaflet/);
  const script=await readFile(resolve(root,'www/script.js'),'utf8');
  assert.match(script,/\(window.pokestockNative\|\|navigator.geolocation\)\.getCurrentPosition/);
  assert.match(html,/href="https:\/\/nicochapuise-byte.github.io\/pokestock-france\/admin.html"/);
  for(const page of ['index.html','seller.html']){
    const content=await readFile(resolve(root,'www',page),'utf8');
    const manifest=JSON.parse(/<script id="mobile-scripts" type="application\/json">([\s\S]*?)<\/script>/.exec(content)[1]);
    for(const spec of manifest)await access(resolve(root,'www',spec.src.split('?')[0]));
    assert.equal(manifest.some(s=>s.src==='native.js'),false);
    for(const match of content.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)){
      if(/^[a-z]+:/.test(match[1])||match[1].startsWith('//'))continue;
      await access(resolve(root,'www',match[1]));
    }
  }
  const files=await readdir(resolve(root,'www'));assert(!files.includes('backend'));assert(!files.includes('.env'));assert(!files.includes('admin.html'));
});
test('native configuration does not bypass API origin or auth controls',async()=>{
  const config=JSON.parse(await readFile(resolve(root,'capacitor.config.json'),'utf8'));
  assert.equal(config.server.url,undefined);assert.equal(config.server.allowNavigation,undefined);
  assert.equal(config.android.allowMixedContent,false);assert.equal(config.plugins?.CapacitorHttp?.enabled,undefined);
  const android=await readFile(resolve(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  assert.match(android,/ACCESS_COARSE_LOCATION/);assert.doesNotMatch(android,/ACCESS_BACKGROUND_LOCATION|READ_EXTERNAL_STORAGE|READ_MEDIA_IMAGES/);
  const plist=await readFile(resolve(root,'ios/App/App/Info.plist'),'utf8');assert.match(plist,/NSLocationWhenInUseUsageDescription/);assert.doesNotMatch(plist,/UIBackgroundModes|NSAllowsArbitraryLoads/);
});

test('native auth maps existing UI methods without returning the refresh token',async()=>{
  const {createNativeAuthClient}=await import('../src/auth-adapter.mjs');
  let session={accessToken:'dummy-jwt',refreshToken:'must-remain-native',user:{id:'u',name:'Test'}},signIns=0;
  const client=createNativeAuthClient({getSession:async()=>({session}),signInWithPassword:async options=>{assert.equal(options.email,'test@example.invalid');signIns++;},signUp:async()=>{},signOut:async()=>{session=null;}});
  assert.deepEqual((await client.getSession()).data,{user:{id:'u',name:'Test'}});
  assert.deepEqual((await client.token()).data,{token:'dummy-jwt'});
  await client.signIn.email({email:'test@example.invalid',password:'dummy'});assert.equal(signIns,1);
  await client.signOut();assert.equal((await client.token()).data.token,null);
});
test('late native session cannot restore a signed-out identity',async()=>{
  const {createNativeAuthClient}=await import('../src/auth-adapter.mjs');
  let resolveSession;const client=createNativeAuthClient({getSession:()=>new Promise(resolve=>resolveSession=resolve),signOut:async()=>{}});
  const pending=client.getSession();await Promise.resolve();await client.signOut();
  resolveSession({session:{accessToken:'old',user:{id:'old'}}});assert.equal((await pending).data.user,null);
});
test('native API only forwards configured host, keeps status, JSON, auth and cancellation',async()=>{
  const {createApiFetch}=await import('../src/api-transport.mjs');
  const native=[],web=[];const fetch=createApiFetch('https://api.example.invalid',async options=>{native.push(options);return {status:401,data:{error:'Connexion nécessaire'},headers:{}};},async(...args)=>{web.push(args);return 'web';});
  const response=await fetch('https://api.example.invalid/me/watches',{method:'POST',headers:{Authorization:'Bearer dummy','Content-Type':'application/json'},body:JSON.stringify({variantId:'test'})});
  assert.equal(response.status,401);assert.equal((await response.json()).error,'Connexion nécessaire');
  assert.deepEqual(native[0].data,{variantId:'test'});assert.equal(native[0].headers.authorization,'Bearer dummy');assert.equal(native[0].disableRedirects,true);
  assert.equal(await fetch('https://other.example.invalid/me'),'web');assert.equal(web.length,1);assert.equal(native.length,1);
  const controller=new AbortController();controller.abort();await assert.rejects(fetch('https://api.example.invalid/me',{signal:controller.signal}));assert.equal(native.length,1);
  const controller2=new AbortController();const delayed=createApiFetch('https://api.example.invalid',()=>new Promise(()=>{}),()=>{});
  const pending=delayed('https://api.example.invalid/me',{signal:controller2.signal});controller2.abort();await assert.rejects(pending);
});
test('development is the default and native auth replaces browser cookie flow',async()=>{
  const metadata=JSON.parse(await readFile(resolve(root,'www/mobile-build.json'),'utf8'));
  assert.equal(metadata.environment,process.env.POKESTOCK_MOBILE_ENV||'development');
  const auth=await readFile(resolve(root,'www/auth-ui.js'),'utf8');
  assert.match(auth,/pokestockNative.createAuthClient/);assert.doesNotMatch(auth,/esm.sh|credentials:"include"/);
  if(metadata.environment==='development'){
    const script=await readFile(resolve(root,'www/script.js'),'utf8');assert.doesNotMatch(script,/br-nameless-math/);assert.match(script,/br-morning-lab/);
  }
});
