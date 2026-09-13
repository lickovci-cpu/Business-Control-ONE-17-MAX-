# Business Control ONE 17 MAX

Mobilní AI Business OS pro řízení více malých projektů: prodej, CRM, nabídky, zakázky, cash watch, obsah, Reels, média, komunikace a cloud snapshoty.

## Hlavní moduly
- Dnes: priority, portfolio, AI command center.
- Obsah: posty, Campaign Factory, týdenní plán.
- Reels Studio 3: AI storyboard + lehký 9:16 composer.
- Fotky: lazy thumbnails, max 2 dekódování současně, omezená cache.
- CRM: pipeline, scoring, follow-up kit.
- Prodej: weighted pipeline, target, Deal Coach, Quote Builder, CSV.
- Zakázky: checklisty, stav realizace, platby, cash watch.
- Analytika / e-shopy / komunikace / Meta.
- PWA: recovery, cloud snapshot, persistent storage, upozornění při otevření.
- Autopilot: bezpečná lokální fronta prioritních obchodních a realizačních úkolů.
- Control Plane: centrální lifecycle úkolů, approval binding, jednorázová spotřeba schválení, evidence, audit, attempt lineage a project isolation.

## Control Plane bezpečnost
Mutující akce (`comms:*` a `meta:*`) musí projít approval flow. Approval je svázaný s task ID, projektem, akcí a hash payloadu a jeho spotřeba je jednorázová. Přímé operace přes `/api/control` zároveň ověřují project proti tasku. Produkční KV persistence je nutná pro control-plane stav; bez ní mutace skončí bezpečnostně konzervativně chybou konfigurace.

## Bezpečnostní hranice FVE
Nevymýšlí ceny, certifikace, počet realizací, zaměstnance ani reference. Elektro zapojení a revize se formulují pouze jako spolupráce s elektrikářem a revizním technikem.

## Test
`npm run check && npm test`

`npm test` spouští původní smoke test a `tests/control-plane.mjs`.
