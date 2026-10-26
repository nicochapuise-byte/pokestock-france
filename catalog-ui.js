// Catalogue PokéStock — produits et art sets structurés.
// Les visuels officiels protégés ne sont affichés que si l'admin a ajouté un fichier autorisé.
const CATALOG_ENDPOINT="https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech";
const catalogDom=id=>document.getElementById(id);
const catalogTypes={
  booster:"🎴 Booster",
  etb:"📦 Coffret Dresseur d’élite (ETB)",
  bundle:"🧰 Lot de boosters / Bundle",
  mini_tin:"🪙 Mini-boîte (Mini Tin)",
  tin:"🪙 Boîte métal",
  upc:"✨ Collection Ultra-Premium (UPC)",
  collection:"🎁 Collection / Coffret",
  display:"📦 Display",
  tripack:"🎴 Tripack / 3 boosters",
  blister:"📌 Blister",
  deck:"🃏 Deck / Coffret combat"
};
let catalogData={series:[],products:[],variants:[]};
let catalogReady=false;
const cs=catalogDom("catalogSeries"),ct=catalogDom("catalogType"),
  cp=catalogDom("catalogProduct"),cv=catalogDom("catalogVariant");
function fillCatalogSelect(select,choices,firstText){
  select.replaceChildren(new Option(firstText,""));
  for(const item of choices)select.add(new Option(item.name,item.id));
  select.value="";
  select.disabled=!choices.length;
  for(const item of choices){if(item.releaseDate&&item.releaseDate>new Date().toISOString().slice(0,10)){const option=[...select.options].find(o=>o.value===item.id);if(option){option.disabled=true;option.textContent+=" 🔜";}}}
}
function catalogById(arr,id){return arr.find(entry=>entry.id===id);}
function setCatalogSeriesOptions(query=""){
  const keep=cs.value;
  const filter=query.trim().toLocaleLowerCase("fr");
  cs.replaceChildren(new Option("Sélectionne une extension",""));
  const groups=new Map();
  for(const entry of catalogData.series){
    const label=[entry.name,entry.block,entry.code].join(" ").toLocaleLowerCase("fr");
    if(filter&&!label.includes(filter))continue;
    const group=entry.block||"Autres séries";
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(entry);
  }
  const today=new Date().toISOString().slice(0,10);
  for(const [name,items] of groups){
    const optgroup=document.createElement("optgroup");
    optgroup.label=name;
    for(const entry of items){
      const notReleased=!!(entry.releaseDate&&entry.releaseDate>today);
      const opt=new Option((entry.code?entry.code+" · ":"")+entry.name+(notReleased?" 🔜":""),
        entry.id);
      opt.disabled=notReleased;
      optgroup.appendChild(opt);
    }
    cs.appendChild(optgroup);
  }
  if(keep&&catalogData.series.some(entry=>entry.id===keep)&&cs.querySelector('option[value="'+keep+'"]')){
    cs.value=keep;
  }
  cs.disabled=!groups.size;
}

