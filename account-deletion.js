/* Demandes privées de suppression : aucun effacement implicite. */
(function(){
 'use strict';
 const API='https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech';
 const $=id=>document.getElementById(id),modal=$('accountDeletionModal');
 if(!modal)return;
 let epoch=0,busy=false,record=null,owner=null,pendingOpen=location.hash==='#supprimer-compte',loaded=false;
 const user=()=>window.pokestockApi?.getUser();
 const message=text=>$('accountDeletionStatus').textContent=text;
 function controls(){
  const canRequest=loaded&&!busy&&(!record||record.status==='cancelled');
  $('accountDeletionForm').hidden=!loaded||!!record&&record.status!=='cancelled';
  $('accountDeletionWord').disabled=!canRequest;$('accountDeletionConfirm').disabled=!canRequest;
  $('accountDeletionSend').disabled=!canRequest;
  $('accountDeletionCancel').hidden=record?.status!=='requested';$('accountDeletionCancel').disabled=busy;
  $('accountDeletionRefresh').disabled=busy;
 }
 function reset(){
  epoch++;busy=false;record=null;loaded=false;
  $('accountDeletionWord').value='';$('accountDeletionConfirm').checked=false;
  $('accountDeletionOwner').textContent='';$('accountDeletionState').textContent='';message('');controls();
 }
 function close(){
  epoch++;busy=false;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
  $('accountDeletionWord').value='';$('accountDeletionConfirm').checked=false;
  document.body.style.overflow=document.querySelector('.modal.open')?'hidden':'';
  $('accountDeletionBtn').focus();
 }
 async function api(method='GET',body){
  const id=user()?.id;if(!id)throw Object.assign(Error('Connectez-vous pour gérer votre demande.'),{auth:true});
  const token=await window.pokestockApi.getToken();
  if(!token||user()?.id!==id)throw Object.assign(Error('La session a changé. Reconnectez-vous.'),{auth:true});
  const response=await fetch(API+'/me/account-deletion',{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(16000)});
  const data=await response.json();
  if(!response.ok)throw Object.assign(Error(data.error||'Impossible de gérer la demande.'),{auth:response.status===401});
  return data;
 }
 function render(){
  $('accountDeletionOwner').textContent='Compte concerné : '+(user()?.email||user()?.name||'votre compte');
  const date=record?.requestedAt?new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(record.requestedAt)):'';
  $('accountDeletionState').textContent=!record?'Aucune demande en cours.':record.status==='requested'?'Demande enregistrée le '+date+'. Vous pouvez encore l’annuler.':record.status==='processing'?'Demande prise en charge par l’administrateur. L’effacement définitif reste à effectuer.':'Votre précédente demande a été annulée.';
  controls();
 }
 async function load(){
  const serial=++epoch;busy=true;loaded=false;controls();message('Chargement de votre demande…');
  try{const data=await api();if(serial!==epoch)return;record=data.request;loaded=true;render();message('');}
  catch(error){if(serial!==epoch)return;if(error.auth){reset();}message(error.message||'Service indisponible. Réessayez.');}
  finally{if(serial===epoch){busy=false;controls();}}
 }
 function open(){
  if(!user()){pendingOpen=true;window.pokestockApi?.openLogin();return;}
  pendingOpen=false;reset();
  $('authModal').classList.remove('open');$('authModal').setAttribute('aria-hidden','true');
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  modal.querySelector('.modal-close').focus();load();
 }
 async function mutate(method,body){
  if(busy||!loaded)return;
  const serial=++epoch;busy=true;controls();message('Enregistrement…');
  try{const data=await api(method,body);if(serial!==epoch)return;record=data.request;loaded=true;$('accountDeletionWord').value='';$('accountDeletionConfirm').checked=false;render();message(method==='POST'?'Votre demande a été enregistrée. Le compte reste actif jusqu’au traitement manuel.':'Votre demande a été annulée.');}
  catch(error){if(serial!==epoch)return;if(error.auth)reset();message(error.message||'Service indisponible.');}
  finally{if(serial===epoch){busy=false;controls();}}
 }
 $('accountDeletionBtn').addEventListener('click',open);
 modal.querySelectorAll('[data-close-account-deletion]').forEach(button=>button.addEventListener('click',close));
 $('accountDeletionForm').addEventListener('submit',event=>{event.preventDefault();if($('accountDeletionWord').value!=='SUPPRIMER'||!$('accountDeletionConfirm').checked){message('Saisissez SUPPRIMER et confirmez votre demande.');return;}mutate('POST',{confirmation:'SUPPRIMER'});});
 $('accountDeletionCancel').addEventListener('click',()=>mutate('PATCH',{action:'cancel'}));
 $('accountDeletionRefresh').addEventListener('click',()=>{if(!busy)load();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open'))close();});
 function sync(){
  const id=user()?.id||null;$('accountDeletionBtn').hidden=!id;
  if(owner!==id){reset();owner=id;if(!id&&modal.classList.contains('open'))close();}
  if(pendingOpen)open();
 }
 document.addEventListener('pokestock:authchanged',sync);
 window.addEventListener('hashchange',()=>{if(location.hash==='#supprimer-compte'){pendingOpen=true;open();}});
 document.addEventListener('DOMContentLoaded',sync);sync();
})();
