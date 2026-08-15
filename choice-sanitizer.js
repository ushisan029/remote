(()=>{
  const nativeFetch=window.fetch.bind(window);
  const answerMark=/[〇○◯◎]/;

  function cleanChoice(value){
    if(typeof value!=='string') return value;
    let s=value;

    // Remove answer-key marks that were accidentally extracted from source PDFs.
    s=s.replace(/^[\s　]*[〇○◯◎]+[\s　:：・.-]*/u,'');
    s=s.replace(/[\s　:：・.-]*[〇○◯◎]+[\s　]*$/u,'');

    // Choice text should contain only the choice itself.  Remove wording that
    // explicitly tells the learner which item is "correct/appropriate".
    s=s.replace(/^[\s　]*(?:正しいもの|適切なもの|誤っているもの|適切でないもの)[\s　]*(?:は|[:：])[\s　]*/u,'');

    // If a choice contains an answer mark anywhere, remove the mark and common
    // answer-leak wording while preserving the actual choice text/combinations.
    if(answerMark.test(s)){
      s=s.replace(/(?:正答|正解)[\s　]*(?:は|[:：])?[\s　]*/gu,'');
      s=s.replace(/(?:正しいもの|適切なもの|誤っているもの|適切でないもの)[\s　]*は[\s　]*/gu,'');
      s=s.replace(/[〇○◯◎]/gu,'');
    }

    // Remove explicit answer annotations appended by PDF extraction,
    // e.g. "（正答：3）", "【正解 ②】" or " 正答：イ".
    s=s.replace(/[\s　]*(?:[（(【\[]\s*)?(?:正答|正解)[\s　]*[:：]?[\s　]*(?:[1-5①②③④⑤]|[イロハニホヘト])+[\s　]*(?:[）)】\]])?[\s　]*$/u,'');

    return s.replace(/[\s　]+$/u,'').trimStart();
  }

  function sanitizePayload(obj){
    if(!obj || typeof obj!=='object') return obj;
    const rows=Array.isArray(obj.QUESTIONS)?obj.QUESTIONS:null;
    if(!rows) return obj;
    let changed=0;
    for(const q of rows){
      if(!q || !Array.isArray(q.choices)) continue;
      q.choices=q.choices.map(choice=>{
        const cleaned=cleanChoice(choice);
        if(cleaned!==choice) changed++;
        return cleaned;
      });
    }
    if(changed) console.info(`[choice-sanitizer] cleaned ${changed} choice text(s)`);
    return obj;
  }

  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!response.ok || !/\.json(?:[?#].*)?$/i.test(url)) return response;
    try{
      const clone=response.clone();
      const data=JSON.parse(await clone.text());
      if(!Array.isArray(data?.QUESTIONS)) return response;
      sanitizePayload(data);
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(data),{
        status:response.status,
        statusText:response.statusText,
        headers
      });
    }catch{
      return response;
    }
  };

  window.cleanQuizChoiceText=cleanChoice;
})();
