// Fixed destinations only. The native plugin exchanges the verifier against its
// device-held challenge; no session token is copied into web storage.
(()=>{
 const current=new URL(location.href),verifier=current.searchParams.get('neon_auth_session_verifier');
 history.replaceState(null,'',current.pathname);
 const target=document.getElementById('returnToApp'),status=document.getElementById('callbackStatus');
 const error=current.searchParams.get('error');
 const reasons={access_denied:'Connexion annulée ou refusée.',state_mismatch:'La tentative de connexion a expiré ou ne correspond plus au navigateur.',invalid_state:'La tentative de connexion a expiré.',account_not_linked:'Cette adresse est associée à une autre méthode de connexion.',unable_to_create_user:'Le service ne peut pas créer ou retrouver le compte.',unable_to_link_account:'Le service ne peut pas associer ce compte Google.'};
 const scheme=current.pathname.endsWith('/android-auth-dev.html')?'fr.pokestock.app.dev':'fr.pokestock.app';
 if(error){
  target.href=scheme+'://auth/callback';target.hidden=false;
  status.textContent=(reasons[error]||'Le service de connexion a renvoyé une erreur.')+' Revenez dans PokéStock. Code de diagnostic : PS-AUTH-02'+(Object.hasOwn(reasons,error)?' / '+error:'')+'.';return;
 }
 if(!verifier||verifier.length>4096||/[\s\x00-\x1f]/.test(verifier)){
  // Reopening the cleaned page does not prove that native sign-in failed.
  target.href=scheme+'://auth/callback';target.hidden=false;
  status.textContent='Ce lien ne contient plus de code de connexion utilisable. Ouvrez PokéStock pour vérifier votre compte. Si vous n’êtes pas connecté, relancez la connexion depuis l’application. Code de diagnostic : '+(verifier?'PS-AUTH-03':'PS-AUTH-01')+'.';return;
 }
 target.href=scheme+'://auth/callback?'+new URLSearchParams({neon_auth_session_verifier:verifier});
 target.hidden=false;
 status.textContent='Ouverture de PokéStock… Si l’application ne s’ouvre pas, touchez le bouton ci-dessous pour terminer votre connexion.';
 // Best effort only: browsers may require the explicit link gesture. Keep
 // the link visible and never loop, reload, or claim the verifier was exchanged.
 try{location.replace(target.href);}catch{}
})();
