(()=>{
  const SOURCES={
    '令和4年度':{url:'https://www.exam.or.jp/CS_r041/CS20221903.pdf',pages:{1:[1,2],2:[3,4],3:[5,6],4:[7]}},
    '令和5年度':{url:'https://www.exam.or.jp/CS_r051/CS20231903.pdf',pages:{1:[1],2:[2],3:[3,4],4:[5,6]}},
    '令和6年度':{url:'https://www.exam.or.jp/wp-content/uploads/2024/12/CS20241903.pdf',pages:{1:[1,2],2:[3],3:[4,5],4:[6,7]}},
    '令和7年度':{url:'https://www.exam.or.jp/wp-content/uploads/2025/11/CS20251903.pdf',pages:{1:[1,2],2:[3],3:[4],4:[5,6]}}
  };
  let FIGURES={};
  let manifestReady=false;

  const style=document.createElement('style');
  style.textContent=`
    .machine-study-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start;margin:12px 0 18px}
    .machine-problem-pane{min-width:0}.machine-problem-pane .prompt{margin:0}
    .figure-panel{margin:0;padding:14px;border:1px solid #d9e4e2;border-radius:16px;background:#f8fbfa;min-width:0}
    .figure-panel h3{margin:0 0 5px;font-size:16px}.figure-panel .fig-note{font-size:12px;color:#62706d;margin:0 0 10px;line-height:1.55}
    .figure-image-wrap{overflow:auto;max-height:min(68vh,760px);border-radius:12px;border:1px solid #ccd9d6;background:#fff;-webkit-overflow-scrolling:touch}
    .figure-image{display:block;width:100%;height:auto;cursor:zoom-in;background:#fff}
    .figure-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .figure-open{border:1px solid #b8ccc8;background:#fff;border-radius:10px;padding:9px 12px;font-weight:700;color:#245b54;text-decoration:none;font:inherit}
    .figure-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.86);display:flex;flex-direction:column;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom))}
    .figure-modal-head{display:flex;gap:8px;justify-content:space-between;align-items:center;color:#fff;padding:3px 4px 9px;font-weight:700}
    .figure-modal-tools{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.figure-modal button{border:0;border-radius:999px;background:#fff;color:#222;padding:8px 12px;font-weight:800}
    .figure-modal-body{flex:1;min-height:0;overflow:auto;border-radius:10px;background:#fff;text-align:center;-webkit-overflow-scrolling:touch}
    .figure-modal-body img{display:block;margin:0 auto;width:100%;height:auto;max-width:none;transform-origin:top center}
    .figure-wait{padding:18px;text-align:center;color:#62706d;font-size:13px}
    @media(min-width:820px){.machine-study-grid{grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);gap:20px}.machine-study-grid .figure-panel{position:sticky;top:12px}.figure-image-wrap{max-height:72vh}}
    @media(max-width:819px){.figure-image-wrap{max-height:none}}
  `;
  document.head.appendChild(style);

  const pageUrl=(url,p)=>`${url}#page=${p}&zoom=page-width`;
  function currentKey(){
    if(document.querySelector('#subjectSel')?.value!=='machine_safety')return null;
    const meta=document.querySelector('.qcard .qmeta');if(!meta)return null;
    const text=meta.textContent||'';
    const year=text.match(/令和[4-7]年度/)?.[0],q=text.match(/問\s*(\d+)/)?.[1];
    return year&&q?{year,q:Number(q)}:null;
  }
  function figureFor(key){return FIGURES[`${key.year}|${key.q}`]||null}
  function openModal(src,label){
    document.querySelector('.figure-modal')?.remove();
    const m=document.createElement('div');m.className='figure-modal';
    m.innerHTML=`<div class="figure-modal-head"><span>${label}</span><div class="figure-modal-tools"><button data-out>−</button><button data-reset>100%</button><button data-in>＋</button><button data-close>閉じる</button></div></div><div class="figure-modal-body"><img src="${src}" alt="${label}"></div>`;
    let z=1;const img=m.querySelector('img'),reset=m.querySelector('[data-reset]');
    const apply=()=>{img.style.width=`${Math.round(z*100)}%`;reset.textContent=`${Math.round(z*100)}%`};
    m.querySelector('[data-in]').onclick=()=>{z=Math.min(3,z+.25);apply()};m.querySelector('[data-out]').onclick=()=>{z=Math.max(.5,z-.25);apply()};reset.onclick=()=>{z=1;apply()};m.querySelector('[data-close]').onclick=()=>m.remove();
    m.addEventListener('click',e=>{if(e.target===m)m.remove()});document.body.appendChild(m);
  }
  function renderPanel(){
    const card=document.querySelector('.qcard'),key=currentKey();if(!card||!key)return;
    const marker=`${key.year}-${key.q}`;
    if(card.querySelector(`.machine-study-grid[data-key="${marker}"]`)){
      if(manifestReady&&card.querySelector('.figure-wait'))card.querySelector('.machine-study-grid')?.remove();else return;
    }
    card.querySelector('.machine-study-grid')?.remove();card.querySelector('.figure-panel')?.remove();card.querySelector('.figure-note')?.remove();
    const prompt=card.querySelector('.prompt');if(!prompt)return;
    const grid=document.createElement('div');grid.className='machine-study-grid';grid.dataset.key=marker;
    const left=document.createElement('div');left.className='machine-problem-pane';prompt.parentNode.insertBefore(grid,prompt);left.appendChild(prompt);grid.appendChild(left);
    const panel=document.createElement('section');panel.className='figure-panel';grid.appendChild(panel);
    if(!manifestReady){panel.innerHTML='<h3>原問題の図・表</h3><div class="figure-wait">図表を読み込んでいます…</div>';return}
    const src=SOURCES[key.year],asset=figureFor(key),pages=src?.pages?.[key.q]||[];
    if(asset){
      const label=`${key.year} 機械安全 問${key.q} 原問題の図・表`;
      const firstPage=asset.pages?.[0]||pages[0]||1;
      panel.innerHTML=`<h3>原問題の図・表</h3><p class="fig-note">問題資料から図・表だけを切り出しています。問題文と同時に確認できます。${asset.parts>1?`（${asset.parts}点）`:''}</p><div class="figure-image-wrap"><img class="figure-image" loading="lazy" src="${asset.src}" alt="${label}"></div><div class="figure-actions"><button class="figure-open" data-enlarge>大きく表示</button><a class="figure-open" target="_blank" rel="noopener noreferrer" href="${pageUrl(src.url,firstPage)}">原問題PDF</a></div>`;
      const img=panel.querySelector('img');img.onclick=()=>openModal(asset.src,label);panel.querySelector('[data-enlarge]').onclick=()=>openModal(asset.src,label);
    }else{
      panel.innerHTML=`<h3>原問題資料</h3><p class="fig-note">この問題では切り出し対象の図・表がありません。必要な場合は原問題PDFを確認できます。</p><div class="figure-actions">${pages.map(p=>`<a class="figure-open" target="_blank" rel="noopener noreferrer" href="${pageUrl(src.url,p)}">原問題 p.${p}</a>`).join('')}</div>`;
    }
  }
  fetch('./assets/machine/manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then(m=>{FIGURES=m.questions||{};manifestReady=true;renderPanel()}).catch(()=>{manifestReady=true;FIGURES={};renderPanel()});
  new MutationObserver(renderPanel).observe(document.documentElement,{subtree:true,childList:true});addEventListener('DOMContentLoaded',renderPanel);
})();
