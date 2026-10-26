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
  display:"📦 Display"
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
}
function catalogById(arr,id){return arr.find(entry=>entry.id===id);}
function resetCatalogPhotoPreview(){
  catalogDom("catalogPreviewImage").src="catalog-placeholder.svg";
  catalogDom("catalogPreviewImage").alt="Illustration générique, pas une photo de l'article";
  catalogDom("catalogPreviewTitle").textContent="Choisis une référence";
  catalogDom("catalogPreviewMessage").textContent="Les visuels de produits seront ajoutés au fur et à mesure des autorisations obtenues.";
  catalogDom("catalogSourceLink").hidden=true;
  catalogDom("catalogVariantId").value="";
  const legacyProduct=document.querySelector('#reportForm input[name="product"]');
  if(legacyProduct)legacyProduct.value="";
}
function resetCatalogSelectors(){
  fillCatalogSelect(cs,catalogData.series,"Sélectionne une extension");
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
  if(legacyProduct)legacyProduct.value=product.name;
  title.textContent=product.name+" — "+variant.name;
  image.src=variant.image||"catalog-placeholder.svg";
  image.alt=variant.image?"Photo autorisée du produit : "+product.name+" ("+variant.name+")":"Visuel indicatif ; photo exacte non encore disponible";
  image.onerror=()=>{image.onerror=null;image.src="catalog-placeholder.svg";};
  message.textContent=variant.image
    ?"✅ Visuel du produit disponible dans la médiathèque PokéStock."
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
    resetCatalogSelectors();
    fillAdminCatalogVariantSelector();
  }catch(error){
    catalogReady=false;
    cs.replaceChildren(new Option("⚠️ Catalogue indisponible, actualise la page",""));
    cs.disabled=true;
    catalogDom("catalogPreviewMessage").textContent="⚠️ Le catalogue ne se charge pas. "+error.message;
    console.error("Impossible de charger le catalogue :",error);
  }
}
cs.addEventListener("change",onCatalogSeries);
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
  fillCatalogSelect(select,options,"Sélectionne une référence du catalogue");
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
loadPokemonCatalog();
