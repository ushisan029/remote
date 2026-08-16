(()=>{
  const CONFIG_STORE='rouan-dojo-github-sync-config-v1';
  const TOKEN_STORE='rouan-dojo-github-sync-token-v1';
  const META_STORE='rouan-dojo-github-sync-meta-v1';
  const DEVICE_STORE='rouan-dojo-device-id-v1';
  const DEFAULT_CONFIG={enabled:false,repository:'ushisan029/rouan-dojo-sync',branch:'main',path:'progress.json',autoSync:true};
  const API_VERSION='2022-11-28';
  const AUTO_DELAY=30000;
  const SAVE_THRESHOLD=10;
  let config=load(CONFIG_STORE,DEFAULT_CONFIG);
  config={...DEFAULT_CONFIG,...(config&&typeof config==='object'?config:{})};
  let token=localStorage.getItem(TOKEN_STORE)||'';
  let meta=load(META_STORE,{});
  let syncTimer=null,dirtyEvents=0,syncing=false,applyingRemote=false;
  let status={kind:'idle',message:config.enabled?'未同期':'同期OFF'};
  let lastWeakSignature=weakSignature();
  let lastAttemptCount=Array.isArray(state.attempts)?state.attempts.length:0;
  const deviceId=getDeviceId();
  function load(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
  function saveJson(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  function now(){return new Date().toISOString()}
  function getDeviceId(){let id=localStorage.getItem(DEVICE_STORE);if(!id){id=crypto.randomUUID?.()||`device-${Date.now()}-${Math.random().toString(16).slice(2)}`;localStorage.setItem(DEVICE_STORE,id)}return id}
  function weakSignature(){try{return JSON.stringify([...state.manualWeak].sort())}catch{return '[]'}}
  function setStatus(kind,message,rerender=false){status={kind,message};if(rerender&&state?.data&&state.screen==='settings')render()}
  function persistConfig(){saveJson(CONFIG_STORE,config)}
  function persistMeta(){saveJson(META_STORE,meta)}
  function markDirty(reason='change'){
    if(applyingRemote)return;
    const currentWeak=weakSignature();
    if(currentWeak!==lastWeakSignature){meta.manualWeakUpdatedAt=now();lastWeakSignature=currentWeak}
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
  restore=async function(e){
    const file=e?.target?.files?.[0];
    if(file){try{const j=JSON.parse(await file.text());const rows=Array.isArray(j)?j:j?.attempts;if(Array.isArray(rows)){meta.historyResetAt=null;persistMeta()}}catch{}}
    await originalRestore(e);markDirty('restore');
  };
  window.addEventListener('rouan:resume-changed',()=>markDirty('resume'));
  window.addEventListener('online',()=>{if(config.enabled&&config.autoSync&&token)syncNow({silent:true}).catch(()=>{})});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&config.enabled&&config.autoSync&&token&&meta.dirty)syncNow({silent:true}).catch(()=>{})});
  function apiHeaders(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':API_VERSION}}
  function parseRepo(){const value=(config.repository||'').trim(),parts=value.split('/').filter(Boolean);if(parts.length!==2)throw new Error('同期先は owner/repository の形式で指定してください。');return{owner:parts[0],repo:parts[1]}}
  function encodedPath(path){return String(path||'progress.json').split('/').filter(Boolean).map(encodeURIComponent).join('/')}
  function contentsUrl(){const{owner,repo}=parseRepo();return`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath(config.path)}`}
  function repoUrl(){const{owner,repo}=parseRepo();return`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
  function encode64(text){const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
  function decode64(value){const binary=atob(String(value||'').replace(/\s/g,'')),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder().decode(bytes)}
  async function responseMessage(res){try{const j=await res.clone().json();return j?.message||`${res.status} ${res.statusText}`}catch{return`${res.status} ${res.statusText}`}}
  async function verifyPrivateRepo(){
    const res=await fetch(repoUrl(),{headers:apiHeaders(),cache:'no-store'});
    if(!res.ok){if(res.status===404)throw new Error('同期先リポジトリが見つかりません。Privateリポジトリを作成し、PATからアクセスできるようにしてください。');if(res.status===401||res.status===403)throw new Error('GitHubトークンの権限を確認してください。');throw new Error(await responseMessage(res))}
    const repo=await res.json();if(!repo.private)throw new Error('同期先がPublicです。学習履歴を公開しないためPrivateリポジトリを指定してください。');return repo;
  }
  function normalizedAttempts(rows){return Array.isArray(rows)?rows.filter(x=>x&&typeof x==='object'):[]}
  function attemptKey(a){return a.id||`${a.questionId||''}|${a.answeredAt||''}|${a.selectedIndex??''}|${a.assessmentType||''}`}
  function maxIso(a,b){const ta=Date.parse(a||0)||0,tb=Date.parse(b||0)||0;return ta>=tb?(a||null):(b||null)}
  function mergeResume(local,remote){const out={};for(const key of new Set([...Object.keys(local||{}),...Object.keys(remote||{})])){const a=local?.[key],b=remote?.[key];if(!a){out[key]=b;continue}if(!b){out[key]=a;continue}out[key]=(Date.parse(b.updatedAt||0)||0)>(Date.parse(a.updatedAt||0)||0)?b:a}return out}
  function mergeSnapshots(local,remote){
    remote=remote&&typeof remote==='object'?remote:{};
    const resetAt=maxIso(local.historyResetAt,remote.historyResetAt),resetTime=Date.parse(resetAt||0)||0,map=new Map();
    for(const a of[...normalizedAttempts(remote.attempts),...normalizedAttempts(local.attempts)]){const t=Date.parse(a.answeredAt||0)||0;if(resetTime&&t&&t<=resetTime)continue;map.set(attemptKey(a),a)}
    const attempts=[...map.values()].sort((a,b)=>String(a.answeredAt||'').localeCompare(String(b.answeredAt||'')));
    const localWeakTime=Date.parse(local.manualWeakUpdatedAt||0)||0,remoteWeakTime=Date.parse(remote.manualWeakUpdatedAt||0)||0;let manualWeak=[],manualWeakUpdatedAt=null;
    if(localWeakTime>remoteWeakTime){manualWeak=local.manualWeak||[];manualWeakUpdatedAt=local.manualWeakUpdatedAt}else if(remoteWeakTime>localWeakTime){manualWeak=remote.manualWeak||[];manualWeakUpdatedAt=remote.manualWeakUpdatedAt}else{manualWeak=[...new Set([...(local.manualWeak||[]),...(remote.manualWeak||[])])];manualWeakUpdatedAt=local.manualWeakUpdatedAt||remote.manualWeakUpdatedAt||null}
    return{version:1,app:'rouan-dojo',updatedAt:now(),deviceId,historyResetAt:resetAt,manualWeakUpdatedAt,attempts,manualWeak:[...new Set(manualWeak)].sort(),resume:mergeResume(local.resume||{},remote.resume||{})};
  }
  function localSnapshot(){if(!meta.manualWeakUpdatedAt&&state.manualWeak?.size){meta.manualWeakUpdatedAt=now();persistMeta()}return{version:1,app:'rouan-dojo',updatedAt:meta.localUpdatedAt||now(),deviceId,historyResetAt:meta.historyResetAt||null,manualWeakUpdatedAt:meta.manualWeakUpdatedAt||null,attempts:normalizedAttempts(state.attempts),manualWeak:[...state.manualWeak].sort(),resume:window.rouanResume?.dump?.()||{}}}
  function applyMerged(merged){applyingRemote=true;try{state.attempts=normalizedAttempts(merged.attempts);state.manualWeak=new Set(Array.isArray(merged.manualWeak)?merged.manualWeak:[]);originalSave();window.rouanResume?.replace?.(merged.resume||{});meta.historyResetAt=merged.historyResetAt||null;meta.manualWeakUpdatedAt=merged.manualWeakUpdatedAt||null;meta.localUpdatedAt=merged.updatedAt||now();meta.lastSyncAt=now();meta.lastError=null;meta.dirty=false;persistMeta();lastWeakSignature=weakSignature();lastAttemptCount=state.attempts.length;dirtyEvents=0}finally{applyingRemote=false}}
  async function getRemote(){const url=`${contentsUrl()}?ref=${encodeURIComponent(config.branch||'main')}`,res=await fetch(url,{headers:apiHeaders(),cache:'no-store'});if(res.status===404)return{exists:false,sha:null,data:{}};if(!res.ok)throw new Error(await responseMessage(res));const item=await res.json();let data={};try{data=JSON.parse(decode64(item.content||''))}catch{throw new Error('GitHub上の同期データを読み込めません。progress.json の内容を確認してください。')}return{exists:true,sha:item.sha,data}}
  async function putRemote(data,sha=null){const body={message:`Sync study progress ${new Date().toLocaleString('ja-JP')}`,content:encode64(JSON.stringify(data,null,2)),branch:config.branch||'main'};if(sha)body.sha=sha;const res=await fetch(contentsUrl(),{method:'PUT',headers:{...apiHeaders(),'Content-Type':'application/json'},body:JSON.stringify(body)});if(!res.ok){const message=await responseMessage(res),err=new Error(message);err.status=res.status;throw err}return res.json()}
  async function syncAttempt(){const remote=await getRemote(),merged=mergeSnapshots(localSnapshot(),remote.data);await putRemote(merged,remote.sha);applyMerged(merged);return merged}
  async function syncNow({silent=false}={}){
    if(syncing)return;if(!config.enabled){if(!silent)setStatus('warn','GitHub同期はOFFです。',true);return}if(!token){if(!silent)setStatus('warn','GitHubトークンを設定してください。',true);return}if(!navigator.onLine){setStatus('warn','オフラインです。端末には保存済みです。',!silent);return}
    syncing=true;clearTimeout(syncTimer);syncTimer=null;setStatus('working','GitHubと同期中…',!silent);
    try{await verifyPrivateRepo();try{await syncAttempt()}catch(e){if(e?.status===409||e?.status===422)await syncAttempt();else throw e}setStatus('ok',`同期済み ${new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`,true)}catch(e){meta.lastError=String(e?.message||e);persistMeta();setStatus('error',String(e?.message||e),true);if(!silent)console.error(e)}finally{syncing=false}
  }
  function syncPanel(){const savedToken=!!token,statusClass=`gh-sync-status ${status.kind}`;return`<div class="setting-row gh-sync-wrap"><div style="width:100%"><b>GitHub同期</b><div class="mini">正答履歴・苦手登録・再開位置をPrivateリポジトリへ同期します。PATはこの端末内だけに保存され、リポジトリには書き込みません。</div><div class="gh-sync-form"><label>同期先リポジトリ<input id="ghRepo" value="${esc(config.repository||'')}" placeholder="ushisan029/rouan-dojo-sync"></label><div class="gh-sync-grid"><label>Branch<input id="ghBranch" value="${esc(config.branch||'main')}"></label><label>保存ファイル<input id="ghPath" value="${esc(config.path||'progress.json')}"></label></div><label>Fine-grained PAT<input id="ghToken" type="password" autocomplete="off" placeholder="${savedToken?'保存済み（変更時のみ入力）':'github_pat_...'}"></label><label class="gh-check"><input id="ghAuto" type="checkbox" ${config.autoSync?'checked':''}> 変更後に自動同期する</label><div class="${statusClass}">${esc(status.message)}</div><div class="buttons"><button class="primary" id="ghSave">設定を保存</button><button class="secondary" id="ghSync">今すぐ同期</button><button class="secondary" id="ghDisable">同期OFF</button><button class="danger" id="ghForgetToken">トークン削除</button></div><div class="mini">※ 同期先がPublicの場合は安全のため同期を拒否します。専用Privateリポジトリを指定してください。</div></div></div></div>`}
  function injectStyle(){if(document.querySelector('#gh-sync-style'))return;const style=document.createElement('style');style.id='gh-sync-style';style.textContent=`.gh-sync-wrap{align-items:flex-start}.gh-sync-form{display:grid;gap:10px;margin-top:12px}.gh-sync-form label{display:grid;gap:5px;font-size:13px}.gh-sync-form input[type=text],.gh-sync-form input[type=password],.gh-sync-form input:not([type]){width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;background:#fff;font-size:16px}.gh-sync-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gh-check{display:flex!important;align-items:center;gap:6px}.gh-check input{width:auto}.gh-sync-status{padding:9px 11px;border-radius:9px;background:#f3f4f6;font-size:13px}.gh-sync-status.ok{background:#ecfdf5}.gh-sync-status.error{background:#fef2f2}.gh-sync-status.warn{background:#fffbeb}.gh-sync-status.working{background:#eff6ff}@media(max-width:600px){.gh-sync-grid{grid-template-columns:1fr}}`;document.head.appendChild(style)}
  const originalSettings=settings;
  settings=function(){return originalSettings().replace('</div></section>',`${syncPanel()}</div></section>`)};
  const originalBind=bind;
  bind=function(){
    originalBind();
    const clear=document.querySelector('#clear');if(clear){clear.onclick=()=>{if(confirm('学習履歴と苦手登録をすべて消去しますか？ GitHub同期がONの場合はクラウド側にも反映されます。')){meta.historyResetAt=now();meta.manualWeakUpdatedAt=now();persistMeta();state.attempts=[];state.manualWeak.clear();window.rouanResume?.clear?.();originalSave();lastAttemptCount=0;lastWeakSignature='[]';markDirty('clear');render()}}}
    document.querySelector('#ghSave')?.addEventListener('click',()=>{config.repository=(document.querySelector('#ghRepo')?.value||'').trim();config.branch=(document.querySelector('#ghBranch')?.value||'main').trim()||'main';config.path=(document.querySelector('#ghPath')?.value||'progress.json').trim()||'progress.json';config.autoSync=!!document.querySelector('#ghAuto')?.checked;config.enabled=true;const entered=document.querySelector('#ghToken')?.value?.trim();if(entered){token=entered;localStorage.setItem(TOKEN_STORE,token)}persistConfig();setStatus('ok','設定を保存しました。続けて「今すぐ同期」で接続を確認してください。',true)});
    document.querySelector('#ghSync')?.addEventListener('click',()=>syncNow({silent:false}));
    document.querySelector('#ghDisable')?.addEventListener('click',()=>{config.enabled=false;persistConfig();setStatus('idle','同期OFF',true)});
    document.querySelector('#ghForgetToken')?.addEventListener('click',()=>{token='';localStorage.removeItem(TOKEN_STORE);setStatus('warn','トークンをこの端末から削除しました。',true)});
  };
  injectStyle();
  function startup(){if(!state?.data){setTimeout(startup,250);return}if(config.enabled&&config.autoSync&&token)setTimeout(()=>syncNow({silent:true}).catch(()=>{}),800)}
  startup();
  window.rouanGithubSync={sync:()=>syncNow({silent:false}),getConfig:()=>({...config,tokenSaved:!!token}),getStatus:()=>({...status})};
})();
