(()=>{
  const FILES=[
    './data/detailed/r07-general.json','./data/detailed/r07-law.json',
    './data/detailed/r06-general.json','./data/detailed/r06-law.json',
    './data/detailed/r05-general.json','./data/detailed/r05-law.json',
    './data/detailed/r04-general.json','./data/detailed/r04-law.json',
    './data/detailed/r03-general.json','./data/detailed/r03-law.json',
    './data/detailed/r02-general.json','./data/detailed/r02-law.json',
    './data/detailed/r01-general.json','./data/detailed/r01-law.json',
    './data/detailed/h30-general.json','./data/detailed/h30-law.json',
    './data/detailed/h29-general.json'
  ];
  const upstream=window.fetch.bind(window);
  let patchPromise;

  function getPatches(){
    if(!patchPromise){
      patchPromise=Promise.all(FILES.map(url=>upstream(url,{cache:'no-store'}).then(r=>{
        if(!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.json();
      }))).then(all=>{
        const patches=all.flatMap(j=>j.PATCHES||[]);
        return new Map(patches.map(p=>[p.id,p]));
      });
    }
    return patchPromise;
  }

  window.fetch=async function(input,init){
    const response=await upstream(input,init);
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!response.ok||!(/questions\.json(?:\?|$)/.test(url)||/\/data\/.*(?:\.json|\.b64gz)(?:\?|$)/.test(url))) return response;
    try{
      const data=await response.clone().json();
      if(!Array.isArray(data.QUESTIONS)) return response;
      const patches=await getPatches();
      data.QUESTIONS=data.QUESTIONS.map(q=>{
        const patch=patches.get(q.id);
        return patch?{...q,...patch,id:q.id}:q;
      });
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch(e){
      console.warn('詳細解説を適用できませんでした',e);
      return response;
    }
  };

  function labelStudyExplanations(){
    document.querySelectorAll('.explain > strong').forEach(el=>{
      if(el.textContent.trim()==='解説') el.textContent='解説（学習用）';
    });
  }
  new MutationObserver(labelStudyExplanations).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('DOMContentLoaded',labelStudyExplanations);
})();
