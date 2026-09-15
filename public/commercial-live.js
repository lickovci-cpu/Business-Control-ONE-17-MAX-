/* BCO live commercial read model: Supabase-backed quotes, jobs, opportunities and cash. */
(()=>{
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(Number(v)||0);
  const project=()=>{try{return window.state?.project||$('#project')?.value||'jihoceske'}catch{return 'jihoceske'}};
  const req=async(url,opt={})=>{const r=await fetch(url,{credentials:'same-origin',headers:{'content-type':'application/json',...(opt.headers||{})},...opt});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j;};
  async function mutate(action,payload){const first=await req(`/api/commercial?project=${encodeURIComponent(project())}`,{method:'POST',body:JSON.stringify({action,project:project(),payload})});if(!first.approvalRequired)return first;const ok=confirm('Uložit skutečný záznam do Supabase?\n\nVyžaduje approval Control Plane.');if(!ok)return null;const approval=await req('/api/control?action=approve',{method:'POST',body:JSON.stringify({project:project(),taskId:first.task.id})});return req(`/api/commercial?project=${encodeURIComponent(project())}`,{method:'POST',body:JSON.stringify({action,project:project(),payload,taskId:first.task.id,approvalToken:approval.approvalToken})});}
  function block(title,body,actions=''){return `<div class="card commercial-live"><div class="section-kicker">LIVE DB / SUPABASE</div><h3>${esc(title)}</h3>${body}${actions?`<div class="action-row">${actions}</div>`:''}</div>`;}
  function render(d){
    $$('.commercial-live').forEach(x=>x.remove());
    const c=d.commercial||{},s=c.summary||{};
    const q=(c.quotes||[]).slice(0,8).map(x=>`<div class="item"><strong>${esc(x.quote_number||x.id?.slice(0,8)||'NO NUMBER')}</strong><span class="muted">${esc(x.status||'NO DATA')} · ${money(x.total)}</span></div>`).join('')||'<div class="item">NO DATA — žádné skutečné nabídky v DB.</div>';
    const j=(c.jobs||[]).slice(0,8).map(x=>`<div class="item"><strong>${esc(x.title||'NO TITLE')}</strong><span class="muted">${esc(x.status||'NO DATA')} · ${money(x.price)}</span></div>`).join('')||'<div class="item">NO DATA — žádné skutečné zakázky v DB.</div>';
    const f=(c.financial_entries||[]).slice(0,8).map(x=>`<div class="item"><strong>${esc(x.entry_type||'NO TYPE')} · ${money(x.amount)}</strong><span class="muted">${esc(x.category||x.counterparty||'NO DATA')} · ${esc(x.occurred_on||'')}</span></div>`).join('')||'<div class="item">NO DATA — žádné skutečné finanční položky v DB.</div>';
    const ql=$('#quoteList'),jb=$('#jobBoard'),cw=$('#cashWatch');
    if(ql)ql.insertAdjacentHTML('afterbegin',block(`Nabídky · ${s.quoteCount||0} · otevřené ${s.openQuoteCount||0}`,q,'<button class="btn small commercial-create-quote">+ Nová nabídka DB</button>'));
    if(jb)jb.insertAdjacentHTML('afterbegin',block(`Zakázky · ${s.jobCount||0} · aktivní ${s.activeJobCount||0}`,j,'<button class="btn small commercial-create-job">+ Nová zakázka DB</button>'));
    if(cw)cw.insertAdjacentHTML('afterbegin',block(`Cash · příjem ${money(s.income)} · výdaj ${money(s.expense)} · netto ${money(s.netCash)}`,f,'<button class="btn small commercial-create-income">+ Příjem DB</button><button class="btn small commercial-create-expense">+ Výdaj DB</button>'));
    bind();const out=$('#commercialLiveStatus');if(out)out.textContent=`LIVE DB · ${project()} · ${new Date().toLocaleTimeString('cs-CZ')}`;
  }
  function bind(){
    $('.commercial-create-quote')?.addEventListener('click',async()=>{const n=prompt('Číslo nabídky','N-'+new Date().toISOString().slice(0,10).replaceAll('-',''));if(!n)return;const total=Number((prompt('Celková cena v Kč','0')||'0').replace(',','.'));if(!Number.isFinite(total)||total<0)return alert('Neplatná cena.');try{await mutate('create-quote',{quote_number:n,total,subtotal:total,tax:0,currency:'CZK'});await load();}catch(e){alert(`NOT VERIFIED: ${e.message}`)}});
    $('.commercial-create-job')?.addEventListener('click',async()=>{const title=prompt('Název zakázky');if(!title)return;const price=Number((prompt('Cena v Kč','0')||'0').replace(',','.'));if(!Number.isFinite(price)||price<0)return alert('Neplatná cena.');try{await mutate('create-job',{title,price,direct_cost:0,status:'planned'});await load();}catch(e){alert(`NOT VERIFIED: ${e.message}`)}});
    const financial=(type)=>async()=>{const amount=Number((prompt(type==='income'?'Částka příjmu v Kč':'Částka výdaje v Kč','0')||'0').replace(',','.'));if(!Number.isFinite(amount)||amount<0)return alert('Neplatná částka.');const category=prompt('Kategorie / účel','');if(category===null)return;try{await mutate('create-financial',{entry_type:type,amount,currency:'CZK',occurred_on:new Date().toISOString().slice(0,10),status:'confirmed',category});await load();}catch(e){alert(`NOT VERIFIED: ${e.message}`)}};
    $('.commercial-create-income')?.addEventListener('click',financial('income'));$('.commercial-create-expense')?.addEventListener('click',financial('expense'));
  }
  async function load(){try{const r=await req(`/api/commercial?project=${encodeURIComponent(project())}`);render(r);}catch(e){const out=$('#commercialLiveStatus');if(out)out.textContent=`NOT VERIFIED — ${e.message}`;}}
  function boot(){if(!$('#commercialLiveStatus')){const host=$('#sales')||document.body;const d=document.createElement('div');d.id='commercialLiveStatus';d.className='pill subtle';d.textContent='LIVE DB · načítám…';host.prepend(d);}load();setInterval(load,60000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
