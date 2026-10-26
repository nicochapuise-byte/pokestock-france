const series = [
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
let reports = [...seedReports.map(r=>({...r,demo:true})), ...readLocalReports()];
let selectedSeries = new Set();
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
function safeImage(src){const value=String(src||"");return /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/|^https:\/\/[a-z0-9.-]+\.neon\.tech\/|^data:image\/(?:png|jpeg|webp);base64,/i.test(value)?value:"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png";}
function reportHours(r){return r.createdAt?Math.max(0,(Date.now()-Date.parse(r.createdAt))/3600000):(r.hours||0);}
function ageClass(hours){ return hours<24?"fresh":hours<=72?"medium":"old"; }
function ageText(hours){ return hours<24?(hours<1?"À l'instant":"Il y a "+hours+" h"):hours<=72?"Il y a "+Math.round(hours/24)+" j":"À vérifier"; }

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
    return seriesOk&&qOk;
  });
}

function renderFilters(){
  $("#seriesFilters").innerHTML=series.map(s=>`
    <label class="series-pill">
      <input type="checkbox" value="${s.id}">
      <i class="series-swatch" style="background:${s.color}"></i>
      <span>${s.name}</span>
    </label>`).join("");
  $("#reportSeries").innerHTML=series.map(s=>`<option value="${s.id}">${s.name}</option>`).join("");
  $$("#seriesFilters input").forEach(input=>input.addEventListener("change",e=>{
    e.target.checked?selectedSeries.add(e.target.value):selectedSeries.delete(e.target.value);
    renderAll();
  }));
}

function projectToFallback(lat,lng){
  const minLng=-5.5,maxLng=9.8,minLat=41,maxLat=51.5;
  const x=Math.max(6,Math.min(94,((lng-minLng)/(maxLng-minLng))*100));
  const y=Math.max(6,Math.min(94,((maxLat-lat)/(maxLat-minLat))*100));
  return [x,y];
}

