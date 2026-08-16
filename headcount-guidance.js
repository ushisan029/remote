(()=>{
  const upstream=window.fetch.bind(window);
  const MGMT_REF={label:'厚生労働省：総括安全衛生管理者等の選任義務',type:'公的資料',detail:'事業場規模・人数基準',url:'https://www.mhlw.go.jp/toukei/itiran/roudou/saigai/anzen/anzen00/5.html'};
  const CONSTRUCTION_REF={label:'職場のあんぜんサイト：統括安全衛生責任者',type:'公的資料',detail:'建設現場の人数基準',url:'https://anzeninfo.mhlw.go.jp/yougo/yougo101_1.html'};
  const RULES=[
    {test:/総括安全衛生管理者/,note:'【正しい人数】総括安全衛生管理者：林業・鉱業・建設業・運送業・清掃業は常時100人以上、製造業・各種商品小売業・ゴルフ場業等の所定業種は常時300人以上、その他の業種は常時1,000人以上。',ref:MGMT_REF},
    {test:/安全管理者/,note:'【正しい人数】安全管理者：法定の対象業種では常時50人以上で選任が必要。',ref:MGMT_REF},
    {test:/安全管理者/,extra:/専任|専属|労働安全コンサルタント/,note:'【正しい人数】専任の安全管理者：建設業・有機化学工業製品製造業・石油製品製造業は300人以上、無機化学工業製品製造業・化学肥料製造業・道路貨物運送業・港湾運送業は500人以上、紙・パルプ製造業・鉄鋼業・造船業は1,000人以上。その他の対象業種は一定の災害実績がある2,000人以上の事業場が対象。',ref:MGMT_REF},
    {test:/(^|[^全])衛生管理者/,note:'【正しい人数】衛生管理者：全業種で常時50人以上。選任数は50～200人=1人以上、201～500人=2人以上、501～1,000人=3人以上、1,001～2,000人=4人以上、2,001～3,000人=5人以上、3,001人以上=6人以上。',ref:MGMT_REF},
    {test:/(^|[^全])衛生管理者/,extra:/専任|有害業務|衛生工学衛生管理者/,note:'【正しい人数】専任の衛生管理者：常時1,000人を超える事業場、または常時500人を超え、法定の有害業務に常時30人以上を従事させる事業場では、少なくとも1人を専任とする。',ref:MGMT_REF},
    {test:/安全衛生推進者|衛生推進者/,note:'【正しい人数】安全衛生推進者／衛生推進者：常時10人以上50人未満（10～49人）の事業場で選任。対象業種では安全衛生推進者、それ以外の業種では衛生推進者。',ref:MGMT_REF},
    {test:/産業医/,note:'【正しい人数】産業医：全業種で常時50人以上の事業場に選任。常時1,000人以上、または法定の有害業務に常時500人以上を従事させる事業場では専属の産業医が必要。',ref:MGMT_REF},
    {test:/安全委員会|安全衛生委員会/,note:'【正しい人数】安全委員会：業種区分により常時50人以上または100人以上で設置。衛生委員会は全業種で常時50人以上。両方の要件に該当する場合は安全衛生委員会として一体化できる。',ref:MGMT_REF},
    {test:/(^|[^全])衛生委員会/,note:'【正しい人数】衛生委員会：全業種で常時50人以上の事業場に設置。',ref:MGMT_REF},
    {test:/統括安全衛生責任者|元方安全衛生管理者|安全衛生責任者/,note:'【正しい人数】建設現場の統括安全衛生責任者：ずい道等・一定の橋梁・圧気工法の仕事は関係請負人を含め常時30人以上、その他の仕事は常時50人以上。元方安全衛生管理者・安全衛生責任者もこの統括管理体制に対応して選任する。',ref:CONSTRUCTION_REF},
    {test:/店社安全衛生管理者/,note:'【正しい人数】店社安全衛生管理者：ずい道等・一定の橋梁・圧気工法は常時20～29人、主要構造部が鉄骨造または鉄骨鉄筋コンクリート造の建築工事は常時20～49人が基本となる対象範囲。',ref:CONSTRUCTION_REF}
  ];

  function headcountRelevant(text){return /(?:[0-9０-９一二三四五六七八九十百千万][0-9０-９,，一二三四五六七八九十百千万\.．]*\s*人)|人数|労働者数|常時.{0,12}人/.test(text)}
  function addOnce(arr,value){if(!arr.includes(value))arr.push(value)}
  function addRef(q,ref){q.legalReferences=Array.isArray(q.legalReferences)?q.legalReferences:[];if(!q.legalReferences.some(r=>r?.url===ref.url&&r?.label===ref.label))q.legalReferences.push({...ref})}
  function annotate(q){
    const text=[q.prompt,...(q.choices||[]),q.explanation,...(q.choiceNotes||[]),...(q.points||[])].filter(Boolean).join(' ');
    if(!headcountRelevant(text))return q;
    const points=Array.isArray(q.points)?[...q.points]:[];let touched=false;
    for(const rule of RULES){rule.test.lastIndex=0;if(rule.extra)rule.extra.lastIndex=0;if(rule.test.test(text)&&(!rule.extra||rule.extra.test(text))){addOnce(points,rule.note);addRef(q,rule.ref);touched=true}}
    if(touched)q.points=points;return q;
  }

  window.fetch=async function(input,init){
    const response=await upstream(input,init),url=typeof input==='string'?input:(input&&input.url)||'';
    if(!response.ok||!(/questions\.json(?:\?|$)/.test(url)||/\/data\/.*(?:\.json|\.b64gz)(?:\?|$)/.test(url)))return response;
    try{const data=await response.clone().json();if(!Array.isArray(data.QUESTIONS))return response;data.QUESTIONS=data.QUESTIONS.map(annotate);const headers=new Headers(response.headers);headers.set('content-type','application/json; charset=utf-8');return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers})}catch(e){console.warn('人数基準を追記できませんでした',e);return response}
  };
})();
