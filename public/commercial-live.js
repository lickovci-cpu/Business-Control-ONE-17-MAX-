/* BCO live commercial read model: Supabase-backed quotes, jobs, opportunities and cash. */
(()=>{
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(Number(v)||0);
  const project=()=>{try{return window.state?.project||$('#project')?.value||'jihoceske'}catch{return 'jihoceske'}};
  const req=async()=>{const r=await fetch(`/api/commercial?project=${encodeURIComponent(project())}`,{credentials:'same-origin',signal:AbortSignal.timeout(15000)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j;};
  function block(title,body){return `<div class="card commercial-live"><div class="section-kicker">LIVE DB / SUPABASE</div><h3>${esc(title)}</h3>${body}</div>`;}
  function render(d){
    $$('.commercial-live').forEach(x=>x.remove());
    const c=d.commercial||{},s=c.summary||{};
    const q=(c.quotes||[]).slice(0,8).map(x=>`<div class="item"><strong>${esc(x.quote_number||x.id?.slice(0,8)||'NO NUMBER')}</strong><span class="muted">${esc(x.status||'NO DATA')} · ${money(x.total)}</span></div>`).join('')||'<div class="item">NO DATA — žádné skutečné nabídky v DB.</div>';
    const j=(c.jobs||[]).slice(0,8).map(x=>`<div class="item"><strong>${esc(x.title||'NO TITLE')}</strong><span class="muted">${esc(x.status||'NO DATA')} · ${money(x.price)}</span></div>`).join('')||'<div class="item">NO DATA — žádné skutečné zakázky v DB.</div>';
    const f=(c.financial_entries||[]).slice(0,8).map(x=>`<div class="item"><strong>${esc(x.entry_type||'NO TYPE')} · ${money(x.amount)}</strong><span class="muted">${esc(x.category||x.counterparty||'NO DATA')} · ${esc(x.occurred_on||'')}</span></div>`).join('')||'<div class="item">NO DATA — žádné skutečné finanční položky v DB.</div>';
    const ql=$('#quoteList'),jb=$('#jobBoard'),cw=$('#cashWatch');
    if(ql)ql.insertAdjacentHTML('afterbegin',block(`Nabídky · ${s.quoteCount||0} · otevřené ${s.openQuoteCount||0}`,q));
    if(jb)jb.insertAdjacentHTML('afterbegin',block(`Zakázky · ${s.jobCount||0} · aktivní ${s.activeJobCount||0}`,j));
    if(cw)cw.insertAdjacentHTML('afterbegin',block(`Cash · příjem ${money(s.income)} · výdaj ${money(s.expense)} · netto ${money(s.netCash)}`,f));
    const out=$('#commercialLiveStatus');if(out)out.textContent=`LIVE DB · ${project()} · ${new Date().toLocaleTimeString('cs-CZ')}`;
  }
  async function load(){try{const j=await req();render(j);}catch(e){const out=$('#commercialLiveStatus');if(out)out.textContent=`NOT VERIFIED — ${e.message}`;}}
  function boot(){if(!$('#commercialLiveStatus')){const host=$('#sales')||document.body;const d=document.createElement('div');d.id='commercialLiveStatus';d.className='pill subtle';d.textContent='LIVE DB · načítám…';host.prepend(d);}load();setInterval(load,60000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
