let series = [
  {id:"ev",name:"Écarlate & Violet",color:"#ef3340"},
  {id:"151",name:"151",color:"#7357e6"},
  {id:"prism",name:"Évolutions Prismatiques",color:"#2968e8"},
  {id:"paldea",name:"Destinées de Paldea",color:"#27b36a"},
  {id:"blackwhite",name:"Foudre Noire & Flamme Blanche",color:"#222a3d"},
  {id:"mega",name:"Méga-Évolution",color:"#ff9f2f"}
];

const seedReports = [
  {id:"a1",store:"Carrefour",city:"Paris",product:"Booster Écarlate & Violet",series:"ev",price:6.49,qty:12,lat:48.8566,lng:2.3522,hours:3,img:"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"},
  {id:"a2",store:"Fnac Part-Dieu",city:"Lyon",product:"Collection 151",series:"151",price:34.99,qty:6,lat:45.7601,lng:4.8596,hours:8,img:"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png"},
  {id:"a3",store:"Cultura",city:"Lille",product:"Coffret Évolutions Prismatiques",series:"prism",price:29.99,qty:4,lat:50.6292,lng:3.0573,hours:28,img:"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/133.png"},
  {id:"a4",store:"Micromania",city:"Bordeaux",product:"ETB Destinées de Paldea",series:"paldea",price:54.99,qty:3,lat:44.8378,lng:-0.5792,hours:55,img:"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/906.png"},
  {id:"a5",store:"Leclerc",city:"Marseille",product:"Tripack Foudre Noire",series:"blackwhite",price:17.99,qty:9,lat:43.2965,lng:5.3698,hours:90,img:"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/643.png"},
  {id:"a6",store:"JouéClub",city:"Nantes",product:"Mini Tin Méga-Évolution",series:"mega",price:12.99,qty:7,lat:47.2184,lng:-1.5536,hours:6,img:"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/448.png"}
];

const cityCoords = {
  paris:[48.8566,2.3522],lyon:[45.764,4.8357],lille:[50.6292,3.0573],bordeaux:[44.8378,-0.5792],
  marseille:[43.2965,5.3698],nantes:[47.2184,-1.5536],toulouse:[43.6047,1.4442],nice:[43.7102,7.262],
  rennes:[48.1173,-1.6778],strasbourg:[48.5734,7.7521],montpellier:[43.6108,3.8767],grenoble:[45.1885,5.7245]
};

function readLocalReports(){
  try { const stored=JSON.parse(localStorage.getItem("pokestockReports") || "[]"); return Array.isArray(stored)?stored:[]; }
  catch(e){ console.warn("Stockage local indisponible", e); return []; }
}
function writeLocalReports(items){
  try { localStorage.setItem("pokestockReports", JSON.stringify(items)); return true; }
  catch(e){ console.warn("Stockage local indisponible", e); return false; }
}

const API_BASE="https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech";
let remoteReports=[];
let communityLoadState="loading";
let reports = [...seedReports.map(r=>({...r,demo:true})), ...readLocalReports()];
let selectedSeries = new Set();
let showExamples = false;
let onlyRecent = false;
let lastReportTrigger = null;
let photoData = "";
let verifiedAddress = null;
let addressMatches = [];
let map;
let markerLayer;
let mapMode = "fallback";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const seriesById = id => series.find(s=>s.id===id) || {name:"Autre",color:"#64748b"};

function escapeHtml(value){return String(value??"").replace(/[&<>"\x27]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","\x27":"&#39;"}[c]));}
function safeImage(src){const value=String(src||"");return value==="catalog-upc151-chat.svg"||/^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/|^https:\/\/[a-z0-9.-]+\.neon\.tech\/|^data:image\/(?:png|jpeg|webp);base64,/i.test(value)?value:"catalog-placeholder.svg";}
function reportHours(r){return (r.lastSeenAt||r.createdAt)?Math.max(0,(Date.now()-Date.parse(r.lastSeenAt||r.createdAt))/3600000):(r.hours||0);}
function ageClass(hours){ return hours<24?"fresh":hours<=72?"medium":"old"; }
function ageText(hours){ return hours<24?(hours<1?"À l'instant":"Il y a "+Math.floor(hours)+" h"):hours<=72?"Il y a "+Math.round(hours/24)+" j":"À vérifier"; }

