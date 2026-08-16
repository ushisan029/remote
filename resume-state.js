(()=>{
  const RESUME_STORE='rouan-dojo-resume-v1';
  const WEAK_PREFIX='__manualWeak__:';
  let resumeMap={};
  try{const saved=JSON.parse(localStorage.getItem(RESUME_STORE)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))resumeMap=saved}catch{}

  const clone=v=>{try{return JSON.parse(JSON.stringify(v??{}))}catch{return {}}};
  const weakKey=id=>`${WEAK_PREFIX}${id}`;
  const isWeakKey=k=>String(k).startsWith(WEAK_PREFIX);
  const weakId=k=>String(k).slice(WEAK_PREFIX.length);
  const currentWeakSet=()=>new Set([...(state.manualWeak||new Set())]);
  let lastWeakSet=currentWeakSet();

  function resumeKey(){const year=state.mode==='past'?(state.year||'all'):'all';return `${state.subject}|${state.mode}|${year}`}
  function persist(notify=true){try{localStorage.setItem(RESUME_STORE,JSON.stringify(resumeMap))}catch{}if(notify){try{window.dispatchEvent(new CustomEvent('rouan:resume-changed'))}catch{}}}
  function sameResume(a,b){return !!a&&a.questionId===b.questionId&&a.index===b.index&&a.selected===b.selected&&a.revealed===b.revealed}

  function rememberManualWeak(forceMigration=false){
    const now=new Date().toISOString(),cur=currentWeakSet(),ids=new Set([...lastWeakSet,...cur]);let changed=false;
    for(const id of ids){
      const before=lastWeakSet.has(id),after=cur.has(id),key=weakKey(id);
      if(before!==after||(forceMigration&&after&&!resumeMap[key])){resumeMap[key]={active:after,updatedAt:now};changed=true}
    }
    lastWeakSet=cur;
    if(changed)persist(true);
  }

  function applyWeakStates(){
    const merged=currentWeakSet();
    for(const [key,value] of Object.entries(resumeMap)){
      if(!isWeakKey(key)||!value||typeof value!=='object')continue;
      const id=weakId(key);if(value.active)merged.add(id);else merged.delete(id);
    }
    state.manualWeak=merged;lastWeakSet=currentWeakSet();
  }

  function rememberCurrent(){
    rememberManualWeak(false);
    if(!state?.data||!(state.screen==='quiz'||state.screen==='weak'))return;
    const set=currentSet();if(!set.length)return;
    const pos=((state.index%set.length)+set.length)%set.length,q=set[pos];if(!q?.id)return;
    const key=resumeKey(),next={questionId:q.id,index:pos,selected:Number.isInteger(state.selected)?state.selected:null,revealed:!!state.revealed};
    if(sameResume(resumeMap[key],next))return;
    resumeMap[key]={...next,updatedAt:new Date().toISOString()};persist(true);
  }

  function restoreCurrent(){
    state.selected=null;state.revealed=false;if(!state?.data){state.index=0;return}
    const set=currentSet();if(!set.length){state.index=0;return}
    const saved=resumeMap[resumeKey()];if(!saved){state.index=0;return}
    let pos=saved.questionId?set.findIndex(q=>q.id===saved.questionId):-1;
    if(pos<0&&Number.isInteger(saved.index))pos=Math.max(0,Math.min(saved.index,set.length-1));if(pos<0)pos=0;state.index=pos;
    if(saved.questionId&&set[pos]?.id===saved.questionId){const choices=set[pos].choices||[];if(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<choices.length)state.selected=saved.selected;state.revealed=!!saved.revealed}
  }

  function mergeResume(incoming){
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return false;let changed=false;
    for(const [key,value] of Object.entries(incoming)){
      if(!value||typeof value!=='object')continue;const local=resumeMap[key],lt=Date.parse(local?.updatedAt||0)||0,rt=Date.parse(value.updatedAt||0)||0;
      if(!local||rt>lt){resumeMap[key]=clone(value);changed=true}
    }
    if(changed){applyWeakStates();persist(false)}return changed;
  }

  function replaceResume(incoming){resumeMap=(incoming&&typeof incoming==='object'&&!Array.isArray(incoming))?clone(incoming):{};applyWeakStates();persist(false)}
  function removeResume(key){const target=key||resumeKey();if(Object.prototype.hasOwnProperty.call(resumeMap,target)){delete resumeMap[target];persist(true);return true}return false}
  function clearResume(){
    const now=new Date().toISOString(),known=new Set([...lastWeakSet]);for(const key of Object.keys(resumeMap))if(isWeakKey(key))known.add(weakId(key));
    resumeMap={};for(const id of known)resumeMap[weakKey(id)]={active:false,updatedAt:now};state.manualWeak=new Set();lastWeakSet=new Set();persist(true);
  }

  rememberManualWeak(true);
  applyWeakStates();
  const originalRender=render;render=function(){rememberCurrent();return originalRender()};
  resetQuiz=function(){restoreCurrent()};
  window.addEventListener('pagehide',rememberCurrent);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')rememberCurrent()});
  window.rouanResume={remember:rememberCurrent,restore:restoreCurrent,dump(){rememberManualWeak(false);return clone(resumeMap)},merge:mergeResume,replace:replaceResume,remove:removeResume,clear:clearResume};
})();
