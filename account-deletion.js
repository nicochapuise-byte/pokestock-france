/* Demandes privées de suppression : aucun effacement implicite. */
(function(){
 'use strict';
 const API='https://br-nameless-math-b9dyokxp-pokestock.compute.c-7.eu-central-1.aws.neon.tech';
 const $=id=>document.getElementById(id),modal=$('accountDeletionModal');
 if(!modal)return;
 let epoch=0,busy=false,record=null,owner=null,pendingOpen=location.hash==='#supprimer-compte',loaded=false;
 let automatic=false,erasing=false,receipt=null;
 const receiptKey='pokestock-erasure-receipt';
 const reauthKey='pokestock-deletion-reauth-owner';
 try{const saved=JSON.parse(localStorage.getItem(receiptKey));if(saved&&/^[a-f0-9-]{36}$/.test(saved.requestId)&&/^[a-f0-9]{64}$/.test(saved.receiptToken)&&typeof saved.accountId==='string')receipt=saved;}catch{}
 async function erasureApi(path,method='GET',body,token,sessionProof){
  const response=await fetch(API+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(sessionProof?{'X-Pokestock-Session':sessionProof}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(25000)});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Le traitement doit être vérifié ou repris.'),{code:data.code});return data;
 }
 async function finishErasure(){
  const deletedOwner=receipt.accountId;pendingOpen=false;
  // A completed receipt can retry an interrupted final unlock, without identity.
  await erasureApi('/account-erasure/'+receipt.requestId+'/execute','POST',{confirmation:'SUPPRIMER'},receipt.receiptToken);
  localStorage.removeItem(receiptKey);receipt=null;
  if(!user()||user().id===deletedOwner)await window.pokestockApi?.clearDeletedSession();
  erasing=false;busy=false;loaded=false;record=null;controls();
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  $('accountDeletionOwner').textContent='';$('accountDeletionState').textContent='Compte supprimé';
  message('L’identité, les données associées et les fichiers actifs ont été effacés. La conservation des sauvegardes suit la politique du service.');
  modal.querySelector('.modal-close').focus();
  $('accountDeletionRefresh').hidden=true;$('accountDeletionForm').hidden=true;$('accountDeletionCancel').hidden=true;
 }
 async function resumeErasure(){
  if(!receipt||erasing)return;
  if(user()&&user().id!==receipt.accountId){message('Un reçu d’un autre compte est conservé sur cet appareil. Reconnectez le compte concerné ou contactez l’assistance.');return;}
  erasing=true;busy=true;controls();message('Vérification de l’effacement…');
  try{
   const result=await erasureApi('/account-erasure/'+receipt.requestId+'/status','GET',null,receipt.receiptToken);
   if(result.state==='completed'){await finishErasure();return;}
   if(result.state==='running'){message('Effacement en cours. Actualisez pour vérifier sa fin.');return;}
   const completed=await erasureApi('/account-erasure/'+receipt.requestId+'/execute','POST',{confirmation:'SUPPRIMER'},receipt.receiptToken);
   if(completed.state==='completed'){await finishErasure();return;}
   message('Le traitement nécessite une vérification. Le reçu est conservé pour permettre sa reprise.');
  }catch{message('La fin de l’effacement n’est pas encore confirmée. Actualisez son état avant de réessayer.');}
  finally{erasing=false;busy=false;controls();}
 }
 async function erase(){
  if(busy||!loaded)return;
  const accountId=user()?.id;if(!accountId)return;
  busy=true;controls();message('Préparation de l’effacement…');
  try{
   const token=await window.pokestockApi.getToken();if(!token||user()?.id!==accountId)throw Error('Session modifiée.');
   const proof=await window.pokestockApi.getDeletionSessionProof();
   if(user()?.id!==accountId)throw Error('Session modifiée.');
   const prepared=await erasureApi('/me/account-erasure/prepare','POST',{confirmation:'SUPPRIMER'},token,proof);
   receipt={requestId:prepared.requestId,receiptToken:prepared.receiptToken,accountId};
   localStorage.setItem(receiptKey,JSON.stringify(receipt));
   busy=false;await resumeErasure();
  }catch(error){
   busy=false;controls();
   if(error.code==='REAUTH_REQUIRED'){
    try{
     sessionStorage.setItem(reauthKey,accountId);pendingOpen=false;close();
     await window.pokestockApi.reauthenticateForDeletion();
    }catch{sessionStorage.removeItem(reauthKey);message('La reconnexion n’a pas pu être démarrée. Déconnectez-vous, puis reconnectez-vous avant de réessayer.');}
   }else message('L’effacement n’a pas pu être démarré. Actualisez votre demande ou contactez l’assistance.');
  }
 }
 erasureApi('/account-erasure/capabilities').then(data=>{
  automatic=data.enabled===true;
  if(automatic){modal.querySelector('.deletion-notice').textContent='Une reconnexion peut être demandée si votre session a plus de cinq minutes. La suppression efface votre identité de connexion, vos signalements, favoris, contributions et fichiers actifs. Elle est définitive. Un compte administrateur nécessite une prise en charge distincte.';$('accountDeletionTitle').textContent='Supprimer mon compte';$('accountDeletionSend').textContent='Supprimer définitivement mon compte';modal.querySelector('.deletion-check span').textContent='Je confirme la suppression définitive de mon compte et de ses données associées.';}
  controls();
 }).catch(()=>{});
 const user=()=>window.pokestockApi?.getUser();
 const message=text=>$('accountDeletionStatus').textContent=text;
 function controls(){
  const canRequest=loaded&&!busy&&(automatic||!record||record.status==='cancelled');
  $('accountDeletionForm').hidden=!loaded||!automatic&&!!record&&record.status!=='cancelled';
  $('accountDeletionWord').disabled=!canRequest;$('accountDeletionConfirm').disabled=!canRequest;
  $('accountDeletionSend').disabled=!canRequest;
  $('accountDeletionCancel').hidden=record?.status!=='requested';$('accountDeletionCancel').disabled=busy;
  $('accountDeletionRefresh').disabled=busy;
  if(receipt){$('accountDeletionForm').hidden=true;$('accountDeletionCancel').hidden=true;}
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
  $('accountDeletionRefresh').hidden=false;
  if(receipt){pendingOpen=false;modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';resumeErasure();return;}
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
 $('accountDeletionForm').addEventListener('submit',event=>{event.preventDefault();if($('accountDeletionWord').value!=='SUPPRIMER'||!$('accountDeletionConfirm').checked){message('Saisissez SUPPRIMER et confirmez votre demande.');return;}if(automatic)erase();else mutate('POST',{confirmation:'SUPPRIMER'});});
 $('accountDeletionCancel').addEventListener('click',()=>mutate('PATCH',{action:'cancel'}));
 $('accountDeletionRefresh').addEventListener('click',()=>{if(!busy){if(receipt)resumeErasure();else load();}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modal.classList.contains('open'))close();});
 function sync(){
  const id=user()?.id||null;$('accountDeletionBtn').hidden=!id;
  if(owner!==id){if(!erasing)reset();owner=id;if(!id&&!receipt&&modal.classList.contains('open'))close();}
  let expected=null;try{expected=sessionStorage.getItem(reauthKey);}catch{}
  if(id&&expected){
   sessionStorage.removeItem(reauthKey);
   if(id===expected){pendingOpen=true;}
   else{pendingOpen=false;$('authStatus').textContent='Le compte connecté est différent. Aucune suppression n’a été lancée.';}
  }
  if(pendingOpen)open();
 }
 document.addEventListener('pokestock:authchanged',sync);
 window.addEventListener('hashchange',()=>{if(location.hash==='#supprimer-compte'){pendingOpen=true;open();}});
 document.addEventListener('DOMContentLoaded',sync);sync();
 if(receipt){pendingOpen=true;open();}
})();
