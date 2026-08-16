(()=>{
  function makeKey(){
    const bytes=crypto.getRandomValues(new Uint8Array(24));
    let binary='';
    for(const b of bytes)binary+=String.fromCharCode(b);
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('#ghGenerateKey');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const input=document.querySelector('#ghKey');
    if(input){input.value=makeKey();input.focus();input.select()}
    const box=document.querySelector('.gh-sync-status');
    if(box){box.className='gh-sync-status warn';box.textContent='生成した同期キーを控えてから「設定を保存」を押してください。'}
  },true);
})();
