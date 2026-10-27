/* PokéStock France – administration indépendante des photos d'articles.
   Autorisations contrôlées côté API Neon ; aucune clé privée côté navigateur. */
"use strict";
const ADMIN_API="https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech";
const ADMIN_AUTH="https://ep-dark-bread-b9bd8cco.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth";
const $=id=>document.getElementById(id);
const PLACEHOLDER="catalog-placeholder.svg";
const PHOTO_LIMIT=10*1024*1024;
let jwt=null, jwtExpires=0, catalog=null, listings=[], filtered=[], pageSize=28;
let selectedId="", previewObjectUrl=null, batch=[], batchBusy=false, singleBusy=false, reviewBusy=false;
let cardexImageUrl=null, cardexBusy=false;
const productById=new Map(),seriesById=new Map(),entryById=new Map();

function setMessage(id,message,isError=false){
  const el=$(id);el.textContent=message;el.classList.toggle("is-error",!!isError);
}
function safeImage(url){
  if(url==="catalog-upc151-chat.svg"||url==="catalog-archive-reference.svg")return url;
  try{const parsed=new URL(String(url));if(parsed.protocol==="https:"&&parsed.hostname.endsWith(".neon.tech"))return url;}catch{}
  return PLACEHOLDER;
}
function formatDate(iso){
  if(!iso)return "";
  const date=new Date(iso);
  return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"short",year:"numeric"}).format(date);
}
async function token(){
  if(jwt&&Date.now()<jwtExpires-30000)return jwt;
  const res=await fetch(ADMIN_AUTH+"/token",{
    method:"GET",credentials:"include",
    headers:{"Accept":"application/json"},cache:"no-store",
    signal:AbortSignal.timeout(14000)
  });
  if(!res.ok)throw Error(res.status===401||res.status===403?"Connecte-toi d'abord sur PokéStock.":"Service d'authentification indisponible.");
  const data=await res.json();
  const next=typeof data?.token==="string"?data.token:data?.data?.token;
  if(!next||next.split(".").length!==3)throw Error("Session non validée : reconnecte-toi.");
  jwt=next;
  try{
    const raw=next.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    const payload=JSON.parse(atob(raw));
    jwtExpires=Number(payload.exp)*1000||Date.now()+60000;
  }catch{jwtExpires=Date.now()+60000;}
  return jwt;
}
async function api(path,opts={},retry=true){
  let res;
  try{
    res=await fetch(ADMIN_API+path,{
      method:opts.method||"GET",
      headers:{"Authorization":"Bearer "+await token(),...(opts.body!==undefined?{"Content-Type":"application/json"}:{})},
      body:opts.body===undefined?undefined:JSON.stringify(opts.body),
      cache:"no-store",signal:AbortSignal.timeout(opts.long?30000:16000)
    });
  }catch(err){throw Error(err?.name==="TimeoutError"?"Délai dépassé : vérifie ta connexion.":err?.message||"Service momentanément indisponible.");}
  if(res.status===401&&retry){jwt=null;jwtExpires=0;return api(path,opts,false);}
  let data;try{data=await res.json();}catch{throw Error("Réponse inattendue du serveur.");}
  if(!res.ok)throw Error(data?.error||"Échec de l'opération.");
  return data;
}
function showGate(message,allowed=false){
  $("admProtected").hidden=!allowed;
  $("admGate").hidden=allowed;
  if(!allowed){
    $("admGate").replaceChildren();
    const h=document.createElement("h2");h.textContent=message;
    const p=document.createElement("p");
    p.textContent="Cette page n'est accessible qu'aux comptes administrateurs autorisés.";
    const a=document.createElement("a");a.href="index.html#connexion";a.textContent="→ Se connecter sur PokéStock";
    $("admGate").append(h,p,a);
  }
}
function entryRecords(){
  productById.clear();seriesById.clear();entryById.clear();
  catalog.products.forEach(p=>productById.set(p.id,p));
  catalog.series.forEach((s,i)=>seriesById.set(s.id,{...s,sort:i}));
  listings=catalog.variants.map(v=>{
    const p=productById.get(v.productId);
    const s=p?seriesById.get(p.seriesId):null;
    const entry={...v,product:p,series:s,sort:s?.sort??9999,label:[s?.name||"—",p?.name||"—",v.name].join(" · ")};
    entryById.set(v.id,entry);
    return entry;
  }).sort((a,b)=>a.sort-b.sort||String(a.product?.name||"").localeCompare(String(b.product?.name||""),"fr")||a.name.localeCompare(b.name,"fr"));
}
function fillSeriesSelect(select,placeholder){
  const selected=select.value;select.replaceChildren(new Option(placeholder,""));
  const blocks=new Map();
  for(const s of catalog.series){
    const block=s.block||"Autres séries";
    if(!blocks.has(block))blocks.set(block,[]);
    blocks.get(block).push(s);
  }
  for(const [block,entries] of blocks){
    const group=document.createElement("optgroup");group.label=block;
    for(const s of entries){
      const upcoming=s.releaseDate&&s.releaseDate.slice(0,10)>new Date().toISOString().slice(0,10);
      group.append(new Option((s.code?s.code+" · ":"")+s.name+(upcoming?" 🔜":""),s.id));
    }
    select.append(group);
  }
  if(catalog.series.some(s=>s.id===selected))select.value=selected;
}
function renderStats(){
  const withImages=listings.filter(e=>e.image).length;
  $("admTotal").textContent=listings.length;
  $("admWithImage").textContent=withImages;
  $("admMissing").textContent=listings.length-withImages;
  const percent=listings.length?Math.floor(withImages/listings.length*1000)/10:0;
  $("admProgress").value=percent;
  $("admProgressLabel").textContent=percent+" % avec photo exacte · "+withImages+" photo(s) validée(s) / "+listings.length+" variantes";
  renderOverview();
  const visuals=listings.map(e=>PokestockVisuals.get(e,catalog.variants));
  const boosters=visuals.filter(v=>v.kind==="booster").length;
  const references=visuals.filter(v=>v.kind==="reference").length;
  $("admVisualProgress").value=listings.length?100:0;
  $("admVisualProgressLabel").textContent=(listings.length?"100":"0")+" % des fiches avec un visuel · "+withImages+" photos exactes, "+boosters+" illustrations indicatives de boosters, "+references+" fiche(s) de référence sans photo";
}

