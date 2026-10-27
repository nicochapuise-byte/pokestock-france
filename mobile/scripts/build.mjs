import {cp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
const mobile=fileURLToPath(new URL('../',import.meta.url)),root=resolve(mobile,'..'),dest=resolve(mobile,'www');
const environments=JSON.parse(await readFile(resolve(mobile,'config/environments.json'),'utf8'));
const envName=process.env.POKESTOCK_MOBILE_ENV||'development';
const config=environments[envName];if(!config)throw Error('Unknown mobile environment');
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
      ;
    const scripts=[];
    text=text.replace(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/g,(_,before,src,after)=>{
      const type=/type="([^"]+)"/.exec(before+after)?.[1];scripts.push({src,...(type?{type}:{})});return '';
    });
    text=text.replace('</body>','<script id="mobile-scripts" type="application/json">'+JSON.stringify(scripts).replaceAll('<','\\u003c')+'</script>\n<script type="module" src="native.js"></script>\n</body>');
    text=text.replace(/(<(?:script|link)\b[^>]*(?:src|href)="vendor\/leaflet\/[^>]*?)\s+integrity="[^"]*"/g,'$1');
  }
  if(entry.name==='script.js'){
    const original='navigator.geolocation.getCurrentPosition(pos=>{';
    if(!text.includes(original))throw Error('Geolocation integration point changed; review native build.');
    text=text.replace("Autorise la localisation, ou ouvre le site via HTTPS/localhost pour cette fonction.","Localisation indisponible. Autorisez-la dans les réglages du téléphone, ou recherchez une commune.");
    text=text.replace('if(!navigator.geolocation){','if(!window.pokestockNative&&!navigator.geolocation){')
      .replace(original,'(window.pokestockNative||navigator.geolocation).getCurrentPosition(pos=>{');
  }
  if(entry.name==='script.js'){
    const start=text.indexOf('  $("#photoInput").addEventListener("change",async e=>{');
    const end=text.indexOf('  $("#reportForm").addEventListener("submit",async e=>{',start);
    if(start<0||end<start)throw Error('Photo integration point changed');
    let photo=text.slice(start,end);
    photo=photo.replace('$("#photoInput").addEventListener("change",async e=>{','let nativePhotoRevision=0;\n  window.pokestockNative.prepareProofPhoto=async file=>{\n    const revision=++nativePhotoRevision;')
      .replace('const file=e.target.files[0],preview=$("#photoPreview");','const preview=$("#photoPreview");')
      .replace('e.target.value="";','$("#photoInput").value="";')
      .replace('photoData=await imageAsJpeg(file);','const prepared=await imageAsJpeg(file);\n      if(revision!==nativePhotoRevision)return;\n      photoData=prepared;')
      .replace('    }catch(err){','    }catch(err){\n      if(revision!==nativePhotoRevision)return;')
      .replace('      toast(err.message);','      toast(err.message);throw err;');
    const close=photo.lastIndexOf('  });');
    photo=photo.slice(0,close)+'  };\n  $("#photoInput").addEventListener("change",e=>window.pokestockNative.prepareProofPhoto(e.target.files[0]).catch(()=>{}));\n\n';
    text=text.slice(0,start)+photo+text.slice(end);
    text=text.replace('function closeModal(){','function closeModal(){\n  document.dispatchEvent(new Event("pokestock:reportclosed"));');
  }
  if(entry.name==='auth-ui.js'){
    const start=text.indexOf('  async getToken(){'),end=text.indexOf('  getUser(){');
    if(start<0||end<start)throw Error('Auth integration point changed');
    text=text.slice(0,start)+`  async getToken(){
    const response=await client?.token();
    const token=response?.data?.token||null;
    if(!token){currentUser=null;renderAuth();document.dispatchEvent(new Event("pokestock:authchanged"));}
    return token;
  },
`+text.slice(end);
    text+='\ndocument.addEventListener("pokestock:nativeresume",refreshSession);\n';
    text=text.replace('const {createAuthClient}=await import("https://esm.sh/@neondatabase/auth?bundle");','const createAuthClient=window.pokestockNative.createAuthClient;');
  }
  text=text.replaceAll(environments.production.apiUrl,config.apiUrl).replaceAll(environments.production.authUrl,config.authUrl);
  await writeFile(resolve(dest,entry.name),text);
}
await cp(resolve(root,'assets'),resolve(dest,'assets'),{recursive:true});
await mkdir(resolve(dest,'vendor'),{recursive:true});
await cp(resolve(mobile,'node_modules/leaflet/dist'),resolve(dest,'vendor/leaflet'),{recursive:true});
await cp(resolve(mobile,'src/native.css'),resolve(dest,'native.css'));
await build({entryPoints:[resolve(mobile,'src/bootstrap.js')],outfile:resolve(dest,'native.js'),bundle:true,format:'esm',platform:'browser',define:{__MOBILE_CONFIG__:JSON.stringify(config)},target:['safari15','chrome100'],minify:true});
await writeFile(resolve(dest,'mobile-build.json'),JSON.stringify({version:JSON.parse(await readFile(resolve(mobile,'package.json'),'utf8')).version,builtAt:new Date().toISOString(),stage:'native-auth-integration',environment:config.name,auth:'native-plugin-requires-device-validation',apiOrigins:'production-unchanged'},null,2));
console.log('Mobile web bundle generated in mobile/www (not a signed Android/iOS binary).');
