(()=>{
  function isAnnualPast(){return state?.mode==='past'&&state.year&&state.year!=='all'}
  function yearResumeKey(){return `${state.subject}|past|${state.year}`}
  function position(set){return set.length?((state.index%set.length)+set.length)%set.length:0}
  function isLastQuestion(){const set=currentSet();return isAnnualPast()&&set.length>0&&position(set)===set.length-1}
  function latestAttempt(questionId){
    let latest=null;
    for(const a of state.attempts||[]){
      if(a?.questionId!==questionId)continue;
      if(!latest||String(a.answeredAt||'')>String(latest.answeredAt||''))latest=a;
    }
    return latest;
  }
  function summaryData(set){
    const rows=set.map(q=>({q,attempt:latestAttempt(q.id)}));
    const answered=rows.filter(x=>x.attempt).length;
    const correct=rows.filter(x=>x.attempt?.correct===true).length;
    const wrong=rows.filter(x=>x.attempt&&x.attempt.correct!==true);
    const unanswered=rows.filter(x=>!x.attempt);
    const ids=new Set(set.map(q=>q.id));
    const cumulative=(state.attempts||[]).filter(a=>ids.has(a.questionId));
    const cumulativeAccuracy=cumulative.length?Math.round(cumulative.filter(a=>a.correct).length/cumulative.length*100):null;
    return{rows,answered,correct,wrong,unanswered,total:set.length,accuracy:answered?Math.round(correct/answered*100):0,cumulativeAttempts:cumulative.length,cumulativeAccuracy};
  }
  function choiceText(q,index){
    if(!Number.isInteger(index)||!Array.isArray(q.choices)||index<0||index>=q.choices.length)return null;
    return `${index+1}. ${q.choices[index]}`;
  }
  function mistakeCard({q,attempt}){
    const essay=q.questionType==='essay'||!(q.choices||[]).length;
    const chosen=essay?(attempt?.correct?'できた':'要復習'):choiceText(q,attempt?.selectedIndex);
    const correct=essay?'自己採点：要復習':choiceText(q,q.correctIndex);
    const prompt=String(q.prompt||'').trim();
    const points=(q.points||[]).filter(Boolean);
    const fallback=q.explanation?`<p class="year-miss-explain">${esc(q.explanation)}</p>`:'';
    return `<article class="year-miss"><div class="year-miss-head"><span class="badge">問${esc(q.questionNo||'—')}</span><strong>${esc(q.title||'')}</strong></div>${prompt?`<div class="year-question"><div class="year-question-label">問題文</div><p>${esc(prompt)}</p></div>`:''}${chosen?`<div class="year-answer-line"><span>今回</span><b>${esc(chosen)}</b></div>`:''}${correct?`<div class="year-answer-line correct"><span>${essay?'判定':'正答'}</span><b>${esc(correct)}</b></div>`:''}<div class="year-point-title">復習ポイント</div>${points.length?`<ul>${points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:fallback}</article>`;
  }
  function summaryHtml(){
    const payload=state.yearCompletion;
    if(!payload)return '<section class="content"><div class="qcard"><h2>年度結果を表示できませんでした</h2></div></section>';
    const {set,data,year,subjectLabel}=payload;
    const weakCount=set.filter(q=>weak(q.id)).length;
    return `<section class="content year-complete"><div class="year-complete-hero"><div class="eyebrow">年度別演習 完了</div><h2>${esc(year)}　${esc(subjectLabel)}</h2><p>${data.total}問の演習結果です。</p></div><div class="year-stats"><div><span>正解</span><b>${data.correct}<small> / ${data.total}</small></b></div><div><span>誤答</span><b>${data.wrong.length}</b></div><div><span>今回の正答率</span><b>${data.accuracy}%</b></div><div><span>累計正答率</span><b>${data.cumulativeAccuracy??'—'}${data.cumulativeAccuracy!==null?'%':''}</b><small>${data.cumulativeAttempts}回答</small></div><div><span>現在の苦手</span><b>${weakCount}</b></div></div>${data.unanswered.length?`<div class="year-warning">未回答扱いの問題が ${data.unanswered.length} 問あります。統計は回答済み問題を基準にしています。</div>`:''}<div class="section-title"><h2>誤答問題のポイント</h2><p>今回間違えた問題を、次回の復習用にまとめています。</p></div>${data.wrong.length?`<div class="year-miss-list">${data.wrong.map(mistakeCard).join('')}</div>`:`<div class="year-perfect"><strong>全問正解です。</strong><p>この年度で今回の誤答はありません。</p></div>`}<div class="year-home-row"><button class="primary" id="yearSummaryHome">トップページへ戻る</button></div></section>`;
  }
  function completeYear(set=currentSet()){
    if(!isAnnualPast()||!set.length)return false;
    const subjectLabel=state.data?.SUBJECTS?.find(s=>s.id===state.subject)?.label||state.subject;
    const frozenSet=[...set];
    state.yearCompletion={set:frozenSet,data:summaryData(frozenSet),year:state.year,subject:state.subject,subjectLabel};
    window.rouanResume?.remove?.(yearResumeKey());
    state.screen='year_summary';
    state.selected=null;
    state.revealed=false;
    return true;
  }
  function injectStyle(){
    if(document.querySelector('#year-completion-style'))return;
    const style=document.createElement('style');style.id='year-completion-style';style.textContent=`.year-complete-hero{padding:20px;border-radius:18px;background:linear-gradient(135deg,#ecfdf5,#f0fdfa);margin-bottom:14px}.year-complete-hero h2{margin:4px 0 6px}.year-complete-hero p{margin:0;color:#475569}.year-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px}.year-stats>div{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:13px 10px;display:grid;gap:5px}.year-stats span{font-size:12px;color:#64748b}.year-stats b{font-size:22px}.year-stats b small{font-size:13px;font-weight:500;color:#64748b}.year-stats>div>small{font-size:11px;color:#94a3b8}.year-warning{padding:11px 13px;border-radius:10px;background:#fffbeb;margin-bottom:14px}.year-miss-list{display:grid;gap:12px}.year-miss{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:15px}.year-miss-head{display:flex;gap:8px;align-items:center;margin-bottom:10px}.year-question{margin:0 0 10px;padding:11px 12px;border-left:3px solid #0f766e;border-radius:0 10px 10px 0;background:#f8fafc}.year-question-label{margin-bottom:4px;color:#0f766e;font-size:12px;font-weight:700}.year-question p{margin:0;white-space:pre-line;overflow-wrap:anywhere;color:#334155;font-size:14px;line-height:1.65}.year-answer-line{display:grid;grid-template-columns:52px 1fr;gap:8px;padding:7px 9px;border-radius:9px;background:#fef2f2;margin-top:6px;font-size:13px}.year-answer-line.correct{background:#ecfdf5}.year-answer-line span{color:#64748b}.year-point-title{margin-top:12px;font-weight:700;font-size:13px}.year-miss ul{margin:7px 0 0;padding-left:20px}.year-miss li{margin:5px 0;line-height:1.5}.year-miss-explain{margin:7px 0 0;line-height:1.6}.year-perfect{padding:18px;border-radius:14px;background:#ecfdf5}.year-perfect p{margin:5px 0 0}.year-home-row{display:flex;justify-content:center;margin:22px 0 8px}.year-home-row button{min-width:220px}.year-complete .section-title{margin-top:20px}@media(max-width:760px){.year-stats{grid-template-columns:repeat(2,1fr)}.year-stats>div:last-child{grid-column:span 2}}`;
    document.head.appendChild(style);
  }
  const baseRender=render;
  render=function(){
    if(state.screen!=='year_summary')return baseRender();
    const app=document.querySelector('#app');
    if(!app)return;
    app.innerHTML=`<main class="shell">${head()}${summaryHtml()}${nav()}</main>`;
    bind();
    document.querySelector('#yearSummaryHome')?.addEventListener('click',()=>{
      state.yearCompletion=null;
      state.screen='home';
      state.year='all';
      state.index=0;
      state.selected=null;
      state.revealed=false;
      render();
      window.scrollTo({top:0,behavior:'smooth'});
    });
    window.scrollTo({top:0});
  };
  document.addEventListener('click',e=>{
    const next=e.target.closest?.('[data-next]');
    if(!next||!isLastQuestion())return;
    e.preventDefault();e.stopImmediatePropagation();
    if(completeYear())render();
  },true);
  const baseSelfGrade=selfGrade;
  selfGrade=function(ok){
    const set=currentSet();
    const last=isAnnualPast()&&set.length>0&&position(set)===set.length-1;
    if(!last)return baseSelfGrade(ok);
    const activeRender=render;
    render=function(){};
    try{baseSelfGrade(ok)}finally{render=activeRender}
    if(completeYear(set))render();
  };
  injectStyle();
  window.rouanYearCompletion={show:()=>{if(completeYear())render()}};
})();
