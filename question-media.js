(()=>{
  const VERSION='20260927-1';
  const MANIFEST_URL=`./assets/question-images/manifest.json?v=${VERSION}`;
  let manifestPromise=null;

  const style=document.createElement('style');
  style.textContent=`
    .qmedia-block{margin:14px 0 18px;padding:12px;border:1px solid #d9e4e2;border-radius:14px;background:#f8fbfa}
    .qmedia-block[data-kind="explanation"]{margin-top:12px;background:#fbfcfc}
    .qmedia-title{margin:0 0 8px;font-size:14px;font-weight:800;color:#355f5a}
    .qmedia-list{display:grid;gap:12px}.qmedia-item{min-width:0}
    .qmedia-caption{margin:0 0 6px;font-size:12px;line-height:1.5;color:#62706d}
    .qmedia-wrap{overflow:auto;border:1px solid #ccd9d6;border-radius:12px;background:#fff;-webkit-overflow-scrolling:touch}
    .qmedia-img{display:block;width:100%;height:auto;max-height:72vh;object-fit:contain;background:#fff;cursor:zoom-in}
    .qmedia-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .qmedia-btn{border:1px solid #b8ccc8;background:#fff;border-radius:10px;padding:8px 11px;font:inherit;font-weight:700;color:#245b54;cursor:pointer;text-decoration:none}
    .qmedia-error{padding:12px;border-radius:10px;background:#fff3f1;color:#9b2c1f;font-size:13px}
    .qmedia-modal{position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.88);display:flex;flex-direction:column;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom))}
    .qmedia-modal-head{display:flex;gap:8px;justify-content:space-between;align-items:center;color:#fff;padding:3px 4px 9px;font-weight:700}
    .qmedia-modal-tools{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .qmedia-modal button{border:0;border-radius:999px;background:#fff;color:#222;padding:8px 12px;font-weight:800;cursor:pointer}
    .qmedia-modal-body{flex:1;min-height:0;overflow:auto;border-radius:10px;background:#fff;text-align:center;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y pinch-zoom}
    .qmedia-modal-body img{display:block;margin:0 auto;width:100%;height:auto;max-width:none;transform-origin:top center}
    @media(min-width:820px){.qmedia-img{max-height:70vh}}
  `;
  document.head.appendChild(style);

  const text=v=>String(v??'');
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  function normalizeItem(raw,index,kind){
    if(typeof raw==='string')return{src:raw,caption:'',alt:`${kind==='explanation'?'解説':'問題'}画像 ${index+1}`};
    if(!raw||typeof raw!=='object'||!raw.src)return null;
    return{src:String(raw.src),caption:text(raw.caption),alt:text(raw.alt||raw.caption||`${kind==='explanation'?'解説':'問題'}画像 ${index+1}`)};
  }
  function normalizeList(value,kind){
    const list=Array.isArray(value)?value:(value?[value]:[]);
    return list.map((x,i)=>normalizeItem(x,i,kind)).filter(Boolean);
  }
  function inlineMedia(q){
    const question=normalizeList(q.images,'question');
    if(!question.length&&q.image)question.push({src:String(q.image),caption:text(q.imageCaption),alt:text(q.imageAlt||q.imageCaption||'問題画像')});
    const explanation=normalizeList(q.explanationImages,'explanation');
    if(!explanation.length&&q.explanationImage)explanation.push({src:String(q.explanationImage),caption:text(q.explanationImageCaption),alt:text(q.explanationImageAlt||q.explanationImageCaption||'解説画像')});
    return{question,explanation};
  }
  async function manifest(){
    if(!manifestPromise)manifestPromise=fetch(MANIFEST_URL,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
    return manifestPromise;
  }
  function withBase(src,base){
    if(/^(?:https?:|data:|blob:|\/|\.\/|\.\.\/)/i.test(src))return src;
    return`${base||'./assets/question-images/'}${src}`;
  }
  async function mediaFor(q){
    const inline=inlineMedia(q);
    if(inline.question.length||inline.explanation.length)return inline;
    const m=await manifest(),entry=m?.questions?.[q.id];
    if(!entry)return inline;
    const base=m.basePath||'./assets/question-images/';
    const qRaw=Array.isArray(entry)?entry:(entry.question||entry.images||[]);
    const eRaw=Array.isArray(entry)?[]:(entry.explanation||entry.explanationImages||[]);
    return{
      question:normalizeList(qRaw,'question').map(x=>({...x,src:withBase(x.src,base)})),
      explanation:normalizeList(eRaw,'explanation').map(x=>({...x,src:withBase(x.src,base)}))
    };
  }
  function currentQuestion(){
    try{
      if(typeof state!=='undefined'&&typeof currentSet==='function'){
        const set=currentSet();
        if(set?.length)return set[state.index%set.length]||null;
      }
    }catch(_){ }
    return null;
  }
  function openModal(item,label){
    document.querySelector('.qmedia-modal')?.remove();
    const modal=document.createElement('div');modal.className='qmedia-modal';
    const head=document.createElement('div');head.className='qmedia-modal-head';
    const title=document.createElement('span');title.textContent=label;
    const tools=document.createElement('div');tools.className='qmedia-modal-tools';
    const out=document.createElement('button');out.type='button';out.textContent='−';out.setAttribute('aria-label','縮小');
    const reset=document.createElement('button');reset.type='button';reset.textContent='100%';
    const inc=document.createElement('button');inc.type='button';inc.textContent='＋';inc.setAttribute('aria-label','拡大');
    const close=document.createElement('button');close.type='button';close.textContent='閉じる';
    tools.append(out,reset,inc,close);head.append(title,tools);
    const body=document.createElement('div');body.className='qmedia-modal-body';
    const img=document.createElement('img');img.src=item.src;img.alt=item.alt||label;body.appendChild(img);
    modal.append(head,body);document.body.appendChild(modal);
    let zoom=1;const apply=()=>{img.style.width=`${Math.round(zoom*100)}%`;reset.textContent=`${Math.round(zoom*100)}%`};
    inc.onclick=()=>{zoom=clamp(zoom+.25,.5,5);apply()};out.onclick=()=>{zoom=clamp(zoom-.25,.5,5);apply()};reset.onclick=()=>{zoom=1;apply()};close.onclick=()=>modal.remove();
    modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
    const escClose=e=>{if(e.key==='Escape'){modal.remove();removeEventListener('keydown',escClose)}};addEventListener('keydown',escClose);
  }
  function buildBlock(items,kind,q){
    if(!items.length)return null;
    const section=document.createElement('section');section.className='qmedia-block';section.dataset.kind=kind;section.dataset.questionId=q.id||'';
    const title=document.createElement('div');title.className='qmedia-title';title.textContent=kind==='explanation'?'解説画像':'問題の図・写真';section.appendChild(title);
    const list=document.createElement('div');list.className='qmedia-list';section.appendChild(list);
    items.forEach((item,i)=>{
      const article=document.createElement('div');article.className='qmedia-item';
      if(item.caption){const cap=document.createElement('p');cap.className='qmedia-caption';cap.textContent=item.caption;article.appendChild(cap)}
      const wrap=document.createElement('div');wrap.className='qmedia-wrap';
      const img=document.createElement('img');img.className='qmedia-img';img.loading='lazy';img.src=item.src;img.alt=item.alt||'';
      img.onerror=()=>{wrap.innerHTML='';const err=document.createElement('div');err.className='qmedia-error';err.textContent=`画像を読み込めませんでした: ${item.src}`;wrap.appendChild(err)};
      const label=`${q.yearLabel||''} ${q.title||''} ${kind==='explanation'?'解説':'問題'}画像 ${i+1}`.trim();
      img.onclick=()=>openModal(item,label);wrap.appendChild(img);article.appendChild(wrap);
      const actions=document.createElement('div');actions.className='qmedia-actions';
      const enlarge=document.createElement('button');enlarge.type='button';enlarge.className='qmedia-btn';enlarge.textContent='大きく表示';enlarge.onclick=()=>openModal(item,label);
      const original=document.createElement('a');original.className='qmedia-btn';original.textContent='画像だけ開く';original.href=item.src;original.target='_blank';original.rel='noopener noreferrer';
      actions.append(enlarge,original);article.appendChild(actions);list.appendChild(article);
    });
    return section;
  }
  function removeBlocks(){document.querySelectorAll('.qmedia-block').forEach(x=>x.remove())}
  async function render(){
    const q=currentQuestion(),card=document.querySelector('.qcard');
    if(!q||!card){removeBlocks();return}
    const revealed=typeof state!=='undefined'&&state.revealed;
    const key=`${q.id||''}:${revealed?'1':'0'}`;
    if(card.dataset.qmediaKey===key)return;
    card.dataset.qmediaKey=key;removeBlocks();
    const media=await mediaFor(q);if(card.dataset.qmediaKey!==key)return;
    const qBlock=buildBlock(media.question,'question',q);
    if(qBlock){const prompt=card.querySelector('.prompt'),note=card.querySelector('.figure-note'),anchor=note||prompt;if(anchor)anchor.insertAdjacentElement('afterend',qBlock)}
    if(revealed){const eBlock=buildBlock(media.explanation,'explanation',q);if(eBlock){const result=card.querySelector('.result'),explain=result?.querySelector('.explain');if(explain)explain.insertAdjacentElement('afterend',eBlock);else result?.prepend(eBlock)}}
  }
  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;render()})}
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});addEventListener('DOMContentLoaded',queue);queue();
})();