function initFallbackMap(){
  const el = document.getElementById("map");
  mapMode = "fallback";
  el.classList.add("fallback-map");
  el.innerHTML = `
    <div class="fallback-sky"></div>
    <div class="france-shape">
      <span class="france-label">FRANCE</span>
    </div>
    <div class="fallback-pins" id="fallbackPins"></div>
    <div class="fallback-note">Carte simplifiée — mode hors dépendance</div>
  `;
}

function switchToFallbackMap(){
  if(mapMode==="fallback") return;
  try{ if(map) map.remove(); }catch(e){ console.warn(e); }
  map=null;
  markerLayer=null;
  const el=document.getElementById("map");
  el.className="";
  el.innerHTML="";
  initFallbackMap();
  renderMap(filteredReports());
  toast("Fond de carte indisponible : affichage de la carte simplifiée.");
}

function initMap(){
  if(!window.L){
    initFallbackMap();
    return;
  }
  try{
    map = L.map("map",{zoomControl:true}).setView([46.6,2.4],6);
    map.fitBounds([[41.5,-5.4],[51.2,9.7]],{padding:[12,12],maxZoom:6});
    markerLayer = L.layerGroup().addTo(map);
    mapMode = "leaflet";

    // CARTO exige desormais une cle API : utiliser des fonds libres sans cle.
    const tileProviders = [
      {
        url:"https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
        options:{
          subdomains:"abc",maxZoom:20,
          attribution:'Données &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> — rendu <a href="https://www.openstreetmap.fr/">OSM France</a>'
        }
      },
      {
        url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        options:{
          maxZoom:19,
          attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        }
      }
    ];

    let activeTiles=null;
    let loadTimeout=null;

    function useProvider(index){
      if(mapMode!=="leaflet" || !map) return;
      if(loadTimeout) clearTimeout(loadTimeout);
      if(activeTiles) map.removeLayer(activeTiles);
      if(index>=tileProviders.length){
        switchToFallbackMap();
        return;
      }

      const provider=tileProviders[index];
      const tiles=L.tileLayer(provider.url,provider.options);
      activeTiles=tiles;
      let loaded=false;
      let errors=0;
      tiles.on("tileload",()=>{
        if(activeTiles!==tiles) return;
        loaded=true;
        if(loadTimeout) clearTimeout(loadTimeout);
      });
      tiles.on("tileerror",()=>{
        if(activeTiles!==tiles || loaded) return;
        errors++;
        if(errors>=3) useProvider(index+1);
      });
      tiles.addTo(map);
      loadTimeout=setTimeout(()=>{
        if(activeTiles===tiles && !loaded) useProvider(index+1);
      },8000);
    }

    useProvider(0);
    setTimeout(()=>{if(map && mapMode==="leaflet") map.invalidateSize();},250);
    return;
  }catch(e){
    console.warn("Impossible de charger Leaflet, affichage de la carte simplifiee.",e);
    try{if(map) map.remove();}catch(err){console.warn(err);}
    map=null;
    markerLayer=null;
  }
  initFallbackMap();
}

function makeIcon(color){
  return L.divIcon({
    className:"pin-wrap",
    html:'<div class="custom-pin" style="background:'+color+'"><i></i></div>',
    iconSize:[34,34],iconAnchor:[17,34],popupAnchor:[0,-32]
  });
}

function filteredReports(){
  const q=$("#searchInput").value.trim().toLowerCase();
  return reports.filter(r=>{
    const seriesOk=!selectedSeries.size||selectedSeries.has(r.series);
    const qOk=!q||[r.store,r.city,r.product,seriesById(r.series).name].join(" ").toLowerCase().includes(q);
    return seriesOk&&qOk&&(!r.demo||showExamples)&&(!onlyRecent||reportHours(r)<24);
  });
}

