// Client d'authentification sans étape de compilation, chargé comme module natif.
const AUTH_URL="https://ep-dark-bread-b9bd8cco.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth";
const $=selector=>document.querySelector(selector);
let client=null,currentUser=null,signup=false,loading=false;
const api={
  async getToken(){
    if(!client)throw new Error("Le service de connexion n'est pas encore prêt.");
    // Le SDK peut renvoyer sa session mise en cache au lieu du JWT réel.
    // On demande le JWT au point d'accès officiel de Neon Auth.
    let response;
    try{
      response=await fetch(AUTH_URL+"/token",{
        method:"GET",
        credentials:"include",
        headers:{"Accept":"application/json"},
        cache:"no-store",
        signal:AbortSignal.timeout(15000)
      });
    }catch{
      throw new Error("Impossible de vérifier ta session. Vérifie la connexion Internet.");
    }
    if(response.status===401||response.status===403){
      currentUser=null;
      renderAuth();
      return null;
    }
    if(!response.ok){
      throw new Error("Service d'authentification temporairement indisponible ("+response.status+").");
    }
    let data;
    try{data=await response.json();}catch{throw new Error("Réponse d'authentification invalide.");}
    const token=typeof data?.token==="string"?data.token:data?.data?.token;
    if(typeof token!=="string"||token.split(".").length!==3){
      throw new Error("La session est active, mais son jeton d'accès est indisponible. Réessaie ou reconnecte-toi.");
    }
    return token;
  },
  getUser(){return currentUser;},
  openLogin(){
    $("#authModal").classList.add("open");
    $("#authModal").setAttribute("aria-hidden","false");
    $("#authEmail").focus();
  },
  async signInGoogle(){
    if(!client||loading)return;
    loading=true;renderAuth();status("Ouverture de Google…");
    try{
      const result=await client.signIn.social({provider:"google",callbackURL:new URL("index.html",location.href).href});
      if(result?.error)throw Error(result.error.message||"Connexion Google refusée.");
      if(window.pokestockNative){status("Terminez la connexion dans le navigateur, puis revenez dans PokéStock.");}
      else{await refreshSession();if(currentUser)closeAuth();}
    }catch{status("La connexion Google n’a pas abouti. Réessayez ou utilisez votre adresse e-mail.");}
    finally{loading=false;renderAuth();}
  },
  ready:false
};
window.pokestockApi=api;
const googleButton=document.createElement("button");googleButton.id="googleSignIn";googleButton.type="button";googleButton.className="btn google-sign-in";googleButton.textContent="Continuer avec Google";googleButton.disabled=true;
$("#authTitle").after(googleButton);
googleButton.addEventListener("click",()=>api.signInGoogle());
document.addEventListener("pokestock:googlecompleted",async()=>{await refreshSession();if(currentUser)closeAuth();});
function status(text){$("#authStatus").textContent=text;}
function renderAuth(){
  const user=currentUser;
  googleButton.hidden=!!user;googleButton.disabled=loading||!client;
  $("#accountBtn").textContent=user?(user.name||"Mon compte"):"Connexion";
  $("#authTitle").textContent=user?"Mon compte":signup?"Créer un compte":"Se connecter";
  $("#authNameWrap").hidden=!signup||!!user;
  $("#authEmail").disabled=!!user;
  $("#authPassword").disabled=!!user;
  $("#authEmail").closest("label").hidden=!!user;
  $("#authPassword").closest("label").hidden=!!user;
  $("#authSubmit").hidden=!!user;
  $("#signOutBtn").hidden=!user;
  $("#myReportsBtn").hidden=!user;
  $("#watchOpenBtn").hidden=!user;
  $("#accountDeletionBtn").hidden=!user;
  $("#toggleAuthMode").hidden=!!user;
  if(!user){
    $("#authSubmit").textContent=signup?"Créer mon compte":"Se connecter";
    $("#toggleAuthMode").textContent=signup?"J'ai déjà un compte":"Créer un compte";
  }else{
    status("✅ Connecté en tant que "+(user.email||user.name||"utilisateur")+". Tu peux maintenant signaler un produit.");
  }
}
async function refreshSession(){
  if(!client)return;
  try{
    const response=await client.getSession();
    currentUser=response?.data?.user||null;
  }catch{currentUser=null;}
  renderAuth();
  document.dispatchEvent(new Event("pokestock:authchanged"));
}
function closeAuth(){
  $("#authModal").classList.remove("open");
  $("#authModal").setAttribute("aria-hidden","true");
}
$("#accountBtn").addEventListener("click",()=>{renderAuth();api.openLogin();});
document.querySelectorAll("[data-close-auth]").forEach(b=>b.addEventListener("click",closeAuth));
$("#toggleAuthMode").addEventListener("click",()=>{
  signup=!signup;status("");renderAuth();
  $("#authPassword").autocomplete=signup?"new-password":"current-password";
});
$("#authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!client||loading){status("Connexion en cours d'initialisation. Réessaie.");return;}
  const email=$("#authEmail").value.trim(),password=$("#authPassword").value;
  const name=$("#authName").value.trim();
  if(signup&&name.length<2){status("Entre un pseudo d'au moins deux caractères.");return;}
  loading=true;$("#authSubmit").disabled=true;status("⏳ Vérification du compte...");
  try{
    const result=signup
      ?await client.signUp.email({email,password,name})
      :await client.signIn.email({email,password});
    if(result?.error)throw new Error(result.error.message||"Identifiants non acceptés.");
    await refreshSession();
    if(currentUser){status("✅ Connecté ! Tu peux publier un signalement.");setTimeout(closeAuth,700);}
    else status("Compte créé. Vérifie tes e-mails si une confirmation est demandée, puis connecte-toi.");
  }catch(err){status("⚠️ "+(err?.message||"Impossible de se connecter."));}
  finally{loading=false;$("#authSubmit").disabled=false;}
});
$("#signOutBtn").addEventListener("click",async()=>{
  try{await client?.signOut();currentUser=null;signup=false;renderAuth();status("Déconnecté.");document.dispatchEvent(new Event("pokestock:authchanged"));}
  catch(err){status("Erreur de déconnexion : "+err.message);}
});
(async()=>{
  try{
    const {createAuthClient}=await import("https://esm.sh/@neondatabase/auth?bundle");
    client=createAuthClient(AUTH_URL);
    api.ready=true;
    await refreshSession();
    if(window.location.hash==="#connexion"&&!currentUser)api.openLogin();
  }catch(error){
    console.error("Neon Auth indisponible",error);
    $("#accountBtn").textContent="⚠️ Connexion indisponible";
    status("Le service de connexion ne répond pas. Vérifie la connexion réseau.");
  }
})();
