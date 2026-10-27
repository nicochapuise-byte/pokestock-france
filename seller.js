/* Public seller page: active observations only, never identities or private proof photos. */
(function(){
  'use strict';
  const API='https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech';
  const el=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
  let offset=0,busy=false,loaded=0;
  const fmt=n=>new Intl.NumberFormat('fr-FR').format(Number(n)||0);
  function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
  function dateText(value){const d=new Date(value);return Number.isNaN(d.getTime())?'Date non précisée':new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(d);}
  function age(value){const d=new Date(value),hours=(Date.now()-d.getTime())/3600000;return !Number.isFinite(hours)?'Date non précisée':hours<1?'À l’instant':hours<24?'Il y a '+Math.floor(hours)+' h':'Il y a '+Math.floor(hours/24)+' j';}
  function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function imageUrl(url){try{const u=new URL(url);if(u.protocol==='https:'&&u.hostname.endsWith('.neon.tech'))return u.href;}catch{}return url==='catalog-upc151-chat.svg'?url:'catalog-placeholder.svg';}
  function renderSeller(seller){
    const privateSeller=seller.type==='private';
    document.title=(privateSeller?'Particulier':seller.name)+' — PokéStock France';
    el('sellerName').textContent=seller.name||'Vendeur';
    el('sellerBadge').textContent=privateSeller?'Particulier · statut déclaré':'Professionnel · statut déclaré';el('sellerBadge').classList.toggle('is-private',privateSeller);
    el('sellerLocation').textContent=(seller.cities||[]).join(' · ');
    el('sellerPrivateNote').hidden=!privateSeller;
    el('sellerAddress').hidden=privateSeller||!seller.address;el('sellerAddress').textContent=privateSeller?'':seller.address||'';
    const website=safeUrl(seller.websiteUrl);el('sellerWebsite').hidden=!website;
    if(website){el('sellerWebsite').href=website;el('sellerWebsite').textContent=privateSeller?'Site web ou page de vente ↗':'Visiter le site de la boutique ↗';}else el('sellerWebsite').removeAttribute('href');
    el('sellerProductCount').textContent=fmt(seller.productCount);el('sellerReportCount').textContent=fmt(seller.reportCount);
    el('sellerUpdated').textContent='Dernier signalement : '+dateText(seller.updatedAt);
  }
  function renderProduct(report){
    const card=node('article','seller-product-card'),media=node('div','seller-product-media');
    const state=report.votes?.state||'unverified',badge=node('span','seller-product-state '+state,state==='confirmed'?'Disponibilité confirmée':state==='out_of_stock'?(report.ownerStockState==='unavailable'?'Rupture indiquée par l’auteur':'Rupture signalée'):'À confirmer');
    if(state==='out_of_stock')badge.className='seller-product-state out-of-stock';
    const img=node('img');img.src=imageUrl(report.img);img.alt=report.img?'Visuel du produit '+report.product:'Illustration indicative du catalogue';img.loading='lazy';img.width=180;img.height=180;img.addEventListener('error',()=>{img.src='catalog-placeholder.svg';img.alt='Illustration indicative du catalogue';},{once:true});media.append(badge,img);
    const body=node('div','seller-product-body');body.append(node('h3','',report.product||'Produit Pokémon'));if(report.artSet)body.append(node('p','seller-product-art',report.artSet));body.append(node('p','',report.city||''));body.append(node('p','',fmt(report.qty||1)+' unité(s) observée(s)'));
    if(report.votes)body.append(node('p','',fmt(report.votes.available)+' confirmation(s) · '+fmt(report.votes.unavailable)+' rupture(s)'));
    if(!report.img)body.append(node('p','seller-product-image-note','Illustration indicative · photo exacte indisponible'));
    const bottom=node('div','seller-product-bottom');const time=node('time','',age(report.lastSeenAt||report.createdAt));if(report.lastSeenAt||report.createdAt)time.dateTime=report.lastSeenAt||report.createdAt;time.title=dateText(report.lastSeenAt||report.createdAt);const price=report.price!==null&&report.price!==undefined&&Number.isFinite(Number(report.price))?new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(report.price)):'Prix non précisé';bottom.append(time,node('strong','',price));body.append(bottom);card.append(media,body);return card;
  }
  async function load(reset=false){
    if(busy)return;busy=true;el('sellerMore').disabled=true;el('sellerRetry').disabled=true;
    if(reset){offset=0;loaded=0;el('sellerError').hidden=true;el('sellerContent').hidden=true;el('sellerLoading').hidden=false;el('sellerProducts').replaceChildren();}
    try{
      if(!id||!/^[a-f0-9]{64}$/.test(id))throw Error('Ce lien de fiche vendeur est incomplet ou invalide. Ouvrez une fiche depuis un signalement sur la carte.');
      const res=await fetch(API+'/sellers/'+id+'?limit=24&offset='+offset,{cache:'no-store',signal:AbortSignal.timeout(16000)});
      if(res.status===404)throw Error('Ce vendeur n’a plus de signalement en cours de validité. Retrouvez les disponibilités actuelles sur la carte.');
      if(!res.ok)throw Error('La fiche ne se charge pas pour le moment. Réessayez dans quelques instants.');
      const data=await res.json();if(!data.seller||!Array.isArray(data.reports))throw Error('Réponse du service incorrecte.');
      renderSeller(data.seller);for(const report of data.reports)el('sellerProducts').append(renderProduct(report));
      loaded+=data.reports.length;offset=data.nextOffset;el('sellerMore').hidden=!data.hasMore;el('sellerPageStatus').textContent=fmt(loaded)+' / '+fmt(data.seller.productCount)+' produit(s) affiché(s)';
      el('sellerLoading').hidden=true;el('sellerError').hidden=true;el('sellerContent').hidden=false;
    }catch(error){
      if(!loaded){el('sellerLoading').hidden=true;el('sellerContent').hidden=true;el('sellerError').hidden=false;el('sellerErrorText').textContent=error.message;}
      else el('sellerPageStatus').textContent=error.message+' Vous pouvez réessayer avec le bouton ci-dessous.';
    }finally{busy=false;el('sellerMore').disabled=false;el('sellerRetry').disabled=false;}
  }
  el('sellerMore').addEventListener('click',()=>load());el('sellerRetry').addEventListener('click',()=>load(true));load(true);
})();
