// Fixed destinations only. The native plugin exchanges the verifier against its
// device-held challenge; no session token is copied into web storage.
(()=>{
 const current=new URL(location.href),verifier=current.searchParams.get('neon_auth_session_verifier');
 history.replaceState(null,'',current.pathname);
 const target=document.getElementById('returnToApp'),status=document.getElementById('callbackStatus');
 if(!verifier||verifier.length>4096||/[\s\x00-\x1f]/.test(verifier)){status.textContent='La connexion a été interrompue. Revenez dans PokéStock pour réessayer.';return;}
 const scheme=current.pathname.endsWith('/android-auth-dev.html')?'fr.pokestock.app.dev':'fr.pokestock.app';
 target.href=scheme+'://auth/callback?'+new URLSearchParams({neon_auth_session_verifier:verifier});
 target.hidden=false;
 status.textContent='Ouverture de PokéStock… Si l’application ne s’ouvre pas, touchez le bouton ci-dessous pour terminer votre connexion.';
 // Best effort only: browsers may require the explicit link gesture. Keep
 // the link visible and never loop, reload, or claim the verifier was exchanged.
 try{location.replace(target.href);}catch{}
})();
