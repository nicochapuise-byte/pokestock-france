// PokéStock France : votes de disponibilité et réputation (HTML/JS sans compilation).
const stockVotesByMe={};
const stockPendingVotes=new Set();
const stockApiRoot="https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech";
function communityStockStatus(report){
  const counts=report?.votes||{};
  if(counts.state==="confirmed")return {text:"✅ Confirmé par la communauté",css:"confirmed"};
  if(counts.state==="out_of_stock")return {text:"❌ Rupture signalée",css:"out-of-stock"};
  return {text:"🟠 Non vérifié",css:"unverified"};
}
function redrawCommunityCards(items){
  const cards=document.querySelectorAll("#stockGrid .stock-card");
  cards.forEach((card,index)=>{
    const r=items[index];
    if(!r?.votes||r.demo)return;
    const state=communityStockStatus(r);
    card.classList.remove("confirmed","out-of-stock","unverified");
    card.classList.add(state.css);
    const badge=card.querySelector(".age-badge");
    if(badge){
      badge.textContent=state.text;
      badge.className="age-badge "+state.css;
    }
    const yes=Number(r.votes.available)||0,no=Number(r.votes.unavailable)||0;
    const summary=document.createElement("div");
    summary.className="community-vote-summary";
    const line=document.createElement("p");
    line.textContent="✅ "+yes+" confirmation(s) · ❌ "+no+" rupture(s)";
    summary.appendChild(line);
    const buttons=document.createElement("div");
    buttons.className="community-vote-buttons";
    const own=stockVotesByMe[r.id]||"";
    for(const [choice,title,cls] of [
      ["available","✅ Disponible","yes"],
      ["unavailable","❌ Rupture de stock","no"]
    ]){
      const b=document.createElement("button");
      b.type="button";
      b.className="vote-action "+cls+(own===choice?" is-selected":"");
      b.textContent=title;
      b.dataset.reportVote=choice;
      b.dataset.reportId=r.id;
      b.setAttribute("aria-pressed",String(own===choice));
      b.disabled=stockPendingVotes.has(r.id);
      buttons.appendChild(b);
    }
    summary.appendChild(buttons);
    if(own){
      const note=document.createElement("small");
      note.textContent="Ton avis est enregistré. Tu peux le modifier si le stock change.";
      summary.appendChild(note);
    }else{
      const note=document.createElement("small");
      note.textContent="Vote uniquement si tu as vérifié le rayon récemment.";
      summary.appendChild(note);
    }
    const body=card.querySelector(".stock-body");
    if(body)body.appendChild(summary);
  });
}
const originalCardRender=renderCards;
renderCards=function(items){
  originalCardRender(items);
  redrawCommunityCards(items);
};
const originalMapRender=renderMap;
renderMap=function(items){
  originalMapRender(items);
  if(mapMode!=="leaflet"||!markerLayer)return;
  const pins=markerLayer.getLayers();
  pins.forEach((pin,index)=>{
    const r=items[index];
    if(!r?.votes)return;
    const state=communityStockStatus(r);
    const normal=seriesById(r.series).color;
    pin.setIcon(makeIcon(state.css==="out-of-stock"?"#94a3b8":normal));
    pin.setPopupContent(buildProductPopup(r,{status:state.text}));
  });
};
const originalCommunityLoad=loadCommunityReports;
loadCommunityReports=async function(){
  const result=await originalCommunityLoad();
  const status=document.getElementById("communityStatus");
  if(status&&remoteReports.length){
    status.textContent="🌍 "+remoteReports.length+" signalement(s) communautaire(s) actifs. Deux votes indépendants et majoritaires sont requis pour confirmer une disponibilité ou une rupture. 🧪 Les six exemples sont fictifs. Les votes ne garantissent pas le stock.";
  }
  return result;
};
async function loadMyStockVotes(){
  const api=window.pokestockApi;
  if(!api?.ready||!api.getUser()){
    Object.keys(stockVotesByMe).forEach(key=>delete stockVotesByMe[key]);
    renderCards(filteredReports());
    return;
  }
  try{
    const token=await api.getToken();
    if(!token)return;
    const res=await fetch(stockApiRoot+"/me/votes",{headers:{"Authorization":"Bearer "+token},signal:AbortSignal.timeout(12000)});
    if(!res.ok)return;
    const data=await res.json();
    Object.keys(stockVotesByMe).forEach(key=>delete stockVotesByMe[key]);
    for(const v of (data.votes||[])){
      if(v&&["available","unavailable"].includes(v.verdict))stockVotesByMe[v.report_id]=v.verdict;
    }
    renderCards(filteredReports());
  }catch(error){console.warn("Historique des votes indisponible",error);}
}
async function castCommunityVote(id,verdict){
  if(stockPendingVotes.has(id))return;
  const api=window.pokestockApi;
  if(!api?.ready||!api.getUser()){
    toast("Connecte-toi pour confirmer ou signaler une rupture.");
    api?.openLogin();return;
  }
  stockPendingVotes.add(id);
  renderCards(filteredReports());
  try{
    const token=await api.getToken();
    if(!token){api.openLogin();throw Error("Session expirée : reconnecte-toi.");}
    const res=await fetch(stockApiRoot+"/reports/"+encodeURIComponent(id)+"/vote",{
      method:"POST",
      headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({verdict}),
      signal:AbortSignal.timeout(15000)
    });
    let data;
    try{data=await res.json();}catch{throw Error("Réponse invalide du serveur.");}
    if(!res.ok)throw Error(data.error||"Impossible d'enregistrer ton avis.");
    stockVotesByMe[id]=data.myVote;
    const report=remoteReports.find(r=>r.id===id);
    if(report)report.votes=data.votes;
    toast(verdict==="available"?"✅ Merci, disponibilité signalée !":"❌ Merci, rupture signalée !");
    renderAll();
    refreshStockReputation();
  }catch(err){toast(err.message||"Vote non enregistré.");}
  finally{stockPendingVotes.delete(id);renderCards(filteredReports());}
}
const reportGrid=document.getElementById("stockGrid");
reportGrid.addEventListener("click",event=>{
  const target=event.target.closest("[data-report-vote]");
  if(target)castCommunityVote(target.dataset.reportId,target.dataset.reportVote);
});
async function refreshStockReputation(){
  const panel=document.getElementById("communityReputation");
  if(!panel)return;
  const api=window.pokestockApi;
  const loggedIn=!!(api?.ready&&api.getUser());
  panel.hidden=!loggedIn;
  if(!loggedIn)return;
  panel.textContent="⭐ Chargement de ta réputation...";
  try{
    const token=await api.getToken();
    if(!token)throw Error("Jeton de session indisponible.");
    const response=await fetch(stockApiRoot+"/me/reputation",{
      headers:{"Authorization":"Bearer "+token},
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)throw Error("Score indisponible pour le moment.");
    const data=await response.json();
    const points=Math.max(0,Number(data.points)||0);
    panel.innerHTML="<h3>⭐ Ma réputation : "+points+" point(s)</h3>"+
      "<p>Niveau : <b>"+escapeHtml(data.badge)+"</b></p>"+
      "<p>✅ "+(Number(data.confirmedReports)||0)+" signalement(s) confirmés × 10 points</p>"+
      "<p>🤝 "+(Number(data.helpfulVotes)||0)+" vote(s) utiles × 1 point</p>"+
      "<small>Calcul sur 90 jours, selon l'accord de plusieurs membres. Score indicatif, pas une garantie de fiabilité.</small>";
  }catch(err){
    panel.textContent="⭐ Réputation momentanément indisponible.";
  }
}
document.addEventListener("pokestock:authchanged",()=>{
  loadMyStockVotes();
  refreshStockReputation();
});
document.getElementById("accountBtn").addEventListener("click",refreshStockReputation);
renderAll();
