// Administration de PokéStock : autorisations vérifiées par l'API Neon.
// Aucun privilège admin n'est défini dans le navigateur.
const MOD_API="https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech";
let ownedReportIds=new Set();
let userIsAdmin=false;
let modReports=[];
let modEditId=null;
let modCoords=null;
let modSellerType="professional",modCommuneCode=null;
let modAddressCandidates=[];
let modRequestSerial=0;
let modBusy=false;

async function moderationToken(){
  const api=window.pokestockApi;
  if(!api?.ready||!api.getUser())throw Error("Connecte-toi à ton compte PokéStock.");
  const token=await api.getToken();
  if(!token)throw Error("La session a expiré. Reconnecte-toi.");
  return token;
}
async function moderationRequest(path,options={}){
  const token=await moderationToken();
  const headers={"Authorization":"Bearer "+token};
  if(options.body!==undefined)headers["Content-Type"]="application/json";
  let response;
  try{
    response=await fetch(MOD_API+path,{
      method:options.method||"GET",headers,
      body:options.body===undefined?undefined:JSON.stringify(options.body),
      cache:"no-store",signal:AbortSignal.timeout(16000)
    });
  }catch{throw Error("Le serveur communautaire ne répond pas. Réessaie.");}
  let result;
  try{result=await response.json();}catch{throw Error("Réponse invalide du serveur.");}
  if(!response.ok)throw Error(result?.error||"Une erreur est survenue.");
  return result;
}
async function updateModerationPermissions(){
  const requestId=++modRequestSerial;
  const api=window.pokestockApi;
  if(!api?.ready||!api.getUser()){
    ownedReportIds=new Set();userIsAdmin=false;modReports=[];
    document.getElementById("adminBtn").hidden=true;
    renderCards(filteredReports());
    closeAdminModal();
    return;
  }
  try{
    const [role,owned]=await Promise.all([
      moderationRequest("/me/role"),
      moderationRequest("/me/reports")
    ]);
    if(requestId!==modRequestSerial)return;
    userIsAdmin=role?.isAdmin===true;
    ownedReportIds=new Set(Array.isArray(owned?.ids)?owned.ids:[]);
    document.getElementById("adminBtn").hidden=!userIsAdmin;
  }catch(error){
    if(requestId!==modRequestSerial)return;
    userIsAdmin=false;ownedReportIds=new Set();
    document.getElementById("adminBtn").hidden=true;
    console.warn("Impossible de vérifier les autorisations PokéStock",error);
  }
  renderCards(filteredReports());
  // Accessible depuis l'onglet « Signalements » de l'administration dédiée.
  if(userIsAdmin&&window.location.hash==="#administration"){
    history.replaceState(null,"",window.location.pathname+window.location.search);
    openAdminModal();
  }
}
function moderationCardControls(items){
  const cards=document.querySelectorAll("#stockGrid .stock-card");
  cards.forEach((card,index)=>{
    const item=items[index];
    if(!item||item.demo||!item.votes)return;
    const owner=ownedReportIds.has(item.id);
    if(owner){
      const votes=card.querySelector(".community-vote-summary");
      if(votes){
        votes.textContent="📸 Tu as créé ce signalement. Les auteurs ne peuvent pas confirmer leur propre stock.";
        votes.classList.add("your-report-note");
      }
    }
    if(!owner&&!userIsAdmin)return;
    const area=document.createElement("div");
    area.className="moderation-card-buttons";
    if(userIsAdmin){
      const edit=document.createElement("button");
      edit.type="button";edit.className="moderation-edit-button";
      edit.dataset.moderationEdit=item.id;
      edit.textContent="✏️ Modifier";
      area.appendChild(edit);
    }
    const remove=document.createElement("button");
    remove.type="button";remove.className="moderation-delete-button";
    remove.dataset.moderationDelete=item.id;
    remove.textContent=owner?"🗑️ Supprimer mon signalement":"🗑️ Supprimer";
    area.appendChild(remove);
    card.querySelector(".stock-body")?.appendChild(area);
  });
}
const renderCardsBeforeModeration=renderCards;
renderCards=function(items){
  renderCardsBeforeModeration(items);
  moderationCardControls(items);
};
async function removeModerationReport(id){
  if(modBusy)return;
  const owner=ownedReportIds.has(id);
  if(!owner&&!userIsAdmin){
    toast("Tu ne peux supprimer que tes propres signalements.");return;
  }
  const message=owner
    ?"Supprimer ton signalement ? Il disparaîtra de la carte et des disponibilités. Cette action ne peut pas être annulée depuis le site."
    :"Supprimer ce référencement de PokéStock ? Il disparaîtra de la carte et des disponibilités.";
  if(!window.confirm(message))return;
  modBusy=true;
  try{
    await moderationRequest("/reports/"+encodeURIComponent(id),{method:"DELETE"});
    ownedReportIds.delete(id);
    toast("✅ Signalement retiré de la carte.");
    await loadCommunityReports();
    if(userIsAdmin)await loadAdminReports();
    await updateModerationPermissions();
  }catch(error){toast(error.message||"Impossible de supprimer le signalement.");}
  finally{modBusy=false;}
}
document.getElementById("stockGrid").addEventListener("click",event=>{
  const remove=event.target.closest("[data-moderation-delete]");
  if(remove){removeModerationReport(remove.dataset.moderationDelete);return;}
  const edit=event.target.closest("[data-moderation-edit]");
  if(edit){
    openAdminModal().then(()=>editAdminReport(edit.dataset.moderationEdit));
  }
});

