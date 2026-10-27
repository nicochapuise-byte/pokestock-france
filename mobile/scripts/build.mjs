import {cp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const mobile=fileURLToPath(new URL('../',import.meta.url)),root=resolve(mobile,'..'),dest=resolve(mobile,'www');
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true});
const pages=new Set(['index.html','seller.html']);
for(const entry of await readdir(root,{withFileTypes:true})){
  if(!entry.isFile()||(!pages.has(entry.name)&&! /\.(js|css|svg)$/.test(entry.name)))continue;
  let text=await readFile(resolve(root,entry.name),'utf8');
  if(pages.has(entry.name)){
    text=text.replace('width=device-width,initial-scale=1','width=device-width,initial-scale=1,viewport-fit=cover')
      .replaceAll('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css','vendor/leaflet/leaflet.css')
      .replaceAll('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js','vendor/leaflet/leaflet.js')
      .replaceAll('href="admin.html','href="https://nicochapuise-byte.github.io/pokestock-france/admin.html')
      .replace('</head>','<link rel="stylesheet" href="native.css">\n</head>')
      .replace('</body>','<script type="module" src="native.js"></script>\n</body>');
    text=text.replace(/(<(?:script|link)\b[^>]*(?:src|href)="vendor\/leaflet\/[^>]*?)\s+integrity="[^"]*"/g,'$1');
  }
  if(entry.name==='script.js'){
    const original='navigator.geolocation.getCurrentPosition(pos=>{';
    if(!text.includes(original))throw Error('Geolocation integration point changed; review native build.');
    text=text.replace('if(!navigator.geolocation){','if(!window.pokestockNative&&!navigator.geolocation){')
      .replace(original,'(window.pokestockNative||navigator.geolocation).getCurrentPosition(pos=>{');
  }
  await writeFile(resolve(dest,entry.name),text);
}
await cp(resolve(root,'assets'),resolve(dest,'assets'),{recursive:true});
await mkdir(resolve(dest,'vendor'),{recursive:true});
await cp(resolve(mobile,'node_modules/leaflet/dist'),resolve(dest,'vendor/leaflet'),{recursive:true});
await cp(resolve(mobile,'src/native.css'),resolve(dest,'native.css'));
await build({entryPoints:[resolve(mobile,'src/native.js')],outfile:resolve(dest,'native.js'),bundle:true,format:'esm',platform:'browser',target:['safari15','chrome100'],minify:true});
await writeFile(resolve(dest,'mobile-build.json'),JSON.stringify({version:'0.1.0',builtAt:new Date().toISOString(),stage:'native-foundation',auth:'requires-device-validation',apiOrigins:'production-unchanged'},null,2));
console.log('Mobile web bundle generated in mobile/www (not a signed Android/iOS binary).');
