# Business Control ONE 9.2 MAX

## Změny
- živá kontrola Meta tokenu místo falešného „Meta připraveno“;
- automatický fallback přes uložený Meta User token a odvození nového Page tokenu;
- Reels Studio: cíl, délka, styl, vybrané fotografie, AI hook, storyboard, voiceover, overlay text, caption, CTA a hashtags;
- lokální náhled hotového videa bez nahrávání do RAM při startu;
- publikace Instagram Reelu z veřejné HTTPS adresy videa s povinným potvrzením;
- bezpečné čekání na Meta zpracování Reelu;
- opravené chování 401: vypršelý Meta token už nevyhazuje uživatele z Business Control session;
- zachována mobilní lazy-load pipeline fotografií z 9.0.

## Meta obnova
Pokud je starý Meta User token ještě platný, instalační skript ho zkusí použít automaticky. Pokud je také vypršelý, v Termuxu lze spustit `bc-meta-fix` a vložit nový Meta User token.