function resetCatalogPhotoPreview(){
  catalogDom("catalogPreviewImage").src="catalog-placeholder.svg";
  catalogDom("catalogPreviewImage").alt="Illustration générique, pas une photo de l'article";
  catalogDom("catalogPreviewTitle").textContent="Choisis une référence";
  catalogDom("catalogPreviewMessage").textContent="Les visuels de produits seront ajoutés au fur et à mesure des autorisations obtenues.";
  catalogDom("catalogSourceLink").hidden=true;
  catalogDom("catalogVariantId").value="";
  const contribution=catalogDom("catalogContribute");
  if(contribution){contribution.hidden=true;contribution.open=false;}
  const legacyProduct=document.querySelector('#reportForm input[name="product"]');
  if(legacyProduct)legacyProduct.value="";
}
function resetCatalogSelectors(){
  catalogDom("catalogSeriesSearch").value="";
  setCatalogSeriesOptions();
  fillCatalogSelect(ct,[],"Choisis d’abord une série");
  fillCatalogSelect(cp,[],"Choisis d’abord un type");
  fillCatalogSelect(cv,[],"Choisis d’abord un article");
  resetCatalogPhotoPreview();
}
function onCatalogSeries(){
  const products=catalogData.products.filter(p=>p.seriesId===cs.value);
  const types=[...new Set(products.map(p=>p.type))];
  fillCatalogSelect(ct,types.map(id=>({id,name:catalogTypes[id]||id})),"Choisis le type de produit");
  fillCatalogSelect(cp,[],"Choisis d’abord un type");
  fillCatalogSelect(cv,[],"Choisis d’abord un article");
  resetCatalogPhotoPreview();
  if(document.querySelector("#reportSeries option[value='"+cs.value+"']"))catalogDom("reportSeries").value=cs.value;
}
function onCatalogType(){
  const products=catalogData.products.filter(p=>p.seriesId===cs.value&&p.type===ct.value);
  fillCatalogSelect(cp,products,"Choisis l’article");
  fillCatalogSelect(cv,[],"Choisis d’abord un article");
  resetCatalogPhotoPreview();
}
function onCatalogProduct(){
  const options=catalogData.variants.filter(v=>v.productId===cp.value);
  fillCatalogSelect(cv,options,"Sélectionne un art set / une variante");
  resetCatalogPhotoPreview();
}
function onCatalogVariant(){
  const variant=catalogById(catalogData.variants,cv.value);
  const product=catalogById(catalogData.products,cp.value);
  const title=catalogDom("catalogPreviewTitle");
  const message=catalogDom("catalogPreviewMessage");
  const image=catalogDom("catalogPreviewImage");
  const source=catalogDom("catalogSourceLink");
  const legacyProduct=document.querySelector('#reportForm input[name="product"]');
  if(!variant||!product){resetCatalogPhotoPreview();return;}
  catalogDom("catalogVariantId").value=variant.id;
  const contribution=catalogDom("catalogContribute");
  if(contribution){contribution.hidden=!!variant.image;contribution.open=false;}
  if(legacyProduct)legacyProduct.value=product.name;
  title.textContent=product.name+" — "+variant.name;
  const communityExample=variant.id==="151-upc-mew"&&!variant.image;
  image.src=variant.image||(communityExample?"catalog-upc151-chat.svg":"catalog-placeholder.svg");
  image.alt=variant.image?"Photo autorisée du produit : "+product.name+" ("+variant.name+")":
    communityExample?"Photo du coffret 151 transmise par le responsable du site":"Visuel indicatif ; photo exacte non encore disponible";
  image.onerror=()=>{image.onerror=null;image.src="catalog-placeholder.svg";};
  message.textContent=variant.image
    ?"✅ Visuel du produit disponible dans la médiathèque PokéStock."
    :communityExample
      ?"📸 Photo de ce coffret 151 fournie directement par le responsable de PokéStock."
      :"🖼️ Photographie officielle non intégrée : visuel neutre en attendant une image utilisable avec autorisation.";
  const url=variant.sourceUrl||product.sourceUrl;
  source.hidden=!url;
  if(url)source.href=url;
}
async function loadPokemonCatalog(){
  try{
    const r=await fetch(CATALOG_ENDPOINT+"/catalog",{cache:"no-store",signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error("Code "+r.status);
    const data=await r.json();
    if(!Array.isArray(data.series)||!Array.isArray(data.products)||!Array.isArray(data.variants))
      throw Error("Données catalogue incorrectes.");
    catalogData=data;
    catalogReady=true;
    series=data.series.map(entry=>({id:entry.id,name:entry.name,color:entry.color,block:entry.block,code:entry.code}));
    renderFilters();
    renderAll();
    // Les administrateurs peuvent corriger aussi les nouvelles séries importées.
    const adminSeries=document.querySelector('#adminEditForm select[name="series"]');
    if(adminSeries){
      const previous=adminSeries.value;
      adminSeries.replaceChildren();
      const groups=new Map();
      for(const entry of catalogData.series){
        const group=entry.block||"Autres séries";
        if(!groups.has(group))groups.set(group,[]);
        groups.get(group).push(entry);
      }
      for(const [block,entries] of groups){
        const holder=document.createElement("optgroup");holder.label=block;
        entries.forEach(entry=>holder.appendChild(new Option((entry.code?entry.code+" · ":"")+entry.name,entry.id)));
        adminSeries.appendChild(holder);
      }
      if(catalogData.series.some(entry=>entry.id===previous))adminSeries.value=previous;
    }
    resetCatalogSelectors();
    fillAdminCatalogVariantSelector();
    document.dispatchEvent(new CustomEvent("pokestock:catalogloaded",{detail:{total:data.variants.length,withImages:data.variants.filter(v=>!!v.image).length}}));
  }catch(error){
    catalogReady=false;
    cs.replaceChildren(new Option("⚠️ Catalogue indisponible, actualise la page",""));
    cs.disabled=true;
    catalogDom("catalogPreviewMessage").textContent="⚠️ Le catalogue ne se charge pas. "+error.message;
    console.error("Impossible de charger le catalogue :",error);
  }
}
cs.addEventListener("change",onCatalogSeries);
catalogDom("catalogSeriesSearch").addEventListener("input",event=>{
  const previous=cs.value;
  setCatalogSeriesOptions(event.target.value);
  if(previous&&!cs.value){
    fillCatalogSelect(ct,[],"Choisis d’abord une série");
    fillCatalogSelect(cp,[],"Choisis d’abord un type");
    fillCatalogSelect(cv,[],"Choisis d’abord un article");
    resetCatalogPhotoPreview();
  }
});
ct.addEventListener("change",onCatalogType);
cp.addEventListener("change",onCatalogProduct);
cv.addEventListener("change",onCatalogVariant);
document.addEventListener("pokestock:reportreset",resetCatalogSelectors);

function fillAdminCatalogVariantSelector(){
  const select=catalogDom("adminCatalogVariant");
  if(!select)return;
  const options=[...catalogData.variants].map(v=>{
    const product=catalogById(catalogData.products,v.productId);
    const series=catalogById(catalogData.series,product?.seriesId);
    return {id:v.id,name:(series?.name||"—")+" — "+(product?.name||"—")+" / "+v.name+(v.image?" 📸":"")};
  });
  const filter=catalogDom("adminCatalogSearch")?.value.trim().toLocaleLowerCase("fr")||"";
  const show=options.filter(option=>!filter||option.name.toLocaleLowerCase("fr").includes(filter));
  const previously=select.value;
  fillCatalogSelect(select,show,"Sélectionne une référence du catalogue");
  if(show.some(option=>option.id===previously))select.value=previously;
}
async function uploadCatalogPhoto(){
  if(!userIsAdmin){catalogDom("adminCatalogStatus").textContent="⚠️ Accès réservé à l'administration.";return;}
  const status=catalogDom("adminCatalogStatus"),button=catalogDom("adminUploadCatalogPhoto");
  const id=catalogDom("adminCatalogVariant").value,file=catalogDom("adminCatalogPhoto").files[0];
  const rightsNote=catalogDom("adminCatalogRights").value.trim();
  if(!id){status.textContent="Choisis un art set du catalogue.";return;}
  if(!file){status.textContent="Sélectionne une image autorisée.";return;}
  if(!catalogDom("adminCatalogRightsConfirm").checked||rightsNote.length<5){
    status.textContent="La justification des droits et sa confirmation sont indispensables.";return;
  }
  button.disabled=true;status.textContent="⏳ Compression et envoi de l'image...";
  try{
    const photo=await imageAsJpeg(file);
    await moderationRequest("/admin/catalog/variants/"+encodeURIComponent(id)+"/image",{
      method:"POST",body:{photo,rightsNote,rightsConfirmed:true}
    });
    status.textContent="✅ Image du catalogue enregistrée. Elle sera visible sous ce produit.";
    catalogDom("adminCatalogPhoto").value="";
    catalogDom("adminCatalogRightsConfirm").checked=false;
    catalogDom("adminCatalogRights").value="";
    await loadPokemonCatalog();
    await loadCommunityReports();
  }catch(error){status.textContent="⚠️ "+(error.message||"Échec de l'import.");}
  finally{button.disabled=false;}
}
catalogDom("adminUploadCatalogPhoto").addEventListener("click",uploadCatalogPhoto);
catalogDom("adminCatalogSearch").addEventListener("input",fillAdminCatalogVariantSelector);
loadPokemonCatalog();
