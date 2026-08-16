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

  function persist(){
    try{localStorage.setItem(RESUME_STORE,JSON.stringify(resumeMap))}catch{}
  }

  function rememberCurrent(){
    if(!state?.data||!(state.screen==='quiz'||state.screen==='weak')) return;
    const set=currentSet();
    if(!set.length) return;
    const pos=((state.index%set.length)+set.length)%set.length;
    const q=set[pos];
    if(!q?.id) return;
    resumeMap[resumeKey()]={
      questionId:q.id,
      index:pos,
      selected:Number.isInteger(state.selected)?state.selected:null,
      revealed:!!state.revealed,
      updatedAt:new Date().toISOString()
    };
    persist();
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

    // Restore the result screen only when the saved question itself still exists.
    if(saved.questionId&&set[pos]?.id===saved.questionId){
      const choices=set[pos].choices||[];
      if(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<choices.length){
        state.selected=saved.selected;
      }
      state.revealed=!!saved.revealed;
    }
  }

  const originalRender=render;
  render=function(){
    rememberCurrent();
    return originalRender();
  };

  // Existing handlers call resetQuiz() after changing subject/year/mode.
  // Change its meaning from "go to question 1" to "restore this condition's last position".
  resetQuiz=function(){restoreCurrent()};

  // Extra safety for closing Safari / Home Screen PWA directly.
  window.addEventListener('pagehide',rememberCurrent);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden') rememberCurrent();
  });

  window.rouanResume={
    remember:rememberCurrent,
    restore:restoreCurrent,
    clear(){resumeMap={};persist()}
  };
})();
