(()=>{
  const SOURCES={
    '令和4年度':{url:'https://www.exam.or.jp/CS_r041/CS20221903.pdf',legacy:true,pages:{1:[1,2],2:[3,4],3:[5,6],4:[7]}},
    '令和5年度':{url:'https://www.exam.or.jp/CS_r051/CS20231903.pdf',legacy:true,pages:{1:[1],2:[2],3:[3,4],4:[5,6]}},
    '令和6年度':{url:'https://www.exam.or.jp/wp-content/uploads/2024/12/CS20241903.pdf',pages:{1:[1,2],2:[3],3:[4,5],4:[6,7]}},
    '令和7年度':{url:'https://www.exam.or.jp/wp-content/uploads/2025/11/CS20251903.pdf',pages:{1:[1,2],2:[3],3:[4],4:[5,6]}}
  };

  const style=document.createElement('style');
  style.textContent=`
    .figure-panel{margin:18px 0;padding:14px;border:1px solid #d9e4e2;border-radius:16px;background:#f8fbfa}
    .figure-panel h3{margin:0 0 5px;font-size:16px}.figure-panel .fig-note{font-size:12px;color:#62706d;margin-bottom:10px}
    .figure-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}.figure-tabs button,.figure-open{border:1px solid #b8ccc8;background:white;border-radius:10px;padding:8px 11px;font-weight:700;color:#245b54}
    .figure-tabs button.active{background:#0f766e;color:white;border-color:#0f766e}
    .figure-frame-wrap{overflow:hidden;border-radius:12px;border:1px solid #ccd9d6;background:white;position:relative}
    .figure-frame{display:block;width:100%;height:430px;border:0;background:white}
    .figure-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.figure-actions a{text-decoration:none}
    .figure-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.78);display:flex;flex-direction:column;padding:max(10px,env(safe-area-inset-top)) 8px max(10px,env(safe-area-inset-bottom))}
    .figure-modal-head{display:flex;justify-content:space-between;align-items:center;color:white;padding:4px 5px 10px;font-weight:700}
    .figure-modal-close{border:0;border-radius:999px;background:white;color:#222;padding:8px 13px;font-weight:800}
    .figure-modal iframe{flex:1;width:100%;border:0;border-radius:10px;background:white;touch-action:pinch-zoom}
    @media(max-width:640px){.figure-frame{height:360px}}
  `;
  document.head.appendChild(style);

  function currentKey(){
    const meta=document.querySelector('.qcard .qmeta');
    if(!meta) return null;
    const text=meta.textContent||'';
    const y=text.match(/令和[4-7]年度/)?.[0];
    const q=text.match(/問\s*(\d+)/)?.[1];
    if(!y||!q) return null;
    return {year:y,q:Number(q)};
  }
  const pageUrl=(url,p)=>`${url}#page=${p}&zoom=page-width`;

  function openModal(src,label){
    const old=document.querySelector('.figure-modal'); if(old) old.remove();
    const m=document.createElement('div');m.className='figure-modal';
    m.innerHTML=`<div class="figure-modal-head"><span>${label}</span><button class="figure-modal-close">閉じる</button></div><iframe src="${src}" title="${label}"></iframe>`;
    m.querySelector('.figure-modal-close').onclick=()=>m.remove();
    m.addEventListener('click',e=>{if(e.target===m)m.remove()});
    document.body.appendChild(m);
  }

  function renderPanel(){
    const card=document.querySelector('.qcard');
    const key=currentKey();
    if(!card||!key) return;
    const src=SOURCES[key.year];
    if(!src||!src.pages[key.q]) return;
    const marker=`${key.year}-${key.q}`;
    if(card.querySelector(`.figure-panel[data-key="${marker}"]`)) return;
    card.querySelector('.figure-panel')?.remove();
    card.querySelector('.figure-note')?.remove();
    const pages=src.pages[key.q];
    let active=pages[0];
    const panel=document.createElement('section');panel.className='figure-panel';panel.dataset.key=marker;
    panel.innerHTML=`<h3>原問題の図・表</h3><div class="fig-note">安全衛生技術試験協会の原問題PDFを表示します。細部は「大きく表示」で確認できます。${src.legacy?' 旧年度PDFのため、協会側のURL変更時は表示できない場合があります。':''}</div><div class="figure-tabs">${pages.map((p,i)=>`<button data-page="${p}" class="${i===0?'active':''}">原問題 p.${p}</button>`).join('')}</div><div class="figure-frame-wrap"><iframe class="figure-frame" loading="lazy" title="${marker} 原問題" src="${pageUrl(src.url,active)}"></iframe></div><div class="figure-actions"><button class="figure-open">大きく表示</button><a class="figure-open" target="_blank" rel="noopener noreferrer" href="${pageUrl(src.url,active)}">PDFを別画面で開く</a></div>`;
    const anchor=card.querySelector('.prompt');
    anchor?.insertAdjacentElement('afterend',panel);
    const frame=panel.querySelector('.figure-frame'), open=panel.querySelector('.figure-open'), link=panel.querySelector('a.figure-open');
    panel.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{
      active=Number(b.dataset.page);panel.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===b));
      const u=pageUrl(src.url,active);frame.src=u;link.href=u;
    });
    open.onclick=()=>openModal(pageUrl(src.url,active),`${key.year} 機械安全 問${key.q} - 原問題 p.${active}`);
  }
  new MutationObserver(renderPanel).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('DOMContentLoaded',renderPanel);
})();