function renderFilters(){
  const target=$("#seriesFilters");
  const search=$("#seriesFilterSearch")?.value?.trim().toLocaleLowerCase("fr")||"";
  const savedOpen=new Set($$("#seriesFilters details[open]").map(d=>d.dataset.block));
  const groups=new Map();
  for(const s of series){
    const block=s.block||"Autres séries";
    const searchable=[s.name,s.code,block].join(" ").toLocaleLowerCase("fr");
    if(search&&!searchable.includes(search))continue;
    if(!groups.has(block))groups.set(block,[]);
    groups.get(block).push(s);
  }
  target.replaceChildren();
  for(const [block,entries] of groups){
    const details=document.createElement("details");
    details.className="series-filter-group";
    details.dataset.block=block;
    details.open=search.length>0||savedOpen.has(block)||(!search&&savedOpen.size===0&&(block==="Méga-Évolution"||block==="Écarlate et Violet"));
    const summary=document.createElement("summary");
    summary.textContent=block+" ("+entries.length+")";
    details.appendChild(summary);
    const holder=document.createElement("div");
    holder.className="series-filter-items";
    entries.forEach(entry=>{
      const label=document.createElement("label");
      label.className="series-pill";
      const checkbox=document.createElement("input");
      checkbox.type="checkbox";checkbox.value=entry.id;
      checkbox.checked=selectedSeries.has(entry.id);
      checkbox.addEventListener("change",()=>{
        if(checkbox.checked)selectedSeries.add(entry.id);
        else selectedSeries.delete(entry.id);
        renderAll();
      });
      const dot=document.createElement("i");dot.className="series-swatch";dot.style.background=entry.color;
      const text=document.createElement("span");
      text.textContent=entry.name+(entry.code?" · "+entry.code:"");
      label.append(checkbox,dot,text);
      holder.appendChild(label);
    });
    details.appendChild(holder);
    target.appendChild(details);
  }
  if(!groups.size){
    const empty=document.createElement("p");
    empty.className="filters-empty";
    empty.textContent="Aucune extension correspondant à cette recherche.";
    target.appendChild(empty);
  }
  const oldSelect=$("#reportSeries");
  const previous=oldSelect.value;
  oldSelect.replaceChildren();
  series.forEach(entry=>oldSelect.add(new Option(entry.name,entry.id)));
  if(series.some(entry=>entry.id===previous))oldSelect.value=previous;
}

function projectToFallback(lat,lng){
  const minLng=-5.5,maxLng=9.8,minLat=41,maxLat=51.5;
  const x=Math.max(6,Math.min(94,((lng-minLng)/(maxLng-minLng))*100));
  const y=Math.max(6,Math.min(94,((maxLat-lat)/(maxLat-minLat))*100));
  return [x,y];
}


/**
 * Carte : une popup riche avec le visuel public du catalogue.
 * Ne jamais exposer les photos de preuve privées des contributeurs.
 */
