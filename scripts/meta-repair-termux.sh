#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

APP_URL="https://business-control-one.vercel.app"
TEAM="wemone-5402s-projects"
PROJECT="business-control-one"
PAGE_ID="1171696836017672"
APP_ID="1501391245028535"
GRAPH_VERSION="v24.0"
LOCAL_ENV="$HOME/.business-control-one.env"
MCP_ENV="$HOME/meta-mcp-server/.env"
WORK="$HOME/.bc-meta-fix"

say(){ printf '\n== %s ==\n' "$*"; }
fail(){ printf '\nCHYBA: %s\n' "$*" >&2; exit 1; }
vc(){ if command -v vercel >/dev/null 2>&1; then vercel "$@"; else npx --yes vercel@latest "$@"; fi; }
json(){ node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s),p=process.argv[1].split('.');let v=j;for(const k of p)v=v?.[k];process.stdout.write(v==null?'':String(v))}catch{}})" "$1"; }
put_secret(){ local k="$1" v="$2" f; f="$(mktemp)"; chmod 600 "$f"; printf '%s' "$v" > "$f"; vc env rm "$k" production --yes >/dev/null 2>&1 || true; vc env add "$k" production --sensitive < "$f" >/dev/null; rm -f "$f"; }
put_plain(){ local k="$1" v="$2"; vc env rm "$k" production --yes >/dev/null 2>&1 || true; printf '%s' "$v" | vc env add "$k" production >/dev/null; }
write_local(){ local file="$1" k="$2" v="$3" t; mkdir -p "$(dirname "$file")"; touch "$file"; chmod 600 "$file"; t="$(mktemp)"; grep -v "^${k}=" "$file" > "$t" 2>/dev/null || true; printf '%s=%s\n' "$k" "$v" >> "$t"; mv "$t" "$file"; chmod 600 "$file"; }

command -v curl >/dev/null 2>&1 || pkg install -y curl
command -v node >/dev/null 2>&1 || pkg install -y nodejs

say "1/6 Nový Meta User token"
printf 'Otevři Meta Graph API Explorer a vygeneruj NOVÝ User Access Token pro aplikaci Jihočeské střechy MCP.\n'
printf 'Povinně: pages_show_list, pages_read_engagement, pages_manage_posts.\n'
printf 'Pro Reels navíc: instagram_basic, instagram_content_publish.\n\n'
if command -v termux-open-url >/dev/null 2>&1; then termux-open-url "https://developers.facebook.com/tools/explorer/" >/dev/null 2>&1 || true; fi
IFS= read -r -s -p "Vlož nový User Access Token a Enter: " USER_TOKEN
printf '\n'
[[ -n "$USER_TOKEN" ]] || fail "Token je prázdný."

say "2/6 Ověření tokenu"
ME="$(curl -sS -G "https://graph.facebook.com/${GRAPH_VERSION}/me" --data-urlencode 'fields=id,name' --data-urlencode "access_token=$USER_TOKEN")"
ME_ID="$(printf '%s' "$ME" | json id)"
[[ -n "$ME_ID" ]] || fail "Meta nový token odmítla. Vygeneruj nový token a zkus znovu."
printf '✓ User token je platný\n'

PERMS="$(curl -sS -G "https://graph.facebook.com/${GRAPH_VERSION}/me/permissions" --data-urlencode "access_token=$USER_TOKEN")"
MISSING="$(printf '%s' "$PERMS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s),g=new Set((j.data||[]).filter(x=>x.status==='granted').map(x=>x.permission)),r=['pages_show_list','pages_read_engagement','pages_manage_posts'].filter(x=>!g.has(x));process.stdout.write(r.join(', '))}catch{}})")"
[[ -z "$MISSING" ]] || fail "Chybí oprávnění: $MISSING"
IG_MISSING="$(printf '%s' "$PERMS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s),g=new Set((j.data||[]).filter(x=>x.status==='granted').map(x=>x.permission)),r=['instagram_basic','instagram_content_publish'].filter(x=>!g.has(x));process.stdout.write(r.join(', '))}catch{}})")"
[[ -z "$IG_MISSING" ]] && printf '✓ Instagram Reels oprávnění jsou přidělena\n' || printf '! Reels budou čekat na oprávnění: %s\n' "$IG_MISSING"

