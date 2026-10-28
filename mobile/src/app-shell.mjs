// App navigation delegates to existing authenticated flows, never duplicates writes.
export function installAppShell(doc=document,win=window){
 if(!doc.getElementById('carte')||doc.querySelector('.app-tabbar'))return;
 const paths={home:'m3 10 9-7 9 7v11h-6v-7H9v7H3V10',map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6m6-3v15m6-12v15',list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',report:'M12 5v14M5 12h14',favorites:'m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.6l-5.7 3 1.1-6.4-4.6-4.5 6.4-.9L12 3',account:'M20 21v-2a7 7 0 0 0-14 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'};
 const nav=doc.createElement('nav');nav.className='app-tabbar';nav.setAttribute('aria-label','Navigation de l’application');
 for(const [key,label] of [['home','Accueil'],['map','Carte'],['report','Signaler'],['favorites','Favoris'],['account','Compte']]){
  const button=doc.createElement('button');button.type='button';button.dataset.appTab=key;
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[key]+'"/></svg><span>'+label+'</span>';
  button.addEventListener('click',()=>{
   if(key==='home')doc.querySelector('.navlinks [data-page-link=home]')?.click();
   else if(key==='map'||key==='list')doc.querySelector('.navlinks [data-view="'+key+'"]').click();
   else doc.getElementById({report:'openReportTop',favorites:'watchOpenBtn',account:'accountBtn'}[key])?.click();
  });nav.append(button);
 }
 doc.body.append(nav);doc.documentElement.classList.add('app-shell');
 const update=()=>{
  const modal=[...doc.querySelectorAll('.modal.open')].at(-1);
  const key=modal?({watchModal:'favorites',authModal:'account',reportModal:'report'}[modal.id]||null):({home:'home',map:'map',list:'map'}[doc.body.dataset.page]||null);
  nav.querySelectorAll('button').forEach(button=>{const active=button.dataset.appTab===key;button.classList.toggle('selected',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
  // Modals own focus and their bottom action area; background navigation is inert.
  nav.hidden=!!modal;
 };
 const observer=new win.MutationObserver(records=>{if(records.some(r=>r.target===doc.body||r.target.matches('.modal')))update();});observer.observe(doc.body,{subtree:true,attributes:true,attributeFilter:['class','data-page']});update();
 const hero=doc.querySelector('.hero');
 if(hero){
  hero.classList.add('app-welcome');
  hero.innerHTML='<p class="eyebrow">BIENVENUE SUR POKÉSTOCK</p><h1>Votre prochaine trouvaille<br><em>commence ici.</em></h1><p>Repérez les produits Pokémon disponibles et partagez vos découvertes avec les collectionneurs.</p><img class="app-welcome-product" src="assets/anniversaire-etb.svg" alt="Coffret Pokémon du catalogue"><div class="app-welcome-actions"><button type="button" class="btn google-sign-in" id="welcomeGoogle">Continuer avec Google</button><button type="button" class="btn btn-white" id="welcomeEmail">Se connecter avec une adresse e-mail</button><button type="button" class="btn btn-red" id="welcomeExplore">Explorer la carte</button></div><p class="app-welcome-note">La carte est accessible sans compte.</p>';
  doc.getElementById('welcomeGoogle').onclick=()=>{doc.getElementById('accountBtn').click();doc.getElementById('googleSignIn')?.click();};
  doc.getElementById('welcomeEmail').onclick=()=>doc.getElementById('accountBtn').click();
  doc.getElementById('welcomeExplore').onclick=()=>doc.querySelector('.navlinks [data-view=map]').click();
  const renderWelcome=()=>{const user=win.pokestockApi?.getUser();doc.getElementById('welcomeGoogle').hidden=!!user;doc.getElementById('welcomeEmail').textContent=user?'Ouvrir mon compte':'Se connecter avec une adresse e-mail';doc.getElementById('welcomeGoogle').disabled=!win.pokestockApi?.ready;};
  doc.addEventListener('pokestock:authchanged',renderWelcome);renderWelcome();
 }

 return ()=>observer.disconnect();
}
