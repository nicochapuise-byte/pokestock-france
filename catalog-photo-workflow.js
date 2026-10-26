// PokéStock France — médiathèque communautaire et import par lots.
// Les images tierces ne sont jamais copiées automatiquement ; chaque ajout est
// attesté par le contributeur et contrôlé avant d'être publié.
const photoUi=id=>document.getElementById(id);
const photoSelectorItems=()=>catalogData.variants.map(v=>{
  const p=catalogById(catalogData.products,v.productId);
  const serie=catalogById(catalogData.series,p?.seriesId);
  return {id:v.id,image:v.image,series:serie?.name||"",product:p?.name||"",
    label:(serie?.name||"—")+" — "+(p?.name||"—")+" / "+v.name};
});
let photoListOffset=0,bulkQueue=[],photoBatchBusy=false,pendingReviewBusy=false;
const photoPageSize=32;

function renderCatalogPhotoCoverage(){
  if(!catalogReady)return;
  const entries=photoSelectorItems();
  const ready=entries.filter(e=>e.image).length;
  const missing=entries.length-ready;
  photoUi("catalogPhotoCoverage").textContent=
    ready+" / "+entries.length+" photos vérifiées · "+missing+" photo(s) à compléter";
  photoUi("catalogPhotoProgress").max=Math.max(entries.length,1);
  photoUi("catalogPhotoProgress").value=ready;
  renderMissingPhotoList();
}
function renderMissingPhotoList(){
  if(!catalogReady)return;
  const filter=photoUi("catalogMediaFilter").value;
  const term=photoUi("catalogMediaSearch").value.trim().toLocaleLowerCase("fr");
  const list=photoUi("catalogMediaMissingList");
  const entries=photoSelectorItems().filter(item=>
    (filter==="all"||(filter==="missing"?!item.image:!!item.image))&&
    (!term||item.label.toLocaleLowerCase("fr").includes(term)||item.id.includes(term))
  );
  list.replaceChildren();
  if(!entries.length){list.textContent="Aucune référence correspondante.";photoUi("catalogMediaMore").hidden=true;return;}
  const frag=document.createDocumentFragment();
  for(const item of entries.slice(0,photoListOffset+photoPageSize)){
    const row=document.createElement("div");row.className="catalog-coverage-row";
    const label=document.createElement("div");
    const strong=document.createElement("strong");strong.textContent=item.label;
    const small=document.createElement("small");small.textContent=item.id+(item.image?" · ✅ Photo enregistrée":" · ❌ Image manquante");
    label.append(strong,small);
    const button=document.createElement("button");
    button.type="button";button.dataset.catalogImageTarget=item.id;
    button.textContent=item.image?"🔄 Remplacer":"📸 Ajouter";
    row.append(label,button);frag.appendChild(row);
  }
  list.appendChild(frag);
  photoUi("catalogMediaMore").hidden=entries.length<=photoListOffset+photoPageSize;
}
photoUi("catalogMediaFilter").addEventListener("change",()=>{photoListOffset=0;renderMissingPhotoList();});
photoUi("catalogMediaSearch").addEventListener("input",()=>{photoListOffset=0;renderMissingPhotoList();});
photoUi("catalogMediaMore").addEventListener("click",()=>{
  photoListOffset+=photoPageSize;renderMissingPhotoList();
});

