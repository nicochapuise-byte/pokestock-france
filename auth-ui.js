// Client d'authentification sans étape de compilation, chargé comme module natif.
const AUTH_URL="https://ep-dark-bread-b9bd8cco.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth";
const $=selector=>document.querySelector(selector);
let client=null,currentUser=null,signup=false,loading=false;
const api={
  async getToken(){
    if(!client)return null;
    try{
      const result=await client.token();
      return result?.data?.token||null;
    }catch{return null;}
  },
  getUser(){return currentUser;},
  openLogin(){
    $("#authModal").classList.add("open");
    $("#authModal").setAttribute("aria-hidden","false");
    $("#authEmail").focus();
  },
  ready:false
};
window.pokestockApi=api;
function status(text){$("#authStatus").textContent=text;}
function renderAuth(){
  const user=currentUser;
  $("#accountBtn").textContent=user?"👤 "+(user.name||"Mon compte"):"👤 Connexion";
  $("#authTitle").textContent=user?"Mon compte":signup?"Créer un compte":"Se connecter";
  $("#authNameWrap").hidden=!signup||!!user;
  $("#authEmail").disabled=!!user;
  $("#authPassword").disabled=!!user;
  $("#authSubmit").hidden=!!user;
  $("#signOutBtn").hidden=!user;
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
  try{await client?.signOut();currentUser=null;signup=false;renderAuth();status("Déconnecté.");}
  catch(err){status("Erreur de déconnexion : "+err.message);}
});
(async()=>{
  try{
    const {createAuthClient}=await import("https://esm.sh/@neondatabase/auth?bundle");
    client=createAuthClient(AUTH_URL);
    api.ready=true;
    await refreshSession();
  }catch(error){
    console.error("Neon Auth indisponible",error);
    $("#accountBtn").textContent="⚠️ Connexion indisponible";
    status("Le service de connexion ne répond pas. Vérifie la connexion réseau.");
  }
})();