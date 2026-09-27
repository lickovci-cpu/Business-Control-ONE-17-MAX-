# BCO 17 MAX — 17-SCREEN QA AUDIT

Datum: 2026-09-27
Commit základ: 38622b49ddb54bd5b262904666304c3939f734d4

## Stavové značky

- ✅ FUNGUJE — lokální nebo ověřená akce je funkční.
- 🟡 PARTIAL — funguje část workflow, ale závisí na AI, backendu nebo externí integraci.
- 🔴 ERROR — ověřená chyba blokuje akci.
- ⚪ NO DATA — funkce je připravená, ale bez skutečných dat.
- 🔌 NOT CONNECTED — potřebná externí integrace / účet není připojen.

## QA výsledek

Aktuální produkční deployment po bezpečnostní/stabilizační opravě nemá nové runtime error groups za posledních 15 minut. V posledních 30 minutách jsou vidět převážně očekávané HTTP 401 na chráněných serverových endpointách při použití bez přihlášení; nejde o white-screen/runtime failure.

## 17 obrazovek

| Obrazovka | Stav | Akce / výsledek |
|---|---|---|
| Dnes | ✅ FUNGUJE | ✅ rychlé přechody · ✅ TEĎ UDĚLEJ · 🟡 Vyřešit zadání / AI denní plán podle dostupného AI režimu |
| Peníze | 🟡 PARTIAL | 🟡 cash plán — živá data vyžadují autorizovaný Cloud/backend |
| Řídicí místnost | ✅ FUNGUJE | ✅ lokální přepočet · 🟡 AI brief podle dostupné AI |
| Content Worker | 🟡 PARTIAL | 🟡 generování plánu/kampaně · ✅ stav · ✅ export |
| Obsah | 🟡 PARTIAL | ✅ Meta diagnostika · ✅ lokální rychlý obsah · 🟡 kampaň/7denní plán · 🟡 publikace/schedule |
| Reels | 🟡 PARTIAL | ✅ storyboard/náhled/export · 🟡 AI generování/výběr · 🟡 Meta feed · 🟡 publikace |
| Fotky | ✅ FUNGUJE | ✅ lokální výběr · ✅ TOP 10 · 🟡 AI analýza/výběr |
| Komunikace | 🟡 PARTIAL | ✅ AI draft · 🟡 fronta · 🟡 odeslání · 🟡 backend storage |
| Inbox | 🔌 NOT CONNECTED | 🟡 načtení Meta komentářů · ✅ převod načteného komentáře do lokálního CRM |
| CRM | 🟡 PARTIAL | ✅ lokální CRUD/pipeline/follow-up · 🟡 živé CRM/API · 🟡 AI priority |
| Prodej | ✅ FUNGUJE | ✅ cíle/přepočet/export · ✅ příprava komunikace/nabídky · 🟡 AI coach/scope |
| Zakázky | ✅ FUNGUJE | ✅ lokální zakázka + checklist · ✅ stav/platba/export · 🟡 živá DB synchronizace |
| Distribuce | 🟡 PARTIAL | ✅ přehled kanálů · 🟡 live integrace · ✅ odkazy · 🔌 neaktivní externí publikační kanály |
| Analytika | 🟡 PARTIAL | 🟡 Meta refresh · ✅ lokální learning · ⚪ bez dat při odpojeném zdroji |
| E-shop centrum | ✅ FUNGUJE | ✅ produktové záznamy · 🟡 AI audit · ⚪ NO DATA bez zadaných produktů |
| Autopilot | 🟡 PARTIAL | ✅ lokální prioritizační fronta · 🟡 serverový automation tick je závislý na CRON_SECRET/backend konfiguraci |
| Nastavení | 🟡 PARTIAL | ✅ backup/recovery/PWA pomocné funkce · 🟡 Cloud sync · 🟡 chráněná serverová diagnostika · 🔌 externí účty dle připojení |

## Zjištěné P0/P1

### P0 — mrtvý start / mrtvé UI
Byl nalezen křehký boot řetězec, kde chyba jediné renderovací části mohla zastavit registraci dalších handlerů. Opraveno:
- izolované renderování jednotlivých bloků pomocí `safeRender()`,
- lokální UI je označeno jako READY před síťovými kontrolami,
- síťové chyby už neblokují start,
- rescue click handler je instalován ihned.

### P1 — navigace
Původní hlavní navigace vystavovala jednotlivé obrazovky téměř 1:1. To zvyšovalo kognitivní zátěž a navíc byl `distribution` mimo hlavní navigaci.
Nová struktura:
- Dnes
- Peníze
- Obchod → CRM / Prodej / Zakázky
- Obsah → Editor / Reels / Fotky / Content Worker
- Komunikace → Centrum / Inbox
- Řízení → Řídicí místnost / Autopilot / Analytika / Distribuce
- E-shop
- Systém

### P1 — Cloud auth v kritických cestách
Cloud uživatel nemohl použít některé funkce pouze s Cloud session:
- Meta photo upload nyní používá projektové Cloud membership ověření.
- Revenue sprint nyní přijímá autorizovaného Merch Cloud uživatele a může číst Supabase přes user JWT, pokud není k dispozici service-role key.
- frontend Peníze posílá Cloud Bearer token.

### P1 — falešné integrační stavy
Odhlášený uživatel už není označen jako `Meta: chyba`; systém používá `Meta: NOT CONNECTED`.
Serverová diagnostika v lokálním režimu se neprezentuje jako porucha celé aplikace.

## Co zůstává blokované / partial

1. Autonomní serverový Autopilot/automation tick musí mít skutečně nakonfigurovaný `CRON_SECRET` a potřebné backend secrets.
2. Meta publikace zůstává bezpečně za připojením a approval gate.
3. Živé CRM a část komerčních synchronizací vyžadují Cloud membership nebo panel session.
4. Analytika a Inbox nemohou tvrdit živá data bez skutečného zdroje.
5. PWA může být v již otevřené staré kartě stále pod starým service-worker lifecycle; proto se při významné změně používá asset cache bump.

## UX cíl

BCO má být používán primárně jako:

Dnes → TEĎ UDĚLEJ → konkrétní krok → výsledek → zapsat → další krok

Podrobné obrazovky zůstávají dostupné přes pracovní skupiny, ale už nejsou všechny vystavené jako samostatná hlavní navigační položka.

## Další P1 prioritizace

A) dokončit ověřený live Cloud workflow pro CRM + Peníze,
B) dokončit transparentní stav Autopilotu a jeho scheduleru,
C) sjednotit všechny externí integrace do stejného CONNECTED / PARTIAL / NOT CONNECTED modelu,
D) následně teprve řešit P2/P3 UX kosmetiku.
