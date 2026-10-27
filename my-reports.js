/* Private account tools. The API checks ownership for every read and write. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),modal=$('myReportsModal'),list=$('myReportsList');
  let filter='all',offset=0,hasMore=false,busy=false,serial=0,items=[];
  function message(text,error=false){$('myReportsStatus').textContent=text;$('myReportsStatus').classList.toggle('is-error',error);}
  function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function date(value){const d=new Date(value);return Number.isNaN(d.getTime())?'Date non précisée':new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(d);}
  function controls(){modal.querySelectorAll('[data-owner-filter],#myReportsMore,#myReportsRetry,.owner-action,.owner-details button').forEach(button=>button.disabled=busy);}
  function reset(){serial++;busy=false;items=[];offset=0;hasMore=false;list.replaceChildren();$('myReportsMore').hidden=true;$('myReportsRetry').hidden=true;$('myReportsEmpty').hidden=true;['Total','Active','Unavailable','Expired'].forEach(key=>$('ownerCount'+key).textContent='—');controls();}
  function close(){serial++;busy=false;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow=document.querySelector('.modal.open')?'hidden':'';controls();$('accountBtn').focus();}
  function sessionChanged(){reset();if(!window.pokestockApi?.getUser()){if(modal.classList.contains('open'))close();message('Connectez-vous pour consulter vos signalements.');}else if(modal.classList.contains('open'))load(true);}
  async function request(path,options={}){
    const api=window.pokestockApi;if(!api?.ready||!api.getUser())throw Error('Connectez-vous pour gérer vos signalements.');
    const token=await api.getToken();if(!token)throw Error('Votre session a expiré. Reconnectez-vous.');
    const res=await fetch(API_BASE+path,{method:options.method||'GET',headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',signal:AbortSignal.timeout(18000)});
    const data=await res.json();if(!res.ok){const error=Error(data.error||'Le service ne répond pas. Réessayez.');error.status=res.status;throw error;}return data;
  }
  function makeField(name,label,type,value){const wrap=node('label');wrap.append(node('span','',label));const input=node('input');input.name=name;input.type=type;input.value=value??'';if(name==='price'){input.min='0';input.max='10000';input.step='0.01';input.placeholder='Non renseigné';}if(name==='qty'){input.min='1';input.max='999';input.required=true;input.step='1';}if(name==='websiteUrl'){input.maxLength=2048;input.placeholder='https://exemple.fr';wrap.className='owner-wide';}wrap.append(input);return wrap;}
  function makeAction(action,text){const button=node('button','owner-action '+action,text);button.type='button';button.dataset.ownerAction=action;return button;}
  function renderCard(r){
    const card=node('article','owner-report');card.dataset.reportId=r.id;
    const head=node('div','owner-report-head'),media=node('div','owner-report-media'),img=node('img');img.src=safeImage(r.img);img.alt='Visuel du produit '+r.product;img.width=78;img.height=100;img.loading='lazy';img.addEventListener('error',()=>{img.src='catalog-placeholder.svg';},{once:true});media.append(img);
    const body=node('div','owner-report-intro');body.append(node('span','owner-type',r.sellerType==='private'?'Particulier':'Professionnel'),node('h3','',r.product||'Produit Pokémon'));if(r.artSet)body.append(node('p','owner-art',r.artSet));body.append(node('p','',r.sellerType==='private'?'Particulier · '+r.city:(r.store||'Boutique')+' · '+r.city));
    const rejected=r.status==='rejected',state=rejected?'Refusé par la modération':r.isExpired?'Expiré · absent de la carte':r.ownerStockState==='unavailable'?'Rupture indiquée par vous':'En cours · visible sur la carte';body.append(node('span','owner-state '+(rejected?'rejected':r.isExpired?'expired':r.ownerStockState==='unavailable'?'unavailable':'active'),state));head.append(media,body);card.append(head);
    const info=node('p','owner-dates','Créé le '+date(r.createdAt)+' · Dernière observation : '+date(r.lastSeenAt||r.createdAt));card.append(info);card.append(node('p','owner-expiry','Fin de validité : '+date(r.expiresAt)));
    if(r.canManage){
      const details=node('details','owner-details'),summary=node('summary','','Modifier le prix, la quantité ou le lien web');details.append(summary);const form=node('form','owner-edit-form');form.dataset.ownerEdit=r.id;form.append(makeField('price','Prix (€)','number',r.price),makeField('qty','Quantité observée','number',r.qty||1),makeField('websiteUrl','Site web ou page de vente (facultatif)','url',r.websiteUrl));const save=node('button','owner-save','Enregistrer les modifications');save.type='submit';form.append(save);details.append(form);card.append(details);
      const actions=node('div','owner-report-actions');actions.append(makeAction('confirm',r.isExpired?'Disponible à nouveau':'Toujours disponible'));if(r.ownerStockState!=='unavailable')actions.append(makeAction('unavailable','Signaler une rupture'));card.append(actions);card.append(node('p','owner-action-help','Confirmez uniquement après une nouvelle vérification du stock. Cette action renouvelle le signalement pour 72 h.'));
    }else card.append(node('p','owner-action-help','Cette décision de modération empêche la réactivation de ce signalement.'));
    const remove=makeAction('remove','Retirer mon signalement');remove.classList.add('owner-remove');card.append(remove);return card;
  }
  async function load(restart=false,successMessage=''){
    if(busy)return;const ticket=++serial;busy=true;controls();$('myReportsRetry').hidden=true;
    if(restart){offset=0;items=[];hasMore=false;$('myReportsMore').hidden=true;list.replaceChildren();$('myReportsEmpty').hidden=true;}
    message('Chargement de vos signalements…');
    try{
      const data=await request('/me/listings?filter='+encodeURIComponent(filter)+'&offset='+offset);if(ticket!==serial)return;
      if(!Array.isArray(data.reports))throw Error('La réponse du service est incorrecte.');
      items.push(...data.reports);for(const report of data.reports)list.append(renderCard(report));offset=data.nextOffset;hasMore=!!data.hasMore;
      const counts=data.counts||{};for(const [key,value] of Object.entries({Total:counts.total,Active:counts.active,Unavailable:counts.unavailable,Expired:counts.expired}))$('ownerCount'+key).textContent=new Intl.NumberFormat('fr-FR').format(Number(value)||0);
      $('myReportsEmpty').hidden=items.length>0;$('myReportsMore').hidden=!hasMore;message(successMessage||(items.length+' signalement(s) affiché(s).'));
    }catch(error){if(ticket!==serial)return;if(!window.pokestockApi?.getUser()||error.status===401){reset();}message(error.message,true);$('myReportsRetry').hidden=false;}
    finally{if(ticket===serial){busy=false;controls();}}
  }
  function open(){
    if(!window.pokestockApi?.getUser()){window.pokestockApi?.openLogin();return;}
    document.getElementById('authModal').classList.remove('open');document.getElementById('authModal').setAttribute('aria-hidden','true');modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';modal.querySelector('[data-close-my-reports]').focus();load(true);
  }
  async function mutate(id,action,fields={}){
    if(busy)return;if(action==='remove'&&!window.confirm('Retirer votre signalement ? Il ne sera plus affiché sur la carte ni dans votre liste.'))return;
    const ticket=++serial;busy=true;controls();message('Enregistrement…');
    try{
      const data=action==='remove'?await request('/reports/'+encodeURIComponent(id),{method:'DELETE'}):await request('/me/reports/'+encodeURIComponent(id),{method:'PATCH',body:{action,...fields}});
      if(ticket!==serial)return;busy=false;await load(true,data.message||'Modification enregistrée.');
      loadCommunityReports().catch(()=>{});updateModerationPermissions().catch(()=>{});
    }catch(error){if(ticket===serial){if(!window.pokestockApi?.getUser()||error.status===401)reset();message(error.message,true);}}
    finally{if(ticket===serial){busy=false;controls();}}
  }
  $('myReportsBtn').addEventListener('click',open);document.querySelectorAll('[data-close-my-reports]').forEach(button=>button.addEventListener('click',close));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open'))close();});
  modal.querySelectorAll('[data-owner-filter]').forEach(button=>button.addEventListener('click',()=>{if(busy)return;filter=button.dataset.ownerFilter;modal.querySelectorAll('[data-owner-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));load(true);}));
  list.addEventListener('submit',event=>{const form=event.target.closest('[data-owner-edit]');if(!form)return;event.preventDefault();if(!form.reportValidity())return;const fields=new FormData(form);mutate(form.dataset.ownerEdit,'details',{price:fields.get('price')===''?null:Number(fields.get('price')),qty:Number(fields.get('qty')),websiteUrl:String(fields.get('websiteUrl')||'').trim()});});
  list.addEventListener('click',event=>{const button=event.target.closest('[data-owner-action]');if(button)mutate(button.closest('[data-report-id]').dataset.reportId,button.dataset.ownerAction);});
  $('myReportsMore').addEventListener('click',()=>load());$('myReportsRetry').addEventListener('click',()=>load(true));$('ownerCreateReport').addEventListener('click',()=>{close();openModal();});document.addEventListener('pokestock:authchanged',sessionChanged);
  window.pokestockMyReports={open};
})();
