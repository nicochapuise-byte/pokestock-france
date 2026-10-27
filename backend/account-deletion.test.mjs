import assert from 'node:assert/strict';
import {COUNT_KEYS} from './account-erasure.mjs';
import {handleAccountDeletion} from './account-deletion.mjs';
const id='00000000-0000-4000-8000-000000000001';const rows=new Map(),queries=[];let queueMode=false;
const ctx={authenticate:async request=>request.headers.get('authorization')?.replace('Bearer ','')||null,isSiteAdmin:async user=>user==='admin',json:(data,status)=>Response.json(data,{status}),sql:async(query,params=[])=>{
 queries.push({query,params});
 if(query.startsWith('INSERT')){let row=rows.get(params[0]);if(!row||row.status==='cancelled')row={id,status:'requested',requested_at:'2026-10-27T12:00:00Z',updated_at:'2026-10-27T12:00:00Z',email:'DO_NOT_RETURN'};rows.set(params[0],row);return [row];}
 if(query.startsWith('SELECT id,status'))return rows.has(params[0])?[rows.get(params[0])]:[];
 if(query.startsWith('UPDATE')&&query.includes("SET status='cancelled'")){const r=rows.get(params[0]);if(r?.status!=='requested')return [];r.status='cancelled';return [r];}
 if(query.startsWith('UPDATE')&&query.includes("SET status='processing'")){assert.equal(params[1],'admin');const r=rows.get('owner');if(params[0]!==id||!r||r.status==='cancelled')return [];r.status='processing';return [r];}
 if(query.startsWith('SELECT COUNT'))return [{requested:queueMode?26:1,processing:0}];
 if(query.startsWith('SELECT d.id')&&query.includes('identity_present'))return [{id,user_id:'10000000-0000-4000-8000-000000000001',status:'processing',identity_present:true}];
 if(query.startsWith('SELECT\n'))return [Object.fromEntries(COUNT_KEYS.map(key=>[key,0]))];
 if(query.startsWith("SELECT objects.bucket"))return [];
 if(query.startsWith('SELECT d.id'))return queueMode?Array.from({length:26},(_,i)=>({id:'id'+i})):[];
 throw Error('Unexpected SQL '+query);
}};
async function send(path,method='GET',data,user='owner'){const request=new Request('https://test'+path,{method,headers:user?{authorization:'Bearer '+user}:{},...(data!==undefined?{body:JSON.stringify(data)}:{})});return handleAccountDeletion(request,new URL(request.url),ctx);}
for(const [path,method,data]of [['/me/account-deletion','GET'],['/me/account-deletion','POST',{confirmation:'SUPPRIMER'}],['/me/account-deletion','PATCH',{action:'cancel'}],['/admin/account-deletions','GET'],['/admin/account-deletions/'+id+'/preview','GET'],['/admin/account-deletions/'+id,'PATCH',{action:'start'}]])assert.equal((await send(path,method,data,null)).status,401);
assert.equal((await send('/admin/account-deletions')).status,403);
assert.equal((await send('/me/account-deletion','POST',{confirmation:'SUPPRIMER',userId:'victim'})).status,400);
assert.equal((await send('/me/account-deletion','POST',{confirmation:'oops'})).status,400);
let response=await send('/me/account-deletion','POST',{confirmation:'SUPPRIMER'});let data=await response.json();assert.equal(data.mode,'manual');assert.equal(data.request.status,'requested');assert(!JSON.stringify(data).includes('DO_NOT_RETURN'));
await send('/me/account-deletion','POST',{confirmation:'SUPPRIMER'});assert.equal(rows.size,1);
assert.equal((await (await send('/me/account-deletion', 'GET',undefined,'other')).json()).request,null);
assert.equal((await send('/me/account-deletion','PATCH',{action:'cancel'},'other')).status,409);
assert.equal((await send('/me/account-deletion','PATCH',{action:'cancel'})).status,200);
await send('/me/account-deletion','POST',{confirmation:'SUPPRIMER'});assert.equal(rows.get('owner').status,'requested');
assert.equal((await send('/admin/account-deletions/'+id,'PATCH',{action:'start'},'admin')).status,200);
assert.equal((await send('/me/account-deletion','PATCH',{action:'cancel'})).status,409);
assert.equal((await send('/admin/account-deletions/'+id,'PATCH',{action:'complete'},'admin')).status,400);
assert.equal((await send('/admin/account-deletions?offset=-1','GET',undefined,'admin')).status,400);
queueMode=true;data=await (await send('/admin/account-deletions','GET',undefined,'admin')).json();assert.equal(data.requests.length,25);assert.equal(data.hasMore,true);assert.equal(data.nextOffset,25);
assert.equal((await send('/me/account-deletion','DELETE')).status,405);
assert(!queries.some(q=>/\bDELETE\b|\bDROP\b|\bTRUNCATE\b/.test(q.query)));
console.log('PASS: authenticated account request workflow; all writes mocked.');

assert.equal((await send('/admin/account-deletions/'+id+'/preview')).status,403);
const preview=await (await send('/admin/account-deletions/'+id+'/preview','GET',undefined,'admin')).json();assert.equal(preview.mode,'preview-only');assert.equal(preview.executable,false);assert.equal(preview.counts.reports,0);assert(!JSON.stringify(preview).includes('10000000-0000-4000-8000-000000000001'));
assert.equal((await send('/admin/account-deletions/invalid/preview','GET',undefined,'admin')).status,400);