function popupProductPhoto(report){
  // Les signalements récents utilisent les visuels autorisés du catalogue.
  // Pas de diffusion des photos de preuve privées.
  if(report.catalogVariantId==="151-upc-mew" && !report.img)return "catalog-upc151-chat.svg";
  const url=safeImage(report.img);
  return url||"catalog-placeholder.svg";
}
function sellerWebsiteLink(report){
  if(!report.websiteUrl)return '';
  try{const url=new URL(report.websiteUrl);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return '';
    return '<a class="seller-website" href="'+escapeHtml(url.href)+'" target="_blank" rel="noopener noreferrer">'+(report.sellerType==='private'?'Site du vendeur':'Site de la boutique')+' ↗</a>';
  }catch{return '';}
}
function sellerProfileLink(report){
  if(report.demo||typeof report.sellerId!=='string'||!/^[a-f0-9]{64}$/.test(report.sellerId))return '';
  return '<a class="seller-profile-link" href="seller.html?id='+report.sellerId+'">Voir les produits du vendeur <span aria-hidden="true">→</span></a>';
}
function sellerDetails(report){return report.sellerType==='private'?'<span class="seller-label">Particulier · Centre de la commune, localisation approximative</span>':report.sellerType==='professional'?'<span class="seller-label">Professionnel</span>':'';}
function buildProductPopup(report, options={}){
  const title=escapeHtml(report.product||"Produit Pokémon");
  const store=escapeHtml(report.store||"Magasin non précisé");
  const city=escapeHtml(report.city||"");
  const artSet=report.artSet?escapeHtml(report.artSet):"";
  const status=escapeHtml(options.status||(
    report.demo?"Exemple fictif":report.votes?.state==="confirmed"?"Confirmé par des membres":
    report.votes?.state==="out_of_stock"?"Rupture signalée":"À confirmer"
  ));
  const image=popupProductPhoto(report);
  const realProductPhoto=image!=="catalog-placeholder.svg"&&!report.demo;
  const caption=realProductPhoto?"Photo du produit":report.demo?"Illustration de démonstration":"Visuel indicatif";
  const amount=report.price!==null&&report.price!==undefined&&report.price!==""&&Number.isFinite(Number(report.price))
    ?new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(Number(report.price)):"Prix non indiqué";
  const counts=report.votes?
    '<span class="popup-stock-votes">'+(Number(report.votes.available)||0)+' confirmation(s) · '+(Number(report.votes.unavailable)||0)+' rupture(s)</span>':"";
  return '<div class="popup-product-card">'+
    '<div class="popup-product-photo">'+
      '<img class="popup-product-image" src="'+escapeHtml(image)+'" alt="'+(realProductPhoto?"Photo du coffret : ":"Illustration pour ")+title+'" loading="eager">'+
      '<span class="popup-product-picture-note">'+caption+'</span>'+
    '</div>'+
    '<div class="popup-product-details">'+
      '<h3 class="popup-product-title">'+title+'</h3>'+
      (artSet?'<span class="popup-product-artset">'+artSet+'</span>':"")+
      '<p class="popup-product-store">'+(report.sellerType==='private'?'Particulier':store)+' · '+city+'</p>'+sellerDetails(report)+sellerWebsiteLink(report)+sellerProfileLink(report)+
      '<div class="popup-product-info"><span class="popup-product-status">'+status+'</span>'+counts+'</div>'+
      '<div class="popup-product-bottom"><span>'+escapeHtml(ageText(reportHours(report)))+'</span><b>'+escapeHtml(amount)+'</b></div>'+
      '<p class="popup-product-disclaimer">Stock déclaré par un membre ; disponibilité non garantie.</p>'+
    '</div>'+
  '</div>';
}
function attachPopupImageFallback(marker){
  marker.on("popupopen",()=>{
    const img=marker.getPopup()?.getElement()?.querySelector(".popup-product-image");
    if(!img)return;
    const fallback=()=>{
      img.src="catalog-placeholder.svg";
      img.alt="Illustration indicative du catalogue";
      const note=img.closest(".popup-product-media")?.querySelector(".popup-product-picture-note");
      if(note)note.textContent="Visuel indicatif";
    };
    img.addEventListener("error",fallback,{once:true});
    if(img.complete&&img.naturalWidth===0&&img.src&&!img.src.endsWith("/catalog-placeholder.svg"))fallback();
  });
}

function renderMap(items){
  if(mapMode==="leaflet" && markerLayer){
    markerLayer.clearLayers();
    items.forEach(r=>{
      const s=seriesById(r.series);
      const marker=L.marker([r.lat,r.lng],{icon:makeIcon(s.color)})
        .bindPopup(buildProductPopup(r),{className:"pokestock-popup",maxWidth:288,minWidth:288,autoPan:true,autoPanPadding:[16,16],keepInView:true})
        .addTo(markerLayer);
      attachPopupImageFallback(marker);
    });
  }else{
    const holder=document.getElementById("fallbackPins");
    if(holder){
      holder.innerHTML=items.map(r=>{
        const s=seriesById(r.series),p=projectToFallback(r.lat,r.lng);
        return `<button class="fallback-pin" style="left:${p[0]}%;top:${p[1]}%;background:${s.color}" title="${escapeHtml(r.product)} — ${escapeHtml(r.store)}, ${escapeHtml(r.city)}" aria-label="${escapeHtml(r.product)}, ${escapeHtml(r.store)}, ${escapeHtml(r.city)}"></button>`;
      }).join("");
    }
  }
  $("#visibleCount").textContent=items.length;
}