function renderMap(items){
  if(mapMode==="leaflet" && markerLayer){
    markerLayer.clearLayers();
    items.forEach(r=>{
      const s=seriesById(r.series);
      L.marker([r.lat,r.lng],{icon:makeIcon(s.color)})
        .bindPopup(`<div class="popup-card"><b>${escapeHtml(r.product)}</b><span>${escapeHtml(r.store)} • ${escapeHtml(r.city)}</span><br><span>${r.demo?"🧪 Exemple • ":""}${ageText(reportHours(r))} • ${r.price?Number(r.price).toFixed(2)+" €":"Prix non indiqué"}</span></div>`)
        .addTo(markerLayer);
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
        <span class="age-badge ${age}">${r.demo?"🧪 Exemple":r.status==="pending"?"🟠 Non vérifié":"🕒 "+ageText(reportHours(r))}</span>
        <img src="${safeImage(r.img)}" alt="Photo du produit">
      </div>
      <div class="stock-body">
        <span class="stock-series" style="color:${s.color}">${escapeHtml(s.name)}</span>
        <h3>${escapeHtml(r.product)}</h3>
        <p class="stock-place">📍 ${escapeHtml(r.store)} • ${escapeHtml(r.city)}</p>${r.address?`<p class="stock-address">${escapeHtml(r.address)}</p>`:""}
        <div class="stock-meta"><span>Stock aperçu : <b>${r.qty||1}</b></span><b>${r.price?Number(r.price).toFixed(2)+" €":"—"}</b></div>
      </div>
    </article>`;
  }).join("");
  $("#emptyState").hidden=items.length>0;
}

function updateStats(){
  $("#reportCount").textContent=reports.filter(r=>!r.demo).length;
  $("#cityCount").textContent=new Set(reports.map(r=>r.city.toLowerCase())).size;
  $("#seriesCount").textContent=series.length;
}

function renderAll(){
  const items=filteredReports();
  renderMap(items);
  renderCards(items);
  updateStats();
}

function openModal(){
  $("#reportModal").classList.add("open");
  $("#reportModal").setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}
function closeModal(){
  $("#reportModal").classList.remove("open");
  $("#reportModal").setAttribute("aria-hidden","true");
  document.body.style.overflow="";
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


function resetVerifiedAddress(){
  verifiedAddress=null;
  $("#reportLat").value="";
  $("#reportLng").value="";
  $("#addressResult").hidden=true;
  $("#addressResult").replaceChildren();
  $("#addressStatus").textContent="Recherche l'adresse, puis sélectionne le résultat correspondant au magasin.";
}
function getAddressFeature(feature){
  const coords=feature?.geometry?.coordinates,props=feature?.properties||{};
  if(!Array.isArray(coords)||coords.length<2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1]))return null;
  const lon=Number(coords[0]),lat=Number(coords[1]);
  if(lat<41||lat>52||lon< -6||lon>10)return null;
  return {lat:lat,lng:lon,label:String(props.label||props.name||""),city:String(props.city||""),score:Number(props.score||0)};
}
async function searchStoreAddress(){
  const address=$("#storeAddress").value.trim(),city=$("#storeCity").value.trim();
  const button=$("#verifyAddress"),results=$("#addressResult"),status=$("#addressStatus");
  resetVerifiedAddress();
  if(address.length<5||city.length<2){
    status.textContent="Indique l'adresse complète et la ville avant de rechercher.";return;
  }
  button.disabled=true;button.textContent="⏳ Recherche...";
  try{
    const query=encodeURIComponent(address+" "+city);
    const response=await fetch("https://data.geopf.fr/geocodage/search/?q="+query+"&limit=5",{headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("Service de géocodage indisponible ("+response.status+").");
    const data=await response.json();
    addressMatches=(data.features||[]).map(getAddressFeature).filter(Boolean).filter(x=>x.label);
    if(!addressMatches.length){
      status.textContent="Aucune adresse trouvée. Précise la rue, le numéro et la commune.";return;
    }
    results.add(new Option("Sélectionne l'adresse exacte parmi les résultats", ""));
    addressMatches.forEach((result,i)=>results.add(new Option(result.label,String(i))));
    results.hidden=false;
    status.textContent="Sélectionne l'adresse du magasin dans la liste pour placer le point.";
  }catch(err){
    status.textContent="Impossible de vérifier cette adresse pour le moment. "+err.message;
  }finally{button.disabled=false;button.textContent="📍 Rechercher l'adresse";}
}
function chooseStoreAddress(){
  const index=$("#addressResult").value;
  verifiedAddress=index===""?null:addressMatches[Number(index)]||null;
  if(verifiedAddress){
    $("#reportLat").value=verifiedAddress.lat;
    $("#reportLng").value=verifiedAddress.lng;
    $("#storeAddress").value=verifiedAddress.label;
    if(verifiedAddress.city)$("#storeCity").value=verifiedAddress.city;
    $("#addressStatus").textContent="✅ Adresse validée : "+verifiedAddress.label;
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
    reports=[...remoteReports,...readLocalReports(),...seedReports.map(r=>({...r,demo:true}))];
    msg.textContent="🌍 "+remoteReports.length+" signalement(s) communautaire(s) en cours de validité. 🧪 Les 6 exemples affichés sur la carte sont fictifs. « Non vérifié » signifie que le stock est déclaré par un membre, sans garantie de disponibilité.";
    renderAll();
  }catch(err){
    console.warn("API PokéStock indisponible:",err);
    msg.textContent="⚠️ Impossible de charger les stocks communautaires pour le moment. Les 6 exemples restent visibles. Actualise la page pour réessayer.";
  }
}

function bindUI(){
  ["#openReportTop","#openReportHero","#openReportList"].forEach(id=>$(id).addEventListener("click",openModal));
  $$("[data-close-modal]").forEach(el=>el.addEventListener("click",closeModal));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
  $("#searchInput").addEventListener("input",renderAll);
  $("#clearFilters").addEventListener("click",()=>{
    selectedSeries.clear();
    $$("#seriesFilters input").forEach(i=>i.checked=false);
    $("#searchInput").value="";
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
    const data=new FormData(e.currentTarget);
    if(!verifiedAddress){
      toast("Sélectionne une adresse vérifiée pour le magasin.");
      $("#storeAddress").focus();return;
    }
    if(!photoData){toast("Ajoute une photo du produit en rayon.");return;}
    const api=window.pokestockApi;
    if(!api?.ready){toast("Initialisation de la connexion en cours. Réessaie.");return;}
    if(!api.getUser()){
      toast("Connecte-toi pour publier un signalement communautaire.");
      api.openLogin();return;
    }
    let token;
    try{token=await api.getToken();}
    catch(error){
      toast(error.message||"Impossible de valider la session.");
      return;
    }
    if(!token){
      toast("La session a expiré. Reconnecte-toi puis réessaie.");
      api.openLogin();return;
    }
    const payload={
      store:String(data.get("store")||"").trim().slice(0,140),
      city:String(data.get("city")||"").trim().slice(0,120),
      address:verifiedAddress.label,
      series:String(data.get("series")||""),
      product:String(data.get("product")||"").trim().slice(0,200),
      price:data.get("price")?Number(data.get("price")):null,
      qty:Number(data.get("quantity"))||1,
      lat:verifiedAddress.lat,lng:verifiedAddress.lng,photo:photoData
    };
    if(!payload.store||!payload.city||!payload.product||!payload.series){
      toast("Complète tous les champs obligatoires.");return;
    }
    const submitBtn=$("#reportForm button[type=submit]");
    submitBtn.disabled=true;submitBtn.textContent="⏳ Publication...";
    try{
      const response=await fetch(API_BASE+"/reports",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},
        body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)
      });
      const result=await response.json();
      if(!response.ok)throw Error(result.error||"Erreur de publication ("+response.status+").");
      e.currentTarget.reset();photoData="";resetVerifiedAddress();
      $("#photoPreview").textContent="🖼️ Aperçu de la photo";
      closeModal();
      toast("📸 Signalement communautaire publié (non vérifié) !");
      await loadCommunityReports();
      if(mapMode==="leaflet"&&map)map.flyTo([payload.lat,payload.lng],13);
    }catch(err){toast("Impossible de publier : "+(err.message||"Erreur de connexion"));}
    finally{submitBtn.disabled=false;submitBtn.textContent="Publier le signalement";}
  });
}

initMap();
renderFilters();
bindUI();
renderAll();
loadCommunityReports();
