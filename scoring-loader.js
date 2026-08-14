(()=>{
  const upstream=window.fetch.bind(window);
  let patchPromise;

  function getPatches(){
    if(!patchPromise){
      patchPromise=upstream('./data/machine-scoring-v1.json',{cache:'no-store'})
        .then(r=>{if(!r.ok) throw new Error(`scoring data ${r.status}`);return r.json()})
        .then(j=>new Map((j.PATCHES||[]).map(p=>[p.id,p])));
    }
    return patchPromise;
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const response=await upstream(input,init);
    if(!/machine-r0[4-7]\.json(?:\?|$)/.test(url)||!response.ok) return response;
    try{
      const data=await response.clone().json();
      const patches=await getPatches();
      data.QUESTIONS=(data.QUESTIONS||[]).map(q=>{
        const p=patches.get(q.id);
        return p?{...q,...p,id:q.id}:q;
      });
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch(e){
      console.warn('自己採点ガイドを適用できませんでした',e);
      return response;
    }
  };

  function relabel(){
    document.querySelectorAll('.explain > strong').forEach(el=>{
      if(el.textContent.trim()==='答案作成ポイント') el.textContent='自己採点ポイント（推定）';
    });
  }
  new MutationObserver(relabel).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('DOMContentLoaded',relabel);
})();
