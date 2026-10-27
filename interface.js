/* Navigation et signalement progressif. Les écritures restent gérées par l'API existante. */
(function(){
  "use strict";
  const el=id=>document.getElementById(id);
  const finder=document.querySelector('.finder');
  const mobile=()=>window.matchMedia('(max-width:900px)').matches;
  let filtersOpen=!mobile(),step=0,lastFilterFocus=null;
  const steps=[...document.querySelectorAll('[data-report-step]')];
  const stepButtons=[...document.querySelectorAll('[data-report-step-target]')];
  function setView(view,scroll=true){
    document.body.dataset.view=view;
    document.querySelectorAll('[data-view]').forEach(button=>{
      const active=button.dataset.view===view;
      button.classList.toggle('is-active',active);
      if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(active));
      else if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    setFilters(false,false);
    if(scroll)el('carte').scrollIntoView({behavior:'smooth',block:'start'});
    requestAnimationFrame(()=>{if(mapMode==='leaflet'&&map)map.invalidateSize();});
  }
  function setFilters(open,focus=true){
    filtersOpen=open;
    document.body.classList.toggle('filters-open',open);
    finder.classList.toggle('filters-collapsed',!open);
    el('showFilters').setAttribute('aria-expanded',String(open));
    const overlay=mobile()||document.body.dataset.view==='list';
    el('filterBackdrop').hidden=!open||!overlay;
    if(open&&overlay){
      lastFilterFocus=document.activeElement;
      if(focus)el('closeFilters').focus();
    }else if(!open&&focus&&lastFilterFocus){lastFilterFocus.focus();lastFilterFocus=null;}
    requestAnimationFrame(()=>{if(mapMode==='leaflet'&&map)map.invalidateSize();});
  }
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();setView(button.dataset.view);}));
  el('showFilters').addEventListener('click',()=>setFilters(!filtersOpen));
  el('closeFilters').addEventListener('click',()=>setFilters(false));
  el('filterBackdrop').addEventListener('click',()=>setFilters(false));
  el('recentOnly').addEventListener('click',()=>{onlyRecent=!onlyRecent;renderAll();});
  el('showExamples').addEventListener('change',event=>{showExamples=event.target.checked;renderAll();});
  document.querySelectorAll('[data-open-report]').forEach(button=>button.addEventListener('click',openModal));
  el('mobileAccount').addEventListener('click',()=>el('accountBtn').click());
  function refreshResults(){
    const count=selectedSeries.size+(onlyRecent?1:0);
    el('activeFilterCount').textContent=count;
    el('activeFilterCount').hidden=!count;
    el('recentOnly').setAttribute('aria-pressed',String(onlyRecent));
    el('exampleCountLabel').hidden=!filteredReports().some(r=>r.demo);
  }
  document.addEventListener('pokestock:results',refreshResults);
  function setStep(next,focus=true){
    step=Math.max(0,Math.min(2,next));
    steps.forEach((section,index)=>section.hidden=index!==step);
    stepButtons.forEach((button,index)=>{if(index===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
    el('reportPrevious').hidden=step===0;
    el('reportNext').hidden=step===2;
    el('publishReport').hidden=step!==2;
    if(focus){const field=steps[step].querySelector('input:not([type=hidden]),select:not(:disabled),button');field?.focus();}
  }
  function validateStep(index){
    const controls=[...steps[index].querySelectorAll('input,select,textarea')].filter(field=>!field.disabled&&field.type!=='hidden');
    const invalid=controls.find(field=>!field.checkValidity());
    if(invalid){setStep(index,false);invalid.reportValidity();return false;}
    if(index===0&&!el('catalogVariantId').value){setStep(0);toast('Choisissez un article et sa variante dans le catalogue.');return false;}
    if(index===1&&!verifiedAddress){setStep(1,false);el('verifyAddress').focus();toast('Recherchez puis sélectionnez l’adresse du magasin.');return false;}
    return true;
  }
  el('reportNext').addEventListener('click',()=>{if(validateStep(step))setStep(step+1);});
  el('reportPrevious').addEventListener('click',()=>setStep(step-1));
  stepButtons.forEach(button=>button.addEventListener('click',()=>{
    const target=Number(button.dataset.reportStepTarget);
    if(target<=step){setStep(target);return;}
    for(let i=0;i<target;i++)if(!validateStep(i))return;
    setStep(target);
  }));
  el('reportForm').addEventListener('submit',event=>{
    if(step<2){event.preventDefault();event.stopImmediatePropagation();if(validateStep(step))setStep(step+1);return;}
    for(let index=0;index<3;index++){
      if(!validateStep(index)){event.preventDefault();event.stopImmediatePropagation();return;}
    }
  },true);
  document.addEventListener('pokestock:reportopen',()=>setStep(0,false));
  document.addEventListener('pokestock:reportreset',()=>setStep(0,false));
  // Keep keyboard navigation within the open drawer or foremost modal.
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&filtersOpen&&(mobile()||document.body.dataset.view==='list')){setFilters(false);return;}
    if(event.key!=='Tab')return;
    const modals=[...document.querySelectorAll('.modal.open')].sort((a,b)=>Number(getComputedStyle(b).zIndex)-Number(getComputedStyle(a).zIndex));
    const panel=modals[0]?.querySelector('.modal-card')||(filtersOpen&&(mobile()||document.body.dataset.view==='list')?el('finderFilters'):null);
    if(!panel)return;
    const focusable=[...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  window.matchMedia('(max-width:900px)').addEventListener('change',()=>setFilters(!mobile(),false));
  document.body.dataset.view='map';setFilters(filtersOpen,false);setStep(0,false);refreshResults();
})();
