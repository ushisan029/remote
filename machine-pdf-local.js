(()=>{
  const PDFS={
    '令和4年度':{file:'r04-machine.pdf',pages:{1:1,2:3,3:5,4:7}},
    '令和5年度':{file:'r05-machine.pdf',pages:{1:1,2:2,3:3,4:5}},
    '令和6年度':{file:'r06-machine.pdf',pages:{1:1,2:3,3:4,4:6}},
    '令和7年度':{file:'r07-machine.pdf',pages:{1:1,2:3,3:4,4:5}}
  };

  function currentQuestion(){
    try{
      if(typeof state!=='undefined' && state?.subject==='machine_safety' && typeof currentSet==='function'){
        const set=currentSet();
        if(set?.length){
          const q=set[state.index%set.length];
          if(q?.yearLabel&&q?.questionNo)return {year:String(q.yearLabel),q:Number(q.questionNo)};
        }
      }
    }catch(_){ }
    const meta=(document.querySelector('.qcard .qmeta')?.textContent||'').normalize('NFKC');
    const year=meta.match(/令和[4-7]年度/)?.[0];
    const q=Number(meta.match(/問\s*([1-4])/)?.[1]||0);
    return year&&q?{year,q}:null;
  }

  function localPdfUrl(info,page){
    const cfg=PDFS[info.year];
    if(!cfg)return null;
    const p=page||cfg.pages[info.q]||1;
    return `./assets/machine/pdf/${cfg.file}#page=${p}&zoom=page-width`;
  }

  function rewrite(){
    const info=currentQuestion();
    if(!info)return;
    document.querySelectorAll('.figure-panel a.figure-open').forEach(a=>{
      const text=(a.textContent||'').trim();
      if(!text.startsWith('原問題'))return;
      const page=Number(text.match(/p\.(\d+)/)?.[1]||0);
      const url=localPdfUrl(info,page);
      if(!url)return;
      if(a.getAttribute('href')!==url)a.setAttribute('href',url);
      a.dataset.localPdf='1';
      a.title='アプリに保存した原問題PDFを開きます';
    });
  }

  let queued=false;
  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;rewrite()});
  }
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('DOMContentLoaded',queue);
  queue();
})();
