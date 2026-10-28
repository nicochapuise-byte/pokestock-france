import test from 'node:test';import assert from 'node:assert/strict';
import {createErasureService} from './account-erasure-service.mjs';import {COUNT_KEYS} from './account-erasure.mjs';
const uid='10000000-0000-4000-8000-000000000001',rid='20000000-0000-4000-8000-000000000002';
const env={ACCOUNT_ERASURE_ENABLED:'true',NEON_ERASURE_API_KEY:'fixture-key',NEON_AUTH_BASE_URL:'https://ep-morning-bonus-b92tax88.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth',AWS_ENDPOINT_URL_S3:'https://storage.example/dev',AWS_REGION:'eu-central-1',AWS_ACCESS_KEY_ID:'test',AWS_SECRET_ACCESS_KEY:'test'};
function fixture({admin=false,active=0,identityError=false,headError=false,overrides={}}={}){
 const state={identity:true,object:true,rows:true,request:true,blocked:false,job:null,events:[],failIdentity:identityError,failHead:headError};
 const sql=async(q,p=[])=>{
  if(q.startsWith('WITH request AS')){assert.equal(p[0],uid);state.job={request_id:rid,user_id:uid,receipt_hash:p[1],state:'prepared',stage:'prepared',worker_id:null};return[{request_id:rid}];}
  if(q.startsWith('SELECT request_id,'))return state.job&&p[0]===rid&&p[1]===state.job.receipt_hash?[{...state.job}]:[];
  if(q.includes("SET worker_id=$2::uuid,state='running'")){if(state.job.worker_id||state.job.receipt_hash!==p[2])return[];state.job.worker_id=p[1];state.job.state='running';return[{request_id:rid}];}
  if(q.startsWith('SELECT id FROM public.account_deletion_requests'))return state.request?[{id:rid}]:[];
  if(q.startsWith('SELECT d.id'))return state.request?[{id:rid,user_id:uid,status:'processing',identity_present:state.identity}]:[];
  if(q.startsWith('SELECT\n'))return[Object.fromEntries(COUNT_KEYS.map(k=>[k,state.rows&&['reports','proof_photos','deletion_requests'].includes(k)?1:0]))];
  if(q.startsWith('SELECT objects.bucket'))return state.rows?[{bucket:'proofs',key:'reports/fixture.jpg',shared:false}]:[];
  if(q.includes('public.block_account_erasure')){state.blocked=true;return[{acquired:true,active_operations:active}];}
  if(q.startsWith('SELECT 1 FROM neon_auth'))return state.identity?[{present:1}]:[];
  if(q.includes('SET stage=$3')){state.job.stage=p[2];return[];}
  if(q.startsWith('WITH target AS')){assert.equal(state.identity,false);assert.equal(state.object,false);assert(state.blocked);state.events.push('rows');state.rows=false;state.request=false;return[{executed:true}];}
  if(q.includes("SET state='completed'")){assert.equal(state.rows,false);assert.equal(state.object,false);state.job.state='completed';state.job.stage='completed';state.job.user_id=null;state.job.worker_id=null;state.events.push('completed');return[{request_id:rid}];}
  if(q.startsWith('UPDATE public.account_erasure_control')){state.blocked=false;return[];}
  if(q.includes("SET state='failed'")){state.job.state='failed';state.job.worker_id=null;return[];}
  throw Error('Unexpected fixture query '+q);
 };
 const fetcher=async(url,options)=>{
  if(String(url).startsWith('https://console.neon.tech/')){assert.match(String(url),new RegExp('/br-morning-lab-b9mavkej/auth/users/'+uid+'$'));assert.equal(options.method,'DELETE');state.events.push('identity');if(state.failIdentity)throw Error('unknown outcome');state.identity=false;return new Response(null,{status:204});}
  assert.equal(new URL(url).origin,'https://storage.example');
  if(options.method==='DELETE'){state.events.push('file');state.object=false;return new Response(null,{status:204});}
  assert.equal(options.method,'HEAD');return new Response(null,{status:state.failHead?403:state.object?200:404});
 };
 const handler=createErasureService({sql,authenticate:async request=>request.headers.get('authorization')==='Bearer owner'?uid:null,isSiteAdmin:async()=>admin,json:(value,status)=>Response.json(value,{status}),env:{...env,...overrides},fetcher});
 const send=(path,method='GET',data,token)=>{const req=new Request('https://api.example'+path,{method,headers:token?{authorization:'Bearer '+token}:{},...(data?{body:JSON.stringify(data)}:{})});return handler(req,new URL(req.url));};
 return{state,send,sql};
}
async function prepare(f){const response=await f.send('/me/account-erasure/prepare','POST',{confirmation:'SUPPRIMER'},'owner');assert.equal(response.status,201);return response.json();}
test('automatic erasure is disabled until configured and cannot target production accidentally',async()=>{
 for(const overrides of [{NEON_ERASURE_API_KEY:''},{ACCOUNT_ERASURE_ENABLED:'false'},{NEON_AUTH_BASE_URL:'https://ep-dark-bread-b9bd8cco.neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth'}]){const f=fixture({overrides});assert.equal((await(await f.send('/account-erasure/capabilities')).json()).enabled,false);assert.equal((await f.send('/me/account-erasure/prepare','POST',{confirmation:'SUPPRIMER'},'owner')).status,503);assert.equal(f.state.events.length,0);}
});
test('prepare requires authenticated owner confirmation and refuses administrators and arbitrary targets',async()=>{
 const f=fixture();assert.equal((await f.send('/me/account-erasure/prepare','POST',{confirmation:'SUPPRIMER'})).status,401);assert.equal((await f.send('/me/account-erasure/prepare','POST',{confirmation:'SUPPRIMER',userId:'other'},'owner')).status,400);
 const admin=fixture({admin:true});assert.equal((await admin.send('/me/account-erasure/prepare','POST',{confirmation:'SUPPRIMER'},'owner')).status,409);assert.equal(admin.state.job,null);
});
test('receipt-scoped execution verifies identity and files before purging rows and clearing job identity',async()=>{
 const f=fixture(),p=await prepare(f);assert(!JSON.stringify(f.state.job).includes(p.receiptToken));
 assert.equal((await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},'0'.repeat(64))).status,401);assert.equal(f.state.events.length,0);
 const response=await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken);assert.equal(response.status,200);assert.deepEqual(await response.json(),{state:'completed'});assert.deepEqual(f.state.events,['identity','file','rows','completed']);assert.equal(f.state.job.user_id,null);assert.equal(f.state.blocked,false);
 const status=await(await f.send('/account-erasure/'+rid+'/status','GET',null,p.receiptToken)).json();assert.deepEqual(status,{state:'completed'});assert(!JSON.stringify(status).includes(uid));
});
test('active writers prevent identity deletion and release the maintenance barrier',async()=>{const f=fixture({active:1}),p=await prepare(f);assert.equal((await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken)).status,409);assert.equal(f.state.blocked,false);assert.deepEqual(f.state.events,[]);});
test('ambiguous identity or file failures preserve rows, receipt and maintenance barrier',async()=>{
 for(const opts of [{identityError:true},{headError:true}]){const f=fixture(opts),p=await prepare(f);assert.equal((await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken)).status,409);assert.equal(f.state.rows,true);assert.equal(f.state.job.state,'failed');assert.equal(f.state.blocked,true);assert(!f.state.events.includes('completed'));}
});
test('a running worker cannot be stolen and completed receipt can retry the final unlock',async()=>{
 const f=fixture(),p=await prepare(f);f.state.job.worker_id='busy';const response=await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken);assert.equal(response.status,202);assert.deepEqual(f.state.events,[]);
 f.state.job={...f.state.job,state:'completed',user_id:null};f.state.blocked=true;assert.equal((await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken)).status,200);assert.equal(f.state.blocked,false);
});

test('a receipt resumes file cleanup after identity removal without deleting identity a second time',async()=>{const f=fixture({headError:true}),p=await prepare(f);await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken);assert.equal(f.state.identity,false);f.state.failHead=false;assert.equal((await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken)).status,200);assert.equal(f.state.events.filter(e=>e==='identity').length,1);assert.equal(f.state.rows,false);assert.equal(f.state.blocked,false);});
test('completion after a lost response requires the persisted files-verified checkpoint',async()=>{for(const stage of ['files_verified','prepared']){const f=fixture(),p=await prepare(f);Object.assign(f.state,{request:false,identity:false,object:false,rows:false,blocked:true});f.state.job.stage=stage;const response=await f.send('/account-erasure/'+rid+'/execute','POST',{confirmation:'SUPPRIMER'},p.receiptToken);assert.equal(response.status,stage==='files_verified'?200:409);assert.equal(f.state.events.includes('completed'),stage==='files_verified');}});
