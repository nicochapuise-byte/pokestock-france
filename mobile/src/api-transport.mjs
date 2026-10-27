// Only the configured PokéStock API uses native HTTP; other requests keep normal fetch.
export function createApiFetch(apiUrl,httpRequest,webFetch) {
  const api=new URL(apiUrl);
  if(api.protocol!=='https:'||api.username||api.password)throw Error('Invalid API URL');
  return async(input,options={})=>{
    const raw=typeof input==='string'?input:input instanceof URL?input.href:null;
    let url;try{url=raw?new URL(raw):null;}catch{}
    if(!url||url.origin!==api.origin)return webFetch(input,options);
    if(url.username||url.password)throw Error('Invalid API credentials');
    if(options.signal?.aborted)throw options.signal.reason||new DOMException('Aborted','AbortError');
    const headers=Object.fromEntries(new Headers(options.headers||{}));
    headers['cache-control']='no-store';
    let data=options.body;
    if(data!==undefined&&data!==null){
      if(typeof data!=='string')throw Error('Native API only accepts JSON request bodies');
      data=JSON.parse(data);
    }
    let onAbort;
    try{
      const pending=httpRequest({url:url.href,method:options.method||'GET',headers,data,responseType:'json',disableRedirects:true,connectTimeout:15000,readTimeout:30000});
      const native=await (options.signal?Promise.race([pending,new Promise((_,reject)=>{
        onAbort=()=>reject(options.signal.reason||new DOMException('Aborted','AbortError'));
        options.signal.addEventListener('abort',onAbort,{once:true});
      })]):pending);
      const body=[204,205,304].includes(native.status)?null:JSON.stringify(native.data);
      return new Response(body,{status:native.status,headers:{...native.headers,'content-type':'application/json'}});
    }finally{if(onAbort)options.signal.removeEventListener('abort',onAbort);}
  };
}
