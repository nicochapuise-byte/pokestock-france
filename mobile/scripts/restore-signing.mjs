import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Secret contents are never printed or committed. The public certificate is pinned.
try{
 const raw=process.env.ANDROID_SIGNING_BUNDLE;
 if(!raw)throw Error('Missing signing configuration');
 const data=JSON.parse(raw);
 if(typeof data.keystoreBase64!=='string'||data.keystoreBase64.length>60000||! /^[A-Za-z0-9+/]+={0,2}$/.test(data.keystoreBase64)||data.keyAlias!=='pokestock-android-test'||typeof data.storePassword!=='string'||! /^[a-f0-9]{64}$/.test(data.storePassword)||data.keyPassword!==data.storePassword)throw Error('Invalid signing configuration');
 const expected=(await readFile(new URL('../android/signing-certificate.sha256',import.meta.url),'utf8')).trim();
 const dir=process.env.RUNNER_TEMP;if(!dir||!process.env.GITHUB_ENV)throw Error('Missing CI environment');
 await mkdir(dir,{recursive:true});
 const path=resolve(dir,'pokestock-signing.p12');
 await writeFile(path,Buffer.from(data.keystoreBase64,'base64'),{mode:0o600});
 const certificate=execFileSync('keytool',['-exportcert','-alias',data.keyAlias,'-keystore',path,'-storepass:env','PKST_VERIFY_PASSWORD'],{env:{...process.env,PKST_VERIFY_PASSWORD:data.storePassword},stdio:['ignore','pipe','pipe']});
 if(createHash('sha256').update(certificate).digest('hex')!==expected)throw Error('Certificate mismatch');
 // Mask individual fields as well as the complete repository secret.
 console.log('::add-mask::'+data.storePassword);
 console.log('::add-mask::'+data.keystoreBase64);
 await writeFile(process.env.GITHUB_ENV,'PKST_KEYSTORE_FILE='+path+'\nPKST_KEYSTORE_PASSWORD='+data.storePassword+'\nPKST_KEY_ALIAS='+data.keyAlias+'\nPKST_KEY_PASSWORD='+data.keyPassword+'\n',{flag:'a',mode:0o600});
 console.log('Permanent test signing certificate verified: '+expected);
}catch{
 console.error('Signature indisponible : configurez le secret ANDROID_SIGNING_BUNDLE avec la clé correspondant au certificat du dépôt. Aucun APK à signature temporaire ne sera publié.');process.exitCode=1;
}
