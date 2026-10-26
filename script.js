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
  try { return JSON.parse(localStorage.getItem("pokestockReports") || "[]"); }
  catch(e){ console.warn("Stockage local indisponible", e); return []; }
}
function writeLocalReports(items){
  try { localStorage.setItem("pokestockReports", JSON.stringify(items)); return true; }
  catch(e){ console.warn("Stockage local indisponible", e); return false; }
}

let reports = [...seedReports, ...readLocalReports()];
let selectedSeries = new Set();
let photoData = "";
let map;
let markerLayer;
let mapMode = "fallback";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const seriesById = id => series.find(s=>s.id===id) || {name:"Autre",color:"#64748b"};

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
        .bindPopup(`<div class="popup-card"><b>${r.product}</b><span>${r.store} • ${r.city}</span><br><span>${ageText(r.hours||0)} • ${r.price?Number(r.price).toFixed(2)+" €":"Prix non indiqué"}</span></div>`)
        .addTo(markerLayer);
    });
  }else{
    const holder=document.getElementById("fallbackPins");
    if(holder){
      holder.innerHTML=items.map(r=>{
        const s=seriesById(r.series),p=projectToFallback(r.lat,r.lng);
        return `<button class="fallback-pin" style="left:${p[0]}%;top:${p[1]}%;background:${s.color}" title="${r.product} — ${r.store}, ${r.city}" aria-label="${r.product}, ${r.store}, ${r.city}"></button>`;
      }).join("");
    }
  }
  $("#visibleCount").textContent=items.length;
}

function renderCards(items){
  const grid=$("#stockGrid");
  grid.innerHTML=items.map(r=>{
    const s=seriesById(r.series), age=ageClass(r.hours||0);
    return `<article class="stock-card">
      <div class="stock-image">
        <span class="age-badge ${age}">${ageText(r.hours||0)}</span>
        <img src="${r.img||"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"}" alt="">
      </div>
      <div class="stock-body">
        <span class="stock-series" style="color:${s.color}">${s.name}</span>
        <h3>${r.product}</h3>
        <p class="stock-place">📍 ${r.store} • ${r.city}</p>
        <div class="stock-meta"><span>Stock aperçu : <b>${r.qty||1}</b></span><b>${r.price?Number(r.price).toFixed(2)+" €":"—"}</b></div>
      </div>
    </article>`;
  }).join("");
  $("#emptyState").hidden=items.length>0;
}

function updateStats(){
  $("#reportCount").textContent=reports.length;
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
      $("#reportLat").value=p[0];$("#reportLng").value=p[1];
      toast("Position trouvée !");
    },()=>toast("Autorise la localisation, ou ouvre le site via HTTPS/localhost pour cette fonction."));
  });

  $("#photoInput").addEventListener("change",e=>{
    const file=e.target.files[0];
    if(!file){photoData="";$("#photoPreview").innerHTML="<span>🖼️ Aperçu de la photo</span>";return}
    const reader=new FileReader();
    reader.onload=()=>{photoData=reader.result;$("#photoPreview").innerHTML='<img src="'+photoData+'" alt="Aperçu">'};
    reader.readAsDataURL(file);
  });

  $("#reportForm").addEventListener("submit",e=>{
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    let lat=Number(data.get("lat")),lng=Number(data.get("lng"));
    if(!lat||!lng){[lat,lng]=approximateCoordinates(data.get("city"))}
    const report={
      id:"local-"+Date.now(),store:data.get("store").trim(),city:data.get("city").trim(),
      series:data.get("series"),product:data.get("product").trim(),price:Number(data.get("price"))||null,
      qty:Number(data.get("quantity"))||1,lat,lng,hours:0,
      img:photoData||"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"
    };
    const local=readLocalReports();
    local.unshift(report);
    writeLocalReports(local);
    reports.unshift(report);
    e.currentTarget.reset();photoData="";$("#photoPreview").innerHTML="<span>🖼️ Aperçu de la photo</span>";
    closeModal();renderAll();
    if(mapMode==="leaflet" && map) map.flyTo([lat,lng],11);
    toast("Signalement ajouté à ta démo !");
  });
}

initMap();
renderFilters();
bindUI();
renderAll();
