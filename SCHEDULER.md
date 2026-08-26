# Scheduler pro automatické zprávy

Endpoint `/api/cron` zpracuje potvrzenou frontu e-mailů, WhatsApp a RCS. Je chráněn `CRON_SECRET` v HTTP hlavičce:

`Authorization: Bearer TVUJ_CRON_SECRET`

## Proč není cron natvrdo ve vercel.json
Vercel Hobby aktuálně dovoluje nativní cron pouze jednou denně, takže hodinový nebo 15min cron může zablokovat deployment. Proto je projekt nasaditelný i na Hobby bez cron definice.

## Varianty
1. **Bezplatně / nejjednodušeji:** externí scheduler (např. cron-job.org) volá `https://TVA-DOMENA/api/cron` každých 10–15 minut a přidá Authorization header.
2. **Vercel Pro:** přidej do `vercel.json` například `{"crons":[{"path":"/api/cron","schedule":"*/5 * * * *"}]}`.
3. **Denní Hobby cron:** lze použít pouze pokud stačí denní dávka; pro přesné follow-upy není vhodný.

Naplánovaný Facebook příspěvek používá Meta-native scheduling a tento scheduler nepotřebuje.
