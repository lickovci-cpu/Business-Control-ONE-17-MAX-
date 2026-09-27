(()=>{
  const route=(id)=>{
    document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
    document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===id));
    document.querySelectorAll('.mobile-route').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
    const nav=document.querySelector('#tabs');
    if(nav&&['worker','reels','media','comms','inbox','jobs','analytics','shop','settings','autopilot'].includes(id))nav.classList.add('show-more');
  };
  const failSafe=()=>{
    document.addEventListener('click',e=>{
      if(window.__BCO_READY)return;
      const target=e.target?.closest?.('button,a,[data-tab],.quick-route');
      if(!target)return;
      const tab=target.closest('[data-tab]');
      if(tab){e.preventDefault();route(tab.dataset.tab);return;}
      const q=target.closest('.quick-route');
      if(q){e.preventDefault();const r=q.dataset.route;route(r==='plan'?'today':r);return;}
      const id=target.id;
      if(id==='navMore'){e.preventDefault();document.querySelector('#tabs')?.classList.toggle('show-more');return;}
      if(id==='mobileMore'){e.preventDefault();const sub=document.querySelector('#navSubnav');if(sub)sub.classList.toggle('show-mobile');return;}
      if(id==='runCmd'||id==='dailyBrief'){
        e.preventDefault();
        const out=document.querySelector('#aiOut');
        const cmd=document.querySelector('#cmd')?.value?.trim();
        if(out)out.textContent='LOKÁLNÍ BCO: '+(cmd?('Zadání: '+cmd+'\\n\\nDalší krok: zpracuj první konkrétní příležitost v CRM nebo Penězích.'):'Zadej jednu větu do pole „Co chceš vyřešit?“ a spusť znovu.');
        return;
      }
      const routes={aiCrmAudit:'crm',quickReel:'reels',reelOpenMedia:'media',jobsRefresh:'jobs',salesRefresh:'sales',refreshAnalytics:'analytics',productAudit:'shop',workerRefresh:'worker',workerRun:'worker'};
      if(routes[id]){e.preventDefault();route(routes[id]);}
    },true);
  };
  failSafe();
})();
