(()=>{
  const SOURCES={
    '令和4年度':{url:'https://www.exam.or.jp/CS_r041/CS20221903.pdf',legacy:true,pages:{1:[1,2],2:[3,4],3:[5,6],4:[7]}},
    '令和5年度':{url:'https://www.exam.or.jp/CS_r051/CS20231903.pdf',legacy:true,pages:{1:[1],2:[2],3:[3,4],4:[5,6]}},
    '令和6年度':{url:'https://www.exam.or.jp/wp-content/uploads/2024/12/CS20241903.pdf',pages:{1:[1,2],2:[3],3:[4,5],4:[6,7]}},
    '令和7年度':{url:'https://www.exam.or.jp/wp-content/uploads/2025/11/CS20251903.pdf',pages:{1:[1,2],2:[3],3:[4],4:[5,6]}}
  };

  const style=document.createElement('style');
  style.textContent=`
    .machine-question-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,46%);gap:18px;align-items:start;margin:14px 0 18px}
    .machine-question-text{min-width:0}
    .machine-question-text .prompt{margin-top:0}
    .machine-question-figure{min-width:0;position:sticky;top:12px;align-self:start}
    .figure-panel{margin:0;padding:14px;border:1px solid #d9e4e2;border-radius:16px;background:#f8fbfa}
    .figure-panel h3{margin:0 0 5px;font-size:16px}
    .figure-panel .fig-note{font-size:12px;color:#62706d;margin-bottom:10px}
    .figure-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}
    .figure-tabs button,.figure-open{border:1px solid #b8ccc8;background:white;border-radius:10px;padding:8px 11px;font-weight:700;color:#245b54}
    .figure-tabs button.active{background:#0f766e;color:white;border-color:#0f766e}
    .figure-frame-wrap{overflow:hidden;border-radius:12px;border:1px solid #ccd9d6;background:white}
    .figure-frame{display:block;width:100%;height:520px;border:0;background:white}
    .figure-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .figure-actions a{text-decoration:none}
    .figure-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.78);display:flex;flex-direction:column;padding:max(10px,env(safe-area-inset-top)) 8px max(10px,env(safe-area-inset-bottom))}
    .figure-modal-head{display:flex;justify-content:space-between;align-items:center;color:white;padding:4px 5px 10px;font-weight:700}
    .figure-modal-close{border:0;border-radius:999px;background:white;color:#222;padding:8px 13px;font-weight:800}
    .figure-modal iframe{flex:1;width:100%;border:0;border-radius:10px;background:white;touch-action:pinch-zoom}
    @media(max-width:900px){
      .machine-question-split{grid-template-columns:minmax(0,1fr) minmax(320px,44%);gap:12px}
      .figure-frame{height:430px}
    }
    @media(max-width:720px){
      .machine-question-split{display:block;margin:12px 0 18px}
      .machine-question-figure{position:static;margin-top:12px}
      .figure-frame{height:360px}
    }
  `;
  document.head.appendChild(style);

  const pageUrl=(url,p)=>`${url}#page=${p}&zoom=page-width`;

  function currentKey(){
    if(document.querySelector('#subjectSel')?.value!=='machine_safety')return null;
    const meta=document.querySelector('.qcard .qmeta');
    if(!meta)return null;
    const text=meta.textContent||'';
    const year=text.match(/令和[4-7]年度/)?.[0];
    const q=text.match(/問\s*(\d+)/)?.[1];
    return year&&q?{year,q:Number(q)}:null;
  }

  function openModal(src,label){
    document.querySelector('.figure-modal')?.remove();
    const m=document.createElement('div');
    m.className='figure-modal';
    m.innerHTML=`<div class="figure-modal-head"><span>${label}</span><button class="figure-modal-close">閉じる</button></div><iframe src="${src}" title="${label}"></iframe>`;
    m.querySelector('button').onclick=()=>m.remove();
    m.addEventListener('click',e=>{if(e.target===m)m.remove()});
    document.body.appendChild(m);
  }

  function makeSplit(card,prompt,panel){
    let split=card.querySelector('.machine-question-split');
    if(!split){
      split=document.createElement('div');
      split.className='machine-question-split';
      const text=document.createElement('div');
      text.className='machine-question-text';
      const figure=document.createElement('div');
      figure.className='machine-question-figure';
      split.append(text,figure);
      prompt.insertAdjacentElement('beforebegin',split);
      text.appendChild(prompt);
    }
    split.querySelector('.machine-question-figure')?.appendChild(panel);
  }

  function renderPanel(){
    const card=document.querySelector('.qcard');
    const key=currentKey();
    if(!card||!key)return;
    const src=SOURCES[key.year];
    if(!src||!src.pages[key.q])return;
    const marker=`${key.year}-${key.q}`;
    if(card.querySelector(`.figure-panel[data-key="${marker}"]`))return;

    card.querySelector('.figure-panel')?.remove();
    card.querySelector('.figure-note')?.remove();
    const prompt=card.querySelector('.prompt');
    if(!prompt)return;

    const pages=src.pages[key.q];
    let active=pages[0];
    const panel=document.createElement('section');
    panel.className='figure-panel';
    panel.dataset.key=marker;
    panel.innerHTML=`<h3>原問題の図・表</h3><div class="fig-note">問題文を見ながら図表を確認できます。細部は「大きく表示」で確認してください。${src.legacy?' 旧年度PDFのため協会側のURL変更時は表示できない場合があります。':''}</div><div class="figure-tabs">${pages.map((p,i)=>`<button data-page="${p}" class="${i===0?'active':''}">原問題 p.${p}</button>`).join('')}</div><div class="figure-frame-wrap"><iframe class="figure-frame" loading="lazy" title="${marker} 原問題" src="${pageUrl(src.url,active)}"></iframe></div><div class="figure-actions"><button class="figure-open">大きく表示</button><a class="figure-open" target="_blank" rel="noopener noreferrer" href="${pageUrl(src.url,active)}">PDFを別画面で開く</a></div>`;

    makeSplit(card,prompt,panel);

    const frame=panel.querySelector('iframe');
    const open=panel.querySelector('button.figure-open');
    const link=panel.querySelector('a.figure-open');
    panel.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{
      active=Number(b.dataset.page);
      panel.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x===b));
      const u=pageUrl(src.url,active);
      frame.src=u;
      link.href=u;
    });
    open.onclick=()=>openModal(pageUrl(src.url,active),`${key.year} 機械安全 問${key.q} - 原問題 p.${active}`);
  }

  new MutationObserver(renderPanel).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('DOMContentLoaded',renderPanel);
})();
