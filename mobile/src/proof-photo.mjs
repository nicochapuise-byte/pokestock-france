export const MAX_PROOF_BYTES=10*1024*1024;
export async function nativePhotoFile(photo,{baseUrl,fetchFile,FileType=File}) {
  if(!photo?.webPath||photo.type==='video')throw Error('Aucune photo lisible n’a été sélectionnée.');
  const url=new URL(photo.webPath),base=new URL(baseUrl);
  if(url.protocol!==base.protocol||url.host!==base.host||url.username||url.password||!/^\/_capacitor_(file|content)_\//.test(url.pathname))throw Error('La photo ne provient pas du sélecteur du téléphone.');
  const response=await fetchFile(url.href);
  if(!response.ok)throw Error('Impossible de lire la photo. Choisissez-la à nouveau.');
  const blob=await response.blob();
  if(!blob.type.startsWith('image/')||!blob.size)throw Error('Choisissez une image JPEG ou PNG lisible.');
  if(blob.size>MAX_PROOF_BYTES)throw Error('La photo dépasse 10 Mo. Choisissez une image plus petite.');
  return new FileType([blob],'preuve-photo.'+(blob.type==='image/png'?'png':'jpg'),{type:blob.type});
}
export function photoFailure(error) {
  const code=error?.code;
  if(['OS-PLUG-CAMR-0006','OS-PLUG-CAMR-0013'].includes(code)||/cancelled|canceled|annul/i.test(error?.message||''))return 'Sélection annulée. Aucune nouvelle photo n’a été ajoutée.';
  if(code==='OS-PLUG-CAMR-0005')return 'Accès refusé à vos photos. Autorisez-le dans les réglages ou prenez une nouvelle photo.';
  if(['OS-PLUG-CAMR-0003'].includes(code)||/permission|denied|refus/i.test(error?.message||''))return 'Accès refusé. Autorisez l’appareil photo dans les réglages ou choisissez une image existante.';
  if(code==='OS-PLUG-CAMR-0007')return 'Aucun appareil photo disponible. Choisissez une image existante.';
  return error?.message||'Impossible de préparer cette photo. Réessayez ou choisissez un fichier.';
}
export function createProofPicker({capture,pick,toFile,accept,clear,setBusy,message}) {
  let generation=0,busy=false;
  return {
    async choose(source,restoredPhoto){
      if(busy)return;
      const serial=++generation;busy=true;setBusy(true);message('Préparation de la photo…');
      try{
        const photo=restoredPhoto||(source==='camera'?await capture():await pick());
        if(serial!==generation)return;
        const file=source==='file'?photo:await toFile(photo);
        if(serial!==generation)return;
        await accept(file);
        if(serial===generation)message('Photo prête. Elle sera envoyée uniquement en publiant le signalement et restera privée.');
      }catch(error){if(serial===generation)message(photoFailure(error));}
      finally{if(serial===generation){busy=false;setBusy(false);}}
    },
    reset(){generation++;busy=false;setBusy(false);clear();message('Aucune photo sélectionnée.');}
  };
}
