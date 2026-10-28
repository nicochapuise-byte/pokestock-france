import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('CI signing fails closed when credentials are missing or malformed',()=>{
 for(const value of ['', '{}', '{"storePassword":"unsafe"}', 'not JSON']){
  const result=spawnSync(process.execPath,[new URL('./restore-signing.mjs',import.meta.url).pathname],{env:{...process.env,ANDROID_SIGNING_BUNDLE:value},encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/Aucun APK/);assert.equal(result.stdout,'');assert(!result.stderr.includes('unsafe'));
 }
});
