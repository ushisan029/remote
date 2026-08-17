(()=>{
  const CONFIG_STORE='rouan-dojo-github-sync-config-v3';
  const OLD_CONFIG_STORES=['rouan-dojo-github-sync-config-v2','rouan-dojo-github-sync-config-v1'];
  const TOKEN_STORE='rouan-dojo-github-sync-token-v1';
  const OLD_KEY_STORE='rouan-dojo-github-sync-key-v1';
  const META_STORE='rouan-dojo-github-sync-meta-v2';
  const DEVICE_STORE='rouan-dojo-device-id-v1';
  const DEFAULT_CONFIG={enabled:false,repository:'ushisan029/remote',branch:'main',path:'sync-data/progress.json',autoSync:true};
  const API_VERSION='2022-11-28';
  const AUTO_DELAY=30000;
  const SAVE_THRESHOLD=10;

  function load(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
  function saveJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  function now(){return new Date().toISOString()}
  function clone(v){try{return JSON.parse(JSON.stringify(v??{}))}catch{return {}}}
  function getDeviceId(){let id=localStorage.getItem(DEVICE_STORE);if(!id){id=crypto.randomUUID?.()||`device-${Date.now()}-${Math.random().toString(16).slice(2)}`;localStorage.setItem(DEVICE_STORE,id)}return id}

  let config=load(CONFIG_STORE,null);
  if(!config){
    let old=null;
    for(const key of OLD_CONFIG_STORES){old=load(key,null);if(old)break}
    config={...DEFAULT_CONFIG,...(old&&typeof old==='object'?old:{})};
    config.repository=DEFAULT_CONFIG.repository;
    config.path=DEFAULT_CONFIG.path;
    saveJson(CONFIG_STORE,config);
  }
  config={...DEFAULT_CONFIG,...(config&&typeof config==='object'?config:{})};
  if(config.repository!=='ushisan029/remote') config.repository=DEFAULT_CONFIG.repository;
  if(config.path!=='sync-data/progress.json') config.path=DEFAULT_CONFIG.path;
  saveJson(CONFIG_STORE,config);
  try{localStorage.removeItem(OLD_KEY_STORE)}catch{}

  let token=localStorage.getItem(TOKEN_STORE)||'';
  let meta=load(META_STORE,{});
  let syncTimer=null,dirtyEvents=0,syncing=false,applyingRemote=false;
  let status={kind:'idle',message:config.enabled?'未同期':'同期OFF'};
  let lastAttemptCount=Array.isArray(state.attempts)?state.attempts.length:0;
  const deviceId=getDeviceId();

  function setStatus(kind,message,rerender=false){status={kind,message};if(rerender&&state?.data&&state.screen==='settings')render()}
  function persistConfig(){saveJson(CONFIG_STORE,config)}
  function persistMeta(){saveJson(META_STORE,meta)}

  function markDirty(reason='change'){
    if(applyingRemote)return;
    if(Array.isArray(state.attempts)&&state.attempts.length<lastAttemptCount)meta.historyResetAt=now();
    lastAttemptCount=Array.isArray(state.attempts)?state.attempts.length:0;
    meta.localUpdatedAt=now();meta.dirty=true;meta.dirtyReason=reason;persistMeta();dirtyEvents++;
    if(config.enabled&&config.autoSync&&token){
      if(dirtyEvents>=SAVE_THRESHOLD){clearTimeout(syncTimer);syncTimer=null;syncNow({silent:true}).catch(()=>{})}
      else{clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow({silent:true}).catch(()=>{}),AUTO_DELAY)}
    }
  }

  const originalSave=save;
  save=function(){originalSave();markDirty('study-data')};
  const originalRestore=restore;
  restore=async function(e){await originalRestore(e);markDirty('restore')};
  window.addEventListener('rouan:resume-changed',()=>markDirty('resume-or-weak'));
  window.addEventListener('online',()=>{if(config.enabled&&config.autoSync&&token)syncNow({silent:true}).catch(()=>{})});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&config.enabled&&config.autoSync&&token&&meta.dirty)syncNow({silent:true}).catch(()=>{})});

  function apiHeaders(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':API_VERSION}}
  function parseRepo(){const parts=(config.repository||'').trim().split('/').filter(Boolean);if(parts.length!==2)throw new Error('同期先リポジトリの設定が不正です。');return{owner:parts[0],repo:parts[1]}}
  function encodedPath(path){return String(path||DEFAULT_CONFIG.path).split('/').filter(Boolean).map(encodeURIComponent).join('/')}
  function contentsUrl(){const{owner,repo}=parseRepo();return`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath(config.path)}`}
  function repoUrl(){const{owner,repo}=parseRepo();return`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
  async function responseMessage(res){try{const j=await res.clone().json();return j?.message||`${res.status} ${res.statusText}`}catch{return`${res.status} ${res.statusText}`}}

  function bytesToB64(bytes){let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
  function b64ToBytes(value){const binary=atob(String(value||'').replace(/\s/g,'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
  function textToB64(text){return bytesToB64(new TextEncoder().encode(text))}
  function b64ToText(value){return new TextDecoder().decode(b64ToBytes(value))}

  async function verifyRepo(){
    const res=await fetch(repoUrl(),{headers:apiHeaders(),cache:'no-store'});
    if(!res.ok){
      if(res.status===404)throw new Error('GitHubリポジトリを確認できません。PATの対象リポジトリに ushisan029/remote を指定してください。');
      if(res.status===401||res.status===403)throw new Error('GitHubトークンの権限を確認してください。remote リポジトリの Contents: Read and write が必要です。');
      throw new Error(await responseMessage(res));
    }
    return res.json();
  }

  function normalizedAttempts(rows){return Array.isArray(rows)?rows.filter(x=>x&&typeof x==='object'):[]}
  function attemptKey(a){return a.id||`${a.questionId||''}|${a.answeredAt||''}|${a.selectedIndex??''}|${a.assessmentType||''}`}
  function maxIso(a,b){const ta=Date.parse(a||0)||0,tb=Date.parse(b||0)||0;return ta>=tb?(a||null):(b||null)}
  function mergeTimedMap(local,remote){
    const out={};
    for(const key of new Set([...Object.keys(local||{}),...Object.keys(remote||{})])){
      const a=local?.[key],b=remote?.[key];
      if(!a){out[key]=clone(b);continue}
      if(!b){out[key]=clone(a);continue}
      out[key]=(Date.parse(b.updatedAt||0)||0)>(Date.parse(a.updatedAt||0)||0)?clone(b):clone(a);
    }
    return out;
  }
  function weakFromResume(resume,legacy=[]){
    const set=new Set(Array.isArray(legacy)?legacy:[]),prefix='__manualWeak__:';
    for(const [key,value] of Object.entries(resume||{})){
      if(!key.startsWith(prefix)||!value||typeof value!=='object')continue;
      const id=key.slice(prefix.length);if(value.active)set.add(id);else set.delete(id);
    }
    return [...set].sort();
  }
  function mergeSnapshots(local,remote){
    remote=remote&&typeof remote==='object'?remote:{};
    const resetAt=maxIso(local.historyResetAt,remote.historyResetAt),resetTime=Date.parse(resetAt||0)||0,map=new Map();
    for(const a of[...normalizedAttempts(remote.attempts),...normalizedAttempts(local.attempts)]){
      const t=Date.parse(a.answeredAt||0)||0;
      if(resetTime&&t&&t<=resetTime)continue;
      map.set(attemptKey(a),a);
    }
    const attempts=[...map.values()].sort((a,b)=>String(a.answeredAt||'').localeCompare(String(b.answeredAt||'')));
    const resume=mergeTimedMap(local.resume||{},remote.resume||{});
    const legacyWeak=[...new Set([...(Array.isArray(local.manualWeak)?local.manualWeak:[]),...(Array.isArray(remote.manualWeak)?remote.manualWeak:[])])];
    const manualWeak=weakFromResume(resume,legacyWeak);
    return{version:3,format:'rouan-dojo-progress-json-v1',app:'rouan-dojo',updatedAt:now(),deviceId,historyResetAt:resetAt,attempts,manualWeak,resume};
  }
  function localSnapshot(){
    const resume=window.rouanResume?.dump?.()||{};
    return{version:3,format:'rouan-dojo-progress-json-v1',app:'rouan-dojo',updatedAt:meta.localUpdatedAt||now(),deviceId,historyResetAt:meta.historyResetAt||null,attempts:normalizedAttempts(state.attempts),manualWeak:weakFromResume(resume,[...state.manualWeak]),resume};
  }
  function applyMerged(merged){
    applyingRemote=true;
    try{
      state.attempts=normalizedAttempts(merged.attempts);
      state.manualWeak=new Set(Array.isArray(merged.manualWeak)?merged.manualWeak:[]);
      originalSave();
      window.rouanResume?.replace?.(merged.resume||{});
      meta.historyResetAt=merged.historyResetAt||null;
      meta.localUpdatedAt=merged.updatedAt||now();
      meta.lastSyncAt=now();meta.lastError=null;meta.dirty=false;persistMeta();
      lastAttemptCount=state.attempts.length;dirtyEvents=0;
    }finally{applyingRemote=false}
  }

  async function getRemote(){
    const url=`${contentsUrl()}?ref=${encodeURIComponent(config.branch||'main')}`;
    const res=await fetch(url,{headers:apiHeaders(),cache:'no-store'});
    if(res.status===404)return{exists:false,sha:null,data:{}};
    if(!res.ok)throw new Error(await responseMessage(res));
    const item=await res.json();
    let data;
    try{data=JSON.parse(b64ToText(item.content||''))}catch{throw new Error('GitHub上の progress.json を読み込めません。JSONの内容を確認してください。')}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('GitHub上の progress.json の形式が不正です。');
    return{exists:true,sha:item.sha,data};
  }
  async function putRemote(data,sha=null){
    const body={message:`Sync study progress ${new Date().toLocaleString('ja-JP')}`,content:textToB64(JSON.stringify(data,null,2)),branch:config.branch||'main'};
    if(sha)body.sha=sha;
    const res=await fetch(contentsUrl(),{method:'PUT',headers:{...apiHeaders(),'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok){const message=await responseMessage(res),err=new Error(message);err.status=res.status;throw err}
    return res.json();
  }
  async function syncAttempt(){const remote=await getRemote(),merged=mergeSnapshots(localSnapshot(),remote.data);await putRemote(merged,remote.sha);applyMerged(merged);return merged}
  async function syncNow({silent=false}={}){
    if(syncing)return;
    if(!config.enabled){if(!silent)setStatus('warn','GitHub同期はOFFです。',true);return}
    if(!token){if(!silent)setStatus('warn','GitHubトークンを設定してください。',true);return}
    if(!navigator.onLine){setStatus('warn','オフラインです。端末には保存済みです。',!silent);return}
    syncing=true;clearTimeout(syncTimer);syncTimer=null;setStatus('working','GitHubと同期中…',!silent);
    try{
      await verifyRepo();
      try{await syncAttempt()}catch(e){if(e?.status===409||e?.status===422)await syncAttempt();else throw e}
      setStatus('ok',`同期済み ${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`,true);
    }catch(e){meta.lastError=String(e?.message||e);persistMeta();setStatus('error',String(e?.message||e),true);if(!silent)console.error(e)}finally{syncing=false}
  }

  function syncPanel(){
    const savedToken=!!token,statusClass=`gh-sync-status ${status.kind}`;
    return`<div class="setting-row gh-sync-wrap"><div style="width:100%"><b>GitHub同期</b><div class="mini">正答履歴・苦手登録・再開位置を <code>ushisan029/remote/sync-data/progress.json</code> に保存します。JSONはPublicリポジトリ上で閲覧可能です。</div><div class="gh-sync-form"><div class="gh-sync-fixed"><span>同期先</span><b>ushisan029/remote</b><span>保存ファイル</span><b>sync-data/progress.json</b></div><label>Fine-grained PAT<input id="ghToken" type="password" autocomplete="off" placeholder="${savedToken?'保存済み（変更時のみ入力）':'github_pat_...'}"></label><label class="gh-check"><input id="ghAuto" type="checkbox" ${config.autoSync?'checked':''}> 変更後に自動同期する</label><div class="${statusClass}">${esc(status.message)}</div><div class="buttons"><button class="primary" id="ghSave">設定を保存</button><button class="secondary" id="ghSync">今すぐ同期</button><button class="secondary" id="ghDisable">同期OFF</button><button class="danger" id="ghForgetToken">PAT削除</button></div><div class="mini">PATはこの端末のlocalStorageだけに保存し、GitHubのJSONには書き込みません。PATには remote リポジトリの Contents: Read and write 権限が必要です。</div></div></div></div>`
  }
  function injectStyle(){
    if(document.querySelector('#gh-sync-style'))return;
    const style=document.createElement('style');style.id='gh-sync-style';style.textContent=`.gh-sync-wrap{align-items:flex-start}.gh-sync-form{display:grid;gap:10px;margin-top:12px}.gh-sync-form label{display:grid;gap:5px;font-size:13px}.gh-sync-form input[type=password]{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;background:#fff;font-size:16px}.gh-check{display:flex!important;align-items:center;gap:6px}.gh-check input{width:auto}.gh-sync-status{padding:9px 11px;border-radius:9px;background:#f3f4f6;font-size:13px}.gh-sync-status.ok{background:#ecfdf5}.gh-sync-status.error{background:#fef2f2}.gh-sync-status.warn{background:#fffbeb}.gh-sync-status.working{background:#eff6ff}.gh-sync-fixed{display:grid;grid-template-columns:92px 1fr;gap:5px 10px;padding:10px 12px;background:#f8fafc;border-radius:10px;font-size:12px}.gh-sync-fixed span{color:#64748b}.gh-sync-fixed b{word-break:break-all}`;document.head.appendChild(style)
  }

  const originalSettings=settings;
  settings=function(){return originalSettings().replace('</div></section>',`${syncPanel()}</div></section>`)};
  const originalBind=bind;
  bind=function(){
    originalBind();
    const clear=document.querySelector('#clear');
    if(clear){clear.onclick=()=>{if(confirm('学習履歴と苦手登録をすべて消去しますか？ GitHub同期がONの場合はクラウド側にも反映されます。')){meta.historyResetAt=now();persistMeta();state.attempts=[];state.manualWeak.clear();window.rouanResume?.clear?.();originalSave();lastAttemptCount=0;markDirty('clear');render()}}}
    document.querySelector('#ghSave')?.addEventListener('click',()=>{
      config.repository=DEFAULT_CONFIG.repository;config.branch='main';config.path=DEFAULT_CONFIG.path;config.autoSync=!!document.querySelector('#ghAuto')?.checked;config.enabled=true;
      const entered=document.querySelector('#ghToken')?.value?.trim();if(entered){token=entered;localStorage.setItem(TOKEN_STORE,token)}
      persistConfig();setStatus('ok','設定を保存しました。「今すぐ同期」で接続を確認してください。',true)
    });
    document.querySelector('#ghSync')?.addEventListener('click',()=>syncNow({silent:false}));
    document.querySelector('#ghDisable')?.addEventListener('click',()=>{config.enabled=false;persistConfig();setStatus('idle','同期OFF',true)});
    document.querySelector('#ghForgetToken')?.addEventListener('click',()=>{token='';localStorage.removeItem(TOKEN_STORE);setStatus('warn','PATをこの端末から削除しました。',true)});
  };

  injectStyle();
  function startup(){if(!state?.data){setTimeout(startup,250);return}if(config.enabled&&config.autoSync&&token)setTimeout(()=>syncNow({silent:true}).catch(()=>{}),800)}
  startup();
  window.rouanGithubSync={sync:()=>syncNow({silent:false}),getConfig:()=>({...config,tokenSaved:!!token}),getStatus:()=>({...status})};
})();
