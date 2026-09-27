(()=>{
  const WEBLLM_URL='https://esm.run/@mlc-ai/web-llm@0.2.85';
  const MODEL_KEY='rouan-local-llm-model-v1';
  const DEFAULT_MODEL='Llama-3.2-1B-Instruct-q4f16_1-MLC';
  const MODELS=[
    {id:'Llama-3.2-1B-Instruct-q4f16_1-MLC',label:'Llama 3.2 1B（軽量・推奨）',vram:'約879MB'},
    {id:'Llama-3.2-3B-Instruct-q4f16_1-MLC',label:'Llama 3.2 3B（高品質・重め）',vram:'約2.3GB'}
  ];
  const SUBJECTS=new Set(['industrial_general','industrial_law','machine_safety']);
  const MODES=new Set(['weak','past','prediction']);
  let engine=null;
  let loadedModel='';
  let loadPromise=null;
  let generationInFlight=false;

  const style=document.createElement('style');
  style.textContent=`
    .local-llm-status{margin-top:8px;font-size:12px;color:#62706d;line-height:1.55}
    .local-llm-progress{margin:12px 0;padding:12px;border-radius:12px;background:#f6faf9;line-height:1.6}
    .local-llm-progress progress{width:100%;height:14px;margin-top:8px}
    .local-llm-note{margin:10px 0;padding:10px 12px;border-radius:10px;background:#fff8e8;color:#6d5520;font-size:13px;line-height:1.6}
    .local-llm-setting select{width:min(520px,100%);box-sizing:border-box;padding:10px;border:1px solid #cbd8d5;border-radius:10px;margin-top:8px;background:#fff}
    .local-llm-setting .mini{line-height:1.55}
  `;
  document.head.appendChild(style);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const selectedModelId=()=>localStorage.getItem(MODEL_KEY)||DEFAULT_MODEL;
  const selectedModel=()=>MODELS.find(x=>x.id===selectedModelId())||MODELS[0];
  const subjectLabel=id=>typeof state!=='undefined'&&state?.data?.SUBJECTS?.find(s=>s.id===id)?.label||id;

  function compactSummary(){
    const questions=typeof qs==='function'?qs():[];
    const qmap=new Map(questions.map(q=>[q.id,q]));
    const subjects=(typeof state!=='undefined'&&state?.data?.SUBJECTS||[]).map(s=>{
      const p=typeof progress==='function'?progress(s.id):{};
      return {id:s.id,total:p.total||0,answered:p.answered||0,accuracy:p.accuracy,recentAccuracy:p.recent,weak:p.weak||0,pastAnswered:p.pastAnswered||0,pastTotal:p.pastTotal||0,predAnswered:p.predAnswered||0,predTotal:p.predTotal||0};
    });
    const weakQuestions=questions.filter(q=>typeof weak==='function'&&weak(q.id)).map(q=>{
      const s=typeof statsFor==='function'?statsFor(q.id):{};
      return {id:q.id,subject:q.subject,attempts:s.n||0,accuracy:s.accuracy};
    }).slice(0,12);
    const hardQuestions=questions.map(q=>{
      const s=typeof statsFor==='function'?statsFor(q.id):{n:0};
      return s.n?{id:q.id,subject:q.subject,attempts:s.n,accuracy:s.accuracy}:null;
    }).filter(Boolean).sort((a,b)=>(a.accuracy??101)-(b.accuracy??101)||b.attempts-a.attempts).slice(0,10);
    const recent=(typeof state!=='undefined'&&state?.attempts||[]).slice(-12).reverse().map(a=>{
      const q=qmap.get(a.questionId);
      return {questionId:a.questionId,subject:q?.subject||null,correct:Boolean(a.correct)};
    });
    return {overall:typeof overall==='function'?overall():{},subjects,weakQuestions,hardQuestions,recent};
  }

  function modal(title){
    document.querySelector('.ai-modal')?.remove();
    const root=document.createElement('div');root.className='ai-modal';
    root.innerHTML=`<section class="ai-modal-panel" role="dialog" aria-modal="true"><div class="ai-modal-head"><h2>${esc(title)}</h2><button type="button" class="ai-close">閉じる</button></div><div class="ai-modal-body"></div></section>`;
    root.querySelector('.ai-close').onclick=()=>root.remove();
    root.addEventListener('click',e=>{if(e.target===root)root.remove()});
    document.body.appendChild(root);return root.querySelector('.ai-modal-body');
  }

  function startPlan(item){
    if(!item?.subject||typeof state==='undefined'||!state?.data?.SUBJECTS?.some(s=>s.id===item.subject))return;
    state.subject=item.subject;
    state.mode=MODES.has(item.mode)?item.mode:'weak';
    state.year='all';state.index=0;state.selected=null;state.revealed=false;state.screen='quiz';
    if(typeof render==='function')render();document.querySelector('.ai-modal')?.remove();
  }

  function normalizeResult(raw){
    if(!raw||typeof raw!=='object')return null;
    const priorities=Array.isArray(raw.priorities)?raw.priorities.filter(x=>x&&SUBJECTS.has(x.subject)).slice(0,3).map(x=>({subject:x.subject,reason:String(x.reason||'').slice(0,240)})):[];
    const plan=[];let remaining=10;
    for(const x of Array.isArray(raw.plan)?raw.plan:[]){
      if(!x||!SUBJECTS.has(x.subject)||!MODES.has(x.mode)||remaining<=0)continue;
      const count=Math.min(remaining,Math.max(1,Number(x.count)||1));remaining-=count;
      plan.push({subject:x.subject,mode:x.mode,count,reason:String(x.reason||'').slice(0,240)});
      if(plan.length>=3)break;
    }
    if(!plan.length)return null;
    return {summary:String(raw.summary||'').slice(0,900),priorities,plan,message:String(raw.message||'').slice(0,400)};
  }

  function parseJson(text){
    const cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
    try{return JSON.parse(cleaned)}catch(_){}
    const first=cleaned.indexOf('{'),last=cleaned.lastIndexOf('}');
    if(first>=0&&last>first){try{return JSON.parse(cleaned.slice(first,last+1))}catch(_){}}
    return null;
  }

  function renderPlan(body,result,model,usage){
    body.innerHTML='';
    const source=document.createElement('div');source.className='ai-source';source.textContent=`端末内AI・${model.label}`;body.appendChild(source);
    const summary=document.createElement('div');summary.className='ai-summary';summary.textContent=result.summary||'端末内AIが学習メニューを作成しました。';body.appendChild(summary);
    if(result.priorities.length){
      const box=document.createElement('div');box.className='ai-priority';box.innerHTML='<h3>優先ポイント</h3>';
      const ul=document.createElement('ul');result.priorities.forEach(x=>{const li=document.createElement('li');li.textContent=`${subjectLabel(x.subject)}：${x.reason}`;ul.appendChild(li)});box.appendChild(ul);body.appendChild(box);
    }
    const box=document.createElement('div');box.className='ai-plan';box.innerHTML='<h3>今日の学習メニュー</h3>';
    result.plan.forEach(item=>{
      const row=document.createElement('div');row.className='ai-plan-item';
      const h=document.createElement('h4');h.textContent=`${subjectLabel(item.subject)}・${item.count}問`;row.appendChild(h);
      const p=document.createElement('p');p.textContent=item.reason;row.appendChild(p);
      const actions=document.createElement('div');actions.className='ai-plan-actions';
      const b=document.createElement('button');b.type='button';b.className='primary';b.textContent='この条件で始める';b.onclick=()=>startPlan(item);actions.appendChild(b);row.appendChild(actions);box.appendChild(row);
    });body.appendChild(box);
    if(result.message){const p=document.createElement('p');p.className='mini';p.textContent=result.message;body.appendChild(p)}
    const note=document.createElement('div');note.className='ai-usage';
    const total=usage?.total_tokens??usage?.totalTokens;
    note.textContent=`API料金0円・学習統計は端末内で推論${Number.isFinite(Number(total))?`・今回 ${Number(total).toLocaleString()} tokens`:''}`;body.appendChild(note);
  }

  function renderFallback(body,message){
    body.innerHTML=`<div class="ai-error">${esc(message)}</div>`;
    const actions=document.createElement('div');actions.className='ai-coach-actions';actions.style.marginTop='12px';
    const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='通常の無料おすすめへ';
    b.onclick=()=>{document.querySelector('.ai-modal')?.remove();document.querySelector('[data-local-run]')?.click()};actions.appendChild(b);body.appendChild(actions);
  }

  async function webGpuAvailable(){
    if(!('gpu'in navigator))return false;
    try{return Boolean(await navigator.gpu.requestAdapter())}catch{return false}
  }

  async function ensureEngine(progressBox){
    const model=selectedModel();
    if(engine&&loadedModel===model.id)return engine;
    if(loadPromise)return loadPromise;
    loadPromise=(async()=>{
      if(!await webGpuAvailable())throw new Error('この端末またはブラウザではWebGPUを利用できません。');
      const status=progressBox.querySelector('[data-local-llm-progress-text]');
      const bar=progressBox.querySelector('progress');
      status.textContent='WebLLMを読み込んでいます…';
      const webllm=await import(WEBLLM_URL);
      if(engine&&typeof engine.unload==='function'){try{await engine.unload()}catch(_){}}
      engine=null;loadedModel='';
      engine=await webllm.CreateMLCEngine(model.id,{
        logLevel:'WARN',
        initProgressCallback:report=>{
          const pct=Number.isFinite(Number(report?.progress))?Math.max(0,Math.min(100,Math.round(Number(report.progress)*100))):null;
          status.textContent=`${report?.text||'モデルを準備しています…'}${pct===null?'':` (${pct}%)`}`;
          if(pct!==null)bar.value=pct;
        }
      },{context_window_size:2048});
      loadedModel=model.id;status.textContent='モデル準備完了';bar.value=100;return engine;
    })();
    try{return await loadPromise}finally{loadPromise=null}
  }

  async function generatePlan(body){
    if(generationInFlight){renderFallback(body,'端末内AIを実行中です。');return}
    generationInFlight=true;document.querySelectorAll('[data-local-llm-run]').forEach(b=>b.disabled=true);
    const model=selectedModel();
    body.innerHTML=`<div class="local-llm-progress"><b>端末内AIを準備中</b><div data-local-llm-progress-text>確認しています…</div><progress max="100" value="0"></progress></div>`;
    const progressBox=body.querySelector('.local-llm-progress');
    try{
      const localEngine=await ensureEngine(progressBox);
      progressBox.querySelector('[data-local-llm-progress-text]').textContent='学習履歴を端末内で分析しています…';
      const summary=compactSummary();
      const system='あなたは労働安全コンサルタント試験の学習コーチです。与えられた学習統計だけを根拠に、日本語で今日の学習計画を作ってください。法令や問題内容を推測・創作しないでください。苦手、低正答率、直近誤答、未回答を優先してください。JSONだけを返してください。subjectは industrial_general / industrial_law / machine_safety、modeは weak / past / prediction のみ。planは合計10問以内、最大3項目です。JSON形式は {"summary":"所見","priorities":[{"subject":"...","reason":"..."}],"plan":[{"subject":"...","mode":"...","count":3,"reason":"..."}],"message":"短い助言"} です。';
      const request={messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(summary)}],temperature:0.15,top_p:0.9,max_tokens:420,stream:false,response_format:{type:'json_object'}};
      let reply;
      try{reply=await localEngine.chat.completions.create(request)}catch(_){const fallback={...request};delete fallback.response_format;reply=await localEngine.chat.completions.create(fallback)}
      const text=reply?.choices?.[0]?.message?.content||'';
      const result=normalizeResult(parseJson(text));
      if(!result)throw new Error('端末内AIの結果を学習メニューとして読み取れませんでした。軽量モデルではまれに起こるため、通常の無料おすすめを利用できます。');
      renderPlan(body,result,model,reply?.usage);
    }catch(e){renderFallback(body,e?.message||String(e))}
    finally{generationInFlight=false;document.querySelectorAll('[data-local-llm-run]').forEach(b=>b.disabled=false)}
  }

  async function runBrowserCoach(){
    const body=modal('端末内AI学習コーチ');
    if(!('gpu'in navigator)){renderFallback(body,'このブラウザはWebGPUに対応していないため、端末内LLMを実行できません。');return}
    const model=selectedModel();
    if(engine&&loadedModel===model.id){await generatePlan(body);return}
    body.innerHTML=`<div class="ai-summary">モデル：${esc(model.label)}（必要VRAM目安 ${esc(model.vram)}）</div><div class="local-llm-note">初回はWebLLM本体とAIモデルをインターネットから取得します。取得後の学習統計の推論はブラウザ内で行い、OpenAI API料金はかかりません。端末の空きメモリやブラウザによっては動作しない場合があります。</div><div class="ai-coach-actions"><button type="button" class="primary" data-local-llm-start>モデルを読み込んで分析</button></div>`;
    body.querySelector('[data-local-llm-start]').onclick=()=>generatePlan(body);
  }

  function injectHome(){
    const card=document.querySelector('.ai-coach-card'),actions=card?.querySelector('.ai-coach-actions');
    if(!card||!actions||actions.querySelector('[data-local-llm-run]'))return;
    const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.localLlmRun='1';b.textContent='端末内AI（無料）';b.onclick=runBrowserCoach;
    const cloud=actions.querySelector('[data-ai-run]');actions.insertBefore(b,cloud||null);
    const status=document.createElement('div');status.className='local-llm-status';status.textContent=`端末内AI：${'gpu'in navigator?'WebGPU候補あり':'WebGPU非対応'}・${selectedModel().label}`;card.appendChild(status);
  }

  function injectSettings(){
    const settings=document.querySelector('.settings');if(!settings||settings.querySelector('.local-llm-setting'))return;
    const row=document.createElement('div');row.className='setting-row local-llm-setting';
    const left=document.createElement('div');left.innerHTML='<b>端末内AI（WebLLM）</b><div class="mini">APIキー不要・API料金0円。初回のみモデル取得が必要です。</div>';
    const select=document.createElement('select');MODELS.forEach(m=>{const o=document.createElement('option');o.value=m.id;o.textContent=`${m.label} / VRAM ${m.vram}`;select.appendChild(o)});select.value=selectedModel().id;left.appendChild(select);
    const status=document.createElement('div');status.className='local-llm-status';status.textContent='WebGPUを確認できます。';left.appendChild(status);
    const buttons=document.createElement('div');buttons.className='ai-endpoint-buttons';
    const save=document.createElement('button');save.type='button';save.className='secondary';save.textContent='保存';save.onclick=()=>{localStorage.setItem(MODEL_KEY,select.value);save.textContent='保存済み';document.querySelector('.local-llm-status')?.remove();setTimeout(()=>save.textContent='保存',1200)};
    const test=document.createElement('button');test.type='button';test.className='secondary';test.textContent='WebGPU確認';test.onclick=async()=>{status.textContent='確認中…';status.textContent=await webGpuAvailable()?'WebGPU利用可能です。端末内AIを試せます。':'WebGPUを利用できません。この端末では通常の無料おすすめまたはクラウドAIを利用してください。'};
    buttons.append(save,test);row.append(left,buttons);settings.prepend(row);
  }

  let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;injectHome();injectSettings()})}
  new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true});addEventListener('DOMContentLoaded',queue);queue();
})();