function renderOverview(){
  const missing=listings.filter(e=>!e.image);
  const groups=new Map();
  for(const entry of listings){
    const id=entry.series?.id;if(!id)continue;
    if(!groups.has(id))groups.set(id,{series:entry.series,total:0,missing:0});
    const group=groups.get(id);group.total++;if(!entry.image)group.missing++;
  }
  const incomplete=[...groups.values()].filter(g=>g.missing).sort((a,b)=>b.missing-a.missing||a.series.sort-b.series.sort);
  const complete=[...groups.values()].filter(g=>!g.missing).length;
  const empty=catalog.series.filter(s=>!groups.has(s.id)).length;
  $("admIncompleteSeries").textContent=incomplete.length;
  $("admSeriesSummary").textContent=complete+" série(s) avec toutes leurs photos · "+empty+" sans article référencé";
  $("admMissingProducts").textContent=new Set(missing.map(e=>e.productId)).size;
  const root=$("admPriorityList");root.replaceChildren();
  for(const group of incomplete.slice(0,8)){
    const button=document.createElement("button");button.type="button";button.dataset.prioritySeries=group.series.id;
    const title=document.createElement("strong");title.textContent=(group.series.code?group.series.code+" · ":"")+group.series.name;
    const detail=document.createElement("span");detail.textContent=group.missing+" photo(s) manquante(s) / "+group.total+" variantes →";
    button.append(title,detail);root.append(button);
  }
  if(!incomplete.length)root.textContent=listings.length?"Toutes les variantes référencées disposent d’une photo exacte.":"Aucune variante référencée. La couverture ne peut pas encore être évaluée.";
  $("admSnapshotTime").textContent="Catalogue actualisé le "+new Intl.DateTimeFormat("fr-FR",{dateStyle:"short",timeStyle:"short",timeZone:"Europe/Paris"}).format(new Date())+" (heure de Paris).";
}
async function loadOverviewProposals(){
  $("admOverviewPending").textContent="—";
  $("admOverviewPendingStatus").textContent="Chargement…";
  try{
    const data=await api("/admin/catalog/photo-proposals");
    const count=Array.isArray(data.pending)?data.pending.length:0;
    $("admOverviewPending").textContent=count>=100?"100+":count;
    $("admOverviewPendingStatus").textContent=count?"À examiner dans Photos proposées":"Aucune proposition en attente";
    $("admPendingCount").textContent=count?"("+(count>=100?"100+":count)+")":"";
  }catch(error){$("admOverviewPendingStatus").textContent=error.message;}
}

let allSeriesCoverage=[];
async function loadAllSeriesCoverage(){
  if(!catalog)return;
  try{
    const data=await api("/admin/catalog/coverage");
    allSeriesCoverage=Array.isArray(data.series)?data.series:[];
    renderAllSeriesCoverage();
  }catch(error){
    // Fallback derives counts from the current live catalog; still covers all sets.
    allSeriesCoverage=catalog.series.map(serie=>{
      const items=listings.filter(e=>e.series?.id===serie.id);
      return {id:serie.id,name:serie.name,block:serie.block,code:serie.code,
        variants:items.length,products:catalog.products.filter(p=>p.seriesId===serie.id).length,
        images:items.filter(e=>!!e.image).length};
    });
    renderAllSeriesCoverage();
    setMessage("admCoverageSeriesStatus","Détail calculé depuis le catalogue en direct. "+error.message,true);
  }
}
function renderAllSeriesCoverage(){
  const target=$("admCoverageSeriesList");target.replaceChildren();
  const needle=$("admCoverageSeriesSearch").value.trim().toLocaleLowerCase("fr");
  const entries=allSeriesCoverage.filter(s=>[s.name,s.code,s.block].join(" ").toLocaleLowerCase("fr").includes(needle));
  const total=allSeriesCoverage.length;
  if(!entries.length){target.textContent="Aucune extension trouvée.";return;}
  const frag=document.createDocumentFragment();
  for(const series of entries){
    const count=Number(series.variants)||0,completed=Number(series.images)||0;
    const row=document.createElement("div");row.className="adm-series-coverage-row";
    const title=document.createElement("div");title.className="adm-series-coverage-title";
    const strong=document.createElement("strong");
    strong.textContent=(series.id==="me30"?"🎉 ":"")+(series.name||series.id);
    const small=document.createElement("small");
    small.textContent=(series.code?series.code+" · ":"")+(series.block||"Autres")+
      " · "+completed+" / "+count+" photographie(s)";
    const line=document.createElement("progress");line.max=Math.max(1,count);line.value=completed;
    title.append(strong,small,line);
    const btn=document.createElement("button");btn.type="button";btn.dataset.seriesSelect=series.id;
    btn.textContent=count&&completed===count?"✅ Voir":count===0?"Référencer":"📷 Compléter";
    row.append(title,btn);frag.append(row);
  }
  target.append(frag);
  setMessage("admCoverageSeriesStatus",entries.length+" / "+total+" série(s) visibles · progression calculée depuis les variantes du catalogue.");
}

