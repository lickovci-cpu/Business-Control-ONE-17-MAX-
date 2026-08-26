# Audit — Business Control ONE 11 MAX

## Automatické kontroly
- Node syntax check všech JS/MJS souborů.
- JSON parse package.json / vercel.json / manifest.webmanifest.
- Kontrola unikátních HTML ID.
- Kontrola všech literal `$(`#id`)` vazeb JS -> HTML.
- CSP kontrola media-src pro lokální Reel preview.
- Service worker cache/version marker + notificationclick.
- Smoke test auth/session, confirmation tokenu, Meta project isolation, AI task markerů, Sales/Quote/Jobs/Reels/PWA funkcí.

## Výsledek
CHECK OK + SMOKE OK.

## Známé externí limity
- Skutečné odesílání e-mail/WhatsApp/RCS vyžaduje provider credentials.
- Meta publikace vyžaduje platný Meta token; při expiraci je potřeba obnova.
- Upozornění při úplně zavřené aplikaci vyžadují serverový push kanál; v 11 MAX se nic takového nepředstírá.
- Reel Composer je storyboard/preview, ne finální MP4 renderer.
