// Fixed destinations only. The native plugin exchanges the verifier against its
// device-held challenge; no session token is copied into web storage.
(()=>{
 const current=new URL(location.href),verifier=current.searchParams.get('neon_auth_session_verifier');
 history.replaceState(null,'',current.pathname);
 const target=document.getElementById('returnToApp'),status=document.getElementById('callbackStatus');
 if(!verifier||verifier.length>4096||/[\s\x00-\x1f]/.test(verifier)){status.textContent='La connexion a été interrompue. Revenez dans PokéStock pour réessayer.';return;}
 const scheme=current.pathname.endsWith('/android-auth-dev.html')?'fr.pokestock.app.dev':'fr.pokestock.app';
 target.href=scheme+'://auth/callback?'+new URLSearchParams({neon_auth_session_verifier:verifier});
 target.hidden=false;status.textContent='Touchez le lien pour terminer votre connexion dans PokéStock.';
})();