const modDialog=document.getElementById("adminModal"),modList=document.getElementById("adminList"),
  modForm=document.getElementById("adminEditForm");
const modStatus=document.getElementById("adminStatus");
function closeAdminModal(){
  modDialog.classList.remove("open");
  modDialog.setAttribute("aria-hidden","true");
  modForm.hidden=true;
  modEditId=null;
  if(!document.querySelector("#reportModal.open"))document.body.style.overflow="";
}
async function openAdminModal(){
  if(!userIsAdmin){
    toast("Administration réservée aux comptes autorisés.");
    return;
  }
  modDialog.classList.add("open");
  modDialog.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  await loadAdminReports();
}
document.getElementById("adminBtn").addEventListener("click",()=>{
  window.location.href="admin.html";
});
document.querySelectorAll("[data-close-admin]").forEach(el=>el.addEventListener("click",closeAdminModal));
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&modDialog.classList.contains("open"))closeAdminModal();
});
async function loadAdminReports(){
  if(!userIsAdmin)return;
  modStatus.textContent="⏳ Chargement des signalements...";
  try{
    const response=await moderationRequest("/admin/reports");
    modReports=Array.isArray(response.reports)?response.reports:[];
    modStatus.textContent=modReports.length+" référencement(s) dans la base (y compris les références masquées).";
    drawAdminReports();
  }catch(error){modStatus.textContent="⚠️ "+error.message;}
}
function drawAdminReports(){
  modList.replaceChildren();
  const query=document.getElementById("adminSearch").value.toLowerCase().trim();
  const filtered=modReports.filter(r=>[r.store,r.product,r.city,r.address].join(" ").toLowerCase().includes(query));
  if(!filtered.length){
    const p=document.createElement("p");p.textContent="Aucun signalement correspondant.";
    modList.appendChild(p);return;
  }
  filtered.forEach(item=>{
    const row=document.createElement("article");
    row.className="admin-report-row";
    const details=document.createElement("div");details.className="admin-report-details";
    const strong=document.createElement("strong");
    strong.textContent=item.product+" · "+item.store;
    const small=document.createElement("small");
    const state=item.removed_at?"🗑️ Supprimé":item.status==="rejected"?"⛔ Refusé":item.status==="approved"?"✅ Approuvé":"🟠 Non vérifié";
    small.textContent=item.city+" · "+state;
    details.append(strong,small);row.appendChild(details);
    const actions=document.createElement("div");actions.className="admin-row-actions";
    if(item.proofImage){
      const proof=document.createElement("a");
      proof.href=item.proofImage;
      proof.target="_blank";
      proof.rel="noopener noreferrer";
      proof.className="admin-proof-link";
      proof.textContent="📸 Preuve privée";
      proof.title="Lien temporaire réservé à la modération";
      actions.appendChild(proof);
    }
    if(!item.removed_at){
      const edit=document.createElement("button");
      edit.type="button";edit.dataset.adminAction="edit";edit.dataset.reportId=item.id;
      edit.textContent="✏️ Modifier";
      actions.appendChild(edit);
      const remove=document.createElement("button");
      remove.type="button";remove.dataset.adminAction="delete";remove.dataset.reportId=item.id;
      remove.textContent="🗑️ Supprimer";remove.className="danger";
      actions.appendChild(remove);
    }
    row.appendChild(actions);modList.appendChild(row);
  });
}
document.getElementById("adminSearch").addEventListener("input",drawAdminReports);
modList.addEventListener("click",async e=>{
  const btn=e.target.closest("[data-admin-action]");
  if(!btn||!userIsAdmin)return;
  if(btn.dataset.adminAction==="delete")await removeModerationReport(btn.dataset.reportId);
  else editAdminReport(btn.dataset.reportId);
});
const getModInput=name=>modForm.elements.namedItem(name);
function formAdminCoordinatesReset(){
  modCoords=null;modCommuneCode=null;
  document.getElementById("adminAddressStatus").textContent="Adresse modifiée : recherche puis sélectionne une adresse exacte pour enregistrer.";
  document.getElementById("adminAddressOptions").hidden=true;
  document.getElementById("adminAddressOptions").replaceChildren();
}
function editAdminReport(id){
  if(!userIsAdmin)return;
  const report=modReports.find(r=>r.id===id&&!r.removed_at);
  if(!report){toast("Référencement introuvable. Recharge l'administration.");return;}
  modEditId=id;
  modSellerType=report.sellerType||'professional';modCommuneCode=report.communeCode||null;
  const privateSeller=modSellerType==='private';
  document.getElementById('adminSellerType').textContent=privateSeller?'Particulier · commune uniquement, aucune adresse personnelle':'Professionnel';
  for(const id of ['adminStoreNameField','adminStreetField'])document.getElementById(id).hidden=privateSeller;
  for(const name of ['store','address'])getModInput(name).disabled=privateSeller;
  getModInput('websiteUrl').value=report.websiteUrl||'';
  document.getElementById('adminFindAddress').textContent=privateSeller?'Vérifier la commune':'Vérifier une nouvelle adresse';
  for(const key of ["store","city","series","product","qty","address","status"]){
    const el=getModInput(key);if(el)el.value=report[key]??"";
  }
  getModInput("price").value=report.price??"";
  modCoords={lat:Number(report.lat),lng:Number(report.lng)};
  document.getElementById("adminAddressOptions").hidden=true;
  document.getElementById("adminAddressOptions").replaceChildren();
  document.getElementById("adminAddressStatus").textContent="📍 Adresse actuelle conservée. Recherches obligatoires en cas de modification de la ville ou de l'adresse.";
  document.getElementById("adminEditingId").textContent="Référencement sélectionné : "+report.product+" · "+report.store;
  modForm.hidden=false;
  modForm.scrollIntoView({behavior:"smooth",block:"nearest"});
}
document.getElementById("adminCancelEdit").addEventListener("click",()=>{
  modEditId=null;modForm.hidden=true;
});
["address","city"].forEach(field=>getModInput(field).addEventListener("input",formAdminCoordinatesReset));
let modAddressMatches=[];
document.getElementById("adminFindAddress").addEventListener("click",async()=>{
  const address=getModInput("address").value.trim(),city=getModInput("city").value.trim();
  const status=document.getElementById("adminAddressStatus");
  const pick=document.getElementById("adminAddressOptions");
  if((modSellerType!=="private"&&address.length<5)||city.length<2){status.textContent="Renseigne d'abord une adresse complète et une ville.";return;}
  const btn=document.getElementById("adminFindAddress");
  btn.disabled=true;status.textContent="⏳ Recherche de l'adresse...";
  try{
    const endpoint=modSellerType==="private"?"https://geo.api.gouv.fr/communes?nom="+encodeURIComponent(city)+"&fields=nom,code,centre,codeDepartement&boost=population&limit=8":"https://data.geopf.fr/geocodage/search/?q="+encodeURIComponent(address+" "+city)+"&limit=5";
    const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error("Service d'adresses indisponible.");
    const data=await response.json();
    modAddressMatches=modSellerType==='private'?(Array.isArray(data)?data:[]).map(c=>({city:c.nom,label:c.nom+' ('+c.codeDepartement+')',communeCode:c.code,lat:c.centre?.coordinates?.[1],lng:c.centre?.coordinates?.[0]})).filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lng)):(data.features||[]).map(getAddressFeature).filter(Boolean).filter(x=>x.label);
    pick.replaceChildren();
    if(!modAddressMatches.length){status.textContent="Aucune adresse trouvée. Vérifie la rue et la commune.";return;}
    pick.add(new Option("Choisir l'adresse validée", ""));
    modAddressMatches.forEach((entry,index)=>pick.add(new Option(entry.label,String(index))));
    pick.hidden=false;status.textContent="Sélectionne la bonne adresse dans la liste.";
  }catch(error){status.textContent="⚠️ "+error.message;}
  finally{btn.disabled=false;}
});
document.getElementById("adminAddressOptions").addEventListener("change",e=>{
  const index=e.target.value;
  const found=index===""?null:modAddressMatches[Number(index)];
  if(!found){modCoords=null;return;}
  modCoords={lat:found.lat,lng:found.lng};modCommuneCode=found.communeCode||null;
  getModInput("address").value=found.label;
  if(found.city)getModInput("city").value=found.city;
  document.getElementById("adminAddressStatus").textContent="✅ Adresse vérifiée : "+found.label;
});
modForm.addEventListener("submit",async e=>{
  e.preventDefault();
  if(modBusy||!modEditId)return;
  if(!modCoords){toast("Valide la nouvelle adresse avant d'enregistrer.");return;}
  const payload={};
  for(const field of ["store","city","series","product","address","status"])payload[field]=getModInput(field).value.trim();
  payload.qty=Number(getModInput("qty").value);
  payload.price=getModInput("price").value===""?null:Number(getModInput("price").value);
  payload.lat=modCoords.lat;payload.lng=modCoords.lng;
  payload.communeCode=modCommuneCode;payload.websiteUrl=getModInput('websiteUrl').value.trim();
  const save=document.getElementById("adminSaveEdit");
  modBusy=true;save.disabled=true;save.textContent="⏳ Enregistrement...";
  try{
    await moderationRequest("/admin/reports/"+encodeURIComponent(modEditId),{method:"PATCH",body:payload});
    toast("✅ Référencement corrigé !");
    modEditId=null;modForm.hidden=true;
    await Promise.all([loadAdminReports(),loadCommunityReports()]);
  }catch(error){toast(error.message||"La modification a échoué.");}
  finally{modBusy=false;save.disabled=false;save.textContent="💾 Enregistrer";}
});
document.addEventListener("pokestock:authchanged",updateModerationPermissions);
updateModerationPermissions();
