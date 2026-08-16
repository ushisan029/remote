(()=>{
  const RESUME_STORE='rouan-dojo-resume-v1';
  let resumeMap={};

  try{
    const saved=JSON.parse(localStorage.getItem(RESUME_STORE)||'{}');
    if(saved&&typeof saved==='object'&&!Array.isArray(saved)) resumeMap=saved;
  }catch{}

  function resumeKey(){
    const year=state.mode==='past'?(state.year||'all'):'all';
    return `${state.subject}|${state.mode}|${year}`;
  }

  function cloneMap(value=resumeMap){
    try{return JSON.parse(JSON.stringify(value||{}))}catch{return {}}
  }

  function persist(notify=true){
    try{localStorage.setItem(RESUME_STORE,JSON.stringify(resumeMap))}catch{}
    if(notify){
      try{window.dispatchEvent(new CustomEvent('rouan:resume-changed'))}catch{}
    }
  }

  function sameResume(a,b){
    if(!a||!b)return false;
    return a.questionId===b.questionId&&
      a.index===b.index&&
      a.selected===b.selected&&
      a.revealed===b.revealed;
  }

  function rememberCurrent(){
    if(!state?.data||!(state.screen==='quiz'||state.screen==='weak')) return;
    const set=currentSet();
    if(!set.length) return;
    const pos=((state.index%set.length)+set.length)%set.length;
    const q=set[pos];
    if(!q?.id) return;
    const key=resumeKey();
    const next={
      questionId:q.id,
      index:pos,
      selected:Number.isInteger(state.selected)?state.selected:null,
      revealed:!!state.revealed
    };
    if(sameResume(resumeMap[key],next)) return;
    resumeMap[key]={...next,updatedAt:new Date().toISOString()};
    persist(true);
  }

  function restoreCurrent(){
    state.selected=null;
    state.revealed=false;
    if(!state?.data){state.index=0;return}
    const set=currentSet();
    if(!set.length){state.index=0;return}

    const saved=resumeMap[resumeKey()];
    if(!saved){state.index=0;return}

    let pos=saved.questionId?set.findIndex(q=>q.id===saved.questionId):-1;
    if(pos<0&&Number.isInteger(saved.index)){
      pos=Math.max(0,Math.min(saved.index,set.length-1));
    }
    if(pos<0) pos=0;
    state.index=pos;

    if(saved.questionId&&set[pos]?.id===saved.questionId){
      const choices=set[pos].choices||[];
      if(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<choices.length){
        state.selected=saved.selected;
      }
      state.revealed=!!saved.revealed;
    }
  }

  function mergeResume(incoming){
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming)) return false;
    let changed=false;
    for(const [key,value] of Object.entries(incoming)){
      if(!value||typeof value!=='object') continue;
      const local=resumeMap[key];
      const localTime=Date.parse(local?.updatedAt||0)||0;
      const remoteTime=Date.parse(value.updatedAt||0)||0;
      if(!local||remoteTime>localTime){
        resumeMap[key]=cloneMap(value);
        changed=true;
      }
    }
    if(changed) persist(false);
    return changed;
  }

  function replaceResume(incoming){
    resumeMap=(incoming&&typeof incoming==='object'&&!Array.isArray(incoming))?cloneMap(incoming):{};
    persist(false);
  }

  function removeResume(key){
    const target=key||resumeKey();
    if(Object.prototype.hasOwnProperty.call(resumeMap,target)){
      delete resumeMap[target];
      persist(true);
      return true;
    }
    return false;
  }

  const originalRender=render;
  render=function(){
    rememberCurrent();
    return originalRender();
  };

  resetQuiz=function(){restoreCurrent()};

  window.addEventListener('pagehide',rememberCurrent);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden') rememberCurrent();
  });

  window.rouanResume={
    remember:rememberCurrent,
    restore:restoreCurrent,
    dump(){return cloneMap()},
    merge:mergeResume,
    replace:replaceResume,
    remove:removeResume,
    clear(){resumeMap={};persist(true)}
  };
})();
