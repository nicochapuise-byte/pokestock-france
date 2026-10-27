import { Camera,MediaTypeSelection,EncodingType } from '@capacitor/camera';
import {createProofPicker,nativePhotoFile} from './proof-photo.mjs';
let restoredPhoto=null,restoreView=null;
export function receiveCameraRestore(event){
  if(event.pluginId!=='Camera'||!event.success||!['takePhoto','chooseFromGallery','getPhoto'].includes(event.methodName))return;
  const photo=event.data?.results?.[0]||event.data;
  if(!photo?.webPath)return;
  restoredPhoto=photo;if(restoreView)restoreView();
}
export function installProofCamera(fetchFile,cameraApi=Camera){
  const input=document.getElementById('photoInput');
  if(!input||!window.pokestockNative?.prepareProofPhoto)return;
  const label=input.closest('label'),form=input.form,publish=document.getElementById('publishReport');
  const tools=document.createElement('div');tools.className='native-proof-tools wide';
  const title=document.createElement('strong');title.textContent='Ajouter une photo de preuve';
  const actions=document.createElement('div');actions.className='native-proof-actions';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const camera=document.createElement('button'),gallery=document.createElement('button'),remove=document.createElement('button');
  for(const button of [camera,gallery,remove]){button.type='button';button.className='btn btn-white';actions.append(button);}
  camera.textContent='Prendre une photo';gallery.textContent='Choisir une photo';remove.textContent='Retirer la photo';
  tools.append(title,actions,status);label.before(tools);
  const fallback=document.createElement('details');fallback.className='native-photo-fallback wide';
  const summary=document.createElement('summary');summary.textContent='Choisir un fichier autrement';fallback.append(summary);label.before(fallback);fallback.append(label);
  let previousPublishDisabled=false;
  const picker=createProofPicker({
    capture:()=>cameraApi.takePhoto({quality:85,targetWidth:1600,targetHeight:1600,encodingType:EncodingType.JPEG,correctOrientation:true,saveToGallery:false,includeMetadata:false}),
    pick:async()=>{const result=await cameraApi.chooseFromGallery({mediaType:MediaTypeSelection.Photo,allowMultipleSelection:false,quality:85,targetWidth:1600,targetHeight:1600,includeMetadata:false});return result.results?.[0];},
    toFile:photo=>nativePhotoFile(photo,{baseUrl:location.href,fetchFile}),
    accept:async file=>{input.value='';await window.pokestockNative.prepareProofPhoto(file);},
    clear:()=>{input.value='';window.pokestockNative.prepareProofPhoto(null);},
    setBusy:busy=>{
      if(busy)previousPublishDisabled=publish.disabled;
      for(const button of [camera,gallery,remove])button.disabled=busy;
      input.disabled=busy;
      publish.disabled=busy||previousPublishDisabled;
    },
    message:text=>status.textContent=text
  });
  const choose=source=>{if(publish.disabled)return;picker.choose(source);};
  camera.addEventListener('click',()=>choose('camera'));gallery.addEventListener('click',()=>choose('gallery'));remove.addEventListener('click',()=>{if(!publish.disabled)picker.reset();});
  input.addEventListener('change',event=>{event.stopImmediatePropagation();const file=input.files?.[0];if(file&&!publish.disabled)picker.choose('file',file);},{capture:true});
  form.addEventListener('reset',()=>{picker.reset();restoredPhoto=null;document.getElementById('nativeRecoveredPhoto')?.remove();});
  let lastUser=window.pokestockApi?.getUser()?.id||null;
  document.addEventListener('pokestock:authchanged',()=>{const user=window.pokestockApi?.getUser()?.id||null;if(lastUser&&lastUser!==user){picker.reset();restoredPhoto=null;document.getElementById('nativeRecoveredPhoto')?.remove();}lastUser=user;});
  document.addEventListener('pokestock:reportclosed',()=>{picker.reset();});
  restoreView=()=>{
    if(!restoredPhoto||document.getElementById('nativeRecoveredPhoto'))return;
    const box=document.createElement('section');box.id='nativeRecoveredPhoto';box.className='native-recovered-photo';box.setAttribute('aria-label','Photo récupérée après interruption');
    const text=document.createElement('p');text.textContent='Une photo a été récupérée après le redémarrage de l’application. Recommencez votre signalement et vérifiez-la avant de publier.';
    const use=document.createElement('button');use.type='button';use.className='btn btn-white';use.textContent='Utiliser cette photo';
    const discard=document.createElement('button');discard.type='button';discard.className='btn btn-white';discard.textContent='Ignorer';
    use.addEventListener('click',()=>{const photo=restoredPhoto;restoredPhoto=null;box.remove();document.getElementById('openReportTop').click();picker.choose('restored',photo);});
    discard.addEventListener('click',()=>{restoredPhoto=null;box.remove();});box.append(text,use,discard);document.body.prepend(box);
  };
  restoreView();status.textContent='La photo reste facultative et privée. Aucun envoi automatique.';
}
