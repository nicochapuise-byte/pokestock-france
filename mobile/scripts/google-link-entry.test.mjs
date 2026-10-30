import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installGoogleLinkEntry} from '../src/google-link-entry.mjs';
test('association entry follows account state and opens a fixed beta URL without credentials',()=>{
 const dom=new JSDOM('<button id="signOutBtn">Sortir</button>'),w=dom.window,d=w.document;
 let user=null;w.pokestockApi={getUser:()=>user};
 try{
  const cleanup=installGoogleLinkEntry('development',d,w);
  assert(d.getElementById('googleLinkEntry').hidden);
  user={id:'private-id',email:'private@example.invalid'};d.dispatchEvent(new w.Event('pokestock:authchanged'));
  assert(!d.getElementById('googleLinkEntry').hidden);
  assert.equal(d.querySelector('a').href,'https://nicochapuise-byte.github.io/pokestock-france/associer-google-beta.html');
  assert(!d.body.textContent.includes('private'));
  installGoogleLinkEntry('development',d,w);assert.equal(d.querySelectorAll('#googleLinkEntry').length,1);
  user=null;d.dispatchEvent(new w.Event('pokestock:authchanged'));assert(d.getElementById('googleLinkEntry').hidden);
  cleanup();assert(!d.getElementById('googleLinkEntry'));
 }finally{w.close();}
});
test('production never offers an association with the beta identity service',()=>{
 const dom=new JSDOM('<button id="signOutBtn">Sortir</button>'),w=dom.window;
 try{w.pokestockApi={getUser:()=>({id:'production-user'})};installGoogleLinkEntry('production',w.document,w);assert(!w.document.getElementById('googleLinkEntry'));}
 finally{w.close();}
});
