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