function renderCards(items){
  const grid=$("#stockGrid");
  grid.innerHTML=items.map(r=>{
    const s=seriesById(r.series), age=ageClass(reportHours(r));
    return `<article class="stock-card">
      <div class="stock-image">
        <span class="age-badge ${age}">${r.demo?"Exemple fictif":r.status==="pending"?"À confirmer":ageText(reportHours(r))}</span>
        <img src="${popupProductPhoto(r)}" alt="Image du produit ou visuel de référence">
      </div>
      <div class="stock-body">
        <span class="stock-series" style="color:${s.color}">${escapeHtml(s.name)}</span>
        <h3>${escapeHtml(r.product)}</h3>${r.artSet?`<p class="stock-artset">${escapeHtml(r.artSet)}</p>`:""}
        <p class="stock-place">${escapeHtml(r.sellerType==='private'?'Particulier':r.store)} <span>· ${escapeHtml(r.city)}</span></p>${sellerDetails(r)}${sellerWebsiteLink(r)}${sellerProfileLink(r)}${r.sellerType!=='private'&&r.address?`<p class="stock-address">${escapeHtml(r.address)}</p>`:""}
        <div class="stock-meta"><span>${r.qty||1} unité(s) aperçue(s)</span><b>${r.price!=null?new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(r.price)):"Prix non renseigné"}</b></div>
      </div>
    </article>`;
  }).join("");
  $("#emptyState").hidden=items.length>0;
}

function updateStats(){
  $("#reportCount").textContent=communityLoadState==="ready"?new Intl.NumberFormat('fr-FR').format(remoteReports.length):"—";
  const counterStatus=$("#reportCountStatus");
  if(counterStatus)counterStatus.textContent=communityLoadState==="ready"?"Signalements actifs · hors exemples fictifs":communityLoadState==="error"?"Compteur indisponible · actualisez la page":"Chargement des signalements…";
  $("#cityCount").textContent=new Set(reports.filter(r=>!r.demo).map(r=>r.city.toLowerCase())).size;
  $("#seriesCount").textContent=series.length;
}

function renderAll(){
  const items=filteredReports();
  renderMap(items);
  renderCards(items);
  updateStats();
  document.dispatchEvent(new CustomEvent("pokestock:results",{detail:{count:items.length,filters:selectedSeries.size,recent:onlyRecent,examples:showExamples}}));
}

function openModal(){
  lastReportTrigger=document.activeElement;
  $("#reportModal").classList.add("open");
  $("#reportModal").setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  document.dispatchEvent(new Event("pokestock:reportopen"));
  requestAnimationFrame(()=>$("#catalogSeriesSearch")?.focus());
}
function closeModal(){
  $("#reportModal").classList.remove("open");
  $("#reportModal").setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  lastReportTrigger?.focus();
}
function toast(message){
  const el=$("#toast");el.textContent=message;el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2600);
}

function approximateCoordinates(city){
  const key=city.trim().toLowerCase();
  if(cityCoords[key]) return cityCoords[key];
  return [46.6+(Math.random()-.5)*1.2,2.4+(Math.random()-.5)*1.5];
}


