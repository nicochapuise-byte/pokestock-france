// Only the beta branch has a published account-association page.
export function installGoogleLinkEntry(environment,doc=document,win=window){
 if(environment!=='development'||doc.getElementById('googleLinkEntry'))return;
 const signOut=doc.getElementById('signOutBtn');if(!signOut)return;
 const section=doc.createElement('section');section.id='googleLinkEntry';section.hidden=true;
 const link=doc.createElement('a');link.className='btn btn-white full';
 link.href='https://nicochapuise-byte.github.io/pokestock-france/associer-google-beta.html';
 link.textContent='Associer mon compte Google';
 const help=doc.createElement('p');help.className='muted';
 help.textContent='Ouvre une page sécurisée dans le navigateur. Connectez-vous avec ce même compte PokéStock, puis autorisez Google. Si Google est déjà associé, la page vous le confirmera.';
 section.append(link,help);signOut.before(section);
 const update=()=>{section.hidden=!win.pokestockApi?.getUser();};
 doc.addEventListener('pokestock:authchanged',update);update();
 return()=>{doc.removeEventListener('pokestock:authchanged',update);section.remove();};
}
