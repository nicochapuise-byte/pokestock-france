import {createHash} from 'node:crypto';
// Extract the single v2 signing certificate independently of apksigner's
// human-readable output. Cryptographic signature validation remains mandatory.
export function apkCertificateSha256(b){
 const e=b.lastIndexOf(Buffer.from('504b0506','hex'));
 if(e<0||e+22>b.length)throw Error('Invalid APK ZIP');
 const cd=b.readUInt32LE(e+16);
 if(cd<24||cd>b.length||b.subarray(cd-16,cd).toString()!=='APK Sig Block 42')throw Error('Missing APK signing block');
 const size=Number(b.readBigUInt64LE(cd-24)),start=cd-size-8;
 if(!Number.isSafeInteger(size)||start<0||Number(b.readBigUInt64LE(start))!==size)throw Error('Invalid signing block');
 const lp=(buf,offset=0)=>{if(offset+4>buf.length)throw Error('Truncated signer');const end=offset+4+buf.readUInt32LE(offset);if(end>buf.length)throw Error('Truncated signer');return[buf.subarray(offset+4,end),end];};
 const certificates=[];
 for(let p=start+8;p<cd-24;){
  if(p+12>cd-24)throw Error('Truncated signing entry');
  const n=Number(b.readBigUInt64LE(p)),end=p+8+n;
  if(n<4||!Number.isSafeInteger(n)||end>cd-24)throw Error('Invalid signing entry');
  if(b.readUInt32LE(p+8)===0x7109871a){
   const [signers]=lp(b.subarray(p+12,end));let offset=0;
   while(offset<signers.length){const [signer,next]=lp(signers,offset);offset=next;const [signed]=lp(signer);const [,afterDigests]=lp(signed);const [certs]=lp(signed,afterDigests);const [certificate]=lp(certs);certificates.push(createHash('sha256').update(certificate).digest('hex'));}
  }
  p=end;
 }
 if(certificates.length!==1)throw Error('Expected exactly one APK v2 signer');
 return certificates[0];
}