function galleryFiltered(){
  const q=$("admSearch").value.trim().toLocaleLowerCase("fr");
  const sid=$("admSeriesFilter").value,coverage=$("admCoverageFilter").value;
  return listings.filter(e=>(!sid||e.series?.id===sid)&&
    (coverage==="all"||(coverage==="present"?!!e.image:!e.image))&&
    (!q||[e.product?.name,e.name,e.series?.name,e.series?.code,e.id,e.series?.block]
      .join(" ").toLocaleLowerCase("fr").includes(q)));
}
function renderGallery(){
  filtered=galleryFiltered();
  $("admListCount").textContent=filtered.length+" référence(s) correspondante(s)";
  const root=$("admPhotoGallery");root.replaceChildren();
  const fragment=document.createDocumentFragment();
  for(const e of filtered.slice(0,pageSize)){
    const visual=PokestockVisuals.get(e,catalog.variants);
    const article=document.createElement("article");article.className="adm-product";
    const cover=document.createElement("div");cover.className="adm-photo";
    const img=document.createElement("img");
    img.loading="lazy";img.src=safeImage(visual.image);
    img.alt=visual.kind==="exact"?"Photographie de "+e.product.name+" / "+e.name:visual.description;
    img.onerror=()=>{img.onerror=null;img.src=PokestockVisuals.referenceImage;badge.textContent="Photo indisponible";badge.classList.remove("has-image");};
    const badge=document.createElement("span");badge.className="adm-image-badge"+(e.image?" has-image":"");
    badge.textContent=visual.label;cover.append(img,badge);
    const body=document.createElement("div");body.className="adm-product-body";
    const category=document.createElement("span");category.className="adm-series";
    category.textContent=(e.series?.code?e.series.code+" · ":"")+(e.series?.name||"—")+(e.series?.releaseDate?" · "+formatDate(e.series.releaseDate):"");
    const title=document.createElement("strong");title.textContent=e.product?.name||"Référence inconnue";
    const variation=document.createElement("p");variation.textContent="🎨 "+e.name;
    const visualNote=document.createElement("small");
    visualNote.textContent=visual.kind==="exact"?"":visual.description;
    const code=document.createElement("small");code.textContent=e.id;
    const button=document.createElement("button");button.type="button";button.dataset.selectId=e.id;
    button.textContent=e.image?"🔄 Changer la photo":"📸 Ajouter la photo";button.className=e.image?"adm-replace":"";
    const cardex=document.createElement("button");
    cardex.type="button";cardex.dataset.pokecardexId=e.id;
    cardex.className="adm-cardex-card-action";
    cardex.textContent="🌐 Depuis PokéCardex";
    body.append(category,title,variation,visualNote,code,button,cardex);article.append(cover,body);fragment.append(article);
  }
  root.append(fragment);
  if(!filtered.length){
    const empty=document.createElement("p");empty.className="adm-empty";
    empty.textContent="Aucun produit ne correspond à ces filtres.";root.append(empty);
  }
  $("admGalleryMore").hidden=filtered.length<=pageSize;
}
function selectPanel(panel){
  for(const b of document.querySelectorAll(".adm-tab[data-panel]")){
    const active=b.dataset.panel===panel;
    b.classList.toggle("is-active",active);
    if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  }
  const panels={overview:"admOverviewPanel",gallery:"admGalleryPanel",upload:"admUploadPanel",bulk:"admBulkPanel",cardex:"admCardexPanel",proposals:"admProposalsPanel"};
  for(const [key,id] of Object.entries(panels))$(id).hidden=key!==panel;
  if(panel==="proposals")refreshProposals();
  if(window.innerWidth<=690){
    document.querySelector(".adm-tabs")?.scrollIntoView({behavior:"smooth",block:"start"});
  }
}
function populateArticleSelect(seriesId){
  const select=$("admPickProduct");select.replaceChildren(new Option("Choisir un article",""));
  const products=catalog.products.filter(p=>p.seriesId===seriesId);
  for(const p of products)select.add(new Option(p.name,p.id));
  select.disabled=!products.length;
}
function populateVariantSelect(productId){
  const select=$("admPickVariant");select.replaceChildren(new Option("Choisir un art set / une variante",""));
  const variants=catalog.variants.filter(v=>v.productId===productId);
  for(const v of variants)select.add(new Option(v.name,v.id));
  select.disabled=!variants.length;
}
function setSelected(id){
  selectedId=id;
  const e=entryById.get(id);
  $("admCurrentImage").src=safeImage(PokestockVisuals.get(e,catalog.variants).image);
  $("admSelectedInfo").textContent=e
    ?(e.series?.name||"")+" → "+(e.product?.name||"")+" → "+e.name
    :"Choisis une référence précise pour attribuer sa photographie.";
  if(e?.image){
    $("admSelectedInfo").textContent+=" · Une photo est déjà associée à cette variante. L'import la remplacera.";
  }
  else if(e){$("admSelectedInfo").textContent+=" · "+PokestockVisuals.get(e,catalog.variants).description;}
}
function selectEntryForUpload(id){
  const e=entryById.get(id);
  if(!e)return;
  $("admPickSeries").value=e.series?.id||"";
  populateArticleSelect(e.product?.seriesId||"");
  $("admPickProduct").value=e.product?.id||"";
  populateVariantSelect(e.product?.id||"");
  $("admPickVariant").value=id;
  setSelected(id);selectPanel("upload");
}
function renderUploadSelectors(){
  fillSeriesSelect($("admPickSeries"),"Choisir une extension");
  if(selectedId&&entryById.has(selectedId)){selectEntryForUpload(selectedId);return;}
  $("admPickProduct").replaceChildren(new Option("Choisir une série",""));$("admPickProduct").disabled=true;
  $("admPickVariant").replaceChildren(new Option("Choisir un produit",""));$("admPickVariant").disabled=true;
  setSelected("");
}
function clearPreview(){
  if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl=null;$("admNewImage").src=PLACEHOLDER;
}
function picturePreview(file,id){
  if(!file){if(id==="admNewImage")clearPreview();return;}
  if(id==="admNewImage")clearPreview();
  const url=URL.createObjectURL(file);
  if(id==="admNewImage")previewObjectUrl=url;
  const img=$(id);img.src=url;
  img.onerror=()=>{img.onerror=null;img.src=PLACEHOLDER;};
}
function csvMissing(){
  const items=listings.filter(x=>!x.image);
  const quote=s=>'"'+String(s??"").replaceAll('"','""')+'"';
  const header=["Identifiant","Série","Code","Article","Art set","Nom de fichier conseillé"];
  const rows=[header,...items.map(e=>[e.id,e.series?.name,e.series?.code,e.product?.name,e.name,e.id+".jpg"])];
  const content="\ufeff"+rows.map(row=>row.map(quote).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="pokestock-photos-manquantes.csv";
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function compressPhoto(file){
  if(!file?.type.startsWith("image/")||file.size>PHOTO_LIMIT)throw Error("Sélectionne une image valide de 10 Mo maximum.");
  const objectUrl=URL.createObjectURL(file);
  let img;
  try{
    img=await new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(Error("Cette image n'est pas lisible sur l'appareil."));
      image.src=objectUrl;
    });
  }finally{URL.revokeObjectURL(objectUrl);}
  if(!img.naturalWidth||!img.naturalHeight)throw Error("Photo illisible.");
  const canvas=document.createElement("canvas");
  let max=1180;
  for(let iteration=0;iteration<3;iteration++){
    const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw Error("Impossible de préparer l'image.");
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [.76,.63,.5]){
      const jpg=canvas.toDataURL("image/jpeg",quality);
      // Le serveur refuse les JPEG de plus de 650 Ko et les requêtes de plus de 1,1 Mo.
      if(Math.floor((jpg.length-23)*.75)<=570000)return jpg;
    }
    max=Math.round(max*.72);
  }
  throw Error("L'image reste trop volumineuse après compression.");
}
async function uploadImage(variantId,file,rights){
  const photo=await compressPhoto(file);
  return api("/admin/catalog/variants/"+encodeURIComponent(variantId)+"/image",{
    method:"POST",body:{photo,rightsNote:rights,rightsConfirmed:true},long:true
  });
}
async function reloadCatalog(){
  const previousSeries=$("admSeriesFilter").value,selected=selectedId;
  const response=await fetch(ADMIN_API+"/catalog",{cache:"no-store",signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw Error("Impossible de charger les séries Pokémon.");
  const data=await response.json();
  if(!Array.isArray(data.series)||!Array.isArray(data.products)||!Array.isArray(data.variants))throw Error("Catalogue invalide.");
  catalog=data;entryRecords();renderStats();
  fillSeriesSelect($("admSeriesFilter"),"Toutes les séries");
  $("admSeriesFilter").value=catalog.series.some(s=>s.id===previousSeries)?previousSeries:"";
  renderGallery();
  fillSeriesSelect($("admPickSeries"),"Choisir une extension");
  renderCardexVariants();
  if(selected&&entryById.has(selected)){
    const e=entryById.get(selected);
    $("admPickSeries").value=e.series?.id||"";
    populateArticleSelect(e.product?.seriesId);
    $("admPickProduct").value=e.product.id;
    populateVariantSelect(e.product.id);
    $("admPickVariant").value=selected;
    setSelected(selected);
  }
  await loadAllSeriesCoverage();
  await loadOverviewProposals();
}
function batchClear(){
  for(const item of batch)if(item.previewUrl)URL.revokeObjectURL(item.previewUrl);
  batch=[];$("admBulkItems").replaceChildren();
}
function renderBatch(){
  const holder=$("admBulkItems");holder.replaceChildren();
  for(const item of batch){
    const row=document.createElement("div");row.className="adm-bulk-item";
    const img=document.createElement("img");img.src=item.previewUrl;img.alt="Photo : "+item.file.name;
    const body=document.createElement("div");
    const name=document.createElement("strong");name.textContent=item.file.name;
    const desc=document.createElement("small");desc.textContent=item.id?"✅ Variante associée":"⚠️ Choisir une référence";
    const sel=document.createElement("select");sel.setAttribute("aria-label","Associer "+item.file.name);
    sel.add(new Option("Choisir l'art set correct",""));
    for(const e of listings)sel.add(new Option(e.label+" ["+e.id+"]",e.id));
    sel.value=item.id;sel.addEventListener("change",()=>{
      item.id=sel.value;desc.textContent=item.id?"✅ Variante associée":"⚠️ Choisir une référence";updateBatchState();
    });
    body.append(name,desc,sel);row.append(img,body);holder.append(row);
  }
  updateBatchState();
}
function updateBatchState(){
  const selected=batch.filter(x=>x.id);
  const duplicates=new Set(selected.map(x=>x.id)).size!==selected.length;
  $("admBulkSend").disabled=batchBusy||!batch.length||selected.length!==batch.length||duplicates;
  if(duplicates)setMessage("admBulkStatus","⚠️ Deux images ne peuvent pas cibler la même variante.",true);
  else if(batch.length)setMessage("admBulkStatus",selected.length+" / "+batch.length+" références associées.");
}
async function uploadBatch(){
  if(batchBusy||!batch.length)return;
  const rights=$("admBulkRights").value.trim();
  if(rights.length<5||!$("admBulkRightsCheck").checked){setMessage("admBulkStatus","Renseigne et confirme les droits sur toutes les photos.",true);return;}
  if(batch.some(x=>!x.id)||new Set(batch.map(x=>x.id)).size!==batch.length){setMessage("admBulkStatus","Associe chaque fichier à une variante différente.",true);return;}
  if(!$("admBulkReplace").checked&&batch.some(x=>entryById.get(x.id)?.image)){setMessage("admBulkStatus","Une variante possède déjà une photo : autorise son remplacement ou change la sélection.",true);return;}
  if(!confirm("Associer "+batch.length+" photo(s) aux variantes choisies ? Vérifie bien chaque art set."))return;
  batchBusy=true;updateBatchState();let done=0;const errors=[];
  for(const [n,item] of [...batch].entries()){
    setMessage("admBulkStatus","⏳ Envoi "+(n+1)+" / "+batch.length+" · "+item.file.name);
    try{await uploadImage(item.id,item.file,rights);done++;}
    catch(e){errors.push(item.file.name+": "+e.message);}
  }
  batchBusy=false;
  batchClear();$("admBulkFiles").value="";updateBatchState();
  setMessage("admBulkStatus","✅ "+done+" photo(s) enregistrée(s)."+(errors.length?" ⚠️ "+errors.slice(0,3).join(" | "):""),!!errors.length);
  if(done)await reloadCatalog().catch(e=>setMessage("admBulkStatus",e.message,true));
}
async function refreshProposals(){
  if(reviewBusy)return;
  setMessage("admProposalStatus","⏳ Chargement des propositions...");
  const root=$("admProposals");root.replaceChildren();
  try{
    const data=await api("/admin/catalog/photo-proposals");
    const items=data.pending||[];
    $("admOverviewPending").textContent=items.length>=100?"100+":items.length;
    $("admOverviewPendingStatus").textContent=items.length?"À examiner dans Photos proposées":"Aucune proposition en attente";
    $("admPendingCount").textContent=items.length?"("+items.length+")":"";
    if(!items.length){setMessage("admProposalStatus","✅ Aucune photographie en attente.");return;}
    setMessage("admProposalStatus",items.length+" photo(s) à vérifier.");
    const fragment=document.createDocumentFragment();
    for(const item of items){
      const card=document.createElement("article");card.className="adm-proposal";
      const image=document.createElement("img");image.src=safeImage(item.image);image.alt="Photographie proposée pour "+item.product_name;
      image.onerror=()=>{image.onerror=null;image.src=PLACEHOLDER;};
      const content=document.createElement("div");
      const title=document.createElement("strong");title.textContent=item.series_name+" → "+item.product_name+" / "+item.variant_name;
      const rights=document.createElement("p");rights.textContent="Droits déclarés : "+item.rights_note;
      const action=document.createElement("div");action.className="adm-review-actions";
      for(const [decision,label]of [["approved","✅ Approuver"],["rejected","❌ Refuser"]]){
        const button=document.createElement("button");button.type="button";
        button.dataset.reviewId=item.id;button.dataset.decision=decision;
        button.textContent=label;if(decision==="rejected")button.className="reject";
        action.append(button);
      }
      content.append(title,rights,action);card.append(image,content);fragment.append(card);
    }
    root.append(fragment);
  }catch(e){setMessage("admProposalStatus",e.message,true);}
}

function cardexSafeUrl(value){
  try{
    const url=new URL(value);
    const allowed=new Set(["pokecardex.com","www.pokecardex.com","pokecardex.b-cdn.net","cdn.pokecardex.com","assets.pokecardex.com"]);
    return url.protocol==="https:"&&allowed.has(url.hostname)?url.href:null;
  }catch{return null;}
}
function renderCardexVariants(){
  if(!catalog)return;
  const choice=$("admCardexVariant"),term=$("admCardexSearch").value.trim().toLocaleLowerCase("fr");
  const previous=choice.value;
  choice.replaceChildren(new Option("Sélectionne un produit et sa variante",""));
  for(const entry of listings){
    if(term&&!entry.label.toLocaleLowerCase("fr").includes(term)&&!entry.id.toLowerCase().includes(term))continue;
    choice.add(new Option((entry.image?"📷 ":"")+entry.label,entry.id));
  }
  if([...choice.options].some(option=>option.value===previous))choice.value=previous;
  else if(selectedId&&[...choice.options].some(option=>option.value===selectedId))choice.value=selectedId;
  $("admCardexTarget").textContent=choice.value&&entryById.has(choice.value)
    ?"🎨 "+entryById.get(choice.value).label
    :"Sélectionne la référence précise, puis choisis la photo correspondante.";
  $("admCardexImport").disabled=!choice.value||!cardexImageUrl||cardexBusy;
}
function setCardexChoice(id){
  if(!entryById.has(id))return;
  selectedId=id;$("admCardexSearch").value="";
  renderCardexVariants();
  $("admCardexVariant").value=id;
  $("admCardexTarget").textContent="🎨 "+entryById.get(id).label;
  $("admCardexImport").disabled=!cardexImageUrl;
  selectPanel("cardex");
}
function renderCardexCandidates(candidates){
  const root=$("admCardexCandidates");root.replaceChildren();
  cardexImageUrl=null;$("admCardexChosenImage").src=PLACEHOLDER;
  $("admCardexImport").disabled=true;
  if(!candidates.length){
    setMessage("admCardexFindStatus","Aucune image détectée. Sur PokéCardex, ouvre directement une image et copie son adresse, puis relance la recherche.",true);return;
  }
  const frag=document.createDocumentFragment();
  for(const item of candidates){
    const url=cardexSafeUrl(item.url);if(!url)continue;
    const button=document.createElement("button");button.type="button";button.className="adm-cardex-candidate";
    const picture=document.createElement("img");
    picture.src=url;picture.loading="lazy";picture.alt="Image issue de PokéCardex — à vérifier";
    picture.onerror=()=>{picture.onerror=null;picture.src=PLACEHOLDER;};
    const label=document.createElement("span");label.textContent="Choisir cette image";
    button.append(picture,label);
    button.addEventListener("click",()=>{
      root.querySelectorAll(".adm-cardex-candidate").forEach(el=>el.classList.remove("is-selected"));
      button.classList.add("is-selected");
      cardexImageUrl=url;
      $("admCardexChosenImage").src=url;
      $("admCardexChosenImage").onerror=()=>{$("admCardexChosenImage").onerror=null;$("admCardexChosenImage").src=PLACEHOLDER;};
      $("admCardexImport").disabled=!$("admCardexVariant").value;
      setMessage("admCardexImportStatus","Photo sélectionnée. Vérifie qu'elle correspond à l'art set choisi.");
    });
    frag.append(button);
  }
  root.append(frag);
  setMessage("admCardexFindStatus",root.children.length+" image(s) trouvée(s) sur PokéCardex. Choisis visuellement la bonne.");
}
async function findCardexImages(){
  if(cardexBusy)return;
  const url=cardexSafeUrl($("admCardexPageUrl").value.trim());
  if(!url){setMessage("admCardexFindStatus","Colle un lien HTTPS du site PokéCardex ou l'adresse d'une image hébergée sur PokéCardex.",true);return;}
  cardexBusy=true;$("admCardexFind").disabled=true;
  setMessage("admCardexFindStatus","⏳ Recherche des photographies dans la page PokéCardex...");
  try{
    const response=await api("/admin/catalog/pokecardex/candidates",{method:"POST",body:{pageUrl:url},long:true});
    renderCardexCandidates(response.candidates||[]);
  }catch(error){
    $("admCardexCandidates").replaceChildren();
    setMessage("admCardexFindStatus","⚠️ "+error.message+" — essaie une adresse directe de l'image.",true);
  }finally{cardexBusy=false;$("admCardexFind").disabled=false;}
}
async function importCardexSelected(){
  if(cardexBusy)return;
  const id=$("admCardexVariant").value,pageUrl=cardexSafeUrl($("admCardexPageUrl").value.trim());
  const rightsNote=$("admCardexRights").value.trim();
  if(!id||!cardexImageUrl||!pageUrl){setMessage("admCardexImportStatus","Choisis un produit, une fiche source et une photographie.",true);return;}
  if(rightsNote.length<5||!$("admCardexRightsConfirm").checked){
    setMessage("admCardexImportStatus","Indique l'origine et confirme les droits de réutilisation.",true);return;
  }
  const entry=entryById.get(id);
  if(!confirm("Associer l'image PokéCardex à : "+entry?.label+" ? Elle deviendra la photo principale de cet art set."))return;
  cardexBusy=true;$("admCardexImport").disabled=true;
  setMessage("admCardexImportStatus","⏳ Importation de l'image dans la base de données Neon...");
  try{
    const result=await api("/admin/catalog/variants/"+encodeURIComponent(id)+"/import-pokecardex",{
      method:"POST",body:{imageUrl:cardexImageUrl,pageUrl,rightsNote,rightsConfirmed:true},long:true
    });
    await reloadCatalog();
    setMessage("admCardexImportStatus","✅ "+result.message+" La photo s'affiche désormais sur les signalements de cette référence.");
    $("admCardexRightsConfirm").checked=false;
  }catch(error){setMessage("admCardexImportStatus","⚠️ "+error.message,true);}
  finally{cardexBusy=false;$("admCardexImport").disabled=!$("admCardexVariant").value||!cardexImageUrl;}
}


let bulkCardexBusy=false;
async function findBulkCardexPages(){
  if(bulkCardexBusy)return;
  const status=$("admCardexBulkStatus");
  const links=[...new Set($("admCardexBulkUrls").value.split(/\s+/).map(s=>s.trim()).filter(Boolean))];
  if(!links.length||links.length>6){
    setMessage("admCardexBulkStatus","Colle entre 1 et 6 liens de produits PokéCardex (un par ligne).",true);return;
  }
  if(links.some(link=>!cardexSafeUrl(link))){
    setMessage("admCardexBulkStatus","Certains liens ne proviennent pas de PokéCardex en HTTPS.",true);return;
  }
  bulkCardexBusy=true;$("admCardexBulkFind").disabled=true;
  $("admCardexBulkResults").replaceChildren();
  setMessage("admCardexBulkStatus","⏳ Analyse de "+links.length+" fiche(s) PokéCardex...");
  try{
    const data=await api("/admin/catalog/pokecardex/bulk-candidates",{
      method:"POST",body:{urls:links},long:true
    });
    const results=data.results||[];
    const root=$("admCardexBulkResults");root.replaceChildren();
    let success=0;
    for(const row of results){
      const card=document.createElement("article");card.className="adm-bulk-cardex-row";
      const preview=document.createElement("img");
      const url=cardexSafeUrl((row.images||[])[0]?.url||"");
      preview.src=url||PLACEHOLDER;
      preview.alt="Illustration trouvée pour "+(row.title||"fiche PokéCardex");
      preview.loading="lazy";
      preview.onerror=()=>{preview.onerror=null;preview.src=PLACEHOLDER;};
      const box=document.createElement("div");
      const title=document.createElement("strong");
      title.textContent=row.title||row.pageUrl.split("/").slice(-1)[0];
      const desc=document.createElement("small");
      desc.textContent=row.error?"⚠️ "+row.error:(row.images||[]).length+" illustration(s) candidate(s)";
      box.append(title,desc);
      if(!row.error&&(row.images||[]).length){
        success++;
        const button=document.createElement("button");button.type="button";
        button.textContent="🎴 Attribuer à un art set";
        button.addEventListener("click",()=>{
          $("admCardexPageUrl").value=row.pageUrl;
          renderCardexCandidates(row.images);
          setMessage("admCardexImportStatus","Sélectionne la bonne image puis le bon art set ; une correspondance n'est jamais attribuée automatiquement.");
          $("admCardexVariant").value="";
          $("admCardexImport").disabled=true;
          $("admCardexPageUrl").scrollIntoView({behavior:"smooth",block:"center"});
        });
        box.append(button);
      }
      card.append(preview,box);root.append(card);
    }
    setMessage("admCardexBulkStatus",success+" / "+results.length+" fiche(s) contiennent des images candidates. Vérifie chaque variante avant de la publier.",success===0);
  }catch(error){
    setMessage("admCardexBulkStatus","⚠️ "+(error.message||"Impossible de consulter PokéCardex."),true);
  }finally{bulkCardexBusy=false;$("admCardexBulkFind").disabled=false;}
}

function attachEvents(){
  document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>selectPanel(b.dataset.panel)));
  for(const id of ["admSearch","admSeriesFilter","admCoverageFilter"]){
    $(id).addEventListener(id==="admSearch"?"input":"change",()=>{pageSize=28;renderGallery();});
  }
  $("admOverviewExport").addEventListener("click",csvMissing);
  $("admPriorityList").addEventListener("click",event=>{
    const button=event.target.closest("[data-priority-series]");if(!button)return;
    $("admSearch").value="";$("admSeriesFilter").value=button.dataset.prioritySeries;
    $("admCoverageFilter").value="missing";pageSize=28;renderGallery();selectPanel("gallery");
  });
  $("admOverviewRefresh").addEventListener("click",async()=>{
    const button=$("admOverviewRefresh");button.disabled=true;
    try{await reloadCatalog();}catch(error){setMessage("admSnapshotTime","Actualisation impossible : "+error.message,true);}
    finally{button.disabled=false;}
  });
  $("admGalleryMore").addEventListener("click",()=>{pageSize+=28;renderGallery();});
  $("admExport").addEventListener("click",csvMissing);
  $("admCoverageSeriesSearch").addEventListener("input",renderAllSeriesCoverage);
  $("admCoverageSeriesList").addEventListener("click",event=>{
    const button=event.target.closest("[data-series-select]");
    if(!button)return;
    $("admSeriesFilter").value=button.dataset.seriesSelect;
    $("admCoverageFilter").value="missing";
    pageSize=28;
    renderGallery();
    $("admSeriesCoveragePanel").open=false;
    $("admPhotoGallery").scrollIntoView({block:"start",behavior:"smooth"});
  });
  $("admQuickUpload").addEventListener("click",()=>selectPanel("upload"));
  $("admPhotoGallery").addEventListener("click",event=>{
    const pokec=event.target.closest("[data-pokecardex-id]");
    if(pokec){setCardexChoice(pokec.dataset.pokecardexId);return;}
    const b=event.target.closest("[data-select-id]");
    if(b)selectEntryForUpload(b.dataset.selectId);
  });
  $("admCardexSearch").addEventListener("input",renderCardexVariants);
  $("admCardexVariant").addEventListener("change",()=>{
    const id=$("admCardexVariant").value;
    $("admCardexTarget").textContent=id&&entryById.has(id)?"🎨 "+entryById.get(id).label:"Choisis la référence exacte.";
    $("admCardexImport").disabled=!id||!cardexImageUrl;
  });
  $("admCardexFind").addEventListener("click",findCardexImages);
  $("admCardexImport").addEventListener("click",importCardexSelected);
  $("admCardexBulkFind").addEventListener("click",findBulkCardexPages);
  $("admPickSeries").addEventListener("change",()=>{
    populateArticleSelect($("admPickSeries").value);
    populateVariantSelect("");setSelected("");
  });
  $("admPickProduct").addEventListener("change",()=>{
    populateVariantSelect($("admPickProduct").value);setSelected("");
  });
  $("admPickVariant").addEventListener("change",()=>setSelected($("admPickVariant").value));
  $("admPhotoFile").addEventListener("change",e=>picturePreview(e.target.files[0],"admNewImage"));
  $("admUploadOne").addEventListener("click",async()=>{
    if(singleBusy)return;
    const id=$("admPickVariant").value,file=$("admPhotoFile").files[0],rights=$("admRights").value.trim();
    if(!id){setMessage("admUploadStatus","Sélectionne un article et son art set.",true);return;}
    if(!file){setMessage("admUploadStatus","Choisis une image dans Photos ou Fichiers.",true);return;}
    if(rights.length<5||!$("admRightsCheck").checked){setMessage("admUploadStatus","Indique l'origine de l'image et confirme les droits de publication.",true);return;}
    singleBusy=true;$("admUploadOne").disabled=true;setMessage("admUploadStatus","⏳ Enregistrement dans le catalogue…");
    try{
      await uploadImage(id,file,rights);
      $("admPhotoFile").value="";$("admRights").value="";$("admRightsCheck").checked=false;clearPreview();
      await reloadCatalog();
      setMessage("admUploadStatus","✅ Photo principale enregistrée pour cette variante ! Elle apparaîtra dans les prochains signalements.");
    }catch(e){setMessage("admUploadStatus",e.message,true);}
    finally{singleBusy=false;$("admUploadOne").disabled=false;}
  });
  $("admBulkFiles").addEventListener("change",e=>{
    batchClear();
    const files=[...e.target.files];
    if(files.length>25){setMessage("admBulkStatus","Maximum 25 images par import.",true);e.target.value="";return;}
    batch=files.map(file=>{
      const id=file.name.replace(/\.[^.]+$/,"").toLowerCase().trim();
      return {file,id:entryById.has(id)?id:"",previewUrl:URL.createObjectURL(file)};
    });
    renderBatch();
  });
  $("admBulkSend").addEventListener("click",uploadBatch);
  $("admRefreshProposals").addEventListener("click",refreshProposals);
  $("admProposals").addEventListener("click",async event=>{
    const button=event.target.closest("[data-review-id]");if(!button||reviewBusy)return;
    const approve=button.dataset.decision==="approved";
    if(!confirm(approve?"Approuver et afficher cette photographie sur tous les signalements ? Vérifie la variante et les droits de diffusion.":"Refuser cette photographie ?"))return;
    reviewBusy=true;setMessage("admProposalStatus","⏳ Enregistrement de la décision...");
    try{
      await api("/admin/catalog/photo-proposals/"+encodeURIComponent(button.dataset.reviewId)+"/review",{
        method:"POST",body:{decision:button.dataset.decision,rightsConfirmed:approve}
      });
      await reloadCatalog();reviewBusy=false;await refreshProposals();
    }catch(e){setMessage("admProposalStatus",e.message,true);}
    finally{reviewBusy=false;}
  });
}
async function init(){
  try{
    // Important: la validation du rôle s'effectue sur le serveur, jamais via la simple interface.
    const role=await api("/me/role");
    if(!role.isAdmin)throw Error("Ce compte ne dispose pas de l'accès administrateur.");
    showGate("",true);
    attachEvents();
    await reloadCatalog();
    const hash=location.hash.slice(1);
    selectPanel(["gallery","upload","bulk","cardex","proposals"].includes(hash)?hash:"overview");
  }catch(error){showGate("🔒 "+(error.message||"Accès à l'administration indisponible"));}
}
init();
