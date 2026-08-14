(()=>{
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.endsWith('.b64gz')) return nativeFetch(input,init);
    const response=await nativeFetch(input,init);
    if(!response.ok) return response;
    if(typeof DecompressionStream==='undefined'){
      throw new Error('このブラウザは圧縮過去問データの展開に対応していません。iOS/Safariを最新版に更新してください。');
    }
    const b64=(await response.text()).trim();
    const binary=atob(b64);
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const text=await new Response(stream).text();
    const headers=new Headers(response.headers);
    headers.set('content-type','application/json; charset=utf-8');
    return new Response(text,{status:response.status,statusText:response.statusText,headers});
  };
})();
