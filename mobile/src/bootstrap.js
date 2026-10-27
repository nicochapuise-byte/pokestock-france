import { initializeNative } from './native.js';
try {
  await initializeNative();
  const scripts=JSON.parse(document.getElementById('mobile-scripts').textContent);
  for(const spec of scripts){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=spec.src;
      if(spec.type)script.type=spec.type;
      script.onload=resolve;script.onerror=()=>reject(Error('Chargement impossible : '+spec.src));
      document.body.append(script);
    });
  }
}catch{
  const message=document.createElement('p');message.className='native-network-status';message.setAttribute('role','alert');
  message.textContent='L’application n’a pas pu démarrer. Vérifiez votre connexion puis relancez PokéStock.';
  document.body.prepend(message);
}