photoUi("catalogMediaExport").addEventListener("click",()=>{
  if(!catalogReady)return;
  const items=photoSelectorItems().filter(item=>!item.image);
  const quote=value=>'"'+String(value??"").replaceAll('"','""')+'"';
  const rows=[
    ["Identifiant variante","Série","Produit","Art set","Nom de fichier conseillé","Statut"],
    ...items.map(item=>[
      item.id,item.series,item.product,
      catalogById(catalogData.variants,item.id)?.name||"",
      item.id+".jpg","Image à fournir / droits à vérifier"
    ])
  ];
  const csv="\ufeff"+rows.map(row=>row.map(quote).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download="pokestock-photos-manquantes.csv";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
});

photoUi("catalogMediaMissingList").addEventListener("click",event=>{
  const button=event.target.closest("[data-catalog-image-target]");
  if(!button)return;
  const id=button.dataset.catalogImageTarget;
  const select=photoUi("adminCatalogVariant");
  photoUi("adminCatalogSearch").value="";
  fillAdminCatalogVariantSelector();
  select.value=id;
  select.scrollIntoView({behavior:"smooth",block:"center"});
  photoUi("adminCatalogStatus").textContent=
    "📸 Référence sélectionnée. Choisis une image et indique l'autorisation de diffusion.";
});

function assignBatchVariants(){
  const entries=photoSelectorItems(),byId=new Map(entries.map(i=>[i.id,i]));
  const queue=photoUi("catalogBulkQueue");
  queue.replaceChildren();
  for(const item of bulkQueue){
    const row=document.createElement("div");row.className="catalog-bulk-row";
    const filename=document.createElement("strong");filename.textContent=item.file.name;
    const select=document.createElement("select");select.setAttribute("aria-label","Associer "+item.file.name+" à une référence");
    select.add(new Option("⚠️ Choisir la bonne variante", ""));
    // Recherche en priorité sur l'id exact ; aucune correspondance ambiguë automatique.
    for(const entry of entries){
      select.add(new Option((entry.image?"📸 ":"")+entry.label+" ["+entry.id+"]",entry.id));
    }
    const basename=item.file.name.replace(/\.[^.]+$/,"").toLowerCase().trim();
    item.id=byId.has(basename)?basename:"";
    select.value=item.id;
    select.addEventListener("change",()=>{item.id=select.value;renderBulkSummary();});
    const hint=document.createElement("small");
    hint.className="bulk-match-hint";
    hint.textContent=item.id?"✅ Référence reconnue grâce au nom du fichier":"⚠️ Sélectionne la bonne référence manuellement";
    select.addEventListener("change",()=>{
      hint.textContent=item.id?"✅ Variante sélectionnée":"⚠️ Variante non choisie";
    });
    const box=document.createElement("div");box.append(filename,hint,select);
    const preview=document.createElement("img");preview.alt="Aperçu de "+item.file.name;
    preview.src=item.url;
    row.append(preview,box);queue.append(row);
  }
  renderBulkSummary();
}
function clearBulkObjectUrls(){
  for(const item of bulkQueue)if(item.url)URL.revokeObjectURL(item.url);
}
function renderBulkSummary(){
  const count=bulkQueue.filter(x=>x.id).length;
  const countUnique=new Set(bulkQueue.filter(x=>x.id).map(x=>x.id)).size;
  photoUi("catalogBulkUploadBtn").disabled=photoBatchBusy||!count||count!==countUnique;
  photoUi("catalogBulkStatus").textContent=bulkQueue.length?
    count+" fichier(s) associé(s) / "+bulkQueue.length+(count!==countUnique?" ⚠️ Plusieurs fichiers visent le même art set.":""):
    "";
}
photoUi("catalogBulkFiles").addEventListener("change",event=>{
  clearBulkObjectUrls();
  const files=[...event.target.files].slice(0,25);
  bulkQueue=files.map(file=>({file,url:URL.createObjectURL(file),id:""}));
  assignBatchVariants();
  if(event.target.files.length>25)photoUi("catalogBulkStatus").textContent="Maximum 25 images à la fois.";
});
async function submitBulkPhotos(){
  if(photoBatchBusy||!userIsAdmin)return;
  const status=photoUi("catalogBulkStatus");
  const rightsNote=photoUi("adminCatalogRights").value.trim();
  if(!photoUi("adminCatalogRightsConfirm").checked||rightsNote.length<5){
    status.textContent="⚠️ Renseigne le justificatif et coche la confirmation des droits dans le formulaire au-dessus.";
    return;
  }
  const entries=photoSelectorItems();
  const byId=new Map(entries.map(x=>[x.id,x]));
  const jobs=bulkQueue.filter(x=>x.id);
  if(!jobs.length){status.textContent="Sélectionne une variante par image.";return;}
  if(new Set(jobs.map(x=>x.id)).size!==jobs.length){
    status.textContent="Une même variante ne peut recevoir deux photos dans un même lot.";return;
  }
  if(!photoUi("catalogBulkOverwrite").checked&&jobs.some(job=>byId.get(job.id)?.image)){
    status.textContent="Une variante possède déjà une photo. Retire-la du lot ou autorise explicitement son remplacement.";
    return;
  }
  if(jobs.length<bulkQueue.length){
    status.textContent="Vérifie les références sans correspondance avant de publier.";return;
  }
  if(!window.confirm("Importer "+jobs.length+" image(s) pour les références sélectionnées ? Vérifie que chacune correspond au bon art set."))return;
  photoBatchBusy=true;
  const button=photoUi("catalogBulkUploadBtn");
  button.disabled=true;
  const errors=[];
  let uploaded=0;
  for(const [index,job] of jobs.entries()){
    status.textContent="⏳ Importation "+(index+1)+"/"+jobs.length+" — "+job.file.name+" · "+uploaded+" photo(s) ajoutée(s)";
    try{
      if(job.file.size>10*1024*1024)throw Error("Fichier > 10 Mo");
      const photo=await imageAsJpeg(job.file);
      await moderationRequest("/admin/catalog/variants/"+encodeURIComponent(job.id)+"/image",{
        method:"POST",body:{photo,rightsNote,rightsConfirmed:true}
      });
      uploaded++;
    }catch(err){errors.push(job.file.name+" : "+(err.message||"échec"));}
  }
  photoBatchBusy=false;
  button.disabled=false;
  status.textContent="✅ "+uploaded+" / "+jobs.length+" photo(s) importée(s)."+(errors.length?" ⚠️ "+errors.length+" échec(s) : "+errors.slice(0,3).join(" | "):"");
  if(uploaded){
    clearBulkObjectUrls();
    bulkQueue=[];
    photoUi("catalogBulkFiles").value="";
    photoUi("catalogBulkQueue").replaceChildren();
    await loadPokemonCatalog();
    await loadCommunityReports();
    renderBulkSummary();
    status.textContent="✅ "+uploaded+" photo(s) importée(s)."+(errors.length?" Erreurs : "+errors.slice(0,3).join(" | "):"");
  }
}
photoUi("catalogBulkUploadBtn").addEventListener("click",submitBulkPhotos);

// Contribution citoyenne, sans publication immédiate : modération humaine.
const proposalBtn=photoUi("catalogProposePhotoBtn");
proposalBtn.addEventListener("click",async()=>{
  const message=photoUi("catalogProposalStatus");
  const selected=photoUi("catalogVariantId").value;
  const file=photoUi("catalogUserPhoto").files[0];
  const rightsNote=photoUi("catalogUserRights").value.trim();
  if(!selected){message.textContent="Choisis d'abord le produit et son art set.";return;}
  if(!file){message.textContent="Choisis une photographie du produit.";return;}
  if(!photoUi("catalogUserConsent").checked||rightsNote.length<5){
    message.textContent="Confirme que tu détiens les droits nécessaires pour proposer cette photo.";return;
  }
  const api=window.pokestockApi;
  if(!api?.ready||!api.getUser()){
    message.textContent="Connecte-toi pour proposer ta photographie.";
    api?.openLogin();return;
  }
  proposalBtn.disabled=true;message.textContent="⏳ Envoi de ta proposition...";
  try{
    const photo=await imageAsJpeg(file);
    const res=await moderationRequest("/catalog/photo-proposals",{
      method:"POST",body:{variantId:selected,photo,rightsConfirmed:true,rightsNote}
    });
    message.textContent="✅ "+res.message;
    photoUi("catalogUserPhoto").value="";
    photoUi("catalogUserRights").value="";
    photoUi("catalogUserConsent").checked=false;
  }catch(err){message.textContent="⚠️ "+(err.message||"Impossible d'envoyer la proposition.");}
  finally{proposalBtn.disabled=false;}
});

let latestPendingProposals=[];
async function refreshPendingCatalogPhotos(){
  const target=photoUi("catalogPendingPhotos"),status=photoUi("catalogPendingStatus");
  if(!userIsAdmin){target.replaceChildren();status.textContent="";return;}
  status.textContent="⏳ Recherche des photos à modérer...";
  try{
    const data=await moderationRequest("/admin/catalog/photo-proposals");
    latestPendingProposals=data.pending||[];
    target.replaceChildren();
    if(!latestPendingProposals.length){
      target.textContent="✅ Aucune photographie en attente de vérification.";
      status.textContent="0 proposition en attente.";
      return;
    }
    const fragment=document.createDocumentFragment();
    for(const item of latestPendingProposals){
      const card=document.createElement("article");card.className="catalog-photo-review";
      const image=document.createElement("img");image.src=item.image;image.alt="Photo proposée pour "+item.product_name;
      image.loading="lazy";
      const info=document.createElement("div");
      const title=document.createElement("strong");
      title.textContent=item.series_name+" · "+item.product_name+" / "+item.variant_name;
      const rights=document.createElement("p");rights.textContent="Droits déclarés : "+item.rights_note;
      const buttons=document.createElement("div");buttons.className="catalog-photo-review-actions";
      for(const [decision,label] of [["approved","✅ Valider"],["rejected","❌ Refuser"]]){
        const button=document.createElement("button");
        button.type="button";button.dataset.catalogReview=item.id;button.dataset.decision=decision;
        button.textContent=label;buttons.appendChild(button);
      }
      info.append(title,rights,buttons);
      card.append(image,info);
      fragment.appendChild(card);
    }
    target.append(fragment);
    status.textContent=latestPendingProposals.length+" photo(s) à modérer.";
  }catch(error){status.textContent="⚠️ "+error.message;}
}
photoUi("catalogPendingPhotos").addEventListener("click",async event=>{
  const button=event.target.closest("[data-catalog-review]");
  if(!button||pendingReviewBusy||!userIsAdmin)return;
  const id=button.dataset.catalogReview,decision=button.dataset.decision;
  if(decision==="approved"&&!window.confirm("Publier cette photographie sur PokéStock ? Confirme la bonne référence, l'absence de données privées et les droits déclarés."))return;
  if(decision==="rejected"&&!window.confirm("Refuser cette proposition ?"))return;
  pendingReviewBusy=true;
  try{
    await moderationRequest("/admin/catalog/photo-proposals/"+encodeURIComponent(id)+"/review",{
      method:"POST",body:{decision,rightsConfirmed:decision==="approved"}
    });
    photoUi("catalogPendingStatus").textContent=decision==="approved"?"✅ Image publiée.":"Photo refusée.";
    await Promise.all([refreshPendingCatalogPhotos(),loadPokemonCatalog(),loadCommunityReports()]);
  }catch(err){photoUi("catalogPendingStatus").textContent="⚠️ "+err.message;}
  finally{pendingReviewBusy=false;}
});
photoUi("catalogPendingRefresh").addEventListener("click",refreshPendingCatalogPhotos);
photoUi("adminBtn").addEventListener("click",refreshPendingCatalogPhotos);
document.addEventListener("pokestock:catalogloaded",()=>{
  photoListOffset=0;renderCatalogPhotoCoverage();
  if(bulkQueue.length)assignBatchVariants();
});
document.addEventListener("pokestock:authchanged",()=>{if(!window.pokestockApi?.getUser())latestPendingProposals=[];});