function isPrivateSeller(){return $("#sellerType").value==="private";}
let addressSearchSerial=0;
function resetVerifiedAddress(){
  addressSearchSerial++;
  verifiedAddress=null;addressMatches=[];
  $("#reportLat").value="";$("#reportLng").value="";$("#reportCommuneCode").value="";
  $("#addressResult").hidden=true;$("#addressResult").replaceChildren();
  $("#addressStatus").textContent=isPrivateSeller()?"Recherchez puis sélectionnez votre commune. Aucune adresse personnelle n’est demandée.":"Recherchez puis sélectionnez l’adresse de la boutique.";
}
function updateSellerFields(){
  const privateSeller=isPrivateSeller();
  for(const id of ['storeNameField','storeAddressField'])$("#"+id).hidden=privateSeller;
  for(const name of ['store','address']){
    const field=$("#reportForm [name="+name+"]");field.disabled=privateSeller;
    if(name!=='websiteUrl')field.required=!privateSeller;
    if(privateSeller)field.value='';
  }
  $("#storeWebsiteLabel").textContent=privateSeller?'Site web ou page de vente (facultatif)':'Site web de la boutique (facultatif)';
  $("#sellerPrivacyNote").hidden=!privateSeller;
  $("#verifyAddress").textContent=privateSeller?'Rechercher la commune':'Rechercher l’adresse';
  $("#addressResult").setAttribute('aria-label',privateSeller?'Choisir la commune':'Choisir l’adresse de la boutique');
  resetVerifiedAddress();
}
function getAddressFeature(feature){
  const coords=feature?.geometry?.coordinates,props=feature?.properties||{};
  if(!Array.isArray(coords)||coords.length<2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1]))return null;
  const lon=Number(coords[0]),lat=Number(coords[1]);
  if(lat<41||lat>52||lon< -6||lon>10)return null;
  return {lat:lat,lng:lon,label:String(props.label||props.name||""),city:String(props.city||""),score:Number(props.score||0)};
}
async function searchStoreAddress(){
  const privateSeller=isPrivateSeller();
  const address=$("#storeAddress").value.trim(),city=$("#storeCity").value.trim();
  const button=$("#verifyAddress"),results=$("#addressResult"),status=$("#addressStatus");
  resetVerifiedAddress();const serial=addressSearchSerial;
  if(!$("#sellerType").value){status.textContent="Choisissez d’abord Professionnel ou Particulier.";return;}
  if(city.length<2||(!privateSeller&&address.length<5)){status.textContent=privateSeller?"Indiquez le nom de votre commune.":"Indiquez l’adresse complète de la boutique et la commune.";return;}
  button.disabled=true;button.textContent="Recherche…";
  try{
    const endpoint=privateSeller?"https://geo.api.gouv.fr/communes?nom="+encodeURIComponent(city)+"&fields=nom,code,centre,codeDepartement&boost=population&limit=8":"https://data.geopf.fr/geocodage/search/?q="+encodeURIComponent(address+" "+city)+"&limit=5";
    const response=await fetch(endpoint,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error("Service de localisation indisponible.");
    const data=await response.json();if(serial!==addressSearchSerial)return;
    addressMatches=privateSeller?(Array.isArray(data)?data:[]).map(c=>({city:c.nom,label:c.nom+' ('+c.codeDepartement+')',communeCode:c.code,lat:c.centre?.coordinates?.[1],lng:c.centre?.coordinates?.[0],sellerType:'private'})).filter(c=>Number.isFinite(c.lat)&&Number.isFinite(c.lng)&&c.lat>=41&&c.lat<=52&&c.lng>=-6&&c.lng<=10):(data.features||[]).map(getAddressFeature).filter(Boolean).filter(x=>x.label).map(c=>({...c,sellerType:'professional'}));
    if(!addressMatches.length){status.textContent=privateSeller?"Aucune commune trouvée. Vérifiez son nom.":"Aucune adresse trouvée. Précisez le numéro, la rue et la commune.";return;}
    results.add(new Option(privateSeller?"Sélectionnez votre commune":"Sélectionnez l’adresse de la boutique", ""));
    addressMatches.forEach((result,i)=>results.add(new Option(result.label,String(i))));results.hidden=false;
    status.textContent=privateSeller?"Sélectionnez la commune. Le point sera placé à son centre.":"Sélectionnez l’adresse exacte de la boutique.";
  }catch(err){if(serial===addressSearchSerial)status.textContent="Impossible de vérifier la localisation. "+err.message;}
  finally{button.disabled=false;button.textContent=isPrivateSeller()?"Rechercher la commune":"Rechercher l’adresse";}
}
function chooseStoreAddress(){
  const index=$("#addressResult").value;
  verifiedAddress=index===""?null:addressMatches[Number(index)]||null;
  if(verifiedAddress){
    $("#reportLat").value=verifiedAddress.lat;$("#reportLng").value=verifiedAddress.lng;
    $("#reportCommuneCode").value=verifiedAddress.communeCode||'';
    if(!isPrivateSeller())$("#storeAddress").value=verifiedAddress.label;
    if(verifiedAddress.city)$("#storeCity").value=verifiedAddress.city;
    $("#addressStatus").textContent=isPrivateSeller()?"Commune validée : "+verifiedAddress.label+". Localisation approximative au centre de la commune.":"Adresse validée : "+verifiedAddress.label;
  }else{
    $("#reportLat").value='';$("#reportLng").value='';$("#reportCommuneCode").value='';
    $("#addressStatus").textContent='Sélectionnez un résultat pour valider la localisation.';
  }
}
function imageAsJpeg(file){
  return new Promise((resolve,reject)=>{
    if(file.size>10*1024*1024){reject(new Error("La photo ne doit pas dépasser 10 Mo."));return;}
    if(!file.type.startsWith("image/")){reject(new Error("Sélectionne une image valide."));return;}
    const image=new Image(),url=URL.createObjectURL(file);
    image.onload=()=>{
      try{
        URL.revokeObjectURL(url);
        const ratio=Math.min(1,1000/Math.max(image.naturalWidth,image.naturalHeight));
        if(!image.naturalWidth||!image.naturalHeight)throw new Error("Image illisible.");
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
        const ctx=canvas.getContext("2d");
        if(!ctx)throw new Error("Impossible de préparer la photo.");
        ctx.drawImage(image,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",0.68));
      }catch(err){reject(err);}
    };
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Format d'image non reconnu par Safari."));};
    image.src=url;
  });
}


async function loadCommunityReports(){
  const msg=$("#communityStatus");
  try{
    const res=await fetch(API_BASE+"/reports",{signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw Error("HTTP "+res.status);
    const data=await res.json();
    if(!Array.isArray(data.reports))throw Error("Données invalides");
    remoteReports=data.reports.filter(r=>r&&Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lng)))
      .map(r=>({...r,lat:Number(r.lat),lng:Number(r.lng),qty:Number(r.qty)||1}));
    communityLoadState="ready";
    reports=[...remoteReports,...readLocalReports(),...seedReports.map(r=>({...r,demo:true}))];
    msg.textContent=remoteReports.length+" signalement(s) communautaire(s) en cours de validité. Une disponibilité déclarée reste à confirmer avant de vous déplacer.";
    renderAll();
  }catch(err){
    communityLoadState="error";updateStats();
    console.warn("API PokéStock indisponible:",err);
    msg.textContent="Les signalements ne se chargent pas pour le moment. Actualisez la page pour réessayer. Les exemples fictifs sont accessibles dans les filtres.";
  }
}

function bindUI(){
  ["#openReportTop","#openReportHero","#openReportList"].forEach(id=>$(id).addEventListener("click",openModal));
  $$("[data-close-modal]").forEach(el=>el.addEventListener("click",closeModal));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
  $("#searchInput").addEventListener("input",renderAll);
  $("#seriesFilterSearch")?.addEventListener("input",renderFilters);
  $("#clearFilters").addEventListener("click",()=>{
    selectedSeries.clear();
    onlyRecent=false;
    $$("#seriesFilters input").forEach(i=>i.checked=false);
    $("#searchInput").value="";
    const seriesQuery=$("#seriesFilterSearch");
    if(seriesQuery)seriesQuery.value="";
    renderFilters();
    renderAll();
  });

  $("#locateBtn").addEventListener("click",()=>{
    if(!navigator.geolocation){toast("La géolocalisation n'est pas disponible dans ce navigateur.");return}
    navigator.geolocation.getCurrentPosition(pos=>{
      const p=[pos.coords.latitude,pos.coords.longitude];
      if(mapMode==="leaflet" && map){
        map.flyTo(p,12);
        L.circleMarker(p,{radius:9,color:"#2968e8",fillColor:"#fff",fillOpacity:1,weight:5}).addTo(map).bindPopup("Tu es ici").openPopup();
      }else{
        const holder=document.getElementById("fallbackPins");
        if(holder){
          const xy=projectToFallback(p[0],p[1]);
          const me=document.createElement("button");
          me.className="fallback-pin me";
          me.style.left=xy[0]+"%";me.style.top=xy[1]+"%";
          me.title="Tu es ici";
          holder.appendChild(me);
        }
      }
      toast("Position trouvée ! Attention : les signalements utilisent l’adresse du magasin, pas ta position.");
    },()=>toast("Autorise la localisation, ou ouvre le site via HTTPS/localhost pour cette fonction."));
  });

  $("#sellerType").addEventListener("change",updateSellerFields);
  document.addEventListener("pokestock:reportreset",updateSellerFields);
  updateSellerFields();
  $("#verifyAddress").addEventListener("click",searchStoreAddress);
  $("#addressResult").addEventListener("change",chooseStoreAddress);
  $("#storeAddress").addEventListener("input",resetVerifiedAddress);
  $("#storeCity").addEventListener("input",resetVerifiedAddress);

  $("#photoInput").addEventListener("change",async e=>{
    photoData="";
    const file=e.target.files[0],preview=$("#photoPreview");
    preview.textContent="🖼️ Aperçu de la photo";
    if(!file)return;
    preview.textContent="⏳ Préparation de la photo...";
    try{
      photoData=await imageAsJpeg(file);
      const img=document.createElement("img");
      img.src=photoData;img.alt="Aperçu du produit";
      preview.replaceChildren(img);
    }catch(err){
      e.target.value="";
      preview.textContent="⚠️ "+err.message;
      toast(err.message);
    }
  });

  $("#reportForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const submitBtn=form.querySelector('button[type="submit"]');
    // Désactiver immédiatement le bouton : Safari permet autrement deux envois rapides.
    if(submitBtn.disabled)return;
    const data=new FormData(form);
    if(!verifiedAddress){
      toast(isPrivateSeller()?"Sélectionnez votre commune.":"Sélectionnez l’adresse vérifiée de la boutique.");
      $(isPrivateSeller()?"#storeCity":"#storeAddress").focus();return;
    }
    // Photo preuve privée facultative : le visuel public vient du catalogue.
    submitBtn.disabled=true;
    submitBtn.textContent="⏳ Publication...";
    try{
      const api=window.pokestockApi;
      if(!api?.ready)throw Error("Connexion en cours d'initialisation. Réessaie.");
      if(!api.getUser()){
        toast("Connecte-toi pour publier un signalement communautaire.");
        api.openLogin();return;
      }
      const token=await api.getToken();
      if(!token){
        toast("La session a expiré. Reconnecte-toi puis réessaie.");
        api.openLogin();return;
      }
      const payload={
        catalogVariantId:String(data.get("catalogVariantId")||""),
        sellerType:String(data.get("sellerType")||""),
        communeCode:isPrivateSeller()?verifiedAddress.communeCode:null,
        websiteUrl:String(data.get("websiteUrl")||"").trim(),
        store:isPrivateSeller()?"Particulier":String(data.get("store")||"").trim().slice(0,140),
        city:String(data.get("city")||"").trim().slice(0,120),
        address:isPrivateSeller()?null:verifiedAddress.label,
        series:String(data.get("series")||""),
        product:String(data.get("product")||"").trim().slice(0,200),
        price:data.get("price")?Number(data.get("price")):null,
        qty:Number(data.get("quantity"))||1,
        lat:verifiedAddress.lat,lng:verifiedAddress.lng,photo:photoData
      };
      if(!payload.sellerType||!payload.catalogVariantId||!payload.store||!payload.city){
        toast("Sélectionne une série, un article, un art set et complète les informations du magasin.");return;
      }
      const response=await fetch(API_BASE+"/reports",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)
      });
      let result;
      try{result=await response.json();}
      catch{throw Error("Le serveur a renvoyé une réponse incorrecte.");}
      if(response.status===409&&result.duplicate){
        toast("✅ Ce produit est déjà signalé pour ce magasin. Aucun doublon ajouté.");
        return;
      }
      if(!response.ok)throw Error(result.error||"Erreur de publication ("+response.status+").");
      // Une réponse positive vaut succès même si le rafraîchissement de la carte échoue.
      form.reset();
      document.dispatchEvent(new Event("pokestock:reportreset"));
      photoData="";
      resetVerifiedAddress();
      $("#photoPreview").textContent="🖼️ Aperçu de la photo";
      closeModal();
      toast("✅ Signalement enregistré ! Stock non vérifié.");
      if(mapMode==="leaflet"&&map)map.flyTo([payload.lat,payload.lng],payload.sellerType==="private"?11:13);
      loadCommunityReports().catch(err=>console.warn("Affichage communautaire:",err));
    }catch(err){
      toast("Impossible de publier : "+(err.message||"Erreur de connexion"));
    }finally{
      submitBtn.disabled=false;
      submitBtn.textContent="Publier le signalement";
    }
  });
}

initMap();
renderFilters();
bindUI();
renderAll();
loadCommunityReports();
