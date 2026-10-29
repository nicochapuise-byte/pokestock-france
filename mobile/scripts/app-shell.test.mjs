import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installAppShell} from '../src/app-shell.mjs';
test('app tabs switch directly between favorites, account and map while preserving modal flows',async()=>{
 const dom=new JSDOM('<body data-page="home"><div id="carte"></div><section class="hero"></section><nav class="navlinks"><a data-page-link="home"></a><a data-view="map"></a><a data-view="list"></a></nav><button id="openReportTop"></button><button id="watchOpenBtn" hidden></button><button id="accountBtn"></button><div id="watchModal" class="modal"><section class="modal-card" aria-modal="true"><button class="modal-close"></button></section></div><div id="authModal" class="modal"><section class="modal-card" aria-modal="true"><button class="modal-close"></button></section></div><div id="reportModal" class="modal"></div></body>',{url:'https://localhost/index.html'});
 const d=dom.window.document;let favorites=0,report=0;
 for(const key of ['map','list'])d.querySelector('[data-view='+key+']').onclick=()=>{d.body.dataset.page=key;};
 d.getElementById('watchOpenBtn').onclick=()=>{favorites++;d.getElementById('watchModal').classList.add('open');};
 d.querySelector('[data-page-link=home]').onclick=()=>{d.body.dataset.page='home';};
 d.getElementById('openReportTop').onclick=()=>report++;
 for(const id of ['watchModal','authModal'])d.querySelector('#'+id+' .modal-close').onclick=()=>{d.getElementById(id).classList.remove('open');d.body.style.overflow='';};
 d.getElementById('accountBtn').onclick=()=>d.getElementById('authModal').classList.add('open');
 const cleanup=installAppShell(d,dom.window);assert.equal(d.body.dataset.page,'home');installAppShell(d,dom.window);assert.equal(d.querySelectorAll('.app-tabbar').length,1);
 d.querySelector('[data-app-tab=map]').click();await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('[data-app-tab=map]').getAttribute('aria-current'),'true');
 d.querySelector('[data-app-tab=report]').click();assert.equal(report,1);
 d.querySelector('[data-app-tab=favorites]').click();await new Promise(r=>setTimeout(r,0));assert.equal(favorites,1);assert.equal(d.querySelector('.app-tabbar').hidden,false);
 assert.equal(d.querySelector('#watchModal .modal-card').getAttribute('aria-modal'),'false');
 d.querySelector('[data-app-tab=favorites]').click();assert.equal(favorites,1);
 d.querySelector('[data-app-tab=account]').click();await new Promise(r=>setTimeout(r,0));assert(!d.getElementById('watchModal').classList.contains('open'));assert(d.getElementById('authModal').classList.contains('open'));assert(d.querySelector('[data-app-tab=account]').classList.contains('selected'));
 d.querySelector('[data-app-tab=map]').click();await new Promise(r=>setTimeout(r,0));assert(!d.querySelector('.modal.open'));assert.equal(d.body.dataset.page,'map');
 d.getElementById('reportModal').classList.add('open');await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('.app-tabbar').hidden,true);d.querySelector('[data-app-tab=home]').click();assert.equal(d.body.dataset.page,'map');d.getElementById('reportModal').classList.remove('open');
 d.getElementById('watchModal').classList.remove('open');await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('.app-tabbar').hidden,false);d.querySelector('[data-app-tab=home]').click();await new Promise(r=>setTimeout(r,0));assert.equal(d.body.dataset.page,'home');assert(d.querySelector('.app-welcome'));assert(d.getElementById('welcomeGoogle'));d.getElementById('welcomeExplore').click();assert.equal(d.body.dataset.page,'map');cleanup();dom.window.close();
});
test('secondary pages keep their existing navigation',()=>{
 const dom=new JSDOM('<body></body>');assert.equal(installAppShell(dom.window.document,dom.window),undefined);assert.equal(dom.window.document.querySelector('.app-tabbar'),null);dom.window.close();
});
