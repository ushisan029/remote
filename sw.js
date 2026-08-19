const CACHE='rouan-dojo-static-v32';
const CORE=[
  './',
  './index.html',
  './app.css',
  './archive-loader.js',
  './choice-sanitizer.js',
  './scoring-loader.js',
  './answer-points-loader.js',
  './detailed-explanations-loader.js',
  './headcount-guidance.js',
  './figure-viewer-v2.js?v=20260820-1',
  './app.js',
  './machine-pdf-local.js?v=20260819-1',
  './resume-state.js',
  './github-sync.js',
  './year-completion.js',
  './questions.json',
  './manifest.webmanifest',
  './data/index.json',
  './data/machine-scoring-v1.json',
  './assets/machine/figures/manifest.json?v=20260820-1',
  './assets/machine/figures/r06-q3.png?v=20260820-1',
  './assets/machine/figures/r06-q3-1.png?v=20260820-1',
  './assets/machine/figures/r06-q3-2.png?v=20260820-1',
  './data/r07-general-01-05.json',
  './data/r07-general-06-10.json',
  './data/r07-general-11-15.json',
  './data/r07-general-16-20.json',
  './data/r07-general-21-25.json',
  './data/r07-general-26-30.json',
  './data/r07-law-01-05.json',
  './data/r07-law-06-10.json',
  './data/r07-law-11-15.json',
  './data/r06-general-04-07.json',
  './data/r06-general-10-17.json',
  './data/r06-general-19-27.json',
  './data/r06-general-30.json',
  './data/r06-law-01-05.json',
  './data/r06-law-06-10.json',
  './data/r06-law-11-15.json',
  './data/r05-general-01-10.json',
  './data/r05-general-11-20.json',
  './data/r05-general-21-30.json',
  './data/r05-law-01-05.json',
  './data/r05-law-06-10.json',
  './data/r05-law-11-15.json',
  './data/r04-general-01-10.json',
  './data/r04-general-11-20.json',
  './data/r04-general-21-30.json',
  './data/r04-law-01-05.json',
  './data/r04-law-06-10.json',
  './data/r04-law-11-15.json',
  './data/r03-general-01-10.json',
  './data/r03-general-11-20.json',
  './data/r03-general-21-30.json',
  './data/r03-law-01-05.json',
  './data/r03-law-06-10.json',
  './data/r03-law-11-15.json',
  './data/r02-general-01-11.json',
  './data/r02-general-12-23.json',
  './data/r02-general-24-30.json',
  './data/r02-law-01-09.json',
  './data/r02-law-10-15.json',
  './data/r01-general-01-11.json',
  './data/r01-general-12-23.json',
  './data/r01-general-24-30.json',
  './data/r01-law-01-08.json',
  './data/r01-law-09-15.json',
  './data/h30-general-01-11.json',
  './data/h30-general-12-23.json',
  './data/h30-general-24-30.json',
  './data/h30-law-01-09.json',
  './data/h30-law-10-15.json',
  './data/h29-general-01-11.json',
  './data/h29-general-12-22.json',
  './data/h29-general-23-30.json',
  './data/machine-r04.json',
  './data/machine-r05.json',
  './data/machine-r06.json',
  './data/machine-r07.json',
  './data/detailed/r07-general.json',
  './data/detailed/r07-law.json',
  './data/detailed/r06-general.json',
  './data/detailed/r06-law.json',
  './data/detailed/r05-general.json',
  './data/detailed/r05-law.json',
  './data/detailed/r04-general.json',
  './data/detailed/r04-law.json',
  './data/detailed/r03-general.json',
  './data/detailed/r03-law.json',
  './data/detailed/r02-general.json',
  './data/detailed/r02-law.json',
  './data/detailed/r01-general.json',
  './data/detailed/r01-law.json',
  './data/detailed/h30-general.json',
  './data/detailed/h30-law.json',
  './data/detailed/h29-general.json',
  './assets/machine/r4-q1.b64?v=20260819-3',
  './assets/machine/r4-q2.b64?v=20260819-3',
  './assets/machine/r4-q3.b64?v=20260819-3',
  './assets/machine/r4-q4.b64?v=20260819-3',
  './assets/machine/r5-q2.b64?v=20260819-3',
  './assets/machine/r5-q3.b64?v=20260819-3',
  './assets/machine/r5-q4.b64?v=20260819-3',
  './assets/machine/r6-q1.b64?v=20260819-3',
  './assets/machine/r6-q2.b64?v=20260819-3',
  './assets/machine/r6-q3.b64?v=20260819-3',
  './assets/machine/r6-q4.b64?v=20260819-3',
  './assets/machine/r7-q1-1.b64?v=20260819-3',
  './assets/machine/r7-q1-2.b64?v=20260819-3',
  './assets/machine/r7-q1-3.b64?v=20260819-3',
  './assets/machine/r7-q1-4.b64?v=20260819-3',
  './assets/machine/r7-q2.b64?v=20260819-3',
  './assets/machine/r7-q4.b64?v=20260819-3',
  './assets/machine/pdf/r04-machine.pdf',
  './assets/machine/pdf/r05-machine.pdf',
  './assets/machine/pdf/r06-machine.pdf',
  './assets/machine/pdf/r07-machine.pdf'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      }
      return response;
    }catch(_){
      const cached=await caches.match(event.request,{ignoreSearch:true});
      if(cached)return cached;

      if(event.request.mode==='navigate'){
        const shell=await caches.match('./index.html');
        if(shell)return shell;
      }

      return new Response('Offline',{status:503,statusText:'Offline'});
    }
  })());
});
