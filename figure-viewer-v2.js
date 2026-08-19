(()=>{
  const SOURCES={
    '令和4年度':{code:'r4',url:'https://www.exam.or.jp/CS_r041/CS20221903.pdf',pages:{1:[1,2],2:[3,4],3:[5,6],4:[7]}},
    '令和5年度':{code:'r5',url:'https://www.exam.or.jp/CS_r051/CS20231903.pdf',pages:{1:[1],2:[2],3:[3,4],4:[5,6]}},
    '令和6年度':{code:'r6',url:'https://www.exam.or.jp/wp-content/uploads/2024/12/CS20241903.pdf',pages:{1:[1,2],2:[3],3:[4,5],4:[6,7]}},
    '令和7年度':{code:'r7',url:'https://www.exam.or.jp/wp-content/uploads/2025/11/CS20251903.pdf',pages:{1:[1,2],2:[3],3:[4],4:[5,6]}}
  };
  const ASSETS={
    '令和4年度|1':'r4-q1.b64','令和4年度|2':'r4-q2.b64','令和4年度|3':'r4-q3.b64','令和4年度|4':'r4-q4.b64',
    '令和5年度|2':'r5-q2.b64','令和5年度|3':'r5-q3.b64','令和5年度|4':'r5-q4.b64',
    '令和6年度|1':'r6-q1.b64','令和6年度|2':'r6-q2.b64','令和6年度|3':'r6-q3.b64','令和6年度|4':'r6-q4.b64',
    '令和7年度|1':['r7-q1-1.b64','r7-q1-2.b64','r7-q1-3.b64','r7-q1-4.b64'],'令和7年度|2':'r7-q2.b64','令和7年度|4':'r7-q4.b64'
  };
  const cache=new Map();
  const style=document.createElement('style');
  style.textContent=`
    .machine-study-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start;margin:12px 0 18px}
    .machine-problem-pane{min-width:0}.machine-problem-pane .prompt{margin:0}
    .figure-panel{margin:0;padding:14px;border:1px solid #d9e4e2;border-radius:16px;background:#f8fbfa;min-width:0}
    .figure-panel h3{margin:0 0 5px;font-size:16px}.figure-panel .fig-note{font-size:12px;color:#62706d;margin:0 0 10px;line-height:1.55}
    .figure-image-wrap{overflow:auto;max-height:min(68vh,760px);border-radius:12px;border:1px solid #ccd9d6;background:#fff;-webkit-overflow-scrolling:touch}
    .figure-image{display:block;width:100%;height:auto;cursor:zoom-in;background:#fff}
    .figure-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.figure-open{border:1px solid #b8ccc8;background:#fff;border-radius:10px;padding:9px 12px;font-weight:700;color:#245b54;text-decoration:none;font:inherit}
    .figure-wait{padding:20px;text-align:center;color:#62706d;font-size:13px}.figure-error{padding:12px;border-radius:10px;background:#fff3f1;color:#9b2c1f;font-size:13px}
    .figure-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.86);display:flex;flex-direction:column;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom))}
    .figure-modal-head{display:flex;gap:8px;justify-content:space-between;align-items:center;color:#fff;padding:3px 4px 9px;font-weight:700}.figure-modal-tools{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.figure-modal button{border:0;border-radius:999px;background:#fff;color:#222;padding:8px 12px;font-weight:800}
    .figure-modal-body{flex:1;min-height:0;overflow:auto;border-radius:10px;background:#fff;text-align:center;-webkit-overflow-scrolling:touch}.figure-modal-body img{display:block;margin:0 auto;width:100%;height:auto;max-width:none;transform-origin:top center}
    @media(min-width:820px){.machine-study-grid{grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);gap:20px}.machine-study-grid .figure-panel{position:sticky;top:12px}.figure-image-wrap{max-height:72vh}}
    @media(max-width:819px){.figure-image-wrap{max-height:none}}
  `;
  document.head.appendChild(style);
  const pageUrl=(url,p)=>`${url}#page=${p}&zoom=page-width`;
  function currentKey(){
    if(document.querySelector('#subjectSel')?.value!=='machine_safety')return null;
    const text=document.querySelector('.qcard .qmeta')?.textContent||'';
    const year=text.match(/令和[4-7]年度/)?.[0],q=text.match(/問\s*(\d+)/)?.[1];
    return year&&q?{year,q:Number(q)}:null;
  }
  async function loadAsset(spec){
    const files=Array.isArray(spec)?spec:[spec],key=files.join('|');
    if(cache.has(key))return cache.get(key);
    const chunks=[];
    for(const filename of files){
      const r=await fetch(`./assets/machine/${filename}`,{cache:'no-cache'});
      if(!r.ok)throw new Error(`図表ファイル ${r.status}`);
      chunks.push((await r.text()).trim());
    }
    const b64=chunks.join('');
    if(!b64.startsWith('iVBOR'))throw new Error('図表データ形式が不正です');
    const src=`data:image/png;base64,${b64}`;cache.set(key,src);return src;
  }
  function openModal(src,label){
    document.querySelector('.figure-modal')?.remove();
    const m=document.createElement('div');m.className='figure-modal';
    m.innerHTML=`<div class="figure-modal-head"><span>${label}</span><div class="figure-modal-tools"><button data-out>−</button><button data-reset>100%</button><button data-in>＋</button><button data-close>閉じる</button></div></div><div class="figure-modal-body"><img src="${src}" alt="${label}"></div>`;
    let z=1;const img=m.querySelector('img'),reset=m.querySelector('[data-reset]');const apply=()=>{img.style.width=`${Math.round(z*100)}%`;reset.textContent=`${Math.round(z*100)}%`};
    m.querySelector('[data-in]').onclick=()=>{z=Math.min(3,z+.25);apply()};m.querySelector('[data-out]').onclick=()=>{z=Math.max(.5,z-.25);apply()};reset.onclick=()=>{z=1;apply()};m.querySelector('[data-close]').onclick=()=>m.remove();m.addEventListener('click',e=>{if(e.target===m)m.remove()});document.body.appendChild(m);
  }
  function installGrid(card,key){
    const marker=`${key.year}-${key.q}`,prompt=card.querySelector('.prompt');if(!prompt)return null;
    let grid=card.querySelector('.machine-study-grid');
    if(grid?.dataset.key===marker)return grid;
    grid?.remove();
    grid=document.createElement('div');grid.className='machine-study-grid';grid.dataset.key=marker;
    const left=document.createElement('div');left.className='machine-problem-pane';const panel=document.createElement('section');panel.className='figure-panel';
    prompt.parentNode.insertBefore(grid,prompt);left.appendChild(prompt);grid.append(left,panel);card.querySelector('.figure-note')?.remove();return grid;
  }
  async function renderPanel(){
    const card=document.querySelector('.qcard'),key=currentKey();if(!card||!key)return;
    const grid=installGrid(card,key);if(!grid)return;const panel=grid.querySelector('.figure-panel');
    const assetName=ASSETS[`${key.year}|${key.q}`],source=SOURCES[key.year],pages=source?.pages?.[key.q]||[];
    if(!assetName){
      if(panel.dataset.state==='none')return;panel.dataset.state='none';
      panel.innerHTML=`<h3>原問題資料</h3><p class="fig-note">この問題には切り出し対象の図表がありません。</p><div class="figure-actions">${pages.map(p=>`<a class="figure-open" target="_blank" rel="noopener noreferrer" href="${pageUrl(source.url,p)}">原問題 p.${p}</a>`).join('')}</div>`;return;
    }
    if(panel.dataset.asset===String(assetName)&&(panel.dataset.state==='loading'||panel.dataset.state==='done'))return;
    panel.dataset.asset=String(assetName);panel.dataset.state='loading';panel.innerHTML='<h3>原問題の図・表</h3><div class="figure-wait">図表を読み込んでいます…</div>';
    try{
      const src=await loadAsset(assetName);if(panel.dataset.asset!==String(assetName))return;
      const label=`${key.year} 機械安全 問${key.q} 原問題の図・表`,firstPage=pages[0]||1;panel.dataset.state='done';
      panel.innerHTML=`<h3>原問題の図・表</h3><p class="fig-note">問題資料から図・表だけを切り出しています。問題文と同時に確認できます。</p><div class="figure-image-wrap"><img class="figure-image" src="${src}" alt="${label}"></div><div class="figure-actions"><button class="figure-open" data-enlarge>大きく表示</button><a class="figure-open" target="_blank" rel="noopener noreferrer" href="${pageUrl(source.url,firstPage)}">原問題PDF</a></div>`;
      panel.querySelector('img').onclick=()=>openModal(src,label);panel.querySelector('[data-enlarge]').onclick=()=>openModal(src,label);
    }catch(e){if(panel.dataset.asset!==String(assetName))return;panel.dataset.state='error';panel.innerHTML=`<h3>原問題の図・表</h3><div class="figure-error">図表を読み込めませんでした。${String(e.message||e)}</div><div class="figure-actions">${pages.map(p=>`<a class="figure-open" target="_blank" rel="noopener noreferrer" href="${pageUrl(source.url,p)}">原問題 p.${p}</a>`).join('')}</div>`;}
  }
  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;renderPanel()})}
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});addEventListener('DOMContentLoaded',queue);queue();
})();
