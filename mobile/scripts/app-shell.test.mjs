import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installAppShell} from '../src/app-shell.mjs';
test('app tabs delegate existing flows and yield navigation to modal focus',async()=>{
 const dom=new JSDOM('<body data-page="home"><div id="carte"></div><nav class="navlinks"><a data-view="map"></a><a data-view="list"></a></nav><button id="openReportTop"></button><button id="watchOpenBtn" hidden></button><button id="accountBtn"></button><div id="watchModal" class="modal"></div></body>',{url:'https://localhost/index.html'});
 const d=dom.window.document;let favorites=0,report=0;
 for(const key of ['map','list'])d.querySelector('[data-view='+key+']').onclick=()=>{d.body.dataset.page=key;};
 d.getElementById('watchOpenBtn').onclick=()=>{favorites++;d.getElementById('watchModal').classList.add('open');};
 d.getElementById('openReportTop').onclick=()=>report++;
 const cleanup=installAppShell(d,dom.window);assert.equal(d.body.dataset.page,'map');installAppShell(d,dom.window);assert.equal(d.querySelectorAll('.app-tabbar').length,1);
 d.querySelector('[data-app-tab=list]').click();await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('[data-app-tab=list]').getAttribute('aria-current'),'true');
 d.querySelector('[data-app-tab=report]').click();assert.equal(report,1);
 d.querySelector('[data-app-tab=favorites]').click();await new Promise(r=>setTimeout(r,0));assert.equal(favorites,1);assert.equal(d.querySelector('.app-tabbar').hidden,true);
 d.getElementById('watchModal').classList.remove('open');await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('.app-tabbar').hidden,false);cleanup();dom.window.close();
});
test('secondary pages keep their existing navigation',()=>{
 const dom=new JSDOM('<body></body>');assert.equal(installAppShell(dom.window.document,dom.window),undefined);assert.equal(dom.window.document.querySelector('.app-tabbar'),null);dom.window.close();
});
