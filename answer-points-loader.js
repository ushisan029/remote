(()=>{
  const upstream=window.fetch.bind(window);
  const GENERIC=/原問題の〇印|詳細解説.*精査|学習ポイント.*精査|順次追加/;
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const clip=(s,n=120)=>{s=clean(s);return s.length>n?s.slice(0,n)+'…':s};

  function intentPoint(q){
    const p=clean(q.prompt);
    if(/適切でない/.test(p)) return '設問は「適切でないもの」を選ぶ。各肢を○×判定して、誤りの理由まで言える状態にする。';
    if(/誤っている|誤り/.test(p)) return '設問は「誤っているもの」を選ぶ。数値・用語・主体・例外条件のどこが違うかを特定する。';
    if(/違反となる/.test(p)) return '「法令上、違反となるか」を判定する問題。義務の対象者・適用条件・例外の順で確認する。';
    if(/適切なもの|正しいもの/.test(p)) return '設問は「適切なもの」を選ぶ。正しい定義・手順・条件を一つに絞る。';
    if(/組合せ/.test(p)) return '組合せ問題は、各記述を先に個別○×判定してから選択肢の組合せに戻る。';
    return '問題文の条件語（対象、時点、数値、目的）を先に拾い、選択肢ごとの差を比較する。';
  }

  function themePoint(q){
    const t=clean(`${q.title||''} ${q.prompt||''}`);
    if(/安全管理|安全委員会|KYT|危険予知|ヒヤリ|5S|リスクアセスメント|OSHMS/.test(t)) return '安全管理分野は「目的→実施主体→実施手順→記録・フォロー」の順に整理すると判断しやすい。';
    if(/クレーン|移動式クレーン|フォークリフト|プレス|旋盤|機械|ロボット|足場|ゴンドラ|玉掛/.test(t)) return '機械・設備分野は、安全装置の目的と「防止する危険」を対応させ、荷重・距離・禁止事項の条件を確認する。';
    if(/電気|感電|漏電|接地|絶縁|静電/.test(t)) return '電気分野は、電圧・電流・接地・絶縁・遮断の役割と単位を混同しない。';
    if(/爆発|燃焼|引火|発火|危険物|化学|ガス|粉じん/.test(t)) return '化学・爆発分野は「可燃物・支燃物・着火源」と濃度・温度・圧力条件を対応させて考える。';
    if(/材料|応力|ひずみ|疲労|腐食|破壊|鋼|溶接/.test(t)) return '材料分野は、用語の定義→荷重や応力の作用→生じる現象、の因果関係で整理する。';
    if(/信頼性|FTA|FMEA|故障|MTBF|確率/.test(t)) return '信頼性分野は、直列・並列・AND/ORと補集合の関係を図にしてから計算・判定する。';
    if(/人間工学|ヒューマン|色|錯覚|表示|操作/.test(t)) return '人間工学分野は、似た用語の定義と対になる概念をセットで覚える。';
    if(/統計|労働災害|年千人率|度数率|強度率/.test(t)) return '統計問題は、対象年・対象業種・指標の分子/分母を確認し、印象ではなく定義で判断する。';
    if(/保護具|健康|高年齢|作業環境|労働衛生/.test(t)) return '安全衛生管理は、作業環境管理・作業管理・健康管理のどこに該当する措置かを切り分ける。';
    return '正答肢だけでなく、他の選択肢が成立しない理由を一言ずつ説明できるまで復習する。';
  }

  function lawPoint(q){
    if(q.subject!=='industrial_law') return null;
    const date=q.lawAsOf?`本問の法令基準日は ${q.lawAsOf}。` : '';
    return `${date}条文は「誰が・どの規模/条件で・いつ/どの頻度で・何をするか」に分解して確認する。`;
  }

  function correctPoint(q){
    if(!Array.isArray(q.choices)||q.correctIndex==null||!q.choices[q.correctIndex]) return null;
    return `正答肢（${Number(q.correctIndex)+1}）の判断の核：${clip(q.choices[q.correctIndex])}`;
  }

  function enrich(q){
    if(q.subject==='machine_safety') return q; // 機械安全は専用の採点ポイントを優先
    const existing=Array.isArray(q.points)?q.points.filter(Boolean):[];
    const substantive=existing.length&&existing.every(x=>!GENERIC.test(String(x)));
    if(substantive) return q;
    const pts=[intentPoint(q),correctPoint(q),themePoint(q),lawPoint(q)].filter(Boolean);
    return {...q,points:pts,answerPointsGenerated:true};
  }

  window.fetch=async function(input,init){
    const response=await upstream(input,init);
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!response.ok||!(/questions\.json(?:\?|$)/.test(url)||/\/data\/.*(?:\.json|\.b64gz)(?:\?|$)/.test(url))) return response;
    try{
      const data=await response.clone().json();
      if(!Array.isArray(data.QUESTIONS)) return response;
      data.QUESTIONS=data.QUESTIONS.map(enrich);
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch(e){console.warn('回答ポイントの付与に失敗しました',e);return response;}
  };

  function relabel(){
    document.querySelectorAll('.explain > strong').forEach(el=>{
      if(el.textContent.trim()==='学習ポイント') el.textContent='回答のポイント';
    });
  }
  new MutationObserver(relabel).observe(document.documentElement,{subtree:true,childList:true});
  addEventListener('DOMContentLoaded',relabel);
})();
