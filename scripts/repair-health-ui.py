from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public'/'app.js'
s=p.read_text(encoding='utf-8')
start=s.index('function renderSecurityNotes(h={}){')
end=s.index('\nconst REEL_TEMPLATES=',start)
replacement='''function renderSecurityNotes(h={}){
  const ai=h.ai||{};
  const notes=[
    ['Admin session','Starší panelové heslo se po přihlášení drží jen v HttpOnly cookie.'],
    ['Supabase Auth','Obnovovací token je zatím v localStorage. Před širším nasazením ho přesuneme do bezpečnějšího HttpOnly/BFF řešení.'],
    ['Projektová izolace','Meta publikace, AI běhy, fotky, koncepty i fronta zpráv jsou svázané s aktivním projektem.'],
    ['AI soukromí','Běžný AI kontext neobsahuje telefon ani e-mail leadu. Obrázky se odesílají jen při výslovné obrazové analýze.'],
    ['Náklady',`Auto režim: ${ai.costMode||'free-first'}. Placené AI: ${ai.paidProvidersEnabled?'povoleno':'zakázáno'}; fallback: ${ai.paidFallbacks?'povolen':'zakázán'}.`]
  ];
  $('#securityNotes').innerHTML=notes.map(x=>`<div class=note><strong>${esc(x[0])}</strong><span class=muted>${esc(x[1])}</span></div>`).join('');
}'''
p.write_text(s[:start]+replacement+s[end:],encoding='utf-8')
print('REPLACED_HEALTH_SECURITY_NOTES')
