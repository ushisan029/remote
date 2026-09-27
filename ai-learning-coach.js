(()=>{
  const ENDPOINT_KEY='rouan-ai-endpoint-v1';
  const LAST_RESULT_KEY='rouan-ai-last-result-v1';

  const style=document.createElement('style');
  style.textContent=`
    .ai-coach-card{margin:18px 0;padding:18px;border:1px solid #c9ded9;border-radius:18px;background:linear-gradient(135deg,#f1fbf8,#f8fbff)}
    .ai-coach-card h2{margin:0 0 6px;font-size:20px}.ai-coach-card p{margin:0 0 14px;color:#536662;line-height:1.65}
    .ai-coach-actions{display:flex;gap:10px;flex-wrap:wrap}.ai-coach-status{margin-top:10px;font-size:12px;color:#62706d}
    .ai-modal{position:fixed;inset:0;z-index:11000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px}
    .ai-modal-panel{width:min(720px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
    .ai-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.ai-modal-head h2{margin:0;font-size:20px}
    .ai-close{border:0;border-radius:999px;background:#eef3f2;padding:8px 12px;font-weight:800}.ai-loading{padding:24px 6px;text-align:center;color:#62706d}
    .ai-summary{padding:12px;border-radius:12px;background:#f6faf9;line-height:1.7}.ai-priority,.ai-plan{margin-top:16px}.ai-plan-item{padding:12px 0;border-top:1px solid #e4ecea}.ai-plan-item:first-child{border-top:0}
    .ai-plan-item h4{margin:0 0 5px}.ai-plan-item p{margin:0 0 8px;color:#536662;line-height:1.55}.ai-plan-actions{display:flex;gap:8px;flex-wrap:wrap}
    .ai-error{padding:12px;border-radius:12px;background:#fff1ef;color:#93261a;line-height:1.65}
    .ai-endpoint-setting input{width:min(520px,100%);box-sizing:border-box;padding:10px;border:1px solid #cbd8d5;border-radius:10px;margin-top:8px}
    @media(min-width:760px){.ai-modal{align-items:center}.ai-modal-panel{border-radius:22px}}
  `;
  document.head.appendChild(style);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const endpoint=()=>String(localStorage.getItem(ENDPOINT_KEY)||window.ROUAN_AI_ENDPOINT||'').trim();
  const subjectLabel=id=>state?.data?.SUBJECTS?.find(s=>s.id===id)?.label||id;

  function buildSummary(){
    const questions=typeof qs==='function'?qs():[];
    const qmap=new Map(questions.map(q=>[q.id,q]));
    const subjects=(state?.data?.SUBJECTS||[]).map(s=>{
      const p=typeof progress==='function'?progress(s.id):{};
      return {id:s.id,label:s.label,total:p.total||0,answered:p.answered||0,progress:p.progress||0,accuracy:p.accuracy,recentAccuracy:p.recent,weak:p.weak||0,pastAnswered:p.pastAnswered||0,pastTotal:p.pastTotal||0,predAnswered:p.predAnswered||0,predTotal:p.predTotal||0};
    });
    const weakQuestions=questions.filter(q=>typeof weak==='function'&&weak(q.id)).map(q=>{
      const s=typeof statsFor==='function'?statsFor(q.id):{};
      return {id:q.id,subject:q.subject,title:q.title,year:q.yearLabel||null,questionNo:q.questionNo||null,attempts:s.n||0,accuracy:s.accuracy};
    }).slice(0,25);
    const hardQuestions=questions.map(q=>{
      const s=typeof statsFor==='function'?statsFor(q.id):{n:0};
      return s.n?{id:q.id,subject:q.subject,title:q.title,year:q.yearLabel||null,questionNo:q.questionNo||null,attempts:s.n,accuracy:s.accuracy}:null;
    }).filter(Boolean).sort((a,b)=>(a.accuracy??101)-(b.accuracy??101)||b.attempts-a.attempts).slice(0,20);
    const recent=(state?.attempts||[]).slice(-20).reverse().map(a=>{
      const q=qmap.get(a.questionId);
      return {questionId:a.questionId,subject:q?.subject||null,title:q?.title||null,correct:Boolean(a.correct),answeredAt:a.answeredAt};
    });
    return {
      generatedAt:new Date().toISOString(),
      overall:typeof overall==='function'?overall():{},
      subjects,
      weakQuestions,
      hardQuestions,
      recent
    };
  }

  function modal(title){
    document.querySelector('.ai-modal')?.remove();
    const root=document.createElement('div');root.className='ai-modal';
    root.innerHTML=`<section class="ai-modal-panel" role="dialog" aria-modal="true"><div class="ai-modal-head"><h2>${esc(title)}</h2><button type="button" class="ai-close">閉じる</button></div><div class="ai-modal-body"></div></section>`;
    root.querySelector('.ai-close').onclick=()=>root.remove();root.addEventListener('click',e=>{if(e.target===root)root.remove()});
    document.body.appendChild(root);return root.querySelector('.ai-modal-body');
  }

  function startPlan(item){
    if(!item?.subject||!state?.data?.SUBJECTS?.some(s=>s.id===item.subject))return;
    state.subject=item.subject;state.mode=['weak','past','prediction'].includes(item.mode)?item.mode:'weak';state.year='all';state.index=0;state.selected=null;state.revealed=false;state.screen='quiz';
    if(typeof render==='function')render();document.querySelector('.ai-modal')?.remove();
  }

  function renderResult(body,data){
    const result=data?.result||data||{};body.innerHTML='';
    const summary=document.createElement('div');summary.className='ai-summary';summary.textContent=result.summary||result.text||'分析結果を受け取りました。';body.appendChild(summary);
    if(Array.isArray(result.priorities)&&result.priorities.length){
      const box=document.createElement('div');box.className='ai-priority';box.innerHTML='<h3>優先ポイント</h3>';
      const ul=document.createElement('ul');result.priorities.forEach(x=>{const li=document.createElement('li');li.textContent=`${x.subject?subjectLabel(x.subject)+'：':''}${x.reason||''}`;ul.appendChild(li)});box.appendChild(ul);body.appendChild(box);
    }
    if(Array.isArray(result.plan)&&result.plan.length){
      const box=document.createElement('div');box.className='ai-plan';box.innerHTML='<h3>今日の学習メニュー</h3>';
      result.plan.forEach(item=>{
        const row=document.createElement('div');row.className='ai-plan-item';
        const h=document.createElement('h4');h.textContent=`${item.subject?subjectLabel(item.subject):'学習'}${item.count?`・${item.count}問`:''}`;row.appendChild(h);
        const p=document.createElement('p');p.textContent=item.reason||'';row.appendChild(p);
        if(item.subject){const actions=document.createElement('div');actions.className='ai-plan-actions';const b=document.createElement('button');b.type='button';b.className='primary';b.textContent='この条件で始める';b.onclick=()=>startPlan(item);actions.appendChild(b);row.appendChild(actions)}
        box.appendChild(row);
      });body.appendChild(box);
    }
    if(result.message){const p=document.createElement('p');p.className='mini';p.textContent=result.message;body.appendChild(p)}
    try{localStorage.setItem(LAST_RESULT_KEY,JSON.stringify({savedAt:new Date().toISOString(),result}))}catch(_){ }
  }

  async function runCoach(){
    const url=endpoint(),body=modal('AI学習コーチ');
    if(!url){body.innerHTML='<div class="ai-error">AIエンドポイントが未設定です。設定画面の「AI学習コーチ」でCloudflare WorkerのURLを登録してください。</div>';return}
    if(!navigator.onLine){body.innerHTML='<div class="ai-error">AI学習コーチはオンライン接続が必要です。</div>';return}
    body.innerHTML='<div class="ai-loading">学習履歴を分析しています…</div>';
    try{
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'today_plan',summary:buildSummary()})});
      const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);renderResult(body,data);
    }catch(e){body.innerHTML=`<div class="ai-error">AI学習コーチに接続できませんでした。<br>${esc(e.message||e)}</div>`}
  }

  function injectHome(){
    const content=document.querySelector('.content'),hero=content?.querySelector('.hero');if(!content||!hero||content.querySelector('.ai-coach-card'))return;
    const card=document.createElement('section');card.className='ai-coach-card';card.innerHTML=`<h2>🤖 AI学習コーチ</h2><p>正答率・苦手問題・直近の学習履歴を分析して、今日取り組む内容を提案します。</p><div class="ai-coach-actions"><button type="button" class="primary" data-ai-run>今日のおすすめを作る</button></div><div class="ai-coach-status">送信するのは学習統計と問題ID等の要約データです。OpenAI APIキーやGitHubトークンは送信しません。</div>`;
    hero.insertAdjacentElement('afterend',card);card.querySelector('[data-ai-run]').onclick=runCoach;
  }

  function injectSettings(){
    const settings=document.querySelector('.settings');if(!settings||settings.querySelector('.ai-endpoint-setting'))return;
    const row=document.createElement('div');row.className='setting-row ai-endpoint-setting';
    const left=document.createElement('div');left.innerHTML='<b>AI学習コーチ</b><div class="mini">Cloudflare Worker の /coach URL を登録します。OpenAI APIキーはここには入力しません。</div>';
    const input=document.createElement('input');input.type='url';input.placeholder='https://xxxx.workers.dev/coach';input.value=endpoint();left.appendChild(input);
    const save=document.createElement('button');save.type='button';save.className='secondary';save.textContent='保存';save.onclick=()=>{const value=input.value.trim();localStorage.setItem(ENDPOINT_KEY,value);save.textContent='保存済み';setTimeout(()=>save.textContent='保存',1200)};
    row.append(left,save);settings.prepend(row);
  }

  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;injectHome();injectSettings()})}
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});addEventListener('DOMContentLoaded',queue);queue();
})();
