# Business Control ONE 11 MAX

## Revenue OS
- Sales Command: vážená pipeline, měsíční cíl, gap, dnešní follow-up queue.
- Deal Coach: AI další krok pro lead; kontaktní údaj se do AI kontextu neposílá.
- Quote Builder: AI smí navrhnout rozsah a ověřovací otázky, nikoli cenu.
- CSV import/export CRM.

## Delivery OS
- Zakázky a checklisty pro více projektů.
- Převod z leadu/nabídky, stav realizace, progress, splatnost a cash watch.
- FVE checklisty respektují hranici elektro/revizních oprávnění.

## Reels Studio 3
- Lehký 9:16 lokální composer z vybraných fotek a storyboardu.
- Přehrání scén, timeline, safe-zone overlay, export HTML storyboardu.
- Composer nic sám nepublikuje a nevydává preview za hotové MP4.

## PWA / telefon
- Upozornění na follow-up při otevření / návratu do PWA, pokud je uživatel povolí.
- Požadavek na persistent storage pro snížení rizika vyčištění lokálních dat prohlížečem.
- Ruční kontrola aktualizace service workeru.
- CSP doplněn o media-src pro bezpečný blob video preview.

## Kompatibilita
- Zachovává localStorage klíč a cloud snapshot klíč, aby nebyla rozbita data z 8.x/9.x.
- Projektová data se při migraci doplní o quotes/jobs/targetMonthly bez ztráty existujících leadů, produktů, médií a draftů.
