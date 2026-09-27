const OPENAI_URL='https://api.openai.com/v1/agents/sessions';
const SERVICE_VERSION='2026-09-27.2';
const SUBJECTS=new Set(['industrial_general','industrial_law','machine_safety']);
const MODES=new Set(['weak','past','prediction']);

function corsHeaders(origin,env){
  const configured=String(env.ALLOWED_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
  const allowed=!origin||!configured.length||configured.includes(origin);
  return {allowed,headers:{
    'Access-Control-Allow-Origin':allowed?(origin||'*'):'null',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Cache-Control':'no-store',
    'Vary':'Origin',
    'Content-Type':'application/json; charset=utf-8'
  }};
}

function json(data,status,origin,env){
  const c=corsHeaders(origin,env);return new Response(JSON.stringify(data),{status,headers:c.headers});
}

function trimFence(text){
  return String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
}

function parseAgentStream(raw){
  let sessionId=null,delta='',doneText='',failure=null;
  for(const block of raw.split(/\r?\n\r?\n+/)){
    const payload=block.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trim()).join('\n');
    if(!payload||payload==='[DONE]')continue;
    let event;try{event=JSON.parse(payload)}catch{continue}
    sessionId=sessionId||event.session?.id||event.session_id||null;
    if(event.type==='agent.session.turn.output_text.delta'&&event.delta)delta+=event.delta;
    if(event.type==='agent.session.turn.output_text.done'&&event.text)doneText+=event.text;
    if(['agent.session.failed','agent.session.environment.failed','agent.session.turn.failed','agent.session.turn.cancelled','error'].includes(event.type))failure=event.error?.message||event.turn?.error?.message||event.type;
  }
  return {sessionId,text:doneText||delta,failure};
}

function validateSummary(summary){
  if(!summary||typeof summary!=='object')return false;
  if(!Array.isArray(summary.subjects)||summary.subjects.length>10)return false;
  if(!summary.overall||typeof summary.overall!=='object')return false;
  if(Array.isArray(summary.weakQuestions)&&summary.weakQuestions.length>30)return false;
  if(Array.isArray(summary.hardQuestions)&&summary.hardQuestions.length>30)return false;
  if(Array.isArray(summary.recent)&&summary.recent.length>30)return false;
  return true;
}

function normalizeResult(raw){
  if(!raw||typeof raw!=='object')return {summary:String(raw||''),priorities:[],plan:[],message:''};
  const priorities=Array.isArray(raw.priorities)?raw.priorities.filter(x=>x&&SUBJECTS.has(x.subject)).slice(0,3).map(x=>({subject:x.subject,reason:String(x.reason||'').slice(0,300)})):[];
  const plan=Array.isArray(raw.plan)?raw.plan.filter(x=>x&&SUBJECTS.has(x.subject)&&MODES.has(x.mode)).slice(0,3).map(x=>({subject:x.subject,mode:x.mode,count:Math.max(1,Math.min(10,Number(x.count)||1)),reason:String(x.reason||'').slice(0,300)})):[];
  return {
    summary:String(raw.summary||raw.text||'').slice(0,1200),
    priorities,
    plan,
    message:String(raw.message||'').slice(0,500)
  };
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin')||'';
    const cors=corsHeaders(origin,env);
    if(request.method==='OPTIONS')return new Response(null,{status:cors.allowed?204:403,headers:cors.headers});
    if(!cors.allowed)return json({error:'Origin is not allowed.'},403,origin,env);

    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/health')){
      return json({
        ok:true,
        service:'rouan-ai-coach',
        version:SERVICE_VERSION,
        model:env.OPENAI_MODEL||'gpt-6-luna',
        openaiConfigured:Boolean(env.OPENAI_API_KEY)
      },200,origin,env);
    }

    if(url.pathname!=='/coach'||request.method!=='POST')return json({error:'Not found.'},404,origin,env);
    if(!env.OPENAI_API_KEY)return json({error:'OPENAI_API_KEY is not configured.'},503,origin,env);

    const length=Number(request.headers.get('Content-Length')||0);if(length>100000)return json({error:'Request is too large.'},413,origin,env);
    let payload;try{payload=await request.json()}catch{return json({error:'Invalid JSON.'},400,origin,env)}
    if(payload.action!=='today_plan'||!validateSummary(payload.summary))return json({error:'Invalid request.'},400,origin,env);

    const instructions=`あなたは労働安全コンサルタント試験の学習コーチです。\n与えられた学習統計だけを根拠に、今日の学習メニューを作ってください。\n法令内容や試験問題の事実を推測・創作しないでください。\n苦手・正答率・直近の誤答・未消化量を優先して判断してください。\n出力はMarkdownではなく、次のJSONだけを返してください。\n{\n  "summary":"全体所見を2〜4文",\n  "priorities":[{"subject":"industrial_general|industrial_law|machine_safety","reason":"理由"}],\n  "plan":[{"subject":"industrial_general|industrial_law|machine_safety","mode":"weak|past|prediction","count":1,"reason":"理由"}],\n  "message":"短い学習上の注意"\n}\nplanは合計10問前後、最大3項目。subjectとmodeは指定候補からのみ選んでください。`;
    const input=`以下が現在の学習統計です。これだけを使って今日の計画を作成してください。\n${JSON.stringify(payload.summary)}`;

    let upstream;
    try{
      upstream=await fetch(OPENAI_URL,{method:'POST',headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json','OpenAI-Beta':'agents=v1'},body:JSON.stringify({agent:{model:env.OPENAI_MODEL||'gpt-6-luna',instructions},environment:{type:'none'},input,stream:true})});
    }catch(e){return json({error:`OpenAI request failed: ${e.message||e}`},502,origin,env)}
    const raw=await upstream.text();
    if(!upstream.ok)return json({error:`OpenAI API error (${upstream.status}).`,detail:raw.slice(0,1000)},502,origin,env);

    const parsed=parseAgentStream(raw);if(parsed.failure)return json({error:`Agent failed: ${parsed.failure}`},502,origin,env);
    if(!parsed.text)return json({error:'Agent completed without readable output.'},502,origin,env);
    let result;try{result=normalizeResult(JSON.parse(trimFence(parsed.text)))}catch{result=normalizeResult({text:parsed.text})}
    return json({ok:true,sessionId:parsed.sessionId,model:env.OPENAI_MODEL||'gpt-6-luna',result},200,origin,env);
  }
};