say "3/6 Dlouhodobý token (pokud máme App Secret)"
APP_SECRET=""
for F in "$LOCAL_ENV" "$MCP_ENV"; do
  [[ -f "$F" ]] || continue
  V="$(grep '^META_APP_SECRET=' "$F" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  [[ -n "$V" ]] && APP_SECRET="$V" && break
done
if [[ -z "$APP_SECRET" ]]; then
  printf 'Pro delší životnost můžeš vložit Meta App Secret. Enter = přeskočit.\n'
  IFS= read -r -s -p "Meta App Secret (volitelné): " APP_SECRET
  printf '\n'
fi
WORK_TOKEN="$USER_TOKEN"
if [[ -n "$APP_SECRET" ]]; then
  LONG="$(curl -sS -G "https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token" --data-urlencode 'grant_type=fb_exchange_token' --data-urlencode "client_id=$APP_ID" --data-urlencode "client_secret=$APP_SECRET" --data-urlencode "fb_exchange_token=$USER_TOKEN")"
  LT="$(printf '%s' "$LONG" | json access_token)"
  if [[ -n "$LT" ]]; then WORK_TOKEN="$LT"; printf '✓ Použit dlouhodobý User token\n'; else printf '! Převod na dlouhodobý token nevyšel; pokračuji s novým tokenem.\n'; fi
fi

say "4/6 Získání Page tokenu"
PAGE="$(curl -sS -G "https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}" --data-urlencode 'fields=id,name,access_token,instagram_business_account' --data-urlencode "access_token=$WORK_TOKEN")"
PAGE_TOKEN="$(printf '%s' "$PAGE" | json access_token)"
IG_ID="$(printf '%s' "$PAGE" | json instagram_business_account.id)"
if [[ -z "$PAGE_TOKEN" ]]; then
  ACC="$(curl -sS -G "https://graph.facebook.com/${GRAPH_VERSION}/me/accounts" --data-urlencode 'fields=id,name,access_token' --data-urlencode "access_token=$WORK_TOKEN")"
  PAGE_TOKEN="$(printf '%s' "$ACC" | PAGE_ID="$PAGE_ID" node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s),x=(j.data||[]).find(x=>String(x.id)===process.env.PAGE_ID);process.stdout.write(x?.access_token||'')}catch{}})")"
fi
[[ -n "$PAGE_TOKEN" ]] || fail "Meta nevydala Page token. Ověř správu stránky a požadovaná oprávnění."
printf '✓ Page token získán\n'

say "5/6 Uložení do Vercelu"
if ! vc whoami >/dev/null 2>&1; then vc login; fi
mkdir -p "$WORK"; cd "$WORK"
vc link --yes --project "$PROJECT" --scope "$TEAM" >/dev/null
put_secret META_USER_TOKEN "$WORK_TOKEN"
put_secret META_PAGE_TOKEN "$PAGE_TOKEN"
put_plain META_PAGE_ID "$PAGE_ID"
[[ -n "$IG_ID" ]] && put_plain META_IG_ID "$IG_ID"
write_local "$LOCAL_ENV" META_USER_TOKEN "$WORK_TOKEN"
write_local "$LOCAL_ENV" META_PAGE_TOKEN "$PAGE_TOKEN"
write_local "$MCP_ENV" META_USER_TOKEN "$WORK_TOKEN"
write_local "$MCP_ENV" META_PAGE_TOKEN "$PAGE_TOKEN"
printf '✓ Meta přístup uložen\n'

say "6/6 Redeploy"
vc redeploy "$APP_URL" --yes >/dev/null
printf '✓ Produkční redeploy spuštěn\n'
printf '\n========================================\nMETA PŘÍSTUP OBNOVEN ✓\nZa 30–60 s otevři znovu Business Control ONE.\nReels oprávnění: %s\n========================================\n' "${IG_MISSING:-OK}"
